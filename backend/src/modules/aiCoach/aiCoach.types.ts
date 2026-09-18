import { Types } from 'mongoose';

export enum AIProvider {
  OPENAI = 'OPENAI',
  GEMINI = 'GEMINI',
}

export enum AIReportType {
  WEEKLY = 'WEEKLY',
  MONTHLY = 'MONTHLY',
}

export interface IAIReport {
  _id: Types.ObjectId;
  memberId: Types.ObjectId;
  gymId: Types.ObjectId;
  type: AIReportType;
  periodStart: Date;
  periodEnd: Date;
  summary: string; // AI-generated natural language summary
  metrics: {
    attendanceRate: number; // % of expected days attended
    workoutCompletionRate: number;
    avgSleepHours?: number;
    avgWaterIntakeMl?: number;
    weightChangeKg?: number;
    recoveryScore?: number; // 0-100 scale readiness/recovery score
    recoveryCategory?: string; // e.g. "Optimal Recovery", "Good to Train", etc.
  };
  insights: string[]; // bullet-point AI observations
  recommendations: string[]; // actionable next steps
  plateauDetected: boolean;
  injuryRiskFlag: boolean;
  injuryRiskReason?: string;
  generatedByProvider: AIProvider;
  createdAt: Date;
}

export interface IAIChatMessage {
  _id: Types.ObjectId;
  memberId?: Types.ObjectId;
  userId?: Types.ObjectId;
  trainerId?: Types.ObjectId;
  gymId: Types.ObjectId;
  conversationId: Types.ObjectId;
  role: 'user' | 'assistant';
  content: string;
  createdAt: Date;
}

export interface IAIConversation {
  _id: Types.ObjectId;
  memberId?: Types.ObjectId;
  userId?: Types.ObjectId;
  trainerId?: Types.ObjectId;
  gymId: Types.ObjectId;
  title?: string; // auto-generated from first message
  lastMessageAt: Date;
  isArchived: boolean;
  createdAt: Date;
}

export interface IGoalPrediction {
  _id: Types.ObjectId;
  memberId: Types.ObjectId;
  gymId: Types.ObjectId;
  goalType: string; // e.g. 'target_weight'
  currentValue: number;
  targetValue: number;
  predictedAchievementDate?: Date;
  confidence: 'low' | 'medium' | 'high';
  basedOnDataPoints: number; // transparency
  explanation?: string;
  createdAt: Date;
}

export interface IChurnRiskAssessment {
  _id?: Types.ObjectId;
  memberId: Types.ObjectId;
  gymId: Types.ObjectId;
  branchId?: Types.ObjectId;
  riskLevel: 'low' | 'medium' | 'high';
  riskFactors: string[];
  daysSinceLastVisit: number;
  streakBrokenDaysAgo?: number;
  assessedAt: Date;
}

