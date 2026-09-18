import mongoose, { Schema, Model } from 'mongoose';
import { IAttendance, AttendanceStatus } from './attendance.types';

const attendanceSchema = new Schema<IAttendance>(
  {
    gymId: {
      type: Schema.Types.ObjectId,
      ref: 'Gym',
      required: true,
      index: true,
    },
    branchId: {
      type: Schema.Types.ObjectId,
      ref: 'Branch',
      required: true,
      index: true,
    },
    memberId: {
      type: Schema.Types.ObjectId,
      ref: 'Member',
      required: true,
      index: true,
    },
    checkInAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
    checkOutAt: {
      type: Date,
    },
    durationMinutes: {
      type: Number,
    },
    status: {
      type: String,
      enum: Object.values(AttendanceStatus),
      default: AttendanceStatus.CHECKED_IN,
      index: true,
    },
    checkInSource: {
      type: String,
      enum: ['QR', 'MANUAL'],
      default: 'QR',
    },
    checkOutSource: {
      type: String,
      enum: ['QR', 'MANUAL', 'SYSTEM'],
    },
    dayKey: {
      type: String,
      required: true, // 'YYYY-MM-DD' in branch timezone
      index: true,
    },
    isAnomalous: {
      type: Boolean,
      default: false,
    },
    manualAuditReason: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

// Daily branch reports index
attendanceSchema.index({ gymId: 1, branchId: 1, dayKey: 1 });

// Streak calculation and member history index
attendanceSchema.index({ memberId: 1, dayKey: 1 });

// CRITICAL CONCURRENCY DEFENSE: Partial unique index for one-open-session invariant
attendanceSchema.index(
  { memberId: 1, status: 1 },
  {
    unique: true,
    partialFilterExpression: { status: AttendanceStatus.CHECKED_IN },
  }
);

export const Attendance: Model<IAttendance> = mongoose.model<IAttendance>(
  'Attendance',
  attendanceSchema
);
