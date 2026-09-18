import { Request, Response } from 'express';
import { WorkoutPlanService } from './workoutPlan.service';
import { sendSuccess } from '../../common/utils/ApiResponse';
import { asyncHandler } from '../../common/utils/asyncHandler';
import { validateMemberAccess } from '../../common/utils/authorization';
import { Role } from '../../common/constants/roles.enum';

export class WorkoutPlanController {
  public static createWorkoutPlan = asyncHandler(async (req: Request, res: Response) => {
    const { memberId } = req.params;
    const gymId = req.user?.gymId?.toString() || req.params.gymId;

    const plan = await WorkoutPlanService.createWorkoutPlan(
      memberId,
      req.body,
      req.user!.id,
      req.user!.role as Role,
      gymId
    );
    return sendSuccess(res, { plan }, 'Workout plan created successfully', 201);
  });

  public static getActivePlan = asyncHandler(async (req: Request, res: Response) => {
    const requestedMemberId = req.params.memberId || (req.user!.role === Role.MEMBER ? req.user!.id : undefined);
    const validatedMember = await validateMemberAccess(req.user!, requestedMemberId);
    const gymId = req.user?.gymId?.toString() || req.params.gymId;

    const plan = await WorkoutPlanService.getActivePlanForMember(validatedMember._id.toString(), gymId);
    return sendSuccess(res, { plan }, 'Active workout plan retrieved successfully');
  });

  public static listPlans = asyncHandler(async (req: Request, res: Response) => {
    const requestedMemberId = req.params.memberId || (req.user!.role === Role.MEMBER ? req.user!.id : undefined);
    const validatedMember = await validateMemberAccess(req.user!, requestedMemberId);
    const gymId = req.user?.gymId?.toString() || req.params.gymId;

    const { plans, meta } = await WorkoutPlanService.listWorkoutPlans(validatedMember._id.toString(), req.query, gymId);
    return sendSuccess(res, { plans }, 'Workout plans retrieved successfully', 200, {
      pagination: meta,
    });
  });

  public static updateWorkoutPlan = asyncHandler(async (req: Request, res: Response) => {
    const gymId = req.user?.gymId?.toString() || req.params.gymId || '';
    const plan = await WorkoutPlanService.updateWorkoutPlan(req.params.planId, gymId, req.body);
    return sendSuccess(res, { plan }, 'Workout plan updated successfully');
  });

  public static archiveWorkoutPlan = asyncHandler(async (req: Request, res: Response) => {
    const gymId = req.user?.gymId?.toString() || req.params.gymId || '';
    const plan = await WorkoutPlanService.archiveWorkoutPlan(req.params.planId, gymId);
    return sendSuccess(res, { plan }, 'Workout plan archived successfully');
  });

  public static duplicatePlan = asyncHandler(async (req: Request, res: Response) => {
    const gymId = req.user?.gymId?.toString() || req.params.gymId || '';
    const newTitle = req.body.title || req.body.newTitle;
    const plan = await WorkoutPlanService.duplicatePlanForNewCycle(req.params.planId, gymId, newTitle);
    return sendSuccess(res, { plan }, 'Workout plan duplicated for new cycle successfully', 201);
  });

  public static deleteWorkoutPlan = asyncHandler(async (req: Request, res: Response) => {
    const gymId = req.user?.gymId?.toString() || req.params.gymId || '';
    await WorkoutPlanService.deleteWorkoutPlan(req.params.planId, gymId);
    return sendSuccess(res, null, 'Workout plan deleted successfully');
  });
}
