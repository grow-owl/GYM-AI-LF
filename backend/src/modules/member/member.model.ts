import mongoose, { Schema, Model } from 'mongoose';
import { IMember, MembershipStatus } from './member.types';

const memberSchema = new Schema<IMember>(
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
    assignedTrainerId: {
      type: Schema.Types.ObjectId,
      ref: 'Trainer',
      index: true,
    },
    membershipStatus: {
      type: String,
      enum: Object.values(MembershipStatus),
      default: MembershipStatus.ACTIVE,
      index: true,
    },
    membershipStartDate: {
      type: Date,
      required: true,
    },
    membershipEndDate: {
      type: Date,
      required: true,
      index: true,
    },
    planName: {
      type: String,
      required: true,
      trim: true,
    },
    emergencyContact: {
      name: { type: String, trim: true },
      phone: { type: String, trim: true },
      relation: { type: String, trim: true },
    },
    healthInfo: {
      height_cm: { type: Number },
      currentWeight_kg: { type: Number },
      targetWeight_kg: { type: Number },
      medicalConditions: [{ type: String, trim: true }],
      injuries: [{ type: String, trim: true }],
    },
    fitnessGoals: [
      {
        type: String,
        trim: true,
      },
    ],
    qrCode: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    dateOfBirth: {
      type: Date,
      index: true,
    },
    referralCode: {
      type: String,
      trim: true,
      index: true,
    },
    referredByMemberId: {
      type: Schema.Types.ObjectId,
      ref: 'Member',
      index: true,
    },
    currentStreakDays: {
      type: Number,
      default: 0,
    },
    longestStreakDays: {
      type: Number,
      default: 0,
    },
    lastCheckInDate: {
      type: Date,
    },
    totalXpPoints: {
      type: Number,
      default: 0,
    },
    gamificationLevel: {
      type: Number,
      default: 1,
    },
    freezeHistory: [
      {
        from: { type: Date, required: true },
        to: { type: Date, required: true },
        reason: { type: String, trim: true },
        createdAt: { type: Date, default: Date.now },
      },
    ],
    membershipHistory: [
      {
        startDate: { type: Date, required: true },
        endDate: { type: Date, required: true },
        planName: { type: String, required: true, trim: true },
        renewedAt: { type: Date, default: Date.now },
      },
    ],
    joinedAt: {
      type: Date,
      default: Date.now,
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

memberSchema.index({ gymId: 1, branchId: 1, isDeleted: 1 });

export const Member: Model<IMember> = mongoose.model<IMember>('Member', memberSchema);
