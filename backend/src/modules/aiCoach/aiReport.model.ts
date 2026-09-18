import mongoose, { Schema, Model } from 'mongoose';
import { IAIReport, AIProvider, AIReportType } from './aiCoach.types';

const aiReportSchema = new Schema<IAIReport>(
  {
    memberId: {
      type: Schema.Types.ObjectId,
      ref: 'Member',
      required: true,
      index: true,
    },
    gymId: {
      type: Schema.Types.ObjectId,
      ref: 'Gym',
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: Object.values(AIReportType),
      required: true,
    },
    periodStart: {
      type: Date,
      required: true,
    },
    periodEnd: {
      type: Date,
      required: true,
    },
    summary: {
      type: String,
      required: true,
    },
    metrics: {
      attendanceRate: { type: Number, required: true },
      workoutCompletionRate: { type: Number, required: true },
      avgSleepHours: { type: Number },
      avgWaterIntakeMl: { type: Number },
      weightChangeKg: { type: Number },
      recoveryScore: { type: Number },
      recoveryCategory: { type: String },
    },
    insights: [{ type: String }],
    recommendations: [{ type: String }],
    plateauDetected: {
      type: Boolean,
      default: false,
    },
    injuryRiskFlag: {
      type: Boolean,
      default: false,
    },
    injuryRiskReason: {
      type: String,
    },
    generatedByProvider: {
      type: String,
      enum: Object.values(AIProvider),
      default: AIProvider.OPENAI,
    },
  },
  {
    timestamps: true,
  }
);

aiReportSchema.index({ memberId: 1, type: 1, periodStart: -1 });

export const AIReport: Model<IAIReport> = mongoose.model<IAIReport>('AIReport', aiReportSchema);
