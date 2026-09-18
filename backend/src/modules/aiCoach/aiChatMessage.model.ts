import mongoose, { Schema, Model } from 'mongoose';
import { IAIChatMessage } from './aiCoach.types';

const aiChatMessageSchema = new Schema<IAIChatMessage>(
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
    conversationId: {
      type: Schema.Types.ObjectId,
      ref: 'AIConversation',
      required: true,
      index: true,
    },
    role: {
      type: String,
      enum: ['user', 'assistant'],
      required: true,
    },
    content: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

aiChatMessageSchema.index({ conversationId: 1, createdAt: 1 });

export const AIChatMessage: Model<IAIChatMessage> = mongoose.model<IAIChatMessage>(
  'AIChatMessage',
  aiChatMessageSchema
);
