import mongoose from 'mongoose';
import { WeightEntry } from './weightEntry.model';
import { ProgressPhoto } from './progressPhoto.model';
import { DailyWellness } from './dailyWellness.model';
import { Member } from '../member/member.model';
import { Branch } from '../gym/branch.model';
import { IWeightEntry, IProgressPhoto, IDailyWellness, ProgressSummary } from './progress.types';
import { AppError } from '../../common/utils/AppError';
import { getDayKeyForBranch } from '../../common/utils/timezone';
import { getPaginationParams, buildPaginationMeta, ParsedPagination } from '../../common/utils/pagination';
import { logger } from '../../config/logger';
import { cloudinaryUpload } from '../../config/cloudinary';
import { env } from '../../config/env';
import { NotificationService } from '../notification/notification.service';
import { NotificationType } from '../notification/notification.types';
import { Trainer } from '../trainer/trainer.model';
import { User } from '../user/user.model';
import { AIDataAggregatorService } from '../aiCoach/aiDataAggregator.service';

export class ProgressService {
  /**
   * Log Member Weight (Same-day Upsert: Last-write-wins)
   */
  public static async logWeight(
    memberId: string,
    weightKg: number,
    date: Date = new Date(),
    heightCm?: number,
    targetWeightKg?: number
  ): Promise<IWeightEntry> {
    const member = await Member.findOne({
      $or: [
        { _id: mongoose.Types.ObjectId.isValid(memberId) ? memberId : undefined },
        { userId: mongoose.Types.ObjectId.isValid(memberId) ? memberId : undefined },
      ],
      isDeleted: false,
    });

    if (!member) {
      throw AppError.notFound('Member profile not found');
    }

    const branch = member.branchId ? await Branch.findOne({ _id: member.branchId, isDeleted: false }) : null;
    const timezone = (branch?.timezone && branch.timezone !== 'UTC') ? branch.timezone : 'Asia/Kolkata';
    const dayKey = getDayKeyForBranch(date, timezone);

    const weightEntry = await WeightEntry.findOneAndUpdate(
      { memberId: member._id, dayKey },
      {
        gymId: member.gymId,
        weightKg,
        recordedAt: date,
      },
      { upsert: true, new: true, runValidators: true }
    );

    // Update current weight, height, and target weight in Member healthInfo
    if (!member.healthInfo) {
      member.healthInfo = {};
    }
    member.healthInfo.currentWeight_kg = weightKg;
    if (heightCm != null && heightCm > 0) {
      member.healthInfo.height_cm = heightCm;
    }
    if (targetWeightKg != null && targetWeightKg > 0) {
      member.healthInfo.targetWeight_kg = targetWeightKg;
    }
    await member.save();

    logger.info(`⚖️ Body metrics & Weight logged: [Member: ${member._id}] [Weight: ${weightKg}kg] [DayKey: ${dayKey}]`);
    return weightEntry;
  }

  /**
   * Get Weight History
   */
  public static async getWeightHistory(
    memberId: string,
    options: { page?: number | string; limit?: number | string } = {}
  ): Promise<{ history: IWeightEntry[]; meta: ReturnType<typeof buildPaginationMeta> }> {
    const { page, limit, skip }: ParsedPagination = getPaginationParams(options);

    const member = await Member.findOne({
      $or: [
        { _id: mongoose.Types.ObjectId.isValid(memberId) ? memberId : undefined },
        { userId: mongoose.Types.ObjectId.isValid(memberId) ? memberId : undefined },
      ],
    });

    if (!member) {
      throw AppError.notFound('Member not found');
    }

    const filter = { memberId: member._id };

    const [history, totalItems] = await Promise.all([
      WeightEntry.find(filter).skip(skip).limit(limit).sort({ recordedAt: -1 }),
      WeightEntry.countDocuments(filter),
    ]);

    const meta = buildPaginationMeta(totalItems, page, limit);

    return { history, meta };
  }

