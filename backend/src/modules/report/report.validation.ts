import { z } from 'zod';

export const generateReportSchema = z.object({
  reportType: z.string(),
  scope: z.any().optional(),
  periodStart: z.string().or(z.date()).optional().transform((val) => (val ? new Date(val) : new Date())),
  periodEnd: z.string().or(z.date()).optional().transform((val) => (val ? new Date(val) : new Date())),
  format: z.string().optional().default('csv'),
});
