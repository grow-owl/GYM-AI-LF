import mongoose from 'mongoose';
import { Gym } from '../modules/gym/gym.model';
import { Member } from '../modules/member/member.model';
import { MembershipStatus } from '../modules/member/member.types';
import { Attendance } from '../modules/attendance/attendance.model';
import { MemberPayment } from '../modules/payment/memberPayment.model';
import { PaymentStatus } from '../modules/payment/platformSubscription.types';
import { NotificationService } from '../modules/notification/notification.service';
import { NotificationType } from '../modules/notification/notification.types';
import { notificationTemplates } from '../modules/notification/notificationTemplates';
import { MembershipReminderLog } from './membershipReminderLog.model';
import { logger } from '../config/logger';

export class MembershipReminderJob {
  /**
   * Primary Daily Reminder Runner
   */
  public static async runReminders(specificGymId?: string): Promise<{
    processedGyms: number;
    remindersSent: number;
    skippedDuplicates: number;
  }> {
    const todayStr = new Date().toISOString().split('T')[0];
    const gymFilter: any = { isDeleted: false };
    if (specificGymId) {
      gymFilter._id = new mongoose.Types.ObjectId(specificGymId);
    }

    const gyms = await Gym.find(gymFilter).select('_id name');
    let totalSent = 0;
    let totalSkipped = 0;

    for (const gym of gyms) {
      const gymId = gym._id.toString();

      // 1. Process Expiry Reminders (7D, 3D, 1D, EXPIRED)
      const expiryResult = await this.processExpiryRemindersForGym(gymId, todayStr);
      totalSent += expiryResult.sent;
      totalSkipped += expiryResult.skipped;

      // 2. Process Payment Due Reminders
      const paymentResult = await this.processPaymentDueRemindersForGym(gymId, todayStr);
      totalSent += paymentResult.sent;
      totalSkipped += paymentResult.skipped;

      // 3. Process Missed Workout Reminders (5+ days inactive)
      const missedResult = await this.processMissedWorkoutRemindersForGym(gymId, todayStr);
      totalSent += missedResult.sent;
      totalSkipped += missedResult.skipped;

      // 4. Process Renewal Discount Offers (Expired 3-7 days ago)
      const discountResult = await this.processRenewalDiscountOffersForGym(gymId, todayStr);
      totalSent += discountResult.sent;
      totalSkipped += discountResult.skipped;
    }

    logger.info(
      `⏰ Automated Reminders Job Completed: [Gyms: ${gyms.length}] [Sent: ${totalSent}] [Skipped: ${totalSkipped}]`
    );

    return {
      processedGyms: gyms.length,
      remindersSent: totalSent,
      skippedDuplicates: totalSkipped,
    };
  }

  private static async processExpiryRemindersForGym(
    gymId: string,
    todayStr: string
  ): Promise<{ sent: number; skipped: number }> {
    let sent = 0;
    let skipped = 0;
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;

    const members = await Member.find({
      gymId: new mongoose.Types.ObjectId(gymId),
      isDeleted: false,
      membershipEndDate: { $exists: true, $ne: null },
    }).select('_id userId membershipEndDate membershipStatus');

    for (const m of members) {
      if (!m.membershipEndDate) continue;

      const endDateMs = new Date(m.membershipEndDate).getTime();
      const daysUntilExpiry = Math.ceil((endDateMs - now) / dayMs);

      let tier: '7D' | '3D' | '1D' | 'EXPIRED' | undefined;
      let notificationType: NotificationType | undefined;

      if (daysUntilExpiry === 7) {
        tier = '7D';
        notificationType = NotificationType.MEMBERSHIP_EXPIRING_7D;
      } else if (daysUntilExpiry === 3) {
        tier = '3D';
        notificationType = NotificationType.MEMBERSHIP_EXPIRING_3D;
      } else if (daysUntilExpiry === 1) {
        tier = '1D';
        notificationType = NotificationType.MEMBERSHIP_EXPIRING_1D;
      } else if (daysUntilExpiry <= 0 && daysUntilExpiry >= -1) {
        tier = 'EXPIRED';
        notificationType = NotificationType.MEMBERSHIP_EXPIRED;
      }

      if (tier && notificationType) {
        const result = await this.sendReminderIfEligible(
          m._id.toString(),
          m.userId.toString(),
          gymId,
          tier,
          todayStr,
          notificationType
        );
        if (result.sent) sent++;
        if (result.skipped) skipped++;
      }
    }

    return { sent, skipped };
  }

