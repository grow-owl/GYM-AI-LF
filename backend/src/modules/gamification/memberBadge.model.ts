import mongoose, { Schema, Model } from 'mongoose';
import { BadgeCode } from './gamification.types';

export interface IMemberBadge {
  _id: mongoose.Types.ObjectId;
  memberId: mongoose.Types.ObjectId;
  gymId: mongoose.Types.ObjectId;
  badgeType: BadgeCode;
  createdAt: Date;
  updatedAt: Date;
}

const memberBadgeSchema = new Schema<IMemberBadge>(
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
    badgeType: {
      type: String,
      enum: Object.values(BadgeCode),
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Unique: one badge per member
memberBadgeSchema.index({ memberId: 1, badgeType: 1 }, { unique: true });

export const MemberBadge: Model<IMemberBadge> = mongoose.model<IMemberBadge>('MemberBadge', memberBadgeSchema);
