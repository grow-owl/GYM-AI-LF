import mongoose, { Schema, Model } from 'mongoose';
import { IGym, GymPlan, GymStatus } from './gym.types';

const gymSchema = new Schema<IGym>(
  {
    name: {
      type: String,
      required: [true, 'Gym organization name is required'],
      trim: true,
      minlength: [2, 'Gym name must be at least 2 characters'],
      maxlength: [100, 'Gym name cannot exceed 100 characters'],
    },
    ownerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Owner ID is required'],
      index: true,
    },
    logoUrl: {
      type: String,
      trim: true,
    },
    plan: {
      type: String,
      enum: Object.values(GymPlan),
      default: GymPlan.TRIAL,
    },
    status: {
      type: String,
      enum: Object.values(GymStatus),
      default: GymStatus.ACTIVE,
      index: true,
    },
    trialEndsAt: {
      type: Date,
    },
    subscriptionExpiresAt: {
      type: Date,
    },
    billingEmail: {
      type: String,
      required: [true, 'Billing email address is required'],
      lowercase: true,
      trim: true,
    },
    isMultiBranch: {
      type: Boolean,
      default: false,
    },
    settings: {
      defaultTrialPassDays: {
        type: Number,
        default: 2,
        min: 1,
        max: 30,
      },
    },
    membershipPlans: [
      {
        id: { type: String, required: true },
        name: { type: String, required: true },
        durationMonths: { type: Number, required: true },
        price: { type: Number, required: true },
        badge: { type: String },
        description: { type: String },
        isActive: { type: Boolean, default: true },
      },
    ],
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },
    deletedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
gymSchema.index({ ownerId: 1, isDeleted: 1 });

export const Gym: Model<IGym> = mongoose.model<IGym>('Gym', gymSchema);
