import mongoose, { Schema, Model } from 'mongoose';
import { IWeightEntry } from './progress.types';

const weightEntrySchema = new Schema<IWeightEntry>(
  {
    memberId: {
      type: Schema.Types.ObjectId,
      ref: 'Member',
      required: true,
      index: true,
    },
    gymId: {
      type: Schema.Types.ObjectId,
      ref: 'Gym',
      required: true,
      index: true,
    },
    weightKg: {
      type: Number,
      required: true,
    },
    recordedAt: {
      type: Date,
      default: Date.now,
    },
    dayKey: {
      type: String,
      required: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// One weight entry per member per day (upsert target)
weightEntrySchema.index({ memberId: 1, dayKey: 1 }, { unique: true });

export const WeightEntry: Model<IWeightEntry> = mongoose.model<IWeightEntry>(
  'WeightEntry',
  weightEntrySchema
);
