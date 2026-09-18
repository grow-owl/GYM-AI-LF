import mongoose, { Schema, Model } from 'mongoose';
import { IGoalPrediction } from './aiCoach.types';

const goalPredictionSchema = new Schema<IGoalPrediction>(
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
    goalType: {
      type: String,
      required: true,
    },
    currentValue: {
      type: Number,
      required: true,
    },
    targetValue: {
      type: Number,
      required: true,
    },
    predictedAchievementDate: {
      type: Date,
    },
    confidence: {
      type: String,
      enum: ['low', 'medium', 'high'],
      required: true,
    },
    basedOnDataPoints: {
      type: Number,
      required: true,
    },
    explanation: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

goalPredictionSchema.index({ memberId: 1, goalType: 1 });

export const GoalPrediction: Model<IGoalPrediction> = mongoose.model<IGoalPrediction>(
  'GoalPrediction',
  goalPredictionSchema
);
