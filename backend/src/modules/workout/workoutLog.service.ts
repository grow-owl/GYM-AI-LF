import mongoose from 'mongoose';
import { WorkoutLog } from './workoutLog.model';
import { WorkoutPlan } from './workoutPlan.model';
import { Member } from '../member/member.model';
import { Branch } from '../gym/branch.model';
import { GamificationService } from '../gamification/gamification.service';
import { IWorkoutLog, WorkoutCompletionStats, TodayWorkoutResponse, ChartDataPoint } from './workoutLog.types';
import { AppError } from '../../common/utils/AppError';
import { validateMemberAccess, ActingUser } from '../../common/utils/authorization';
import { getDayKeyForBranch } from '../../common/utils/timezone';
import { getPaginationParams, buildPaginationMeta, ParsedPagination } from '../../common/utils/pagination';
import { logger } from '../../config/logger';
import { Attendance } from '../attendance/attendance.model';
import { AttendanceStatus } from '../attendance/attendance.types';

/**
 * Spec Section 4 — Server-side daily completion percentage calculation.
 * Keeps the graph data normalized to 0–100 regardless of exercises per day.
 * @param totalAssigned - exercises in the Blueprint for that day
 * @param totalCompleted - exercises the member actually checked off
 */
export const calculateDailyPercentage = (
  totalAssigned: number,
  totalCompleted: number
): number => {
  if (totalAssigned === 0) return 0; // prevent division by zero
  const rawPercentage = (totalCompleted / totalAssigned) * 100;
  return Math.round(rawPercentage);
};

export interface StartWorkoutLogInput {
  workoutPlanId?: string;
  dayLabel?: string;
  attendanceId?: string;
  loggedAt?: string;
  exercises?: Array<{
    exerciseId?: string;
    exerciseName?: string;
    name?: string;
    sets?: number;
    reps?: number;
    weightKg?: number;
  }>;
}

export interface LogSetInput {
  exerciseId: string;
  setNumber: number;
  reps: number;
  weightKg?: number;
  completed?: boolean;
}

export class WorkoutLogService {
  /**
   * Start a Workout Logging Session (Pre-populates exercise structure from Plan or batch input)
   */
  public static async startWorkoutLog(
    memberId: string,
    input: StartWorkoutLogInput
  ): Promise<IWorkoutLog> {
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

    const branch = await Branch.findOne({ _id: member.branchId, isDeleted: false });
    const timezone = branch?.timezone || 'UTC';
    const dayKey = getDayKeyForBranch(new Date(), timezone);

    const loggedExercises: { exerciseId: mongoose.Types.ObjectId; sets: Record<string, unknown>[]; completedAt?: Date }[] = [];

    if (input.exercises && Array.isArray(input.exercises) && input.exercises.length > 0) {
      input.exercises.forEach((batchEx) => {
        const exId = (batchEx.exerciseId && mongoose.Types.ObjectId.isValid(batchEx.exerciseId))
          ? new mongoose.Types.ObjectId(batchEx.exerciseId)
          : new mongoose.Types.ObjectId();
        const setNum = Number(batchEx.sets) || 1;
        const reps = Number(batchEx.reps) || 10;
        const weightKg = Number(batchEx.weightKg) || 0;

        const setsArr = [];
        for (let i = 1; i <= setNum; i++) {
          setsArr.push({
            setNumber: i,
            reps,
            weightKg,
            completed: true,
          });
        }

        loggedExercises.push({
          exerciseId: exId,
          sets: setsArr,
          completedAt: new Date(),
        });
      });
    } else if (input.workoutPlanId) {
      // Pre-populate exercise structure if workoutPlanId and dayLabel are provided
      const plan = await WorkoutPlan.findOne({ _id: input.workoutPlanId, isDeleted: false });
      if (plan) {
        const targetDay = plan.days.find(
          (d) => (d.dayLabel ?? d.dayName ?? '').toLowerCase() === (input.dayLabel || '').toLowerCase()
        ) || plan.days[0];

        if (targetDay) {
          targetDay.exercises.forEach((ex) => {
            const initialSets = [];
            for (let i = 1; i <= ex.targetSets; i++) {
              initialSets.push({
                setNumber: i,
                reps: ex.targetReps,
                weightKg: ex.targetWeightKg,
                completed: false,
              });
            }
            loggedExercises.push({
              exerciseId: ex.exerciseId,
              sets: initialSets,
            });
          });
        }
      }
    }

    // Auto-link active workout plan if not explicitly supplied
    let assignedPlanId = input.workoutPlanId ? new mongoose.Types.ObjectId(input.workoutPlanId) : undefined;
    let assignedDayIndex: number | undefined;

    if (!assignedPlanId) {
      const activePlan = await WorkoutPlan.findOne({
        memberId: member._id,
        isActive: true,
        isDeleted: false,
      });
      if (activePlan) {
        assignedPlanId = activePlan._id as mongoose.Types.ObjectId;
        assignedDayIndex = 0;
      }
    }

    const isBatchCompleted = Boolean(input.exercises && input.exercises.length > 0);
    const log = new WorkoutLog({
      gymId: member.gymId,
      memberId: member._id,
      workoutPlanId: assignedPlanId,
      dayIndex: assignedDayIndex,
      attendanceId: input.attendanceId ? new mongoose.Types.ObjectId(input.attendanceId) : undefined,
      dayLabel: input.dayLabel || (isBatchCompleted ? 'Custom Session' : undefined),
      exercises: loggedExercises,
      startedAt: input.loggedAt ? new Date(input.loggedAt) : new Date(),
      completedAt: isBatchCompleted ? (input.loggedAt ? new Date(input.loggedAt) : new Date()) : undefined,
      dayKey,
    });

    await log.save();

    if (isBatchCompleted) {
      try {
        await GamificationService.recordWorkoutCompletion(member._id.toString(), log._id.toString());
      } catch (err: any) {
        logger.warn(`Failed to update gamification for batch workout log: ${err.message}`);
      }
    }

    logger.info(`💪 Workout Log started: [LogID: ${log._id}] [Member: ${member._id}] [DayKey: ${dayKey}]`);
    return log;
  }


