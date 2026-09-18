import mongoose, { Schema, Model } from 'mongoose';
import { IWorkoutPlan, PlanStatus } from './workoutPlan.types';

const workoutPlanExerciseSchema = new Schema(
  {
    exerciseId: {
      type: Schema.Types.ObjectId,
      ref: 'Exercise',
      required: true,
    },
    order: {
      type: Number,
      default: 1,
    },
    targetSets: {
      type: Number,
      required: true,
    },
    targetReps: {
      type: Number,
      required: true,
    },
    targetWeightKg: {
      type: Number,
    },
    restSeconds: {
      type: Number,
      default: 60,
    },
    notes: {
      type: String,
      trim: true,
    },
  },
  { _id: false }
);

const workoutDaySchema = new Schema(
  {
    dayLabel: {
      type: String,
      trim: true,
    },
    dayName: {
      type: String,
      trim: true,
    },
    exercises: [workoutPlanExerciseSchema],
  },
  { _id: false }
);

const workoutPlanSchema = new Schema<IWorkoutPlan>(
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
    },
    memberId: {
      type: Schema.Types.ObjectId,
      ref: 'Member',
      required: true,
      index: true,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    createdByTrainerId: {
      type: Schema.Types.ObjectId,
      ref: 'Trainer',
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    durationWeeks: {
      type: Number,
      default: 4,
    },
    daysPerWeek: {
      type: Number,
      default: 3,
    },
    goal: {
      type: String,
      trim: true,
    },
    days: [workoutDaySchema],
    startDate: {
      type: Date,
    },
    endDate: {
      type: Date,
    },
    status: {
      type: String,
      enum: Object.values(PlanStatus),
      default: PlanStatus.ACTIVE,
      index: true,
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
  },
  {
    timestamps: true,
  }
);

workoutPlanSchema.index({ memberId: 1, status: 1 });
workoutPlanSchema.index({ memberId: 1, isActive: 1 });
workoutPlanSchema.index({ gymId: 1, branchId: 1 });

export const WorkoutPlan: Model<IWorkoutPlan> = mongoose.model<IWorkoutPlan>(
  'WorkoutPlan',
  workoutPlanSchema
);
