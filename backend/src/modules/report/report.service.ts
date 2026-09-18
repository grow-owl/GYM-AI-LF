import mongoose from 'mongoose';
import { ReportRequest } from './reportRequest.model';
import { Attendance } from '../attendance/attendance.model';
import { WorkoutLog } from '../workout/workoutLog.model';
import { Exercise } from '../workout/exercise.model';
import { WeightEntry } from '../progress/weightEntry.model';
import { AIReport } from '../aiCoach/aiReport.model';
import { TrainerFeedback } from '../feedback/trainerFeedback.model';
import { Member } from '../member/member.model';
import { Trainer } from '../trainer/trainer.model';
import { MemberPaymentService } from '../payment/memberPayment.service';
import { PdfRendererService } from './pdfRenderer';
import { IReportRequest, ReportType, ReportFormat } from './report.types';
import { Role } from '../../common/constants/roles.enum';
import { AppError } from '../../common/utils/AppError';
import { logger } from '../../config/logger';

export class ReportService {
  /**
   * 1. Attendance Report Generator
   */
  public static async generateAttendanceReport(
    gymId: string,
    scope: { branchId?: string; memberId?: string } = {},
    periodStart: Date,
    periodEnd: Date
  ) {
    const matchFilter: any = {
      gymId: new mongoose.Types.ObjectId(gymId),
      checkInAt: { $gte: periodStart, $lte: periodEnd },
    };

    if (scope.branchId) {
      matchFilter.branchId = new mongoose.Types.ObjectId(scope.branchId);
    }
    if (scope.memberId) {
      matchFilter.memberId = new mongoose.Types.ObjectId(scope.memberId);
    }

    const [summary, perMember] = await Promise.all([
      Attendance.aggregate([
        { $match: matchFilter },
        {
          $group: {
            _id: null,
            totalVisits: { $sum: 1 },
            totalMinutes: { $sum: '$durationMinutes' },
            avgDurationMinutes: { $avg: '$durationMinutes' },
          },
        },
      ]),
      Attendance.aggregate([
        { $match: matchFilter },
        {
          $group: {
            _id: '$memberId',
            visitCount: { $sum: 1 },
            totalMinutes: { $sum: '$durationMinutes' },
          },
        },
        {
          $lookup: {
            from: 'members',
            localField: '_id',
            foreignField: '_id',
            as: 'member',
          },
        },
        { $unwind: { path: '$member', preserveNullAndEmptyArrays: true } },
        {
          $lookup: {
            from: 'users',
            localField: 'member.userId',
            foreignField: '_id',
            as: 'user',
          },
        },
        { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
        {
          $project: {
            memberId: '$_id',
            memberName: '$user.fullName',
            membershipStatus: '$member.membershipStatus',
            freezeHistory: '$member.freezeHistory',
            visitCount: 1,
            totalMinutes: 1,
            _id: 0,
          },
        },
      ]),
    ]);

    return {
      period: { start: periodStart, end: periodEnd },
      totalVisits: summary[0]?.totalVisits || 0,
      totalMinutes: summary[0]?.totalMinutes || 0,
      avgDurationMinutes: Math.round((summary[0]?.avgDurationMinutes || 0) * 10) / 10,
      perMember,
    };
  }

  /**
   * 2. Workout Completion Report Generator
   */
  public static async generateWorkoutCompletionReport(
    gymId: string,
    scope: { branchId?: string; memberId?: string } = {},
    periodStart: Date,
    periodEnd: Date
  ) {
    const matchFilter: any = {
      gymId: new mongoose.Types.ObjectId(gymId),
      completedAt: { $gte: periodStart, $lte: periodEnd },
    };

    if (scope.branchId && !scope.memberId) {
      const branchMembers = await Member.find({
        gymId: new mongoose.Types.ObjectId(gymId),
        branchId: new mongoose.Types.ObjectId(scope.branchId),
        isDeleted: false,
      }).select('_id');
      const memberIds = branchMembers.map((m) => m._id);
      matchFilter.memberId = { $in: memberIds };
    } else if (scope.memberId) {
      matchFilter.memberId = new mongoose.Types.ObjectId(scope.memberId);
    }

    const breakdown = await WorkoutLog.aggregate([
      { $match: matchFilter },
      { $unwind: '$exercises' },
      {
        $group: {
          _id: '$memberId',
          completedWorkouts: { $addToSet: '$_id' },
          totalExercisesCompleted: {
            $sum: { $cond: [{ $ifNull: ['$exercises.completedAt', false] }, 1, 0] },
          },
          totalDurationMinutes: { $sum: '$totalDurationMinutes' },
        },
      },
      {
        $project: {
          memberId: '$_id',
          totalCompletedWorkouts: { $size: '$completedWorkouts' },
          totalExercisesCompleted: 1,
          totalDurationMinutes: 1,
          _id: 0,
        },
      },
    ]);

    const totalWorkouts = breakdown.reduce((acc, curr) => acc + curr.totalCompletedWorkouts, 0);

    return {
      period: { start: periodStart, end: periodEnd },
      totalCompletedWorkouts: totalWorkouts,
      memberBreakdown: breakdown,
    };
  }

  /**
   * 3. Weight Change Report Generator
   */
  public static async generateWeightChangeReport(
    gymId: string,
    scope: { branchId?: string; memberId?: string } = {},
    periodStart: Date,
    periodEnd: Date
  ) {
    const matchFilter: any = {
      gymId: new mongoose.Types.ObjectId(gymId),
      recordedAt: { $gte: periodStart, $lte: periodEnd },
    };

    if (scope.branchId && !scope.memberId) {
      const branchMembers = await Member.find({
        gymId: new mongoose.Types.ObjectId(gymId),
        branchId: new mongoose.Types.ObjectId(scope.branchId),
        isDeleted: false,
      }).select('_id');
      const memberIds = branchMembers.map((m) => m._id);
      matchFilter.memberId = { $in: memberIds };
    } else if (scope.memberId) {
      matchFilter.memberId = new mongoose.Types.ObjectId(scope.memberId);
    }

    const entries = await WeightEntry.find(matchFilter).sort({ memberId: 1, recordedAt: 1 });

    const memberMap = new Map<string, { startWeight: number; endWeight: number; entriesCount: number }>();

    for (const entry of entries) {
      const memId = entry.memberId.toString();
      if (!memberMap.has(memId)) {
        memberMap.set(memId, { startWeight: entry.weightKg, endWeight: entry.weightKg, entriesCount: 1 });
      } else {
        const item = memberMap.get(memId)!;
        item.endWeight = entry.weightKg;
        item.entriesCount += 1;
      }
    }

    const breakdown: any[] = [];
    for (const [memberId, data] of memberMap.entries()) {
      const weightDelta = Math.round((data.endWeight - data.startWeight) * 100) / 100;
      const percentageChange =
        data.startWeight > 0
          ? Math.round(((data.endWeight - data.startWeight) / data.startWeight) * 100 * 100) / 100
          : 0;

      breakdown.push({
        memberId,
        startWeightKg: data.startWeight,
        endWeightKg: data.endWeight,
        weightDeltaKg: weightDelta,
        percentageChange,
        entriesCount: data.entriesCount,
      });
    }

    return {
      period: { start: periodStart, end: periodEnd },
      totalMembersTracked: breakdown.length,
      weightChangeBreakdown: breakdown,
    };
  }

  /**
   * 4. Strength Growth Report Generator
   */
  public static async generateStrengthGrowthReport(
    gymId: string,
    scope: { branchId?: string; memberId?: string } = {},
    periodStart: Date,
    periodEnd: Date
  ) {
    const matchFilter: any = {
      gymId: new mongoose.Types.ObjectId(gymId),
      completedAt: { $gte: periodStart, $lte: periodEnd },
    };

    if (scope.branchId && !scope.memberId) {
      const branchMembers = await Member.find({
        gymId: new mongoose.Types.ObjectId(gymId),
        branchId: new mongoose.Types.ObjectId(scope.branchId),
        isDeleted: false,
      }).select('_id');
      const memberIds = branchMembers.map((m) => m._id);
      matchFilter.memberId = { $in: memberIds };
    } else if (scope.memberId) {
      matchFilter.memberId = new mongoose.Types.ObjectId(scope.memberId);
    }

    const logs = await WorkoutLog.find(matchFilter).sort({ completedAt: 1 });

    const exerciseIds = new Set<string>();
    for (const log of logs) {
      for (const ex of log.exercises) {
        if (ex.exerciseId) exerciseIds.add(ex.exerciseId.toString());
      }
    }

    const exercises = await Exercise.find({ _id: { $in: Array.from(exerciseIds) } });
    const exerciseNameMap = new Map<string, string>();
    for (const ex of exercises) {
      exerciseNameMap.set(ex._id.toString(), ex.name);
    }

    const exerciseProgression = new Map<
      string,
      { exerciseName: string; initialWeight: number; maxWeight: number; lastWeight: number }
    >();

    for (const log of logs) {
      for (const ex of log.exercises) {
        if (!ex.sets || ex.sets.length === 0) continue;

        const completedSets = ex.sets.filter((s) => s.completed);
        if (completedSets.length === 0) continue;

        const maxWeightInLog = Math.max(...completedSets.map((s) => s.weightKg || 0));
        if (maxWeightInLog <= 0) continue;

        const exName = (ex as any).name || exerciseNameMap.get(ex.exerciseId?.toString() || '') || 'Exercise';
        const key = `${log.memberId.toString()}_${exName}`;

        if (!exerciseProgression.has(key)) {
          exerciseProgression.set(key, {
            exerciseName: exName,
            initialWeight: maxWeightInLog,
            maxWeight: maxWeightInLog,
            lastWeight: maxWeightInLog,
          });
        } else {
          const item = exerciseProgression.get(key)!;
          item.lastWeight = maxWeightInLog;
          if (maxWeightInLog > item.maxWeight) item.maxWeight = maxWeightInLog;
        }
      }
    }

    const progressionList: any[] = [];
    for (const [key, item] of exerciseProgression.entries()) {
      const [memberId] = key.split('_');
      const growthKg = item.lastWeight - item.initialWeight;
      const growthPercent =
        item.initialWeight > 0 ? Math.round((growthKg / item.initialWeight) * 100 * 100) / 100 : 0;

      progressionList.push({
        memberId,
        exerciseName: item.exerciseName,
        initialWeightKg: item.initialWeight,
        maxWeightKg: item.maxWeight,
        latestWeightKg: item.lastWeight,
        growthKg: Math.round(growthKg * 100) / 100,
        growthPercent,
      });
    }

    return {
      period: { start: periodStart, end: periodEnd },
      strengthProgression: progressionList,
    };
  }

  /**
   * 5. AI Summary Report Generator
   */
  public static async generateAISummaryReport(
    gymId: string,
    scope: { branchId?: string; memberId?: string } = {},
    periodStart: Date,
    periodEnd: Date
  ) {
    const matchFilter: any = {
      gymId: new mongoose.Types.ObjectId(gymId),
      periodStart: { $gte: periodStart },
      periodEnd: { $lte: periodEnd },
    };

    if (scope.branchId && !scope.memberId) {
      const branchMembers = await Member.find({
        gymId: new mongoose.Types.ObjectId(gymId),
        branchId: new mongoose.Types.ObjectId(scope.branchId),
        isDeleted: false,
      }).select('_id');
      const memberIds = branchMembers.map((m) => m._id);
      matchFilter.memberId = { $in: memberIds };
    } else if (scope.memberId) {
      matchFilter.memberId = new mongoose.Types.ObjectId(scope.memberId);
    }

    const reports = await AIReport.find(matchFilter).sort({ periodStart: -1 });

    return {
      period: { start: periodStart, end: periodEnd },
      totalAIReports: reports.length,
      reportsSummary: reports.map((r) => ({
        reportId: r._id,
        memberId: r.memberId,
        type: r.type,
        summary: r.summary,
        metrics: r.metrics,
        plateauDetected: r.plateauDetected,
        injuryRiskFlag: r.injuryRiskFlag,
        generatedAt: r.createdAt,
      })),
    };
  }

  /**
   * 6. Trainer Feedback Report Generator
   */
  public static async generateTrainerFeedbackReport(
    gymId: string,
    scope: { branchId?: string; memberId?: string } = {},
    periodStart: Date,
    periodEnd: Date
  ) {
    const matchFilter: any = {
      gymId: new mongoose.Types.ObjectId(gymId),
      createdAt: { $gte: periodStart, $lte: periodEnd },
    };

    if (scope.branchId && !scope.memberId) {
      const branchMembers = await Member.find({
        gymId: new mongoose.Types.ObjectId(gymId),
        branchId: new mongoose.Types.ObjectId(scope.branchId),
        isDeleted: false,
      }).select('_id');
      const memberIds = branchMembers.map((m) => m._id);
      matchFilter.memberId = { $in: memberIds };
    } else if (scope.memberId) {
      matchFilter.memberId = new mongoose.Types.ObjectId(scope.memberId);
    }

    const feedbacks = await TrainerFeedback.find(matchFilter)
      .populate({ path: 'trainerId', populate: { path: 'userId', select: 'fullName' } })
      .populate({ path: 'memberId', populate: { path: 'userId', select: 'fullName' } })
      .sort({ createdAt: -1 });

    return {
      period: { start: periodStart, end: periodEnd },
      totalFeedbackEntries: feedbacks.length,
      feedbacks,
    };
  }

  /**
   * 7. Revenue Report Generator
   */
  public static async generateRevenueReport(
    gymId: string,
    scope: { branchId?: string; memberId?: string } = {},
    periodStart: Date,
    periodEnd: Date
  ) {
    const summary = await MemberPaymentService.getRevenueSummary(
      gymId,
      scope.branchId,
      { startDate: periodStart, endDate: periodEnd },
      periodStart,
      periodEnd
    );

    return {
      period: { start: periodStart, end: periodEnd },
      revenueData: summary,
    };
  }

  /**
   * 8. Member Full Progress Report Generator
   */
  public static async generateMemberFullProgressReport(
    gymId: string,
    scope: { branchId?: string; memberId?: string } = {},
    periodStart: Date,
    periodEnd: Date
  ) {
    const [attendance, workout, weightChange, strengthGrowth] = await Promise.all([
      this.generateAttendanceReport(gymId, scope, periodStart, periodEnd),
      this.generateWorkoutCompletionReport(gymId, scope, periodStart, periodEnd),
      this.generateWeightChangeReport(gymId, scope, periodStart, periodEnd),
      this.generateStrengthGrowthReport(gymId, scope, periodStart, periodEnd),
    ]);

    return {
      period: { start: periodStart, end: periodEnd },
      attendance,
      workout,
      weightChange,
      strengthGrowth,
    };
  }

  /**
   * Request Report & Process Execution
   */
  public static async requestReport(
    input: {
      gymId: string;
      reportType: ReportType;
      scope?: { branchId?: string; memberId?: string };
      periodStart: Date;
      periodEnd: Date;
      format?: ReportFormat;
    },
    actingUser: { id: string; role: Role; branchId?: string }
  ): Promise<IReportRequest> {
    const { gymId, reportType, scope = {}, periodStart, periodEnd, format = 'json' } = input;

    // RBAC Scope Enforcement
    if (actingUser.role === Role.BRANCH_MANAGER) {
      if (scope.branchId && scope.branchId !== actingUser.branchId) {
        throw AppError.forbidden('Branch Managers cannot access reports for other branches');
      }
      scope.branchId = actingUser.branchId;
    }

    if (actingUser.role === Role.TRAINER) {
      if (!scope.memberId) {
        throw AppError.forbidden('Trainers can only request member-scoped reports');
      }
      const trainer = await Trainer.findOne({ userId: new mongoose.Types.ObjectId(actingUser.id), isDeleted: false });
      const member = await Member.findOne({
        _id: new mongoose.Types.ObjectId(scope.memberId),
        ...(trainer ? { assignedTrainerId: trainer._id } : {}),
        isDeleted: false,
      });
      if (!member) {
        throw AppError.forbidden('Trainer is not authorized to generate report for this member');
      }
    }

    if (actingUser.role === Role.MEMBER) {
      throw AppError.forbidden('Members cannot request gym organization reports');
    }

    const reportRequest = new ReportRequest({
      gymId: new mongoose.Types.ObjectId(gymId),
      requestedByUserId: new mongoose.Types.ObjectId(actingUser.id),
      reportType,
      scope: {
        branchId: scope.branchId ? new mongoose.Types.ObjectId(scope.branchId) : undefined,
        memberId: scope.memberId ? new mongoose.Types.ObjectId(scope.memberId) : undefined,
      },
      periodStart,
      periodEnd,
      format,
      status: 'PROCESSING',
    });

    await reportRequest.save();

    try {
      let data: any;

      const typeKey = String(reportType || '').toLowerCase();

      if (typeKey.includes('attendance')) {
        data = await this.generateAttendanceReport(gymId, scope, periodStart, periodEnd);
      } else if (typeKey.includes('revenue') || typeKey.includes('collection')) {
        data = await this.generateRevenueReport(gymId, scope, periodStart, periodEnd);
      } else if (typeKey.includes('churn') || typeKey.includes('risk') || typeKey.includes('ai')) {
        data = await this.generateAISummaryReport(gymId, scope, periodStart, periodEnd);
      } else if (typeKey.includes('trainer') || typeKey.includes('performance')) {
        data = await this.generateTrainerFeedbackReport(gymId, scope, periodStart, periodEnd);
      } else if (typeKey.includes('workout')) {
        data = await this.generateWorkoutCompletionReport(gymId, scope, periodStart, periodEnd);
      } else if (typeKey.includes('weight')) {
        data = await this.generateWeightChangeReport(gymId, scope, periodStart, periodEnd);
      } else if (typeKey.includes('strength')) {
        data = await this.generateStrengthGrowthReport(gymId, scope, periodStart, periodEnd);
      } else if (typeKey.includes('progress')) {
        data = await this.generateMemberFullProgressReport(gymId, scope, periodStart, periodEnd);
      } else {
        data = await this.generateAttendanceReport(gymId, scope, periodStart, periodEnd);
      }

      if (format === 'pdf') {
        const pdfBuffer = await PdfRendererService.renderReportToBuffer(
          `${reportType.toUpperCase()} REPORT`,
          { start: periodStart, end: periodEnd },
          data
        );

        const fileUrl = await PdfRendererService.uploadPdfToCloudinary(
          pdfBuffer,
          reportRequest._id.toString()
        );

        reportRequest.fileUrl = fileUrl;
        reportRequest.reportData = data;
        reportRequest.status = 'READY';
      } else {
        reportRequest.reportData = data;
        reportRequest.status = 'READY';
      }

      await reportRequest.save();
      logger.info(`📈 Report generated successfully: [ID: ${reportRequest._id}] [Type: ${reportType}] [Format: ${format}]`);
      return reportRequest;
    } catch (error: any) {
      reportRequest.status = 'FAILED';
      await reportRequest.save();
      logger.error(`❌ Report generation failed: [ID: ${reportRequest._id}] - ${error.message}`);
      throw error;
    }
  }

  /**
   * Get Report Request by ID
   */
  public static async getReportRequestById(reportRequestId: string, gymId?: string): Promise<IReportRequest> {
    const filter: Record<string, unknown> = { _id: reportRequestId };
    if (gymId) filter.gymId = new mongoose.Types.ObjectId(gymId);

    const request = await ReportRequest.findOne(filter);
    if (!request) throw AppError.notFound('Report request not found');
    return request;
  }

  /**
   * List Report Requests history
   */
  public static async listReportRequests(gymId: string): Promise<IReportRequest[]> {
    return ReportRequest.find({ gymId: new mongoose.Types.ObjectId(gymId) }).sort({ createdAt: -1 }).limit(100);
  }
}
