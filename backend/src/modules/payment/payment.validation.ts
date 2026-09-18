import { z } from 'zod';

export const recordMemberPaymentSchema = z.object({
  memberId: z.string().optional(),
  customerName: z.string().trim().optional(),
  customerPhone: z.string().trim().optional(),
  branchId: z.string().optional(),
  amount: z.number().positive('Amount must be greater than 0'),
  purpose: z.enum(['membership_fee', 'personal_training', 'merchandise', 'other']),
  method: z.enum(['cash', 'card', 'upi', 'bank_transfer']),
  notes: z.string().trim().optional(),
  triggerRenewal: z.boolean().optional().default(false),
  newEndDate: z
    .string()
    .or(z.date())
    .optional()
    .transform((val) => (val ? new Date(val) : undefined)),
});

export const refundPaymentSchema = z.object({
  amount: z.number().positive().optional(),
  reason: z.string().min(3, 'Refund reason is required').trim(),
});

export const recordManualPlatformPaymentSchema = z.object({
  targetPlan: z.enum(['BASIC', 'PRO', 'ENTERPRISE']),
  billingCycle: z.enum(['MONTHLY', 'YEARLY']).optional().default('MONTHLY'),
  amount: z.number().positive('Amount must be greater than 0'),
  method: z.enum(['bank_transfer', 'upi', 'cheque', 'cash', 'other']),
  transactionRef: z.string().trim().optional(),
  notes: z.string().trim().optional(),
});
