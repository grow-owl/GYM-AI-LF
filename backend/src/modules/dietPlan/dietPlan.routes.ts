import { Router } from 'express';
import { DietPlanController } from './dietPlan.controller';
import { authenticate } from '../../common/middlewares/auth.middleware';
import { authorize } from '../../common/middlewares/authorize.middleware';
import { validate } from '../../common/middlewares/validate.middleware';
import { Role } from '../../common/constants/roles.enum';
import { createDietPlanSchema, updateDietPlanSchema } from './dietPlan.validation';

const memberDietRouter = Router({ mergeParams: true });
const generalDietRouter = Router();

// Member-scoped Diet Plan Routes (/api/v1/members/:memberId/diet-plans)
memberDietRouter.use(authenticate);
memberDietRouter.post(
  '/',
  authorize(Role.GYM_OWNER, Role.BRANCH_MANAGER, Role.TRAINER, Role.SUPER_ADMIN),
  validate(createDietPlanSchema, 'body'),
  DietPlanController.createDietPlan
);
memberDietRouter.get(
  '/active',
  authorize(Role.MEMBER, Role.TRAINER, Role.GYM_OWNER, Role.BRANCH_MANAGER, Role.SUPER_ADMIN, Role.KIOSK),
  DietPlanController.getActiveDietPlan
);
memberDietRouter.get(
  '/',
  authorize(Role.MEMBER, Role.TRAINER, Role.GYM_OWNER, Role.BRANCH_MANAGER, Role.SUPER_ADMIN, Role.KIOSK),
  DietPlanController.listDietPlans
);

// Direct Diet Plan Routes (/api/v1/diet-plans/...)
generalDietRouter.use(authenticate);
generalDietRouter.patch(
  '/:planId',
  authorize(Role.GYM_OWNER, Role.BRANCH_MANAGER, Role.TRAINER, Role.SUPER_ADMIN),
  validate(updateDietPlanSchema, 'body'),
  DietPlanController.updateDietPlan
);
generalDietRouter.patch(
  '/:planId/archive',
  authorize(Role.GYM_OWNER, Role.BRANCH_MANAGER, Role.TRAINER, Role.SUPER_ADMIN),
  DietPlanController.archiveDietPlan
);
generalDietRouter.delete(
  '/:planId',
  authorize(Role.GYM_OWNER, Role.BRANCH_MANAGER, Role.TRAINER, Role.SUPER_ADMIN),
  DietPlanController.deleteDietPlan
);

export { memberDietRouter, generalDietRouter as dietPlanRouter };