  /**
   * Log/Update set progress tap-by-tap (Atomic & Concurrency Safe)
   */
  public static async logSetProgress(
    workoutLogId: string,
    setData: LogSetInput,
    gymId?: string,
    actingUser?: ActingUser
  ): Promise<IWorkoutLog> {
    const filter: any = { _id: workoutLogId };
    if (gymId) filter.gymId = new mongoose.Types.ObjectId(gymId);
    const log = await WorkoutLog.findOne(filter);
    if (!log) {
      throw AppError.notFound('Workout log not found');
    }

    if (actingUser) {
      await validateMemberAccess(actingUser, log.memberId.toString());
    }

    const exerciseObjectId = new mongoose.Types.ObjectId(setData.exerciseId);
    const targetExercise = log.exercises.find((ex) => ex.exerciseId.equals(exerciseObjectId));

    if (!targetExercise) {
      // Add exercise if doing freestyle/extra exercise
      log.exercises.push({
        exerciseId: exerciseObjectId,
        sets: [
          {
            setNumber: setData.setNumber,
            reps: setData.reps,
            weightKg: setData.weightKg,
            completed: setData.completed ?? true,
          },
        ],
      });
    } else {
      // Upsert set by setNumber
      const targetSet = targetExercise.sets.find((s) => s.setNumber === setData.setNumber);
      if (targetSet) {
        targetSet.reps = setData.reps;
        if (setData.weightKg !== undefined) targetSet.weightKg = setData.weightKg;
        targetSet.completed = setData.completed ?? true;
      } else {
        targetExercise.sets.push({
          setNumber: setData.setNumber,
          reps: setData.reps,
          weightKg: setData.weightKg,
          completed: setData.completed ?? true,
        });
      }
    }

    await log.save();
    return log;
  }

