import { z } from 'zod';

export const createProductSchema = z.object({
  name: z.string().min(2, 'Product name must be at least 2 characters').trim(),
  category: z.enum(['supplement', 'merchandise', 'service_package', 'gear']),
  price: z.number().positive('Price must be greater than zero'),
  stockQuantity: z.number().int().nonnegative().optional(),
  isActive: z.boolean().optional().default(true),
});

export const updateProductSchema = createProductSchema.partial();

export const purchaseProductSchema = z.object({
  memberId: z.string().optional(), // required if initiated by staff for a member
  customerName: z.string().optional(),
  customerPhone: z.string().optional(),
  quantity: z.number().int().positive().optional().default(1),
  paymentMethod: z.enum(['cash', 'card', 'upi', 'bank_transfer']).optional().default('cash'),
  notes: z.string().optional(),
});