  /**
   * Upload Progress Photo record (with Cloudinary compression & storage)
   */
  public static async uploadProgressPhoto(
    memberId: string,
    imageSource: string,
    angle: 'front' | 'side' | 'back' = 'front',
    notes?: string
  ): Promise<IProgressPhoto> {
    const member = await Member.findOne({
      $or: [
        { _id: mongoose.Types.ObjectId.isValid(memberId) ? memberId : undefined },
        { userId: mongoose.Types.ObjectId.isValid(memberId) ? memberId : undefined },
      ],
      isDeleted: false,
    });

    if (!member) {
      throw AppError.notFound('Member profile not found');
    }

    const branch = member.branchId ? await Branch.findOne({ _id: member.branchId, isDeleted: false }) : null;
    const timezone = (branch?.timezone && branch.timezone !== 'UTC') ? branch.timezone : 'Asia/Kolkata';
    const dayKey = getDayKeyForBranch(new Date(), timezone);

    let finalImageUrl = imageSource;
    let cloudinaryPublicId: string | undefined = undefined;

    const isCloudinaryConfigured =
      env.NODE_ENV !== 'test' &&
      Boolean(env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET && env.CLOUDINARY_API_KEY !== 'dev_key');

    if (isCloudinaryConfigured) {
      try {
        const uploadResult = await cloudinaryUpload.uploader.upload(imageSource, {
          folder: `gym_saas/gyms/${member.gymId}/members/${member._id}/progress`,
          resource_type: 'image',
          transformation: [
            { width: 1200, height: 1200, crop: 'limit' },
            { quality: 'auto', fetch_format: 'auto' },
          ],
        });

        finalImageUrl = uploadResult.secure_url;
        cloudinaryPublicId = uploadResult.public_id;
        logger.info(`☁️ Cloudinary upload successful: [PublicID: ${cloudinaryPublicId}] [URL: ${finalImageUrl}]`);
      } catch (uploadErr: any) {
        logger.error(`❌ Cloudinary progress photo upload error: ${uploadErr.message}`);
        throw AppError.badRequest(`Failed to upload photo to Cloudinary: ${uploadErr.message}`);
      }
    } else {
      logger.warn('☁️ Cloudinary omitted or in test mode; using direct image reference');
      finalImageUrl = imageSource;
      cloudinaryPublicId = `mock_progress_${Date.now()}`;
    }

    const photo = new ProgressPhoto({
      memberId: member._id,
      gymId: member.gymId,
      imageUrl: finalImageUrl,
      cloudinaryPublicId,
      angle,
      notes,
      recordedAt: new Date(),
      dayKey,
    });

    await photo.save();
    logger.info(`📸 Progress Photo saved: [Member: ${member._id}] [Angle: ${angle}] [DayKey: ${dayKey}]`);
    return photo;
  }

  /**
   * Delete Progress Photo by ID (and purge asset from Cloudinary)
   */
  public static async deleteProgressPhoto(
    memberId: string,
    photoId: string
  ): Promise<void> {
    const member = await Member.findOne({
      $or: [
        { _id: mongoose.Types.ObjectId.isValid(memberId) ? memberId : undefined },
        { userId: mongoose.Types.ObjectId.isValid(memberId) ? memberId : undefined },
      ],
    });

    if (!member) {
      throw AppError.notFound('Member not found');
    }

    const photo = await ProgressPhoto.findOne({
      _id: photoId,
      memberId: member._id,
    });

    if (!photo) {
      throw AppError.notFound('Progress photo not found or does not belong to member');
    }

    if (photo.cloudinaryPublicId && !photo.cloudinaryPublicId.startsWith('mock_')) {
      const isCloudinaryConfigured =
        env.NODE_ENV !== 'test' &&
        Boolean(env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET && env.CLOUDINARY_API_KEY !== 'dev_key');

      if (isCloudinaryConfigured) {
        try {
          await cloudinaryUpload.uploader.destroy(photo.cloudinaryPublicId, { resource_type: 'image' });
          logger.info(`🗑️ Cloudinary photo destroyed: [PublicID: ${photo.cloudinaryPublicId}]`);
        } catch (err: any) {
          logger.warn(`Failed to destroy Cloudinary photo (${photo.cloudinaryPublicId}): ${err?.message}`);
        }
      }
    }

    await ProgressPhoto.findByIdAndDelete(photoId);
    logger.info(`🗑️ Progress photo deleted: [ID: ${photoId}] [Member: ${member._id}]`);
  }

