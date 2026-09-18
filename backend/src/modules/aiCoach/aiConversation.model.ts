import mongoose, { Schema, Model } from 'mongoose';
import { IAIConversation } from './aiCoach.types';

const aiConversationSchema = new Schema<IAIConversation>(
  {
    memberId: {
      type: Schema.Types.ObjectId,
      ref: 'Member',
      required: false,
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: false,
      index: true,
    },
    trainerId: {
      type: Schema.Types.ObjectId,
      ref: 'Trainer',
      required: false,
      index: true,
    },
    gymId: {
      type: Schema.Types.ObjectId,
      ref: 'Gym',
      required: true,
      index: true,
    },
    title: {
      type: String,
      trim: true,
    },
    lastMessageAt: {
      type: Date,
      default: Date.now,
    },
    isArchived: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

aiConversationSchema.index({ memberId: 1, lastMessageAt: -1 });
aiConversationSchema.index({ userId: 1, isArchived: 1, lastMessageAt: -1 });

export const AIConversation: Model<IAIConversation> = mongoose.model<IAIConversation>(
  'AIConversation',
  aiConversationSchema
);
