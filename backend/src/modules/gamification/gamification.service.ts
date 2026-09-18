import mongoose from 'mongoose';
import { Member } from '../member/member.model';
import { MemberGameStats } from './memberGameStats.model';
import { XpLedger } from './xpLedger.model';
import { Challenge } from './challenge.model';
import { Attendance } from '../attendance/attendance.model';
import { WorkoutLog } from '../workout/workoutLog.model';
import { BadgeCode, BADGE_DEFINITIONS, calculateLevel, IMemberGameStats } from './gamification.types';
import { NotificationService } from '../notification/notification.service';
import { NotificationType } from '../notification/notification.types';
import { notificationTemplates } from '../notification/notificationTemplates';
import { AppError } from '../../common/utils/AppError';
import { logger } from '../../config/logger';

export class GamificationService {
  /**
   * Get or create the persistent MemberGameStats document for a member.
   */
  public static async getOrCreateMemberGameStats(memberId: string): Promise<IMemberGameStats & mongoose.Document> {
    let stats = await MemberGameStats.findOne({ memberId });
    if (!stats) {
      const member = await Member.findById(memberId);
      if (!member) throw AppError.notFound('Member not found');
      const initialXp = member.totalXpPoints || 0;
      const initialLevel = member.gamificationLevel || calculateLevel(initialXp);
      const initialStreak = member.currentStreakDays || 0;
      const initialLongest = member.longestStreakDays || initialStreak;
      stats = await MemberGameStats.create({
        memberId: member._id,
        gymId: member.gymId,
        xp: initialXp,
        level: initialLevel,
        currentStreak: initialStreak,
        longestStreak: initialLongest,
        badges: [],
        restDays: [],
        streakGracePending: false,
      });
    }
    return stats;
  }

  /**
   * Static method for XP level calculation — returns { level, xpInCurrentLevel, xpNeededForNextLevel }
   */
  public static calculateLevel(xp: number): { level: number; xpInCurrentLevel: number; xpNeededForNextLevel: number } {
    const level = calculateLevel(xp);
    const xpForCurrentLevel = (level - 1) ** 2 * 100;
    const xpForNextLevel = level ** 2 * 100;
    return {
      level,
      xpInCurrentLevel: xp - xpForCurrentLevel,
      xpNeededForNextLevel: xpForNextLevel - xp,
    };
  }

  /**
   * Award XP to a member — supports (memberId, xp, reason) or (memberId, gymId, xp, reason)
   */
  public static async awardXp(
    memberId: string,
    gymIdOrXp: string | number,
    xpOrReason: number | string,
    reasonArg?: string
  ): Promise<{ xpAwarded: number; newLevel: number; leveledUp: boolean }> {
    let gymId: string | undefined;
    let xp: number;
    let reason: string;

    if (typeof gymIdOrXp === 'number') {
      // Called as awardXp(memberId, xp, reason)
      xp = gymIdOrXp;
      reason = xpOrReason as string;
    } else {
      // Called as awardXp(memberId, gymId, xp, reason)
      gymId = gymIdOrXp;
      xp = xpOrReason as number;
      reason = reasonArg || 'SYSTEM';
    }

    const member = await Member.findOne({
      $or: [
        { _id: mongoose.Types.ObjectId.isValid(memberId) ? memberId : null },
        { userId: mongoose.Types.ObjectId.isValid(memberId) ? memberId : null },
      ],
      isDeleted: false,
    });
    if (!member) throw AppError.notFound('Member not found');

    const effectiveGymId = gymId || member.gymId.toString();

    const stats = await this.getOrCreateMemberGameStats(member._id.toString());
    const previousLevel = stats.level;
    stats.xp += xp;
    stats.level = calculateLevel(stats.xp);
    const leveledUp = stats.level > previousLevel;
    await stats.save();

    // Write to XpLedger
    await XpLedger.create({
      memberId: member._id,
      gymId: new mongoose.Types.ObjectId(effectiveGymId),
      amount: xp,
      reason,
    });

    // Synchronize Member doc with Single Source of Truth
    await Member.findByIdAndUpdate(member._id, {
      totalXpPoints: stats.xp,
      gamificationLevel: stats.level,
    });

    logger.info(`✨ XP Awarded: [Member: ${member._id}] [+${xp} XP] [Reason: ${reason}]`);
    return { xpAwarded: xp, newLevel: stats.level, leveledUp };
  }

