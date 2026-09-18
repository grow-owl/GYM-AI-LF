import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import app from '../../src/app';
import { User } from '../../src/modules/user/user.model';
import { Gym } from '../../src/modules/gym/gym.model';
import { Branch } from '../../src/modules/gym/branch.model';
import { Member } from '../../src/modules/member/member.model';
import { MemberPayment } from '../../src/modules/payment/memberPayment.model';
import { Role } from '../../src/common/constants/roles.enum';
import { MembershipStatus } from '../../src/modules/member/member.types';
import { PaymentStatus } from '../../src/modules/payment/platformSubscription.types';
import { generateAccessToken } from '../../src/common/utils/generateTokens';

let mongoServer: MongoMemoryServer;
let ownerToken: string;
let managerToken: string;
let gymId: string;
let branch1Id: string;
let branch2Id: string;

describe('Multi-Branch Comparison Analytics Integration Tests', () => {
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
    await MemberPayment.deleteMany({});

    // 1. Create Gym Owner
    const owner = await User.create({
      fullName: 'Gym Owner',
      email: 'owner@multi-branch.com',
      password: 'password123',
      role: Role.GYM_OWNER,
      phone: '+919000000001',
    });

    const gym = await Gym.create({
      name: 'Multi Branch Fitness Club',
      ownerId: owner._id,
      slug: 'multi-branch-fitness',
      billingEmail: 'billing@multi-branch.com',
    });
    gymId = gym._id.toString();

    // 2. Create Two Branches
    const branch1 = await Branch.create({
      gymId: gym._id,
      name: 'Downtown Branch',
      code: 'DT-01',
      address: { line1: '1st Street', city: 'Mumbai', state: 'MH', pincode: '400001', country: 'India' },
      contactPhone: '+919000000001',
    });
    branch1Id = branch1._id.toString();

    const branch2 = await Branch.create({
      gymId: gym._id,
      name: 'Uptown Branch',
      code: 'UT-02',
      address: { line1: '2nd Street', city: 'Mumbai', state: 'MH', pincode: '400002', country: 'India' },
      contactPhone: '+919000000002',
    });
    branch2Id = branch2._id.toString();

    // 3. Create Branch Manager for Branch 1
    const manager = await User.create({
      fullName: 'Downtown Manager',
      email: 'manager@multi-branch.com',
      password: 'password123',
      role: Role.BRANCH_MANAGER,
      phone: '+919000000002',
      gymId: gym._id,
      branchId: branch1._id,
    });

    owner.gymId = gym._id;
    await owner.save();

    ownerToken = generateAccessToken({
      id: owner._id.toString(),
      role: Role.GYM_OWNER,
      gymId: gymId,
    });

    managerToken = generateAccessToken({
      id: manager._id.toString(),
      role: Role.BRANCH_MANAGER,
      gymId: gymId,
      branchId: branch1Id,
    });

    // 4. Create Sample Data for Revenue Metrics
    const now = new Date();
    const nextMonth = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const member1 = await Member.create({
      userId: owner._id,
      gymId: gym._id,
      branchId: branch1._id,
      membershipStatus: MembershipStatus.ACTIVE,
      planName: 'Standard Plan',
      membershipStartDate: now,
      membershipEndDate: nextMonth,
      qrCode: `QR_${Date.now()}_1`,
    });

    const member2 = await Member.create({
      userId: manager._id,
      gymId: gym._id,
      branchId: branch2._id,
      membershipStatus: MembershipStatus.ACTIVE,
      planName: 'Standard Plan',
      membershipStartDate: now,
      membershipEndDate: nextMonth,
      qrCode: `QR_${Date.now()}_2`,
    });

    await MemberPayment.create({
      gymId: gym._id,
      branchId: branch1._id,
      memberId: member1._id,
      amount: 5000,
      purpose: 'membership_fee',
      method: 'cash',
      recordedByUserId: owner._id,
      invoiceNumber: 'INV-1001',
      status: PaymentStatus.SUCCESS,
      paidAt: new Date(),
    });

    await MemberPayment.create({
      gymId: gym._id,
      branchId: branch2._id,
      memberId: member2._id,
      amount: 7500,
      purpose: 'membership_fee',
      method: 'cash',
      recordedByUserId: owner._id,
      invoiceNumber: 'INV-1002',
      status: PaymentStatus.SUCCESS,
      paidAt: new Date(),
    });
  });

  it('should return per-branch time-series comparison data for GYM_OWNER', async () => {
    const res = await request(app)
      .get(`/api/v1/gyms/${gymId}/analytics/branch-comparison?metric=revenue&period=30d`)
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.metric).toBe('revenue');
    expect(res.body.data.period).toBe('30d');
    expect(res.body.data.branches.length).toBe(2);

    const b1 = res.body.data.branches.find((b: any) => b.branchId === branch1Id);
    const b2 = res.body.data.branches.find((b: any) => b.branchId === branch2Id);

    expect(b1).toBeDefined();
    expect(b2).toBeDefined();
    expect(b1.points.length).toBe(30);
    expect(b2.points.length).toBe(30);
  });

  it('should auto-filter comparison array to assigned branch for BRANCH_MANAGER', async () => {
    const res = await request(app)
      .get(`/api/v1/gyms/${gymId}/analytics/branch-comparison?metric=revenue&period=30d`)
      .set('Authorization', `Bearer ${managerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.branches.length).toBe(1);
    expect(res.body.data.branches[0].branchId).toBe(branch1Id);
  });
});
