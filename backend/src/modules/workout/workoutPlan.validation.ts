import { z } from 'zod';

const workoutPlanExerciseSchema = z.object({
  exerciseId: z.string().min(1, 'Exercise ID is required'),
  order: z.number().int().positive(),
  targetSets: z.number().int().positive(),
  targetReps: z.number().int().positive(),
  targetWeightKg: z.number().positive().optional(),
  restSeconds: z.number().int().nonnegative().optional().default(60),
  notes: z.string().trim().optional(),
});

const workoutDaySchema = z.object({
  dayLabel: z.string().min(1, 'Day label is required').trim(),
  exercises: z.array(workoutPlanExerciseSchema).min(1, 'At least 1 exercise is required per workout day'),
});

export const createWorkoutPlanSchema = z.object({
  title: z.string().min(2).max(150).trim(),
  goal: z.string().min(2).trim(),
  days: z.array(workoutDaySchema).min(1, 'Workout plan must have at least 1 day'),
  startDate: z.string().or(z.date()).transform((val) => new Date(val)),
  endDate: z
    .string()
    .or(z.date())
    .optional()
    .transform((val) => (val ? new Date(val) : undefined)),
});

export const updateWorkoutPlanSchema = createWorkoutPlanSchema.partial();
