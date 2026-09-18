import mongoose from 'mongoose';
import { SaasInquiry } from './saasInquiry.model';
import { ISaasInquiry, SaasInquiryStatus } from './saasInquiry.types';
import { AppError } from '../../common/utils/AppError';

export interface CreateInquiryInput {
  ownerName: string;
  gymName: string;
  phone: string;
  city?: string;
  email?: string;
  message?: string;
}

export class SaasInquiryService {
  public static async createInquiry(input: CreateInquiryInput): Promise<ISaasInquiry> {
    const inquiry = new SaasInquiry({
      ownerName: input.ownerName.trim(),
      gymName: input.gymName.trim(),
      phone: input.phone.trim(),
      city: (input.city && input.city.trim()) || 'Unspecified',
      email: input.email?.trim() || undefined,
      message: input.message?.trim() || undefined,
      status: SaasInquiryStatus.NEW,
    });

    await inquiry.save();
    return inquiry;
  }

  public static async listInquiries(query: { status?: string; limit?: number; page?: number }): Promise<{
    inquiries: ISaasInquiry[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    const filter: Record<string, any> = {};
    if (query.status && Object.values(SaasInquiryStatus).includes(query.status as SaasInquiryStatus)) {
      filter.status = query.status;
    }

    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    const skip = (page - 1) * limit;

    const [inquiries, total] = await Promise.all([
      SaasInquiry.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      SaasInquiry.countDocuments(filter),
    ]);

    return {
      inquiries: inquiries as unknown as ISaasInquiry[],
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  public static async updateStatus(
    id: string,
    status: SaasInquiryStatus,
    noteText?: string,
    actingUserId?: string,
    trialGymId?: string
  ): Promise<ISaasInquiry> {
    const inquiry = await SaasInquiry.findById(id);
    if (!inquiry) {
      throw AppError.notFound('SaaS inquiry not found');
    }

    inquiry.status = status;

    if (trialGymId && mongoose.Types.ObjectId.isValid(trialGymId)) {
      inquiry.trialGymId = new mongoose.Types.ObjectId(trialGymId);
    }

    if (noteText && noteText.trim()) {
      inquiry.notes.push({
        note: noteText.trim(),
        addedByUserId: actingUserId ? new mongoose.Types.ObjectId(actingUserId) : undefined,
        addedAt: new Date(),
      });
    }

    await inquiry.save();
    return inquiry;
  }

  public static async addNote(id: string, noteText: string, actingUserId?: string): Promise<ISaasInquiry> {
    const inquiry = await SaasInquiry.findById(id);
    if (!inquiry) {
      throw AppError.notFound('SaaS inquiry not found');
    }

    inquiry.notes.push({
      note: noteText.trim(),
      addedByUserId: actingUserId ? new mongoose.Types.ObjectId(actingUserId) : undefined,
      addedAt: new Date(),
    });

    await inquiry.save();
    return inquiry;
  }
}
