import { z } from 'zod';
import { Role } from '../user/user.types';

export const registerSchema = z.object({
  fullName: z
    .string()
    .min(2, 'Full name must be at least 2 characters')
    .max(100, 'Full name cannot exceed 100 characters')
    .trim(),
  email: z.string().email('Please enter a valid email address').toLowerCase().trim(),
  phone: z
    .string()
    .trim()
    .min(1, 'Phone number is required')
    .regex(
      /^\+?[0-9\s-]{7,15}$/,
      'Enter a valid phone number (7-15 digits, optionally starting with +)'
    ),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/(?=.*[a-zA-Z])(?=.*[0-9])/, 'Password must contain at least 1 letter and 1 number'),
  role: z.enum([Role.MEMBER], {
    errorMap: () => ({
      message: 'Self-registration is only allowed for MEMBER role. Gym Owner accounts must be created by Super Admin.',
    }),
  }).optional(),
  referralCode: z.string().trim().optional(),
});

export const registerOwnerSchema = z.object({
  fullName: z
    .string()
    .min(2, 'Full name must be at least 2 characters')
    .max(100, 'Full name cannot exceed 100 characters')
    .trim(),
  email: z.string().email('Please enter a valid email address').toLowerCase().trim(),
  phone: z
    .string()
    .trim()
    .min(1, 'Phone number is required')
    .regex(
      /^\+?[0-9\s-]{7,15}$/,
      'Enter a valid phone number (7-15 digits, optionally starting with +)'
    ),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/(?=.*[a-zA-Z])(?=.*[0-9])/, 'Password must contain at least 1 letter and 1 number')
    .optional(),
  gymName: z.string().min(2, 'Gym name must be at least 2 characters').trim(),
  branchName: z.string().trim().optional(),
  plan: z.enum(['TRIAL', 'BASIC', 'PRO', 'ENTERPRISE']).optional(),
  trialDays: z.number().min(1).max(90).optional(),
});

export const adminResetPasswordSchema = z.object({
  newPassword: z
    .string()
    .min(8, 'New password must be at least 8 characters')
    .regex(/(?=.*[a-zA-Z])(?=.*[0-9])/, 'Password must contain at least 1 letter and 1 number'),
});

export const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address').toLowerCase().trim(),
  password: z.string().min(1, 'Password is required'),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().optional(), // May be passed in cookie or body
});

export const forgotPasswordSchema = z.object({
  email: z.string().email('Please enter a valid email address').toLowerCase().trim(),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Reset token is required'),
  newPassword: z
    .string()
    .min(8, 'New password must be at least 8 characters')
    .regex(/(?=.*[a-zA-Z])(?=.*[0-9])/, 'Password must contain at least 1 letter and 1 number'),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z
    .string()
    .min(8, 'New password must be at least 8 characters')
    .regex(/(?=.*[a-zA-Z])(?=.*[0-9])/, 'Password must contain at least 1 letter and 1 number'),
});

export const registerStaffSchema = z.object({
  fullName: z
    .string()
    .min(2, 'Full name must be at least 2 characters')
    .max(100, 'Full name cannot exceed 100 characters')
    .trim(),
  email: z.string().email('Please enter a valid email address').toLowerCase().trim(),
  phone: z
    .string()
    .trim()
    .min(1, 'Phone number is required')
    .regex(/^\+?[0-9\s-]{7,15}$/, 'Enter a valid phone number'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/(?=.*[a-zA-Z])(?=.*[0-9])/, 'Password must contain at least 1 letter and 1 number'),
  role: z.enum([Role.BRANCH_MANAGER, Role.KIOSK]).optional(),
  branchId: z.string().optional(),
});

export const updateProfileSchema = z.object({
  fullName: z.string().min(2, 'Full name must be at least 2 characters').max(100).trim().optional(),
  phone: z.string().trim().regex(/^\+?[0-9\s-]{7,15}$/, 'Enter a valid phone number').optional(),
  avatarUrl: z.string().url('Must be a valid URL').or(z.string().length(0)).optional(),
});

