import mongoose, { Schema, Model } from 'mongoose';
import { IPlatformInvoice, PaymentStatus } from './platformSubscription.types';
import { GymPlan } from '../gym/gym.types';

const platformInvoiceSchema = new Schema<IPlatformInvoice>(
  {
    gymId: {
      type: Schema.Types.ObjectId,
      ref: 'Gym',
      required: true,
      index: true,
    },
    subscriptionId: {
      type: Schema.Types.ObjectId,
      ref: 'PlatformSubscription',
    },
    amount: {
      type: Number,
      required: true,
    },
    currency: {
      type: String,
      default: 'INR',
    },
    status: {
      type: String,
      enum: Object.values(PaymentStatus),
      default: PaymentStatus.PENDING,
    },
    method: {
      type: String,
      enum: ['bank_transfer', 'upi', 'cheque', 'cash', 'other'],
      default: 'bank_transfer',
      required: true,
    },
    recordedByUserId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    transactionRef: {
      type: String,
      trim: true,
    },
    targetPlan: {
      type: String,
      enum: Object.values(GymPlan),
      default: GymPlan.PRO,
    },
    gatewayPaymentId: {
      type: String,
      trim: true,
    },
    gatewayOrderId: {
      type: String,
      trim: true,
    },
    invoiceNumber: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    periodStart: {
      type: Date,
      required: true,
    },
    periodEnd: {
      type: Date,
      required: true,
    },
    paidAt: {
      type: Date,
    },
    failureReason: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

platformInvoiceSchema.index({ gymId: 1, status: 1 });

export const PlatformInvoice: Model<IPlatformInvoice> = mongoose.model<IPlatformInvoice>(
  'PlatformInvoice',
  platformInvoiceSchema
);
