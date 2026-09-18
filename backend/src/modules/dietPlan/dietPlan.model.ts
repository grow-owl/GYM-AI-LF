import mongoose, { Schema, Model } from 'mongoose';
import { IDietPlan } from './dietPlan.types';
import { PlanStatus } from '../workout/workoutPlan.types';

const mealItemSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    quantity: {
      type: String,
      required: true,
      trim: true,
    },
    calories: {
      type: Number,
    },
    protein_g: {
      type: Number,
    },
  },
  { _id: false }
);

const mealSchema = new Schema(
  {
    mealType: {
      type: String,
      enum: ['breakfast', 'lunch', 'dinner', 'snack'],
      required: true,
    },
    items: [mealItemSchema],
    notes: {
      type: String,
      trim: true,
    },
  },
  { _id: false }
);

const dietPlanSchema = new Schema<IDietPlan>(
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
    createdByTrainerId: {
      type: Schema.Types.ObjectId,
      ref: 'Trainer',
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    dailyCalorieTarget: {
      type: Number,
    },
    dailyProteinTarget_g: {
      type: Number,
    },
    meals: [mealSchema],
    startDate: {
      type: Date,
      required: true,
    },
    endDate: {
      type: Date,
    },
    status: {
      type: String,
      enum: Object.values(PlanStatus),
      default: PlanStatus.ACTIVE,
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

dietPlanSchema.index({ memberId: 1, status: 1 });

export const DietPlan: Model<IDietPlan> = mongoose.model<IDietPlan>('DietPlan', dietPlanSchema);
