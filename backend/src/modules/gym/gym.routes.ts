import { Router } from 'express';
import { GymController } from './gym.controller';
import { AuthController } from '../auth/auth.controller';
import { authenticate } from '../../common/middlewares/auth.middleware';
import { authorize } from '../../common/middlewares/authorize.middleware';
import { injectTenantScope } from '../../common/middlewares/tenant.middleware';
import { validate } from '../../common/middlewares/validate.middleware';
import { Role } from '../../common/constants/roles.enum';
import {
  createGymSchema,
  updateGymSchema,
  updateGymPlanSchema,
  createBranchSchema,
  updateBranchSchema,
  assignManagerSchema,
} from './gym.validation';
import { registerStaffSchema } from '../auth/auth.validation';

const router = Router();

// Apply Authentication and Tenant Scoping on all Gym Routes
router.use(authenticate);
router.use(injectTenantScope);

router.get(
  '/',
  authorize(Role.SUPER_ADMIN),
  GymController.listAllGyms
);

router.post(
  '/',
  authorize(Role.GYM_OWNER, Role.SUPER_ADMIN),
  validate(createGymSchema, 'body'),
  GymController.createGym
);

router.get(
  '/:gymId',
  authorize(Role.GYM_OWNER, Role.SUPER_ADMIN, Role.BRANCH_MANAGER, Role.TRAINER),
  GymController.getGymById
);

router.patch(
  '/:gymId',
  authorize(Role.GYM_OWNER, Role.SUPER_ADMIN),
  validate(updateGymSchema, 'body'),
  GymController.updateGym
);

router.delete(
  '/:gymId',
  authorize(Role.GYM_OWNER, Role.SUPER_ADMIN),
  GymController.softDeleteGym
);

router.patch(
  '/:gymId/plan',
  authorize(Role.GYM_OWNER, Role.SUPER_ADMIN),
  validate(updateGymPlanSchema, 'body'),
  GymController.updateGymPlan
);

router.get(
  '/:gymId/overview',
  authorize(Role.GYM_OWNER, Role.SUPER_ADMIN, Role.BRANCH_MANAGER),
  GymController.getGymOverview
);

// Gym Membership Plans Routes
router.get(
  '/:gymId/membership-plans',
  authorize(Role.GYM_OWNER, Role.SUPER_ADMIN, Role.BRANCH_MANAGER, Role.TRAINER, Role.MEMBER, Role.KIOSK),
  GymController.getMembershipPlans
);

router.put(
  '/:gymId/membership-plans',
  authorize(Role.GYM_OWNER, Role.SUPER_ADMIN),
  GymController.updateMembershipPlans
);

// Branch Routes
router.post(
  '/:gymId/branches',
  authorize(Role.GYM_OWNER, Role.SUPER_ADMIN),
  validate(createBranchSchema, 'body'),
  GymController.createBranch
);

router.get(
  '/:gymId/branches',
  authorize(Role.GYM_OWNER, Role.SUPER_ADMIN, Role.BRANCH_MANAGER, Role.TRAINER, Role.MEMBER, Role.KIOSK),
  GymController.listBranches
);

router.get(
  '/:gymId/branches/:branchId',
  authorize(Role.GYM_OWNER, Role.SUPER_ADMIN, Role.BRANCH_MANAGER, Role.TRAINER, Role.MEMBER, Role.KIOSK),
  GymController.getBranchById
);

router.patch(
  '/:gymId/branches/:branchId',
  authorize(Role.GYM_OWNER, Role.SUPER_ADMIN),
  validate(updateBranchSchema, 'body'),
  GymController.updateBranch
);

router.delete(
  '/:gymId/branches/:branchId',
  authorize(Role.GYM_OWNER, Role.SUPER_ADMIN),
  GymController.softDeleteBranch
);

router.patch(
  '/:gymId/branches/:branchId/manager',
  authorize(Role.GYM_OWNER, Role.SUPER_ADMIN),
  validate(assignManagerSchema, 'body'),
  GymController.assignBranchManager
);

// Staff Routes (Non-trainer staff creation & management)
router.post(
  ['/:gymId/branches/:branchId/staff', '/:gymId/staff'],
  authorize(Role.GYM_OWNER, Role.SUPER_ADMIN),
  validate(registerStaffSchema, 'body'),
  AuthController.registerStaff
);

router.get(
  ['/:gymId/branches/:branchId/staff', '/:gymId/staff'],
  authorize(Role.GYM_OWNER, Role.SUPER_ADMIN, Role.BRANCH_MANAGER),
  AuthController.listStaff
);

router.delete(
  ['/:gymId/branches/:branchId/staff/:staffId', '/:gymId/staff/:staffId'],
  authorize(Role.GYM_OWNER, Role.SUPER_ADMIN),
  AuthController.deleteStaff
);

export default router;