  /**
   * Get Progress Photos
   */
  public static async getProgressPhotos(
    memberId: string,
    angle?: 'front' | 'side' | 'back',
    options: { page?: number | string; limit?: number | string } = {}
  ): Promise<{ photos: IProgressPhoto[]; meta: ReturnType<typeof buildPaginationMeta> }> {
    const { page, limit, skip }: ParsedPagination = getPaginationParams(options);

    const member = await Member.findOne({
      $or: [
        { _id: mongoose.Types.ObjectId.isValid(memberId) ? memberId : undefined },
        { userId: mongoose.Types.ObjectId.isValid(memberId) ? memberId : undefined },
      ],
    });

    if (!member) {
      throw AppError.notFound('Member not found');
    }

    const filter: Record<string, unknown> = { memberId: member._id };
    if (angle) filter.angle = angle;

    const [photos, totalItems] = await Promise.all([
      ProgressPhoto.find(filter).skip(skip).limit(limit).sort({ recordedAt: -1 }),
      ProgressPhoto.countDocuments(filter),
    ]);

    const meta = buildPaginationMeta(totalItems, page, limit);

    return { photos, meta };
  }

  /**
   * Log Daily Wellness (Partial Upsert with $set)
   */
  public static async logWellness(
    memberId: string,
    input: { waterIntakeMl?: number; sleepHours?: number; mood?: 'great' | 'good' | 'okay' | 'tired' | 'stressed'; dayKey?: string }
  ): Promise<IDailyWellness> {
    const member = await Member.findOne({
      $or: [
        { _id: mongoose.Types.ObjectId.isValid(memberId) ? memberId : undefined },
        { userId: mongoose.Types.ObjectId.isValid(memberId) ? memberId : undefined },
      ],
      isDeleted: false,
    });

    if (!member) {
      throw AppError.notFound('Member profile not found');
    }

    const branch = member.branchId ? await Branch.findOne({ _id: member.branchId, isDeleted: false }) : null;
    const timezone = (branch?.timezone && branch.timezone !== 'UTC') ? branch.timezone : 'Asia/Kolkata';
    const dayKey = input.dayKey || getDayKeyForBranch(new Date(), timezone);

    const updateFields: Record<string, unknown> = {
      gymId: member.gymId,
    };
    if (input.waterIntakeMl !== undefined) updateFields.waterIntakeMl = input.waterIntakeMl;
    if (input.sleepHours !== undefined) updateFields.sleepHours = input.sleepHours;
    if (input.mood !== undefined) updateFields.mood = input.mood;

    const wellness = await DailyWellness.findOneAndUpdate(
      { memberId: member._id, dayKey },
      { $set: updateFields },
      { upsert: true, new: true, runValidators: true }
    );

    logger.info(`💧 Wellness logged: [Member: ${member._id}] [DayKey: ${dayKey}]`);

    // Automatic AI Recovery Check: Trigger notifications if recovery score drops below 50
    try {
      const recoveryData = AIDataAggregatorService.calculateRecoveryScore(
        wellness.sleepHours,
        wellness.waterIntakeMl
      );

      if (recoveryData.recoveryScore < 50) {
        // 1. Notify the Member
        NotificationService.sendToUser(
          member.userId.toString(),
          member.gymId ? member.gymId.toString() : null,
          NotificationType.RECOVERY_ALERT,
          `Low Recovery Alert (Score: ${recoveryData.recoveryScore}%)`,
          `High fatigue detected due to low sleep (${wellness.sleepHours ?? '--'}h). Prioritize rest, stretching, and hydration today.`,
          { route: '/progress', recoveryScore: String(recoveryData.recoveryScore) }
        ).catch((err: Error) => logger.warn(`Failed to dispatch member recovery notification: ${err.message}`));

        // 2. Notify the Assigned Trainer (if one is assigned)
        if (member.assignedTrainerId) {
          Trainer.findById(member.assignedTrainerId).then(async (trainer) => {
            if (trainer && trainer.userId) {
              const memberUser = await User.findById(member.userId).select('fullName');
              const memberName = memberUser?.fullName || 'Assigned Client';
              NotificationService.sendToUser(
                trainer.userId.toString(),
                member.gymId ? member.gymId.toString() : null,
                NotificationType.RECOVERY_ALERT,
                `Client Recovery Alert: ${memberName}`,
                `${memberName}'s recovery dropped to ${recoveryData.recoveryScore}% (Rest Needed). Recommended action: adjust today's workout plan or schedule a deload session.`,
                { route: '/trainer/recovery-alerts', memberId: member._id.toString() }
              ).catch((err: Error) => logger.warn(`Failed to dispatch trainer recovery notification: ${err.message}`));
            }
          }).catch((err: Error) => logger.warn(`Failed to lookup assigned trainer: ${err.message}`));
        }
      }
    } catch (err: unknown) {
      logger.warn(`Failed to evaluate recovery score for wellness entry: ${err instanceof Error ? err.message : String(err)}`);
    }

    return wellness;
  }

