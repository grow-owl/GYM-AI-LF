import { Types } from 'mongoose';
import { PaymentStatus } from './platformSubscription.types';

export type PaymentPurpose = 'membership_fee' | 'personal_training' | 'merchandise' | 'other';
export type PaymentMethod = 'cash' | 'card' | 'upi' | 'bank_transfer' | 'online';

export interface IMemberPayment {
  _id: Types.ObjectId;
  gymId: Types.ObjectId;
  branchId: Types.ObjectId;
  memberId: Types.ObjectId;
  amount: number;
  currency: string;
  purpose: PaymentPurpose;
  method: PaymentMethod;
  status: PaymentStatus;
  gatewayPaymentId?: string;
  gatewayOrderId?: string;
  recordedByUserId: Types.ObjectId;
  relatedMembershipRenewal?: boolean;
  invoiceNumber: string; // e.g. "GYM-2026-000001"
  paidAt: Date;
  customerName?: string;
  notes?: string;
  refundedAmount?: number;
  refundReason?: string;
  refundedAt?: Date;
  isDeleted?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface RevenueSummaryItem {
  date: string;
  totalRevenue: number;
  count: number;
}

export interface RevenueSummary {
  totalRevenue: number;
  totalTransactions: number;
  breakdown: RevenueSummaryItem[];
}
