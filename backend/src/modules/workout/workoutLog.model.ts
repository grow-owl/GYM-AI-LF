import mongoose, { Schema, Model } from 'mongoose';
import { IWorkoutLog } from './workoutLog.types';

const loggedSetSchema = new Schema(
  {
    setNumber: {
      type: Number,
      required: true,
    },
    reps: {
      type: Number,
      required: true,
    },
    weightKg: {
      type: Number,
    },
    completed: {
      type: Boolean,
      default: false,
    },
  },
  { _id: false }
);

const loggedExerciseSchema = new Schema(
  {
    exerciseId: {
      type: Schema.Types.ObjectId,
      ref: 'Exercise',
      required: true,
    },
    sets: [loggedSetSchema],
    completedAt: {
      type: Date,
    },
  },
  { _id: false }
);

const workoutLogSchema = new Schema<IWorkoutLog>(
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
      index: true,
    },
    workoutPlanId: {
      type: Schema.Types.ObjectId,
      ref: 'WorkoutPlan',
    },
    attendanceId: {
      type: Schema.Types.ObjectId,
      ref: 'Attendance',
    },
    dayLabel: {
      type: String,
      trim: true,
    },
    // 0-based index into WorkoutPlan.days[] for this session (spec Section 2.3)
    dayIndex: {
      type: Number,
    },
    exercises: [loggedExerciseSchema],
    startedAt: {
      type: Date,
      default: Date.now,
    },
    completedAt: {
      type: Date,
    },
    totalDurationMinutes: {
      type: Number,
    },
    dayKey: {
      type: String,
      required: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

workoutLogSchema.index({ memberId: 1, dayKey: 1 });
workoutLogSchema.index({ workoutPlanId: 1 });

export const WorkoutLog: Model<IWorkoutLog> = mongoose.model<IWorkoutLog>(
  'WorkoutLog',
  workoutLogSchema
);
