import mongoose, { Schema, Document } from 'mongoose';
import { IProduct } from './product.types';

export interface ProductDocument extends Omit<IProduct, '_id'>, Document {}

const productSchema = new Schema<ProductDocument>(
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
      required: false,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    category: {
      type: String,
      enum: ['supplement', 'merchandise', 'service_package', 'gear'],
      required: true,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    stockQuantity: {
      type: Number,
      default: undefined,
    },
    isActive: {
      type: Boolean,
      default: true,
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

productSchema.index({ gymId: 1, isActive: 1 });

export const Product = mongoose.model<ProductDocument>('Product', productSchema);
