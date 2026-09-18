import { Request, Response } from 'express';
import { DeviceTokenService } from './deviceToken.service';
import { NotificationService } from './notification.service';
import { sendSuccess } from '../../common/utils/ApiResponse';
import { asyncHandler } from '../../common/utils/asyncHandler';

export class NotificationController {

  public static registerDeviceToken = asyncHandler(async (req: Request, res: Response) => {
    const { fcmToken, platform } = req.body;
    const tokenDoc = await DeviceTokenService.registerDeviceToken(req.user!.id, fcmToken, platform);
    return sendSuccess(res, { deviceToken: tokenDoc }, 'FCM device token registered successfully', 201);
  });

  public static deactivateDeviceToken = asyncHandler(async (req: Request, res: Response) => {
    const { fcmToken } = req.body;
    await DeviceTokenService.deactivateDeviceToken(fcmToken);
    return sendSuccess(res, null, 'FCM device token deactivated successfully');
  });

  public static getNotifications = asyncHandler(async (req: Request, res: Response) => {
    const filters: { isRead?: boolean; type?: any } = {};
    if (req.query.isRead !== undefined) filters.isRead = req.query.isRead === 'true';
    if (req.query.type) filters.type = req.query.type as any;

    const { notifications, meta } = await NotificationService.getNotificationHistory(
      req.user!.id,
      filters,
      req.query
    );

    return sendSuccess(res, { notifications, pagination: meta }, 'Notification feed retrieved successfully', 200, {
      pagination: meta,
    });
  });

  public static getUnreadCount = asyncHandler(async (req: Request, res: Response) => {
    const count = await NotificationService.getUnreadCount(req.user!.id);
    return sendSuccess(res, { unreadCount: count }, 'Unread notification count retrieved successfully');
  });

  public static markAsRead = asyncHandler(async (req: Request, res: Response) => {
    const { notificationId } = req.params;
    const notification = await NotificationService.markAsRead(notificationId, req.user!.id);
    return sendSuccess(res, { notification }, 'Notification marked as read');
  });

  public static markAllAsRead = asyncHandler(async (req: Request, res: Response) => {
    const count = await NotificationService.markAllAsRead(req.user!.id);
    return sendSuccess(res, { markedCount: count }, 'All notifications marked as read');
  });

  public static sendGymBroadcast = asyncHandler(async (req: Request, res: Response) => {
    const { gymId } = req.params;
    const { branchId, title, body } = req.body;

    const sentCount = await NotificationService.sendToGymBroadcast(gymId, branchId, title, body);
    return sendSuccess(res, { sentCount }, `Broadcast sent successfully to ${sentCount} member(s)`, 201);
  });
}
