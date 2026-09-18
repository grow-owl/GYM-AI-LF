import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { sendSuccess } from '../../common/utils/ApiResponse';
import { asyncHandler } from '../../common/utils/asyncHandler';
import { AppError } from '../../common/utils/AppError';
import { env } from '../../config/env';
import { Branch } from '../gym/branch.model';
import { OwnerInsightsService } from '../aiCoach/ownerInsights.service';

const REFRESH_COOKIE_NAME = 'refreshToken';
const REFRESH_COOKIE_MAX_AGE = 7 * 24 * 60 * 60 * 1000;

// 'strict' was dropping this cookie in two very real scenarios:
//  1. Opening the app from an external link (a QR code scanned with the
//     phone's normal camera app, a WhatsApp/SMS link, etc.) is treated by the
//     browser as a cross-site top-level navigation, so a Strict cookie never
//     rides along on that first load — the very next silent refresh call then
//     has nothing to refresh with, and the user gets bounced to /login.
//  2. Any production deployment where the frontend and API live on different
//     domains needs SameSite=None (+ Secure) — 'strict'/'lax' block it outright.
// 'lax' is the right default for same-site dev; 'none' (+ secure) for prod.
const isProd = env.NODE_ENV === 'production';
const REFRESH_COOKIE_SAME_SITE: 'lax' | 'none' = isProd ? 'none' : 'lax';

const setRefreshTokenCookie = (res: Response, token: string): void => {
  res.cookie(REFRESH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: isProd,
    sameSite: REFRESH_COOKIE_SAME_SITE,
    path: '/api/v1/auth',
    maxAge: REFRESH_COOKIE_MAX_AGE,
  });
};

const clearRefreshTokenCookie = (res: Response): void => {
  res.clearCookie(REFRESH_COOKIE_NAME, {
    httpOnly: true,
    secure: isProd,
    sameSite: REFRESH_COOKIE_SAME_SITE,
    path: '/api/v1/auth',
  });
};

export class AuthController {
  public static register = asyncHandler(async (req: Request, res: Response) => {
    const { user, accessToken, refreshToken } = await AuthService.registerUser(req.body);

    setRefreshTokenCookie(res, refreshToken);

    const safeUser = user.toSafeJSON ? user.toSafeJSON() : user;
    return sendSuccess(res, { user: safeUser, accessToken }, 'User identity registered successfully', 201);
  });

  public static login = asyncHandler(async (req: Request, res: Response) => {
    const ipAddress = req.ip || req.socket.remoteAddress || '127.0.0.1';
    const { user, accessToken, refreshToken } = await AuthService.loginUser(
      req.body.email,
      req.body.password,
      ipAddress
    );

    setRefreshTokenCookie(res, refreshToken);
    if (user.gymId) {
      OwnerInsightsService.clearWeeklyDigestCache(user.gymId.toString());
    }

    const safeUser = user.toSafeJSON ? user.toSafeJSON() : user;
    return sendSuccess(
      res,
      { user: safeUser, accessToken },
      'User authenticated successfully',
      200
    );
  });

  public static refreshToken = asyncHandler(async (req: Request, res: Response) => {
    const token = req.cookies?.refreshToken || req.body?.refreshToken;
    const ipAddress = req.ip || req.socket.remoteAddress || '127.0.0.1';

    const { accessToken, refreshToken: newRefreshToken } =
      await AuthService.refreshAccessToken(token, ipAddress);

    setRefreshTokenCookie(res, newRefreshToken);

    return sendSuccess(res, { accessToken }, 'Access token refreshed successfully', 200);
  });

  public static logout = asyncHandler(async (req: Request, res: Response) => {
    const token = req.cookies?.refreshToken || req.body?.refreshToken;
    if (token) {
      await AuthService.logoutUser(token);
    }
    clearRefreshTokenCookie(res);
    return sendSuccess(res, null, 'Logged out successfully', 200);
  });

  public static logoutAll = asyncHandler(async (req: Request, res: Response) => {
    if (req.user?.id) {
      await AuthService.logoutAllSessions(req.user.id);
    }
    clearRefreshTokenCookie(res);
    return sendSuccess(res, null, 'Logged out from all active sessions', 200);
  });

