import mongoose from 'mongoose';
import { Member } from '../../modules/member/member.model';
import { Trainer } from '../../modules/trainer/trainer.model';
import { AppError } from './AppError';
import { Role } from '../constants/roles.enum';

export interface ActingUser {
  id: string;
  role: Role;
  gymId?: string | mongoose.Types.ObjectId;
  branchId?: string | mongoose.Types.ObjectId;
}

/**
 * Validates whether the acting user is authorized to access data for the target member.
 * Enforces ownership, trainer-client assignment, and gym/branch multi-tenant scoping.
 */
export async function validateMemberAccess(
  actingUser: ActingUser,
  requestedMemberId?: string
) {
  let targetMemberId = requestedMemberId;

  // If no requestedMemberId is supplied and caller is MEMBER, default to their own user id
  if (!targetMemberId && actingUser.role === Role.MEMBER) {
    targetMemberId = actingUser.id;
  }

  if (!targetMemberId) {
    throw AppError.badRequest('Member ID is required');
  }

  const targetMember = await Member.findOne({
    $or: [
      { _id: mongoose.Types.ObjectId.isValid(targetMemberId) ? targetMemberId : undefined },
      { userId: mongoose.Types.ObjectId.isValid(targetMemberId) ? targetMemberId : undefined },
    ],
    isDeleted: false,
  });

  if (!targetMember) {
    throw AppError.notFound('Member profile not found');
  }

  if (actingUser.role === Role.SUPER_ADMIN) {
    return targetMember;
  }

  if (actingUser.role === Role.MEMBER) {
    const callerIdStr = actingUser.id.toString();
    const isOwnProfile =
      targetMember.userId?.toString() === callerIdStr ||
      targetMember._id.toString() === callerIdStr;

    if (!isOwnProfile) {
      throw AppError.forbidden('Access denied: You can only access your own member records');
    }
    return targetMember;
  }

  if (actingUser.role === Role.TRAINER) {
    const trainerDoc = await Trainer.findOne({
      userId: new mongoose.Types.ObjectId(actingUser.id),
      isDeleted: false,
    });

    if (
      !trainerDoc ||
      !targetMember.assignedTrainerId ||
      targetMember.assignedTrainerId.toString() !== trainerDoc._id.toString()
    ) {
      throw AppError.forbidden('Access denied: Member is not assigned to this trainer');
    }
    return targetMember;
  }

  if (
    actingUser.role === Role.GYM_OWNER ||
    actingUser.role === Role.BRANCH_MANAGER ||
    actingUser.role === Role.KIOSK
  ) {
    const callerGymId = actingUser.gymId?.toString();
    const memberGymId = targetMember.gymId?.toString();

    if (callerGymId && memberGymId && callerGymId !== memberGymId) {
      throw AppError.forbidden('Access denied: Member belongs to another gym organization');
    }

    if (actingUser.role === Role.BRANCH_MANAGER || actingUser.role === Role.KIOSK) {
      const callerBranchId = actingUser.branchId?.toString();
      const memberBranchId = targetMember.branchId?.toString();

      if (callerBranchId && memberBranchId && callerBranchId !== memberBranchId) {
        throw AppError.forbidden('Access denied: Member belongs to another branch');
      }
    }

    return targetMember;
  }

  throw AppError.forbidden('Access denied: Unauthorized role');
}
