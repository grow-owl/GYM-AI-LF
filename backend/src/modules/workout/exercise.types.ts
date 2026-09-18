import { Types } from 'mongoose';

export enum MuscleGroup {
  CHEST = 'CHEST',
  BACK = 'BACK',
  LEGS = 'LEGS',
  SHOULDERS = 'SHOULDERS',
  ARMS = 'ARMS',
  CORE = 'CORE',
  FULL_BODY = 'FULL_BODY',
  CARDIO = 'CARDIO',
}

export interface IExercise {
  _id: Types.ObjectId;
  gymId?: Types.ObjectId; // null = global/system exercise library, set = gym-custom exercise
  name: string;
  muscleGroup: MuscleGroup;
  equipment?: string;
  instructions?: string;
  videoUrl?: string; // Cloudinary or video URL
  defaultSets?: number;
  defaultReps?: number;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}
