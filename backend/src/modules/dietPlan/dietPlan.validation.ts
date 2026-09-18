import { z } from 'zod';

const mealItemSchema = z.object({
  name: z.string().min(1, 'Item name is required').trim(),
  quantity: z.string().min(1, 'Quantity is required').trim(),
  calories: z.number().positive().optional(),
  protein_g: z.number().positive().optional(),
});

const mealSchema = z.object({
  mealType: z.enum(['breakfast', 'lunch', 'dinner', 'snack']),
  items: z.array(mealItemSchema).min(1, 'At least 1 item is required per meal'),
  notes: z.string().trim().optional(),
});

export const createDietPlanSchema = z.object({
  title: z.string().min(2).max(150).trim(),
  dailyCalorieTarget: z.number().positive().optional(),
  dailyProteinTarget_g: z.number().positive().optional(),
  meals: z.array(mealSchema).min(1, 'Diet plan must contain at least 1 meal'),
  startDate: z.string().or(z.date()).transform((val) => new Date(val)),
  endDate: z
    .string()
    .or(z.date())
    .optional()
    .transform((val) => (val ? new Date(val) : undefined)),
});

export const updateDietPlanSchema = createDietPlanSchema.partial();
