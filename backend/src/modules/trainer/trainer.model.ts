import mongoose, { Schema, Model } from 'mongoose';
import { ITrainer } from './trainer.types';

const trainerSchema = new Schema<ITrainer>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
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
    specializations: [
      {
        type: String,
        trim: true,
      },
    ],
    bio: {
      type: String,
      trim: true,
    },
    certifications: [
      {
        name: { type: String, required: true, trim: true },
        issuedBy: { type: String, required: true, trim: true },
        year: { type: Number, required: true },
      },
    ],
    maxMemberCapacity: {
      type: Number,
    },
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

// Compound index for tenant-scoped trainer list queries
trainerSchema.index({ gymId: 1, branchId: 1, isDeleted: 1 });

export const Trainer: Model<ITrainer> = mongoose.model<ITrainer>('Trainer', trainerSchema);