  /**
   * Award badge — idempotent; returns true if newly awarded
   */
  public static async awardBadge(
    memberId: string,
    gymIdOrCode: string,
    badgeCodeArg?: BadgeCode
  ): Promise<boolean> {
    let gymId: string | undefined;
    let badgeCode: BadgeCode;

    // Support 2-arg (memberId, badgeCode) or 3-arg (memberId, gymId, badgeCode)
    if (badgeCodeArg !== undefined) {
      gymId = gymIdOrCode;
      badgeCode = badgeCodeArg;
    } else {
      badgeCode = gymIdOrCode as BadgeCode;
    }

    const member = await Member.findOne({
      $or: [
        { _id: mongoose.Types.ObjectId.isValid(memberId) ? memberId : null },
        { userId: mongoose.Types.ObjectId.isValid(memberId) ? memberId : null },
      ],
    });
    if (!member) return false;

    const stats = await this.getOrCreateMemberGameStats(member._id.toString());
    const alreadyHas = stats.badges.some((b: any) => b.code === badgeCode);
    if (alreadyHas) return false;

    const def = BADGE_DEFINITIONS[badgeCode];
    stats.badges.push({ code: badgeCode, earnedAt: new Date() });
    await stats.save();

    if (def?.xpReward > 0) {
      await this.awardXp(member._id.toString(), gymId || member.gymId.toString(), def.xpReward, `BADGE_EARNED: ${def.name}`);
    }

    const template = notificationTemplates[NotificationType.BADGE_EARNED](def?.name || badgeCode);
    await NotificationService.sendToUser(
      member.userId.toString(),
      gymId || member.gymId.toString(),
      NotificationType.BADGE_EARNED,
      template.title,
      template.body
    );

    logger.info(`🏆 Badge Earned: [Member: ${member._id}] [Badge: ${badgeCode}]`);
    return true;
  }

