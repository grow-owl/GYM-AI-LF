import { Types } from 'mongoose';

export enum EquipmentStatus {
  WORKING = 'WORKING',
  MAINTENANCE = 'MAINTENANCE',
  BROKEN = 'BROKEN',
  RETIRED = 'RETIRED',
}

export interface IEquipment {
  _id: Types.ObjectId;
  gymId: Types.ObjectId;
  branchId: Types.ObjectId;
  name: string;
  category: string;
  status: EquipmentStatus;
  purchaseDate?: Date;
  lastServicedDate?: Date;
  nextServiceDueDate?: Date;
  notes?: string;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}
