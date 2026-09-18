import mongoose from 'mongoose';
import { Gym } from './gym.model';
import { Branch } from './branch.model';
import { User } from '../user/user.model';
import { Member } from '../member/member.model';
import { Trainer } from '../trainer/trainer.model';
import { IGym, GymPlan, GymStatus, IBranch, IGymMembershipPlan } from './gym.types';
import { Role } from '../../common/constants/roles.enum';
import { AppError } from '../../common/utils/AppError';
import { getPaginationParams, buildPaginationMeta, ParsedPagination } from '../../common/utils/pagination';
import { NotificationService } from '../notification/notification.service';
import { NotificationType } from '../notification/notification.types';
import { logger } from '../../config/logger';

export class GymService {
  public static async createGymForOwner(
    ownerId: string,
    gymData: {
      name: string;
      billingEmail: string;
      logoUrl?: string;
      isMultiBranch?: boolean;
      plan?: GymPlan;
      trialDays?: number;
      branchName?: string;
      address?: { line1: string; city: string; state: string; pincode: string; country: string };
      contactPhone?: string;
    }
  ): Promise<{ gym: IGym; primaryBranch: IBranch; defaultBranch: IBranch }> {
    const owner = await User.findById(ownerId);
    if (!owner || owner.role !== Role.GYM_OWNER) {
      throw AppError.forbidden('Only a verified GYM_OWNER account can register a new Gym');
    }

    const trialDays = gymData.trialDays && gymData.trialDays > 0 ? gymData.trialDays : 14;
    const trialEndsAt = new Date();
    trialEndsAt.setDate(trialEndsAt.getDate() + trialDays);

    const gym = new Gym({
      name: gymData.name,
      ownerId: owner._id,
      billingEmail: gymData.billingEmail,
      logoUrl: gymData.logoUrl,
      isMultiBranch: gymData.isMultiBranch || false,
      plan: gymData.plan || GymPlan.TRIAL,
      status: GymStatus.ACTIVE,
      trialEndsAt,
    });

    await gym.save();

    const primaryBranch = new Branch({
      gymId: gym._id,
      name: gymData.branchName || 'Main Branch',
      address: gymData.address || { line1: 'Main St', city: 'City', state: 'State', pincode: '000000', country: 'Country' },
      contactPhone: gymData.contactPhone || '0000000000',
      isPrimary: true,
      isActive: true,
    });

    await primaryBranch.save();

    await User.findByIdAndUpdate(owner._id, {
      gymId: gym._id,
      branchId: primaryBranch._id,
    });

    logger.info(`🏢 Gym & Primary Branch onboarded: [Gym: ${gym.name}] [Branch: ${primaryBranch.name}]`);

    return { gym, primaryBranch, defaultBranch: primaryBranch };
  }

  public static async getGymById(gymId: string): Promise<IGym> {
    const gym = await Gym.findOne({ _id: gymId, isDeleted: false });
    if (!gym) throw AppError.notFound('Gym organization not found');
    return gym;
  }

  public static async updateGym(gymId: string, updateData: Partial<IGym> & { settings?: { defaultTrialPassDays?: number } }): Promise<IGym> {
    const gym = await Gym.findOne({ _id: gymId, isDeleted: false });
    if (!gym) throw AppError.notFound('Gym organization not found');

    if (updateData.name) gym.name = updateData.name;
    if (updateData.billingEmail) gym.billingEmail = updateData.billingEmail;
    if (updateData.logoUrl !== undefined) gym.logoUrl = updateData.logoUrl;
    if (updateData.settings) {
      gym.settings = {
        ...gym.settings,
        ...updateData.settings,
      };
    }

    await gym.save();
    return gym;
  }

  public static async softDeleteGym(gymId: string, _force?: boolean): Promise<void> {
    await Gym.findByIdAndUpdate(gymId, { isDeleted: true });
    await Branch.updateMany({ gymId }, { isDeleted: true });
  }

