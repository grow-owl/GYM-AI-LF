import { Request, Response, NextFunction } from 'express';
import { Types } from 'mongoose';
import { AppError } from '../utils/AppError';
import { Role } from '../constants/roles.enum';
import { Gym } from '../../modules/gym/gym.model';
import { GymStatus, GymPlan } from '../../modules/gym/gym.types';

/**
 * Middleware: Inject tenant scope into req.tenant based on req.user
 */
export const injectTenantScope = (req: Request, _res: Response, next: NextFunction): void => {
  if (!req.user) {
    return next(AppError.unauthorized('Authentication required before tenant scoping'));
  }

  const isSuperAdmin = req.user.role === Role.SUPER_ADMIN;

  let gymId: string | undefined;
  let branchId: string | undefined;

  if (isSuperAdmin) {
    // SuperAdmin can target any gym via request params/headers (for admin operations)
    gymId =
      req.user.gymId ||
      (req.params?.gymId as string) ||
      (req.query?.gymId as string) ||
      (req.headers['x-gym-id'] as string);

    branchId =
      req.user.branchId ||
      (req.params?.branchId as string) ||
      (req.query?.branchId as string) ||
      (req.headers['x-branch-id'] as string);
  } else {
    // Non-SuperAdmin: tenant scope MUST come from the verified JWT token only.
    // Client-supplied headers/query/params are IGNORED to prevent tenant bypass attacks.
    gymId = req.user.gymId;
    branchId = req.user.branchId;
  }

  req.tenant = {
    gymId,
    branchId,
  };

  next();
};

/**
 * Helper function for service layer:
 * Verifies that a target resource's gymId matches the authenticated req.tenant.gymId
 * Prevents IDOR and cross-tenant data leakage.
 */
export const assertTenantMatch = (
  resourceGymId: string | Types.ObjectId | undefined | null,
  req: Request
): void => {
  // SUPER_ADMIN bypasses tenant check
  if (req.user?.role === Role.SUPER_ADMIN) {
    return;
  }

  if (!resourceGymId) {
    throw AppError.forbidden('Tenant verification failed: Missing tenant identifier');
  }

  // If user has a tenant gymId set, verify match or allow demo placeholder
  if (req.tenant?.gymId && resourceGymId) {
    const resGymIdStr = resourceGymId.toString();
    const reqGymIdStr = req.tenant.gymId.toString();

    if (resGymIdStr !== reqGymIdStr) {
      throw AppError.forbidden('Access denied: Resource belongs to a different tenant organization');
    }
  }
};

/**
 * Middleware: Verify that gym organization status is ACTIVE for non-SuperAdmins
 */
export const checkGymActive = async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
  if (req.user?.role === Role.SUPER_ADMIN) {
    return next();
  }

  const gymId = req.tenant?.gymId || (req.params?.gymId as string);
  if (!gymId || !Types.ObjectId.isValid(gymId)) {
    return next();
  }

  try {
    const gym = await Gym.findOne({ _id: gymId, isDeleted: false }).select('status plan trialEndsAt');
    if (gym) {
      // Real-time trial expiry check
      if (gym.plan === GymPlan.TRIAL && gym.trialEndsAt && new Date(gym.trialEndsAt) < new Date()) {
        if (gym.status !== GymStatus.TRIAL_EXPIRED) {
          gym.status = GymStatus.TRIAL_EXPIRED;
          await gym.save();
        }
      }

      if (gym.status === GymStatus.SUSPENDED || gym.status === GymStatus.TRIAL_EXPIRED) {
        if (req.originalUrl.includes('/billing') || req.originalUrl.includes('/payments')) {
          return next();
        }
        if (gym.status === GymStatus.TRIAL_EXPIRED) {
          return next(
            AppError.forbidden(
              'Your free trial has expired. Please upgrade your subscription plan to restore full access.'
            )
          );
        }
        return next(
          AppError.forbidden(
            `Gym organization subscription status is '${gym.status}'. Please upgrade or renew your plan to continue accessing services.`
          )
        );
      }
    }
  } catch (e) {
    return next(e);
  }

  next();
};

export const tenantScope = [injectTenantScope, checkGymActive];
