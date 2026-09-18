import { z } from 'zod';

export const logWeightSchema = z.object({
  memberId: z.string().optional(),
  weightKg: z
    .number()
    .min(20, 'Weight must be at least 20 kg')
    .max(300, 'Weight must be at most 300 kg'),
  heightCm: z.number().min(50).max(250).optional(),
  targetWeightKg: z.number().min(20).max(300).optional(),
  date: z
    .string()
    .or(z.date())
    .optional()
    .transform((val) => (val ? new Date(val) : undefined)),
});

export const uploadProgressPhotoSchema = z
  .object({
    image: z.string().min(1, 'Image data is required').optional(),
    imageUrl: z.string().min(1).optional(),
    photoUrl: z.string().min(1).optional(),
    angle: z.enum(['front', 'side', 'back']).optional().default('front'),
    notes: z.string().max(500).optional(),
  })
  .refine((data) => Boolean(data.image || data.imageUrl || data.photoUrl), {
    message: 'Either image (base64/data URI) or imageUrl must be provided',
    path: ['image'],
  });

export const logWellnessSchema = z.object({
  waterIntakeMl: z.number().int().nonnegative().optional(),
  sleepHours: z.number().min(0).max(24).optional(),
  mood: z.enum(['great', 'good', 'okay', 'tired', 'stressed']).optional(),
  dayKey: z.string().optional(),
});

export const logMealSchema = z.object({
  mealType: z.enum(['breakfast', 'lunch', 'dinner', 'snack']),
  description: z.string().min(1, 'Meal description is required').trim(),
  calories: z.number().int().nonnegative().optional(),
  dayKey: z.string().optional(),
});
