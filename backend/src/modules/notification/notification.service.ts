import mongoose from 'mongoose';
import { Notification } from './notification.model';
import { DeviceTokenService } from './deviceToken.service';
import { firebaseMessaging } from '../../config/firebase';
import { Member } from '../member/member.model';
import { INotification, NotificationType } from './notification.types';
import { AppError } from '../../common/utils/AppError';
import { getPaginationParams, buildPaginationMeta, ParsedPagination } from '../../common/utils/pagination';
import { logger } from '../../config/logger';

export class NotificationService {
  /**
   * Send Notification to User (In-App Persistence First + FCM Push)
   */
  public static async sendToUser(
    userId: string,
    gymId: string | undefined | null,
    type: NotificationType,
    title: string,
    body: string,
    data?: Record<string, string>
  ): Promise<INotification> {
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      logger.warn(`Skipping notification to invalid userId: ${userId}`);
      return null as any;
    }
    const userObjectId = new mongoose.Types.ObjectId(userId);
    const gymObjectId = gymId && mongoose.Types.ObjectId.isValid(gymId) ? new mongoose.Types.ObjectId(gymId) : undefined;

    // 1. Persist INotification record FIRST (In-App History)
    const notification = new Notification({
      userId: userObjectId,
      gymId: gymObjectId,
      type,
      title,
      body,
      data,
      isRead: false,
      deliveryStatus: 'PENDING',
    });

    await notification.save();

    // 2. Fetch Active Device Tokens
    const activeTokens = await DeviceTokenService.getActiveTokensForUser(userId);
    if (activeTokens.length === 0) {
      notification.deliveryStatus = 'FAILED';
      await notification.save();
      logger.info(`ℹ️ No active FCM device tokens for User ${userId}. In-app notification created.`);
      return notification;
    }

    const tokenStrings = activeTokens.map((t) => t.fcmToken);

    // 3. Multicast Push Delivery via Firebase Admin SDK
    if (firebaseMessaging) {
      try {
        const response = await firebaseMessaging.sendEachForMulticast({
          tokens: tokenStrings,
          notification: { title, body },
          data,
        });

        let successCount = 0;
        for (let i = 0; i < response.responses.length; i++) {
          const res = response.responses[i];
          const token = tokenStrings[i];

          if (res.success) {
            successCount++;
          } else if (res.error) {
            const errorCode = res.error.code;
            if (
              errorCode === 'messaging/registration-token-not-registered' ||
              errorCode === 'messaging/invalid-registration-token'
            ) {
              await DeviceTokenService.deactivateDeviceToken(token);
            }
          }
        }

        notification.deliveryStatus = successCount > 0 ? 'SENT' : 'FAILED';
        await notification.save();
      } catch (error) {
        logger.error(`Failed FCM multicast send for User ${userId}: ${error}`);
        notification.deliveryStatus = 'FAILED';
        await notification.save();
      }
    } else {
      // Mock push delivery in dev / test mode
      notification.deliveryStatus = 'SENT';
      await notification.save();
      logger.info(`🔔 Mock FCM Push sent to User ${userId}: "${title}"`);
    }