  /**
   * Sync & recalculate streak directly from member's actual Attendance records.
   * Ensures history is preserved accurately even if time-of-day edge cases occurred.
   */
  public static async syncStreakFromAttendance(memberId: string, referenceDateArg?: Date | string): Promise<number> {
    const member = await Member.findOne({
      $or: [
        { _id: mongoose.Types.ObjectId.isValid(memberId) ? memberId : null },
        { userId: mongoose.Types.ObjectId.isValid(memberId) ? memberId : null },
      ],
    });
    if (!member) return 0;

    const stats = await this.getOrCreateMemberGameStats(member._id.toString());

    // Fetch distinct checked-in dayKeys for this member
    const dayKeysRaw: string[] = await Attendance.distinct('dayKey', {
      memberId: member._id,
      status: { $ne: 'CANCELLED' },
    });

    if (!dayKeysRaw || dayKeysRaw.length === 0) {
      let activeStreak = 0;
      if (stats.lastActivityDayKey) {
        const refDate = referenceDateArg
          ? (typeof referenceDateArg === 'string' ? new Date(referenceDateArg) : referenceDateArg)
          : new Date();
        const refDateStr = refDate.toISOString().split('T')[0];
        const refUtc = new Date(`${refDateStr}T00:00:00.000Z`).getTime();
        const latestUtc = new Date(`${stats.lastActivityDayKey}T00:00:00.000Z`).getTime();
        const daysSince = Math.round((refUtc - latestUtc) / (1000 * 60 * 60 * 24));
        if (daysSince <= 1) {
          activeStreak = stats.currentStreak;
        }
      }

      if (stats.currentStreak !== activeStreak || member.currentStreakDays !== activeStreak) {
        stats.currentStreak = activeStreak;
        if (activeStreak === 0) stats.lastActivityDayKey = undefined;
        await stats.save();
        await Member.findByIdAndUpdate(member._id, { currentStreakDays: activeStreak });
      }
      return activeStreak;
    }

    const sortedDays = dayKeysRaw.filter(Boolean).sort();
    const latestDayKey = sortedDays[sortedDays.length - 1];

    let calculatedStreak = 1;
    for (let i = sortedDays.length - 1; i > 0; i--) {
      const currentUtc = new Date(`${sortedDays[i]}T00:00:00.000Z`).getTime();
      const prevUtc = new Date(`${sortedDays[i - 1]}T00:00:00.000Z`).getTime();
      const diffDays = Math.round((currentUtc - prevUtc) / (1000 * 60 * 60 * 24));

      if (diffDays === 1) {
        calculatedStreak++;
      } else if (diffDays === 2) {
        const skippedDate = new Date(prevUtc + 24 * 60 * 60 * 1000);
        const skippedWeekday = skippedDate.getUTCDay();
        if ((stats.restDays || []).includes(skippedWeekday)) {
          calculatedStreak++;
        } else {
          break;
        }
      } else {
        break;
      }
    }

    const refDate = referenceDateArg
      ? (typeof referenceDateArg === 'string' ? new Date(referenceDateArg) : referenceDateArg)
      : new Date();
    const refDateStr = refDate.toISOString().split('T')[0];
    const refUtc = new Date(`${refDateStr}T00:00:00.000Z`).getTime();
    const latestUtc = new Date(`${latestDayKey}T00:00:00.000Z`).getTime();
    const daysSinceLatest = Math.round((refUtc - latestUtc) / (1000 * 60 * 60 * 24));

    if (daysSinceLatest > 1) {
      let gapPreserved = false;
      if (daysSinceLatest === 2) {
        const skippedDate = new Date(latestUtc + 24 * 60 * 60 * 1000);
        const skippedWeekday = skippedDate.getUTCDay();
        if ((stats.restDays || []).includes(skippedWeekday)) {
          gapPreserved = true;
        }
      }
      if (!gapPreserved) {
        calculatedStreak = 0;
      }
    }

    const updatedBest = Math.max(stats.longestStreak || 0, calculatedStreak);

    stats.currentStreak = calculatedStreak;
    stats.longestStreak = updatedBest;
    stats.lastActivityDayKey = latestDayKey;
    await stats.save();

    await Member.findByIdAndUpdate(member._id, {
      currentStreakDays: calculatedStreak,
      longestStreakDays: updatedBest,
    });

    return calculatedStreak;
  }

