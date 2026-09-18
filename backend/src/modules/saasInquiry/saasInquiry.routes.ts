import { Router } from 'express';
import { SaasInquiryController } from './saasInquiry.controller';
import { authenticate } from '../../common/middlewares/auth.middleware';
import { authorize } from '../../common/middlewares/authorize.middleware';
import { Role } from '../../common/constants/roles.enum';
import { publicLimiter } from '../../common/middlewares/rateLimiter.middleware';

export const publicSaasInquiryRouter = Router();
export const adminSaasInquiryRouter = Router();

// Public: Submit B2B SaaS demo/workspace inquiry from /register
publicSaasInquiryRouter.post('/', publicLimiter, SaasInquiryController.create);

// Super Admin Protected Routes:
adminSaasInquiryRouter.use(authenticate);
adminSaasInquiryRouter.use(authorize(Role.SUPER_ADMIN));

adminSaasInquiryRouter.get('/', SaasInquiryController.list);
adminSaasInquiryRouter.patch('/:id/status', SaasInquiryController.updateStatus);
adminSaasInquiryRouter.post('/:id/notes', SaasInquiryController.addNote);
