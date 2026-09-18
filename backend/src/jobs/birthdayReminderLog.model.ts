import mongoose, { Schema, Document } from 'mongoose';

export interface IBirthdayReminderLog {
  _id: mongoose.Types.ObjectId;
  memberId: mongoose.Types.ObjectId;
  gymId: mongoose.Types.ObjectId;
  year: number;
  sentAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface BirthdayReminderLogDocument extends Omit<IBirthdayReminderLog, '_id'>, Document {}

const birthdayReminderLogSchema = new Schema<BirthdayReminderLogDocument>(
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
    year: {
      type: Number,
      required: true,
    },
    sentAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

birthdayReminderLogSchema.index({ memberId: 1, year: 1 }, { unique: true });

export const BirthdayReminderLog = mongoose.model<BirthdayReminderLogDocument>(
  'BirthdayReminderLog',
  birthdayReminderLogSchema
);
