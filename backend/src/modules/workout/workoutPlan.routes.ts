import { Router } from 'express';
import { WorkoutPlanController } from './workoutPlan.controller';
import { authenticate } from '../../common/middlewares/auth.middleware';
import { authorize } from '../../common/middlewares/authorize.middleware';
import { validate } from '../../common/middlewares/validate.middleware';
import { Role } from '../../common/constants/roles.enum';
import { createWorkoutPlanSchema, updateWorkoutPlanSchema } from './workoutPlan.validation';

const memberPlanRouter = Router({ mergeParams: true });
const generalPlanRouter = Router();

// Member-scoped Plan Routes (/api/v1/members/:memberId/workout-plans)
memberPlanRouter.use(authenticate);
memberPlanRouter.post(
  '/',
  authorize(Role.GYM_OWNER, Role.BRANCH_MANAGER, Role.TRAINER, Role.SUPER_ADMIN),
  validate(createWorkoutPlanSchema, 'body'),
  WorkoutPlanController.createWorkoutPlan
);
memberPlanRouter.get(
  '/',
  authorize(Role.MEMBER, Role.TRAINER, Role.GYM_OWNER, Role.BRANCH_MANAGER, Role.SUPER_ADMIN, Role.KIOSK),
  WorkoutPlanController.listPlans
);
memberPlanRouter.get(
  '/active',
  authorize(Role.MEMBER, Role.TRAINER, Role.GYM_OWNER, Role.BRANCH_MANAGER, Role.SUPER_ADMIN, Role.KIOSK),
  WorkoutPlanController.getActivePlan
);

// Direct Plan Routes (/api/v1/workout-plans/...)
generalPlanRouter.use(authenticate);
generalPlanRouter.patch(
  '/:planId',
  authorize(Role.GYM_OWNER, Role.BRANCH_MANAGER, Role.TRAINER, Role.SUPER_ADMIN),
  validate(updateWorkoutPlanSchema, 'body'),
  WorkoutPlanController.updateWorkoutPlan
);
generalPlanRouter.patch(
  '/:planId/archive',
  authorize(Role.GYM_OWNER, Role.BRANCH_MANAGER, Role.TRAINER, Role.SUPER_ADMIN),
  WorkoutPlanController.archiveWorkoutPlan
);
generalPlanRouter.post(
  '/:planId/duplicate',
  authorize(Role.GYM_OWNER, Role.BRANCH_MANAGER, Role.TRAINER, Role.SUPER_ADMIN),
  WorkoutPlanController.duplicatePlan
);
generalPlanRouter.delete(
  '/:planId',
  authorize(Role.GYM_OWNER, Role.BRANCH_MANAGER, Role.TRAINER, Role.SUPER_ADMIN),
  WorkoutPlanController.deleteWorkoutPlan
);

export { memberPlanRouter, generalPlanRouter };
