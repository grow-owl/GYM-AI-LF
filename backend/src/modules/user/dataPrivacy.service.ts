import mongoose from 'mongoose';
import { User } from './user.model';
import { Member } from '../member/member.model';
import { Trainer } from '../trainer/trainer.model';
import { Gym } from '../gym/gym.model';
import { Attendance } from '../attendance/attendance.model';
import { WorkoutLog } from '../workout/workoutLog.model';
import { MemberPayment } from '../payment/memberPayment.model';
import { ProgressPhoto } from '../progress/progressPhoto.model';
import { Role } from '../../common/constants/roles.enum';
import { AppError } from '../../common/utils/AppError';
import { logger } from '../../config/logger';
import { cloudinaryUpload } from '../../config/cloudinary';
import { env } from '../../config/env';

export class DataPrivacyService {
  /**
   * Export all personal data of a user into a clean JSON structure (DPDP Act compliance)
   */
  public static async exportUserData(userId: string, _gymId?: string): Promise<Record<string, unknown>> {
    const user = await User.findById(userId);
    if (!user || user.isDeleted) {
      throw AppError.notFound('User account not found');
    }

    const exportData: Record<string, unknown> = {
      userProfile: {
        id: user._id,
        fullName: user.fullName,
        email: user.email,
        phone: user.phone,
        role: user.role,
        avatarUrl: user.avatarUrl,
        createdAt: user.createdAt,
      },
    };

    // If Member, export member profile, attendance, workout logs, payments
    const member = await Member.findOne({ userId: user._id, isDeleted: false });
    if (member) {
      const [attendanceHistory, workoutLogs, paymentHistory] = await Promise.all([
        Attendance.find({ memberId: member._id }).select('-__v').sort({ checkInAt: -1 }),
        WorkoutLog.find({ memberId: member._id }).select('-__v').sort({ date: -1 }),
        MemberPayment.find({ memberId: member._id }).select('-__v').sort({ paidAt: -1 }),
      ]);

      exportData.memberProfile = {
        id: member._id,
        planName: member.planName,
        membershipStartDate: member.membershipStartDate,
        membershipEndDate: member.membershipEndDate,
        status: member.membershipStatus,
        healthInfo: member.healthInfo,
        fitnessGoals: member.fitnessGoals,
      };
      exportData.attendanceHistory = attendanceHistory;
      exportData.workoutLogs = workoutLogs;
      exportData.paymentHistory = paymentHistory;
    }

    // If Trainer, export trainer profile
    const trainer = await Trainer.findOne({ userId: user._id, isDeleted: false });
    if (trainer) {
      exportData.trainerProfile = {
        id: trainer._id,
        specializations: trainer.specializations,
        bio: trainer.bio,
        certifications: trainer.certifications,
      };
    }

    return exportData;
  }

  /**
   * Request account deletion (Soft-lock user account and start 30-day grace period)
   */
  public static async requestAccountDeletion(userId: string): Promise<{ deletionRequestedAt: Date }> {
    const user = await User.findById(userId);
    if (!user || user.isDeleted) {
      throw AppError.notFound('User account not found');
    }

    // Direct Guard: Block Gym Owners who own active gyms from requesting account deletion
    if (user.role === Role.GYM_OWNER) {
      const activeGym = await Gym.findOne({
        ownerId: new mongoose.Types.ObjectId(userId),
        isDeleted: false,
      });

      if (activeGym) {
        throw AppError.badRequest(
          'Gym Owners cannot delete their account while owning an active gym. Please transfer ownership or delete the gym organization first.'
        );
      }
    }

    const deletionRequestedAt = new Date();
    user.deletionRequestedAt = deletionRequestedAt;
    user.isActive = false;
    await user.save();

    logger.info(`🔒 Account deletion requested for user: [ID: ${user._id}] [Role: ${user.role}]`);
    return { deletionRequestedAt };
  }

  /**
   * Cancel pending account deletion request (Re-activates user account)
   */
  public static async cancelAccountDeletion(userId: string): Promise<void> {
    const user = await User.findById(userId);
    if (!user || user.isDeleted) {
      throw AppError.notFound('User account not found');
    }

    if (!user.deletionRequestedAt) {
      throw AppError.badRequest('No pending account deletion request found for this account');
    }

    user.deletionRequestedAt = undefined;
    user.isActive = true;
    await user.save();

    logger.info(`🔓 Account deletion cancelled for user: [ID: ${user._id}]`);
  }

  /**
   * Cron-ready batch processing function for account erasures > 30 days old
   */
  public static async processScheduledDeletions(): Promise<number> {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const pendingUsers = await User.find({
      deletionRequestedAt: { $lte: thirtyDaysAgo },
      isDeleted: false,
    });

    let anonymizedCount = 0;

    for (const user of pendingUsers) {
      // Clean up member progress photos from Cloudinary and DB
      try {
        const member = await Member.findOne({ userId: user._id });
        if (member) {
          const photos = await ProgressPhoto.find({ memberId: member._id });
          const publicIds = photos
            .map((p) => p.cloudinaryPublicId)
            .filter((id): id is string => Boolean(id && !id.startsWith('mock_')));

          if (
            publicIds.length > 0 &&
            env.NODE_ENV !== 'test' &&
            Boolean(env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET && env.CLOUDINARY_API_KEY !== 'dev_key')
          ) {
            try {
              await cloudinaryUpload.api.delete_resources(publicIds);
              logger.info(`🧹 Cloudinary batch progress photos destroyed for member ${member._id}: [Count: ${publicIds.length}]`);
            } catch (cErr: any) {
              logger.warn(`Failed to batch destroy Cloudinary photos: ${cErr.message}`);
            }
          }
          await ProgressPhoto.deleteMany({ memberId: member._id });
        }
      } catch (err: any) {
        logger.warn(`Failed to clean up progress photos for user ${user._id}: ${err.message}`);
      }

      user.fullName = 'Anonymized User';
      user.email = `anonymized_${user._id}@deleted.local`;
      user.phone = '0000000000';
      user.isActive = false;
      user.isDeleted = true;
      user.deletedAt = new Date();
      user.deletionRequestedAt = undefined;
      await user.save();
      anonymizedCount++;
    }

    if (anonymizedCount > 0) {
      logger.info(`🧹 Processed scheduled DPDP account erasures: [Count: ${anonymizedCount}]`);
    }

    return anonymizedCount;
  }
}
