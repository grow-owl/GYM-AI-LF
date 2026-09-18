import mongoose, { Document, Schema } from 'mongoose';

export interface IPlatformSettings extends Document {
  supportEmail: string;
  defaultTrialDays: number;
  platformCurrency: string;
  maintenanceMode: boolean;
  updatedBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const PlatformSettingsSchema = new Schema<IPlatformSettings>(
  {
    supportEmail: {
      type: String,
      required: true,
      default: 'support@gymai-saas.com',
      trim: true,
      lowercase: true,
    },
    defaultTrialDays: {
      type: Number,
      required: true,
      default: 14,
      min: 1,
      max: 90,
    },
    platformCurrency: {
      type: String,
      required: true,
      default: 'INR',
      trim: true,
      uppercase: true,
    },
    maintenanceMode: {
      type: Boolean,
      required: true,
      default: false,
    },
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  {
    timestamps: true,
  }
);

export const PlatformSettings = mongoose.model<IPlatformSettings>(
  'PlatformSettings',
  PlatformSettingsSchema
);