  public static async updateGymPlan(gymId: string, plan: GymPlan): Promise<IGym> {
    const gym = await Gym.findOne({ _id: gymId, isDeleted: false });
    if (!gym) throw AppError.notFound('Gym organization not found');

    // Downgrade validation: check if current branch count would exceed the new plan limit
    const PLAN_BRANCH_LIMITS: Partial<Record<GymPlan, number>> = {
      [GymPlan.BASIC]: 1,
      [GymPlan.TRIAL]: 2,
    };
    const newPlanLimit = PLAN_BRANCH_LIMITS[plan];
    if (newPlanLimit !== undefined) {
      const currentBranchCount = await Branch.countDocuments({ gymId: gym._id, isDeleted: false });
      if (currentBranchCount > newPlanLimit) {
        throw AppError.conflict(`Cannot downgrade to plan ${plan}: you currently have ${currentBranchCount} branches but this plan only allows ${newPlanLimit}.`);
      }
    }

    gym.plan = plan;
    gym.status = GymStatus.ACTIVE;
    await gym.save();
    return gym;
  }

  public static async getGymOverview(gymId: string): Promise<{ gym: IGym; branchCount: number; activeMemberCount: number }> {
    const gym = await this.getGymById(gymId);
    const branchCount = await Branch.countDocuments({ gymId, isDeleted: false });
    return { gym, branchCount, activeMemberCount: 0 };
  }

  public static async createBranch(
    gymId: string,
    branchData: { name: string; address: { line1: string; city: string; state: string; pincode: string; country: string }; contactPhone: string },
    _actorId?: string,
    _actorRole?: Role
  ): Promise<IBranch> {
    const gym = await this.getGymById(gymId);

    const PLAN_BRANCH_LIMITS: Partial<Record<GymPlan, number>> = {
      [GymPlan.BASIC]: 1,
      [GymPlan.TRIAL]: 2,
    };
    const planLimit = PLAN_BRANCH_LIMITS[gym.plan];
    if (planLimit !== undefined) {
      const count = await Branch.countDocuments({ gymId, isDeleted: false });
      if (count >= planLimit) {
        throw AppError.conflict('Branch creation limit reached for your current plan. Upgrade to PRO or ENTERPRISE to add more branches.');
      }
    }

    const branch = new Branch({
      gymId: gym._id,
      name: branchData.name,
      address: branchData.address,
      contactPhone: branchData.contactPhone,
      isPrimary: false,
      isActive: true,
    });

    await branch.save();

    // Flip isMultiBranch flag if this is the 2nd+ branch
    const totalBranches = await Branch.countDocuments({ gymId, isDeleted: false });
    if (totalBranches >= 2 && !gym.isMultiBranch) {
      await Gym.findByIdAndUpdate(gymId, { isMultiBranch: true });
    }

    return branch;
  }

  public static async listBranches(
    gymId: string,
    options: { page?: number | string; limit?: number | string } = {}
  ): Promise<{ branches: IBranch[]; meta: ReturnType<typeof buildPaginationMeta> }> {
    const { page, limit, skip }: ParsedPagination = getPaginationParams(options);
    const filter = { gymId: new mongoose.Types.ObjectId(gymId), isDeleted: false };

    const [branches, totalItems] = await Promise.all([
      Branch.find(filter).skip(skip).limit(limit).sort({ createdAt: -1 }),
      Branch.countDocuments(filter),
    ]);

    const meta = buildPaginationMeta(totalItems, page, limit);

    return { branches, meta };
  }

  public static async getBranchById(branchId: string, gymId?: string): Promise<IBranch> {
    const filter: Record<string, unknown> = { _id: branchId, isDeleted: false };
    if (gymId) filter.gymId = new mongoose.Types.ObjectId(gymId);

    const branch = await Branch.findOne(filter);
    if (!branch) throw AppError.notFound('Branch location not found');
    return branch;
  }

  public static async updateBranch(branchId: string, updateData: Partial<IBranch>): Promise<IBranch> {
    const branch = await Branch.findOneAndUpdate({ _id: branchId, isDeleted: false }, updateData, { new: true });
    if (!branch) throw AppError.notFound('Branch location not found');
    return branch;
  }

