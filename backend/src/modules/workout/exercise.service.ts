import mongoose from 'mongoose';
import { Exercise } from './exercise.model';
import { IExercise, MuscleGroup } from './exercise.types';
import { AppError } from '../../common/utils/AppError';
import { getPaginationParams, buildPaginationMeta, ParsedPagination } from '../../common/utils/pagination';
import { logger } from '../../config/logger';

export interface CreateExerciseInput {
  name: string;
  muscleGroup: MuscleGroup;
  equipment?: string;
  instructions?: string;
  videoUrl?: string;
  defaultSets?: number;
  defaultReps?: number;
}

export class ExerciseService {
  /**
   * Create a gym-custom Exercise
   */
  public static async createExercise(gymId: string, input: CreateExerciseInput): Promise<IExercise> {
    const exercise = new Exercise({
      gymId: new mongoose.Types.ObjectId(gymId),
      name: input.name,
      muscleGroup: input.muscleGroup,
      equipment: input.equipment,
      instructions: input.instructions,
      videoUrl: input.videoUrl,
      defaultSets: input.defaultSets || 3,
      defaultReps: input.defaultReps || 10,
    });

    await exercise.save();
    logger.info(`🏋️ Custom Exercise created: [ID: ${exercise._id}] [Gym: ${gymId}] [Name: ${input.name}]`);
    return exercise;
  }

  /**
   * Seed Global Exercise Library (Run-once / Idempotent helper)
   */
  public static async seedGlobalExerciseLibrary(): Promise<number> {
    const globalExercises = [
      { name: 'Barbell Bench Press', muscleGroup: MuscleGroup.CHEST, equipment: 'Barbell', defaultSets: 4, defaultReps: 8 },
      { name: 'Incline Dumbbell Press', muscleGroup: MuscleGroup.CHEST, equipment: 'Dumbbells', defaultSets: 3, defaultReps: 10 },
      { name: 'Barbell Back Squat', muscleGroup: MuscleGroup.LEGS, equipment: 'Barbell', defaultSets: 4, defaultReps: 8 },
      { name: 'Romanian Deadlift', muscleGroup: MuscleGroup.LEGS, equipment: 'Barbell', defaultSets: 3, defaultReps: 10 },
      { name: 'Conventional Deadlift', muscleGroup: MuscleGroup.BACK, equipment: 'Barbell', defaultSets: 3, defaultReps: 5 },
      { name: 'Lat Pulldown', muscleGroup: MuscleGroup.BACK, equipment: 'Cable Machine', defaultSets: 4, defaultReps: 12 },
      { name: 'Overhead Shoulder Press', muscleGroup: MuscleGroup.SHOULDERS, equipment: 'Barbell', defaultSets: 4, defaultReps: 8 },
      { name: 'Dumbbell Lateral Raise', muscleGroup: MuscleGroup.SHOULDERS, equipment: 'Dumbbells', defaultSets: 3, defaultReps: 15 },
      { name: 'Barbell Bicep Curl', muscleGroup: MuscleGroup.ARMS, equipment: 'Barbell', defaultSets: 3, defaultReps: 12 },
      { name: 'Tricep Rope Pushdown', muscleGroup: MuscleGroup.ARMS, equipment: 'Cable Machine', defaultSets: 3, defaultReps: 12 },
      { name: 'Hanging Leg Raise', muscleGroup: MuscleGroup.CORE, equipment: 'Pull-up Bar', defaultSets: 3, defaultReps: 15 },
      { name: 'Plank Hold', muscleGroup: MuscleGroup.CORE, equipment: 'Bodyweight', defaultSets: 3, defaultReps: 60 },
      { name: 'Treadmill Interval Sprint', muscleGroup: MuscleGroup.CARDIO, equipment: 'Treadmill', defaultSets: 5, defaultReps: 1 },
    ];

    let seededCount = 0;
    for (const item of globalExercises) {
      const exists = await Exercise.findOne({ gymId: null, name: item.name, isDeleted: false });
      if (!exists) {
        await Exercise.create({ ...item, gymId: null });
        seededCount++;
      }
    }

    logger.info(`🌱 Global exercise library seeded: ${seededCount} new exercises added`);
    return seededCount;
  }

  /**
   * List Exercises merging Global (`gymId: null`) and Gym-Custom exercises
   */
  public static async listExercises(
    gymId: string,
    filters: { search?: string; muscleGroup?: string } = {},
    options: { page?: number | string; limit?: number | string } = {}
  ): Promise<{ exercises: IExercise[]; meta: ReturnType<typeof buildPaginationMeta> }> {
    const { page, limit, skip }: ParsedPagination = getPaginationParams(options);

    const filter: Record<string, unknown> = {
      $or: [{ gymId: null }, { gymId: new mongoose.Types.ObjectId(gymId) }],
      isDeleted: false,
    };

    if (filters.muscleGroup) {
      filter.muscleGroup = filters.muscleGroup;
    }

    if (filters.search) {
      filter.$text = { $search: filters.search };
    }

    const [exercises, totalItems] = await Promise.all([
      Exercise.find(filter).skip(skip).limit(limit).sort({ name: 1 }),
      Exercise.countDocuments(filter),
    ]);

    const meta = buildPaginationMeta(totalItems, page, limit);

    return { exercises, meta };
  }

  /**
   * Get single Exercise by ID
   */
  public static async getExerciseById(exerciseId: string, gymId?: string): Promise<IExercise> {
    const filter: any = { _id: exerciseId, isDeleted: false };
    if (gymId) {
      filter.$or = [{ gymId: null }, { gymId: new mongoose.Types.ObjectId(gymId) }];
    }
    const exercise = await Exercise.findOne(filter);
    if (!exercise) {
      throw AppError.notFound('Exercise not found');
    }
    return exercise;
  }

  /**
   * Update gym-custom Exercise
   */
  public static async updateExercise(
    exerciseId: string,
    gymId: string,
    input: Partial<CreateExerciseInput>
  ): Promise<IExercise> {
    const filter: any = {
      _id: exerciseId,
      gymId: new mongoose.Types.ObjectId(gymId),
      isDeleted: false,
    };

    const exercise = await Exercise.findOneAndUpdate(filter, input, { new: true, runValidators: true });
    if (!exercise) {
      throw AppError.notFound('Custom exercise not found or cannot edit global exercises');
    }
    logger.info(`🏋️ Custom Exercise updated: [ID: ${exercise._id}] [Gym: ${gymId}]`);
    return exercise;
  }

  /**
   * Soft-delete gym-custom Exercise
   */
  public static async deleteExercise(exerciseId: string, gymId: string): Promise<void> {
    const filter: any = {
      _id: exerciseId,
      gymId: new mongoose.Types.ObjectId(gymId),
      isDeleted: false,
    };

    const exercise = await Exercise.findOneAndUpdate(filter, { isDeleted: true }, { new: true });
    if (!exercise) {
      throw AppError.notFound('Custom exercise not found or cannot delete global exercises');
    }
    logger.info(`🗑️ Custom Exercise deleted: [ID: ${exerciseId}] [Gym: ${gymId}]`);
  }

  /**
   * Batch validate that all referenced exercise IDs exist in library
   */
  public static async batchValidateExerciseIds(exerciseIds: string[]): Promise<void> {
    const uniqueIds = Array.from(new Set(exerciseIds)).map((id) => new mongoose.Types.ObjectId(id));
    const foundCount = await Exercise.countDocuments({
      _id: { $in: uniqueIds },
    });

    if (foundCount !== uniqueIds.length) {
      throw AppError.badRequest('One or more referenced exercise IDs are invalid or deleted');
    }
  }
}
