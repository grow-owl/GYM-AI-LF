import { Types } from 'mongoose';
import { Role } from '../../common/constants/roles.enum';

export { Role };

export interface IUser {
  _id: Types.ObjectId;
  fullName: string;
  email: string;
  phone: string;
  password: string; // hashed, select: false by default
  role: Role;
  gymId?: Types.ObjectId; // null for SUPER_ADMIN; required for others
  branchId?: Types.ObjectId; // required for BRANCH_MANAGER/TRAINER/MEMBER, optional for GYM_OWNER
  referredByMemberId?: Types.ObjectId;
  avatarUrl?: string;
  isActive: boolean;
  isEmailVerified: boolean;
  passwordResetToken?: string;
  passwordResetExpires?: Date;
  lastLoginAt?: Date;
  failedLoginAttempts: number;
  lockUntil?: Date;
  isDeleted: boolean;
  deletedAt?: Date;
  deletionRequestedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  comparePassword(candidate: string): Promise<boolean>;
  isLocked(): boolean;
  toSafeJSON(): Omit<IUser, 'password' | 'comparePassword' | 'isLocked'>;
}

export type SafeUser = Omit<IUser, 'password' | 'comparePassword' | 'isLocked'>;
