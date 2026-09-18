import mongoose, { Schema, Model } from 'mongoose';
import { IDailyWellness } from './progress.types';

const dailyWellnessSchema = new Schema<IDailyWellness>(
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
    dayKey: {
      type: String,
      required: true,
      index: true,
    },
    waterIntakeMl: {
      type: Number,
    },
    sleepHours: {
      type: Number,
    },
    mood: {
      type: String,
      enum: ['great', 'good', 'okay', 'tired', 'stressed'],
    },
    meals: [
      {
        mealType: {
          type: String,
          enum: ['breakfast', 'lunch', 'dinner', 'snack'],
          required: true,
        },
        description: {
          type: String,
          required: true,
          trim: true,
        },
        calories: {
          type: Number,
        },
        loggedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
  },
  {
    timestamps: true,
  }
);

// One wellness document per member per day (upsert target)
dailyWellnessSchema.index({ memberId: 1, dayKey: 1 }, { unique: true });

export const DailyWellness: Model<IDailyWellness> = mongoose.model<IDailyWellness>(
  'DailyWellness',
  dailyWellnessSchema
);
