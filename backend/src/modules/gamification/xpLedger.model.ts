import mongoose, { Schema, Model } from 'mongoose';
import { IXpLedger } from './gamification.types';

const xpLedgerSchema = new Schema<IXpLedger>(
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
    amount: {
      type: Number,
      required: true,
    },
    reason: {
      type: String,
      required: true,
      trim: true,
    },
    earnedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

xpLedgerSchema.index({ memberId: 1, earnedAt: -1 });
xpLedgerSchema.index({ gymId: 1, earnedAt: -1 });

export const XpLedger: Model<IXpLedger> = mongoose.model<IXpLedger>(
  'XpLedger',
  xpLedgerSchema
);
