import { Types } from 'mongoose';

export type ProductCategory = 'supplement' | 'merchandise' | 'service_package' | 'gear';

export interface IProduct {
  _id: Types.ObjectId;
  gymId: Types.ObjectId;
  branchId?: Types.ObjectId;
  name: string;
  category: ProductCategory;
  price: number;
  stockQuantity?: number;
  isActive: boolean;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}
