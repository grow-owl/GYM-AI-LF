import mongoose, { Schema, Model } from 'mongoose';
import { IPlatformSubscription, BillingCycle } from './platformSubscription.types';
import { GymPlan } from '../gym/gym.types';

const platformSubscriptionSchema = new Schema<IPlatformSubscription>(
  {
    gymId: {
      type: Schema.Types.ObjectId,
      ref: 'Gym',
      required: true,
      index: true,
    },
    plan: {
      type: String,
      enum: Object.values(GymPlan),
      required: true,
    },
    billingCycle: {
      type: String,
      enum: Object.values(BillingCycle),
      required: true,
      default: BillingCycle.MONTHLY,
    },
    amount: {
      type: Number,
      required: true,
    },
    currency: {
      type: String,
      default: 'INR',
    },
    gatewaySubscriptionId: {
      type: String,
      trim: true,
    },
    currentPeriodStart: {
      type: Date,
      required: true,
    },
    currentPeriodEnd: {
      type: Date,
      required: true,
    },
    autoRenew: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

export const PlatformSubscription: Model<IPlatformSubscription> =
  mongoose.model<IPlatformSubscription>('PlatformSubscription', platformSubscriptionSchema);
