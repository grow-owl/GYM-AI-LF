import { Types } from 'mongoose';
import { Gym } from '../gym/gym.model';
import { GymPlan, GymStatus } from '../gym/gym.types';
import { PlatformSubscription } from './platformSubscription.model';
import { PlatformInvoice } from './platformInvoice.model';
import { PlatformUpgradeRequest } from './platformUpgradeRequest.model';
import { User } from '../user/user.model';
import { Role } from '../../common/constants/roles.enum';
import { generatePlatformInvoiceNumber } from './invoiceCounter.model';
import { BillingCycle, PaymentStatus, PlatformPaymentMethod } from './platformSubscription.types';
import { AppError } from '../../common/utils/AppError';
import { NotificationService } from '../notification/notification.service';
import { NotificationType } from '../notification/notification.types';
import { notificationTemplates } from '../notification/notificationTemplates';
import { logger } from '../../config/logger';

export class PlatformBillingService {
  public static async recordManualPlatformPayment(
    gymId: string,
    recordedByUserId: string,
    data: {
      targetPlan: GymPlan;
      billingCycle?: BillingCycle;
      amount: number;
      method: PlatformPaymentMethod;
      transactionRef?: string;
      notes?: string;
    }
  ) {
    const gym = await Gym.findOne({ _id: gymId, isDeleted: false });
    if (!gym) {
      throw AppError.notFound('Gym organization not found');
    }

    const billingCycle = data.billingCycle || BillingCycle.MONTHLY;
    const durationDays = billingCycle === BillingCycle.YEARLY ? 365 : 30;
    const now = new Date();
    const expiresAt = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000);

    const invoiceNumber = await generatePlatformInvoiceNumber();

    const invoice = await PlatformInvoice.create({
      gymId: gym._id,
      invoiceNumber,
      amount: data.amount,
      currency: 'INR',
      status: PaymentStatus.SUCCESS,
      method: data.method,
      recordedByUserId: new Types.ObjectId(recordedByUserId),
      transactionRef: data.transactionRef,
      targetPlan: data.targetPlan,
      periodStart: now,
      periodEnd: expiresAt,
      paidAt: now,
    });

    gym.plan = data.targetPlan;
    gym.status = GymStatus.ACTIVE;
    gym.subscriptionExpiresAt = expiresAt;
    await gym.save();

    await PlatformSubscription.findOneAndUpdate(
      { gymId: gym._id },
      {
        plan: data.targetPlan,
        billingCycle,
        amount: data.amount,
        currency: 'INR',
        currentPeriodStart: now,
        currentPeriodEnd: expiresAt,
        autoRenew: false,
      },
      { upsert: true, new: true }
    );

    const template = notificationTemplates[NotificationType.PAYMENT_SUCCESS](invoice.amount, invoice.invoiceNumber);
    await NotificationService.sendToUser(
      gym.ownerId.toString(),
      gym._id.toString(),
      NotificationType.PAYMENT_SUCCESS,
      template.title,
      template.body
    );

    logger.info(`📝 Manual Platform Payment recorded: [Gym: ${gym._id}] [Plan: ${data.targetPlan}] [Invoice: ${invoiceNumber}]`);

