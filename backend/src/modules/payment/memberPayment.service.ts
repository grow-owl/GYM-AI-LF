import mongoose from 'mongoose';
import { MemberPayment } from './memberPayment.model';
import { Member } from '../member/member.model';
import { User } from '../user/user.model';
import { Branch } from '../gym/branch.model';
import { MemberService } from '../member/member.service';
import { generateGymInvoiceNumber } from './invoiceCounter.model';
import { IMemberPayment, RevenueSummary, PaymentPurpose, PaymentMethod } from './memberPayment.types';
import { PaymentStatus } from './platformSubscription.types';
import { AppError } from '../../common/utils/AppError';
import { getPaginationParams, buildPaginationMeta, ParsedPagination } from '../../common/utils/pagination';
import { NotificationService } from '../notification/notification.service';
import { NotificationType } from '../notification/notification.types';
import { notificationTemplates } from '../notification/notificationTemplates';
import { logger } from '../../config/logger';

export class MemberPaymentService {
  public static async recordManualPayment(
    gymIdOrData: any,
    recordedByUserIdOrUser?: any,
    paymentDataArg?: any
  ): Promise<IMemberPayment> {
    let gymId: string;
    let branchId: string | undefined;
    let memberId: string;
    let amount: number;
    let paymentMethod: PaymentMethod;
    let purpose: PaymentPurpose;
    let description: string | undefined;
    let customerName: string | undefined;
    let recordedByUserId: string;
    let renewMembership: boolean = false;
    let renewMonths: number = 1;

    if (typeof gymIdOrData === 'object') {
      gymId = gymIdOrData.gymId;
      branchId = gymIdOrData.branchId;
      memberId = gymIdOrData.memberId;
      amount = gymIdOrData.amount;
      paymentMethod = gymIdOrData.method || gymIdOrData.paymentMethod || 'cash';
      purpose = gymIdOrData.purpose || gymIdOrData.category || 'membership_fee';
      description = gymIdOrData.notes || gymIdOrData.description;
      customerName = gymIdOrData.customerName;
      if (gymIdOrData.customerPhone && customerName && !customerName.includes(gymIdOrData.customerPhone)) {
        customerName = `${customerName} (${gymIdOrData.customerPhone})`;
      }
      recordedByUserId = recordedByUserIdOrUser?.id || recordedByUserIdOrUser;
      renewMembership = gymIdOrData.triggerRenewal || gymIdOrData.renewMembership || false;
      renewMonths = gymIdOrData.renewMonths || 1;
    } else {
      gymId = gymIdOrData;
      recordedByUserId = recordedByUserIdOrUser;
      memberId = paymentDataArg?.memberId;
      amount = paymentDataArg?.amount;
      paymentMethod = paymentDataArg?.paymentMethod || paymentDataArg?.method || 'cash';
      purpose = paymentDataArg?.category || paymentDataArg?.purpose || 'membership_fee';
      description = paymentDataArg?.description || paymentDataArg?.notes;
      customerName = paymentDataArg?.customerName;
      renewMembership = paymentDataArg?.renewMembership || paymentDataArg?.triggerRenewal || false;
      renewMonths = paymentDataArg?.renewMonths || 1;
    }

    const customerPhone = paymentDataArg?.customerPhone;
    if (customerPhone && customerName && !customerName.includes(customerPhone)) {
      customerName = `${customerName} (${customerPhone})`;
    }

    const isWalkIn = !memberId || memberId === 'walk_in' || !mongoose.Types.ObjectId.isValid(memberId);
    let member = !isWalkIn
      ? await Member.findOne({
          $or: [
            { _id: new mongoose.Types.ObjectId(memberId) },
            { userId: new mongoose.Types.ObjectId(memberId) },
          ],
          gymId: mongoose.Types.ObjectId.isValid(gymId) ? new mongoose.Types.ObjectId(gymId) : undefined,
          isDeleted: false,
        }).populate('userId', 'fullName')
      : null;

    if (!member) {
      if (!isWalkIn) {
        throw AppError.notFound('Member profile not found in your gym');
      }

      // Resolve or create walk-in member profile scoped to this gym
      let walkInMember = await Member.findOne({
        fullName: 'Walk-in Customer',
        gymId: new mongoose.Types.ObjectId(gymId),
        isDeleted: false,
      });

      if (!walkInMember) {
        let walkInUser = await User.findOne({ fullName: 'Walk-in Customer', isDeleted: false });
        if (!walkInUser) {
          walkInUser = await User.create({
            fullName: 'Walk-in Customer',
            email: `walkin_${Date.now()}@gymai.internal`,
            phone: '0000000000',
            role: 'MEMBER',
            isActive: true,
          });
        }

        let walkInBranchId = branchId;
        if (!walkInBranchId) {
          const primaryBranch = await Branch.findOne({
            gymId: new mongoose.Types.ObjectId(gymId),
            isPrimary: true,
            isDeleted: false,
          });
          walkInBranchId = primaryBranch?._id?.toString();
        }

        walkInMember = await Member.create({
          gymId: new mongoose.Types.ObjectId(gymId),
          branchId: walkInBranchId || new mongoose.Types.ObjectId(),
          userId: walkInUser._id,
          fullName: 'Walk-in Customer',
          phone: '0000000000',
          membershipStatus: 'ACTIVE',
          planName: 'Walk-in Store Purchase',
          membershipStartDate: new Date(),
          membershipEndDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        });
      }

      member = walkInMember;
    }

    const invoiceNumber = await generateGymInvoiceNumber();
    const memFullName = (member as any)?.userId?.fullName || (member as any)?.fullName;
    const resolvedCustomerName =
      (customerName && customerName !== 'Walk-in Customer' ? customerName : undefined) ||
      (memFullName && memFullName !== 'N/A' && memFullName !== 'Walk-in Customer' ? memFullName : undefined) ||
      customerName ||
      'Walk-in Customer';

    const payment = new MemberPayment({
      gymId: new mongoose.Types.ObjectId(gymId),
      branchId: branchId ? new mongoose.Types.ObjectId(branchId) : member.branchId,
      memberId: member._id,
      recordedByUserId: new mongoose.Types.ObjectId(recordedByUserId),
      invoiceNumber,
      amount,
      method: paymentMethod,
      purpose,
      customerName: resolvedCustomerName,
      notes: description,
      status: PaymentStatus.SUCCESS,
      paidAt: new Date(),
      relatedMembershipRenewal: renewMembership,
    });

    await payment.save();

    if (renewMembership) {
      const newEndDate = typeof gymIdOrData === 'object' ? gymIdOrData.newEndDate : undefined;
      if (newEndDate) {
        await MemberService.renewMembership(member._id.toString(), new Date(newEndDate), undefined, gymId);
      } else {
        await MemberService.renewMembership(member._id.toString(), renewMonths, undefined, gymId);
      }
    }

    const targetUserId = (member.userId as any)?._id?.toString() || member.userId?.toString();
    if (targetUserId && mongoose.Types.ObjectId.isValid(targetUserId)) {
      const template = notificationTemplates[NotificationType.PAYMENT_SUCCESS](payment.amount, payment.invoiceNumber);
      await NotificationService.sendToUser(
        targetUserId,
        gymId,
        NotificationType.PAYMENT_SUCCESS,
        template.title,
        template.body
      );
    }

    logger.info(`💵 Member Payment recorded: [Invoice: ${invoiceNumber}] [Amount: ₹${amount}] [Method: ${paymentMethod}]`);
    return payment;
  }

