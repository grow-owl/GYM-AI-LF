import { Router } from 'express';
import { ProgressController } from './progress.controller';
import { authenticate } from '../../common/middlewares/auth.middleware';
import { authorize } from '../../common/middlewares/authorize.middleware';
import { validate } from '../../common/middlewares/validate.middleware';
import { Role } from '../../common/constants/roles.enum';
import { logWeightSchema, uploadProgressPhotoSchema, logWellnessSchema, logMealSchema } from './progress.validation';

const router = Router();

router.use(authenticate);

// Weight Logging (Member self-log or Trainer/Staff log for a client)
router.post(
  '/weight',
  authorize(Role.MEMBER, Role.TRAINER, Role.GYM_OWNER, Role.BRANCH_MANAGER, Role.SUPER_ADMIN),
  validate(logWeightSchema, 'body'),
  ProgressController.logWeight
);
router.get(
  ['/weight/history', '/weight/history/:memberId'],
  authorize(Role.MEMBER, Role.TRAINER, Role.GYM_OWNER, Role.BRANCH_MANAGER, Role.SUPER_ADMIN, Role.KIOSK),
  ProgressController.getWeightHistory
);

router.post(
  '/photos',
  authorize(Role.MEMBER),
  validate(uploadProgressPhotoSchema, 'body'),
  ProgressController.uploadProgressPhoto
);
router.get(
  ['/photos', '/photos/:memberId'],
  authorize(Role.MEMBER, Role.TRAINER, Role.GYM_OWNER, Role.BRANCH_MANAGER, Role.SUPER_ADMIN, Role.KIOSK),
  ProgressController.getProgressPhotos
);
router.delete(
  '/photos/:photoId',
  authorize(Role.MEMBER, Role.TRAINER, Role.GYM_OWNER, Role.BRANCH_MANAGER, Role.SUPER_ADMIN),
  ProgressController.deleteProgressPhoto
);

router.patch(
  '/wellness',
  authorize(Role.MEMBER),
  validate(logWellnessSchema, 'body'),
  ProgressController.logWellness
);
router.get(
  ['/wellness/history', '/wellness/history/:memberId'],
  authorize(Role.MEMBER, Role.TRAINER, Role.GYM_OWNER, Role.BRANCH_MANAGER, Role.SUPER_ADMIN, Role.KIOSK),
  ProgressController.getWellnessHistory
);

router.post(
  '/diet-log',
  authorize(Role.MEMBER),
  validate(logMealSchema, 'body'),
  ProgressController.logDietMeal
);
router.get(
  ['/diet-log', '/diet-log/:memberId'],
  authorize(Role.MEMBER, Role.TRAINER, Role.GYM_OWNER, Role.BRANCH_MANAGER, Role.SUPER_ADMIN, Role.KIOSK),
  ProgressController.getDietLogs
);

router.get(
  ['/summary', '/summary/:memberId'],
  authorize(Role.MEMBER, Role.TRAINER, Role.GYM_OWNER, Role.BRANCH_MANAGER, Role.SUPER_ADMIN, Role.KIOSK),
  ProgressController.getProgressSummary
);

export default router;
