import { Router } from 'express';
import { AttendanceController } from './attendance.controller';
import { authenticate } from '../../common/middlewares/auth.middleware';
import { authorize } from '../../common/middlewares/authorize.middleware';
import { injectTenantScope } from '../../common/middlewares/tenant.middleware';
import { validate } from '../../common/middlewares/validate.middleware';
import { Role } from '../../common/constants/roles.enum';
import { checkInSchema, checkOutSchema, manualAttendanceSchema } from './attendance.validation';

const router = Router();
const branchAttendanceRouter = Router({ mergeParams: true });

// Check-in & Check-out Endpoints (Accessible by MEMBER, KIOSK, and STAFF)
router.post(
  '/check-in',
  authenticate,
  authorize(Role.MEMBER, Role.KIOSK, Role.GYM_OWNER, Role.BRANCH_MANAGER, Role.TRAINER, Role.SUPER_ADMIN),
  validate(checkInSchema, 'body'),
  AttendanceController.checkIn
);

router.post(
  '/check-out',
  authenticate,
  authorize(Role.MEMBER, Role.KIOSK, Role.GYM_OWNER, Role.BRANCH_MANAGER, Role.TRAINER, Role.SUPER_ADMIN),
  validate(checkOutSchema, 'body'),
  AttendanceController.checkOut
);

// Member Self-Access Endpoints
router.get('/me/current', authenticate, authorize(Role.MEMBER), AttendanceController.getCurrentSession);
router.get('/me/history', authenticate, authorize(Role.MEMBER), AttendanceController.getMyHistory);
router.get('/me/stats', authenticate, authorize(Role.MEMBER), AttendanceController.getMyStats);

// Staff Manual Attendance Entry Endpoint
router.post(
  '/manual',
  authenticate,
  authorize(Role.GYM_OWNER, Role.BRANCH_MANAGER, Role.TRAINER, Role.SUPER_ADMIN),
  validate(manualAttendanceSchema, 'body'),
  AttendanceController.manualCheckInOut
);

// Daily Branch Attendance Log Endpoint & QR Generation Endpoints
branchAttendanceRouter.use(authenticate);
branchAttendanceRouter.use(injectTenantScope);
branchAttendanceRouter.get(
  ['/:gymId/branches/:branchId/attendance/daily', '/:gymId/attendance/daily'],
  authorize(Role.GYM_OWNER, Role.BRANCH_MANAGER, Role.TRAINER, Role.SUPER_ADMIN, Role.KIOSK),
  AttendanceController.getBranchDailyAttendance
);

branchAttendanceRouter.get(
  ['/:gymId/branches/:branchId/attendance/generate-qr', '/:gymId/attendance/generate-qr'],
  authorize(Role.GYM_OWNER, Role.BRANCH_MANAGER, Role.KIOSK, Role.SUPER_ADMIN),
  AttendanceController.generateDynamicQR
);

branchAttendanceRouter.get(
  ['/:gymId/branches/:branchId/attendance/heatmap', '/:gymId/attendance-heatmap'],
  authorize(Role.GYM_OWNER, Role.BRANCH_MANAGER, Role.SUPER_ADMIN),
  AttendanceController.getAttendanceHeatmap
);

export { router as attendanceRouter, branchAttendanceRouter };
