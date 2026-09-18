import { Types } from 'mongoose';

export enum AttendanceStatus {
  CHECKED_IN = 'CHECKED_IN',
  CHECKED_OUT = 'CHECKED_OUT',
  AUTO_CLOSED = 'AUTO_CLOSED',
}

export type CheckInSource = 'QR' | 'MANUAL';
export type CheckOutSource = 'QR' | 'MANUAL' | 'SYSTEM';

export interface IAttendance {
  _id: Types.ObjectId;
  gymId: Types.ObjectId;
  branchId: Types.ObjectId;
  memberId: Types.ObjectId; // ref Member
  checkInAt: Date;
  checkOutAt?: Date;
  durationMinutes?: number; // computed on checkout
  status: AttendanceStatus;
  checkInSource: CheckInSource;
  checkOutSource?: CheckOutSource;
  dayKey: string; // 'YYYY-MM-DD' in BRANCH timezone
  isAnomalous?: boolean;
  manualAuditReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface AttendanceStats {
  totalVisits: number;
  totalWorkoutMinutes: number;
  averageSessionMinutes: number;
  dayOfWeekDistribution: Record<string, number>;
  currentStreak?: number;
  longestStreak?: number;
}
