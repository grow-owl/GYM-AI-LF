import mongoose from 'mongoose';
import { Member } from './member.model';
import { User } from '../user/user.model';
import { Branch } from '../gym/branch.model';
import { Trainer } from '../trainer/trainer.model';
import { Role } from '../../common/constants/roles.enum';
import { IMember, MembershipStatus } from './member.types';
import { AppError } from '../../common/utils/AppError';
import { generateQRPayload } from '../../common/utils/qrCode';
import { getPaginationParams, buildPaginationMeta, ParsedPagination } from '../../common/utils/pagination';
import { NotificationService } from '../notification/notification.service';
import { NotificationType } from '../notification/notification.types';
import { notificationTemplates } from '../notification/notificationTemplates';
import { logger } from '../../config/logger';
import { GamificationService } from '../gamification/gamification.service';

export class MemberService {
  public static async createMember(
    gymId: string,
    branchId: string,
    memberData: {
      fullName: string;
      email: string;
      phone: string;
      password?: string;
      branchId?: string;
      planName: string;
      membershipStartDate: Date;
      membershipEndDate: Date;
      dateOfBirth?: Date;
      referralCode?: string;
      referredByMemberId?: string;
      assignedTrainerId?: string;
      emergencyContact?: { name: string; phone: string; relation: string };
      healthInfo?: { currentWeight_kg?: number; targetWeight_kg?: number; medicalNotes?: string; injuries?: string[] };
      fitnessGoals?: string[];
    }
  ): Promise<IMember> {
    const targetBranchId = memberData.branchId || branchId;

    const existingUser = await User.findOne({ email: memberData.email.toLowerCase(), isDeleted: false });
    if (existingUser) {
      throw AppError.conflict('An active account with this email address already exists');
    }

    let branch = await Branch.findOne({ _id: targetBranchId, isDeleted: false });
    if (!branch && mongoose.Types.ObjectId.isValid(gymId)) {
      branch = await Branch.findOne({ gymId: new mongoose.Types.ObjectId(gymId), isDeleted: false });
    }
    if (!branch) {
      throw AppError.badRequest('Valid gym and branch are required for member creation');
    }

    const resolvedGymId = branch.gymId;
    const resolvedBranchId = branch._id;

    const generatedPassword = memberData.password?.trim() || 'Member@123';

    let referredByMemberId: mongoose.Types.ObjectId | undefined = memberData.referredByMemberId
      ? new mongoose.Types.ObjectId(memberData.referredByMemberId)
      : undefined;

    let isReferrerFound = false;

    if (memberData.referralCode) {
      const cleanCode = memberData.referralCode.trim();
      const referrerMember = await Member.findOne({
        $or: [{ referralCode: cleanCode }, { referralCode: cleanCode.toUpperCase() }],
        isDeleted: false,
      });

      if (referrerMember) {
        isReferrerFound = true;
        if (!referredByMemberId) {
          referredByMemberId = referrerMember._id;
        }
      }
    }

    const user = new User({
      fullName: memberData.fullName,
      email: memberData.email.toLowerCase(),
      phone: memberData.phone,
      password: generatedPassword,
      role: Role.MEMBER,
      gymId: resolvedGymId,
      branchId: resolvedBranchId,
      referredByMemberId,
      isActive: true,
    });
    await user.save();

    const generatedReferralCode =
      memberData.referralCode && !isReferrerFound
        ? memberData.referralCode
        : `REF-${user._id.toString().slice(-6).toUpperCase()}`;

    const qrTokenResult = await generateQRPayload({ memberId: user._id.toString(), gymId: resolvedGymId.toString(), branchId: resolvedBranchId.toString(), type: 'CHECK_IN' });
    const qrCode = qrTokenResult.token;

    // Auto-assign trainer if not specified (least loaded, with available capacity)
    let assignedTrainerId = memberData.assignedTrainerId
      ? new mongoose.Types.ObjectId(memberData.assignedTrainerId)
      : undefined;

    if (!assignedTrainerId) {
      const trainers = await Trainer.find({
        gymId: resolvedGymId,
        branchId: resolvedBranchId,
        isDeleted: false,
      });

      let leastLoaded: typeof trainers[0] | null = null;
      let minLoad = Infinity;

      for (const t of trainers) {
        const load = await Member.countDocuments({
          assignedTrainerId: t._id,
          membershipStatus: { $in: ['ACTIVE', 'FROZEN'] },
          isDeleted: false,
        });
        const cap = t.maxMemberCapacity || Infinity;
        if (load < cap && load < minLoad) {
          minLoad = load;
          leastLoaded = t;
        }
      }

      if (leastLoaded) {
        assignedTrainerId = leastLoaded._id;
      }
    }

    const member = new Member({
      userId: user._id,
      gymId: resolvedGymId,
      branchId: resolvedBranchId,
      assignedTrainerId,
      membershipStatus: MembershipStatus.ACTIVE,
      membershipStartDate: memberData.membershipStartDate,
      membershipEndDate: memberData.membershipEndDate,
      planName: memberData.planName,
      dateOfBirth: memberData.dateOfBirth,
      referralCode: generatedReferralCode,
      referredByMemberId,
      emergencyContact: memberData.emergencyContact,
      healthInfo: memberData.healthInfo,
      fitnessGoals: memberData.fitnessGoals || [],
      qrCode,
    });
    await member.save();

    logger.info(`🏋️ New Member onboarded: [ID: ${member._id}] [User: ${user._id}] [Gym: ${gymId}]`);

    // Notify trainer using NEW_MEMBER_ASSIGNED notification type
    if (assignedTrainerId) {
      const trainerDoc = await Trainer.findById(assignedTrainerId);
      if (trainerDoc) {
        const template = notificationTemplates[NotificationType.NEW_MEMBER_ASSIGNED](user.fullName);
        await NotificationService.sendToUser(
          trainerDoc.userId.toString(),
          gymId,
          NotificationType.NEW_MEMBER_ASSIGNED,
          template.title,
          template.body
        );
      }
    }

    return member;
  }

