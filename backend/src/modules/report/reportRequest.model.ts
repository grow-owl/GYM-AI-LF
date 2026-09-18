import mongoose, { Schema, Model } from 'mongoose';
import { IReportRequest } from './report.types';

const reportRequestSchema = new Schema<IReportRequest>(
  {
    gymId: {
      type: Schema.Types.ObjectId,
      ref: 'Gym',
      required: true,
      index: true,
    },
    requestedByUserId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    reportType: {
      type: String,
      enum: [
        'attendance',
        'workout_completion',
        'weight_change',
        'strength_growth',
        'ai_summary',
        'trainer_feedback',
        'revenue',
        'member_full_progress',
        'ATTENDANCE_SUMMARY',
        'REVENUE_COLLECTIONS',
        'MEMBER_CHURN_RISK',
        'TRAINER_PERFORMANCE',
      ],
      required: true,
    },
    scope: {
      branchId: { type: Schema.Types.ObjectId, ref: 'Branch' },
      memberId: { type: Schema.Types.ObjectId, ref: 'Member' },
    },
    periodStart: {
      type: Date,
      required: true,
    },
    periodEnd: {
      type: Date,
      required: true,
    },
    format: {
      type: String,
      enum: ['json', 'pdf', 'csv'],
      default: 'json',
    },
    status: {
      type: String,
      enum: ['PROCESSING', 'READY', 'FAILED'],
      default: 'PROCESSING',
    },
    fileUrl: {
      type: String,
    },
    reportData: {
      type: Schema.Types.Mixed,
    },
  },
  {
    timestamps: true,
  }
);

reportRequestSchema.index({ gymId: 1, status: 1 });

export const ReportRequest: Model<IReportRequest> = mongoose.model<IReportRequest>(
  'ReportRequest',
  reportRequestSchema
);
