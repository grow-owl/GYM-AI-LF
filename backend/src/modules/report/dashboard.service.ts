import mongoose from 'mongoose';
import { Member } from '../member/member.model';
import { Trainer } from '../trainer/trainer.model';
import { Attendance } from '../attendance/attendance.model';
import { MemberPayment } from '../payment/memberPayment.model';
import { MembershipStatus } from '../member/member.types';
import { PaymentStatus } from '../payment/platformSubscription.types';
import { IDashboardOverview, IExpiringMembershipItem } from './report.types';
import { logger } from '../../config/logger';
import { getDayKeyForBranch } from '../../common/utils/timezone';

interface CacheEntry {
  data: IDashboardOverview;
  expiresAt: number;
}

const dashboardCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 60 * 1000; // 60s TTL

export class DashboardService {
  public static clearCache(): void {
    dashboardCache.clear();
  }

  /**
   * Aggregate owner dashboard metrics with short TTL in-memory caching
   */
  public static async getOwnerDashboardOverview(
    gymId: string,
    branchId?: string
  ): Promise<IDashboardOverview> {
    const cacheKey = `${gymId}_${branchId || 'all'}`;
    const cached = dashboardCache.get(cacheKey);

    if (cached && cached.expiresAt > Date.now()) {
      logger.info(`⚡ Dashboard Overview cache hit: [Gym: ${gymId}]`);
      return cached.data;
    }

    const gymObjectId = new mongoose.Types.ObjectId(gymId);
    const branchObjectId = branchId ? new mongoose.Types.ObjectId(branchId) : undefined;

    const memberFilter: any = { gymId: gymObjectId, isDeleted: false, membershipStatus: MembershipStatus.ACTIVE };
    const trainerFilter: any = { gymId: gymObjectId, isDeleted: false };
    const attendanceFilter: any = { gymId: gymObjectId };
    const paymentFilter: any = { gymId: gymObjectId, status: PaymentStatus.SUCCESS };

    if (branchObjectId) {
      memberFilter.branchId = branchObjectId;
      trainerFilter.branchId = branchObjectId;
      attendanceFilter.branchId = branchObjectId;
      paymentFilter.branchId = branchObjectId;
    }

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    const todayBranchKey = getDayKeyForBranch(now, 'Asia/Kolkata');
    const todayUtcKey = getDayKeyForBranch(now, 'UTC');
    const isoKey = now.toISOString().split('T')[0];

    attendanceFilter.$or = [
      { dayKey: todayBranchKey },
      { dayKey: todayUtcKey },
      { dayKey: isoKey },
      { checkInAt: { $gte: startOfToday, $lte: endOfToday } },
    ];

    const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Expiry filter
    const expiryFilter = {
      ...memberFilter,
      membershipEndDate: { $gte: now, $lte: in7Days },
    };

    // Revenue this month filter
    const revenueFilter = {
      ...paymentFilter,
      paidAt: { $gte: firstDayOfMonth },
    };

    // 30d Attendance distinct members filter
    const attendance30dMatch: any = {
      gymId: gymObjectId,
      checkInAt: { $gte: thirtyDaysAgo },
    };
    if (branchObjectId) {
      attendance30dMatch.branchId = branchObjectId;
    }

    const [
      totalActiveMembers,
      totalTrainers,
      todayCheckIns,
      membershipsExpiringIn7Days,
      revenueResult,
      distinct30dMembers,
    ] = await Promise.all([
      Member.countDocuments(memberFilter),
      Trainer.countDocuments(trainerFilter),
      Attendance.countDocuments(attendanceFilter),
      Member.countDocuments(expiryFilter),
      MemberPayment.aggregate([
        { $match: revenueFilter },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
      Attendance.distinct('memberId', attendance30dMatch),
    ]);

    const finalActiveMembers = totalActiveMembers;
    const finalTrainers = totalTrainers;

    const revenueThisMonth = revenueResult[0]?.total || 0;
    const activeAttendedCount = distinct30dMembers.length;
    const avgAttendanceRate30d =
      finalActiveMembers > 0
        ? Math.round((activeAttendedCount / finalActiveMembers) * 100 * 100) / 100
        : 0;

    const data: IDashboardOverview = {
      totalActiveMembers: finalActiveMembers,
      totalTrainers: finalTrainers,
      todayCheckIns,
      revenueThisMonth,
      membershipsExpiringIn7Days,
      avgAttendanceRate30d,
    };

    dashboardCache.set(cacheKey, {
      data,
      expiresAt: Date.now() + CACHE_TTL_MS, // 5s short cache
    });

    logger.info(`📊 Dashboard Overview computed: [Gym: ${gymId}] [ActiveMembers: ${finalActiveMembers}]`);
    return data;
  }

  /**
   * Dedicated Expiring Memberships & Payment Tracking view for Gym Owners
   */
  public static async getExpiringMembershipsDetail(
    gymId: string,
    branchId?: string,
    daysLookahead: number = 7
  ): Promise<IExpiringMembershipItem[]> {
    const gymObjectId = new mongoose.Types.ObjectId(gymId);
    const now = new Date();
    const futureLimit = new Date(now.getTime() + daysLookahead * 24 * 60 * 60 * 1000);

    const filter: any = {
      gymId: gymObjectId,
      isDeleted: false,
      membershipEndDate: { $gte: now, $lte: futureLimit },
    };

    if (branchId) {
      filter.branchId = new mongoose.Types.ObjectId(branchId);
    }

    const members = await Member.find(filter)
      .populate('userId', 'fullName email phone')
      .populate('branchId', 'name')
      .sort({ membershipEndDate: 1 });

    const results: IExpiringMembershipItem[] = [];

    for (const m of members) {
      const userObj = m.userId as any;
      const branchObj = m.branchId as any;

      const lastPayment = await MemberPayment.findOne({
        memberId: m._id,
        status: PaymentStatus.SUCCESS,
      }).sort({ paidAt: -1 });

      const diffMs = new Date(m.membershipEndDate).getTime() - now.getTime();
      const daysUntilExpiry = Math.max(0, Math.ceil(diffMs / (24 * 60 * 60 * 1000)));

      results.push({
        memberId: m._id.toString(),
        fullName: userObj?.fullName || 'N/A',
        email: userObj?.email || '',
        phone: userObj?.phone || '',
        membershipStatus: m.membershipStatus,
        membershipPlan: m.planName || 'Standard',
        membershipEndDate: m.membershipEndDate,
        daysUntilExpiry,
        lastPaymentAmount: lastPayment?.amount,
        lastPaymentDate: lastPayment?.paidAt,
        branchName: branchObj?.name,
      });
    }

    return results;
  }
}