  public static async listMembers(
    gymId: string,
    branchIdOrFilters?: string | { status?: string; trainerId?: string; search?: string },
    filtersOrOptions?: any,
    optionsArg?: any
  ): Promise<{ members: IMember[]; meta: ReturnType<typeof buildPaginationMeta> }> {
    let branchIdFilter: string | undefined;
    let filters: { status?: string; trainerId?: string; search?: string } = {};
    let options: { page?: number | string; limit?: number | string } = {};

    if (typeof branchIdOrFilters === 'string') {
      branchIdFilter = branchIdOrFilters;
      filters = filtersOrOptions || {};
      options = optionsArg || {};
    } else {
      filters = branchIdOrFilters || {};
      options = filtersOrOptions || {};
    }

    const { page, limit, skip }: ParsedPagination = getPaginationParams(options);

    let filter: Record<string, unknown> = { isDeleted: false };
    if (mongoose.Types.ObjectId.isValid(gymId)) {
      filter.gymId = new mongoose.Types.ObjectId(gymId);
    }
    if (branchIdFilter && mongoose.Types.ObjectId.isValid(branchIdFilter)) {
      filter.branchId = new mongoose.Types.ObjectId(branchIdFilter);
    }
    if (filters.status) filter.membershipStatus = filters.status;
    if (filters.trainerId && mongoose.Types.ObjectId.isValid(filters.trainerId)) filter.assignedTrainerId = new mongoose.Types.ObjectId(filters.trainerId);

    let [members, totalItems] = await Promise.all([
      Member.find(filter)
        .populate('userId', 'fullName email phone isActive')
        .populate('branchId', 'name')
        .populate({ path: 'assignedTrainerId', populate: { path: 'userId', select: 'fullName' } })
        .skip(skip)
        .limit(limit)
        .sort({ createdAt: -1 }),
      Member.countDocuments(filter),
    ]);

    const meta = buildPaginationMeta(totalItems, page, limit);

    return { members, meta };
  }

