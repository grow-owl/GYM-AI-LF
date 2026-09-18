import mongoose, { Schema, Document } from 'mongoose';
import { IChurnRiskAssessment } from './aiCoach.types';

export interface ChurnRiskAssessmentDocument extends Omit<IChurnRiskAssessment, '_id'>, Document {}

const churnRiskAssessmentSchema = new Schema<ChurnRiskAssessmentDocument>(
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
    branchId: {
      type: Schema.Types.ObjectId,
      ref: 'Branch',
    },
    riskLevel: {
      type: String,
      enum: ['low', 'medium', 'high'],
      required: true,
    },
    riskFactors: {
      type: [String],
      default: [],
    },
    daysSinceLastVisit: {
      type: Number,
      required: true,
    },
    streakBrokenDaysAgo: {
      type: Number,
    },
    assessedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

churnRiskAssessmentSchema.index({ gymId: 1, riskLevel: 1, assessedAt: -1 });

export const ChurnRiskAssessment = mongoose.model<ChurnRiskAssessmentDocument>(
  'ChurnRiskAssessment',
  churnRiskAssessmentSchema
);
