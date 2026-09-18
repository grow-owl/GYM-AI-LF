import { z } from 'zod';
import { NotificationType } from './notification.types';

export const registerDeviceTokenSchema = z.object({
  fcmToken: z.string().min(5, 'fcmToken is required').trim(),
  platform: z.enum(['ios', 'android', 'web']).optional().default('android'),
});

export const deactivateDeviceTokenSchema = z.object({
  fcmToken: z.string().min(5, 'fcmToken is required').trim(),
});

export const sendBroadcastSchema = z.object({
  branchId: z.string().optional(),
  title: z.string().min(1, 'Announcement title is required').trim(),
  body: z.string().min(1, 'Announcement body is required').trim(),
});

export const notificationFilterQuerySchema = z.object({
  isRead: z.enum(['true', 'false']).transform((val) => val === 'true').optional(),
  type: z.nativeEnum(NotificationType).optional(),
});
