import { Types } from 'mongoose';

export interface IWeightEntry {
  _id: Types.ObjectId;
  memberId: Types.ObjectId;
  gymId: Types.ObjectId;
  weightKg: number;
  recordedAt: Date;
  dayKey: string;
  createdAt: Date;
}

export interface IProgressPhoto {
  _id: Types.ObjectId;
  memberId: Types.ObjectId;
  gymId: Types.ObjectId;
  imageUrl: string; // Cloudinary
  cloudinaryPublicId?: string;
  angle: 'front' | 'side' | 'back';
  notes?: string;
  recordedAt: Date;
  dayKey: string;
  createdAt: Date;
}

export interface IDietMealLog {
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  description: string;
  calories?: number;
  loggedAt?: Date;
}

export interface IDailyWellness {
  _id: Types.ObjectId;
  memberId: Types.ObjectId;
  gymId: Types.ObjectId;
  dayKey: string; // 'YYYY-MM-DD'
  waterIntakeMl?: number;
  sleepHours?: number;
  mood?: 'great' | 'good' | 'okay' | 'tired' | 'stressed';
  meals?: IDietMealLog[];
  createdAt: Date;
  updatedAt: Date;
}

export interface ProgressSummary {
  currentWeight_kg?: number;
  targetWeight_kg?: number;
  weightDelta30Days_kg?: number;
  latestPhotos: {
    front?: string;
    side?: string;
    back?: string;
  };
  averageWater7Days_ml?: number;
  averageSleep7Days_hours?: number;
}