  public static forgotPassword = asyncHandler(async (req: Request, res: Response) => {
    const message = await AuthService.forgotPassword(req.body.email);
    return sendSuccess(res, null, message, 200);
  });

  public static resetPassword = asyncHandler(async (req: Request, res: Response) => {
    await AuthService.resetPassword(req.body.token, req.body.newPassword);
    return sendSuccess(res, null, 'Password reset successfully. Please log in with your new password.', 200);
  });

  public static changePassword = asyncHandler(async (req: Request, res: Response) => {
    await AuthService.changePassword(
      req.user!.id,
      req.body.currentPassword,
      req.body.newPassword
    );
    clearRefreshTokenCookie(res);
    return sendSuccess(res, null, 'Password changed successfully. Please log in again.', 200);
  });

  public static getMe = asyncHandler(async (req: Request, res: Response) => {
    const user = await AuthService.getMe(req.user!.id);
    const safeUser = user.toSafeJSON ? user.toSafeJSON() : user;
    return sendSuccess(res, { user: safeUser }, 'User profile retrieved successfully', 200);
  });

  public static registerOwner = asyncHandler(async (req: Request, res: Response) => {
    const result = await AuthService.registerGymOwnerBySuperAdmin(req.body);
    const safeUser = result.user.toSafeJSON ? result.user.toSafeJSON() : result.user;
    return sendSuccess(
      res,
      { user: safeUser, gym: result.gym, primaryBranch: result.primaryBranch, tempPassword: result.tempPassword },
      'Gym Owner and Gym Organization created successfully by Super Admin',
      201
    );
  });

  public static adminResetPassword = asyncHandler(async (req: Request, res: Response) => {
    await AuthService.adminResetUserPassword(
      { id: req.user!.id, role: req.user!.role as any, gymId: req.user!.gymId },
      req.params.userId,
      req.body.newPassword
    );
    return sendSuccess(res, null, 'User password reset successfully by administrator', 200);
  });

  public static registerStaff = asyncHandler(async (req: Request, res: Response) => {
    const gymId = req.params.gymId || req.user?.gymId;
    if (!gymId) {
      throw AppError.badRequest('Gym ID is required for staff registration');
    }

    let branchId = req.params.branchId || req.body?.branchId || req.user?.branchId;
    if (!branchId) {
      const branches = await Branch.find({ gymId, isDeleted: false });
      if (branches.length === 1) {
        branchId = branches[0]._id.toString();
      } else if (branches.length > 1) {
        throw AppError.badRequest(
          'Branch ID is required when a gym has multiple branches. Please select a specific branch.'
        );
      } else {
        throw AppError.badRequest('No active branch found for this gym. Please create a branch first.');
      }
    }

    const user = await AuthService.registerStaff(gymId, branchId, req.body);
    const safeUser = user.toSafeJSON ? user.toSafeJSON() : user;
    return sendSuccess(res, { staff: safeUser }, 'Staff member created successfully', 201);
  });

  public static listStaff = asyncHandler(async (req: Request, res: Response) => {
    const gymId = req.params.gymId || req.user?.gymId;
    if (!gymId) {
      throw AppError.badRequest('Gym ID is required to list staff members');
    }
    const branchId = req.params.branchId || (req.query.branchId as string);
    const staff = await AuthService.listStaff(gymId, branchId);
    return sendSuccess(res, { staff }, 'Staff members retrieved successfully', 200);
  });

  public static updateProfile = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const user = await AuthService.updateProfile(userId, req.body);
    const safeUser = user.toSafeJSON ? user.toSafeJSON() : user;
    return sendSuccess(res, { user: safeUser }, 'Profile updated successfully', 200);
  });

  public static deleteStaff = asyncHandler(async (req: Request, res: Response) => {
    const gymId = req.params.gymId || req.user?.gymId;
    const { staffId } = req.params;
    if (!gymId || !staffId) {
      throw AppError.badRequest('Gym ID and Staff ID are required');
    }
    await AuthService.deleteStaff(gymId, staffId);
    return sendSuccess(res, null, 'Staff member deleted successfully', 200);
  });
}

