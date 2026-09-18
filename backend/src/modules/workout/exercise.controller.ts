import { Request, Response } from 'express';
import { ExerciseService } from './exercise.service';
import { sendSuccess } from '../../common/utils/ApiResponse';
import { asyncHandler } from '../../common/utils/asyncHandler';

export class ExerciseController {
  public static createExercise = asyncHandler(async (req: Request, res: Response) => {
    const gymId = req.tenant?.gymId || req.user?.gymId;
    if (!gymId) {
      return res.status(400).json({ success: false, error: { message: 'Gym ID is required' } });
    }
    const exercise = await ExerciseService.createExercise(gymId.toString(), req.body);
    return sendSuccess(res, { exercise }, 'Exercise created successfully', 201);
  });

  public static seedGlobalLibrary = asyncHandler(async (_req: Request, res: Response) => {
    const count = await ExerciseService.seedGlobalExerciseLibrary();
    return sendSuccess(res, { seededCount: count }, 'Global exercise library seeded successfully');
  });

  public static listExercises = asyncHandler(async (req: Request, res: Response) => {
    const gymId = req.tenant?.gymId || req.user?.gymId || '';
    const { search, muscleGroup } = req.query;

    const { exercises, meta } = await ExerciseService.listExercises(
      gymId.toString(),
      {
        search: search as string,
        muscleGroup: muscleGroup as string,
      },
      req.query
    );

    return sendSuccess(res, { exercises }, 'Exercises retrieved successfully', 200, {
      pagination: meta,
    });
  });

  public static getExerciseById = asyncHandler(async (req: Request, res: Response) => {
    const gymId = req.tenant?.gymId || req.user?.gymId;
    const exercise = await ExerciseService.getExerciseById(
      req.params.exerciseId,
      gymId ? gymId.toString() : undefined
    );
    return sendSuccess(res, { exercise }, 'Exercise details retrieved successfully');
  });

  public static updateExercise = asyncHandler(async (req: Request, res: Response) => {
    const gymId = req.tenant?.gymId || req.user?.gymId;
    if (!gymId) {
      return res.status(400).json({ success: false, error: { message: 'Gym ID is required' } });
    }
    const exercise = await ExerciseService.updateExercise(req.params.exerciseId, gymId.toString(), req.body);
    return sendSuccess(res, { exercise }, 'Exercise updated successfully');
  });

  public static deleteExercise = asyncHandler(async (req: Request, res: Response) => {
    const gymId = req.tenant?.gymId || req.user?.gymId;
    if (!gymId) {
      return res.status(400).json({ success: false, error: { message: 'Gym ID is required' } });
    }
    await ExerciseService.deleteExercise(req.params.exerciseId, gymId.toString());
    return sendSuccess(res, null, 'Exercise deleted successfully');
  });
}