  /**
   * Soft-delete a non-primary Branch with cascade migration:
   * - Migrates all active Members and Trainers to the gym's primary branch
   * - Prevents orphan records after branch deletion
   */
  public static async softDeleteBranch(branchId: string, _force?: boolean): Promise<void> {
    const branch = await Branch.findOne({ _id: branchId, isDeleted: false });
    if (!branch) throw AppError.notFound('Branch location not found');
    if (branch.isPrimary) {
      throw AppError.badRequest('Cannot delete the primary branch location of a gym');
    }

    // Find the gym's primary branch to migrate records into
    const primaryBranch = await Branch.findOne({
      gymId: branch.gymId,
      isPrimary: true,
      isDeleted: false,
    });

    if (primaryBranch) {
      const primaryBranchId = primaryBranch._id;
      // Migrate Members and Trainers to primary branch in parallel
      await Promise.all([
        Member.updateMany(
          { branchId: branch._id, isDeleted: false },
          { $set: { branchId: primaryBranchId } }
        ),
        Trainer.updateMany(
          { branchId: branch._id, isDeleted: false },
          { $set: { branchId: primaryBranchId } }
        ),
        User.updateMany(
          { branchId: branch._id, isDeleted: false },
          { $set: { branchId: primaryBranchId } }
        ),
      ]);
      logger.info(
        `🏠 Branch cascade delete: [Branch: ${branchId}] → Members/Trainers/Users migrated to primary branch [${primaryBranchId}]`
      );
    } else {
      logger.warn(
        `⚠️ Branch delete: No primary branch found for gym [${branch.gymId}]. Records in branch [${branchId}] may be stranded.`
      );
    }

    await Branch.findByIdAndUpdate(branchId, { isDeleted: true });
  }

  public static async assignBranchManager(
    branchId: string,
    managerUserId: string,
    _actorId?: string,
    _actorRole?: Role
  ): Promise<IBranch> {
    const branch = await Branch.findOne({ _id: branchId, isDeleted: false });
    if (!branch) throw AppError.notFound('Branch location not found');

    await User.findByIdAndUpdate(managerUserId, { role: Role.BRANCH_MANAGER, gymId: branch.gymId, branchId: branch._id });
    branch.managerId = new mongoose.Types.ObjectId(managerUserId);
    await branch.save();
    return branch;
  }

  public static async verifyOwnerAccess(ownerUserId: string, gymId: string, role?: Role): Promise<boolean> {
    if (role === Role.SUPER_ADMIN) return true;
    const gym = await Gym.findOne({ _id: gymId, ownerId: ownerUserId, isDeleted: false });
    if (!gym) {
      throw AppError.forbidden('Access denied: You do not own this gym organization');
    }
    return true;
  }

  public static async checkAndUpdateExpiredGyms(): Promise<{ suspendedCount: number; expiredTrialCount: number }> {
    const now = new Date();

    const expiredTrials = await Gym.find({
      status: GymStatus.ACTIVE,
      plan: GymPlan.TRIAL,
      trialEndsAt: { $lt: now },
      isDeleted: false,
    });

    let expiredTrialCount = 0;
    for (const gym of expiredTrials) {
      gym.status = GymStatus.TRIAL_EXPIRED;
      await gym.save();
      expiredTrialCount++;

      await NotificationService.sendToUser(
        gym.ownerId.toString(),
        gym._id.toString(),
        NotificationType.MEMBERSHIP_EXPIRING,
        'Free Trial Expired',
        `Your 14-day free trial for ${gym.name} has expired. Please upgrade your plan to continue accessing features.`
      );
    }

    const expiredSubscriptions = await Gym.find({
      status: GymStatus.ACTIVE,
      subscriptionExpiresAt: { $lt: now },
      isDeleted: false,
    });

    let suspendedCount = 0;
    for (const gym of expiredSubscriptions) {
      gym.status = GymStatus.SUSPENDED;
      await gym.save();
      suspendedCount++;

      await NotificationService.sendToUser(
        gym.ownerId.toString(),
        gym._id.toString(),
        NotificationType.MEMBERSHIP_EXPIRED,
        'Subscription Suspended',
        `Your platform subscription for ${gym.name} has expired and is now suspended. Please make a payment to restore access.`
      );
    }

    if (expiredTrialCount > 0 || suspendedCount > 0) {
      logger.info(`🚨 Passive Gym Evaluator: [Trial Expired: ${expiredTrialCount}] [Suspended: ${suspendedCount}]`);
    }

    return { suspendedCount, expiredTrialCount };
  }

