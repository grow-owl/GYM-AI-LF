import { Types } from 'mongoose';

export interface ICertification {
  name: string;
  issuedBy: string;
  year: number;
}

export interface ITrainer {
  _id: Types.ObjectId;
  userId: Types.ObjectId; // ref User (role: TRAINER)
  gymId: Types.ObjectId;
  branchId: Types.ObjectId;
  specializations: string[]; // e.g. ['strength', 'yoga', 'nutrition']
  bio?: string;
  certifications?: ICertification[];
  maxMemberCapacity?: number; // optional cap on assigned members
  isDeleted: boolean;
  deletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}
