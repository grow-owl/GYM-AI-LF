import mongoose, { Schema, Model } from 'mongoose';
import { IChallenge } from './gamification.types';

const challengeParticipantSchema = new Schema(
  {
    memberId: {
      type: Schema.Types.ObjectId,
      ref: 'Member',
      required: true,
    },
    progress: {
      type: Number,
      default: 0,
    },
    completedAt: {
      type: Date,
    },
  },
  { _id: false }
);

const challengeSchema = new Schema<IChallenge>(
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
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    metric: {
      type: String,
      enum: ['workout_count', 'streak_days', 'total_minutes'],
      required: true,
    },
    targetValue: {
      type: Number,
      required: true,
    },
    startDate: {
      type: Date,
      required: true,
    },
    endDate: {
      type: Date,
      required: true,
      index: true,
    },
    rewardXp: {
      type: Number,
      required: true,
      default: 500,
    },
    participants: [challengeParticipantSchema],
  },
  {
    timestamps: true,
  }
);

challengeSchema.index({ gymId: 1, endDate: 1 });

export const Challenge: Model<IChallenge> = mongoose.model<IChallenge>(
  'Challenge',
  challengeSchema
);
