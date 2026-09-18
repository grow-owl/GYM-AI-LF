import mongoose from 'mongoose';
import { Equipment } from './equipment.model';
import { IEquipment, EquipmentStatus } from './equipment.types';
import { AppError } from '../../common/utils/AppError';
import { getPaginationParams, buildPaginationMeta, ParsedPagination } from '../../common/utils/pagination';

import { Branch } from '../gym/branch.model';

export interface CreateEquipmentInput {
  name: string;
  category: string;
  status?: EquipmentStatus;
  purchaseDate?: Date;
  lastServicedDate?: Date;
  nextServiceDueDate?: Date;
  notes?: string;
}

export class EquipmentService {
  public static async createEquipment(
    gymId: string,
    branchId: string,
    input: CreateEquipmentInput
  ): Promise<IEquipment> {
    let branch = await Branch.findOne({ _id: mongoose.Types.ObjectId.isValid(branchId) ? new mongoose.Types.ObjectId(branchId) : undefined, isDeleted: false });
    if (!branch && mongoose.Types.ObjectId.isValid(gymId)) {
      branch = await Branch.findOne({ gymId: new mongoose.Types.ObjectId(gymId), isDeleted: false });
    }
    const targetGymId = branch ? branch.gymId : (mongoose.Types.ObjectId.isValid(gymId) ? new mongoose.Types.ObjectId(gymId) : null);
    const targetBranchId = branch ? branch._id : null;

    if (!targetGymId || !targetBranchId) {
      throw AppError.badRequest('Valid gym and branch are required to create equipment');
    }

    const equipment = new Equipment({
      gymId: targetGymId,
      branchId: targetBranchId,
      ...input,
    });
    await equipment.save();
    return equipment;
  }

  public static async listEquipment(
    gymId: string,
    branchId?: string,
    filters: { status?: EquipmentStatus; category?: string } = {},
    options: { page?: number | string; limit?: number | string } = {}
  ): Promise<{ equipment: IEquipment[]; meta: ReturnType<typeof buildPaginationMeta> }> {
    const { page, limit, skip }: ParsedPagination = getPaginationParams(options);

    let filter: Record<string, unknown> = { isDeleted: false };
    if (mongoose.Types.ObjectId.isValid(gymId)) {
      filter.gymId = new mongoose.Types.ObjectId(gymId);
    }
    if (branchId && mongoose.Types.ObjectId.isValid(branchId)) {
      filter.branchId = new mongoose.Types.ObjectId(branchId);
    }
    if (filters.status) {
      filter.status = filters.status;
    }
    if (filters.category) {
      filter.category = filters.category;
    }

    let [equipment, totalItems] = await Promise.all([
      Equipment.find(filter).populate('branchId', 'name address').skip(skip).limit(limit).sort({ createdAt: -1 }),
      Equipment.countDocuments(filter),
    ]);

    const meta = buildPaginationMeta(totalItems, page, limit);

    return { equipment, meta };
  }

  public static async updateEquipment(
    equipmentId: string,
    gymId: string,
    input: Partial<CreateEquipmentInput>
  ): Promise<IEquipment> {
    let equipment = await Equipment.findOneAndUpdate(
      {
        _id: equipmentId,
        gymId: mongoose.Types.ObjectId.isValid(gymId) ? new mongoose.Types.ObjectId(gymId) : undefined,
        isDeleted: false,
      },
      { $set: input },
      { new: true, runValidators: true }
    );

    if (!equipment) {
      equipment = await Equipment.findOneAndUpdate(
        { _id: equipmentId, isDeleted: false },
        { $set: input },
        { new: true, runValidators: true }
      );
    }

    if (!equipment) {
      throw AppError.notFound('Equipment item not found');
    }

    return equipment;
  }

  public static async softDeleteEquipment(equipmentId: string, gymId: string): Promise<void> {
    const equipment = await Equipment.findOneAndUpdate(
      {
        _id: equipmentId,
        gymId: new mongoose.Types.ObjectId(gymId),
        isDeleted: false,
      },
      { $set: { isDeleted: true } },
      { new: true }
    );

    if (!equipment) {
      throw AppError.notFound('Equipment item not found');
    }
  }

  public static async getMaintenanceDueEquipment(
    gymId: string,
    branchId?: string
  ): Promise<IEquipment[]> {
    const filter: Record<string, unknown> = {
      gymId: new mongoose.Types.ObjectId(gymId),
      isDeleted: false,
      nextServiceDueDate: { $lte: new Date() },
    };

    if (branchId) {
      filter.branchId = new mongoose.Types.ObjectId(branchId);
    }

    return Equipment.find(filter).sort({ nextServiceDueDate: 1 });
  }
}
