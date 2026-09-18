import mongoose from 'mongoose';
import { Branch } from '../gym/branch.model';
import { MemberPayment } from '../payment/memberPayment.model';
import { Attendance } from '../attendance/attendance.model';
import { Member } from '../member/member.model';
import { PaymentStatus } from '../payment/platformSubscription.types';
import { MembershipStatus } from '../member/member.types';
import { Role } from '../../common/constants/roles.enum';
import { AppError } from '../../common/utils/AppError';

export interface BranchPoint {
  date: string;
  value: number;
}

export interface BranchSeries {
  branchId: string;
  branchName: string;
  points: BranchPoint[];
  metricValue?: number;
  activeMembers?: number;
  totalMembers?: number;
  attendanceRate?: number;
  revenue?: number;
}

export interface BranchComparisonResult {
  metric: string;
  period: string;
  branches: BranchSeries[];
}

export class BranchAnalyticsService {
  /**
   * Aggregate multi-branch time-series metrics with zero-filled dates
   */
  public static async getBranchComparison(
    gymId: string,
    metric: string = 'revenue',
    period: string = '30d',
    userRole?: string,
    userBranchId?: string
  ): Promise<BranchComparisonResult> {
    const gymObjectId = new mongoose.Types.ObjectId(gymId);

    // 1. Fetch all active branches for this gym
    let branchFilter: any = { gymId: gymObjectId, isDeleted: false };
    if (userRole === Role.BRANCH_MANAGER && userBranchId) {
      branchFilter._id = new mongoose.Types.ObjectId(userBranchId);
    }

    const branches = await Branch.find(branchFilter).select('_id name');
    if (branches.length === 0 && userRole === Role.BRANCH_MANAGER) {
      throw AppError.forbidden('Branch managers can only view analytics for their assigned branch');
    }

    // 2. Generate Date Buckets
    const { startDate, dateBuckets, isMonthly } = this.generateDateBuckets(period);
    const dateFormat = isMonthly ? '%Y-%m' : '%Y-%m-%d';

    // 3. Aggregate Data based on selected metric
    const branchDataMap: Record<string, Record<string, number>> = {};
    branches.forEach((b) => {
      branchDataMap[b._id.toString()] = {};
    });

    if (metric === 'revenue') {
      const agg = await MemberPayment.aggregate([
        {
          $match: {
            gymId: gymObjectId,
            status: PaymentStatus.SUCCESS,
            paidAt: { $gte: startDate },
          },
        },
        {
          $group: {
            _id: {
              branchId: '$branchId',
              date: { $dateToString: { format: dateFormat, date: '$paidAt' } },
            },
            total: { $sum: '$amount' },
          },
        },
      ]);

      agg.forEach((item) => {
        const bId = item._id.branchId?.toString();
        const dateStr = item._id.date;
        if (bId && branchDataMap[bId]) {
          branchDataMap[bId][dateStr] = Math.round(item.total * 100) / 100;
        }
      });
    } else if (metric === 'attendance_rate' || metric === 'attendance') {
      const agg = await Attendance.aggregate([
        {
          $match: {
            gymId: gymObjectId,
            checkInAt: { $gte: startDate },
          },
        },
        {
          $group: {
            _id: {
              branchId: '$branchId',
              date: { $dateToString: { format: dateFormat, date: '$checkInAt' } },
            },
            count: { $sum: 1 },
          },
        },
      ]);

      agg.forEach((item) => {
        const bId = item._id.branchId?.toString();
        const dateStr = item._id.date;
        if (bId && branchDataMap[bId]) {
          branchDataMap[bId][dateStr] = item.count;
        }
      });
    } else if (metric === 'churn_rate' || metric === 'churn') {
      const agg = await Member.aggregate([
        {
          $match: {
            gymId: gymObjectId,
            membershipStatus: { $in: [MembershipStatus.CANCELLED, MembershipStatus.EXPIRED] },
            updatedAt: { $gte: startDate },
          },
        },
        {
          $group: {
            _id: {
              branchId: '$branchId',
              date: { $dateToString: { format: dateFormat, date: '$updatedAt' } },
            },
            count: { $sum: 1 },
          },
        },
      ]);

      agg.forEach((item) => {
        const bId = item._id.branchId?.toString();
        const dateStr = item._id.date;
        if (bId && branchDataMap[bId]) {
          branchDataMap[bId][dateStr] = item.count;
        }
      });
    } else {
      // Default: active_members (new member acquisitions / active count per bucket)
      const agg = await Member.aggregate([
        {
          $match: {
            gymId: gymObjectId,
            isDeleted: false,
            createdAt: { $gte: startDate },
          },
        },
        {
          $group: {
            _id: {
              branchId: '$branchId',
              date: { $dateToString: { format: dateFormat, date: '$createdAt' } },
            },
            count: { $sum: 1 },
          },
        },
      ]);

      agg.forEach((item) => {
        const bId = item._id.branchId?.toString();
        const dateStr = item._id.date;
        if (bId && branchDataMap[bId]) {
          branchDataMap[bId][dateStr] = item.count;
        }
      });
    }

    // 4. Fetch active member counts and total member counts per branch
    const [activeCounts, totalCounts] = await Promise.all([
      Member.aggregate([
        {
          $match: {
            gymId: gymObjectId,
            isDeleted: false,
            membershipStatus: MembershipStatus.ACTIVE,
          },
        },
        {
          $group: {
            _id: '$branchId',
            count: { $sum: 1 },
          },
        },
      ]),
      Member.aggregate([
        {
          $match: {
            gymId: gymObjectId,
            isDeleted: false,
          },
        },
        {
          $group: {
            _id: '$branchId',
            count: { $sum: 1 },
          },
        },
      ]),
    ]);

    const activeMap: Record<string, number> = {};
    activeCounts.forEach((c) => {
      if (c._id) activeMap[c._id.toString()] = c.count;
    });

    const totalMap: Record<string, number> = {};
    totalCounts.forEach((c) => {
      if (c._id) totalMap[c._id.toString()] = c.count;
    });

    // 5. Zero-fill missing dates for every branch and compute summary metrics
    const branchSeriesList: BranchSeries[] = branches.map((b) => {
      const bId = b._id.toString();
      const points: BranchPoint[] = dateBuckets.map((dStr) => ({
        date: dStr,
        value: branchDataMap[bId]?.[dStr] || 0,
      }));

      const pointsSum = points.reduce((acc, p) => acc + (p.value || 0), 0);
      const pointsAvg = points.length > 0 ? pointsSum / points.length : 0;

      let metricVal = Math.round(pointsSum * 100) / 100;
      if (metric === 'attendance_rate' || metric === 'churn_rate') {
        metricVal = Math.round(pointsAvg * 10) / 10;
      }

      const activeCount = activeMap[bId] || 0;
      const totalCount = totalMap[bId] || 0;

      return {
        branchId: bId,
        branchName: b.name,
        points,
        metricValue: metricVal,
        activeMembers: activeCount,
        totalMembers: totalCount,
        revenue: metric === 'revenue' ? metricVal : undefined,
        attendanceRate: (metric === 'attendance' || metric === 'attendance_rate') ? metricVal : undefined,
      };
    });

    return {
      metric,
      period,
      branches: branchSeriesList,
    };
  }

  /**
   * Helper: Generate aligned date bucket strings
   */
  private static generateDateBuckets(period: string): {
    startDate: Date;
    dateBuckets: string[];
    isMonthly: boolean;
  } {
    const now = new Date();
    const dateBuckets: string[] = [];
    let startDate: Date;
    let isMonthly = false;

    if (period === '12m') {
      isMonthly = true;
      startDate = new Date(now.getFullYear(), now.getMonth() - 11, 1);
      for (let i = 11; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        dateBuckets.push(`${yyyy}-${mm}`);
      }
    } else if (period === '90d') {
      startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      for (let i = 89; i >= 0; i--) {
        const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
        dateBuckets.push(d.toISOString().split('T')[0]);
      }
    } else {
      // Default: 30d
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      for (let i = 29; i >= 0; i--) {
        const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
        dateBuckets.push(d.toISOString().split('T')[0]);
      }
    }

    return { startDate, dateBuckets, isMonthly };
  }
}
