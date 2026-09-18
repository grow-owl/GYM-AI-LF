import mongoose, { Schema, Model } from 'mongoose';
import { IOwnerGymAccess } from './gym.types';

const ownerGymAccessSchema = new Schema<IOwnerGymAccess>(
  {
    ownerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    gymId: {
      type: Schema.Types.ObjectId,
      ref: 'Gym',
      required: true,
      index: true,
    },
    role: {
      type: String,
      enum: ['OWNER', 'MANAGER'],
      default: 'OWNER',
    },
  },
  {
    timestamps: true,
  }
);

// Compound index: An owner can only have one access entry per gym
ownerGymAccessSchema.index({ ownerId: 1, gymId: 1 }, { unique: true });

export const OwnerGymAccess: Model<IOwnerGymAccess> = mongoose.model<IOwnerGymAccess>(
  'OwnerGymAccess',
  ownerGymAccessSchema
);
