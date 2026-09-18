import { Router } from 'express';
import { ExerciseController } from './exercise.controller';
import { authenticate } from '../../common/middlewares/auth.middleware';
import { authorize } from '../../common/middlewares/authorize.middleware';
import { injectTenantScope } from '../../common/middlewares/tenant.middleware';
import { validate } from '../../common/middlewares/validate.middleware';
import { Role } from '../../common/constants/roles.enum';
import { createExerciseSchema, updateExerciseSchema } from './exercise.validation';

const router = Router();

router.use(authenticate);

router.get('/', ExerciseController.listExercises);
router.get('/:exerciseId', ExerciseController.getExerciseById);

router.post(
  '/',
  authorize(Role.GYM_OWNER, Role.BRANCH_MANAGER, Role.TRAINER, Role.SUPER_ADMIN),
  injectTenantScope,
  validate(createExerciseSchema, 'body'),
  ExerciseController.createExercise
);

router.patch(
  '/:exerciseId',
  authorize(Role.GYM_OWNER, Role.BRANCH_MANAGER, Role.TRAINER, Role.SUPER_ADMIN),
  injectTenantScope,
  validate(updateExerciseSchema, 'body'),
  ExerciseController.updateExercise
);

router.delete(
  '/:exerciseId',
  authorize(Role.GYM_OWNER, Role.BRANCH_MANAGER, Role.TRAINER, Role.SUPER_ADMIN),
  injectTenantScope,
  ExerciseController.deleteExercise
);

router.post(
  '/seed-global',
  authorize(Role.SUPER_ADMIN),
  ExerciseController.seedGlobalLibrary
);

export default router;
