import { Router } from 'express';
import { DataPrivacyController } from './dataPrivacy.controller';
import { authenticate } from '../../common/middlewares/auth.middleware';
import { tenantScope } from '../../common/middlewares/tenant.middleware';

const router = Router();

router.use(authenticate);
router.use(tenantScope);

router.get('/me/export-data', DataPrivacyController.exportData);
router.post('/me/request-deletion', DataPrivacyController.requestDeletion);
router.post('/me/cancel-deletion', DataPrivacyController.cancelDeletion);

export default router;
