import mongoose, { Schema, Model } from 'mongoose';
import { IExercise, MuscleGroup } from './exercise.types';

const exerciseSchema = new Schema<IExercise>(
  {
    gymId: {
      type: Schema.Types.ObjectId,
      ref: 'Gym',
      index: true,
      // null means global system exercise
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    muscleGroup: {
      type: String,
      enum: Object.values(MuscleGroup),
      required: true,
      index: true,
    },
    equipment: {
      type: String,
      trim: true,
    },
    instructions: {
      type: String,
      trim: true,
    },
    videoUrl: {
      type: String,
      trim: true,
    },
    defaultSets: {
      type: Number,
      default: 3,
    },
    defaultReps: {
      type: Number,
      default: 10,
    },
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

exerciseSchema.index({ gymId: 1, muscleGroup: 1 });
exerciseSchema.index({ name: 'text' });

export const Exercise: Model<IExercise> = mongoose.model<IExercise>('Exercise', exerciseSchema);
