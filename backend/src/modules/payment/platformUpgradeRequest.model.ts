import mongoose, { Schema, Document } from 'mongoose';

export interface IPlatformUpgradeRequest {
  _id: mongoose.Types.ObjectId;
  gymId: mongoose.Types.ObjectId;
  requestedByUserId: mongoose.Types.ObjectId;
  currentPlan: string;
  requestedPlan: string;
  billingCycle?: string;
  status: 'PENDING' | 'RESOLVED';
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface PlatformUpgradeRequestDocument extends Omit<IPlatformUpgradeRequest, '_id'>, Document {}

const platformUpgradeRequestSchema = new Schema<PlatformUpgradeRequestDocument>(
  {
    gymId: {
      type: Schema.Types.ObjectId,
      ref: 'Gym',
      required: true,
      index: true,
    },
    requestedByUserId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    currentPlan: {
      type: String,
      required: true,
    },
    requestedPlan: {
      type: String,
      required: true,
    },
    billingCycle: {
      type: String,
      default: 'MONTHLY',
    },
    status: {
      type: String,
      enum: ['PENDING', 'RESOLVED'],
      default: 'PENDING',
      required: true,
      index: true,
    },
    notes: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

export const PlatformUpgradeRequest = mongoose.model<PlatformUpgradeRequestDocument>(
  'PlatformUpgradeRequest',
  platformUpgradeRequestSchema
);
