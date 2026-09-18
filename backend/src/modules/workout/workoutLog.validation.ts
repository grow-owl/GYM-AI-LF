import z from "zod";


const batchExerciseSchema = z.object({
  exerciseId: z.string().optional(),
  exerciseName: z.string().trim().optional(),
  name: z.string().trim().optional(),
  sets: z.number().int().positive().optional().default(1),
  reps: z.number().int().positive().optional().default(10),
  weightKg: z.number().nonnegative('Weight must be 0 or positive').optional().default(0),
});

export const startWorkoutLogSchema = z.object({
  workoutPlanId: z.string().optional(),
  dayLabel: z.string().trim().optional(),
  attendanceId: z.string().optional(),
  loggedAt: z.string().optional(),
  exercises: z.array(batchExerciseSchema).optional(),
});

export const updateSetSchema = z.object({
  reps: z.number().int().positive('Reps must be a positive integer'),
  weightKg: z.number().nonnegative('Weight must be 0 or positive').optional(),
  completed: z.boolean().optional().default(true),
});