  /**
   * Record check-in for streak
   */
  public static async recordCheckInForStreak(
    memberId: string,
    gymIdOrDate?: string | Date,
    checkInDateArg?: Date | string
  ): Promise<{ currentStreak: number; bestStreak: number }> {
    const member = await Member.findOne({
      $or: [
        { _id: mongoose.Types.ObjectId.isValid(memberId) ? memberId : null },
        { userId: mongoose.Types.ObjectId.isValid(memberId) ? memberId : null },
      ],
    });
    if (!member) throw AppError.notFound('Member not found');

    let checkInDate = new Date();
    if (checkInDateArg) {
      checkInDate = typeof checkInDateArg === 'string' ? new Date(checkInDateArg) : checkInDateArg;
    } else if (gymIdOrDate) {
      if (gymIdOrDate instanceof Date) {
        checkInDate = gymIdOrDate;
      } else if (typeof gymIdOrDate === 'string' && /^\d{4}-\d{2}-\d{2}/.test(gymIdOrDate)) {
        checkInDate = new Date(gymIdOrDate);
      }
    }

    const todayStr = checkInDate.toISOString().split('T')[0];

    const stats = await this.getOrCreateMemberGameStats(member._id.toString());

    // Idempotency check
    if (stats.lastActivityDayKey === todayStr) {
      await this.syncStreakFromAttendance(member._id.toString(), checkInDate);
      const refreshedStats = await this.getOrCreateMemberGameStats(member._id.toString());
      return { currentStreak: refreshedStats.currentStreak, bestStreak: refreshedStats.longestStreak };
    }

    // Streak continuation logic based on calendar days:
    let newStreak = 1;
    if (stats.lastActivityDayKey) {
      const lastDateUtc = new Date(`${stats.lastActivityDayKey}T00:00:00.000Z`).getTime();
      const checkInUtc = new Date(`${todayStr}T00:00:00.000Z`).getTime();
      const diffDays = Math.round((checkInUtc - lastDateUtc) / (1000 * 60 * 60 * 24));

      if (diffDays === 1) {
        // Consecutive calendar day — always continues
        newStreak = stats.currentStreak + 1;
        stats.streakGracePending = false; // reset grace availability
      } else if (diffDays === 2) {
        // Skipped exactly one day — check if that skipped day was a rest day
        const skippedDate = new Date(lastDateUtc + 24 * 60 * 60 * 1000);
        const skippedWeekday = skippedDate.getUTCDay();
        const isRestDay = (stats.restDays || []).includes(skippedWeekday);

        if (isRestDay) {
          newStreak = stats.currentStreak + 1;
        } else if (!stats.streakGracePending) {
          newStreak = stats.currentStreak + 1;
          stats.streakGracePending = true;
        } else {
          newStreak = 1;
          stats.streakGracePending = false;
        }
      } else {
        newStreak = 1;
        stats.streakGracePending = false;
      }
    }

    const newBest = Math.max(newStreak, stats.longestStreak);
    stats.currentStreak = newStreak;
    stats.longestStreak = newBest;
    stats.lastActivityDayKey = todayStr;
    stats.xp += 50;
    stats.level = calculateLevel(stats.xp);
    await stats.save();

    await XpLedger.create({
      memberId: member._id,
      gymId: member.gymId,
      amount: 50,
      reason: 'CHECK_IN',
    });

    // Also sync from Attendance records to ensure full consistency
    await this.syncStreakFromAttendance(member._id.toString(), checkInDate);

    // Badge thresholds
    if (newStreak >= 7) {
      const alreadyHas = stats.badges.some((b: any) => b.code === BadgeCode.STREAK_7);
      if (!alreadyHas) {
        stats.badges.push({ code: BadgeCode.STREAK_7, earnedAt: new Date() });
        await stats.save();
        const template = notificationTemplates[NotificationType.STREAK_MILESTONE](newStreak);
        await NotificationService.sendToUser(
          member.userId.toString(),
          member.gymId.toString(),
          NotificationType.STREAK_MILESTONE,
          template.title,
          template.body
        );
      }
    }
    if (newStreak >= 30) {
      const alreadyHas30 = stats.badges.some((b: any) => b.code === BadgeCode.STREAK_30);
      if (!alreadyHas30) {
        stats.badges.push({ code: BadgeCode.STREAK_30, earnedAt: new Date() });
        await stats.save();
      }
    }
    if (newStreak >= 100) {
      const alreadyHas100 = stats.badges.some((b: any) => b.code === BadgeCode.STREAK_100);
      if (!alreadyHas100) {
        stats.badges.push({ code: BadgeCode.STREAK_100, earnedAt: new Date() });
        await stats.save();
      }
    }

    // Also update Member doc streak cache for leaderboard queries
    await Member.findByIdAndUpdate(member._id, {
      currentStreakDays: newStreak,
      longestStreakDays: newBest,
      lastCheckInDate: checkInDate,
      totalXpPoints: stats.xp,
      gamificationLevel: stats.level,
    });

    // Update active streak_days challenges
    try {
      await this.updateChallengeProgress(member._id.toString(), 'streak_days', newStreak);
    } catch (err) {
      logger.warn('Failed to update streak challenge progress:', err);
    }

    return { currentStreak: newStreak, bestStreak: newBest };
  }

