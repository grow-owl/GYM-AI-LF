import mongoose from 'mongoose';
import { DeviceToken } from './deviceToken.model';
import { IDeviceToken } from './notification.types';
import { logger } from '../../config/logger';

export class DeviceTokenService {
  /**
   * Register or Re-assign Device Token to Current User
   */
  public static async registerDeviceToken(
    userId: string,
    fcmToken: string,
    platform: 'ios' | 'android' | 'web' = 'android'
  ): Promise<IDeviceToken> {
    const userObjectId = new mongoose.Types.ObjectId(userId);

    const tokenDoc = await DeviceToken.findOneAndUpdate(
      { fcmToken },
      {
        userId: userObjectId,
        platform,
        isActive: true,
        lastUsedAt: new Date(),
      },
      { upsert: true, new: true, runValidators: true }
    );

    logger.info(`📱 FCM Device Token registered: [User: ${userId}] [Platform: ${platform}]`);
    return tokenDoc;
  }

  /**
   * Deactivate Device Token (FCM invalid token cleanup or logout)
   */
  public static async deactivateDeviceToken(fcmToken: string): Promise<void> {
    await DeviceToken.updateOne({ fcmToken }, { isActive: false });
    logger.info(`🚫 FCM Device Token deactivated: [Token: ${fcmToken.substring(0, 15)}...]`);
  }

  /**
   * Fetch Active Tokens for User
   */
  public static async getActiveTokensForUser(userId: string): Promise<IDeviceToken[]> {
    return DeviceToken.find({
      userId: new mongoose.Types.ObjectId(userId),
      isActive: true,
    });
  }
}
