import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import app from '../../src/app';
import { User } from '../../src/modules/user/user.model';
import { Gym } from '../../src/modules/gym/gym.model';
import { Branch } from '../../src/modules/gym/branch.model';
import { Member } from '../../src/modules/member/member.model';
import { Trainer } from '../../src/modules/trainer/trainer.model';
import { MemberService } from '../../src/modules/member/member.service';
import { Role } from '../../src/common/constants/roles.enum';
import { MembershipStatus } from '../../src/modules/member/member.types';
import { generateAccessToken } from '../../src/common/utils/generateTokens';

let mongoServer: MongoMemoryServer;
let ownerToken: string;
let gymId: string;
let branchId: string;

describe('Member & Trainer Module Integration Tests', () => {
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
    await Trainer.deleteMany({});

    // 1. Create Owner User
    const owner = await User.create({
      fullName: 'Gym Owner',
      email: 'owner@gym.com',
      phone: '9876543210',
      password: 'Password123',
      role: Role.GYM_OWNER,
      isActive: true,
    });

    // 2. Create Gym & Branch
    const gym = await Gym.create({
      name: 'Titan Fitness',
      ownerId: owner._id,
      billingEmail: 'owner@gym.com',
    });
    gymId = gym._id.toString();

    owner.gymId = gym._id;
    await owner.save();

    const branch = await Branch.create({
      gymId: gym._id,
      name: 'Central Branch',
      address: { line1: 'L1', city: 'City', state: 'State', pincode: '000', country: 'Country' },
      contactPhone: '9998887776',
      timezone: 'UTC',
    });
    branchId = branch._id.toString();

    ownerToken = generateAccessToken({
      id: owner._id.toString(),
      role: Role.GYM_OWNER,
      gymId,
      branchId,
    });
  });

  describe('Trainer Onboarding & Capacity Limits', () => {
    it('should create a Trainer profile and linked User identity', async () => {
      const res = await request(app)
        .post(`/api/v1/gyms/${gymId}/branches/${branchId}/trainers`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          fullName: 'Coach Alex',
          email: 'alex@gym.com',
          phone: '1112223333',
          password: 'Password123',
          branchId,
          specializations: ['Strength', 'Hiit'],
          maxMemberCapacity: 2,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.trainer.specializations).toContain('Strength');

      const user = await User.findOne({ email: 'alex@gym.com' });
      expect(user).toBeDefined();
      expect(user?.role).toBe(Role.TRAINER);
    });
  });

  describe('Member Onboarding & Trainer Auto-Assignment', () => {
    let trainerId: string;

    beforeEach(async () => {
      // Setup a trainer with capacity of 1 member
      const trainerUser = await User.create({
        fullName: 'Coach Bob',
        email: 'bob@gym.com',
        phone: '4445556666',
        password: 'Password123',
        role: Role.TRAINER,
        gymId: new mongoose.Types.ObjectId(gymId),
        branchId: new mongoose.Types.ObjectId(branchId),
        isActive: true,
      });

      const trainerDoc = await Trainer.create({
        userId: trainerUser._id,
        gymId: new mongoose.Types.ObjectId(gymId),
        branchId: new mongoose.Types.ObjectId(branchId),
        specializations: ['Crossfit'],
        maxMemberCapacity: 1, // Cap at 1 member
      });

      trainerId = trainerDoc._id.toString();
    });

    it('should auto-assign the least loaded trainer and issue a signed QR code', async () => {
      const now = new Date();
      const nextMonth = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

      const res = await request(app)
        .post(`/api/v1/gyms/${gymId}/branches/${branchId}/members`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          fullName: 'Member One',
          email: 'member1@gym.com',
          phone: '7778889999',
          password: 'Password123',
          branchId,
          planName: 'Gold Plan',
          membershipStartDate: now.toISOString(),
          membershipEndDate: nextMonth.toISOString(),
          fitnessGoals: ['Weight Loss'],
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.member.assignedTrainerId).toBe(trainerId);
      expect(res.body.data.member.qrCode).toBeDefined();
      expect(res.body.data.member.membershipStatus).toBe(MembershipStatus.ACTIVE);
    });

    it('should reject manual trainer assignment when maxMemberCapacity is reached', async () => {
      const now = new Date();
      const nextMonth = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

      // Member 1 fills capacity (1/1)
      await MemberService.createMember(gymId, branchId, {
        fullName: 'Member One',
        email: 'member1@gym.com',
        phone: '7778889999',
        password: 'Password123',
        branchId,
        assignedTrainerId: trainerId,
        planName: 'Gold Plan',
        membershipStartDate: now,
        membershipEndDate: nextMonth,
      });

      // Member 2 creates unassigned
      const m2 = await MemberService.createMember(gymId, branchId, {
        fullName: 'Member Two',
        email: 'member2@gym.com',
        phone: '7778880000',
        password: 'Password123',
        branchId,
        planName: 'Silver Plan',
        membershipStartDate: now,
        membershipEndDate: nextMonth,
      });

      // Assigning Member 2 to full trainer (1/1 capacity) should return 409 Conflict
      const assignRes = await request(app)
        .patch(`/api/v1/gyms/${gymId}/members/${m2._id}/assign-trainer`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ trainerId });

      expect(assignRes.status).toBe(409);
      expect(assignRes.body.error.message).toContain('reached maximum member capacity');
    });
  });

  describe('Field-Level Update Restrictions', () => {
    it('should forbid Trainer role from updating billing planName or membershipStatus', async () => {
      const trainerUser = await User.create({
        fullName: 'Coach Trainer',
        email: 'trainer@gym.com',
        phone: '4445556666',
        password: 'Password123',
        role: Role.TRAINER,
        gymId: new mongoose.Types.ObjectId(gymId),
        branchId: new mongoose.Types.ObjectId(branchId),
        isActive: true,
      });

      const trainerToken = generateAccessToken({
        id: trainerUser._id.toString(),
        role: Role.TRAINER,
        gymId,
        branchId,
      });

      const now = new Date();
      const nextMonth = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

      const member = await MemberService.createMember(gymId, branchId, {
        fullName: 'Member One',
        email: 'member1@gym.com',
        phone: '7778889999',
        password: 'Password123',
        branchId,
        planName: 'Gold Plan',
        membershipStartDate: now,
        membershipEndDate: nextMonth,
      });

      // Trainer attempts to modify planName
      const updateRes = await request(app)
        .patch(`/api/v1/gyms/${gymId}/members/${member._id}`)
        .set('Authorization', `Bearer ${trainerToken}`)
        .send({ planName: 'Hacked Free Plan' });

      expect(updateRes.status).toBe(403);
      expect(updateRes.body.error.message).toContain('Trainers are not authorized to modify billing');
    });
  });

  describe('Membership Lifecycle (Freeze, Renew, Expire & QR Regenerate)', () => {
    it('should freeze, renew, and regenerate member QR code', async () => {
      const now = new Date();
      const nextMonth = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

      const member = await MemberService.createMember(gymId, branchId, {
        fullName: 'Member One',
        email: 'member1@gym.com',
        phone: '7778889999',
        password: 'Password123',
        branchId,
        planName: 'Gold Plan',
        membershipStartDate: now,
        membershipEndDate: nextMonth,
      });

      const initialQR = member.qrCode;

      // 1. Freeze Membership
      const freezeRes = await request(app)
        .patch(`/api/v1/gyms/${gymId}/members/${member._id}/freeze`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          freezeUntil: new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000).toISOString(),
          reason: 'Medical Leave',
        });

      expect(freezeRes.status).toBe(200);
      expect(freezeRes.body.data.member.membershipStatus).toBe(MembershipStatus.FROZEN);

      // 2. Renew Membership
      const renewRes = await request(app)
        .patch(`/api/v1/gyms/${gymId}/members/${member._id}/renew`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          newEndDate: new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000).toISOString(),
          planName: 'Platinum 3 Month Plan',
        });

      expect(renewRes.status).toBe(200);
      expect(renewRes.body.data.member.membershipStatus).toBe(MembershipStatus.ACTIVE);
      expect(renewRes.body.data.member.planName).toBe('Platinum 3 Month Plan');

      // 3. Regenerate QR Code
      const qrRes = await request(app)
        .post(`/api/v1/gyms/${gymId}/members/${member._id}/regenerate-qr`)
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(qrRes.status).toBe(200);
      expect(qrRes.body.data.qrCodeToken).toBeDefined();
      expect(qrRes.body.data.qrCodeToken).not.toBe(initialQR);
    });

    it('should flip past-due active memberships to EXPIRED via checkAndExpireMemberships()', async () => {
      const pastStart = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
      const pastEnd = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000);

      const member = await MemberService.createMember(gymId, branchId, {
        fullName: 'Expired Member',
        email: 'expired@gym.com',
        phone: '1231231234',
        password: 'Password123',
        branchId,
        planName: 'Basic 1 Month',
        membershipStartDate: pastStart,
        membershipEndDate: pastEnd,
      });

      // Force status to ACTIVE to test expiration routine
      await Member.findByIdAndUpdate(member._id, { membershipStatus: MembershipStatus.ACTIVE });

      const count = await MemberService.checkAndExpireMemberships();
      expect(count).toBe(1);

      const updated = await MemberService.getMemberById(member._id.toString(), gymId);
      expect(updated.membershipStatus).toBe(MembershipStatus.EXPIRED);
    });
  });
});