  public static async getMemberById(memberId: string, gymId?: string): Promise<IMember> {
    if (!gymId || !mongoose.Types.ObjectId.isValid(gymId)) {
      throw AppError.notFound('Member profile not found');
    }

    const filter: Record<string, unknown> = {
      _id: memberId,
      gymId: new mongoose.Types.ObjectId(gymId),
      isDeleted: false,
    };

    const member = await Member.findOne(filter)
      .populate('userId', 'fullName email phone isActive')
      .populate('branchId', 'name address')
      .populate({ path: 'assignedTrainerId', populate: { path: 'userId', select: 'fullName email phone' } });

    if (!member) throw AppError.notFound('Member profile not found');

    try {
      const stats = await GamificationService.getOrCreateMemberGameStats(member._id.toString());
      const streak = await GamificationService.syncStreakFromAttendance(member._id.toString());
      member.currentStreakDays = streak;
      member.longestStreakDays = stats.longestStreak || streak;
      member.totalXpPoints = stats.xp || 0;
      member.gamificationLevel = stats.level || 1;
    } catch {
      // Retain existing member fields if gamification sync encounters an edge case
    }

    return member;
  }

  public static async getMemberByUserId(userId: string): Promise<IMember> {
    const member = await Member.findOne({ userId, isDeleted: false })
      .populate('userId', 'fullName email phone isActive')
      .populate('branchId', 'name')
      .populate({ path: 'assignedTrainerId', populate: { path: 'userId', select: 'fullName email phone profilePicture' } });

    if (!member) throw AppError.notFound('Member profile not found for user');

    try {
      const stats = await GamificationService.getOrCreateMemberGameStats(member._id.toString());
      const streak = await GamificationService.syncStreakFromAttendance(member._id.toString());
      member.currentStreakDays = streak;
      member.longestStreakDays = stats.longestStreak || streak;
      member.totalXpPoints = stats.xp || 0;
      member.gamificationLevel = stats.level || 1;
    } catch {
      // Retain existing member fields if gamification sync encounters an edge case
    }

    return member;
  }

  public static async updateMember(
    memberId: string,
    updateData: Record<string, unknown>,
    gymId?: string,
    role?: string
  ): Promise<IMember> {
    if (!gymId || !mongoose.Types.ObjectId.isValid(gymId)) {
      throw AppError.notFound('Member profile not found');
    }

    // Trainers cannot update billing-sensitive fields
    const BILLING_FIELDS = ['planName', 'membershipStatus', 'membershipStartDate', 'membershipEndDate'];
    if (role === Role.TRAINER) {
      for (const field of BILLING_FIELDS) {
        if (field in updateData) {
          throw AppError.forbidden('Trainers are not authorized to modify billing or membership status fields');
        }
      }
    }

    const member = await Member.findOneAndUpdate(
      { _id: memberId, gymId: new mongoose.Types.ObjectId(gymId), isDeleted: false },
      updateData,
      { new: true, runValidators: true }
    );
    if (!member) throw AppError.notFound('Member profile not found');
    return member;
  }

