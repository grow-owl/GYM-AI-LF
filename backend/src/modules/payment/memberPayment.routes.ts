import { Router } from 'express';
import { MemberPaymentController } from './memberPayment.controller';
import { authenticate } from '../../common/middlewares/auth.middleware';
import { authorize } from '../../common/middlewares/authorize.middleware';
import { validate } from '../../common/middlewares/validate.middleware';
import { Role } from '../../common/constants/roles.enum';
import {
  recordMemberPaymentSchema,
  refundPaymentSchema,
} from './payment.validation';

const gymMemberPaymentRouter = Router({ mergeParams: true });

// Authenticated Routes under /api/v1/gyms/:gymId/payments
gymMemberPaymentRouter.use(authenticate);

gymMemberPaymentRouter.post(
  '/manual',
  authorize(Role.GYM_OWNER, Role.BRANCH_MANAGER, Role.SUPER_ADMIN, Role.KIOSK),
  validate(recordMemberPaymentSchema, 'body'),
  MemberPaymentController.recordManualPayment
);

gymMemberPaymentRouter.get(
  '/me',
  authorize(Role.MEMBER),
  MemberPaymentController.getMyPayments
);

gymMemberPaymentRouter.get(
  '/',
  authorize(Role.GYM_OWNER, Role.BRANCH_MANAGER, Role.SUPER_ADMIN, Role.KIOSK),
  MemberPaymentController.listPayments
);

gymMemberPaymentRouter.get(
  '/revenue-summary',
  authorize(Role.GYM_OWNER, Role.BRANCH_MANAGER, Role.SUPER_ADMIN, Role.KIOSK),
  MemberPaymentController.getRevenueSummary
);

gymMemberPaymentRouter.patch(
  '/:paymentId/refund',
  authorize(Role.GYM_OWNER, Role.SUPER_ADMIN),
  validate(refundPaymentSchema, 'body'),
  MemberPaymentController.refundPayment
);

gymMemberPaymentRouter.patch(
  '/:paymentId',
  authorize(Role.GYM_OWNER, Role.BRANCH_MANAGER, Role.SUPER_ADMIN),
  MemberPaymentController.updatePayment
);

gymMemberPaymentRouter.delete(
  '/:paymentId',
  authorize(Role.GYM_OWNER, Role.BRANCH_MANAGER, Role.SUPER_ADMIN),
  MemberPaymentController.deletePayment
);

export { gymMemberPaymentRouter };