  /**
   * Get Wellness History
   */
  public static async getWellnessHistory(
    memberId: string,
    options: { page?: number | string; limit?: number | string } = {}
  ): Promise<{ history: IDailyWellness[]; meta: ReturnType<typeof buildPaginationMeta> }> {
    const { page, limit, skip }: ParsedPagination = getPaginationParams(options);

    const member = await Member.findOne({
      $or: [
        { _id: mongoose.Types.ObjectId.isValid(memberId) ? memberId : undefined },
        { userId: mongoose.Types.ObjectId.isValid(memberId) ? memberId : undefined },
      ],
    });

    if (!member) {
      throw AppError.notFound('Member not found');
    }

    const filter = { memberId: member._id };

    const [history, totalItems] = await Promise.all([
      DailyWellness.find(filter).skip(skip).limit(limit).sort({ dayKey: -1, createdAt: -1 }),
      DailyWellness.countDocuments(filter),
    ]);

    const meta = buildPaginationMeta(totalItems, page, limit);

    return { history, meta };
  }

  /**
   * Log Diet Meal (Member food tracking entry)
   */
  public static async logDietMeal(
    memberId: string,
    input: { mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack'; description: string; calories?: number; dayKey?: string }
  ): Promise<IDailyWellness> {
    const member = await Member.findOne({
      $or: [
        { _id: mongoose.Types.ObjectId.isValid(memberId) ? memberId : undefined },
        { userId: mongoose.Types.ObjectId.isValid(memberId) ? memberId : undefined },
      ],
      isDeleted: false,
    });

    if (!member) {
      throw AppError.notFound('Member profile not found');
    }

    const branch = member.branchId ? await Branch.findOne({ _id: member.branchId, isDeleted: false }) : null;
    const timezone = (branch?.timezone && branch.timezone !== 'UTC') ? branch.timezone : 'Asia/Kolkata';
    const targetDayKey = input.dayKey || getDayKeyForBranch(new Date(), timezone);

    const mealItem = {
      mealType: input.mealType,
      description: input.description,
      calories: input.calories,
      loggedAt: new Date(),
    };

    const wellness = await DailyWellness.findOneAndUpdate(
      { memberId: member._id, dayKey: targetDayKey },
      {
        $setOnInsert: { gymId: member.gymId, memberId: member._id, dayKey: targetDayKey },
        $push: { meals: mealItem },
      },
      { upsert: true, new: true, runValidators: true }
    );

    logger.info(`🥗 Diet Meal logged: [Member: ${member._id}] [Meal: ${input.mealType}] [DayKey: ${targetDayKey}]`);
    return wellness;
  }

  /**
   * Get Logged Diet Meals (Member food tracking history)
   */
  public static async getDietLogs(
    memberId: string,
    options: { dayKey?: string; limit?: number | string } = {}
  ): Promise<IDailyWellness[]> {
    const member = await Member.findOne({
      $or: [
        { _id: mongoose.Types.ObjectId.isValid(memberId) ? memberId : undefined },
        { userId: mongoose.Types.ObjectId.isValid(memberId) ? memberId : undefined },
      ],
    });

    if (!member) {
      throw AppError.notFound('Member profile not found');
    }

    const filter: Record<string, unknown> = { memberId: member._id, 'meals.0': { $exists: true } };
    if (options.dayKey) filter.dayKey = options.dayKey;

    const limitNum = typeof options.limit === 'string' ? parseInt(options.limit, 10) : options.limit || 7;

    return DailyWellness.find(filter).sort({ dayKey: -1 }).limit(limitNum);
  }

  /**
   * Combined Progress Summary Snapshot (Feeds AI Coach Module 09)
   */
  public static async getProgressSummary(memberId: string): Promise<ProgressSummary> {
    const member = await Member.findOne({
      $or: [
        { _id: mongoose.Types.ObjectId.isValid(memberId) ? memberId : undefined },
        { userId: mongoose.Types.ObjectId.isValid(memberId) ? memberId : undefined },
      ],
    });

    if (!member) {
      throw AppError.notFound('Member not found');
    }

    const currentWeight = member.healthInfo?.currentWeight_kg;
    const targetWeight = member.healthInfo?.targetWeight_kg;

    // Calculate 30-day weight delta
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const oldestWeightInWindow = await WeightEntry.findOne({
      memberId: member._id,
      recordedAt: { $gte: thirtyDaysAgo },
    }).sort({ recordedAt: 1 });

    const weightDelta30Days_kg =
      currentWeight && oldestWeightInWindow ? Math.round((currentWeight - oldestWeightInWindow.weightKg) * 10) / 10 : 0;

    // Fetch latest photos per angle
    const [frontPhoto, sidePhoto, backPhoto] = await Promise.all([
      ProgressPhoto.findOne({ memberId: member._id, angle: 'front' }).sort({ recordedAt: -1 }),
      ProgressPhoto.findOne({ memberId: member._id, angle: 'side' }).sort({ recordedAt: -1 }),
      ProgressPhoto.findOne({ memberId: member._id, angle: 'back' }).sort({ recordedAt: -1 }),
    ]);

    // Fetch 7-day average water and sleep
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const recentWellness = await DailyWellness.find({
      memberId: member._id,
      createdAt: { $gte: sevenDaysAgo },
    });

    let totalWater = 0;
    let totalSleep = 0;
    let waterDays = 0;
    let sleepDays = 0;

    recentWellness.forEach((w) => {
      if (w.waterIntakeMl !== undefined) {
        totalWater += w.waterIntakeMl;
        waterDays++;
      }
      if (w.sleepHours !== undefined) {
        totalSleep += w.sleepHours;
        sleepDays++;
      }
    });

    return {
      currentWeight_kg: currentWeight,
      targetWeight_kg: targetWeight,
      weightDelta30Days_kg,
      latestPhotos: {
        front: frontPhoto?.imageUrl,
        side: sidePhoto?.imageUrl,
        back: backPhoto?.imageUrl,
      },
      averageWater7Days_ml: waterDays > 0 ? Math.round(totalWater / waterDays) : undefined,
      averageSleep7Days_hours: sleepDays > 0 ? Math.round((totalSleep / sleepDays) * 10) / 10 : undefined,
    };
  }
}