  public static async assignTrainer(memberId: string, trainerId: string, gymId?: string): Promise<IMember> {
    if (!gymId || !mongoose.Types.ObjectId.isValid(gymId)) {
      throw AppError.notFound('Member profile not found');
    }

    const trainer = await Trainer.findOne({ _id: trainerId, gymId: new mongoose.Types.ObjectId(gymId), isDeleted: false });
    if (!trainer) throw AppError.notFound('Trainer profile not found in your gym');

    // Capacity check
    if (trainer.maxMemberCapacity) {
      const currentLoad = await Member.countDocuments({
        assignedTrainerId: trainer._id,
        membershipStatus: { $in: ['ACTIVE', 'FROZEN'] },
        isDeleted: false,
      });
      if (currentLoad >= trainer.maxMemberCapacity) {
        throw AppError.conflict(`Trainer has reached maximum member capacity (${trainer.maxMemberCapacity})`);
      }
    }

    const member = await Member.findOneAndUpdate(
      { _id: memberId, gymId: new mongoose.Types.ObjectId(gymId), isDeleted: false },
      { assignedTrainerId: trainer._id },
      { new: true }
    );
    if (!member) throw AppError.notFound('Member profile not found');
    return member;
  }

  public static async freezeMembership(
    memberId: string,
    freezeUntilOrDays: Date | number,
    reason?: string,
    gymId?: string
  ): Promise<IMember> {
    if (!gymId || !mongoose.Types.ObjectId.isValid(gymId)) {
      throw AppError.notFound('Member profile not found');
    }

    const member = await Member.findOne({ _id: memberId, gymId: new mongoose.Types.ObjectId(gymId), isDeleted: false });
    if (!member) throw AppError.notFound('Member profile not found');

    const freezeUntil = freezeUntilOrDays instanceof Date ? freezeUntilOrDays : new Date(Date.now() + freezeUntilOrDays * 24 * 60 * 60 * 1000);

    member.membershipStatus = MembershipStatus.FROZEN;
    member.membershipEndDate = freezeUntil;
    if (reason) {
      member.freezeHistory.push({ from: new Date(), to: freezeUntil, reason, createdAt: new Date() });
    }
    await member.save();
    return member;
  }

  public static async renewMembership(
    memberId: string,
    newEndDateOrMonths?: Date | number,
    newPlanName?: string,
    gymId?: string
  ): Promise<IMember> {
    if (!gymId || !mongoose.Types.ObjectId.isValid(gymId)) {
      throw AppError.notFound('Member profile not found');
    }

    const member = await Member.findOne({ _id: memberId, gymId: new mongoose.Types.ObjectId(gymId), isDeleted: false });
    if (!member) {
      throw AppError.notFound('Member profile not found');
    }

    let targetEndDate: Date;
    if (newEndDateOrMonths instanceof Date) {
      targetEndDate = newEndDateOrMonths;
    } else {
      const months = typeof newEndDateOrMonths === 'number' ? newEndDateOrMonths : 1;
      const currentExpiry = new Date(member.membershipEndDate);
      const baseDate = currentExpiry > new Date() ? currentExpiry : new Date();
      baseDate.setMonth(baseDate.getMonth() + months);
      targetEndDate = baseDate;
    }

    member.membershipEndDate = targetEndDate;
    member.membershipStatus = MembershipStatus.ACTIVE;
    if (newPlanName) {
      member.planName = newPlanName;
    }

    await member.save();
    logger.info(`🔄 Membership renewed: [Member: ${memberId}] [New Expiry: ${targetEndDate.toISOString()}]`);
    return member;
  }

  public static async extendMembership(
    memberId: string,
    days: number,
    _reason?: string,
    gymId?: string
  ): Promise<IMember> {
    if (!gymId || !mongoose.Types.ObjectId.isValid(gymId)) {
      throw AppError.notFound('Member profile not found');
    }

    const member = await Member.findOne({ _id: memberId, gymId: new mongoose.Types.ObjectId(gymId), isDeleted: false });
    if (!member) throw AppError.notFound('Member profile not found');

    const currentEnd = new Date(member.membershipEndDate);
    const baseDate = currentEnd > new Date() ? currentEnd : new Date();
    const newEnd = new Date(baseDate.getTime() + days * 24 * 60 * 60 * 1000);

    member.membershipEndDate = newEnd;
    member.membershipStatus = MembershipStatus.ACTIVE;
    await member.save();

    logger.info(`➕ Membership extended by ${days} days: [Member: ${memberId}] [New Expiry: ${newEnd.toISOString()}]`);
    return member;
  }

