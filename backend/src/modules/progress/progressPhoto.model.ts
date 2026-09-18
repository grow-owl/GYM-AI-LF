import mongoose, { Schema, Model } from 'mongoose';
import { IProgressPhoto } from './progress.types';

const progressPhotoSchema = new Schema<IProgressPhoto>(
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
    imageUrl: {
      type: String,
      required: true,
      trim: true,
    },
    cloudinaryPublicId: {
      type: String,
      trim: true,
    },
    angle: {
      type: String,
      enum: ['front', 'side', 'back'],
      default: 'front',
      required: true,
    },
    notes: {
      type: String,
      trim: true,
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

progressPhotoSchema.index({ memberId: 1, recordedAt: -1 });

export const ProgressPhoto: Model<IProgressPhoto> = mongoose.model<IProgressPhoto>(
  'ProgressPhoto',
  progressPhotoSchema
);
