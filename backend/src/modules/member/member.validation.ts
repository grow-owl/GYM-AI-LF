import { z } from 'zod';

export const createMemberSchema = z.object({
  fullName: z.string().min(2).max(100).trim(),
  email: z.string().email().toLowerCase().trim(),
  phone: z.string().min(5).trim(),
  password: z
    .string()
    .min(6, 'Password must be at least 6 characters'),
  branchId: z.string().optional(),
  assignedTrainerId: z.string().optional(),
  planName: z.string().min(1, 'Plan name is required').trim(),
  membershipStartDate: z
    .string()
    .or(z.date())
    .optional()
    .transform((val) => (val ? new Date(val) : new Date())),
  membershipEndDate: z
    .string()
    .or(z.date())
    .optional()
    .transform((val) => {
      if (val) return new Date(val);
      const d = new Date();
      d.setMonth(d.getMonth() + 1);
      return d;
    }),
  dateOfBirth: z.string().or(z.date()).transform((val) => new Date(val)).optional(),
  referralCode: z.string().trim().optional(),
  fitnessGoals: z.array(z.string().trim()).optional().default([]),
  emergencyContact: z
    .object({
      name: z.string().trim(),
      phone: z.string().trim(),
      relation: z.string().trim(),
    })
    .optional(),
  healthInfo: z
    .object({
      height_cm: z.number().positive().optional(),
      currentWeight_kg: z.number().positive().optional(),
      targetWeight_kg: z.number().positive().optional(),
      medicalConditions: z.array(z.string().trim()).optional(),
      injuries: z.array(z.string().trim()).optional(),
    })
    .optional(),
});

export const updateMemberSchema = z.object({
  planName: z.string().trim().optional(),
  membershipStatus: z.enum(['ACTIVE', 'EXPIRED', 'FROZEN', 'CANCELLED']).optional(),
  dateOfBirth: z.string().or(z.date()).transform((val) => new Date(val)).optional(),
  referralCode: z.string().trim().optional(),
  fitnessGoals: z.array(z.string().trim()).optional(),
  emergencyContact: z
    .object({
      name: z.string().trim(),
      phone: z.string().trim(),
      relation: z.string().trim(),
    })
    .optional(),
  healthInfo: z
    .object({
      height_cm: z.number().positive().optional(),
      currentWeight_kg: z.number().positive().optional(),
      targetWeight_kg: z.number().positive().optional(),
      medicalConditions: z.array(z.string().trim()).optional(),
      injuries: z.array(z.string().trim()).optional(),
    })
    .optional(),
});

export const assignTrainerSchema = z.object({
  trainerId: z.string().min(1, 'Trainer ID is required'),
});

export const freezeMembershipSchema = z.object({
  freezeUntil: z.string().or(z.date()),
  reason: z.string().min(2, 'Reason is required'),
});

export const renewMembershipSchema = z.object({
  newEndDate: z.string().or(z.date()),
  planName: z.string().optional(),
});

export const extendMembershipSchema = z.object({
  days: z.number().int().positive('Days must be a positive integer'),
  reason: z.string().min(2, 'Reason is required'),
});

export const cancelMembershipSchema = z.object({
  reason: z.string().min(2, 'Reason is required'),
});
