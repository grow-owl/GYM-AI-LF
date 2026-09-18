import { Types } from 'mongoose';

export enum NotificationType {
  MEMBERSHIP_EXPIRING = 'MEMBERSHIP_EXPIRING',
  MEMBERSHIP_EXPIRING_7D = 'MEMBERSHIP_EXPIRING_7D',
  MEMBERSHIP_EXPIRING_3D = 'MEMBERSHIP_EXPIRING_3D',
  MEMBERSHIP_EXPIRING_1D = 'MEMBERSHIP_EXPIRING_1D',
  MEMBERSHIP_EXPIRED = 'MEMBERSHIP_EXPIRED',
  PAYMENT_DUE = 'PAYMENT_DUE',
  MISSED_WORKOUT = 'MISSED_WORKOUT',
  PAYMENT_SUCCESS = 'PAYMENT_SUCCESS',
  PAYMENT_FAILED = 'PAYMENT_FAILED',
  STREAK_MILESTONE = 'STREAK_MILESTONE',
  BADGE_EARNED = 'BADGE_EARNED',
  WORKOUT_ASSIGNED = 'WORKOUT_ASSIGNED',
  AI_REPORT_READY = 'AI_REPORT_READY',
  CHALLENGE_INVITE = 'CHALLENGE_INVITE',
  PASSWORD_RESET = 'PASSWORD_RESET',
  TRAINER_MESSAGE = 'TRAINER_MESSAGE',
  WELCOME_NEW_MEMBER = 'WELCOME_NEW_MEMBER',
  RENEWAL_DISCOUNT_OFFER = 'RENEWAL_DISCOUNT_OFFER',
  REFERRAL_ASK = 'REFERRAL_ASK',
  BIRTHDAY_WISH = 'BIRTHDAY_WISH',
  NEW_MEMBER_ASSIGNED = 'NEW_MEMBER_ASSIGNED',
  PLATFORM_UPGRADE_REQUESTED = 'PLATFORM_UPGRADE_REQUESTED',
  RECOVERY_ALERT = 'RECOVERY_ALERT',
  GENERIC = 'GENERIC',
}

export interface IDeviceToken {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  fcmToken: string;
  platform: 'ios' | 'android' | 'web';
  isActive: boolean;
  lastUsedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface INotification {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  gymId: Types.ObjectId;
  type: NotificationType;
  title: string;
  body: string;
  data?: Record<string, string>; // deep-link payload
  isRead: boolean;
  readAt?: Date;
  deliveryStatus: 'PENDING' | 'SENT' | 'FAILED';
  createdAt: Date;
  updatedAt: Date;
}
