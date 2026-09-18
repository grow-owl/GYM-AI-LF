import { z } from 'zod';
import { ExpenseCategory } from './expense.types';

export const createExpenseSchema = z.object({
  branchId: z.string().optional(),
  category: z.nativeEnum(ExpenseCategory),
  amount: z.number().positive('Amount must be positive'),
  description: z.string().min(2, 'Description must be at least 2 characters').trim(),
  expenseDate: z.string().datetime().or(z.date()).optional().default(() => new Date()),
  isRecurring: z.boolean().optional().default(false),
});

export const updateExpenseSchema = createExpenseSchema.partial();
