import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import app from '../../src/app';
import { User } from '../../src/modules/user/user.model';
import { Gym } from '../../src/modules/gym/gym.model';
import { Branch } from '../../src/modules/gym/branch.model';
import { Member } from '../../src/modules/member/member.model';
import { PlatformSubscription } from '../../src/modules/payment/platformSubscription.model';
import { PlatformInvoice } from '../../src/modules/payment/platformInvoice.model';
import { MemberPayment } from '../../src/modules/payment/memberPayment.model';
import { InvoiceCounter } from '../../src/modules/payment/invoiceCounter.model';
import { MemberService } from '../../src/modules/member/member.service';
import { PlatformBillingService } from '../../src/modules/payment/platformBilling.service';
import { GymPlan, GymStatus } from '../../src/modules/gym/gym.types';
import { Role } from '../../src/common/constants/roles.enum';
import { PaymentStatus } from '../../src/modules/payment/platformSubscription.types';
import { generateAccessToken } from '../../src/common/utils/generateTokens';

let mongoServer: MongoMemoryServer;
let ownerToken: string;
let memberToken: string;
let superAdminToken: string;
let memberDocId: string;
let gymId: string;
let branchId: string;

describe('Payments & Subscriptions Module Integration Tests', () => {
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
    await PlatformSubscription.deleteMany({});
    await PlatformInvoice.deleteMany({});
    await MemberPayment.deleteMany({});
    await InvoiceCounter.deleteMany({});

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
      plan: GymPlan.BASIC,
      status: GymStatus.ACTIVE,
    });
    gymId = gym._id.toString();

    // Link gymId back to owner User document
    await User.findByIdAndUpdate(owner._id, { gymId: gym._id });

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
      planName: 'Basic Plan',
      membershipStartDate: now,
      membershipEndDate: nextMonth,
    });

    memberDocId = member._id.toString();
    memberToken = generateAccessToken({
      id: member.userId.toString(),
      role: Role.MEMBER,
      gymId,
      branchId,
    });

    const superAdmin = await User.create({
      fullName: 'Super Admin',
      email: 'admin@platform.com',
      phone: '1112223333',
      password: 'Password123',
      role: Role.SUPER_ADMIN,
      isActive: true,
    });

    superAdminToken = generateAccessToken({
      id: superAdmin._id.toString(),
      role: Role.SUPER_ADMIN,
    });
  });

  describe('Platform SaaS Billing (B2B)', () => {

    it('should suspend unpaid gyms past subscription expiration via checkAndSuspendUnpaidGyms()', async () => {
      const pastDate = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
      await Gym.findByIdAndUpdate(gymId, {
        plan: GymPlan.PRO,
        status: GymStatus.ACTIVE,
        subscriptionExpiresAt: pastDate,
      });

      const count = await PlatformBillingService.checkAndSuspendUnpaidGyms();
      expect(count).toBe(1);

      const suspendedGym = await Gym.findById(gymId);
      expect(suspendedGym?.status).toBe(GymStatus.SUSPENDED);
    });
    it('should allow super admin to record manual platform payment with custom targetPlan', async () => {
      const res = await request(app)
        .post(`/api/v1/billing/platform/gyms/${gymId}/manual-payment`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          targetPlan: GymPlan.ENTERPRISE,
          billingCycle: 'YEARLY',
          amount: 50000,
          method: 'bank_transfer',
          transactionRef: 'BANK-REF-9988',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.invoice.method).toBe('bank_transfer');

      const updatedGym = await Gym.findById(gymId);
      expect(updatedGym?.plan).toBe(GymPlan.ENTERPRISE);
      expect(updatedGym?.status).toBe(GymStatus.ACTIVE);
    });

    it('should calculate platform revenue overview combining manual and gateway payments and count distinct active paying gyms', async () => {
      // Create an ACTIVE gym with zero invoices this month
      const unpaidActiveGym = await Gym.create({
        name: 'Unpaid Active Gym',
        slug: 'unpaid-active-gym',
        billingEmail: 'unpaid@gym.com',
        ownerId: new mongoose.Types.ObjectId(),
        plan: GymPlan.BASIC,
        status: GymStatus.ACTIVE,
      });

      // 1. Bank transfer payment for primary gym
      await PlatformInvoice.create({
        gymId: new mongoose.Types.ObjectId(gymId),
        invoiceNumber: 'PLT-2026-888001',
        amount: 2999,
        status: PaymentStatus.SUCCESS,
        method: 'bank_transfer',
        targetPlan: GymPlan.PRO,
        periodStart: new Date(),
        periodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        paidAt: new Date(),
      });

      // 2. Manual payment for primary gym
      await PlatformInvoice.create({
        gymId: new mongoose.Types.ObjectId(gymId),
        invoiceNumber: 'PLT-2026-888002',
        amount: 9999,
        status: PaymentStatus.SUCCESS,
        method: 'upi',
        targetPlan: GymPlan.ENTERPRISE,
        periodStart: new Date(),
        periodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        paidAt: new Date(),
      });

      const res = await request(app)
        .get('/api/v1/billing/platform/analytics/overview')
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.totalRevenue).toBe(2999 + 9999);
      expect(res.body.data.revenueByMethod.bank_transfer).toBe(2999);
      expect(res.body.data.revenueByMethod.upi).toBe(9999);
      // Verify primary gym with invoices IS counted (1), unpaidActiveGym without invoices IS NOT counted
      expect(res.body.data.activePayingGymsCount).toBe(1);

      // Now add a SUCCESS invoice for unpaidActiveGym and verify count becomes 2
      await PlatformInvoice.create({
        gymId: unpaidActiveGym._id,
        invoiceNumber: 'PLT-2026-888003',
        amount: 5000,
        status: PaymentStatus.SUCCESS,
        method: 'bank_transfer',
        targetPlan: GymPlan.PRO,
        periodStart: new Date(),
        periodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        paidAt: new Date(),
      });

      const res2 = await request(app)
        .get('/api/v1/billing/platform/analytics/overview')
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(res2.status).toBe(200);
      expect(res2.body.data.activePayingGymsCount).toBe(2);
    });

    it('should reject non-SUPER_ADMIN users accessing platform manual payment or analytics', async () => {
      const manualRes = await request(app)
        .post(`/api/v1/billing/platform/gyms/${gymId}/manual-payment`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          targetPlan: GymPlan.PRO,
          amount: 2999,
          method: 'cash',
        });
      expect(manualRes.status).toBe(403);

      const analyticsRes = await request(app)
        .get('/api/v1/billing/platform/analytics/overview')
        .set('Authorization', `Bearer ${ownerToken}`);
      expect(analyticsRes.status).toBe(403);
    });
  });

  describe('Member Payments & Billing (B2C)', () => {
    it('should allow member to view their own payment history only', async () => {
      await MemberPayment.create({
        gymId: new mongoose.Types.ObjectId(gymId),
        branchId: new mongoose.Types.ObjectId(branchId),
        memberId: new mongoose.Types.ObjectId(memberDocId),
        amount: 1500,
        purpose: 'membership_fee',
        method: 'cash',
        status: PaymentStatus.SUCCESS,
        recordedByUserId: new mongoose.Types.ObjectId(),
        invoiceNumber: 'GYM-2026-MY001',
        paidAt: new Date(),
      });

      // Other member's payment
      const otherMemberDocId = new mongoose.Types.ObjectId();
      await MemberPayment.create({
        gymId: new mongoose.Types.ObjectId(gymId),
        branchId: new mongoose.Types.ObjectId(branchId),
        memberId: otherMemberDocId,
        amount: 3000,
        purpose: 'personal_training',
        method: 'upi',
        status: PaymentStatus.SUCCESS,
        recordedByUserId: new mongoose.Types.ObjectId(),
        invoiceNumber: 'GYM-2026-OTHER001',
        paidAt: new Date(),
      });

      const res = await request(app)
        .get(`/api/v1/gyms/${gymId}/payments/me`)
        .set('Authorization', `Bearer ${memberToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.payments.length).toBe(1);
      expect(res.body.data.payments[0].invoiceNumber).toBe('GYM-2026-MY001');
    });

    it('should allow staff to record manual cash payment with atomic invoice generation and membership renewal', async () => {
      const newEndDate = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000);

      const res = await request(app)
        .post(`/api/v1/gyms/${gymId}/payments/manual`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          branchId,
          memberId: memberDocId,
          amount: 2500,
          purpose: 'membership_fee',
          method: 'cash',
          notes: 'Paid 2 months fee in cash',
          triggerRenewal: true,
          newEndDate: newEndDate.toISOString(),
        });

      expect(res.status).toBe(201);
      expect(res.body.data.payment.invoiceNumber).toMatch(/^GYM-\d{4}-\d{6}$/);
      expect(res.body.data.payment.status).toBe(PaymentStatus.SUCCESS);
      expect(res.body.data.payment.relatedMembershipRenewal).toBe(true);

      const updatedMember = await Member.findById(memberDocId);
      expect(new Date(updatedMember!.membershipEndDate).getTime()).toBeCloseTo(newEndDate.getTime(), -3);
    });

    it('should generate revenue summary aggregation for Owner Dashboard', async () => {
      await MemberPayment.create({
        gymId,
        branchId,
        memberId: memberDocId,
        amount: 2000,
        purpose: 'membership_fee',
        method: 'cash',
        status: PaymentStatus.SUCCESS,
        recordedByUserId: new mongoose.Types.ObjectId(),
        invoiceNumber: 'GYM-2026-999001',
        paidAt: new Date(),
      });

      const res = await request(app)
        .get(`/api/v1/gyms/${gymId}/payments/revenue-summary?groupBy=day`)
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.revenue.length).toBeGreaterThanOrEqual(1);
      expect(res.body.data.revenue[0].totalRevenue).toBe(2000);
    });

    it('should allow owner to refund a payment', async () => {
      const payment = await MemberPayment.create({
        gymId,
        branchId,
        memberId: memberDocId,
        amount: 1000,
        purpose: 'merchandise',
        method: 'cash',
        status: PaymentStatus.SUCCESS,
        recordedByUserId: new mongoose.Types.ObjectId(),
        invoiceNumber: 'GYM-2026-999002',
        paidAt: new Date(),
      });

      const refundRes = await request(app)
        .patch(`/api/v1/gyms/${gymId}/payments/${payment._id}/refund`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ reason: 'Defective T-Shirt returned' });

      expect(refundRes.status).toBe(200);
      expect(refundRes.body.data.payment.status).toBe(PaymentStatus.REFUNDED);
      expect(refundRes.body.data.payment.refundedAmount).toBe(1000);
    });
  });
});
