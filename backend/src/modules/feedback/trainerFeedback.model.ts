import mongoose, { Schema, Model } from 'mongoose';
import { ITrainerFeedback } from './feedback.types';

const trainerFeedbackSchema = new Schema<ITrainerFeedback>(
  {
    gymId: {
      type: Schema.Types.ObjectId,
      ref: 'Gym',
      required: true,
      index: true,
    },
    memberId: {
      type: Schema.Types.ObjectId,
      ref: 'Member',
      required: true,
    },
    trainerId: {
      type: Schema.Types.ObjectId,
      ref: 'Trainer',
      required: true,
    },
    workoutLogId: {
      type: Schema.Types.ObjectId,
      ref: 'WorkoutLog',
    },
    note: {
      type: String,
      required: [true, 'Feedback note is required'],
      trim: true,
    },
    rating: {
      type: Number,
      min: 1,
      max: 5,
    },
    visibleToMember: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

trainerFeedbackSchema.index({ memberId: 1, createdAt: -1 });
trainerFeedbackSchema.index({ trainerId: 1 });

export const TrainerFeedback: Model<ITrainerFeedback> = mongoose.model<ITrainerFeedback>(
  'TrainerFeedback',
  trainerFeedbackSchema
);
