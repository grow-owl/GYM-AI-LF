import mongoose, { Schema, Model } from 'mongoose';
import { ISaasInquiry, SaasInquiryStatus } from './saasInquiry.types';

const saasInquiryNoteSchema = new Schema(
  {
    note: {
      type: String,
      required: true,
      trim: true,
    },
    addedByUserId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    addedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const saasInquirySchema = new Schema<ISaasInquiry>(
  {
    ownerName: {
      type: String,
      required: [true, 'Owner name is required'],
      trim: true,
      minlength: [2, 'Owner name must be at least 2 characters'],
      maxlength: [100, 'Owner name cannot exceed 100 characters'],
    },
    gymName: {
      type: String,
      required: [true, 'Gym name is required'],
      trim: true,
      minlength: [2, 'Gym name must be at least 2 characters'],
      maxlength: [100, 'Gym name cannot exceed 100 characters'],
    },
    phone: {
      type: String,
      required: [true, 'Phone number is required'],
      trim: true,
      index: true,
    },
    city: {
      type: String,
      required: [true, 'City is required'],
      trim: true,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
    },
    message: {
      type: String,
      trim: true,
      maxlength: [1000, 'Message cannot exceed 1000 characters'],
    },
    status: {
      type: String,
      enum: Object.values(SaasInquiryStatus),
      default: SaasInquiryStatus.NEW,
      index: true,
    },
    trialGymId: {
      type: Schema.Types.ObjectId,
      ref: 'Gym',
    },
    notes: [saasInquiryNoteSchema],
  },
  {
    timestamps: true,
  }
);

saasInquirySchema.index({ createdAt: -1 });

export const SaasInquiry: Model<ISaasInquiry> = mongoose.model<ISaasInquiry>('SaasInquiry', saasInquirySchema);
