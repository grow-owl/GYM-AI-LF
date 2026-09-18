import { Types } from 'mongoose';

export enum GymPlan {
  TRIAL = 'TRIAL',
  BASIC = 'BASIC',
  PRO = 'PRO',
  ENTERPRISE = 'ENTERPRISE',
}

export enum GymStatus {
  ACTIVE = 'ACTIVE',
  TRIAL_EXPIRED = 'TRIAL_EXPIRED',
  SUSPENDED = 'SUSPENDED',
  CANCELLED = 'CANCELLED',
}

export interface IGymSettings {
  defaultTrialPassDays?: number;
}

export interface IGymMembershipPlan {
  id: string;
  name: string;
  durationMonths: number;
  price: number;
  badge?: string;
  description: string;
  isActive?: boolean;
}

export interface IGym {
  _id: Types.ObjectId;
  name: string;
  ownerId: Types.ObjectId; // ref User (role: GYM_OWNER)
  logoUrl?: string;
  plan: GymPlan;
  status: GymStatus;
  trialEndsAt?: Date;
  subscriptionExpiresAt?: Date;
  billingEmail: string;
  isMultiBranch: boolean; // derived/settable flag for UI convenience
  settings?: IGymSettings;
  membershipPlans?: IGymMembershipPlan[];
  isDeleted: boolean;
  deletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface IBranchAddress {
  line1: string;
  city: string;
  state: string;
  pincode: string;
  country: string;
  geo?: {
    lat: number;
    lng: number;
  };
}

export interface IBranch {
  _id: Types.ObjectId;
  gymId: Types.ObjectId; // ref Gym
  name: string;
  address: IBranchAddress;
  managerId?: Types.ObjectId; // ref User (role: BRANCH_MANAGER)
  contactPhone: string;
  timezone: string; // IANA tz (e.g. "Asia/Kolkata", "America/New_York")
  location?: {
    lat: number;
    lng: number;
    radiusMeters: number;
  };
  gpsVerificationEnabled?: boolean;
  isPrimary?: boolean;
  isActive: boolean;
  isDeleted: boolean;
  deletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface IOwnerGymAccess {
  _id: Types.ObjectId;
  ownerId: Types.ObjectId;
  gymId: Types.ObjectId;
  role: 'OWNER' | 'MANAGER';
  createdAt: Date;
  updatedAt: Date;
}

// Plan Branch Limit Mapping Constants
export const PLAN_BRANCH_LIMITS: Record<GymPlan, number> = {
  [GymPlan.TRIAL]: 2,
  [GymPlan.BASIC]: 1,
  [GymPlan.PRO]: 5,
  [GymPlan.ENTERPRISE]: Infinity,
};
