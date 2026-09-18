import { z } from 'zod';

export const createTrainerSchema = z.object({
  fullName: z.string().min(2).max(100).trim(),
  email: z.string().email().toLowerCase().trim(),
  phone: z.string().min(5).trim(),
  password: z
    .string()
    .min(8)
    .regex(/(?=.*[a-zA-Z])(?=.*[0-9])/, 'Password must contain at least 1 letter and 1 number'),
  branchId: z.string().min(1, 'Branch ID is required'),
  specializations: z.array(z.string().trim()).optional().default([]),
  bio: z.string().trim().optional(),
  certifications: z
    .array(
      z.object({
        name: z.string().trim(),
        issuedBy: z.string().trim(),
        year: z.number().int().min(1950).max(2100),
      })
    )
    .optional(),
  maxMemberCapacity: z.number().int().positive().optional(),
});

export const updateTrainerSchema = z.object({
  specializations: z.array(z.string().trim()).optional(),
  bio: z.string().trim().optional(),
  certifications: z
    .array(
      z.object({
        name: z.string().trim(),
        issuedBy: z.string().trim(),
        year: z.number().int().min(1950).max(2100),
      })
    )
    .optional(),
  maxMemberCapacity: z.number().int().positive().optional(),
});
