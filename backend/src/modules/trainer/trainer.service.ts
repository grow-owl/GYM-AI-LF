import mongoose from 'mongoose';
import { Trainer } from './trainer.model';
import { User } from '../user/user.model';
import { Member } from '../member/member.model';
import { Branch } from '../gym/branch.model';
import { Role } from '../user/user.types';
import { ITrainer } from './trainer.types';
import { AppError } from '../../common/utils/AppError';
import { getPaginationParams, buildPaginationMeta, ParsedPagination } from '../../common/utils/pagination';
import { logger } from '../../config/logger';

export interface CreateTrainerInput {
  fullName: string;
  email: string;
  phone: string;
  password: string;
  branchId: string;
  specializations?: string[];
  bio?: string;
  certifications?: { name: string; issuedBy: string; year: number }[];
  maxMemberCapacity?: number;
}

export class TrainerService {
  /**
   * Create a Trainer profile & linked User identity
   */
  public static async createTrainer(
    gymId: string,
    branchId: string,
    input: CreateTrainerInput
  ): Promise<ITrainer> {
    // 1. Check duplicate email in platform
    const existingUser = await User.findOne({ email: input.email.toLowerCase(), isDeleted: false });
    if (existingUser) {
      throw AppError.conflict('User email is already registered');
    }

    let branch = await Branch.findOne({ _id: branchId, isDeleted: false });
    if (!branch && mongoose.Types.ObjectId.isValid(gymId)) {
      branch = await Branch.findOne({ gymId: new mongoose.Types.ObjectId(gymId), isDeleted: false });
    }
    const targetGymId = branch ? branch.gymId : (mongoose.Types.ObjectId.isValid(gymId) ? new mongoose.Types.ObjectId(gymId) : null);
    const targetBranchId = branch ? branch._id : null;

    if (!targetGymId || !targetBranchId) {
      throw AppError.badRequest('Valid gym and branch are required for trainer registration');
    }

    // 2. Create Base User with TRAINER role
    const user = new User({
      fullName: input.fullName,
      email: input.email.toLowerCase(),
      phone: input.phone,
      password: input.password || 'Trainer@123',
      role: Role.TRAINER,
      gymId: targetGymId,
      branchId: targetBranchId,
      isActive: true,
    });
    await user.save();

    // 3. Create Trainer record
    const trainer = new Trainer({
      userId: user._id,
      gymId: targetGymId,
      branchId: targetBranchId,
      specializations: input.specializations || [],
      bio: input.bio,
      certifications: input.certifications || [],
      maxMemberCapacity: input.maxMemberCapacity,
    });
    await trainer.save();

    logger.info(`💪 Trainer profile created: [ID: ${trainer._id}] [User: ${user._id}] [Gym: ${targetGymId}]`);
    return trainer;
  }

  /**
   * Get active member workload count for a Trainer
   */
  public static async getTrainerWorkload(trainerId: string): Promise<number> {
    return Member.countDocuments({
      assignedTrainerId: new mongoose.Types.ObjectId(trainerId),
      isDeleted: false,
    });
  }

  /**
   * Auto-assign the least loaded trainer in a branch
   */
  public static async autoAssignLeastLoadedTrainer(
    gymId: string,
    branchId: string
  ): Promise<ITrainer | null> {
    const trainers = await Trainer.find({
      gymId: new mongoose.Types.ObjectId(gymId),
      branchId: new mongoose.Types.ObjectId(branchId),
      isDeleted: false,
    });

    if (trainers.length === 0) {
      return null;
    }

    let leastLoadedTrainer: ITrainer | null = null;
    let minLoad = Infinity;

    for (const trainer of trainers) {
      const workload = await this.getTrainerWorkload(trainer._id.toString());
      const maxCap = trainer.maxMemberCapacity || Infinity;

      if (workload < maxCap && workload < minLoad) {
        minLoad = workload;
        leastLoadedTrainer = trainer;
      }
    }

    return leastLoadedTrainer;
  }

