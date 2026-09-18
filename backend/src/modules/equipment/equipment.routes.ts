import { Router } from 'express';
import { EquipmentController } from './equipment.controller';
import { authenticate } from '../../common/middlewares/auth.middleware';
import { authorize } from '../../common/middlewares/authorize.middleware';
import { tenantScope } from '../../common/middlewares/tenant.middleware';
import { validate } from '../../common/middlewares/validate.middleware';
import { Role } from '../../common/constants/roles.enum';
import { createEquipmentSchema, updateEquipmentSchema } from './equipment.validation';

const router = Router();

router.use(authenticate);
router.use(tenantScope);

// Routes scoped under equipment
router.post(
  ['/gyms/:gymId/branches/:branchId/equipment', '/gyms/:gymId/equipment'],
  authorize(Role.GYM_OWNER, Role.BRANCH_MANAGER, Role.SUPER_ADMIN),
  validate(createEquipmentSchema, 'body'),
  EquipmentController.createEquipment
);

router.get(
  ['/gyms/:gymId/branches/:branchId/equipment', '/gyms/:gymId/equipment'],
  authorize(Role.GYM_OWNER, Role.BRANCH_MANAGER, Role.TRAINER, Role.SUPER_ADMIN),
  EquipmentController.listEquipment
);

// Maintenance due shortcut endpoint
router.get(
  '/gyms/:gymId/equipment/maintenance-due',
  authorize(Role.GYM_OWNER, Role.BRANCH_MANAGER, Role.TRAINER, Role.SUPER_ADMIN),
  EquipmentController.getMaintenanceDueEquipment
);

// Direct equipment ID routes
router.patch(
  '/equipment/:equipmentId',
  authorize(Role.GYM_OWNER, Role.BRANCH_MANAGER, Role.SUPER_ADMIN),
  validate(updateEquipmentSchema, 'body'),
  EquipmentController.updateEquipment
);

router.delete(
  '/equipment/:equipmentId',
  authorize(Role.GYM_OWNER, Role.BRANCH_MANAGER, Role.SUPER_ADMIN),
  EquipmentController.softDeleteEquipment
);

export default router;
