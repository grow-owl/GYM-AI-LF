import { Request, Response } from 'express';
import { GymService } from './gym.service';
import { sendSuccess } from '../../common/utils/ApiResponse';
import { asyncHandler } from '../../common/utils/asyncHandler';
import { AppError } from '../../common/utils/AppError';
import { Role } from '../../common/constants/roles.enum';

export class GymController {
  public static createGym = asyncHandler(async (req: Request, res: Response) => {
    const ownerId = req.user!.id;
    const result = await GymService.createGymForOwner(ownerId, req.body);
    return sendSuccess(res, result, 'Gym organization and default branch created successfully', 201);
  });

  public static getGymById = asyncHandler(async (req: Request, res: Response) => {
    const gym = await GymService.getGymById(req.params.gymId);
    return sendSuccess(res, { gym }, 'Gym details retrieved successfully');
  });

  public static updateGym = asyncHandler(async (req: Request, res: Response) => {
    const gym = await GymService.updateGym(req.params.gymId, req.body);
    return sendSuccess(res, { gym }, 'Gym profile updated successfully');
  });

  public static softDeleteGym = asyncHandler(async (req: Request, res: Response) => {
    const force = req.query.force === 'true';
    await GymService.softDeleteGym(req.params.gymId, force);
    return sendSuccess(res, null, 'Gym organization soft deleted successfully');
  });

  public static updateGymPlan = asyncHandler(async (req: Request, res: Response) => {
    const gym = await GymService.updateGymPlan(req.params.gymId, req.body.plan);
    return sendSuccess(res, { gym }, 'Gym subscription plan updated successfully');
  });

  public static getGymOverview = asyncHandler(async (req: Request, res: Response) => {
    const overview = await GymService.getGymOverview(req.params.gymId);
    return sendSuccess(res, overview, 'Gym overview statistics retrieved successfully');
  });

  public static createBranch = asyncHandler(async (req: Request, res: Response) => {
    const gymId = req.params.gymId;
    await GymService.verifyOwnerAccess(req.user!.id, gymId, req.user!.role as Role);
    const branch = await GymService.createBranch(
      gymId,
      req.body,
      req.user!.id,
      req.user!.role as Role
    );
    return sendSuccess(res, { branch }, 'Branch created successfully', 201);
  });

  public static listBranches = asyncHandler(async (req: Request, res: Response) => {
    const gymId = req.params.gymId;
    const { branches, meta } = await GymService.listBranches(gymId, req.query);
    return sendSuccess(res, { branches }, 'Branches retrieved successfully', 200, { pagination: meta });
  });

  public static getBranchById = asyncHandler(async (req: Request, res: Response) => {
    const branch = await GymService.getBranchById(req.params.branchId, req.params.gymId);
    return sendSuccess(res, { branch }, 'Branch details retrieved successfully');
  });

  public static updateBranch = asyncHandler(async (req: Request, res: Response) => {
    const branchId = req.params.branchId;
    const gymId = req.params.gymId;
    await GymService.verifyOwnerAccess(req.user!.id, gymId, req.user!.role as Role);

    const branch = await GymService.updateBranch(branchId, req.body);
    return sendSuccess(res, { branch }, 'Branch details updated successfully');
  });

  public static softDeleteBranch = asyncHandler(async (req: Request, res: Response) => {
    const branchId = req.params.branchId;
    const gymId = req.params.gymId;
    const force = req.query.force === 'true';

    await GymService.verifyOwnerAccess(req.user!.id, gymId, req.user!.role as Role);
    await GymService.softDeleteBranch(branchId, force);

    return sendSuccess(res, null, 'Branch soft deleted successfully');
  });

  public static assignBranchManager = asyncHandler(async (req: Request, res: Response) => {
    const branchId = req.params.branchId;
    const managerId = req.body.managerId;

    const branch = await GymService.assignBranchManager(
      branchId,
      managerId,
      req.user!.id,
      req.user!.role as Role
    );
    return sendSuccess(res, { branch }, 'Branch manager assigned successfully');
  });

  public static listAllGyms = asyncHandler(async (_req: Request, res: Response) => {
    const result = await GymService.listAllGyms();
    return sendSuccess(res, result, 'All gyms retrieved successfully');
  });

  public static getMembershipPlans = asyncHandler(async (req: Request, res: Response) => {
    const gymId = req.params.gymId || req.user?.gymId;
    if (!gymId) {
      throw AppError.badRequest('Gym ID is required');
    }
    const plans = await GymService.getMembershipPlans(gymId.toString());
    return sendSuccess(res, { plans }, 'Gym membership plans retrieved successfully');
  });

  public static updateMembershipPlans = asyncHandler(async (req: Request, res: Response) => {
    const gymId = req.params.gymId || req.user?.gymId;
    if (!gymId) {
      throw AppError.badRequest('Gym ID is required');
    }
    const { plans } = req.body;
    const updatedPlans = await GymService.updateMembershipPlans(gymId.toString(), plans);
    return sendSuccess(res, { plans: updatedPlans }, 'Gym membership plans updated successfully');
  });
}
