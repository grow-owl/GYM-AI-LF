import mongoose from 'mongoose';
import { DietPlan } from './dietPlan.model';
import { Member } from '../member/member.model';
import { Trainer } from '../trainer/trainer.model';
import { IDietPlan, IMeal } from './dietPlan.types';
import { PlanStatus } from '../workout/workoutPlan.types';
import { Role } from '../user/user.types';
import { AppError } from '../../common/utils/AppError';
import { getPaginationParams, buildPaginationMeta, ParsedPagination } from '../../common/utils/pagination';
import { logger } from '../../config/logger';

export interface CreateDietPlanInput {
  title: string;
  dailyCalorieTarget?: number;
  dailyProteinTarget_g?: number;
  meals: IMeal[];
  startDate: Date;
  endDate?: Date;
}

export class DietPlanService {
  /**
   * Create a Diet Plan for a Member
   */
  public static async createDietPlan(
    memberId: string,
    input: CreateDietPlanInput,
    actingUserId: string,
    actingUserRole: Role,
    gymId?: string
  ): Promise<IDietPlan> {
    const memberFilter: any = { _id: memberId, isDeleted: false };
    if (gymId) memberFilter.gymId = new mongoose.Types.ObjectId(gymId);

    const member = await Member.findOne(memberFilter);
    if (!member) {
      throw AppError.notFound('Member profile not found');
    }

    let trainerDocId: mongoose.Types.ObjectId | undefined;

    // Authorization Check: Trainer assigned to member or staff
    if (actingUserRole === Role.TRAINER) {
      const trainer = await Trainer.findOne({ userId: actingUserId, isDeleted: false });
      if (!trainer) {
        throw AppError.notFound('Trainer profile not found');
      }
      trainerDocId = trainer._id;

      if (!member.assignedTrainerId || !member.assignedTrainerId.equals(trainer._id)) {
        throw AppError.forbidden('Trainers can only create diet plans for their assigned members');
      }
    }
    // For GYM_OWNER / BRANCH_MANAGER: trainerDocId remains undefined.
    // Storing a User._id in a Trainer-ref field would break .populate('createdByTrainerId').

    // Archive previous active diet plans for member
    await DietPlan.updateMany(
      { memberId: member._id, status: PlanStatus.ACTIVE },
      { status: PlanStatus.ARCHIVED }
    );

    const dietPlan = new DietPlan({
      gymId: member.gymId,
      memberId: member._id,
      ...(trainerDocId && { createdByTrainerId: trainerDocId }),
      title: input.title,
      dailyCalorieTarget: input.dailyCalorieTarget,
      dailyProteinTarget_g: input.dailyProteinTarget_g,
      meals: input.meals,
      startDate: input.startDate,
      endDate: input.endDate,
      status: PlanStatus.ACTIVE,
    });

    await dietPlan.save();
    logger.info(`🥗 Diet Plan created: [ID: ${dietPlan._id}] [Member: ${memberId}] [Title: ${input.title}]`);
    return dietPlan;
  }

  /**
   * Get active Diet Plan for a Member
   */
  public static async getActiveDietPlanForMember(memberId: string, gymId?: string): Promise<IDietPlan | null> {
    const memberFilter: any = {
      $or: [
        { _id: mongoose.Types.ObjectId.isValid(memberId) ? memberId : undefined },
        { userId: mongoose.Types.ObjectId.isValid(memberId) ? memberId : undefined },
      ],
      isDeleted: false,
    };
    if (gymId) memberFilter.gymId = new mongoose.Types.ObjectId(gymId);

    const member = await Member.findOne(memberFilter);

    if (!member) {
      throw AppError.notFound('Member not found');
    }

    return DietPlan.findOne({
      memberId: member._id,
      gymId: member.gymId,
      status: PlanStatus.ACTIVE,
      isDeleted: false,
    });
  }

  /**
   * List Diet Plans for a Member with pagination
   */
  public static async listDietPlans(
    memberId: string,
    options: { page?: number | string; limit?: number | string } = {},
    gymId?: string
  ): Promise<{ plans: IDietPlan[]; meta: ReturnType<typeof buildPaginationMeta> }> {
    const { page, limit, skip }: ParsedPagination = getPaginationParams(options);

    const memberFilter: any = {
      $or: [
        { _id: mongoose.Types.ObjectId.isValid(memberId) ? memberId : undefined },
        { userId: mongoose.Types.ObjectId.isValid(memberId) ? memberId : undefined },
      ],
      isDeleted: false,
    };
    if (gymId) memberFilter.gymId = new mongoose.Types.ObjectId(gymId);

    const member = await Member.findOne(memberFilter);

    if (!member) {
      throw AppError.notFound('Member profile not found');
    }

    const filter: any = { memberId: member._id, isDeleted: false };
    if (gymId) filter.gymId = new mongoose.Types.ObjectId(gymId);

    const [plans, totalItems] = await Promise.all([
      DietPlan.find(filter).skip(skip).limit(limit).sort({ createdAt: -1 }),
      DietPlan.countDocuments(filter),
    ]);

    const meta = buildPaginationMeta(totalItems, page, limit);

    return { plans, meta };
  }

  /**
   * Update Diet Plan
   */
  public static async updateDietPlan(planId: string, input: Partial<IDietPlan>, gymId?: string): Promise<IDietPlan> {
    const filter: any = { _id: planId, isDeleted: false };
    if (gymId) filter.gymId = new mongoose.Types.ObjectId(gymId);

    const plan = await DietPlan.findOneAndUpdate(filter, input, {
      new: true,
      runValidators: true,
    });

    if (!plan) {
      throw AppError.notFound('Diet plan not found');
    }
    return plan;
  }

  /**
   * Archive Diet Plan
   */
  public static async archiveDietPlan(planId: string, gymId?: string): Promise<IDietPlan> {
    const filter: any = { _id: planId, isDeleted: false };
    if (gymId) filter.gymId = new mongoose.Types.ObjectId(gymId);

    const plan = await DietPlan.findOneAndUpdate(
      filter,
      { status: PlanStatus.ARCHIVED },
      { new: true }
    );

    if (!plan) {
      throw AppError.notFound('Diet plan not found');
    }
    return plan;
  }

  /**
   * Delete Diet Plan
   */
  public static async deleteDietPlan(planId: string, gymId?: string): Promise<void> {
    const filter: any = { _id: planId, isDeleted: false };
    if (gymId) filter.gymId = new mongoose.Types.ObjectId(gymId);

    const plan = await DietPlan.findOneAndUpdate(
      filter,
      { isDeleted: true, status: PlanStatus.ARCHIVED },
      { new: true }
    );

    if (!plan) {
      throw AppError.notFound('Diet plan not found');
    }
    logger.info(`🗑️ Diet Plan deleted: [ID: ${planId}]`);
  }
}
