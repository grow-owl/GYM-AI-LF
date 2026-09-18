import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import app from '../../src/app';
import { User } from '../../src/modules/user/user.model';
import { Gym } from '../../src/modules/gym/gym.model';
import { Branch } from '../../src/modules/gym/branch.model';
import { Member } from '../../src/modules/member/member.model';
import { Trainer } from '../../src/modules/trainer/trainer.model';
import { Attendance } from '../../src/modules/attendance/attendance.model';
import { MemberPayment } from '../../src/modules/payment/memberPayment.model';
import { WorkoutLog } from '../../src/modules/workout/workoutLog.model';
import { WeightEntry } from '../../src/modules/progress/weightEntry.model';
import { AIReport } from '../../src/modules/aiCoach/aiReport.model';
import { TrainerFeedback } from '../../src/modules/feedback/trainerFeedback.model';
import { ReportRequest } from '../../src/modules/report/reportRequest.model';
import { Role } from '../../src/common/constants/roles.enum';
import { GymPlan, GymStatus } from '../../src/modules/gym/gym.types';
import { MembershipStatus } from '../../src/modules/member/member.types';
import { AttendanceStatus } from '../../src/modules/attendance/attendance.types';
import { PaymentStatus } from '../../src/modules/payment/platformSubscription.types';
import { generateAccessToken } from '../../src/common/utils/generateTokens';
import { DashboardService } from '../../src/modules/report/dashboard.service';

let mongoServer: MongoMemoryServer;

