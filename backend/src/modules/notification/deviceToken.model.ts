import mongoose, { Schema, Model } from 'mongoose';
import { IDeviceToken } from './notification.types';

const deviceTokenSchema = new Schema<IDeviceToken>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    fcmToken: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    platform: {
      type: String,
      enum: ['ios', 'android', 'web'],
      required: true,
      default: 'android',
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    lastUsedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

deviceTokenSchema.index({ userId: 1, isActive: 1 });

export const DeviceToken: Model<IDeviceToken> = mongoose.model<IDeviceToken>(
  'DeviceToken',
  deviceTokenSchema
);