  /**
   * Mark individual exercise complete
   */
  public static async markExerciseComplete(
    workoutLogId: string,
    exerciseId: string,
    gymId?: string,
    actingUser?: ActingUser
  ): Promise<IWorkoutLog> {
    const filter: any = { _id: workoutLogId };
    if (gymId) filter.gymId = new mongoose.Types.ObjectId(gymId);
    const log = await WorkoutLog.findOne(filter);
    if (!log) {
      throw AppError.notFound('Workout log not found');
    }

    if (actingUser) {
      await validateMemberAccess(actingUser, log.memberId.toString());
    }

    const exerciseObjectId = new mongoose.Types.ObjectId(exerciseId);
    const targetExercise = log.exercises.find((ex) => ex.exerciseId.equals(exerciseObjectId));

    if (!targetExercise) {
      throw AppError.notFound('Exercise not found in this workout log');
    }

    targetExercise.completedAt = new Date();
    await log.save();
    return log;
  }

  /**
   * Complete entire Workout Log
   */
  public static async completeWorkoutLog(
    workoutLogId: string,
    gymId?: string,
    actingUser?: ActingUser
  ): Promise<IWorkoutLog> {
    const filter: any = { _id: workoutLogId };
    if (gymId) filter.gymId = new mongoose.Types.ObjectId(gymId);
    const log = await WorkoutLog.findOne(filter);
    if (!log) {
      throw AppError.notFound('Workout log not found');
    }

    if (actingUser) {
      await validateMemberAccess(actingUser, log.memberId.toString());
    }

    const now = new Date();
    const durationMs = now.getTime() - log.startedAt.getTime();
    log.completedAt = now;
    log.totalDurationMinutes = Math.max(1, Math.round(durationMs / (60 * 1000)));

    await log.save();

    // Hook: Gamification workout completion trigger
    await GamificationService.recordWorkoutCompletion(log.memberId.toString(), log._id.toString());

    logger.info(`🏁 Workout Log completed: [LogID: ${log._id}] [Duration: ${log.totalDurationMinutes}m]`);
    return log;
  }

  /**
   * Get member workout log history with pagination
   */
  public static async getWorkoutHistory(
    memberId: string,
    options: { page?: number | string; limit?: number | string } = {}
  ): Promise<{ logs: IWorkoutLog[]; meta: ReturnType<typeof buildPaginationMeta> }> {
    const { page, limit, skip }: ParsedPagination = getPaginationParams(options);

    const member = await Member.findOne({
      $or: [
        { _id: mongoose.Types.ObjectId.isValid(memberId) ? memberId : undefined },
        { userId: mongoose.Types.ObjectId.isValid(memberId) ? memberId : undefined },
      ],
    });

    if (!member) {
      throw AppError.notFound('Member profile not found');
    }

    const filter = { memberId: member._id };

    const [logs, totalItems] = await Promise.all([
      WorkoutLog.find(filter)
        .populate('exercises.exerciseId', 'name muscleGroup equipment')
        .skip(skip)
        .limit(limit)
        .sort({ startedAt: -1 }),
      WorkoutLog.countDocuments(filter),
    ]);

    const meta = buildPaginationMeta(totalItems, page, limit);

    return { logs, meta };
  }

