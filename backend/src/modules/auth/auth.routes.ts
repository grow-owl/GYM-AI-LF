import { Router } from 'express';
import { AuthController } from './auth.controller';
import { validate } from '../../common/middlewares/validate.middleware';
import { authenticate } from '../../common/middlewares/auth.middleware';
import { authorize } from '../../common/middlewares/authorize.middleware';
import { authLimiter } from '../../common/middlewares/rateLimiter.middleware';
import { Role } from '../../common/constants/roles.enum';
import {
  registerSchema,
  registerOwnerSchema,
  adminResetPasswordSchema,
  loginSchema,
  refreshTokenSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
  updateProfileSchema,
} from './auth.validation';

const router = Router();

// Public Auth Endpoints (Rate limited)
router.post('/register', authLimiter, validate(registerSchema, 'body'), AuthController.register);
router.post('/login', authLimiter, validate(loginSchema, 'body'), AuthController.login);
router.post('/refresh-token', validate(refreshTokenSchema, 'body'), AuthController.refreshToken);
router.post('/logout', AuthController.logout);
router.post('/forgot-password', authLimiter, validate(forgotPasswordSchema, 'body'), AuthController.forgotPassword);
router.post('/reset-password', validate(resetPasswordSchema, 'body'), AuthController.resetPassword);

// Authenticated Endpoints
router.use(authenticate);
router.get('/me', AuthController.getMe);
router.patch('/profile', validate(updateProfileSchema, 'body'), AuthController.updateProfile);
router.post('/logout-all', AuthController.logoutAll);

router.patch('/change-password', validate(changePasswordSchema, 'body'), AuthController.changePassword);

// Hidden Super Admin endpoint to register Gym Owners (not exposed on public UI)
router.post(
  '/register-owner',
  authorize(Role.SUPER_ADMIN),
  validate(registerOwnerSchema, 'body'),
  AuthController.registerOwner
);

// Admin/Owner forced password reset for Members, Trainers, or Staff in their Gym
router.patch(
  '/users/:userId/reset-password',
  authorize(Role.SUPER_ADMIN, Role.GYM_OWNER, Role.BRANCH_MANAGER),
  validate(adminResetPasswordSchema, 'body'),
  AuthController.adminResetPassword
);

export default router;
