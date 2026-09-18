import mongoose, { Schema, Model } from 'mongoose';

export interface IInvoiceCounter {
  scope: 'platform' | 'member';
  gymId?: mongoose.Types.ObjectId;
  year: number;
  seq: number;
}

const invoiceCounterSchema = new Schema<IInvoiceCounter>(
  {
    scope: {
      type: String,
      enum: ['platform', 'member'],
      required: true,
    },
    gymId: {
      type: Schema.Types.ObjectId,
      ref: 'Gym',
    },
    year: {
      type: Number,
      required: true,
    },
    seq: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

invoiceCounterSchema.index({ scope: 1, gymId: 1, year: 1 }, { unique: true });

export const InvoiceCounter: Model<IInvoiceCounter> = mongoose.model<IInvoiceCounter>(
  'InvoiceCounter',
  invoiceCounterSchema
);

/**
 * Concurrency-Safe Atomic Invoice Number Generator
 * Generates e.g. "PLT-2026-000001" or "GYM-2026-000001"
 */
export const generateNextInvoiceNumber = async (
  scope: 'platform' | 'member',
  gymId?: string
): Promise<string> => {
  const currentYear = new Date().getFullYear();
  const filter = {
    scope,
    gymId: gymId ? new mongoose.Types.ObjectId(gymId) : undefined,
    year: currentYear,
  };

  const counter = await InvoiceCounter.findOneAndUpdate(
    filter,
    { $inc: { seq: 1 } },
    { upsert: true, new: true, runValidators: true }
  );

  const prefix = scope === 'platform' ? 'PLT' : 'GYM';
  const paddedSeq = counter.seq.toString().padStart(6, '0');
  return `${prefix}-${currentYear}-${paddedSeq}`;
};

export const generatePlatformInvoiceNumber = (gymId?: string) =>
  generateNextInvoiceNumber('platform', gymId);

export const generateGymInvoiceNumber = (gymId?: string) =>
  generateNextInvoiceNumber('member', gymId);