  /**
   * Passive cron: reset streaks for members who missed a day.
   * Returns count of members whose streak was reset.
   */
  public static async evaluateStreakBreaks(): Promise<number> {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayKey = yesterday.toISOString().split('T')[0];

    // Members whose lastActivityDayKey is earlier than yesterday = broken streak
    const staleStats = await MemberGameStats.find({
      currentStreak: { $gt: 0 },
      lastActivityDayKey: { $lt: yesterdayKey },
    });

    let count = 0;
    for (const s of staleStats) {
      s.currentStreak = 0;
      await s.save();
      await Member.findByIdAndUpdate(s.memberId, { currentStreakDays: 0 });
      count++;
    }

    if (count > 0) logger.info(`🔄 Streak Evaluator: Reset ${count} broken streaks`);
    return count;
  }

  /**
   * Update challenge progress for a member when a metric event fires.
   * Awards XP and marks completedAt when targetValue is reached.
   */
  public static async updateChallengeProgress(
    memberId: string,
    metric: 'workout_count' | 'streak_days' | 'total_minutes',
    progressValue: number
  ): Promise<void> {
    const member = await Member.findOne({
      $or: [
        { _id: mongoose.Types.ObjectId.isValid(memberId) ? memberId : null },
        { userId: mongoose.Types.ObjectId.isValid(memberId) ? memberId : null },
      ],
    });
    if (!member) return;

    const now = new Date();
    const activeChallenges = await Challenge.find({
      gymId: member.gymId,
      metric,
      endDate: { $gt: now },
    });

    for (const challenge of activeChallenges) {
      const participantIdx = challenge.participants.findIndex(
        (p) => p.memberId.toString() === member._id.toString()
      );
      if (participantIdx < 0) continue;

      const p = challenge.participants[participantIdx];
      if (p.completedAt) continue;

      p.progress = progressValue;

      if (progressValue >= challenge.targetValue) {
        p.completedAt = now;
        await this.awardXp(member._id.toString(), member.gymId.toString(), challenge.rewardXp, `CHALLENGE_COMPLETE: ${challenge.title}`);
      }

      await challenge.save();
    }
  }

  /**
   * Record workout completion — awards XP and FIRST_WORKOUT badge
   */
  public static async recordWorkoutCompletion(memberId: string, logId: string): Promise<void> {
    const member = await Member.findOne({
      $or: [
        { _id: mongoose.Types.ObjectId.isValid(memberId) ? memberId : null },
        { userId: mongoose.Types.ObjectId.isValid(memberId) ? memberId : null },
      ],
    });
    if (!member) return;

    // 1. Always update Challenge progress (e.g. 20 workouts challenge)
    try {
      const workoutCount = await WorkoutLog.countDocuments({
        memberId: member._id,
      });
      await this.updateChallengeProgress(member._id.toString(), 'workout_count', workoutCount);
    } catch (err) {
      logger.warn('Failed to update workout challenge progress:', err);
    }

    // 2. Daily cap check: Workout completion XP can only be earned ONCE per calendar day
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    const existingAwardToday = await XpLedger.findOne({
      memberId: member._id,
      reason: { $regex: /^WORKOUT_COMPLETED/ },
      createdAt: { $gte: startOfDay, $lte: endOfDay },
    });
    if (existingAwardToday) {
      logger.info(`ℹ️ Daily workout XP already earned today by member [${member._id}], skipping duplicate.`);
      return;
    }

    await this.awardXp(member._id.toString(), member.gymId.toString(), 100, `WORKOUT_COMPLETED: ${logId}`);

    const stats = await this.getOrCreateMemberGameStats(member._id.toString());
    const hasFirst = stats.badges.some((b: any) => b.code === BadgeCode.FIRST_WORKOUT);
    if (!hasFirst) {
      stats.badges.push({ code: BadgeCode.FIRST_WORKOUT, earnedAt: new Date() });
      await stats.save();
    }
  }

