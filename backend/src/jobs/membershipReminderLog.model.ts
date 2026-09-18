import mongoose, { Schema, Document } from 'mongoose';

export interface IMembershipReminderLog {
  _id: mongoose.Types.ObjectId;
  memberId: mongoose.Types.ObjectId;
  gymId: mongoose.Types.ObjectId;
  tier: '7D' | '3D' | '1D' | 'EXPIRED' | 'PAYMENT_DUE' | 'MISSED_WORKOUT' | 'RENEWAL_OFFER';
  sentOn: string; // 'YYYY-MM-DD'
  sentAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface MembershipReminderLogDocument extends Omit<IMembershipReminderLog, '_id'>, Document {}

const membershipReminderLogSchema = new Schema<MembershipReminderLogDocument>(
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
    tier: {
      type: String,
      enum: ['7D', '3D', '1D', 'EXPIRED', 'PAYMENT_DUE', 'MISSED_WORKOUT', 'RENEWAL_OFFER'],
      required: true,
    },
    sentOn: {
      type: String,
      required: true,
    },
    sentAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

membershipReminderLogSchema.index({ memberId: 1, tier: 1, sentOn: 1 }, { unique: true });

export const MembershipReminderLog = mongoose.model<MembershipReminderLogDocument>(
  'MembershipReminderLog',
  membershipReminderLogSchema
);
