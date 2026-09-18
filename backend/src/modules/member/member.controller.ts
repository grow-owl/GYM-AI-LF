import { Request, Response } from 'express';
import { MemberService } from './member.service';
import { ReferralService } from './referral.service';
import { sendSuccess } from '../../common/utils/ApiResponse';
import { asyncHandler } from '../../common/utils/asyncHandler';
import { Role } from '../../common/constants/roles.enum';

export class MemberController {
  public static createMember = asyncHandler(async (req: Request, res: Response) => {
    const { gymId, branchId } = req.params;
    const member = await MemberService.createMember(gymId, branchId, req.body);
    return sendSuccess(res, { member }, 'Member onboarded successfully', 201);
  });

  public static listMembers = asyncHandler(async (req: Request, res: Response) => {
    const { gymId, branchId } = req.params;
    const { status, trainerId, search } = req.query;

    const { members, meta } = await MemberService.listMembers(
      gymId,
      branchId,
      {
        status: status as string,
        trainerId: trainerId as string,
        search: search as string,
      },
      req.query
    );

    return sendSuccess(res, { members }, 'Members retrieved successfully', 200, { pagination: meta });
  });

  public static getMemberById = asyncHandler(async (req: Request, res: Response) => {
    const gymId = req.tenant?.gymId || req.user?.gymId;
    const member = await MemberService.getMemberById(req.params.memberId, gymId ? gymId.toString() : undefined);
    return sendSuccess(res, { member }, 'Member profile retrieved successfully');
  });

  public static getMe = asyncHandler(async (req: Request, res: Response) => {
    const member = await MemberService.getMemberByUserId(req.user!.id);
    return sendSuccess(res, { member }, 'Member profile retrieved successfully');
  });

  public static getMyReferralStats = asyncHandler(async (req: Request, res: Response) => {
    const stats = await ReferralService.getMyReferralStats(req.user!.id);
    return sendSuccess(res, stats, 'Referral stats retrieved successfully');
  });

  public static updateMe = asyncHandler(async (req: Request, res: Response) => {
    const member = await MemberService.getMemberByUserId(req.user!.id);
    const updated = await MemberService.updateMember(
      member._id.toString(),
      req.body,
      member.gymId.toString(),
      Role.MEMBER
    );
    return sendSuccess(res, { member: updated }, 'Member profile updated successfully');
  });

  public static updateMember = asyncHandler(async (req: Request, res: Response) => {
    const gymId = req.tenant?.gymId || req.user?.gymId;
    const member = await MemberService.updateMember(
      req.params.memberId,
      req.body,
      gymId ? gymId.toString() : undefined,
      req.user!.role as Role
    );
    return sendSuccess(res, { member }, 'Member updated successfully');
  });

  public static assignTrainer = asyncHandler(async (req: Request, res: Response) => {
    const gymId = req.tenant?.gymId || req.user?.gymId;
    const member = await MemberService.assignTrainer(req.params.memberId, req.body.trainerId, gymId ? gymId.toString() : undefined);
    return sendSuccess(res, { member }, 'Trainer assigned to member successfully');
  });

  public static freezeMembership = asyncHandler(async (req: Request, res: Response) => {
    const gymId = req.tenant?.gymId || req.user?.gymId;
    const member = await MemberService.freezeMembership(
      req.params.memberId,
      new Date(req.body.freezeUntil),
      req.body.reason,
      gymId ? gymId.toString() : undefined
    );
    return sendSuccess(res, { member }, 'Membership frozen successfully');
  });

  public static renewMembership = asyncHandler(async (req: Request, res: Response) => {
    const gymId = req.tenant?.gymId || req.user?.gymId;
    const member = await MemberService.renewMembership(
      req.params.memberId,
      new Date(req.body.newEndDate),
      req.body.planName,
      gymId ? gymId.toString() : undefined
    );
    return sendSuccess(res, { member }, 'Membership renewed successfully');
  });

  public static extendMembership = asyncHandler(async (req: Request, res: Response) => {
    const gymId = req.tenant?.gymId || req.user?.gymId;
    const member = await MemberService.extendMembership(
      req.params.memberId,
      Number(req.body.days),
      req.body.reason,
      gymId ? gymId.toString() : undefined
    );
    return sendSuccess(res, { member }, 'Membership extended successfully');
  });

  public static cancelMembership = asyncHandler(async (req: Request, res: Response) => {
    const gymId = req.tenant?.gymId || req.user?.gymId;
    const member = await MemberService.cancelMembership(
      req.params.memberId,
      req.body.reason,
      gymId ? gymId.toString() : undefined
    );
    return sendSuccess(res, { member }, 'Membership cancelled successfully');
  });

  public static regenerateQRCode = asyncHandler(async (req: Request, res: Response) => {
    const gymId = req.tenant?.gymId || req.user?.gymId;
    const result = await MemberService.regenerateQRCode(req.params.memberId, gymId ? gymId.toString() : undefined);
    return sendSuccess(res, result, 'QR code regenerated successfully');
  });

  public static getQRCode = asyncHandler(async (req: Request, res: Response) => {
    const gymId = req.tenant?.gymId || req.user?.gymId;
    const member = await MemberService.getMemberById(req.params.memberId, gymId ? gymId.toString() : undefined);
    return sendSuccess(res, { qrCodeToken: member.qrCode }, 'QR code retrieved successfully');
  });

  public static softDeleteMember = asyncHandler(async (req: Request, res: Response) => {
    const gymId = req.tenant?.gymId || req.user?.gymId;
    await MemberService.softDeleteMember(req.params.memberId, gymId ? gymId.toString() : undefined);
    return sendSuccess(res, null, 'Member soft deleted successfully');
  });
}
