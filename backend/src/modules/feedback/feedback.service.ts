import mongoose from 'mongoose';
import { TrainerFeedback } from './trainerFeedback.model';
import { Member } from '../member/member.model';
import { Trainer } from '../trainer/trainer.model';
import { ITrainerFeedback } from './feedback.types';
import { Role } from '../../common/constants/roles.enum';
import { AppError } from '../../common/utils/AppError';
import { getPaginationParams, buildPaginationMeta, ParsedPagination } from '../../common/utils/pagination';
import { logger } from '../../config/logger';

export class FeedbackService {
  /**
   * Create Trainer Feedback for a Member
   */
  public static async createFeedback(
    input: {
      memberId: string;
      note: string;
      rating?: number;
      visibleToMember?: boolean;
      workoutLogId?: string;
    },
    actingUser: { id: string; role: Role; gymId?: string }
  ): Promise<ITrainerFeedback> {
    const member = await Member.findOne({ _id: input.memberId, isDeleted: false });
    if (!member) throw AppError.notFound('Member profile not found');

    let trainerDoc: any = null;

    if (actingUser.role === Role.TRAINER) {
      trainerDoc = await Trainer.findOne({ userId: actingUser.id, isDeleted: false });
      if (!trainerDoc) throw AppError.notFound('Trainer profile not found');

      const isAssigned = member.assignedTrainerId?.toString() === trainerDoc._id.toString();
      if (!isAssigned) {
        throw AppError.forbidden('Trainers can only leave feedback for their assigned members');
      }
    } else if (actingUser.role === Role.GYM_OWNER || actingUser.role === Role.BRANCH_MANAGER) {
      trainerDoc = await Trainer.findOne({ gymId: member.gymId, isDeleted: false });
    } else {
      throw AppError.forbidden('Only trainers, managers, or owners can create member feedback');
    }

    const feedback = new TrainerFeedback({
      gymId: member.gymId,
      memberId: member._id,
      trainerId: trainerDoc ? trainerDoc._id : member.assignedTrainerId || member._id,
      workoutLogId: input.workoutLogId ? new mongoose.Types.ObjectId(input.workoutLogId) : undefined,
      note: input.note,
      rating: input.rating,
      visibleToMember: input.visibleToMember ?? true,
    });

    await feedback.save();
    logger.info(`📝 Feedback created for Member ${member._id} by User ${actingUser.id}`);
    return feedback;
  }

  /**
   * List Feedback for Member
   */
  public static async listFeedbackForMember(
    memberId: string,
    actingUser: { id: string; role: Role },
    options: { page?: number | string; limit?: number | string } = {}
  ): Promise<{ feedbacks: ITrainerFeedback[]; meta: ReturnType<typeof buildPaginationMeta> }> {
    const { page, limit, skip }: ParsedPagination = getPaginationParams(options);

    const filter: Record<string, unknown> = {
      memberId: new mongoose.Types.ObjectId(memberId),
    };

    if (actingUser.role === Role.MEMBER) {
      filter.visibleToMember = true;
    }

    const [feedbacks, totalItems] = await Promise.all([
      TrainerFeedback.find(filter)
        .populate({ path: 'trainerId', populate: { path: 'userId', select: 'fullName' } })
        .skip(skip)
        .limit(limit)
        .sort({ createdAt: -1 }),
      TrainerFeedback.countDocuments(filter),
    ]);

    const meta = buildPaginationMeta(totalItems, page, limit);

    return { feedbacks, meta };
  }

  /**
   * Update Feedback
   */
  public static async updateFeedback(
    feedbackId: string,
    updateData: { note?: string; rating?: number; visibleToMember?: boolean },
    actingUser: { id: string; role: Role; gymId?: string }
  ): Promise<ITrainerFeedback> {
    const filter: Record<string, unknown> = { _id: feedbackId };
    if (actingUser.gymId) filter.gymId = new mongoose.Types.ObjectId(actingUser.gymId);

    const feedback = await TrainerFeedback.findOne(filter);
    if (!feedback) throw AppError.notFound('Feedback entry not found');

    if (actingUser.role === Role.TRAINER) {
      const trainerDoc = await Trainer.findOne({ userId: actingUser.id });
      if (!trainerDoc || feedback.trainerId.toString() !== trainerDoc._id.toString()) {
        throw AppError.forbidden('Trainers can only edit their own feedback entries');
      }
    } else if (actingUser.role !== Role.GYM_OWNER && actingUser.role !== Role.BRANCH_MANAGER) {
      throw AppError.forbidden('Unauthorized to edit feedback entry');
    }

    if (updateData.note !== undefined) feedback.note = updateData.note;
    if (updateData.rating !== undefined) feedback.rating = updateData.rating;
    if (updateData.visibleToMember !== undefined) feedback.visibleToMember = updateData.visibleToMember;

    await feedback.save();
    return feedback;
  }

  /**
   * Delete Feedback
   */
  public static async deleteFeedback(
    feedbackId: string,
    actingUser: { id: string; role: Role; gymId?: string }
  ): Promise<void> {
    const filter: Record<string, unknown> = { _id: feedbackId };
    if (actingUser.gymId) filter.gymId = new mongoose.Types.ObjectId(actingUser.gymId);

    const feedback = await TrainerFeedback.findOne(filter);
    if (!feedback) throw AppError.notFound('Feedback entry not found');

    if (actingUser.role === Role.TRAINER) {
      const trainerDoc = await Trainer.findOne({ userId: actingUser.id });
      if (!trainerDoc || feedback.trainerId.toString() !== trainerDoc._id.toString()) {
        throw AppError.forbidden('Trainers can only delete their own feedback entries');
      }
    } else if (actingUser.role !== Role.GYM_OWNER && actingUser.role !== Role.BRANCH_MANAGER) {
      throw AppError.forbidden('Unauthorized to delete feedback entry');
    }

    await TrainerFeedback.findByIdAndDelete(feedback._id);
  }
}