  /**
   * List Trainers in gym/branch with pagination
   */
  public static async listTrainers(
    gymId: string,
    branchId?: string,
    options: { page?: number | string; limit?: number | string } = {}
  ): Promise<{ trainers: ITrainer[]; meta: ReturnType<typeof buildPaginationMeta> }> {
    const { page, limit, skip }: ParsedPagination = getPaginationParams(options);

    let filter: Record<string, unknown> = { isDeleted: false };
    if (mongoose.Types.ObjectId.isValid(gymId)) {
      filter.gymId = new mongoose.Types.ObjectId(gymId);
    }
    if (branchId && mongoose.Types.ObjectId.isValid(branchId)) {
      filter.branchId = new mongoose.Types.ObjectId(branchId);
    }

    let [trainers, totalItems] = await Promise.all([
      Trainer.find(filter).populate('userId', 'fullName email phone avatarUrl').skip(skip).limit(limit).sort({ createdAt: -1 }),
      Trainer.countDocuments(filter),
    ]);

    const meta = buildPaginationMeta(totalItems, page, limit);

    return { trainers, meta };
  }

  /**
   * Get single Trainer by ID
   */
  public static async getTrainerById(trainerId: string, gymId?: string): Promise<ITrainer> {
    const filter: any = { _id: trainerId, isDeleted: false };
    if (gymId) filter.gymId = new mongoose.Types.ObjectId(gymId);

    const trainer = await Trainer.findOne(filter).populate(
      'userId',
      'fullName email phone avatarUrl'
    );
    if (!trainer) {
      throw AppError.notFound('Trainer not found');
    }
    return trainer;
  }

  /**
   * Update Trainer profile
   */
  public static async updateTrainer(
    trainerId: string,
    input: Partial<ITrainer>,
    gymId?: string
  ): Promise<ITrainer> {
    const filter: any = { _id: trainerId, isDeleted: false };
    if (gymId) filter.gymId = new mongoose.Types.ObjectId(gymId);

    const trainer = await Trainer.findOneAndUpdate(filter, input, { new: true });
    if (!trainer) {
      throw AppError.notFound('Trainer not found');
    }
    return trainer;
  }

  /**
   * Soft-delete Trainer with full cascade:
   * 1. Mark Trainer as deleted
   * 2. Deactivate linked User (prevents login)
   * 3. Unset assignedTrainerId on all linked Members
   */
  public static async deleteTrainer(trainerId: string, gymId?: string): Promise<void> {
    const filter: any = { _id: trainerId, isDeleted: false };
    if (gymId) filter.gymId = new mongoose.Types.ObjectId(gymId);

    const trainer = await Trainer.findOneAndUpdate(filter, { isDeleted: true });
    if (!trainer) {
      throw AppError.notFound('Trainer not found');
    }

    // Run cascade operations in parallel
    await Promise.all([
      // Deactivate linked User account so deleted trainer cannot log in
      User.findByIdAndUpdate(trainer.userId, { isActive: false }),
      // Remove trainer reference from all assigned Member records
      Member.updateMany(
        { assignedTrainerId: trainer._id, isDeleted: false },
        { $unset: { assignedTrainerId: 1 } }
      ),
    ]);

    logger.info(
      `🗑️ Trainer cascade delete: [Trainer: ${trainer._id}] [User deactivated: ${trainer.userId}] [Members unassigned]`
    );
  }

  public static async softDeleteTrainer(trainerId: string, _force?: boolean, gymId?: string): Promise<void> {
    return this.deleteTrainer(trainerId, gymId);
  }

  /**
   * Get assigned member clients for trainer user
   */
  public static async getTrainerClients(gymId: string, trainerUserId: string): Promise<any[]> {
    const trainer = await Trainer.findOne({ userId: new mongoose.Types.ObjectId(trainerUserId), isDeleted: false });
    if (!trainer) return [];

    return Member.find({
      gymId: new mongoose.Types.ObjectId(gymId),
      assignedTrainerId: trainer._id,
      isDeleted: false,
    }).populate('userId', 'fullName email phone avatarUrl');
  }
}
