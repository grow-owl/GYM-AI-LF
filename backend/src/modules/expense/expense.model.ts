import mongoose, { Schema, Document } from 'mongoose';
import { IExpense, ExpenseCategory } from './expense.types';

export interface ExpenseDocument extends Omit<IExpense, '_id'>, Document {}

const expenseSchema = new Schema<ExpenseDocument>(
  {
    gymId: {
      type: Schema.Types.ObjectId,
      ref: 'Gym',
      required: true,
      index: true,
    },
    branchId: {
      type: Schema.Types.ObjectId,
      ref: 'Branch',
      required: true,
      index: true,
    },
    category: {
      type: String,
      enum: Object.values(ExpenseCategory),
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    expenseDate: {
      type: Date,
      required: true,
      default: Date.now,
    },
    recordedByUserId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    isRecurring: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

expenseSchema.index({ gymId: 1, branchId: 1, expenseDate: -1 });
expenseSchema.index({ gymId: 1, category: 1 });

export const Expense = mongoose.model<ExpenseDocument>('Expense', expenseSchema);
