import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IQRSession extends Document {
  _id: mongoose.Types.ObjectId;
  gymId: mongoose.Types.ObjectId;
  branchId: mongoose.Types.ObjectId;
  qrToken: string;
  isConsumed: boolean;
  consumedByMemberId?: mongoose.Types.ObjectId;
  expiresAt: Date;
  createdAt: Date;
}

const qrSessionSchema = new Schema<IQRSession>(
  {
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
    qrToken: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    isConsumed: {
      type: Boolean,
      default: false,
    },
    consumedByMemberId: {
      type: Schema.Types.ObjectId,
      ref: 'Member',
    },
    expiresAt: {
      type: Date,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// TTL index to automatically prune expired sessions from MongoDB
qrSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const QRSession: Model<IQRSession> = mongoose.model<IQRSession>(
  'QRSession',
  qrSessionSchema
);
