import { Router } from 'express';
import { MemberController } from './member.controller';
import { ReferralController } from './referral.controller';
import { authenticate } from '../../common/middlewares/auth.middleware';
import { authorize } from '../../common/middlewares/authorize.middleware';
import { injectTenantScope } from '../../common/middlewares/tenant.middleware';
import { validate } from '../../common/middlewares/validate.middleware';
import { Role } from '../../common/constants/roles.enum';
import {
  createMemberSchema,
  updateMemberSchema,
  assignTrainerSchema,
  freezeMembershipSchema,
  renewMembershipSchema,
  extendMembershipSchema,
  cancelMembershipSchema,
} from './member.validation';

const gymMemberRouter = Router({ mergeParams: true });
const selfMemberRouter = Router();

// 1. Logged-in Member Self-Access & Referral Trigger Routes (/members/me, /members/:memberId/referral-ask)
selfMemberRouter.use(authenticate);
selfMemberRouter.get('/me', authorize(Role.MEMBER), MemberController.getMe);
selfMemberRouter.get('/me/referral-stats', authorize(Role.MEMBER), MemberController.getMyReferralStats);
selfMemberRouter.patch(
  '/me',
  authorize(Role.MEMBER),
  validate(updateMemberSchema, 'body'),
  MemberController.updateMe
);
selfMemberRouter.post(
  '/:memberId/referral-ask',
  authorize(Role.GYM_OWNER, Role.BRANCH_MANAGER, Role.SUPER_ADMIN),
  ReferralController.sendReferralAsk
);

// 2. Admin & Staff Tenant-Scoped Gym Member Routes (/gyms/:gymId/...)
gymMemberRouter.use(authenticate);
gymMemberRouter.use(injectTenantScope);

gymMemberRouter.post(
  '/:gymId/branches/:branchId/members',
  authorize(Role.GYM_OWNER, Role.BRANCH_MANAGER, Role.SUPER_ADMIN, Role.KIOSK),
  validate(createMemberSchema, 'body'),
  MemberController.createMember
);

gymMemberRouter.post(
  '/:gymId/members',
  authorize(Role.GYM_OWNER, Role.BRANCH_MANAGER, Role.SUPER_ADMIN, Role.KIOSK),
  validate(createMemberSchema, 'body'),
  MemberController.createMember
);

gymMemberRouter.get(
  '/:gymId/branches/:branchId/members',
  authorize(Role.GYM_OWNER, Role.BRANCH_MANAGER, Role.TRAINER, Role.SUPER_ADMIN, Role.KIOSK),
  MemberController.listMembers
);

gymMemberRouter.get(
  '/:gymId/members',
  authorize(Role.GYM_OWNER, Role.BRANCH_MANAGER, Role.TRAINER, Role.SUPER_ADMIN, Role.KIOSK),
  MemberController.listMembers
);

gymMemberRouter.get(
  '/:gymId/members/:memberId',
  authorize(Role.GYM_OWNER, Role.BRANCH_MANAGER, Role.TRAINER, Role.SUPER_ADMIN, Role.KIOSK),
  MemberController.getMemberById
);

gymMemberRouter.patch(
  '/:gymId/members/:memberId',
  authorize(Role.GYM_OWNER, Role.BRANCH_MANAGER, Role.TRAINER, Role.SUPER_ADMIN, Role.KIOSK),
  validate(updateMemberSchema, 'body'),
  MemberController.updateMember
);

gymMemberRouter.delete(
  '/:gymId/members/:memberId',
  authorize(Role.GYM_OWNER, Role.BRANCH_MANAGER, Role.SUPER_ADMIN),
  MemberController.softDeleteMember
);

gymMemberRouter.patch(
  '/:gymId/members/:memberId/assign-trainer',
  authorize(Role.GYM_OWNER, Role.BRANCH_MANAGER, Role.SUPER_ADMIN),
  validate(assignTrainerSchema, 'body'),
  MemberController.assignTrainer
);

gymMemberRouter.patch(
  '/:gymId/members/:memberId/freeze',
  authorize(Role.GYM_OWNER, Role.BRANCH_MANAGER, Role.SUPER_ADMIN, Role.KIOSK),
  validate(freezeMembershipSchema, 'body'),
  MemberController.freezeMembership
);

gymMemberRouter.patch(
  '/:gymId/members/:memberId/renew',
  authorize(Role.GYM_OWNER, Role.BRANCH_MANAGER, Role.SUPER_ADMIN, Role.KIOSK),
  validate(renewMembershipSchema, 'body'),
  MemberController.renewMembership
);

gymMemberRouter.patch(
  '/:gymId/members/:memberId/extend',
  authorize(Role.GYM_OWNER, Role.BRANCH_MANAGER, Role.SUPER_ADMIN, Role.KIOSK),
  validate(extendMembershipSchema, 'body'),
  MemberController.extendMembership
);

gymMemberRouter.patch(
  '/:gymId/members/:memberId/cancel',
  authorize(Role.GYM_OWNER, Role.BRANCH_MANAGER, Role.SUPER_ADMIN),
  validate(cancelMembershipSchema, 'body'),
  MemberController.cancelMembership
);

gymMemberRouter.post(
  '/:gymId/members/:memberId/regenerate-qr',
  authorize(Role.GYM_OWNER, Role.BRANCH_MANAGER, Role.SUPER_ADMIN, Role.KIOSK),
  MemberController.regenerateQRCode
);

gymMemberRouter.get(
  '/:gymId/members/:memberId/qr',
  authorize(Role.GYM_OWNER, Role.BRANCH_MANAGER, Role.TRAINER, Role.SUPER_ADMIN, Role.KIOSK),
  MemberController.getQRCode
);

export { gymMemberRouter, selfMemberRouter };
