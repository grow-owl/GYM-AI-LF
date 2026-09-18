import { Request, Response } from 'express';
import { GamificationService } from './gamification.service';
import { sendSuccess } from '../../common/utils/ApiResponse';
import { asyncHandler } from '../../common/utils/asyncHandler';
import { AppError } from '../../common/utils/AppError';

export class GamificationController {
  public static getMyProfile = asyncHandler(async (req: Request, res: Response) => {
    const profile = await GamificationService.getMemberGameProfile(req.user!.id);
    return sendSuccess(res, profile, 'Member gamification profile retrieved successfully');
  });

  public static getLeaderboard = asyncHandler(async (req: Request, res: Response) => {
    const gymId = req.user?.gymId || (req.query.gymId as string);
    const branchId = req.query.branchId as string | undefined;
    const metric = (req.query.metric as 'xp' | 'streak') || 'xp';
    const timeframe = (req.query.timeframe as 'weekly' | 'monthly' | 'allTime') || 'allTime';

    if (!gymId) {
      throw AppError.badRequest('Gym ID is required for leaderboard');
    }

    const leaderboard = await GamificationService.getLeaderboard(
      gymId.toString(),
      branchId,
      metric,
      timeframe
    );

    return sendSuccess(res, { leaderboard, metric, timeframe }, 'Leaderboard retrieved successfully');
  });

  public static listChallenges = asyncHandler(async (req: Request, res: Response) => {
    const gymId = (req.query.gymId as string) || (req.params as any)?.gymId || req.user?.gymId;
    const memberUserId = req.user?.id;
    const challenges = await GamificationService.listActiveChallenges(gymId?.toString(), memberUserId);
    return sendSuccess(res, { challenges });
  });

  public static createChallenge = asyncHandler(async (req: Request, res: Response) => {
    const gymId = req.params.gymId || req.user!.gymId;
    if (!gymId) {
      throw AppError.badRequest('Gym ID is required');
    }

    const challenge = await GamificationService.createChallenge(gymId.toString(), req.body);
    return sendSuccess(res, { challenge }, 'Gym challenge created successfully', 201);
  });

  public static joinChallenge = asyncHandler(async (req: Request, res: Response) => {
    const challenge = await GamificationService.joinChallenge(req.params.challengeId, req.user!.id);
    return sendSuccess(res, { challenge }, 'Joined challenge successfully');
  });

  public static updateRestDays = asyncHandler(async (req: Request, res: Response) => {
    const { restDays } = req.body as { restDays: number[] };
    const result = await GamificationService.updateRestDays(req.user!.id, restDays);
    return sendSuccess(res, result, 'Rest days updated successfully');
  });
}
