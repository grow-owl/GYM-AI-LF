import { Types } from 'mongoose';

export enum SaasInquiryStatus {
  NEW = 'NEW',
  CONTACTED = 'CONTACTED',
  DEMO_SCHEDULED = 'DEMO_SCHEDULED',
  TRIAL_GIVEN = 'TRIAL_GIVEN',
  CONVERTED = 'CONVERTED',
  DISQUALIFIED = 'DISQUALIFIED',
}

export interface ISaasInquiryNote {
  note: string;
  addedByUserId?: Types.ObjectId;
  addedAt: Date;
}

export interface ISaasInquiry {
  _id: Types.ObjectId;
  ownerName: string;
  gymName: string;
  phone: string;
  city: string;
  email?: string;
  message?: string;
  status: SaasInquiryStatus;
  trialGymId?: Types.ObjectId;
  notes: ISaasInquiryNote[];
  createdAt: Date;
  updatedAt: Date;
}
