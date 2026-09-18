import { z } from 'zod';
import { AIReportType } from './aiCoach.types';

export const aiSuggestionsResponseSchema = z.object({
  insights: z.array(z.string()).default([]),
  recommendations: z.array(z.string()).default([]),
});

export const startConversationSchema = z.object({
  firstMessage: z.string().min(2, 'First message must be at least 2 characters').trim(),
});

export const sendMessageSchema = z.object({
  content: z.string().min(1, 'Message content is required').trim(),
});

export const generateReportQuerySchema = z.object({
  type: z.enum([AIReportType.WEEKLY, AIReportType.MONTHLY]).optional().default(AIReportType.WEEKLY),
});

export const goalPredictionQuerySchema = z.object({
  goalType: z.string().optional().default('target_weight'),
});

export const upsellRecommendationResponseSchema = z.object({
  eligible: z.boolean(),
  explanation: z.string().optional(),
  medicalDisclaimer: z.string().optional(),
  trainerNotice: z.string().optional(),
});

