import { Router } from 'express';
import { TrainerController } from './trainer.controller';
import { authenticate } from '../../common/middlewares/auth.middleware';
import { authorize } from '../../common/middlewares/authorize.middleware';
import { injectTenantScope } from '../../common/middlewares/tenant.middleware';
import { validate } from '../../common/middlewares/validate.middleware';
import { Role } from '../../common/constants/roles.enum';
import { createTrainerSchema, updateTrainerSchema } from './trainer.validation';

const router = Router({ mergeParams: true });

router.use(authenticate);
router.use(injectTenantScope);

router.post(
  '/:gymId/branches/:branchId/trainers',
  authorize(Role.GYM_OWNER, Role.BRANCH_MANAGER, Role.SUPER_ADMIN),
  validate(createTrainerSchema, 'body'),
  TrainerController.createTrainer
);

router.get(
  ['/:gymId/branches/:branchId/trainers', '/:gymId/trainers'],
  authorize(Role.GYM_OWNER, Role.BRANCH_MANAGER, Role.TRAINER, Role.SUPER_ADMIN),
  TrainerController.listTrainers
);

router.get(
  '/:gymId/trainers/me/clients',
  authorize(Role.TRAINER),
  TrainerController.getTrainerClients
);

router.get(
  '/:gymId/trainers/:trainerId',
  authorize(Role.GYM_OWNER, Role.BRANCH_MANAGER, Role.TRAINER, Role.SUPER_ADMIN),
  TrainerController.getTrainerById
);

router.patch(
  '/:gymId/trainers/:trainerId',
  authorize(Role.GYM_OWNER, Role.BRANCH_MANAGER, Role.SUPER_ADMIN),
  validate(updateTrainerSchema, 'body'),
  TrainerController.updateTrainer
);

router.delete(
  '/:gymId/trainers/:trainerId',
  authorize(Role.GYM_OWNER, Role.BRANCH_MANAGER, Role.SUPER_ADMIN),
  TrainerController.softDeleteTrainer
);

router.get(
  '/:gymId/trainers/:trainerId/workload',
  authorize(Role.GYM_OWNER, Role.BRANCH_MANAGER, Role.TRAINER, Role.SUPER_ADMIN),
  TrainerController.getTrainerWorkload
);

export default router;