  public static async cancelMembership(
    memberId: string,
    _reason?: string,
    gymId?: string
  ): Promise<IMember> {
    if (!gymId || !mongoose.Types.ObjectId.isValid(gymId)) {
      throw AppError.notFound('Member profile not found');
    }

    const member = await Member.findOne({ _id: memberId, gymId: new mongoose.Types.ObjectId(gymId), isDeleted: false });
    if (!member) throw AppError.notFound('Member profile not found');

    member.membershipStatus = MembershipStatus.CANCELLED;
    await member.save();

    logger.info(`❌ Membership cancelled: [Member: ${memberId}]`);
    return member;
  }

  public static async regenerateQRCode(memberId: string, gymId?: string): Promise<{ qrCode: string; qrCodeToken: string }> {
    if (!gymId || !mongoose.Types.ObjectId.isValid(gymId)) {
      throw AppError.notFound('Member profile not found');
    }

    const member = await Member.findOne({ _id: memberId, gymId: new mongoose.Types.ObjectId(gymId), isDeleted: false });
    if (!member) throw AppError.notFound('Member profile not found');

    const qrTokenResult = await generateQRPayload({ memberId: member.userId.toString(), gymId: gymId, branchId: member.branchId.toString(), type: 'CHECK_IN' });
    const qrCode = qrTokenResult.token;

    member.qrCode = qrCode;
    await member.save();
    return { qrCodeToken: qrCode, qrCode };
  }

  public static async softDeleteMember(memberId: string, gymId?: string): Promise<void> {
    if (!gymId || !mongoose.Types.ObjectId.isValid(gymId)) {
      throw AppError.notFound('Member profile not found');
    }

    const member = await Member.findOne({ _id: memberId, gymId: new mongoose.Types.ObjectId(gymId), isDeleted: false });
    if (!member) throw AppError.notFound('Member profile not found');

    await Member.findByIdAndUpdate(member._id, { isDeleted: true });
    await User.findByIdAndUpdate(member.userId, { isDeleted: true, isActive: false });
  }

  public static async checkAndExpireMemberships(): Promise<number> {
    const now = new Date();
    const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

    const expiredMembers = await Member.find({
      membershipStatus: MembershipStatus.ACTIVE,
      membershipEndDate: { $lt: now },
      isDeleted: false,
    });

    let expiredCount = 0;
    for (const m of expiredMembers) {
      m.membershipStatus = MembershipStatus.EXPIRED;
      await m.save();
      expiredCount++;

      const template = notificationTemplates[NotificationType.MEMBERSHIP_EXPIRED]();
      await NotificationService.sendToUser(
        m.userId.toString(),
        m.gymId.toString(),
        NotificationType.MEMBERSHIP_EXPIRED,
        template.title,
        template.body
      );
    }

    const expiringSoonMembers = await Member.find({
      membershipStatus: MembershipStatus.ACTIVE,
      membershipEndDate: { $gte: now, $lte: threeDaysFromNow },
      isDeleted: false,
    });

    let expiringSoonCount = 0;
    for (const m of expiringSoonMembers) {
      expiringSoonCount++;
      const daysLeft = Math.ceil((m.membershipEndDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      const template = notificationTemplates[NotificationType.MEMBERSHIP_EXPIRING](daysLeft);
      await NotificationService.sendToUser(
        m.userId.toString(),
        m.gymId.toString(),
        NotificationType.MEMBERSHIP_EXPIRING,
        template.title,
        template.body
      );
    }

    if (expiredCount > 0 || expiringSoonCount > 0) {
      logger.info(`🚨 Passive Member Expiry Evaluator: [Expired: ${expiredCount}] [Expiring Soon: ${expiringSoonCount}]`);
    }

    // Return number (expiredCount) for backward compat — test expects a number
    return expiredCount;
  }
}
