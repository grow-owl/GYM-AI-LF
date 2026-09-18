import mongoose from 'mongoose';
import { ChurnRiskAssessment } from './churnPrediction.model';
import { IChurnRiskAssessment } from './aiCoach.types';
import { Member } from '../member/member.model';
import { Attendance } from '../attendance/attendance.model';
import { WorkoutLog } from '../workout/workoutLog.model';
import { MemberGameStats } from '../gamification/memberGameStats.model';
import { MemberPayment } from '../payment/memberPayment.model';
import { PaymentStatus } from '../payment/platformSubscription.types';
import { AIDataAggregatorService } from './aiDataAggregator.service';
import { AppError } from '../../common/utils/AppError';
import { logger } from '../../config/logger';

export class ChurnPredictionService {
  /**
   * Assess and persist churn risk for a single member
   */
  public static async assessMemberChurnRisk(memberId: string): Promise<IChurnRiskAssessment> {
    const member = await Member.findOne({
      $or: [
        { _id: mongoose.Types.ObjectId.isValid(memberId) ? memberId : undefined },
        { userId: mongoose.Types.ObjectId.isValid(memberId) ? memberId : undefined },
      ],
      isDeleted: false,
    });

    if (!member) {
      throw AppError.notFound('Member profile not found');
    }

    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

    // 1. Fetch attendance, workout logs, gamification stats, and payment info in parallel
    const [lastAttendance, recentLogs, previousLogs, gameStats, latestPayment] = await Promise.all([
      Attendance.findOne({ memberId: member._id }).sort({ checkInAt: -1 }),
      WorkoutLog.find({ memberId: member._id, date: { $gte: thirtyDaysAgo } }),
      WorkoutLog.find({ memberId: member._id, date: { $gte: sixtyDaysAgo, $lt: thirtyDaysAgo } }),
      MemberGameStats.findOne({ memberId: member._id }),
      MemberPayment.findOne({ memberId: member._id, isDeleted: false }).sort({ paidAt: -1, createdAt: -1 }),
    ]);

    let daysSinceLastVisit = 0;
    if (lastAttendance) {
      const diffMs = now.getTime() - new Date(lastAttendance.checkInAt).getTime();
      daysSinceLastVisit = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    } else {
      const startDate = member.createdAt || member.membershipStartDate;
      const diffMs = now.getTime() - new Date(startDate).getTime();
      daysSinceLastVisit = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    }

    const isExerciseCompleted = (ex: any) =>
      Boolean(ex.completedAt) || (Array.isArray(ex.sets) && ex.sets.some((s: any) => s.completed === true));

    const isLogCompleted = (log: any) =>
      Array.isArray(log.exercises) &&
      log.exercises.length > 0 &&
      log.exercises.every(isExerciseCompleted);

    const calcCompletionRate = (logs: any[]) => {
      if (logs.length === 0) return 100;
      const completed = logs.filter(isLogCompleted).length;
      return (completed / logs.length) * 100;
    };

    const recentRate = calcCompletionRate(recentLogs);
    const previousRate = calcCompletionRate(previousLogs);
    const completionRateDropPercent = Math.max(0, previousRate - recentRate);

    // 3. Compute streak information
    const streakBrokenDaysAgo = daysSinceLastVisit > 1 ? daysSinceLastVisit : undefined;
    const previousStreakDays = gameStats?.longestStreak ?? 0;

    // 4. Compute membership expiry and payment status
    let daysUntilMembershipExpiry: number | undefined = undefined;
    if (member.membershipEndDate) {
      const diffMs = new Date(member.membershipEndDate).getTime() - now.getTime();
      daysUntilMembershipExpiry = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    }

    const hasOverduePayment = Boolean(
      latestPayment &&
        (latestPayment.status === PaymentStatus.FAILED ||
          latestPayment.status === PaymentStatus.PENDING ||
          (latestPayment.status as string) === 'failed' ||
          (latestPayment.status as string) === 'overdue')
    );

    // 5. Deterministic Risk Evaluation
    const { riskLevel, riskFactors } = AIDataAggregatorService.calculateChurnRisk(
      daysSinceLastVisit,
      completionRateDropPercent,
      streakBrokenDaysAgo,
      previousStreakDays,
      daysUntilMembershipExpiry,
      hasOverduePayment
    );

    // 5. Persist Assessment Result
    const assessment = new ChurnRiskAssessment({
      memberId: member._id,
      gymId: member.gymId,
      branchId: member.branchId,
      riskLevel,
      riskFactors,
      daysSinceLastVisit,
      streakBrokenDaysAgo,
      assessedAt: now,
    });

    await assessment.save();

    logger.info(
      `📊 Churn risk assessed for member [${member._id}]: [Risk: ${riskLevel}] [Days since visit: ${daysSinceLastVisit}]`
    );

    return assessment;
  }

  /**
   * Cron-ready batch processing function for all active members in a gym
   */
  public static async assessAllActiveMembersChurnRisk(gymId: string): Promise<number> {
    const activeMembers = await Member.find({
      gymId: new mongoose.Types.ObjectId(gymId),
      status: 'active',
      isDeleted: false,
    }).select('_id');

    let processedCount = 0;
    const batchSize = 25;

    for (let i = 0; i < activeMembers.length; i += batchSize) {
      const batch = activeMembers.slice(i, i + batchSize);
      await Promise.all(batch.map((m) => ChurnPredictionService.assessMemberChurnRisk(m._id.toString())));
      processedCount += batch.length;
    }

    return processedCount;
  }

  /**
   * Get latest churn risk assessment list for Owner Dashboard
   */
  public static async getAtRiskMembers(
    gymId: string,
    branchId?: string,
    riskLevel?: 'low' | 'medium' | 'high'
  ): Promise<any[]> {
    const matchFilter: Record<string, unknown> = {
      gymId: new mongoose.Types.ObjectId(gymId),
    };

    if (branchId) {
      matchFilter.branchId = new mongoose.Types.ObjectId(branchId);
    }

    const aggregationPipeline: any[] = [
      { $match: matchFilter },
      { $sort: { assessedAt: -1 } },
      {
        $group: {
          _id: '$memberId',
          latestAssessment: { $first: '$$ROOT' },
        },
      },
      { $replaceRoot: { newRoot: '$latestAssessment' } },
    ];

    if (riskLevel) {
      aggregationPipeline.push({ $match: { riskLevel } });
    } else {
      // Default: show medium and high risk members
      aggregationPipeline.push({ $match: { riskLevel: { $in: ['medium', 'high'] } } });
    }

    aggregationPipeline.push(
      {
        $lookup: {
          from: 'members',
          localField: 'memberId',
          foreignField: '_id',
          as: 'memberDetails',
        },
      },
      { $unwind: '$memberDetails' },
      {
        $lookup: {
          from: 'users',
          localField: 'memberDetails.userId',
          foreignField: '_id',
          as: 'userDetails',
        },
      },
      { $unwind: '$userDetails' },
      {
        $project: {
          _id: 1,
          memberId: 1,
          gymId: 1,
          branchId: 1,
          riskLevel: 1,
          riskFactors: 1,
          daysSinceLastVisit: 1,
          streakBrokenDaysAgo: 1,
          assessedAt: 1,
          memberName: '$userDetails.fullName',
          memberEmail: '$userDetails.email',
          memberPhone: '$userDetails.phone',
          planName: '$memberDetails.planName',
          membershipStatus: '$memberDetails.status',
        },
      },
      { $sort: { daysSinceLastVisit: -1 } }
    );

    return ChurnRiskAssessment.aggregate(aggregationPipeline);
  }
}
