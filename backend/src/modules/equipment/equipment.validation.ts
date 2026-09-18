import { z } from 'zod';
import { EquipmentStatus } from './equipment.types';

export const createEquipmentSchema = z.object({
  name: z.string().min(2, 'Equipment name must be at least 2 characters').trim(),
  category: z.string().min(2, 'Category is required').trim(),
  status: z.nativeEnum(EquipmentStatus).optional().default(EquipmentStatus.WORKING),
  purchaseDate: z.string().datetime().or(z.date()).optional(),
  lastServicedDate: z.string().datetime().or(z.date()).optional(),
  nextServiceDueDate: z.string().datetime().or(z.date()).optional(),
  notes: z.string().optional(),
  branchId: z.string().optional(),
});

export const updateEquipmentSchema = createEquipmentSchema.partial();
