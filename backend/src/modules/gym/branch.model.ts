import mongoose, { Schema, Model } from 'mongoose';
import { IBranch } from './gym.types';

const branchSchema = new Schema<IBranch>(
  {
    gymId: {
      type: Schema.Types.ObjectId,
      ref: 'Gym',
      required: [true, 'Gym ID is required'],
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Branch name is required'],
      trim: true,
      minlength: [2, 'Branch name must be at least 2 characters'],
      maxlength: [100, 'Branch name cannot exceed 100 characters'],
    },
    address: {
      line1: { type: String, required: true, trim: true },
      city: { type: String, required: true, trim: true },
      state: { type: String, required: true, trim: true },
      pincode: { type: String, required: true, trim: true },
      country: { type: String, required: true, trim: true },
      geo: {
        lat: { type: Number },
        lng: { type: Number },
      },
    },
    managerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },
    contactPhone: {
      type: String,
      required: [true, 'Contact phone number is required'],
      trim: true,
    },
    timezone: {
      type: String,
      required: [true, 'Timezone is required'],
      default: 'UTC', // e.g. "Asia/Kolkata", "America/New_York"
      trim: true,
    },
    location: {
      lat: { type: Number },
      lng: { type: Number },
      radiusMeters: { type: Number, default: 150 },
    },
    gpsVerificationEnabled: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: true,
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

// Compound index for tenant-scoped branch lists
branchSchema.index({ gymId: 1, isDeleted: 1 });

// Unique index: Branch name unique within a gym for active branches
branchSchema.index(
  { gymId: 1, name: 1 },
  { unique: true, partialFilterExpression: { isDeleted: false } }
);

export const Branch: Model<IBranch> = mongoose.model<IBranch>('Branch', branchSchema);
