import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import app from '../../src/app';
import { User } from '../../src/modules/user/user.model';
import { Gym } from '../../src/modules/gym/gym.model';
import { Branch } from '../../src/modules/gym/branch.model';
import { Member } from '../../src/modules/member/member.model';
import { WeightEntry } from '../../src/modules/progress/weightEntry.model';
import { DailyWellness } from '../../src/modules/progress/dailyWellness.model';
import { MemberGameStats } from '../../src/modules/gamification/memberGameStats.model';
import { Challenge } from '../../src/modules/gamification/challenge.model';
import { XpLedger } from '../../src/modules/gamification/xpLedger.model';
import { MemberService } from '../../src/modules/member/member.service';
import { GamificationService } from '../../src/modules/gamification/gamification.service';
import { Role } from '../../src/common/constants/roles.enum';
import { BadgeCode } from '../../src/modules/gamification/gamification.types';
import { generateAccessToken } from '../../src/common/utils/generateTokens';

let mongoServer: MongoMemoryServer;
let ownerToken: string;
let memberToken: string;
let memberDocId: string;
let gymId: string;
let branchId: string;

describe('Progress Tracking & Gamification Module Integration Tests', () => {
  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    await mongoose.connect(mongoUri);
  }, 30000);

  afterAll(async () => {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    if (mongoServer) {
      await mongoServer.stop();
    }
  }, 30000);

  beforeEach(async () => {
    await User.deleteMany({});
    await Gym.deleteMany({});
    await Branch.deleteMany({});
    await Member.deleteMany({});
    await WeightEntry.deleteMany({});
    await DailyWellness.deleteMany({});
    await MemberGameStats.deleteMany({});
    await Challenge.deleteMany({});
    await XpLedger.deleteMany({});

    // 1. Create Owner & Gym & Branch
    const owner = await User.create({
      fullName: 'Gym Owner',
      email: 'owner@gym.com',
      phone: '9876543210',
      password: 'Password123',
      role: Role.GYM_OWNER,
      isActive: true,
    });

    const gym = await Gym.create({
      name: 'Spartan Gym',
      ownerId: owner._id,
      billingEmail: 'owner@gym.com',
    });
    gymId = gym._id.toString();

    const branch = await Branch.create({
      gymId: gym._id,
      name: 'Main Branch',
      address: { line1: 'L1', city: 'City', state: 'State', pincode: '000', country: 'Country' },
      contactPhone: '9998887776',
    });
    branchId = branch._id.toString();

    ownerToken = generateAccessToken({
      id: owner._id.toString(),
      role: Role.GYM_OWNER,
      gymId,
      branchId,
    });

    // 2. Onboard Member
    const now = new Date();
    const nextMonth = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const member = await MemberService.createMember(gymId, branchId, {
      fullName: 'Member Bob',
      email: 'bob@member.com',
      phone: '9991112222',
      password: 'Password123',
      branchId,
      planName: 'Pro Plan',
      membershipStartDate: now,
      membershipEndDate: nextMonth,
      healthInfo: { targetWeight_kg: 75, currentWeight_kg: 85 },
    });

    memberDocId = member._id.toString();
    memberToken = generateAccessToken({
      id: member.userId.toString(),
      role: Role.MEMBER,
      gymId,
      branchId,
    });
  });

  describe('Progress Tracking (Weight & Wellness Upserts)', () => {
    it('should upsert weight entries for the same day (last-write-wins)', async () => {
      // 1st weight log (85 kg)
      await request(app)
        .post('/api/v1/progress/weight')
        .set('Authorization', `Bearer ${memberToken}`)
        .send({ weightKg: 85 });

      // 2nd weight log same day (84.5 kg)
      const res = await request(app)
        .post('/api/v1/progress/weight')
        .set('Authorization', `Bearer ${memberToken}`)
        .send({ weightKg: 84.5 });

      expect(res.status).toBe(201);

      // Verify only 1 record exists in DB for today
      const count = await WeightEntry.countDocuments({ memberId: memberDocId });
      expect(count).toBe(1);

      const latest = await WeightEntry.findOne({ memberId: memberDocId });
      expect(latest?.weightKg).toBe(84.5);
    });

    it('should perform partial wellness upsert merging water and sleep', async () => {
      // Morning water log
      await request(app)
        .patch('/api/v1/progress/wellness')
        .set('Authorization', `Bearer ${memberToken}`)
        .send({ waterIntakeMl: 2500 });

      // Evening sleep log
      const res = await request(app)
        .patch('/api/v1/progress/wellness')
        .set('Authorization', `Bearer ${memberToken}`)
        .send({ sleepHours: 8, mood: 'great' });

      expect(res.status).toBe(200);

      const wellness = await DailyWellness.findOne({ memberId: memberDocId });
      expect(wellness?.waterIntakeMl).toBe(2500);
      expect(wellness?.sleepHours).toBe(8);
      expect(wellness?.mood).toBe('great');
    });

    it('should calculate combined progress summary snapshot', async () => {
      await request(app)
        .post('/api/v1/progress/weight')
        .set('Authorization', `Bearer ${memberToken}`)
        .send({ weightKg: 84 });

      await request(app)
        .patch('/api/v1/progress/wellness')
        .set('Authorization', `Bearer ${memberToken}`)
        .send({ waterIntakeMl: 3000, sleepHours: 7.5 });

      const res = await request(app)
        .get('/api/v1/progress/summary')
        .set('Authorization', `Bearer ${memberToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.summary.currentWeight_kg).toBe(84);
      expect(res.body.data.summary.targetWeight_kg).toBe(75);
      expect(res.body.data.summary.averageWater7Days_ml).toBe(3000);
    });
  });

  describe('Gamification (XP, Levels, Badges & Streaks)', () => {
    it('should compute pure level curve correctly', () => {
      expect(GamificationService.calculateLevel(0).level).toBe(1);
      expect(GamificationService.calculateLevel(100).level).toBe(2);
      expect(GamificationService.calculateLevel(400).level).toBe(3);
      expect(GamificationService.calculateLevel(900).level).toBe(4);
    });

    it('should award check-in XP, update streak, and award STREAK_7 badge when threshold reached', async () => {
      const stats = await GamificationService.getOrCreateMemberGameStats(memberDocId);
      stats.currentStreak = 6;
      stats.lastActivityDayKey = '2026-07-30';
      await stats.save();

      // Trigger check-in hook for today
      await GamificationService.recordCheckInForStreak(memberDocId, '2026-07-31');

      const updated = await GamificationService.getOrCreateMemberGameStats(memberDocId);
      expect(updated.currentStreak).toBe(7);
      expect(updated.xp).toBe(50);
      expect(updated.badges.some((b) => b.code === BadgeCode.STREAK_7)).toBe(true);
    });

    it('should append XP events to XpLedger and fetch weekly leaderboard', async () => {
      await GamificationService.awardXp(memberDocId, 300, 'CHALLENGE_REWARD');

      const res = await request(app)
        .get(`/api/v1/gamification/leaderboard?gymId=${gymId}&timeframe=weekly`)
        .set('Authorization', `Bearer ${memberToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.leaderboard.length).toBeGreaterThanOrEqual(1);
      expect(res.body.data.leaderboard[0].score).toBe(300);
    });

    it('should reset broken streaks via passive evaluateStreakBreaks() cron', async () => {
      const stats = await GamificationService.getOrCreateMemberGameStats(memberDocId);
      stats.currentStreak = 10;
      stats.lastActivityDayKey = '2026-07-10'; // 21 days ago
      await stats.save();

      const count = await GamificationService.evaluateStreakBreaks();
      expect(count).toBe(1);

      const resetStats = await GamificationService.getOrCreateMemberGameStats(memberDocId);
      expect(resetStats.currentStreak).toBe(0);
    });
  });

  describe('Challenges Management', () => {
    it('should allow staff to create challenge and member to join & complete challenge', async () => {
      const now = new Date();
      const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

      // Staff creates challenge
      const createRes = await request(app)
        .post(`/api/v1/gyms/${gymId}/challenges`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          title: '3 Workout Sprint',
          description: 'Complete 3 workouts this week for 500 XP',
          metric: 'workout_count',
          targetValue: 3,
          startDate: now.toISOString(),
          endDate: nextWeek.toISOString(),
          rewardXp: 500,
        });

      expect(createRes.status).toBe(201);
      const challengeId = createRes.body.data.challenge._id;

      // Member joins challenge
      const joinRes = await request(app)
        .post(`/api/v1/gamification/challenges/${challengeId}/join`)
        .set('Authorization', `Bearer ${memberToken}`);

      expect(joinRes.status).toBe(200);

      // Increment progress to targetValue
      await GamificationService.updateChallengeProgress(memberDocId, 'workout_count', 3);

      const challenge = await Challenge.findById(challengeId);
      expect(challenge?.participants[0].completedAt).toBeDefined();
    });
  });
});