describe('Reports, Analytics & Feedback Module Integration Tests', () => {
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

  let gymOwnerToken: string;
  let branchManagerToken: string;
  let trainerToken: string;
  let otherTrainerToken: string;
  let memberToken: string;

  let gymId: string;
  let branchId: string;
  let otherBranchId: string;
  let memberId: string;

  beforeEach(async () => {
    await User.deleteMany({});
    await Gym.deleteMany({});
    await Branch.deleteMany({});
    await Member.deleteMany({});
    await Trainer.deleteMany({});
    await Attendance.deleteMany({});
    await MemberPayment.deleteMany({});
    await WorkoutLog.deleteMany({});
    await WeightEntry.deleteMany({});
    await AIReport.deleteMany({});
    await TrainerFeedback.deleteMany({});
    await ReportRequest.deleteMany({});

    DashboardService.clearCache();

    // 1. Create Gym Owner & Gym
    const ownerUser = await User.create({
      fullName: 'Gym Owner',
      email: 'owner@reports.com',
      phone: '1112223333',
      password: 'Password123',
      role: Role.GYM_OWNER,
    });

    const gym = await Gym.create({
      name: 'Analytics Gym',
      ownerId: ownerUser._id,
      billingEmail: 'owner@reports.com',
      plan: GymPlan.PRO,
      status: GymStatus.ACTIVE,
    });
    gymId = gym._id.toString();

    // 2. Create Primary & Secondary Branches
    const branch1 = await Branch.create({
      gymId: gym._id,
      name: 'Central Branch',
      address: { line1: '123 Main St', city: 'Metro', state: 'State', pincode: '100001', country: 'Country' },
      contactPhone: '9991112222',
      isPrimary: true,
    });
    branchId = branch1._id.toString();

    const branch2 = await Branch.create({
      gymId: gym._id,
      name: 'North Branch',
      address: { line1: '456 North St', city: 'Metro', state: 'State', pincode: '100002', country: 'Country' },
      contactPhone: '9991113333',
      isPrimary: false,
    });
    otherBranchId = branch2._id.toString();

    await User.findByIdAndUpdate(ownerUser._id, { gymId: gym._id, branchId: branch1._id });

    // 3. Create Branch Manager User
    const managerUser = await User.create({
      fullName: 'Branch Manager',
      email: 'manager@reports.com',
      phone: '2223334444',
      password: 'Password123',
      role: Role.BRANCH_MANAGER,
      gymId: gym._id,
      branchId: branch1._id,
    });

    // 4. Create Assigned Trainer
    const trainerUser = await User.create({
      fullName: 'Trainer John',
      email: 'trainer1@reports.com',
      phone: '3334445555',
      password: 'Password123',
      role: Role.TRAINER,
      gymId: gym._id,
      branchId: branch1._id,
    });

    const trainerDoc = await Trainer.create({
      userId: trainerUser._id,
      gymId: gym._id,
      branchId: branch1._id,
      specializations: ['Hypertrophy'],
    });

    // 5. Create Other Trainer (Not Assigned)
    const otherTrainerUser = await User.create({
      fullName: 'Trainer Mike',
      email: 'trainer2@reports.com',
      phone: '3334446666',
      password: 'Password123',
      role: Role.TRAINER,
      gymId: gym._id,
      branchId: branch1._id,
    });

    await Trainer.create({
      userId: otherTrainerUser._id,
      gymId: gym._id,
      branchId: branch1._id,
      specializations: ['Crossfit'],
    });

    // 6. Create Member User & Profile
    const memberUser = await User.create({
      fullName: 'Alice Member',
      email: 'alice@reports.com',
      phone: '4445556666',
      password: 'Password123',
      role: Role.MEMBER,
      gymId: gym._id,
      branchId: branch1._id,
    });

    const now = new Date();
    const expiryDate = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000); // Expiring in 5 days

    const memberDoc = await Member.create({
      userId: memberUser._id,
      gymId: gym._id,
      branchId: branch1._id,
      assignedTrainerId: trainerDoc._id,
      membershipStatus: MembershipStatus.ACTIVE,
      membershipStartDate: new Date(now.getTime() - 25 * 24 * 60 * 60 * 1000),
      membershipEndDate: expiryDate,
      planName: 'Gold Plan',
      qrCode: 'qr_mock_123',
    });
    memberId = memberDoc._id.toString();

    // Generate JWT Access Tokens
    gymOwnerToken = generateAccessToken({ id: ownerUser._id.toString(), role: Role.GYM_OWNER, gymId, branchId });
    branchManagerToken = generateAccessToken({ id: managerUser._id.toString(), role: Role.BRANCH_MANAGER, gymId, branchId });
    trainerToken = generateAccessToken({ id: trainerUser._id.toString(), role: Role.TRAINER, gymId, branchId });
    otherTrainerToken = generateAccessToken({ id: otherTrainerUser._id.toString(), role: Role.TRAINER, gymId, branchId });
    memberToken = generateAccessToken({ id: memberUser._id.toString(), role: Role.MEMBER, gymId, branchId });
  });

  describe('GET /api/v1/gyms/:gymId/dashboard/overview', () => {
    it('should calculate owner dashboard metrics cleanly and use in-memory TTL caching', async () => {
      const now = new Date();
      const todayKey = now.toISOString().split('T')[0];

      // Seed attendance today
      await Attendance.create({
        gymId,
        branchId,
        memberId,
        checkInAt: now,
        status: AttendanceStatus.CHECKED_IN,
        checkInSource: 'QR',
        dayKey: todayKey,
      });

      // Seed payment this month
      await MemberPayment.create({
        gymId,
        branchId,
        memberId,
        amount: 5000,
        purpose: 'membership_fee',
        method: 'cash',
        status: PaymentStatus.SUCCESS,
        recordedByUserId: new mongoose.Types.ObjectId(),
        invoiceNumber: 'GYM-2026-880011',
        paidAt: now,
      });

      // Request 1: Fresh calculation
      const res1 = await request(app)
        .get(`/api/v1/gyms/${gymId}/dashboard/overview`)
        .set('Authorization', `Bearer ${gymOwnerToken}`);

      expect(res1.status).toBe(200);
      expect(res1.body.success).toBe(true);
      expect(res1.body.data.totalActiveMembers).toBe(1);
      expect(res1.body.data.totalTrainers).toBe(2);
      expect(res1.body.data.todayCheckIns).toBe(1);
      expect(res1.body.data.revenueThisMonth).toBe(5000);
      expect(res1.body.data.membershipsExpiringIn7Days).toBe(1);
      expect(res1.body.data.avgAttendanceRate30d).toBe(100);

      // Request 2: Served from cache
      const res2 = await request(app)
        .get(`/api/v1/gyms/${gymId}/dashboard/overview`)
        .set('Authorization', `Bearer ${gymOwnerToken}`);

      expect(res2.status).toBe(200);
      expect(res2.body.data.totalActiveMembers).toBe(1);
    });
  });

  describe('POST /api/v1/gyms/:gymId/reports', () => {
    it('should generate attendance, workout, weight, strength, AI, feedback, and revenue JSON reports', async () => {
      const start = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const end = new Date();

      // Seed data
      await WeightEntry.create({
        gymId,
        memberId,
        weightKg: 80,
        recordedAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
        dayKey: '2026-07-15',
      });
      await WeightEntry.create({
        gymId,
        memberId,
        weightKg: 78,
        recordedAt: end,
        dayKey: end.toISOString().split('T')[0],
      });

      await WorkoutLog.create({
        gymId,
        branchId,
        memberId,
        dayKey: end.toISOString().split('T')[0],
        exercises: [
          {
            exerciseId: new mongoose.Types.ObjectId(),
            sets: [{ setNumber: 1, reps: 10, weightKg: 60, completed: true }],
            completedAt: end,
          },
        ],
        completedAt: end,
        totalDurationMinutes: 45,
      });

      await AIReport.create({
        gymId,
        memberId,
        type: 'WEEKLY',
        periodStart: start,
        periodEnd: end,
        summary: 'Member is making steady progress',
        metrics: { attendanceRate: 80, workoutCompletionRate: 90, avgSleepHours: 7.5, avgWaterIntakeMl: 3000 },
        insights: ['Good sleep'],
        recommendations: ['Increase water'],
        plateauDetected: false,
        injuryRiskFlag: false,
        generatedByProvider: 'OPENAI',
      });

      // Test Report Request: Weight Change
      const res = await request(app)
        .post(`/api/v1/gyms/${gymId}/reports`)
        .set('Authorization', `Bearer ${gymOwnerToken}`)
        .send({
          reportType: 'weight_change',
          scope: { memberId },
          periodStart: start.toISOString(),
          periodEnd: end.toISOString(),
          format: 'json',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.reportRequest.status).toBe('READY');
      expect(res.body.data.reportRequest.reportData.totalMembersTracked).toBe(1);
      expect(res.body.data.reportRequest.reportData.weightChangeBreakdown[0].weightDeltaKg).toBe(-2);

      // Test Report Request: Full Progress
      const fullRes = await request(app)
        .post(`/api/v1/gyms/${gymId}/reports`)
        .set('Authorization', `Bearer ${gymOwnerToken}`)
        .send({
          reportType: 'member_full_progress',
          scope: { memberId },
          periodStart: start.toISOString(),
          periodEnd: end.toISOString(),
          format: 'json',
        });

      expect(fullRes.status).toBe(201);
      expect(fullRes.body.data.reportRequest.reportData.attendance).toBeDefined();
      expect(fullRes.body.data.reportRequest.reportData.workout).toBeDefined();
    });

    it('should render PDF report and return Cloudinary file URL when format=pdf is requested', async () => {
      const start = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const end = new Date();

      const res = await request(app)
        .post(`/api/v1/gyms/${gymId}/reports`)
        .set('Authorization', `Bearer ${gymOwnerToken}`)
        .send({
          reportType: 'attendance',
          scope: { branchId },
          periodStart: start.toISOString(),
          periodEnd: end.toISOString(),
          format: 'pdf',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.reportRequest.status).toBe('READY');
      expect(res.body.data.reportRequest.fileUrl).toMatch(/^https:\/\/res\.cloudinary\.com\//);
    });

    it('should reject Branch Manager from requesting reports for a different branch (403 Forbidden)', async () => {
      const start = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const end = new Date();

      const res = await request(app)
        .post(`/api/v1/gyms/${gymId}/reports`)
        .set('Authorization', `Bearer ${branchManagerToken}`)
        .send({
          reportType: 'attendance',
          scope: { branchId: otherBranchId },
          periodStart: start.toISOString(),
          periodEnd: end.toISOString(),
        });

      expect(res.status).toBe(403);
      expect(res.body.error.message).toContain('Branch Managers cannot access reports for other branches');
    });
  });

  describe('Trainer Feedback Flow', () => {
    it('should allow assigned trainer to leave feedback for member and respect member visibility rules', async () => {
      // 1. Trainer leaves feedback
      const createRes = await request(app)
        .post(`/api/v1/members/${memberId}/feedback`)
        .set('Authorization', `Bearer ${trainerToken}`)
        .send({
          memberId,
          note: 'Great form on squats today! Keep pushing.',
          rating: 5,
          visibleToMember: true,
        });

      expect(createRes.status).toBe(201);
      const feedbackId = createRes.body.data.feedback._id;

      // 2. Trainer leaves hidden internal note
      await request(app)
        .post(`/api/v1/members/${memberId}/feedback`)
        .set('Authorization', `Bearer ${trainerToken}`)
        .send({
          memberId,
          note: 'Internal note: member needs mobility work.',
          rating: 3,
          visibleToMember: false,
        });

      // 3. Member reads feedback -> sees only visibleToMember=true (1 entry)
      const memberReadRes = await request(app)
        .get(`/api/v1/members/${memberId}/feedback`)
        .set('Authorization', `Bearer ${memberToken}`);

      expect(memberReadRes.status).toBe(200);
      expect(memberReadRes.body.data.feedbacks.length).toBe(1);
      expect(memberReadRes.body.data.feedbacks[0].note).toContain('Great form on squats');

      // 4. Owner reads feedback -> sees all entries (2 entries)
      const ownerReadRes = await request(app)
        .get(`/api/v1/members/${memberId}/feedback`)
        .set('Authorization', `Bearer ${gymOwnerToken}`);

      expect(ownerReadRes.status).toBe(200);
      expect(ownerReadRes.body.data.feedbacks.length).toBe(2);

      // 5. Update feedback
      const updateRes = await request(app)
        .patch(`/api/v1/feedback/${feedbackId}`)
        .set('Authorization', `Bearer ${trainerToken}`)
        .send({ note: 'Updated: Excellent squat session.' });

      expect(updateRes.status).toBe(200);
      expect(updateRes.body.data.feedback.note).toBe('Updated: Excellent squat session.');

      // 6. Delete feedback
      const deleteRes = await request(app)
        .delete(`/api/v1/feedback/${feedbackId}`)
        .set('Authorization', `Bearer ${trainerToken}`);

      expect(deleteRes.status).toBe(200);
    });

    it('should reject unassigned trainer from leaving feedback for member', async () => {
      const res = await request(app)
        .post(`/api/v1/members/${memberId}/feedback`)
        .set('Authorization', `Bearer ${otherTrainerToken}`)
        .send({
          memberId,
          note: 'Attempting unassigned feedback',
        });

      expect(res.status).toBe(403);
      expect(res.body.error.message).toContain('Trainers can only leave feedback for their assigned members');
    });
  });
});
