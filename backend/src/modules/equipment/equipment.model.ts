import mongoose, { Schema, Document } from 'mongoose';
import { IEquipment, EquipmentStatus } from './equipment.types';

export interface EquipmentDocument extends Omit<IEquipment, '_id'>, Document {}

const equipmentSchema = new Schema<EquipmentDocument>(
  {
    gymId: {
      type: Schema.Types.ObjectId,
      ref: 'Gym',
      required: true,
      index: true,
    },
    branchId: {
      type: Schema.Types.ObjectId,
      ref: 'Branch',
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    category: {
      type: String,
      required: true,
      trim: true,
    },
    status: {
      type: String,
      enum: Object.values(EquipmentStatus),
      default: EquipmentStatus.WORKING,
      required: true,
    },
    purchaseDate: {
      type: Date,
    },
    lastServicedDate: {
      type: Date,
    },
    nextServiceDueDate: {
      type: Date,
    },
    notes: {
      type: String,
      trim: true,
    },
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

equipmentSchema.index({ gymId: 1, branchId: 1, status: 1 });

export const Equipment = mongoose.model<EquipmentDocument>('Equipment', equipmentSchema);
