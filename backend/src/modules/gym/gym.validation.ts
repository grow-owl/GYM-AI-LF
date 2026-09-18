import { z } from 'zod';
import { GymPlan } from './gym.types';

export const createGymSchema = z.object({
  name: z
    .string()
    .min(2, 'Gym name must be at least 2 characters')
    .max(100, 'Gym name cannot exceed 100 characters')
    .trim(),
  billingEmail: z.string().email('Please enter a valid billing email address').toLowerCase().trim(),
  plan: z.nativeEnum(GymPlan).optional().default(GymPlan.TRIAL),
  trialDays: z.number().min(1).max(90).optional(),
});

export const updateGymSchema = z.object({
  name: z.string().min(2).max(100).trim().optional(),
  logoUrl: z.string().url('Invalid logo URL').optional(),
  billingEmail: z.string().email().toLowerCase().trim().optional(),
  settings: z
    .object({
      defaultTrialPassDays: z.number().min(1).max(30).optional(),
    })
    .optional(),
});

export const updateGymPlanSchema = z.object({
  plan: z.nativeEnum(GymPlan, {
    errorMap: () => ({ message: 'Invalid Gym Plan specified' }),
  }),
});

const addressSchema = z.object({
  line1: z.string().min(1, 'Address line 1 is required').trim(),
  city: z.string().min(1, 'City is required').trim(),
  state: z.string().min(1, 'State is required').trim(),
  pincode: z.string().min(1, 'Pincode/ZIP code is required').trim(),
  country: z.string().min(1, 'Country is required').trim(),
  geo: z
    .object({
      lat: z.number().min(-90).max(90),
      lng: z.number().min(-180).max(180),
    })
    .optional(),
});

export const createBranchSchema = z.object({
  name: z
    .string()
    .min(2, 'Branch name must be at least 2 characters')
    .max(100, 'Branch name cannot exceed 100 characters')
    .trim(),
  address: addressSchema,
  contactPhone: z.string().min(5, 'Contact phone is required').trim(),
  timezone: z.string().min(1, 'Timezone string is required').trim().default('UTC'),
  managerId: z.string().optional(),
});

export const updateBranchSchema = z.object({
  name: z.string().min(2).max(100).trim().optional(),
  address: addressSchema.partial().optional(),
  contactPhone: z.string().min(5).trim().optional(),
  timezone: z.string().min(1).trim().optional(),
  managerId: z.string().optional(),
  isActive: z.boolean().optional(),
});

export const assignManagerSchema = z.object({
  managerId: z.string().min(1, 'Manager User ID is required'),
});
