import mongoose, { Schema, Model } from 'mongoose';
import { IMemberPayment } from './memberPayment.types';
import { PaymentStatus } from './platformSubscription.types';

const memberPaymentSchema = new Schema<IMemberPayment>(
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
    memberId: {
      type: Schema.Types.ObjectId,
      ref: 'Member',
      required: true,
      index: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    currency: {
      type: String,
      default: 'INR',
    },
    purpose: {
      type: String,
      enum: ['membership_fee', 'personal_training', 'merchandise', 'other'],
      required: true,
    },
    method: {
      type: String,
      enum: ['cash', 'card', 'upi', 'bank_transfer', 'online'],
      required: true,
    },
    status: {
      type: String,
      enum: Object.values(PaymentStatus),
      default: PaymentStatus.PENDING,
    },
    gatewayPaymentId: {
      type: String,
      trim: true,
    },
    gatewayOrderId: {
      type: String,
      trim: true,
    },
    recordedByUserId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    customerName: {
      type: String,
      trim: true,
    },
    relatedMembershipRenewal: {
      type: Boolean,
      default: false,
    },
    invoiceNumber: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    paidAt: {
      type: Date,
      default: Date.now,
    },
    notes: {
      type: String,
      trim: true,
    },
    refundedAmount: {
      type: Number,
    },
    refundReason: {
      type: String,
      trim: true,
    },
    refundedAt: {
      type: Date,
    },
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

memberPaymentSchema.index({ gymId: 1, branchId: 1, paidAt: -1 });

export const MemberPayment: Model<IMemberPayment> = mongoose.model<IMemberPayment>(
  'MemberPayment',
  memberPaymentSchema
);
