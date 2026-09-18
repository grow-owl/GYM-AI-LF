import { Types } from 'mongoose';

export enum PlanStatus {
  ACTIVE = 'ACTIVE',
  COMPLETED = 'COMPLETED',
  ARCHIVED = 'ARCHIVED',
}

export interface IWorkoutPlanExercise {
  exerciseId: Types.ObjectId;
  order?: number;
  targetSets: number;
  targetReps: number;
  targetWeightKg?: number;
  restSeconds?: number;
  notes?: string;
}

export interface IWorkoutDay {
  dayLabel?: string;
  dayName?: string;
  exercises: IWorkoutPlanExercise[];
}

export interface IWorkoutPlan {
  _id: Types.ObjectId;
  gymId: Types.ObjectId;
  branchId?: Types.ObjectId;
  memberId: Types.ObjectId;
  createdBy?: Types.ObjectId;
  createdByTrainerId?: Types.ObjectId;
  title: string;
  description?: string;
  durationWeeks?: number;
  daysPerWeek?: number;
  goal?: string; // e.g. 'muscle_gain', 'fat_loss'
  days: IWorkoutDay[]; // supports split routines (Day 1, Day 2...)
  startDate?: Date;
  endDate?: Date;
  status?: PlanStatus;
  isActive?: boolean;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}
