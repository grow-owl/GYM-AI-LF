import { Types } from 'mongoose';
import { PlanStatus } from '../workout/workoutPlan.types';

export interface IMealItem {
  name: string;
  quantity: string;
  calories?: number;
  protein_g?: number;
}

export interface IMeal {
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  items: IMealItem[];
  notes?: string;
}

export interface IDietPlan {
  _id: Types.ObjectId;
  gymId: Types.ObjectId;
  memberId: Types.ObjectId;
  createdByTrainerId: Types.ObjectId;
  title: string;
  dailyCalorieTarget?: number;
  dailyProteinTarget_g?: number;
  meals: IMeal[];
  startDate: Date;
  endDate?: Date;
  status: PlanStatus;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}
