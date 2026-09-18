import crypto from 'crypto';
import mongoose from 'mongoose';
import { User } from '../user/user.model';
import { RefreshToken } from './refreshToken.model';
import { IUser, Role } from '../user/user.types';
import { AppError } from '../../common/utils/AppError';
import { generateAccessToken, generateRefreshToken, verifyRefreshToken, TokenPayload } from '../../common/utils/generateTokens';
import { NotificationService } from '../notification/notification.service';
import { NotificationType } from '../notification/notification.types';
import { notificationTemplates } from '../notification/notificationTemplates';
import { logger } from '../../config/logger';

import { GymService } from '../gym/gym.service';

import { Gym } from '../gym/gym.model';
import { Branch } from '../gym/branch.model';

const REFRESH_TOKEN_EXPIRY_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export class AuthService {
  public static async registerUser(
    _input: Partial<IUser> & { referralCode?: string; ownerInviteCode?: string },
    _ipAddress?: string
  ): Promise<{ user: IUser; accessToken: string; refreshToken: string }> {
    throw AppError.forbidden(
      'Public self-registration is disabled. Gym SaaS workspaces are provisioned by our team, and gym members are enrolled directly by their gym.'
    );
  }

  public static async loginUser(
    email: string,
    passwordAttempt: string,
    ipAddress?: string
  ): Promise<{ user: IUser; accessToken: string; refreshToken: string }> {
    const user = await User.findOne({ email: email.toLowerCase(), isDeleted: false }).select('+password');

    if (!user) {
      throw AppError.unauthorized('Invalid email or password credentials');
    }

    if (!user.isActive) {
      throw AppError.forbidden('Account is deactivated');
    }

    // Account lock check
    if (user.lockUntil && user.lockUntil.getTime() > Date.now()) {
      throw AppError.unauthorized('Account is temporarily locked due to too many failed attempts. Try again later.');
    }

    const isMatch = await user.comparePassword(passwordAttempt);
    if (!isMatch) {
      // Increment failed attempts
      const MAX_ATTEMPTS = 5;
      const attempts = (user.failedLoginAttempts || 0) + 1;
      user.failedLoginAttempts = attempts;
      if (attempts >= MAX_ATTEMPTS) {
        user.lockUntil = new Date(Date.now() + 30 * 60 * 1000); // 30 min lock
      }
      await user.save();
      throw AppError.unauthorized('Invalid email or password credentials');
    }

    // Reset failed attempts on success
    if (user.failedLoginAttempts > 0 || user.lockUntil) {
      user.failedLoginAttempts = 0;
      user.lockUntil = undefined;
    }

    const tokenPayload: TokenPayload = {
      id: user._id.toString(),
      role: user.role,
      gymId: user.gymId?.toString(),
      branchId: user.branchId?.toString(),
    };

    const accessToken = generateAccessToken(tokenPayload);
    const refreshToken = generateRefreshToken(tokenPayload);

    await RefreshToken.create({
      userId: user._id,
      tokenHash: hashToken(refreshToken),
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_EXPIRY_MS),
      createdByIp: ipAddress,
      revoked: false,
    });

    user.lastLoginAt = new Date();
    await user.save();

    logger.info(`🔓 User logged in: [ID: ${user._id}] [Role: ${user.role}]`);

    const userObj: any = user.toSafeJSON ? user.toSafeJSON() : user.toObject();
    delete userObj.password;
    if (user.gymId) {
      const gymDoc = await Gym.findById(user.gymId);
      if (gymDoc) {
        userObj.gymName = gymDoc.name;
      }
    }
    if (user.branchId) {
      const branchDoc = await Branch.findById(user.branchId);
      if (branchDoc) {
        userObj.branchName = branchDoc.name;
      }
    }

    return {
      user: userObj,
      accessToken,
      refreshToken,
    };
  }

  public static async refreshAccessToken(
    providedRefreshToken: string,
    ipAddress?: string
  ): Promise<{ accessToken: string; refreshToken: string }> {
    let payload: TokenPayload;

    try {
      payload = verifyRefreshToken(providedRefreshToken);
    } catch (error) {
      throw AppError.unauthorized('Invalid or expired refresh token');
    }

    const providedHash = hashToken(providedRefreshToken);
    const existingToken = await RefreshToken.findOne({ tokenHash: providedHash });

    // Theft/reuse detection: if token not found or already revoked -> revoke ALL sessions for user
    if (!existingToken || existingToken.revoked) {
      if (payload?.id) {
        await RefreshToken.updateMany({ userId: payload.id, revoked: false }, { revoked: true });
      }
      logger.warn(`🚨 Refresh token reuse/theft detected for User ID: ${payload?.id}`);
      throw AppError.unauthorized('Session invalidated due to suspicious activity. Please log in again.');
    }

    const user = await User.findOne({ _id: payload.id, isDeleted: false, isActive: true });
    if (!user) {
      throw AppError.unauthorized('Invalid or expired refresh token');
    }

    const tokenPayload: TokenPayload = {
      id: user._id.toString(),
      role: user.role,
      gymId: user.gymId?.toString(),
      branchId: user.branchId?.toString(),
    };

    const newAccessToken = generateAccessToken(tokenPayload);
    const newRefreshToken = generateRefreshToken(tokenPayload);
    const newHash = hashToken(newRefreshToken);

    // Rotate token: revoke old token and set replacedByTokenHash
    existingToken.revoked = true;
    existingToken.replacedByTokenHash = newHash;
    await existingToken.save();

    // Create new RefreshToken document
    await RefreshToken.create({
      userId: user._id,
      tokenHash: newHash,
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_EXPIRY_MS),
      createdByIp: ipAddress,
      revoked: false,
    });

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    };
  }

  public static async refreshSession(token: string): Promise<{ accessToken: string; refreshToken: string }> {
    return this.refreshAccessToken(token);
  }

  public static async logoutUser(userIdOrToken: string): Promise<void> {
    const tokenHash = hashToken(userIdOrToken);
    const result = await RefreshToken.findOneAndUpdate({ tokenHash }, { revoked: true });

    if (!result) {
      // If passed a userId string instead of raw token
      await RefreshToken.updateMany({ userId: userIdOrToken, revoked: false }, { revoked: true });
    }
    logger.info('🔒 User session logged out');
  }

  public static async logoutAllSessions(userId: string): Promise<void> {
    await RefreshToken.updateMany({ userId, revoked: false }, { revoked: true });
    logger.info(`🔒 All sessions logged out for User ID: ${userId}`);
  }

  public static async getMe(userId: string): Promise<any> {
    const user = await User.findOne({ _id: userId, isDeleted: false });
    if (!user) throw AppError.notFound('User profile not found');

    const userObj: any = user.toSafeJSON ? user.toSafeJSON() : user.toObject();
    delete userObj.password;
    if (user.gymId) {
      const gymDoc = await Gym.findById(user.gymId);
      if (gymDoc) {
        userObj.gymName = gymDoc.name;
      }
    }
    if (user.branchId) {
      const branchDoc = await Branch.findById(user.branchId);
      if (branchDoc) {
        userObj.branchName = branchDoc.name;
      }
    }

    return userObj;
  }

  public static async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
    const user = await User.findById(userId).select('+password');
    if (!user) throw AppError.notFound('User not found');

    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) throw AppError.badRequest('Current password provided is incorrect');

    user.password = newPassword;
    await user.save();

    // Revoke all sessions on password change
    await RefreshToken.updateMany({ userId, revoked: false }, { revoked: true });
  }

  public static async forgotPassword(email: string): Promise<string> {
    const user = await User.findOne({ email: email.toLowerCase(), isDeleted: false });
    const message = 'If a matching account exists, password reset instructions have been sent.';
    if (!user) {
      return message;
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');

    user.passwordResetToken = hashedToken;
    user.passwordResetExpires = new Date(Date.now() + 15 * 60 * 1000);
    await user.save();

    const template = notificationTemplates[NotificationType.PASSWORD_RESET]();
    await NotificationService.sendToUser(
      user._id.toString(),
      user.gymId?.toString(),
      NotificationType.PASSWORD_RESET,
      template.title,
      template.body
    );

    logger.info(`🔑 Password reset token generated for User ID: ${user._id}`);
    return message;
  }

  public static async resetPassword(resetToken: string, newPassword: string): Promise<void> {
    const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');

    const user = await User.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: new Date() },
      isDeleted: false,
    }).select('+passwordResetToken +passwordResetExpires');

    if (!user) {
      throw AppError.badRequest('Password reset token is invalid or has expired');
    }

    user.password = newPassword;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save();

    // Revoke all active refresh tokens on password reset
    await RefreshToken.updateMany({ userId: user._id, revoked: false }, { revoked: true });

    logger.info(`🔐 Password reset successful for User ID: ${user._id}`);
  }

  /**
   * Super Admin exclusive creation of Gym Owner account & linked Gym organization
   */
  public static async registerGymOwnerBySuperAdmin(input: {
    fullName: string;
    email: string;
    phone: string;
    password?: string;
    gymName: string;
    branchName?: string;
    plan?: any;
    trialDays?: number;
  }): Promise<{ user: IUser; gym: any; primaryBranch: any; tempPassword: string }> {
    const existing = await User.findOne({ email: input.email.toLowerCase(), isDeleted: false });
    if (existing) {
      throw AppError.conflict('An active user account with this email address already exists');
    }

    const finalPassword = input.password?.trim() || 'Owner@123';

    const user = new User({
      fullName: input.fullName,
      email: input.email.toLowerCase(),
      phone: input.phone,
      password: finalPassword,
      role: Role.GYM_OWNER,
      isActive: true,
    });
    await user.save();

    const { gym, primaryBranch } = await GymService.createGymForOwner(user._id.toString(), {
      name: input.gymName,
      billingEmail: input.email,
      branchName: input.branchName || 'Main Branch',
      plan: input.plan || 'TRIAL',
      trialDays: input.trialDays,
      contactPhone: input.phone,
    });

    logger.info(`👑 Gym Owner created by SuperAdmin: [Owner ID: ${user._id}] [Gym: ${gym.name}]`);
    return { user, gym, primaryBranch, tempPassword: finalPassword };
  }

  /**
   * Admin/Owner forced password reset for Members, Trainers, or Staff within their Gym
   */
  public static async adminResetUserPassword(
    executor: { id: string; role: Role; gymId?: string },
    targetUserId: string,
    newPassword: string
  ): Promise<void> {
    const targetUser = await User.findOne({ _id: targetUserId, isDeleted: false });
    if (!targetUser) {
      throw AppError.notFound('Target user account not found');
    }

    if (executor.role !== Role.SUPER_ADMIN) {
      if (!executor.gymId || targetUser.gymId?.toString() !== executor.gymId) {
        throw AppError.forbidden('You can only reset passwords for users in your own Gym organization');
      }
    }

    targetUser.password = newPassword;
    targetUser.failedLoginAttempts = 0;
    targetUser.lockUntil = undefined;
    await targetUser.save();

    await RefreshToken.updateMany({ userId: targetUser._id, revoked: false }, { revoked: true });

    logger.info(`🔑 Password reset by admin [Executor: ${executor.id}] for User [Target: ${targetUser._id}]`);
  }

  /**
   * Gym Owner / Super Admin creation of non-trainer staff account (Branch Manager, Receptionist)
   */
  public static async registerStaff(
    gymId: string,
    branchId: string,
    input: { fullName: string; email: string; phone: string; password?: string; role?: Role }
  ): Promise<IUser> {
    const existing = await User.findOne({ email: input.email.toLowerCase(), isDeleted: false });
    if (existing) {
      throw AppError.conflict('An active user account with this email address already exists');
    }

    const staffPassword = input.password?.trim() || 'Staff@123';

    const user = new User({
      fullName: input.fullName,
      email: input.email.toLowerCase(),
      phone: input.phone,
      password: staffPassword,
      role: input.role || Role.BRANCH_MANAGER,
      gymId: new mongoose.Types.ObjectId(gymId),
      branchId: new mongoose.Types.ObjectId(branchId),
      isActive: true,
    });

    await user.save();
    logger.info(`📋 Staff registered: [User ID: ${user._id}] [Role: ${user.role}] [Gym: ${gymId}]`);
    return user;
  }

  /**
   * List non-trainer staff accounts for a Gym / Branch
   */
  public static async listStaff(gymId: string, branchId?: string): Promise<IUser[]> {
    const filter: any = {
      gymId: new mongoose.Types.ObjectId(gymId),
      role: { $in: [Role.BRANCH_MANAGER, Role.KIOSK] },
      isDeleted: false,
    };
    if (branchId && mongoose.Types.ObjectId.isValid(branchId)) {
      filter.branchId = new mongoose.Types.ObjectId(branchId);
    }
    return User.find(filter).populate('branchId', 'name address').select('-password').sort({ createdAt: -1 });
  }

  /**
   * Update authenticated user's profile (fullName, phone, avatarUrl)
   */
  public static async updateProfile(
    userId: string,
    data: { fullName?: string; phone?: string; avatarUrl?: string }
  ): Promise<IUser> {
    const user = await User.findById(userId);
    if (!user || user.isDeleted) {
      throw AppError.notFound('User account not found');
    }

    if (data.fullName !== undefined) user.fullName = data.fullName;
    if (data.phone !== undefined) user.phone = data.phone;
    if (data.avatarUrl !== undefined) (user as any).avatarUrl = data.avatarUrl;

    await user.save();
    return user;
  }

  /**
   * Soft-delete non-trainer staff account
   */
  public static async deleteStaff(gymId: string, staffId: string): Promise<void> {
    const user = await User.findOne({
      _id: staffId,
      gymId: new mongoose.Types.ObjectId(gymId),
      isDeleted: false,
    });
    if (!user) {
      throw AppError.notFound('Staff member account not found');
    }
    user.isDeleted = true;
    user.isActive = false;
    await user.save();
    await RefreshToken.updateMany({ userId: user._id, revoked: false }, { revoked: true });
    logger.info(`🗑️ Staff member soft deleted: [ID: ${user._id}]`);
  }
}

