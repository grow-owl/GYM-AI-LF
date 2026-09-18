import { Types } from 'mongoose';

export interface ITrainerFeedback {
  _id: Types.ObjectId;
  gymId: Types.ObjectId;
  memberId: Types.ObjectId;
  trainerId: Types.ObjectId;
  workoutLogId?: Types.ObjectId;
  note: string;
  rating?: number; // 1-5
  visibleToMember: boolean;
  createdAt: Date;
  updatedAt: Date;
}
