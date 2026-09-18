import { Types } from 'mongoose';

export interface IDashboardOverview {
  totalActiveMembers: number;
  totalTrainers: number;
  todayCheckIns: number;
  revenueThisMonth: number;
  membershipsExpiringIn7Days: number;
  avgAttendanceRate30d: number; // % of active members who checked in at least once in last 30d
}

export interface IExpiringMembershipItem {
  memberId: string;
  fullName: string;
  email: string;
  phone: string;
  membershipStatus: string;
  membershipPlan: string;
  membershipEndDate: Date;
  daysUntilExpiry: number;
  lastPaymentAmount?: number;
  lastPaymentDate?: Date;
  branchName?: string;
}

export type ReportType =
  | 'attendance'
  | 'workout_completion'
  | 'weight_change'
  | 'strength_growth'
  | 'ai_summary'
  | 'trainer_feedback'
  | 'revenue'
  | 'member_full_progress'
  | 'ATTENDANCE_SUMMARY'
  | 'REVENUE_COLLECTIONS'
  | 'MEMBER_CHURN_RISK'
  | 'TRAINER_PERFORMANCE';

export type ReportFormat = 'json' | 'pdf' | 'csv';

export type ReportStatus = 'PROCESSING' | 'READY' | 'FAILED';

export interface IReportRequest {
  _id: Types.ObjectId;
  gymId: Types.ObjectId;
  requestedByUserId: Types.ObjectId;
  reportType: ReportType;
  scope: { branchId?: Types.ObjectId; memberId?: Types.ObjectId };
  periodStart: Date;
  periodEnd: Date;
  format: ReportFormat;
  status: ReportStatus;
  fileUrl?: string;
  reportData?: any;
  createdAt: Date;
  updatedAt: Date;
}
