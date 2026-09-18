import { Request, Response } from 'express';
import { FeedbackService } from './feedback.service';
import { sendSuccess } from '../../common/utils/ApiResponse';
import { asyncHandler } from '../../common/utils/asyncHandler';
import { Role } from '../../common/constants/roles.enum';

export class FeedbackController {
  public static createFeedback = asyncHandler(async (req: Request, res: Response) => {
    const feedback = await FeedbackService.createFeedback(
      {
        memberId: req.params.memberId || req.body.memberId,
        note: req.body.note,
        rating: req.body.rating,
        visibleToMember: req.body.visibleToMember,
        workoutLogId: req.body.workoutLogId,
      },
      {
        id: req.user!.id,
        role: req.user!.role as Role,
        gymId: req.user!.gymId,
      }
    );

    return sendSuccess(res, { feedback }, 'Trainer feedback created successfully', 201);
  });

  public static listFeedbackForMember = asyncHandler(async (req: Request, res: Response) => {
    const memberId = req.params.memberId;
    const { feedbacks, meta } = await FeedbackService.listFeedbackForMember(
      memberId,
      {
        id: req.user!.id,
        role: req.user!.role as Role,
      },
      req.query
    );

    return sendSuccess(res, { feedbacks }, 'Trainer feedback list retrieved successfully', 200, {
      pagination: meta,
    });
  });

  public static updateFeedback = asyncHandler(async (req: Request, res: Response) => {
    const feedback = await FeedbackService.updateFeedback(
      req.params.feedbackId,
      {
        note: req.body.note,
        rating: req.body.rating,
        visibleToMember: req.body.visibleToMember,
      },
      {
        id: req.user!.id,
        role: req.user!.role as Role,
        gymId: req.user!.gymId,
      }
    );

    return sendSuccess(res, { feedback }, 'Feedback entry updated successfully');
  });

  public static deleteFeedback = asyncHandler(async (req: Request, res: Response) => {
    await FeedbackService.deleteFeedback(req.params.feedbackId, {
      id: req.user!.id,
      role: req.user!.role as Role,
      gymId: req.user!.gymId,
    });

    return sendSuccess(res, null, 'Feedback entry deleted successfully');
  });
}
