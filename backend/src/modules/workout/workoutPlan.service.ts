import mongoose from 'mongoose';
import { WorkoutPlan } from './workoutPlan.model';
import { Member } from '../member/member.model';
import { IWorkoutPlan, PlanStatus } from './workoutPlan.types';
import { Role } from '../../common/constants/roles.enum';
import { AppError } from '../../common/utils/AppError';
import { getPaginationParams, buildPaginationMeta, ParsedPagination } from '../../common/utils/pagination';
import { NotificationService } from '../notification/notification.service';
import { NotificationType } from '../notification/notification.types';
import { notificationTemplates } from '../notification/notificationTemplates';
import { logger } from '../../config/logger';

export class WorkoutPlanService {
  /**
  /**
   * Create a Workout Plan for a Member
   */
  public static async createWorkoutPlan(
    memberId: string,
    planData: any,
    creatorUserId: string,
    _actorRole?: Role,
    targetGymId?: string
  ): Promise<IWorkoutPlan> {
    const gymId = targetGymId || planData.gymId;


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
      throw AppError.notFound('Target Member profile not found');
    }

    const effectiveGymId = gymId || member.gymId.toString();

    const plan = new WorkoutPlan({
      gymId: new mongoose.Types.ObjectId(effectiveGymId),
      memberId: member._id,
      createdBy: new mongoose.Types.ObjectId(creatorUserId || member.userId),
      title: planData.title,
      description: planData.description,
      durationWeeks: planData.durationWeeks || 4,
      daysPerWeek: planData.daysPerWeek || 3,
      days: (planData.days || []).map((d: any) => ({
        dayName: d.dayName,
        exercises: (d.exercises || []).map((e: any) => ({
          exerciseId: new mongoose.Types.ObjectId(e.exerciseId),
          targetSets: e.targetSets,
          targetReps: e.targetReps,
          restSeconds: e.restSeconds || 60,
        })),
      })),
      isActive: true,
    });

    await plan.save();

    const template = notificationTemplates[NotificationType.WORKOUT_ASSIGNED](plan.title);
    await NotificationService.sendToUser(
      member.userId.toString(),
      effectiveGymId,
      NotificationType.WORKOUT_ASSIGNED,
      template.title,
      template.body,
      { planId: plan._id.toString() }
    );

