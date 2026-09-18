import { Types } from 'mongoose';

export enum ExpenseCategory {
  RENT = 'RENT',
  UTILITIES = 'UTILITIES',
  SALARY = 'SALARY',
  EQUIPMENT_PURCHASE = 'EQUIPMENT_PURCHASE',
  MAINTENANCE = 'MAINTENANCE',
  MARKETING = 'MARKETING',
  OTHER = 'OTHER',
}

export interface IExpense {
  _id: Types.ObjectId;
  gymId: Types.ObjectId;
  branchId: Types.ObjectId;
  category: ExpenseCategory;
  amount: number;
  description: string;
  expenseDate: Date;
  recordedByUserId: Types.ObjectId;
  isRecurring: boolean;
  createdAt: Date;
  updatedAt: Date;
}