    return invoice;
  }

  public static async getPlatformRevenueOverview() {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const invoices = await PlatformInvoice.find({ status: PaymentStatus.SUCCESS });

    let totalRevenue = 0;
    let revenueThisMonth = 0;
    const revenueByPlan: Record<string, number> = {};
    const revenueByMethod: Record<string, number> = {};

    for (const inv of invoices) {
      totalRevenue += inv.amount || 0;
      if (inv.paidAt && new Date(inv.paidAt) >= startOfMonth) {
        revenueThisMonth += inv.amount || 0;
      }

      const planKey = inv.targetPlan || GymPlan.PRO;
      revenueByPlan[planKey] = (revenueByPlan[planKey] || 0) + (inv.amount || 0);

      const methodKey = inv.method || 'bank_transfer';
      revenueByMethod[methodKey] = (revenueByMethod[methodKey] || 0) + (inv.amount || 0);
    }

    const activePayingGyms = await PlatformInvoice.distinct('gymId', {
      status: PaymentStatus.SUCCESS,
      paidAt: { $gte: startOfMonth },
    });
    const activePayingGymsCount = activePayingGyms.length;

    return {
      totalRevenue,
      revenueThisMonth,
      activePayingGymsCount,
      revenueByPlan,
      revenueByMethod,
    };
  }

  public static async getPlatformRevenueTrends(startDate?: Date, endDate?: Date) {
    const end = endDate ? new Date(endDate) : new Date();
    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const invoices = await PlatformInvoice.find({
      status: PaymentStatus.SUCCESS,
      paidAt: { $gte: start, $lte: end },
    });

    const dailyMap: Record<string, { totalRevenue: number; count: number }> = {};

    for (const inv of invoices) {
      if (inv.paidAt) {
        const dateStr = new Date(inv.paidAt).toISOString().split('T')[0];
        if (!dailyMap[dateStr]) {
          dailyMap[dateStr] = { totalRevenue: 0, count: 0 };
        }
        dailyMap[dateStr].totalRevenue += inv.amount || 0;
        dailyMap[dateStr].count += 1;
      }
    }

    const timeSeries: { date: string; totalRevenue: number; count: number }[] = [];
    const current = new Date(start);
    while (current <= end) {
      const dateStr = current.toISOString().split('T')[0];
      const data = dailyMap[dateStr] || { totalRevenue: 0, count: 0 };
      timeSeries.push({
        date: dateStr,
        totalRevenue: data.totalRevenue,
        count: data.count,
      });
      current.setDate(current.getDate() + 1);
    }

    return timeSeries;
  }

  public static async checkAndSuspendUnpaidGyms(): Promise<number> {
    const now = new Date();
    const expiredGyms = await Gym.find({
      status: GymStatus.ACTIVE,
      subscriptionExpiresAt: { $lt: now },
      isDeleted: false,
    });

    let count = 0;
    for (const gym of expiredGyms) {
      gym.status = GymStatus.SUSPENDED;
      await gym.save();
      count++;
    }

    if (count > 0) {
      logger.info(`🚨 Passive Gym Evaluator: Suspended ${count} unpaid gym(s) due to expired subscriptions`);
    }

    return count;
  }

  public static async createUpgradeRequest(
    gymId: string,
    requestedByUserId: string,
    data: { requestedPlan: string; billingCycle?: string; notes?: string }
  ) {
    const gym = await Gym.findOne({ _id: gymId, isDeleted: false });
    if (!gym) {
      throw AppError.notFound('Gym organization not found');
    }

    const upgradeReq = await PlatformUpgradeRequest.create({
      gymId: gym._id,
      requestedByUserId: new Types.ObjectId(requestedByUserId),
      currentPlan: gym.plan || GymPlan.TRIAL,
      requestedPlan: data.requestedPlan,
      billingCycle: data.billingCycle || 'MONTHLY',
      notes: data.notes,
      status: 'PENDING',
    });

    const superAdmins = await User.find({ role: Role.SUPER_ADMIN });
    const template = notificationTemplates[NotificationType.PLATFORM_UPGRADE_REQUESTED](
      gym.name,
      gym.plan || 'TRIAL',
      data.requestedPlan
    );

    for (const admin of superAdmins) {
      await NotificationService.sendToUser(
        admin._id.toString(),
        gym._id.toString(),
        NotificationType.PLATFORM_UPGRADE_REQUESTED,
        template.title,
        template.body,
        { gymId: gym._id.toString(), requestedPlan: data.requestedPlan }
      );
    }

    return upgradeReq;
  }

  public static async listUpgradeRequests() {
    const requests = await PlatformUpgradeRequest.find()
      .populate('gymId', 'name email')
      .populate('requestedByUserId', 'fullName email')
      .sort({ status: 1, createdAt: -1 });

    return requests;
  }

  public static async cancelUpgradeRequest(gymId: string, _userId: string) {
    const gym = await Gym.findOne({ _id: gymId, isDeleted: false });
    if (!gym) {
      throw AppError.notFound('Gym organization not found');
    }

    const updated = await PlatformUpgradeRequest.updateMany(
      { gymId: gym._id, status: 'PENDING' },
      { $set: { status: 'CANCELLED' } }
    );

    return { success: true, count: updated.modifiedCount };
  }
}
