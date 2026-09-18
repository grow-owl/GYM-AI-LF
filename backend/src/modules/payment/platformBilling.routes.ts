import { Router } from 'express';
import { PlatformBillingController } from './platformBilling.controller';
import { authenticate } from '../../common/middlewares/auth.middleware';
import { authorize } from '../../common/middlewares/authorize.middleware';
import { validate } from '../../common/middlewares/validate.middleware';
import { Role } from '../../common/constants/roles.enum';
import { recordManualPlatformPaymentSchema } from './payment.validation';

const router = Router();

// Authenticated Routes
router.use(authenticate);
router.get('/invoices', authorize(Role.GYM_OWNER, Role.SUPER_ADMIN), PlatformBillingController.getInvoices);

// Super Admin Manual Platform Payment & Revenue Analytics
router.post(
  '/gyms/:gymId/manual-payment',
  authorize(Role.SUPER_ADMIN),
  validate(recordManualPlatformPaymentSchema, 'body'),
  PlatformBillingController.recordManualPlatformPayment
);

router.get(
  '/analytics/overview',
  authorize(Role.SUPER_ADMIN),
  PlatformBillingController.getPlatformRevenueOverview
);

router.post(
  '/gyms/:gymId/upgrade-request',
  authorize(Role.GYM_OWNER),
  PlatformBillingController.createUpgradeRequest
);

router.delete(
  '/gyms/:gymId/upgrade-request',
  authorize(Role.GYM_OWNER),
  PlatformBillingController.cancelUpgradeRequest
);

router.get(
  '/upgrade-requests',
  authorize(Role.SUPER_ADMIN),
  PlatformBillingController.listUpgradeRequests
);

router.get(
  '/settings',
  authorize(Role.SUPER_ADMIN),
  PlatformBillingController.getPlatformSettings
);

router.put(
  '/settings',
  authorize(Role.SUPER_ADMIN),
  PlatformBillingController.updatePlatformSettings
);

export default router;