  private static async processPaymentDueRemindersForGym(
    gymId: string,
    todayStr: string
  ): Promise<{ sent: number; skipped: number }> {
    let sent = 0;
    let skipped = 0;

    const pendingPayments = await MemberPayment.find({
      gymId: new mongoose.Types.ObjectId(gymId),
      status: PaymentStatus.PENDING,
    }).select('memberId amount');

    for (const p of pendingPayments) {
      const member = await Member.findById(p.memberId).select('_id userId');
      if (!member) continue;

      const result = await this.sendReminderIfEligible(
        member._id.toString(),
        member.userId.toString(),
        gymId,
        'PAYMENT_DUE',
        todayStr,
        NotificationType.PAYMENT_DUE,
        [String(p.amount)]
      );

      if (result.sent) sent++;
      if (result.skipped) skipped++;
    }

    return { sent, skipped };
  }

  private static async processMissedWorkoutRemindersForGym(
    gymId: string,
    todayStr: string
  ): Promise<{ sent: number; skipped: number }> {
    let sent = 0;
    let skipped = 0;
    const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);

    const members = await Member.find({
      gymId: new mongoose.Types.ObjectId(gymId),
      isDeleted: false,
      membershipStatus: MembershipStatus.ACTIVE,
      fitnessGoals: { $exists: true, $not: { $size: 0 } },
    }).select('_id userId');

    for (const m of members) {
      const recentAttendance = await Attendance.findOne({
        memberId: m._id,
        checkInAt: { $gte: fiveDaysAgo },
      });

      if (!recentAttendance) {
        const result = await this.sendReminderIfEligible(
          m._id.toString(),
          m.userId.toString(),
          gymId,
          'MISSED_WORKOUT',
          todayStr,
          NotificationType.MISSED_WORKOUT
        );

        if (result.sent) sent++;
        if (result.skipped) skipped++;
      }
    }

    return { sent, skipped };
  }

  private static async processRenewalDiscountOffersForGym(
    gymId: string,
    todayStr: string
  ): Promise<{ sent: number; skipped: number }> {
    let sent = 0;
    let skipped = 0;
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;

    const members = await Member.find({
      gymId: new mongoose.Types.ObjectId(gymId),
      isDeleted: false,
      membershipEndDate: { $exists: true, $ne: null },
    }).select('_id userId membershipEndDate membershipStatus');

    for (const m of members) {
      if (!m.membershipEndDate) continue;
      const endDateMs = new Date(m.membershipEndDate).getTime();
      const daysExpired = Math.floor((now - endDateMs) / dayMs);

      // Offer discount for members expired 3 to 7 days ago
      if (daysExpired >= 3 && daysExpired <= 7) {
        const existingOfferLog = await MembershipReminderLog.findOne({
          memberId: m._id,
          tier: 'RENEWAL_OFFER',
          createdAt: { $gte: m.membershipEndDate },
        });

        if (existingOfferLog) {
          skipped++;
          continue;
        }

        const result = await this.sendReminderIfEligible(
          m._id.toString(),
          m.userId.toString(),
          gymId,
          'RENEWAL_OFFER',
          todayStr,
          NotificationType.RENEWAL_DISCOUNT_OFFER,
          ['20%', '3 days']
        );

        if (result.sent) sent++;
        if (result.skipped) skipped++;
      }
    }

    return { sent, skipped };
  }

  private static async sendReminderIfEligible(
    memberId: string,
    userId: string,
    gymId: string,
    tier: '7D' | '3D' | '1D' | 'EXPIRED' | 'PAYMENT_DUE' | 'MISSED_WORKOUT' | 'RENEWAL_OFFER',
    todayStr: string,
    notificationType: NotificationType,
    params: string[] = []
  ): Promise<{ sent: boolean; skipped: boolean }> {
    try {
      await MembershipReminderLog.create({
        memberId: new mongoose.Types.ObjectId(memberId),
        gymId: new mongoose.Types.ObjectId(gymId),
        tier,
        sentOn: todayStr,
      });

      // Send In-App / Push Notification
      const templateFn = (notificationTemplates as any)[notificationType];
      const content = templateFn ? templateFn(...params) : { title: 'Gym Notification', body: 'Reminder' };
      await NotificationService.sendToUser(userId, gymId, notificationType, content.title, content.body);

      return { sent: true, skipped: false };
    } catch (err: any) {
      if (err?.code === 11000) {
        // Unique index collision: already sent today for this tier
        return { sent: false, skipped: true };
      }
      logger.error(`Error sending reminder to member [${memberId}]: ${err}`);
      return { sent: false, skipped: false };
    }
  }
}
