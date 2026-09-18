import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IRefreshToken extends Document {
  userId: mongoose.Types.ObjectId;
  tokenHash: string;
  expiresAt: Date;
  createdByIp: string;
  revoked: boolean;
  replacedByTokenHash?: string;
  createdAt: Date;
  updatedAt: Date;
}

const refreshTokenSchema = new Schema<IRefreshToken>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    tokenHash: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: { expires: 0 }, // TTL index for automatic expiration cleanup
    },
    createdByIp: {
      type: String,
    },
    revoked: {
      type: Boolean,
      default: false,
      index: true,
    },
    replacedByTokenHash: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

refreshTokenSchema.index({ userId: 1, revoked: 1 });


export const RefreshToken: Model<IRefreshToken> = mongoose.model<IRefreshToken>(
  'RefreshToken',
  refreshTokenSchema
);