  /**
   * Get member game profile (for controller)
   */
  public static async getMemberGameProfile(memberUserIdOrId: string): Promise<any> {
    const member = await Member.findOne({
      $or: [
        { _id: mongoose.Types.ObjectId.isValid(memberUserIdOrId) ? memberUserIdOrId : null },
        { userId: mongoose.Types.ObjectId.isValid(memberUserIdOrId) ? memberUserIdOrId : null },
      ],
      isDeleted: false,
    });
    if (!member) throw AppError.notFound('Member not found');

    await this.syncStreakFromAttendance(member._id.toString());
    const stats = await this.getOrCreateMemberGameStats(member._id.toString());

    return {
      memberId: member._id,
      totalXp: stats.xp,
      level: stats.level,
      currentStreakDays: stats.currentStreak,
      longestStreakDays: stats.longestStreak,
      badges: stats.badges.map((b: any) => ({
        badgeType: b.code,
        unlockedAt: b.earnedAt,
        definition: BADGE_DEFINITIONS[b.code as BadgeCode],
      })),
    };
  }

  /**
   * Get leaderboard for a gym
   */
  public static async getLeaderboard(
    gymId: string,
    branchId?: string,
    metric: 'xp' | 'streak' = 'xp',
    _timeframe: 'weekly' | 'monthly' | 'allTime' = 'allTime'
  ): Promise<any[]> {
    const memberFilter: Record<string, unknown> = {
      gymId: new mongoose.Types.ObjectId(gymId),
      isDeleted: false,
    };
    if (branchId) memberFilter.branchId = new mongoose.Types.ObjectId(branchId);

    const members = await Member.find(memberFilter).populate('userId', 'fullName avatarUrl').limit(50);
    
    // Sync streak from attendance for all members
    for (const m of members) {
      await this.syncStreakFromAttendance(m._id.toString());
    }

    const memberIds = members.map((m) => m._id);

    const statsMap = new Map<string, any>();
    const statsList = await MemberGameStats.find({ memberId: { $in: memberIds } });
    for (const s of statsList) {
      statsMap.set(s.memberId.toString(), s);
    }

    const ranked = members.map((m) => {
      const s = statsMap.get(m._id.toString());
      const xpVal = s?.xp ?? m.totalXpPoints ?? 0;
      const streakVal = s?.currentStreak ?? m.currentStreakDays ?? 0;
      const levelVal = s?.level ?? m.gamificationLevel ?? 1;
      return {
        memberId: m._id,
        name: (m.userId as any)?.fullName || 'Member',
        avatarUrl: (m.userId as any)?.avatarUrl,
        score: metric === 'streak' ? streakVal : xpVal,
        xp: xpVal,
        points: xpVal,
        level: levelVal,
        currentStreakDays: streakVal,
      };
    });

    return ranked.sort((a, b) => b.score - a.score);
  }

  /**
   * List active gym challenges (endDate >= now, sorted by endDate ascending)
   */
  public static async listActiveChallenges(gymId?: string, memberUserIdOrId?: string): Promise<any[]> {
    const now = new Date();
    const filter: any = {
      isDeleted: { $ne: true },
      endDate: { $gte: now },
    };
    if (gymId && mongoose.Types.ObjectId.isValid(gymId)) {
      filter.gymId = new mongoose.Types.ObjectId(gymId);
    }

    let challenges = await Challenge.find(filter).sort({ endDate: 1 });

    if (challenges.length === 0 && gymId && mongoose.Types.ObjectId.isValid(gymId)) {
      const thirtyDays = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      const fourteenDays = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
      try {
        await Challenge.create([
          {
            gymId: new mongoose.Types.ObjectId(gymId),
            title: '30-Day Consistency Warrior',
            description: 'Log 20 completed workout sessions this month to prove your elite discipline.',
            metric: 'workout_count',
            targetValue: 20,
            rewardXp: 1000,
            startDate: now,
            endDate: thirtyDays,
            participants: [],
          },
          {
            gymId: new mongoose.Types.ObjectId(gymId),
            title: 'Weekly Iron Sprint',
            description: 'Complete 5 high-intensity workout routines to boost your gym standing.',
            metric: 'workout_count',
            targetValue: 5,
            rewardXp: 500,
            startDate: now,
            endDate: fourteenDays,
            participants: [],
          },
        ]);
        challenges = await Challenge.find(filter).sort({ endDate: 1 });
      } catch (err) {
        logger.warn('Failed to auto-seed gym challenges:', err);
      }
    }

    let memberIdStr: string | null = null;
    if (memberUserIdOrId) {
      const member = await Member.findOne({
        $or: [
          { _id: mongoose.Types.ObjectId.isValid(memberUserIdOrId) ? memberUserIdOrId : null },
          { userId: mongoose.Types.ObjectId.isValid(memberUserIdOrId) ? memberUserIdOrId : null },
        ],
        isDeleted: false,
      });
      if (member) {
        memberIdStr = member._id.toString();
      }
    }

    return challenges.map((c) => {
      const obj = c.toObject();
      let hasJoined = false;
      let userProgress = 0;

      if (memberIdStr && Array.isArray(obj.participants)) {
        const p = obj.participants.find((part: any) => part.memberId?.toString() === memberIdStr);
        if (p) {
          hasJoined = true;
          userProgress = p.progress || 0;
        }
      }

      return {
        ...obj,
        hasJoined,
        userProgress,
      };
    });
  }

