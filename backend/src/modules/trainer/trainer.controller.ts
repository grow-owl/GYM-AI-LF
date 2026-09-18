import { Request, Response } from 'express';
import { TrainerService } from './trainer.service';
import { sendSuccess } from '../../common/utils/ApiResponse';
import { asyncHandler } from '../../common/utils/asyncHandler';

export class TrainerController {
  public static createTrainer = asyncHandler(async (req: Request, res: Response) => {
    const { gymId, branchId } = req.params;
    const trainer = await TrainerService.createTrainer(gymId, branchId, req.body);
    return sendSuccess(res, { trainer }, 'Trainer onboarded successfully', 201);
  });

  public static listTrainers = asyncHandler(async (req: Request, res: Response) => {
    const { gymId, branchId } = req.params;
    const { trainers, meta } = await TrainerService.listTrainers(gymId, branchId, req.query);
    return sendSuccess(res, { trainers }, 'Trainers retrieved successfully', 200, { pagination: meta });
  });

  public static getTrainerById = asyncHandler(async (req: Request, res: Response) => {
    const gymId = req.params.gymId || req.user?.gymId;
    const trainer = await TrainerService.getTrainerById(req.params.trainerId, gymId ? gymId.toString() : undefined);
    return sendSuccess(res, { trainer }, 'Trainer profile retrieved successfully');
  });

  public static updateTrainer = asyncHandler(async (req: Request, res: Response) => {
    const gymId = req.params.gymId || req.user?.gymId;
    const trainer = await TrainerService.updateTrainer(req.params.trainerId, req.body, gymId ? gymId.toString() : undefined);
    return sendSuccess(res, { trainer }, 'Trainer profile updated successfully');
  });

  public static softDeleteTrainer = asyncHandler(async (req: Request, res: Response) => {
    const force = req.query.force === 'true';
    const gymId = req.params.gymId || req.user?.gymId;
    await TrainerService.softDeleteTrainer(req.params.trainerId, force, gymId ? gymId.toString() : undefined);
    return sendSuccess(res, null, 'Trainer soft deleted successfully');
  });

  public static getTrainerWorkload = asyncHandler(async (req: Request, res: Response) => {
    const workload = await TrainerService.getTrainerWorkload(req.params.trainerId);
    return sendSuccess(
      res,
      { trainerId: req.params.trainerId, activeMembersAssigned: workload },
      'Trainer workload calculated successfully'
    );
  });

  public static getTrainerClients = asyncHandler(async (req: Request, res: Response) => {
    const gymId = req.params.gymId || req.user?.gymId;
    if (!gymId) {
      return res.status(400).json({ success: false, error: { message: 'Gym ID is required' } });
    }
    const clients = await TrainerService.getTrainerClients(gymId.toString(), req.user!.id);
    return sendSuccess(res, { clients }, 'Trainer clients retrieved successfully');
  });
}
