import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import app from '../../src/app';
import { User } from '../../src/modules/user/user.model';
import { Gym } from '../../src/modules/gym/gym.model';
import { Branch } from '../../src/modules/gym/branch.model';
import { Member } from '../../src/modules/member/member.model';
import { Challenge } from '../../src/modules/gamification/challenge.model';
import { Notification } from '../../src/modules/notification/notification.model';
import { PlatformUpgradeRequest } from '../../src/modules/payment/platformUpgradeRequest.model';
import { Role } from '../../src/common/constants/roles.enum';
import { GymPlan } from '../../src/modules/gym/gym.types';
import { generateAccessToken } from '../../src/common/utils/generateTokens';

let mongoServer: MongoMemoryServer;
let ownerToken: string;
let memberToken: string;
let superAdminToken1: string;
let gymId: string;
let branchId: string;
let ownerUserId: string;
let memberUserId: string;
let memberDocId: string;
let superAdmin1Id: string;
let superAdmin2Id: string;

describe('Product Gaps Closure Integration Tests', () => {
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
    await Challenge.deleteMany({});
    await Notification.deleteMany({});
    await PlatformUpgradeRequest.deleteMany({});

    const tempOwnerId = new mongoose.Types.ObjectId();

    // Create Gym & Branch
    const gym = await Gym.create({
      name: 'Titan Fitness',
      slug: 'titan-fitness',
      ownerId: tempOwnerId,
      billingEmail: 'billing@titan.com',
      plan: GymPlan.BASIC,
    });
    gymId = gym._id.toString();

    const branch = await Branch.create({
      gymId: gym._id,
      name: 'Main Branch',
      contactPhone: '+91 9876543210',
      address: { line1: 'Main St', city: 'Mumbai', state: 'MH', pincode: '400001', country: 'India' },
    });
    branchId = branch._id.toString();

    // Create Owner
    const ownerUser = await User.create({
      _id: tempOwnerId,
      fullName: 'Owner Joe',
      email: 'owner@titan.com',
      password: 'password123',
      phone: '+91 9876543210',
      role: Role.GYM_OWNER,
      gymId: gym._id,
      branchId: branch._id,
    });
    ownerUserId = ownerUser._id.toString();
    ownerToken = generateAccessToken({ id: ownerUserId, userId: ownerUserId, role: Role.GYM_OWNER, gymId });

    // Create Super Admin 1 & 2
    const admin1 = await User.create({
      fullName: 'Super Admin One',
      email: 'admin1@platform.com',
      password: 'password123',
      phone: '+91 9000000001',
      role: Role.SUPER_ADMIN,
    });
    superAdmin1Id = admin1._id.toString();
    superAdminToken1 = generateAccessToken({ id: superAdmin1Id, userId: superAdmin1Id, role: Role.SUPER_ADMIN });

    const admin2 = await User.create({
      fullName: 'Super Admin Two',
      email: 'admin2@platform.com',
      password: 'password123',
      phone: '+91 9000000002',
      role: Role.SUPER_ADMIN,
    });
    superAdmin2Id = admin2._id.toString();

    // Create Member
    const memberUser = await User.create({
      fullName: 'Member Alice',
      email: 'alice@titan.com',
      password: 'password123',
      phone: '+91 9876543211',
      role: Role.MEMBER,
      gymId: gym._id,
      branchId: branch._id,
    });
    memberUserId = memberUser._id.toString();
    memberToken = generateAccessToken({ id: memberUserId, userId: memberUserId, role: Role.MEMBER, gymId });

    const member = await Member.create({
      userId: memberUser._id,
      gymId: gym._id,
      branchId: branch._id,
      qrCode: 'QR-ALICE-123',
      membershipStatus: 'ACTIVE',
      membershipStartDate: new Date(),
      membershipEndDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      planName: 'Monthly Fitness',
      referralCode: 'REF-ALICE1',
    });
    memberDocId = member._id.toString();
  });

  describe('Part 1: Platform Upgrade Request', () => {
    it('creates an upgrade request, persists record, and sends notification to EVERY super admin user', async () => {
      const res = await request(app)
        .post(`/api/v1/billing/platform/gyms/${gymId}/upgrade-request`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ requestedPlan: GymPlan.PRO, billingCycle: 'MONTHLY', notes: 'Need more branches' });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.upgradeRequest.requestedPlan).toBe(GymPlan.PRO);

      // Verify DB persistence
      const savedReq = await PlatformUpgradeRequest.findOne({ gymId });
      expect(savedReq).not.toBeNull();
      expect(savedReq?.currentPlan).toBe(GymPlan.BASIC);
      expect(savedReq?.requestedPlan).toBe(GymPlan.PRO);
      expect(savedReq?.status).toBe('PENDING');

      // Verify notifications sent to ALL super admin users (admin1 & admin2)
      const notif1 = await Notification.findOne({ userId: superAdmin1Id });
      const notif2 = await Notification.findOne({ userId: superAdmin2Id });

      expect(notif1).not.toBeNull();
      expect(notif2).not.toBeNull();
      expect(notif1?.type).toBe('PLATFORM_UPGRADE_REQUESTED');
      expect(notif2?.type).toBe('PLATFORM_UPGRADE_REQUESTED');
    });

    it('lists upgrade requests for Super Admin', async () => {
      await PlatformUpgradeRequest.create({
        gymId: new mongoose.Types.ObjectId(gymId),
        requestedByUserId: new mongoose.Types.ObjectId(ownerUserId),
        currentPlan: GymPlan.BASIC,
        requestedPlan: GymPlan.ENTERPRISE,
        status: 'PENDING',
      });

      const res = await request(app)
        .get('/api/v1/billing/platform/upgrade-requests')
        .set('Authorization', `Bearer ${superAdminToken1}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.upgradeRequests.length).toBeGreaterThan(0);
      expect(res.body.data.upgradeRequests[0].requestedPlan).toBe(GymPlan.ENTERPRISE);
    });
  });

  describe('Part 2: Gamification Active Challenges Listing', () => {
    it('lists challenges for a gym returning only non-expired ones sorted by endDate ascending', async () => {
      const now = Date.now();
      // Past expired challenge
      await Challenge.create({
        gymId: new mongoose.Types.ObjectId(gymId),
        title: 'Expired Pushups',
        description: 'Old challenge',
        metric: 'workout_count',
        targetValue: 10,
        startDate: new Date(now - 30 * 24 * 60 * 60 * 1000),
        endDate: new Date(now - 10 * 24 * 60 * 60 * 1000),
        rewardXp: 100,
      });

      // Active challenge ending in 5 days
      const challengeNear = await Challenge.create({
        gymId: new mongoose.Types.ObjectId(gymId),
        title: 'Near Future Challenge',
        description: 'Ends soon',
        metric: 'workout_count',
        targetValue: 5,
        startDate: new Date(now - 1 * 24 * 60 * 60 * 1000),
        endDate: new Date(now + 5 * 24 * 60 * 60 * 1000),
        rewardXp: 300,
      });

      // Active challenge ending in 15 days
      const challengeFar = await Challenge.create({
        gymId: new mongoose.Types.ObjectId(gymId),
        title: 'Far Future Challenge',
        description: 'Ends later',
        metric: 'streak_days',
        targetValue: 7,
        startDate: new Date(now - 1 * 24 * 60 * 60 * 1000),
        endDate: new Date(now + 15 * 24 * 60 * 60 * 1000),
        rewardXp: 500,
      });

      const res = await request(app)
        .get(`/api/v1/gyms/${gymId}/challenges`)
        .set('Authorization', `Bearer ${memberToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const list = res.body.data.challenges;
      expect(list.length).toBe(2);
      expect(list[0]._id.toString()).toBe(challengeNear._id.toString());
      expect(list[1]._id.toString()).toBe(challengeFar._id.toString());
    });
  });

  describe('Part 3: Referral Stats', () => {
    it('returns member referral code and referred members count', async () => {
      // Create a referred member
      const friendUser = await User.create({
        fullName: 'Friend Bob',
        email: 'bob@titan.com',
        password: 'password123',
        phone: '+91 9876543299',
        role: Role.MEMBER,
        gymId,
        branchId,
      });

      await Member.create({
        userId: friendUser._id,
        gymId,
        branchId,
        qrCode: 'QR-BOB-123',
        membershipStatus: 'ACTIVE',
        membershipStartDate: new Date(),
        membershipEndDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        planName: 'Monthly Pass',
        referredByMemberId: new mongoose.Types.ObjectId(memberDocId),
      });

      const res = await request(app)
        .get('/api/v1/members/me/referral-stats')
        .set('Authorization', `Bearer ${memberToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.referralCode).toBe('REF-ALICE1');
      expect(res.body.data.totalReferred).toBe(1);
      expect(res.body.data.referredMembers[0].fullName).toBe('Friend Bob');
    });
  });
});
