import { z } from 'zod';

export const createChallengeSchema = z.object({
  branchId: z.string().optional(),
  title: z.string().min(2).max(100).trim(),
  description: z.string().min(5).trim(),
  metric: z.enum(['workout_count', 'streak_days', 'total_minutes']),
  targetValue: z.number().int().positive(),
  startDate: z.string().or(z.date()).transform((val) => new Date(val)),
  endDate: z.string().or(z.date()).transform((val) => new Date(val)),
  rewardXp: z.number().int().positive().optional().default(500),
});

export const updateRestDaysSchema = z.object({
  restDays: z
    .array(z.number().int().min(0).max(6))
    .max(7, 'Cannot have more than 7 rest days')
    .refine((arr) => new Set(arr).size === arr.length, {
      message: 'Duplicate weekday values are not allowed',
    }),
});