  public static async listPayments(
    _gymId: string,
    filters: { memberId?: string; branchId?: string; status?: PaymentStatus; purpose?: PaymentPurpose } = {},
    options: { page?: number | string; limit?: number | string } = {}
  ): Promise<{ payments: IMemberPayment[]; meta: ReturnType<typeof buildPaginationMeta> }> {
    const { page, limit, skip }: ParsedPagination = getPaginationParams(options);

    const filter: Record<string, unknown> = {};
    if (mongoose.Types.ObjectId.isValid(_gymId)) {
      filter.gymId = new mongoose.Types.ObjectId(_gymId);
    }
    if (filters.branchId && mongoose.Types.ObjectId.isValid(filters.branchId)) {
      filter.branchId = new mongoose.Types.ObjectId(filters.branchId);
    }
    if (filters.memberId && mongoose.Types.ObjectId.isValid(filters.memberId)) {
      filter.memberId = new mongoose.Types.ObjectId(filters.memberId);
    }
    if (filters.status) filter.status = filters.status;
    if (filters.purpose) filter.purpose = filters.purpose;
    filter.isDeleted = { $ne: true };

    let [payments, totalItems] = await Promise.all([
      MemberPayment.find(filter)
        .populate({ path: 'memberId', populate: { path: 'userId', select: 'fullName email phone' } })
        .skip(skip)
        .limit(limit)
        .sort({ paidAt: -1, createdAt: -1 }),
      MemberPayment.countDocuments(filter),
    ]);

    const meta = buildPaginationMeta(totalItems, page, limit);

    return { payments, meta };
  }

