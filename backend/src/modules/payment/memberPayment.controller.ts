import { Request, Response } from 'express';
import { MemberPaymentService } from './memberPayment.service';
import { MemberPayment } from './memberPayment.model';
import { Member } from '../member/member.model';
import { PaymentStatus } from './platformSubscription.types';
import { PaymentPurpose } from './memberPayment.types';
import { sendSuccess } from '../../common/utils/ApiResponse';
import { asyncHandler } from '../../common/utils/asyncHandler';
import { AppError } from '../../common/utils/AppError';
import { Role } from '../../common/constants/roles.enum';

export class MemberPaymentController {
  public static recordManualPayment = asyncHandler(async (req: Request, res: Response) => {
    const gymId = req.params.gymId || req.user!.gymId;
    if (!gymId) {
      throw AppError.badRequest('Gym ID is required');
    }

    const payment = await MemberPaymentService.recordManualPayment(
      {
        gymId: gymId.toString(),
        branchId: req.body.branchId,
        memberId: req.body.memberId,
        amount: req.body.amount,
        purpose: req.body.purpose,
        method: req.body.method,
        notes: req.body.notes,
        customerName: req.body.customerName,
        customerPhone: req.body.customerPhone,
        triggerRenewal: req.body.triggerRenewal,
        renewMonths: req.body.renewMonths,
        newEndDate: req.body.newEndDate ? new Date(req.body.newEndDate) : undefined,
      },
      { id: req.user!.id, role: req.user!.role }
    );

    return sendSuccess(res, { payment }, 'Member payment recorded successfully', 201);
  });


  public static listPayments = asyncHandler(async (req: Request, res: Response) => {
    const gymId = req.params.gymId || req.user!.gymId;
    if (!gymId) {
      throw AppError.badRequest('Gym ID is required');
    }

    const { branchId, memberId, status, purpose } = req.query;

    let finalBranchId = branchId as string;
    if (req.user!.role !== Role.SUPER_ADMIN && req.user!.role !== Role.GYM_OWNER) {
      if (req.user!.branchId) {
        finalBranchId = req.user!.branchId.toString();
      }
    }

    const { payments, meta } = await MemberPaymentService.listPayments(
      gymId.toString(),
      {
        branchId: finalBranchId,
        memberId: memberId as string,
        status: status as PaymentStatus,
        purpose: purpose as PaymentPurpose,
      },
      req.query
    );

    return sendSuccess(res, { payments }, 'Member payments retrieved successfully', 200, {
      pagination: meta,
    });
  });

  public static getMyPayments = asyncHandler(async (req: Request, res: Response) => {
    const gymId = req.params.gymId || req.user!.gymId;
    if (!gymId) {
      throw AppError.badRequest('Gym ID is required');
    }

    const member = await Member.findOne({ userId: req.user!.id, gymId, isDeleted: false });
    if (!member) {
      return sendSuccess(res, { payments: [] }, 'Member payments retrieved successfully');
    }

    const payments = await MemberPayment.find({
      gymId,
      memberId: member._id,
    }).sort({ paidAt: -1, createdAt: -1 });

    return sendSuccess(res, { payments }, 'Member payments retrieved successfully');
  });

  public static getRevenueSummary = asyncHandler(async (req: Request, res: Response) => {
    const gymId = req.params.gymId || req.user!.gymId;
    if (!gymId) {
      throw AppError.badRequest('Gym ID is required');
    }

    const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
    const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;
    const groupBy = (req.query.groupBy as 'day' | 'month') || 'day';
    let finalBranchId = req.query.branchId as string;

    if (req.user!.role !== Role.SUPER_ADMIN && req.user!.role !== Role.GYM_OWNER) {
      if (req.user!.branchId) {
        finalBranchId = req.user!.branchId.toString();
      }
    }

    const revenue = await MemberPaymentService.getRevenueSummary(
      gymId.toString(),
      { startDate, endDate, branchId: finalBranchId },
      groupBy
    );

    return sendSuccess(res, { revenue: revenue.breakdown, summary: { total: revenue.totalRevenue, transactions: revenue.totalTransactions }, groupBy }, 'Revenue summary retrieved successfully');
  });

  public static refundPayment = asyncHandler(async (req: Request, res: Response) => {
    const { paymentId } = req.params;
    const { amount, reason } = req.body;

    const payment = await MemberPaymentService.refundPayment(paymentId, reason, amount);

    return sendSuccess(res, { payment }, 'Payment refunded successfully');
  });

  public static updatePayment = asyncHandler(async (req: Request, res: Response) => {
    const { paymentId } = req.params;
    const payment = await MemberPaymentService.updatePayment(paymentId, req.body);
    return sendSuccess(res, { payment }, 'Payment updated successfully');
  });

  public static deletePayment = asyncHandler(async (req: Request, res: Response) => {
    const { paymentId } = req.params;
    await MemberPaymentService.softDeletePayment(paymentId);
    return sendSuccess(res, null, 'Payment deleted successfully');
  });
}
