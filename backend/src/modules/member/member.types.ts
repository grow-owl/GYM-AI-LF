import { Types } from 'mongoose';

export enum MembershipStatus {
  ACTIVE = 'ACTIVE',
  EXPIRED = 'EXPIRED',
  FROZEN = 'FROZEN',
  CANCELLED = 'CANCELLED',
}

export interface IEmergencyContact {
  name: string;
  phone: string;
  relation: string;
}

export interface IHealthInfo {
  height_cm?: number;
  currentWeight_kg?: number;
  targetWeight_kg?: number;
  medicalConditions?: string[];
  injuries?: string[];
}

export interface IFreezeRecord {
  from: Date;
  to: Date;
  reason?: string;
  createdAt: Date;
}

export interface IMembershipRenewRecord {
  startDate: Date;
  endDate: Date;
  planName: string;
  renewedAt: Date;
}

export interface IMember {
  _id: Types.ObjectId;
  userId: Types.ObjectId; // ref User (role: MEMBER)
  gymId: Types.ObjectId;
  branchId: Types.ObjectId;
  assignedTrainerId?: Types.ObjectId; // ref Trainer
  membershipStatus: MembershipStatus;
  membershipStartDate: Date;
  membershipEndDate: Date;
  planName: string;
  emergencyContact?: IEmergencyContact;
  healthInfo?: IHealthInfo;
  fitnessGoals: string[];
  qrCode: string; // unique signed identifier for check-in
  dateOfBirth?: Date;
  referralCode?: string;
  referredByMemberId?: Types.ObjectId;
  currentStreakDays?: number;
  longestStreakDays?: number;
  lastCheckInDate?: Date;
  totalXpPoints?: number;
  gamificationLevel?: number;
  freezeHistory: IFreezeRecord[];
  membershipHistory: IMembershipRenewRecord[];
  joinedAt: Date;
  isDeleted: boolean;
  deletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}
