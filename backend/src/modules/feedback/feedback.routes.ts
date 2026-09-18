import { Router } from 'express';
import { FeedbackController } from './feedback.controller';
import { createFeedbackSchema, updateFeedbackSchema } from './feedback.validation';
import { authenticate } from '../../common/middlewares/auth.middleware';
import { authorize } from '../../common/middlewares/authorize.middleware';
import { validate } from '../../common/middlewares/validate.middleware';
import { Role } from '../../common/constants/roles.enum';

export const memberFeedbackRouter = Router({ mergeParams: true });

memberFeedbackRouter.use(authenticate);

// POST /api/v1/members/:memberId/feedback
memberFeedbackRouter.post(
  '/',
  authorize(Role.MEMBER, Role.TRAINER, Role.GYM_OWNER, Role.BRANCH_MANAGER, Role.SUPER_ADMIN),
  validate(createFeedbackSchema),
  FeedbackController.createFeedback
);

// GET /api/v1/members/:memberId/feedback
memberFeedbackRouter.get(
  '/',
  authorize(Role.MEMBER, Role.TRAINER, Role.GYM_OWNER, Role.BRANCH_MANAGER, Role.SUPER_ADMIN),
  FeedbackController.listFeedbackForMember
);

export const generalFeedbackRouter = Router({ mergeParams: true });

generalFeedbackRouter.use(authenticate);

// PATCH /api/v1/feedback/:feedbackId
generalFeedbackRouter.patch(
  '/:feedbackId',
  authorize(Role.TRAINER, Role.GYM_OWNER, Role.BRANCH_MANAGER, Role.SUPER_ADMIN),
  validate(updateFeedbackSchema),
  FeedbackController.updateFeedback
);

// DELETE /api/v1/feedback/:feedbackId
generalFeedbackRouter.delete(
  '/:feedbackId',
  authorize(Role.TRAINER, Role.GYM_OWNER, Role.BRANCH_MANAGER, Role.SUPER_ADMIN),
  FeedbackController.deleteFeedback
);
