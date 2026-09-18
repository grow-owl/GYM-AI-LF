import mongoose from 'mongoose';
import { Member } from './member.model';
import { User } from '../user/user.model';
import { NotificationService } from '../notification/notification.service';
import { notificationTemplates } from '../notification/notificationTemplates';
import { NotificationType } from '../notification/notification.types';
import { env } from '../../config/env';
import { AppError } from '../../common/utils/AppError';
import { logger } from '../../config/logger';

export class ReferralService {
  /**
   * Trigger manual referral ask WhatsApp message for a member
   */
  public static async sendReferralAsk(
    memberId: string,
    gymId: string
  ): Promise<{ memberId: string; referralCode: string; referralLink: string; whatsappSent: boolean }> {
    const member = await Member.findOne({
      $or: [
        { _id: mongoose.Types.ObjectId.isValid(memberId) ? memberId : undefined },
        { userId: mongoose.Types.ObjectId.isValid(memberId) ? memberId : undefined },
      ],
      gymId: new mongoose.Types.ObjectId(gymId),
      isDeleted: false,
    });

    if (!member) {
      throw AppError.notFound('Member profile not found in your gym');
    }

    if (!member.referralCode) {
      member.referralCode = `REF-${member.userId.toString().slice(-6).toUpperCase()}`;
      await member.save();
    }

    const user = await User.findById(member.userId);
    const memberName = user?.fullName || 'Valued Member';
    const baseUrl = env.CLIENT_URL || 'https://gym.app';
    const referralLink = `${baseUrl}/join?ref=${member.referralCode}`;

    const template = notificationTemplates[NotificationType.REFERRAL_ASK](memberName, member.referralCode);
    await NotificationService.sendToUser(
      member.userId.toString(),
      gymId,
      NotificationType.REFERRAL_ASK,
      template.title,
      template.body
    );

    logger.info(`📢 Referral ask triggered for member [${member._id}]: [Code: ${member.referralCode}]`);

    return {
      memberId: member._id.toString(),
      referralCode: member.referralCode,
      referralLink,
      whatsappSent: false,
    };
  }

  /**
   * Get member's own referral code and list of referred members
   */
  public static async getMyReferralStats(
    memberIdOrUserId: string
  ): Promise<{
    referralCode: string;
    referralLink: string;
    totalReferred: number;
    referredMembers: Array<{
      _id: string;
      fullName: string;
      email?: string;
      joinedAt: Date;
    }>;
  }> {
    const member = await Member.findOne({
      $or: [
        { _id: mongoose.Types.ObjectId.isValid(memberIdOrUserId) ? memberIdOrUserId : undefined },
        { userId: mongoose.Types.ObjectId.isValid(memberIdOrUserId) ? memberIdOrUserId : undefined },
      ],
      isDeleted: false,
    });

    if (!member) {
      throw AppError.notFound('Member profile not found');
    }

    if (!member.referralCode) {
      member.referralCode = `REF-${member.userId.toString().slice(-6).toUpperCase()}`;
      await member.save();
    }

    const baseUrl = env.CLIENT_URL || 'https://gym.app';
    const referralLink = `${baseUrl}/join?ref=${member.referralCode}`;

    const referredDocs = await Member.find({
      referredByMemberId: member._id,
      isDeleted: false,
    }).populate('userId', 'fullName email createdAt');

    const referredMembers = referredDocs.map((doc: any) => ({
      _id: doc._id.toString(),
      fullName: doc.userId?.fullName || 'Referred Member',
      email: doc.userId?.email,
      joinedAt: doc.membershipStartDate || doc.createdAt,
    }));

    return {
      referralCode: member.referralCode,
      referralLink,
      totalReferred: referredMembers.length,
      referredMembers,
    };
  }
}
