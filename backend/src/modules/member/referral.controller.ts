import { Request, Response } from 'express';
import { ReferralService } from './referral.service';
import { sendSuccess } from '../../common/utils/ApiResponse';
import { asyncHandler } from '../../common/utils/asyncHandler';
import { AppError } from '../../common/utils/AppError';

export class ReferralController {
  public static sendReferralAsk = asyncHandler(async (req: Request, res: Response) => {
    const gymId = req.params.gymId || req.user?.gymId;
    if (!gymId) throw AppError.badRequest('Gym ID is required');

    const memberId = req.params.memberId;
    if (!memberId) throw AppError.badRequest('Member ID is required');

    const result = await ReferralService.sendReferralAsk(memberId, gymId.toString());
    return sendSuccess(res, result, 'Referral request message triggered successfully');
  });
}