    logger.info(`📋 Workout Plan assigned: [ID: ${plan._id}] [Title: ${plan.title}] [Member: ${member._id}]`);
    return plan;
  }

  /**
   * Get Active Plan for Member
   */
  public static async getActivePlanForMember(memberId: string, gymId?: string): Promise<IWorkoutPlan | null> {
    const memberFilter: any = {
      $or: [
        { _id: mongoose.Types.ObjectId.isValid(memberId) ? memberId : undefined },
        { userId: mongoose.Types.ObjectId.isValid(memberId) ? memberId : undefined },
      ],
      isDeleted: false,
    };
    if (gymId) memberFilter.gymId = new mongoose.Types.ObjectId(gymId);

    const member = await Member.findOne(memberFilter);

    if (!member) return null;

    return WorkoutPlan.findOne({ memberId: member._id, gymId: member.gymId, isActive: true, isDeleted: false })
      .populate('days.exercises.exerciseId')
      .populate('createdBy', 'fullName role');
  }

  /**
   * List Workout Plans
   */
  public static async listWorkoutPlans(
    memberId: string,
    options: { page?: number | string; limit?: number | string } = {},
    gymId?: string
  ): Promise<{ plans: IWorkoutPlan[]; meta: ReturnType<typeof buildPaginationMeta> }> {
    const { page, limit, skip }: ParsedPagination = getPaginationParams(options);

    const filter: Record<string, unknown> = { isDeleted: false };
    if (gymId) filter.gymId = new mongoose.Types.ObjectId(gymId);

    if (memberId) {
      const memberFilter: any = {
        $or: [
          { _id: mongoose.Types.ObjectId.isValid(memberId) ? memberId : undefined },
          { userId: mongoose.Types.ObjectId.isValid(memberId) ? memberId : undefined },
        ],
        isDeleted: false,
      };
      if (gymId) memberFilter.gymId = new mongoose.Types.ObjectId(gymId);

      const member = await Member.findOne(memberFilter);
      if (member) filter.memberId = member._id;
    }

    const [plans, totalItems] = await Promise.all([
      WorkoutPlan.find(filter)
        .populate('days.exercises.exerciseId')
        .skip(skip)
        .limit(limit)
        .sort({ createdAt: -1 }),
      WorkoutPlan.countDocuments(filter),
    ]);

    const meta = buildPaginationMeta(totalItems, page, limit);

    return { plans, meta };
  }

  /**
   * Update Workout Plan with strict gymId tenant match
   */
  public static async updateWorkoutPlan(
    planId: string,
    gymId: string,
    updateData: any
  ): Promise<IWorkoutPlan> {
    const filter: any = { _id: planId, isDeleted: false };
    if (gymId) filter.gymId = new mongoose.Types.ObjectId(gymId);

    const formattedData = { ...updateData };
    if (updateData.days && Array.isArray(updateData.days)) {
      formattedData.days = updateData.days.map((d: any) => ({
        dayLabel: d.dayLabel || d.dayName,
        dayName: d.dayName || d.dayLabel,
        exercises: (d.exercises || []).map((e: any) => ({
          exerciseId: new mongoose.Types.ObjectId(e.exerciseId),
          order: e.order || 1,
          targetSets: Number(e.targetSets),
          targetReps: Number(e.targetReps),
          targetWeightKg: e.targetWeightKg ? Number(e.targetWeightKg) : undefined,
          restSeconds: e.restSeconds ? Number(e.restSeconds) : 60,
          notes: e.notes ? e.notes.trim() : undefined,
        })),
      }));
    }

    const plan = await WorkoutPlan.findOneAndUpdate(filter, formattedData, { new: true });
    if (!plan) throw AppError.notFound('Workout plan not found');
    logger.info(`📋 Workout Plan updated: [ID: ${plan._id}] [Gym: ${gymId}]`);
    return plan;
  }

  /**
   * Delete Workout Plan with strict gymId tenant match
   */
  public static async deleteWorkoutPlan(planId: string, gymId: string): Promise<void> {
    const filter: any = { _id: planId, isDeleted: false };
    if (gymId) filter.gymId = new mongoose.Types.ObjectId(gymId);

    const plan = await WorkoutPlan.findOneAndUpdate(
      filter,
      { isDeleted: true, isActive: false },
      { new: true }
    );
    if (!plan) throw AppError.notFound('Workout plan not found');
    logger.info(`🗑️ Workout Plan deleted: [ID: ${planId}] [Gym: ${gymId}]`);
  }

  /**
   * Archive Workout Plan with strict gymId tenant match
   */
  public static async archiveWorkoutPlan(planId: string, gymId: string): Promise<IWorkoutPlan> {
    const filter: any = { _id: planId, isDeleted: false };
    if (gymId) filter.gymId = new mongoose.Types.ObjectId(gymId);

    const plan = await WorkoutPlan.findOneAndUpdate(
      filter,
      { isActive: false, isDeleted: true, status: PlanStatus.ARCHIVED },
      { new: true }
    );
    if (!plan) throw AppError.notFound('Workout plan not found');
    return plan;
  }

  /**
   * Duplicate Workout Plan for New Cycle with strict gymId tenant match
   */
  public static async duplicatePlanForNewCycle(
    planId: string,
    gymId: string,
    newTitle?: string
  ): Promise<IWorkoutPlan> {
    const filter: any = { _id: planId, isDeleted: false };
    if (gymId) filter.gymId = new mongoose.Types.ObjectId(gymId);

    const existing = await WorkoutPlan.findOne(filter);
    if (!existing) throw AppError.notFound('Original workout plan not found');

    const titleToUse = newTitle || `${existing.title} (New Cycle)`;

    const duplicated = new WorkoutPlan({
      gymId: existing.gymId,
      memberId: existing.memberId,
      createdBy: existing.createdBy,
      title: titleToUse,
      description: existing.description,
      durationWeeks: existing.durationWeeks,
      daysPerWeek: existing.daysPerWeek,
      days: existing.days,
      isActive: true,
    });

    await duplicated.save();

    // Archive original plan
    existing.status = PlanStatus.ARCHIVED;
    existing.isActive = false;
    await existing.save();

    return duplicated;
  }
}
