import mongoose, { Schema, Model } from 'mongoose';
import { IMemberGameStats, BadgeCode } from './gamification.types';

const badgeAwardSchema = new Schema(
  {
    code: {
      type: String,
      enum: Object.values(BadgeCode),
      required: true,
    },
    earnedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const memberGameStatsSchema = new Schema<IMemberGameStats>(
  {
    memberId: {
      type: Schema.Types.ObjectId,
      ref: 'Member',
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
    xp: {
      type: Number,
      default: 0,
      index: true,
    },
    level: {
      type: Number,
      default: 1,
    },
    currentStreak: {
      type: Number,
      default: 0,
      index: true,
    },
    longestStreak: {
      type: Number,
      default: 0,
    },
    lastActivityDayKey: {
      type: String,
    },
    badges: [badgeAwardSchema],
    restDays: {
      type: [Number],
      default: [],
      validate: {
        validator: (days: number[]) => days.every((d) => d >= 0 && d <= 6),
        message: 'restDays must be weekday numbers 0–6',
      },
    },
    streakGracePending: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

export const MemberGameStats: Model<IMemberGameStats> = mongoose.model<IMemberGameStats>(
  'MemberGameStats',
  memberGameStatsSchema
);
