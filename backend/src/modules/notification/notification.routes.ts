import { Router } from 'express';
import { NotificationController } from './notification.controller';
import { authenticate } from '../../common/middlewares/auth.middleware';
import { authorize } from '../../common/middlewares/authorize.middleware';
import { validate } from '../../common/middlewares/validate.middleware';
import { Role } from '../../common/constants/roles.enum';
import {
  registerDeviceTokenSchema,
  deactivateDeviceTokenSchema,
  sendBroadcastSchema,
} from './notification.validation';

const notificationRouter = Router();
const gymBroadcastRouter = Router({ mergeParams: true });

notificationRouter.use(authenticate);

// User Notification & Token Endpoints
notificationRouter.post(
  '/device-token',
  validate(registerDeviceTokenSchema, 'body'),
  NotificationController.registerDeviceToken
);
notificationRouter.delete(
  '/device-token',
  validate(deactivateDeviceTokenSchema, 'body'),
  NotificationController.deactivateDeviceToken
);
notificationRouter.get('/', NotificationController.getNotifications);
notificationRouter.get('/unread-count', NotificationController.getUnreadCount);
notificationRouter.patch('/read-all', NotificationController.markAllAsRead);
notificationRouter.patch('/:notificationId/read', NotificationController.markAsRead);

// Gym Staff Broadcast Router (/api/v1/gyms/:gymId/notifications/broadcast)
gymBroadcastRouter.use(authenticate);
gymBroadcastRouter.post(
  '/broadcast',
  authorize(Role.GYM_OWNER, Role.BRANCH_MANAGER, Role.SUPER_ADMIN),
  validate(sendBroadcastSchema, 'body'),
  NotificationController.sendGymBroadcast
);

export { notificationRouter, gymBroadcastRouter };