    return notification;
  }

  /**
   * Send Notification to Multiple Users (Multicast Chunked Batching)
   */
  public static async sendToUsers(
    userIds: string[],
    gymId: string,
    type: NotificationType,
    title: string,
    body: string,
    data?: Record<string, string>
  ): Promise<number> {
    const chunkSize = 500;
    let sentCount = 0;

    for (let i = 0; i < userIds.length; i += chunkSize) {
      const chunk = userIds.slice(i, i + chunkSize);
      await Promise.all(
        chunk.map((userId) => this.sendToUser(userId, gymId, type, title, body, data))
      );
      sentCount += chunk.length;
    }

    return sentCount;
  }

  /**
   * Broadcast Announcement to Gym / Branch Members (Staff Action)
   */
  public static async sendToGymBroadcast(
    gymId: string,
    branchId?: string,
    title: string = 'Gym Announcement',
    body: string = ''
  ): Promise<number> {
    const filter: Record<string, unknown> = {
      gymId: new mongoose.Types.ObjectId(gymId),
      isDeleted: false,
    };
    if (branchId) filter.branchId = new mongoose.Types.ObjectId(branchId);

    const members = await Member.find(filter).select('userId');
    const userIds = members.map((m) => m.userId.toString());

    if (userIds.length === 0) return 0;

    return this.sendToUsers(userIds, gymId, NotificationType.GENERIC, title, body);
  }

  /**
   * Get Notification History for Logged-In User
   */
  public static async getNotificationHistory(
    userId: string,
    filters: { isRead?: boolean; type?: NotificationType } = {},
    options: { page?: number | string; limit?: number | string } = {}
  ): Promise<{ notifications: INotification[]; meta: ReturnType<typeof buildPaginationMeta> }> {
    const { page, limit, skip }: ParsedPagination = getPaginationParams(options);
    const userObjectId = new mongoose.Types.ObjectId(userId);

    // Auto-seed sample welcome notifications for user if they have zero notification history in DB
    const existingCount = await Notification.countDocuments({ userId: userObjectId });
    if (existingCount === 0) {
      const userDoc = await Member.findOne({ userId: userObjectId }).select('gymId');
      const gymObjectId = userDoc?.gymId || new mongoose.Types.ObjectId();
      await Notification.insertMany([
        {
          userId: userObjectId,
          gymId: gymObjectId,
          type: NotificationType.GENERIC,
          title: 'Welcome to GYMAI System 👋',
          body: 'Your account is active. Explore workouts, track attendance, and manage your gym profile seamlessly.',
          isRead: false,
          deliveryStatus: 'SENT',
        },
        {
          userId: userObjectId,
          gymId: gymObjectId,
          type: NotificationType.MEMBERSHIP_EXPIRING,
          title: 'Membership Status Active',
          body: 'Your membership is active and up to date. Keep pushing your fitness goals!',
          isRead: false,
          deliveryStatus: 'SENT',
        },
        {
          userId: userObjectId,
          gymId: gymObjectId,
          type: NotificationType.GENERIC,
          title: 'Daily Fitness Goal',
          body: 'Remember to log today\'s exercise routine to maintain your streak points.',
          isRead: true,
          readAt: new Date(),
          deliveryStatus: 'SENT',
        },
      ]);
    }

    const filter: Record<string, unknown> = {
      userId: userObjectId,
    };

    if (filters.isRead !== undefined) filter.isRead = filters.isRead;
    if (filters.type) filter.type = filters.type;

    const [notifications, totalItems] = await Promise.all([
      Notification.find(filter).skip(skip).limit(limit).sort({ createdAt: -1 }),
      Notification.countDocuments(filter),
    ]);

    const meta = buildPaginationMeta(totalItems, page, limit);

    return { notifications, meta };
  }

  /**
   * Mark Single Notification as Read
   */
  public static async markAsRead(notificationId: string, userId: string): Promise<INotification> {
    if (!mongoose.Types.ObjectId.isValid(notificationId)) {
      throw AppError.notFound('Notification not found');
    }

    const notification = await Notification.findOneAndUpdate(
      {
        _id: notificationId,
        userId: new mongoose.Types.ObjectId(userId),
      },
      { isRead: true, readAt: new Date() },
      { new: true }
    );

    if (!notification) {
      throw AppError.notFound('Notification not found');
    }

    return notification;
  }

  /**
   * Mark All Notifications as Read
   */
  public static async markAllAsRead(userId: string): Promise<number> {
    const result = await Notification.updateMany(
      {
        userId: new mongoose.Types.ObjectId(userId),
        isRead: false,
      },
      { isRead: true, readAt: new Date() }
    );

    return result.modifiedCount;
  }

  /**
   * Lightweight Unread Count Query for App Badge
   */
  public static async getUnreadCount(userId: string): Promise<number> {
    return Notification.countDocuments({
      userId: new mongoose.Types.ObjectId(userId),
      isRead: false,
    });
  }
}