  /**
   * Aggregate Workout Completion Statistics (Feeds AI Coach Module 09)
   */
  public static async getWorkoutCompletionStats(memberId: string): Promise<WorkoutCompletionStats> {
    const member = await Member.findOne({
      $or: [
        { _id: mongoose.Types.ObjectId.isValid(memberId) ? memberId : undefined },
        { userId: mongoose.Types.ObjectId.isValid(memberId) ? memberId : undefined },
      ],
    });

    if (!member) {
      throw AppError.notFound('Member profile not found');
    }

    const branch = member.branchId ? await Branch.findOne({ _id: member.branchId, isDeleted: false }) : null;
    const timezone = branch?.timezone || 'UTC';

    const logs = await WorkoutLog.find({ memberId: member._id }).populate('exercises.exerciseId', 'name');

    const totalWorkoutSessions = logs.length;
    const completedWorkoutSessions = logs.filter(
      (l) => Boolean(l.completedAt) || l.exercises.some((ex) => ex.completedAt || ex.sets?.some((s) => s.completed))
    ).length;
    let totalPlannedExercises = 0;
    let totalCompletedExercises = 0;
    const skipCountMap: Record<string, { name: string; count: number }> = {};
    const exerciseStatsMap: Record<string, { exerciseId: string; name: string; maxWeightKg: number; volume: number; frequency: number }> = {};

    // Branch timezone current week boundary computation
    const todayKey = getDayKeyForBranch(new Date(), timezone);
    const [tYear, tMonth, tDay] = todayKey.split('-').map(Number);
    const todayDate = new Date(Date.UTC(tYear, tMonth - 1, tDay));
    const dayOfWeekIdx = (todayDate.getUTCDay() + 6) % 7; // 0=Mon, ..., 6=Sun

    const mondayDate = new Date(todayDate);
    mondayDate.setUTCDate(todayDate.getUTCDate() - dayOfWeekIdx);
    const mondayKey = getDayKeyForBranch(mondayDate, 'UTC');

    const sundayDate = new Date(mondayDate);
    sundayDate.setUTCDate(mondayDate.getUTCDate() + 6);
    const sundayKey = getDayKeyForBranch(sundayDate, 'UTC');

    const daysOfWeek = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const weeklyVolumeMap: Record<string, { volume: number; label: string }> = {
      Mon: { volume: 0, label: 'Rest' },
      Tue: { volume: 0, label: 'Rest' },
      Wed: { volume: 0, label: 'Rest' },
      Thu: { volume: 0, label: 'Rest' },
      Fri: { volume: 0, label: 'Rest' },
      Sat: { volume: 0, label: 'Rest' },
      Sun: { volume: 0, label: 'Rest' },
    };

    for (const log of logs) {
      const logDayKey = getDayKeyForBranch(log.startedAt || log.createdAt, timezone);
      const isCurrentWeek = logDayKey >= mondayKey && logDayKey <= sundayKey;
      let sessionVolume = 0;

      for (const ex of log.exercises) {
        totalPlannedExercises++;
        const exIdStr = (ex.exerciseId as any)?._id?.toString() || ex.exerciseId?.toString() || 'unknown';
        const name = (ex.exerciseId as any)?.name || 'Exercise';

        let exMaxWeight = 0;
        let exVolume = 0;
        let isExCompleted = false;

        if (ex.sets && Array.isArray(ex.sets)) {
          for (const s of ex.sets) {
            if (s.completed) {
              isExCompleted = true;
              const w = Number(s.weightKg) || 0;
              const r = Number(s.reps) || 0;
              if (w > exMaxWeight) exMaxWeight = w;
              exVolume += w * r;
            }
          }
        }

        if (ex.completedAt || isExCompleted) {
          totalCompletedExercises++;
          sessionVolume += exVolume;

          if (!exerciseStatsMap[exIdStr]) {
            exerciseStatsMap[exIdStr] = {
              exerciseId: exIdStr,
              name,
              maxWeightKg: exMaxWeight,
              volume: exVolume,
              frequency: 1,
            };
          } else {
            exerciseStatsMap[exIdStr].frequency += 1;
            if (exMaxWeight > exerciseStatsMap[exIdStr].maxWeightKg) {
              exerciseStatsMap[exIdStr].maxWeightKg = exMaxWeight;
            }
            exerciseStatsMap[exIdStr].volume += exVolume;
          }
        } else {
          if (!skipCountMap[exIdStr]) {
            skipCountMap[exIdStr] = { name, count: 0 };
          }
          skipCountMap[exIdStr].count++;
        }
      }

      if (isCurrentWeek && sessionVolume > 0) {
        const [lYear, lMonth, lDay] = logDayKey.split('-').map(Number);
        const logDateObj = new Date(Date.UTC(lYear, lMonth - 1, lDay));
        const logDayIdx = (logDateObj.getUTCDay() + 6) % 7;
        const dayName = daysOfWeek[logDayIdx];
        if (dayName) {
          weeklyVolumeMap[dayName].volume += sessionVolume;
          weeklyVolumeMap[dayName].label = log.dayLabel || 'Logged Workout';
        }
      }
    }

    const completionRatePercent =
      totalPlannedExercises > 0 ? Math.round((totalCompletedExercises / totalPlannedExercises) * 100) : 0;

    const mostSkippedExercises = Object.entries(skipCountMap)
      .map(([exerciseId, data]) => ({ exerciseId, name: data.name, skipCount: data.count }))
      .sort((a, b) => b.skipCount - a.skipCount)
      .slice(0, 5);

    const exerciseStats = Object.values(exerciseStatsMap)
      .sort((a, b) => b.frequency - a.frequency || b.maxWeightKg - a.maxWeightKg || b.volume - a.volume)
      .map(({ exerciseId, name, maxWeightKg, volume }) => ({ exerciseId, name, maxWeightKg, volume }));

    const weeklyVolumeLogs = daysOfWeek.map((day) => ({
      day,
      volume: weeklyVolumeMap[day].volume,
      label: weeklyVolumeMap[day].label,
    }));

    return {
      totalWorkoutSessions,
      completedWorkoutSessions,
      totalPlannedExercises,
      totalCompletedExercises,
      completionRatePercent,
      mostSkippedExercises,
      exerciseStats,
      weeklyVolumeLogs,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SPEC STEP B — GET /api/v1/workout-logs/today
  // Merges the active WorkoutPlan (Blueprint) with today's WorkoutLog (State)
  // ═══════════════════════════════════════════════════════════════════════════
  public static async getTodayWorkout(
    memberId: string,
    gymId?: string
  ): Promise<TodayWorkoutResponse | null> {
    // 1. Resolve member
    const memberFilter: any = {
      $or: [
        { _id: mongoose.Types.ObjectId.isValid(memberId) ? memberId : undefined },
        { userId: mongoose.Types.ObjectId.isValid(memberId) ? memberId : undefined },
      ],
      isDeleted: false,
    };
    if (gymId) memberFilter.gymId = new mongoose.Types.ObjectId(gymId);
    const member = await Member.findOne(memberFilter);
    if (!member) throw AppError.notFound('Member profile not found');

    // 2. Fetch active plan with exercises populated
    const plan = await WorkoutPlan.findOne({
      memberId: member._id,
      ...(gymId ? { gymId: new mongoose.Types.ObjectId(gymId) } : {}),
      isActive: true,
      isDeleted: false,
    }).populate('days.exercises.exerciseId');

    if (!plan || !plan.days || plan.days.length === 0) return null;

    // 3. Determine dayIndex using cycling: completedSessions % totalPlanDays
    //    This ensures Day1 → Day2 → … → DayN → Day1 cycle
    const completedSessionsCount = await WorkoutLog.countDocuments({
      memberId: member._id,
      workoutPlanId: plan._id,
      completedAt: { $exists: true, $ne: null },
    });
    const dayIndex = completedSessionsCount % plan.days.length;
    const planDay = plan.days[dayIndex];

    // 4. Get branch timezone for accurate day key
    const branch = await Branch.findOne({ _id: member.branchId, isDeleted: false });
    const timezone = branch?.timezone || 'UTC';
    const dayKey = getDayKeyForBranch(new Date(), timezone);

    // 5. Fetch today's log (may not exist yet — that's fine)
    const todayLog = await WorkoutLog.findOne({
      memberId: member._id,
      workoutPlanId: plan._id,
      dayKey,
    });

    // 6. Build completedExerciseIds from log exercises that have completedAt set
    const completedExerciseIds: string[] = todayLog
      ? todayLog.exercises
          .filter((ex) => ex.completedAt != null)
          .map((ex) => ex.exerciseId.toString())
      : [];

    // 7. Merge Blueprint tasks with Log state
    const exercises = (planDay.exercises || []).map((task: any, idx: number) => {
      const exDoc = task.exerciseId; // populated
      const exIdStr = (exDoc?._id || task.exerciseId)?.toString() || '';
      return {
        exerciseId: exIdStr,
        name: exDoc?.name || 'Exercise',
        muscleGroup: exDoc?.muscleGroup || '',
        equipment: exDoc?.equipment || '',
        targetSets: task.targetSets || 1,
        targetReps: task.targetReps || 1,
        restSeconds: task.restSeconds || 60,
        order: task.order ?? idx + 1,
        isCompleted: completedExerciseIds.includes(exIdStr),
      };
    });

    const dayLabel = (planDay as any).dayLabel || (planDay as any).dayName || `Day ${dayIndex + 1}`;

    return {
      logId: todayLog ? todayLog._id.toString() : null,
      planId: plan._id.toString(),
      planTitle: plan.title,
      dayIndex,
      dayLabel,
      totalExercises: exercises.length,
      completedExerciseIds,
      exercises,
      isCompleted: exercises.length > 0 && completedExerciseIds.length >= exercises.length,
    };
  }

  /**
   * Enforce that a member is actively checked in at their gym branch.
   * Throws 403 Forbidden if no active session is found.
   */
  public static async assertMemberCheckedIn(memberId: string): Promise<void> {
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

    const activeSession = await Attendance.findOne({
      memberId: member._id,
      status: AttendanceStatus.CHECKED_IN,
    });

    if (!activeSession) {
      throw AppError.forbidden(
        'Gym Check-In Required: You must be actively checked in at your gym to update, log, or complete workout exercises. Please scan the QR code at your gym kiosk.'
      );
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SPEC STEP C — PATCH /api/v1/workout-logs/today
  // Toggle a single exercise as completed/uncompleted in today's log.
  // Creates the log automatically if it doesn't exist yet (upsert pattern).
  // ═══════════════════════════════════════════════════════════════════════════
  public static async toggleExerciseCompleteToday(
    memberId: string,
    exerciseId: string,
    gymId?: string
  ): Promise<TodayWorkoutResponse> {
    // 1. Resolve member
    const memberFilter: any = {
      $or: [
        { _id: mongoose.Types.ObjectId.isValid(memberId) ? memberId : undefined },
        { userId: mongoose.Types.ObjectId.isValid(memberId) ? memberId : undefined },
      ],
      isDeleted: false,
    };
    if (gymId) memberFilter.gymId = new mongoose.Types.ObjectId(gymId);
    const member = await Member.findOne(memberFilter);
    if (!member) throw AppError.notFound('Member profile not found');

    // 2. Strict Check-In Guard: Member must be actively checked in
    await WorkoutLogService.assertMemberCheckedIn(memberId);

    // 2. Get active plan
    const plan = await WorkoutPlan.findOne({
      memberId: member._id,
      ...(gymId ? { gymId: new mongoose.Types.ObjectId(gymId) } : {}),
      isActive: true,
      isDeleted: false,
    });
    if (!plan) throw AppError.notFound('No active workout plan found for this member');

    // 3. Determine dayIndex and dayKey
    const completedSessionsCount = await WorkoutLog.countDocuments({
      memberId: member._id,
      workoutPlanId: plan._id,
      completedAt: { $exists: true, $ne: null },
    });
    const dayIndex = completedSessionsCount % plan.days.length;
    const planDay = plan.days[dayIndex];
    const dayLabel = (planDay as any).dayLabel || (planDay as any).dayName || `Day ${dayIndex + 1}`;

    const branch = await Branch.findOne({ _id: member.branchId, isDeleted: false });
    const timezone = branch?.timezone || 'UTC';
    const dayKey = getDayKeyForBranch(new Date(), timezone);

    // 4. Get-or-create today's log
    let log = await WorkoutLog.findOne({
      memberId: member._id,
      workoutPlanId: plan._id,
      dayKey,
    });

    if (!log) {
      log = new WorkoutLog({
        gymId: member.gymId,
        memberId: member._id,
        workoutPlanId: plan._id,
        dayIndex,
        dayLabel,
        dayKey,
        exercises: [],
        startedAt: new Date(),
      });
      await log.save();
      logger.info(`📋 Today's WorkoutLog auto-created: [Member: ${member._id}] [DayIndex: ${dayIndex}]`);
    }

    // 5. Toggle exercise: find it in log.exercises
    const exerciseObjectId = new mongoose.Types.ObjectId(exerciseId);
    const existingEx = log.exercises.find((ex) => ex.exerciseId.equals(exerciseObjectId));

    if (!existingEx) {
      // Not in log at all → add it and mark completed (toggle ON)
      log.exercises.push({
        exerciseId: exerciseObjectId,
        sets: [],
        completedAt: new Date(),
      });
    } else if (existingEx.completedAt) {
      // Already completed → unmark (toggle OFF)
      existingEx.completedAt = undefined;
    } else {
      // In log but not completed → mark completed (toggle ON)
      existingEx.completedAt = new Date();
    }

    await log.save();

    // 6. Return fresh merged view (reuse getTodayWorkout)
    const todayView = await this.getTodayWorkout(memberId, gymId);

    // If today's workout is now 100% completed, mark log.completedAt and award XP
    if (todayView?.isCompleted) {
      if (!log.completedAt) {
        log.completedAt = new Date();
        await log.save();
      }
      try {
        await GamificationService.recordWorkoutCompletion(member._id.toString(), log._id.toString());
      } catch (err: any) {
        logger.warn(`Failed to award gamification XP on checklist completion: ${err.message}`);
      }
    }

    return todayView!;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SPEC STEP D — GET /api/v1/workout-logs/analytics/progress?days=7
  // Returns ChartDataPoint[] with daily completion % for the last N days.
  // Missing days are filled with completionPercentage: 0 (rest/missed days).
  // ═══════════════════════════════════════════════════════════════════════════
  public static async getProgressAnalytics(
    memberId: string,
    days: number = 7,
    gymId?: string
  ): Promise<ChartDataPoint[]> {
    // 1. Resolve member
    const memberFilter: any = {
      $or: [
        { _id: mongoose.Types.ObjectId.isValid(memberId) ? memberId : undefined },
        { userId: mongoose.Types.ObjectId.isValid(memberId) ? memberId : undefined },
      ],
      isDeleted: false,
    };
    if (gymId) memberFilter.gymId = new mongoose.Types.ObjectId(gymId);
    const member = await Member.findOne(memberFilter);
    if (!member) throw AppError.notFound('Member profile not found');

    // 2. Get active plan (for totalAssigned per day)
    const plan = await WorkoutPlan.findOne({
      memberId: member._id,
      ...(gymId ? { gymId: new mongoose.Types.ObjectId(gymId) } : {}),
      isActive: true,
      isDeleted: false,
    });

    // 3. Build date range for last N days
    const branch = await Branch.findOne({ _id: member.branchId, isDeleted: false });
    const timezone = branch?.timezone || 'UTC';

    // Generate all date keys in range (oldest → newest)
    const dateKeys: string[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setUTCDate(d.getUTCDate() - i);
      dateKeys.push(getDayKeyForBranch(d, timezone));
    }

    // 4. Fetch logs for the date range
    const logs = await WorkoutLog.find({
      memberId: member._id,
      dayKey: { $in: dateKeys },
    });

    // Group logs by dayKey (handles multiple logs on the same date, e.g. checklist + detailed logger)
    const logsByDate = new Map<string, typeof logs>();
    for (const l of logs) {
      if (!logsByDate.has(l.dayKey)) {
        logsByDate.set(l.dayKey, []);
      }
      logsByDate.get(l.dayKey)!.push(l);
    }

    // 5. Calculate completion % for each date
    const result: ChartDataPoint[] = dateKeys.map((dateKey) => {
      const dayLogs = logsByDate.get(dateKey) || [];

      if (dayLogs.length === 0) {
        return { date: dateKey, completionPercentage: 0 };
      }

      let maxPercentage = 0;

      for (const log of dayLogs) {
        // totalAssigned = exercises in the plan day this log was for (or length of logged exercises)
        let totalAssigned = 0;
        if (plan) {
          const planDayIdx = log.dayIndex ?? 0;
          const planDay = plan.days[planDayIdx];
          totalAssigned = planDay?.exercises?.length ?? 0;
        }
        if (totalAssigned === 0) {
          totalAssigned = log.exercises?.length || 1;
        }

        // totalCompleted = exercises with completedAt set OR any completed set
        const totalCompleted = (log.exercises || []).filter(
          (ex) => ex.completedAt != null || (ex.sets && ex.sets.some((s: any) => s.completed))
        ).length;

        let pct = calculateDailyPercentage(totalAssigned, totalCompleted);
        if (log.completedAt && pct < 100) {
          pct = 100;
        }

        if (pct > maxPercentage) {
          maxPercentage = pct;
        }
      }

      return {
        date: dateKey,
        completionPercentage: maxPercentage,
      };
    });

    logger.info(`📊 Progress analytics fetched: [Member: ${member._id}] [Days: ${days}]`);
    return result;
  }
}