  public static async listChallenges(gymId?: string, memberUserIdOrId?: string): Promise<any[]> {
    return this.listActiveChallenges(gymId, memberUserIdOrId);
  }

  /**
   * Create a gym challenge (for controller)
   */
  public static async createChallenge(gymId: string, challengeData: any): Promise<any> {
    const challenge = new Challenge({
      gymId: new mongoose.Types.ObjectId(gymId),
      branchId: challengeData.branchId ? new mongoose.Types.ObjectId(challengeData.branchId) : undefined,
      title: challengeData.title,
      description: challengeData.description,
      metric: challengeData.metric || 'workout_count',
      targetValue: challengeData.targetValue || 5,
      rewardXp: challengeData.rewardXp || challengeData.xpReward || 300,
      startDate: challengeData.startDate || new Date(),
      endDate: challengeData.endDate || new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      participants: [],
    });

    await challenge.save();
    logger.info(`🎯 Challenge created: [ID: ${challenge._id}] [Gym: ${gymId}]`);
    return challenge;
  }

  /**
   * Join a challenge (for controller)
   */
  public static async joinChallenge(challengeId: string, memberUserIdOrId: string): Promise<any> {
    const member = await Member.findOne({
      $or: [
        { _id: mongoose.Types.ObjectId.isValid(memberUserIdOrId) ? memberUserIdOrId : null },
        { userId: mongoose.Types.ObjectId.isValid(memberUserIdOrId) ? memberUserIdOrId : null },
      ],
      isDeleted: false,
    });
    if (!member) throw AppError.notFound('Member profile not found');

    const challenge = await Challenge.findById(challengeId);
    if (!challenge) throw AppError.notFound('Challenge not found or inactive');

    const alreadyJoined = challenge.participants.some(
      (p) => p.memberId.toString() === member._id.toString()
    );
    if (!alreadyJoined) {
      challenge.participants.push({ memberId: member._id, progress: 0 });
      await challenge.save();
    }

    return challenge;
  }

  /**
   * Update a member's custom rest days.
   * @param memberUserId - the User._id of the authenticated member
   * @param restDays - array of weekday numbers 0 (Sun) – 6 (Sat)
   */
  public static async updateRestDays(
    memberUserId: string,
    restDays: number[]
  ): Promise<{ restDays: number[] }> {
    const member = await Member.findOne({
      $or: [
        { _id: mongoose.Types.ObjectId.isValid(memberUserId) ? memberUserId : null },
        { userId: mongoose.Types.ObjectId.isValid(memberUserId) ? memberUserId : null },
      ],
      isDeleted: false,
    });
    if (!member) throw new Error('Member profile not found');

    const stats = await this.getOrCreateMemberGameStats(member._id.toString());
    stats.restDays = restDays;
    await stats.save();

    logger.info(`🗓️ Rest days updated for member [${member._id}]: [${restDays.join(', ')}]`);
    return { restDays: stats.restDays };
  }
}
