import { Request, Response } from 'express';
import { DietPlanService } from './dietPlan.service';
import { sendSuccess } from '../../common/utils/ApiResponse';
import { asyncHandler } from '../../common/utils/asyncHandler';
import { validateMemberAccess } from '../../common/utils/authorization';
import { Role } from '../../common/constants/roles.enum';

export class DietPlanController {
  public static createDietPlan = asyncHandler(async (req: Request, res: Response) => {
    const { memberId } = req.params;
    const gymId = req.user?.gymId?.toString() || req.params.gymId;
    const dietPlan = await DietPlanService.createDietPlan(
      memberId,
      req.body,
      req.user!.id,
      req.user!.role as Role,
      gymId
    );
    return sendSuccess(res, { dietPlan }, 'Diet plan created successfully', 201);
  });

  public static getActiveDietPlan = asyncHandler(async (req: Request, res: Response) => {
    const requestedMemberId = req.params.memberId || (req.user!.role === Role.MEMBER ? req.user!.id : undefined);
    const validatedMember = await validateMemberAccess(req.user!, requestedMemberId);
    const gymId = req.user?.gymId?.toString() || req.params.gymId;
    const dietPlan = await DietPlanService.getActiveDietPlanForMember(validatedMember._id.toString(), gymId);
    return sendSuccess(res, { dietPlan }, 'Active diet plan retrieved successfully');
  });

  public static listDietPlans = asyncHandler(async (req: Request, res: Response) => {
    const requestedMemberId = req.params.memberId || (req.user!.role === Role.MEMBER ? req.user!.id : undefined);
    const validatedMember = await validateMemberAccess(req.user!, requestedMemberId);
    const gymId = req.user?.gymId?.toString() || req.params.gymId;
    const { plans, meta } = await DietPlanService.listDietPlans(validatedMember._id.toString(), req.query, gymId);
    return sendSuccess(res, { plans }, 'Diet plans retrieved successfully', 200, {
      pagination: meta,
    });
  });

  public static updateDietPlan = asyncHandler(async (req: Request, res: Response) => {
    const gymId = req.user?.gymId?.toString() || req.params.gymId;
    const dietPlan = await DietPlanService.updateDietPlan(req.params.planId, req.body, gymId);
    return sendSuccess(res, { dietPlan }, 'Diet plan updated successfully');
  });

  public static archiveDietPlan = asyncHandler(async (req: Request, res: Response) => {
    const gymId = req.user?.gymId?.toString() || req.params.gymId;
    const dietPlan = await DietPlanService.archiveDietPlan(req.params.planId, gymId);
    return sendSuccess(res, { dietPlan }, 'Diet plan archived successfully');
  });

  public static deleteDietPlan = asyncHandler(async (req: Request, res: Response) => {
    const gymId = req.user?.gymId?.toString() || req.params.gymId;
    await DietPlanService.deleteDietPlan(req.params.planId, gymId);
    return sendSuccess(res, null, 'Diet plan deleted successfully');
  });
}
