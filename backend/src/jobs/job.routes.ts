import { Router } from 'express';
import { JobController } from './job.controller';
import { authenticate } from '../common/middlewares/auth.middleware';
import { authorize } from '../common/middlewares/authorize.middleware';
import { injectTenantScope } from '../common/middlewares/tenant.middleware';
import { Role } from '../common/constants/roles.enum';

const router = Router();

router.use(authenticate);

router.post(
  '/:gymId/jobs/run-reminders',
  injectTenantScope,
  authorize(Role.GYM_OWNER, Role.SUPER_ADMIN),
  JobController.runReminders
);

export default router;
