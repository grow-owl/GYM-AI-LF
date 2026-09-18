import { z } from 'zod';

export const createFeedbackSchema = z.object({
  memberId: z.string({ required_error: 'Member ID is required' }),
  note: z.string().min(1, 'Feedback note cannot be empty'),
  rating: z.number().min(1).max(5).optional(),
  visibleToMember: z.boolean().optional().default(true),
  workoutLogId: z.string().optional(),
});

export const updateFeedbackSchema = z.object({
  note: z.string().min(1).optional(),
  rating: z.number().min(1).max(5).optional(),
  visibleToMember: z.boolean().optional(),
});
