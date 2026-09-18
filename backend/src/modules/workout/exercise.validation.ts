import { z } from 'zod';
import { MuscleGroup } from './exercise.types';

export const createExerciseSchema = z.object({
  name: z.string().min(2).max(100).trim(),
  muscleGroup: z.nativeEnum(MuscleGroup),
  equipment: z.string().trim().optional(),
  instructions: z.string().trim().optional(),
  videoUrl: z.string().url().optional(),
  defaultSets: z.number().int().positive().optional().default(3),
  defaultReps: z.number().int().positive().optional().default(10),
});

export const updateExerciseSchema = createExerciseSchema.partial();
