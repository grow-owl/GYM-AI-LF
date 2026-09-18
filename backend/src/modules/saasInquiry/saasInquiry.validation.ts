import { z } from 'zod';
import { SaasInquiryStatus } from './saasInquiry.types';

export const createSaasInquirySchema = z.object({
  ownerName: z.string().min(2, 'Owner name must be at least 2 characters').max(100),
  gymName: z.string().min(2, 'Gym name must be at least 2 characters').max(100),
  phone: z.string().min(8, 'Phone number must be at least 8 digits').max(15),
  city: z.string().max(100).optional().or(z.literal('')),
  email: z.string().email('Please enter a valid email').optional().or(z.literal('')),
  message: z.string().max(1000).optional().or(z.literal('')),
});

export const updateSaasInquiryStatusSchema = z.object({
  status: z.nativeEnum(SaasInquiryStatus),
  note: z.string().max(500).optional(),
  trialGymId: z.string().optional(),
});

export const addSaasInquiryNoteSchema = z.object({
  note: z.string().min(1, 'Note content cannot be empty').max(500),
});
