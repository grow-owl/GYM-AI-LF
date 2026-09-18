import { z } from 'zod';

export const checkInSchema = z.object({
  qrPayload: z.string().optional(),
  dynamicQrToken: z.string().optional(),
  memberId: z.string().optional(),
  branchId: z.string().optional(),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
});

export const checkOutSchema = z.object({
  qrPayload: z.string().optional(),
  attendanceId: z.string().optional(),
  memberId: z.string().optional(),
});

export const manualAttendanceSchema = z.object({
  memberId: z.string().min(1, 'Member ID is required'),
  checkInAt: z.string().or(z.date()).transform((val) => new Date(val)),
  checkOutAt: z
    .string()
    .or(z.date())
    .optional()
    .transform((val) => (val ? new Date(val) : undefined)),
  reason: z.string().min(3, 'Audit reason is required for staff manual attendance entries').trim(),
});