  /**
   * Alias: returns only the count of trial-expired gyms (for cron tests)
   */
  public static async checkAndExpireTrials(): Promise<number> {
    const now = new Date();
    const expiredTrials = await Gym.find({
      status: GymStatus.ACTIVE,
      plan: GymPlan.TRIAL,
      trialEndsAt: { $lt: now },
      isDeleted: false,
    });

    let count = 0;
    for (const gym of expiredTrials) {
      gym.status = GymStatus.TRIAL_EXPIRED;
      await gym.save();
      count++;
    }
    return count;
  }

  public static async listAllGyms(): Promise<{ gyms: any[] }> {
    const gyms = await Gym.find({ isDeleted: false })
      .populate('ownerId', 'fullName email phone')
      .sort({ createdAt: -1 });

    const gymListWithBranches = await Promise.all(
      gyms.map(async (g) => {
        const branches = await Branch.find({ gymId: g._id, isDeleted: false }).select('_id name');
        return {
          _id: g._id,
          name: g.name,
          plan: g.plan,
          status: g.status,
          owner: g.ownerId,
          createdAt: g.createdAt,
          branches,
        };
      })
    );

    return { gyms: gymListWithBranches };
  }

  public static readonly DEFAULT_MEMBERSHIP_PLANS: IGymMembershipPlan[] = [
    {
      id: 'monthly',
      name: 'Monthly Fitness',
      durationMonths: 1,
      price: 1500,
      description: '30 Days standard gym access',
      isActive: true,
    },
    {
      id: 'quarterly',
      name: 'Quarterly Transformation',
      durationMonths: 3,
      price: 4000,
      badge: 'Popular',
      description: '90 Days full gym access',
      isActive: true,
    },
    {
      id: 'half_yearly',
      name: 'Half-Yearly Pro',
      durationMonths: 6,
      price: 7500,
      description: '180 Days intensive gym access',
      isActive: true,
    },
    {
      id: 'annual',
      name: 'Annual Elite',
      durationMonths: 12,
      price: 14000,
      badge: 'Best Value',
      description: '365 Days complete elite access',
      isActive: true,
    },
    {
      id: 'pt_monthly',
      name: 'Personal Training (PT) Pack',
      durationMonths: 1,
      price: 5000,
      description: '30 Days 1-on-1 personal trainer',
      isActive: true,
    },
    {
      id: 'custom',
      name: 'Custom Plan',
      durationMonths: 1,
      price: 2000,
      description: 'Custom duration & fee',
      isActive: true,
    },
  ];

  public static async getMembershipPlans(gymId: string): Promise<IGymMembershipPlan[]> {
    const gym = await Gym.findOne({ _id: gymId, isDeleted: false });
    if (!gym) throw AppError.notFound('Gym organization not found');

    if (gym.membershipPlans && gym.membershipPlans.length > 0) {
      return gym.membershipPlans;
    }
    return GymService.DEFAULT_MEMBERSHIP_PLANS;
  }

  public static async updateMembershipPlans(gymId: string, plans: IGymMembershipPlan[]): Promise<IGymMembershipPlan[]> {
    const gym = await Gym.findOne({ _id: gymId, isDeleted: false });
    if (!gym) throw AppError.notFound('Gym organization not found');

    gym.membershipPlans = plans;
    await gym.save();
    return gym.membershipPlans;
  }
}
