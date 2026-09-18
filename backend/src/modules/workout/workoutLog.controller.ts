import { Request, Response } from 'express';
import { WorkoutLogService } from './workoutLog.service';
import { sendSuccess } from '../../common/utils/ApiResponse';
import { asyncHandler } from '../../common/utils/asyncHandler';
import { validateMemberAccess } from '../../common/utils/authorization';
import { Role } from '../../common/constants/roles.enum';

export class WorkoutLogController {
  public static startWorkoutLog = asyncHandler(async (req: Request, res: Response) => {
    const requestedMemberId = req.body.memberId || (req.user!.role === Role.MEMBER ? req.user!.id : undefined);
    const validatedMember = await validateMemberAccess(req.user!, requestedMemberId);
    if (req.user!.role === Role.MEMBER) {
      await WorkoutLogService.assertMemberCheckedIn(validatedMember._id.toString());
    }
    const log = await WorkoutLogService.startWorkoutLog(validatedMember._id.toString(), req.body);
    return sendSuccess(res, { log }, 'Workout log started successfully', 201);
  });

  public static logSetProgress = asyncHandler(async (req: Request, res: Response) => {
    if (req.user!.role === Role.MEMBER) {
      await WorkoutLogService.assertMemberCheckedIn(req.user!.id);
    }
    const { logId, exerciseId, setNumber } = req.params;
    const gymId = req.user?.gymId?.toString();
    const log = await WorkoutLogService.logSetProgress(
      logId,
      {
        exerciseId,
        setNumber: parseInt(setNumber, 10),
        reps: req.body.reps,
        weightKg: req.body.weightKg,
        completed: req.body.completed,
      },
      gymId,
      req.user!
    );
    return sendSuccess(res, { log }, 'Set progress updated successfully');
  });

  public static markExerciseComplete = asyncHandler(async (req: Request, res: Response) => {
    if (req.user!.role === Role.MEMBER) {
      await WorkoutLogService.assertMemberCheckedIn(req.user!.id);
    }
    const { logId, exerciseId } = req.params;
    const gymId = req.user?.gymId?.toString();
    const log = await WorkoutLogService.markExerciseComplete(logId, exerciseId, gymId, req.user!);
    return sendSuccess(res, { log }, 'Exercise marked completed');
  });

  public static completeWorkoutLog = asyncHandler(async (req: Request, res: Response) => {
    if (req.user!.role === Role.MEMBER) {
      await WorkoutLogService.assertMemberCheckedIn(req.user!.id);
    }
    const gymId = req.user?.gymId?.toString();
    const log = await WorkoutLogService.completeWorkoutLog(req.params.logId, gymId, req.user!);
    return sendSuccess(res, { log }, 'Workout session completed successfully');
  });

  public static getWorkoutHistory = asyncHandler(async (req: Request, res: Response) => {
    const requestedMemberId = req.params.memberId || (req.user!.role === Role.MEMBER ? req.user!.id : undefined);
    const validatedMember = await validateMemberAccess(req.user!, requestedMemberId);
    const { logs, meta } = await WorkoutLogService.getWorkoutHistory(validatedMember._id.toString(), req.query);
    return sendSuccess(res, { logs }, 'Workout history retrieved successfully', 200, {
      pagination: meta,
    });
  });

  public static getWorkoutCompletionStats = asyncHandler(async (req: Request, res: Response) => {
    const requestedMemberId = req.params.memberId || (req.user!.role === Role.MEMBER ? req.user!.id : undefined);
    const validatedMember = await validateMemberAccess(req.user!, requestedMemberId);
    const stats = await WorkoutLogService.getWorkoutCompletionStats(validatedMember._id.toString());
    return sendSuccess(res, { stats }, 'Workout completion statistics retrieved successfully');
  });

  // ── Spec Step B ─────────────────────────────────────────────────────────────
  // GET /api/v1/workout-logs/today
  // Returns merged Blueprint + Log state for today's workout session
  public static getTodayWorkout = asyncHandler(async (req: Request, res: Response) => {
    const memberId = req.user!.role === Role.MEMBER ? req.user!.id : (req.query.memberId as string);
    const gymId = req.user?.gymId?.toString();
    const today = await WorkoutLogService.getTodayWorkout(memberId, gymId);
    if (!today) {
      return sendSuccess(res, { today: null }, 'No active workout plan found for today');
    }
    return sendSuccess(res, { today }, "Today's workout fetched successfully");
  });

  // ── Spec Step C ─────────────────────────────────────────────────────────────
  // PATCH /api/v1/workout-logs/today
  // Body: { exerciseId: string }
  // Toggles an exercise as completed/uncompleted — creates log if needed
  public static toggleExerciseToday = asyncHandler(async (req: Request, res: Response) => {
    const memberId = req.user!.role === Role.MEMBER ? req.user!.id : (req.body.memberId as string);
    const { exerciseId } = req.body;
    if (!exerciseId) {
      return sendSuccess(res, null, 'exerciseId is required', 400);
    }
    if (req.user!.role === Role.MEMBER) {
      await WorkoutLogService.assertMemberCheckedIn(memberId);
    }
    const gymId = req.user?.gymId?.toString();
    const today = await WorkoutLogService.toggleExerciseCompleteToday(memberId, exerciseId, gymId);
    return sendSuccess(res, { today }, 'Exercise completion toggled successfully');
  });

  // ── Spec Step D ─────────────────────────────────────────────────────────────
  // GET /api/v1/workout-logs/analytics/progress?days=7
  // Returns ChartDataPoint[] for the progress line graph
  public static getProgressChart = asyncHandler(async (req: Request, res: Response) => {
    const requestedMemberId =
      (req.query.memberId as string) ||
      req.params.memberId ||
      (req.user!.role === Role.MEMBER ? req.user!.id : undefined);
    const validatedMember = await validateMemberAccess(req.user!, requestedMemberId);
    const gymId = req.user?.gymId?.toString();
    const days = Math.min(Math.max(parseInt(req.query.days as string) || 7, 1), 90);
    const data = await WorkoutLogService.getProgressAnalytics(validatedMember._id.toString(), days, gymId);
    return sendSuccess(res, { data }, 'Progress analytics retrieved successfully');
  });
}