  public static async getRevenueSummary(
    _gymId: string,
    branchIdOrRange?: string | { startDate?: Date; endDate?: Date; branchId?: string },
    groupByOrRange?: 'day' | 'month' | { startDate?: Date; endDate?: Date; branchId?: string },
    startDateArg?: Date,
    endDateArg?: Date
  ): Promise<RevenueSummary> {
    let groupBy: 'day' | 'month' = 'month';
    let startDate: Date | undefined;
    let endDate: Date | undefined;

    const matchFilter: any = {
      status: PaymentStatus.SUCCESS,
      isDeleted: { $ne: true },
    };

    if (mongoose.Types.ObjectId.isValid(_gymId)) {
      matchFilter.gymId = new mongoose.Types.ObjectId(_gymId);
    }

    if (typeof branchIdOrRange === 'object' && branchIdOrRange !== null) {
      startDate = (branchIdOrRange as any).startDate;
      endDate = (branchIdOrRange as any).endDate;
      const bId = (branchIdOrRange as any).branchId;
      if (bId && mongoose.Types.ObjectId.isValid(bId)) {
        matchFilter.branchId = new mongoose.Types.ObjectId(bId);
      }
      if (typeof groupByOrRange === 'string') groupBy = groupByOrRange as 'day' | 'month';
    } else {
      if (typeof branchIdOrRange === 'string' && mongoose.Types.ObjectId.isValid(branchIdOrRange)) {
        matchFilter.branchId = new mongoose.Types.ObjectId(branchIdOrRange);
      }
      if (typeof groupByOrRange === 'string') groupBy = groupByOrRange as 'day' | 'month';
      else if (typeof groupByOrRange === 'object' && groupByOrRange !== null) {
        startDate = (groupByOrRange as any).startDate;
        endDate = (groupByOrRange as any).endDate;
        const bId = (groupByOrRange as any).branchId;
        if (bId && mongoose.Types.ObjectId.isValid(bId)) {
          matchFilter.branchId = new mongoose.Types.ObjectId(bId);
        }
      }
      if (startDateArg) startDate = startDateArg;
      if (endDateArg) endDate = endDateArg;
    }

    if (startDate || endDate) {
      matchFilter.paidAt = {};
      if (startDate) matchFilter.paidAt.$gte = startDate;
      if (endDate) matchFilter.paidAt.$lte = endDate;
    }

    const dateFormat = groupBy === 'day' ? '%Y-%m-%d' : '%Y-%m';

    const [breakdown, totalAgg] = await Promise.all([
      MemberPayment.aggregate([
        { $match: matchFilter },
        {
          $group: {
            _id: { $dateToString: { format: dateFormat, date: '$paidAt' } },
            totalRevenue: { $sum: '$amount' },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: -1 } },
        {
          $project: {
            date: '$_id',
            totalRevenue: 1,
            count: 1,
            _id: 0,
          },
        },
      ]),
      MemberPayment.aggregate([
        { $match: matchFilter },
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: '$amount' },
            totalTransactions: { $sum: 1 },
          },
        },
      ]),
    ]);

    return {
      totalRevenue: totalAgg[0]?.totalRevenue || 0,
      totalTransactions: totalAgg[0]?.totalTransactions || 0,
      breakdown,
    };
  }

  public static async refundPayment(
    gymIdOrPaymentId: string,
    paymentIdOrReason: string,
    reasonOrAmount?: any
  ): Promise<IMemberPayment> {
    let paymentId: string;
    let reason: string;

    if (mongoose.Types.ObjectId.isValid(gymIdOrPaymentId) && mongoose.Types.ObjectId.isValid(paymentIdOrReason)) {
      paymentId = paymentIdOrReason;
      reason = typeof reasonOrAmount === 'string' ? reasonOrAmount : 'Owner requested refund';
    } else {
      paymentId = gymIdOrPaymentId;
      reason = paymentIdOrReason;
    }

    const payment = await MemberPayment.findOne({
      _id: paymentId,
      status: PaymentStatus.SUCCESS,
    });

    if (!payment) {
      throw AppError.notFound('Eligible successful payment transaction not found for refund');
    }

    payment.status = PaymentStatus.REFUNDED;
    payment.refundReason = reason;
    payment.refundedAt = new Date();
    payment.refundedAmount = payment.amount;
    await payment.save();

    logger.info(`💸 Payment refunded: [ID: ${payment._id}] [Amount: ₹${payment.amount}] [Reason: ${reason}]`);
    return payment;
  }

  public static async updatePayment(paymentId: string, data: Record<string, any>): Promise<IMemberPayment> {
    const payment = await MemberPayment.findOne({ _id: paymentId, isDeleted: { $ne: true } });
    if (!payment) {
      throw AppError.notFound('Payment record not found');
    }

    if (data.amount !== undefined) payment.amount = Number(data.amount);
    if (data.method !== undefined) payment.method = data.method;
    if (data.paymentMethod !== undefined) payment.method = data.paymentMethod;
    if (data.purpose !== undefined) payment.purpose = data.purpose;
    if (data.notes !== undefined) payment.notes = data.notes;
    if (data.customerName !== undefined) payment.customerName = data.customerName;
    if (data.status !== undefined) payment.status = data.status;

    await payment.save();
    return payment;
  }

  public static async softDeletePayment(paymentId: string): Promise<void> {
    const payment = await MemberPayment.findById(paymentId);
    if (!payment) {
      throw AppError.notFound('Payment record not found');
    }
    payment.isDeleted = true;
    await payment.save();
  }
}
