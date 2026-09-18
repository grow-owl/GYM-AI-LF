import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import app from '../../src/app';
import { User } from '../../src/modules/user/user.model';
import { Gym } from '../../src/modules/gym/gym.model';
import { Branch } from '../../src/modules/gym/branch.model';
import { Member } from '../../src/modules/member/member.model';
import { Exercise } from '../../src/modules/workout/exercise.model';
import { DeviceToken } from '../../src/modules/notification/deviceToken.model';
import { Notification } from '../../src/modules/notification/notification.model';
import { MemberService } from '../../src/modules/member/member.service';
import { AuthService } from '../../src/modules/auth/auth.service';
import { WorkoutPlanService } from '../../src/modules/workout/workoutPlan.service';
import { GamificationService } from '../../src/modules/gamification/gamification.service';
import { MemberPaymentService } from '../../src/modules/payment/memberPayment.service';
import { NotificationType } from '../../src/modules/notification/notification.types';
import { MuscleGroup } from '../../src/modules/workout/exercise.types';
import { Role } from '../../src/common/constants/roles.enum';
import { generateAccessToken } from '../../src/common/utils/generateTokens';

let mongoServer: MongoMemoryServer;
let ownerToken: string;
let memberToken: string;
let ownerUserId: string;
let memberDocId: string;
let memberUserId: string;
let gymId: string;
let branchId: string;

describe('Notifications Module Integration Tests', () => {
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
    await Exercise.deleteMany({});
    await DeviceToken.deleteMany({});
    await Notification.deleteMany({});

    // 1. Create Owner & Gym & Branch
    const owner = await User.create({
      fullName: 'Gym Owner',
      email: 'owner@gym.com',
      phone: '9876543210',
      password: 'Password123',
      role: Role.GYM_OWNER,
      isActive: true,
    });
    ownerUserId = owner._id.toString();

    const gym = await Gym.create({
      name: 'Spartan Gym',
      ownerId: owner._id,
      billingEmail: 'owner@gym.com',
    });
    gymId = gym._id.toString();

    await User.findByIdAndUpdate(owner._id, { gymId: gym._id });

    const branch = await Branch.create({
      gymId: gym._id,
      name: 'Main Branch',
      address: { line1: 'L1', city: 'City', state: 'State', pincode: '000', country: 'Country' },
      contactPhone: '9998887776',
    });
    branchId = branch._id.toString();

    ownerToken = generateAccessToken({
      id: ownerUserId,
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
      planName: 'Gold Plan',
      membershipStartDate: now,
      membershipEndDate: nextMonth,
    });

    memberDocId = member._id.toString();
    memberUserId = member.userId.toString();
    memberToken = generateAccessToken({
      id: memberUserId,
      role: Role.MEMBER,
      gymId,
      branchId,
    });
  });

  describe('Device Token Management', () => {
    it('should register FCM device token and handle token re-assignment across users', async () => {
      const fcmToken = 'fcm_token_test_123456789';

      // Register under member
      const res1 = await request(app)
        .post('/api/v1/notifications/device-token')
        .set('Authorization', `Bearer ${memberToken}`)
        .send({ fcmToken, platform: 'android' });

      expect(res1.status).toBe(201);
      expect(res1.body.data.deviceToken.userId).toBe(memberUserId);

      // Re-register same FCM token under owner
      const res2 = await request(app)
        .post('/api/v1/notifications/device-token')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ fcmToken, platform: 'ios' });

      expect(res2.status).toBe(201);
      expect(res2.body.data.deviceToken.userId).toBe(ownerUserId);
      expect(res2.body.data.deviceToken.platform).toBe('ios');

      const count = await DeviceToken.countDocuments({ fcmToken });
      expect(count).toBe(1);
    });

    it('should deactivate device token on logout endpoint request', async () => {
      const fcmToken = 'fcm_token_deactivate_test';
      await request(app)
        .post('/api/v1/notifications/device-token')
        .set('Authorization', `Bearer ${memberToken}`)
        .send({ fcmToken, platform: 'android' });

      const res = await request(app)
        .delete('/api/v1/notifications/device-token')
        .set('Authorization', `Bearer ${memberToken}`)
        .send({ fcmToken });

      expect(res.status).toBe(200);
      const token = await DeviceToken.findOne({ fcmToken });
      expect(token?.isActive).toBe(false);
    });
  });

  describe('In-App Notification Feed & Badge Count', () => {
    it('should retrieve notification feed, unread count badge, and mark notifications as read', async () => {
      // Seed 2 notifications
      await Notification.create({
        userId: memberUserId,
        gymId,
        type: NotificationType.GENERIC,
        title: 'Notice 1',
        body: 'Body 1',
        isRead: false,
      });

      const notif2 = await Notification.create({
        userId: memberUserId,
        gymId,
        type: NotificationType.GENERIC,
        title: 'Notice 2',
        body: 'Body 2',
        isRead: false,
      });

      // 1. Get Unread Count
      const countRes = await request(app)
        .get('/api/v1/notifications/unread-count')
        .set('Authorization', `Bearer ${memberToken}`);

      expect(countRes.status).toBe(200);
      expect(countRes.body.data.unreadCount).toBe(2);

      // 2. Mark Single as Read
      const markSingleRes = await request(app)
        .patch(`/api/v1/notifications/${notif2._id}/read`)
        .set('Authorization', `Bearer ${memberToken}`);

      expect(markSingleRes.status).toBe(200);
      expect(markSingleRes.body.data.notification.isRead).toBe(true);

      // 3. Mark All as Read
      const markAllRes = await request(app)
        .patch('/api/v1/notifications/read-all')
        .set('Authorization', `Bearer ${memberToken}`);

      expect(markAllRes.status).toBe(200);
      expect(markAllRes.body.data.markedCount).toBe(1);

      const countAfter = await Notification.countDocuments({ userId: memberUserId, isRead: false });
      expect(countAfter).toBe(0);
    });
  });

  describe('Staff Gym Broadcast Announcement', () => {
    it('should allow gym owner to send broadcast notification to active members', async () => {
      const res = await request(app)
        .post(`/api/v1/gyms/${gymId}/notifications/broadcast`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          branchId,
          title: 'Maintenance Notice',
          body: 'Gym will be closed this Sunday from 2 PM to 5 PM for maintenance.',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.sentCount).toBe(1);

      const notif = await Notification.findOne({ userId: memberUserId });
      expect(notif).toBeDefined();
      expect(notif?.title).toBe('Maintenance Notice');
    });
  });

  describe('Cross-Module Notification Trigger Wiring Verification', () => {
    it('should trigger PASSWORD_RESET notification when forgot password is run', async () => {
      await AuthService.forgotPassword('bob@member.com');

      const notif = await Notification.findOne({ userId: memberUserId, type: NotificationType.PASSWORD_RESET });
      expect(notif).toBeDefined();
      expect(notif?.title).toContain('Password Reset');
    });

    it('should trigger WORKOUT_ASSIGNED notification when a new workout plan is created', async () => {
      const exercise = await Exercise.create({
        name: 'Bench Press',
        muscleGroup: MuscleGroup.CHEST,
      });

      await WorkoutPlanService.createWorkoutPlan(
        memberDocId,
        {
          gymId,
          title: 'Hypertrophy Phase 1',
          durationWeeks: 4,
          daysPerWeek: 3,
          days: [
            {
              dayName: 'Day 1',
              exercises: [{ exerciseId: exercise._id.toString(), targetSets: 3, targetReps: 10 }],
            },
          ],
        },
        ownerUserId,
        undefined,
        gymId
      );

      const notif = await Notification.findOne({ userId: memberUserId, type: NotificationType.WORKOUT_ASSIGNED });
      expect(notif).toBeDefined();
      expect(notif?.title).toContain('Workout Plan Assigned');
    });

    it('should trigger STREAK_MILESTONE notification when 7-day streak milestone is achieved', async () => {
      // Simulate 7 check-ins
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        await GamificationService.recordCheckInForStreak(memberDocId, gymId, d);
      }

      const notif = await Notification.findOne({ userId: memberUserId, type: NotificationType.STREAK_MILESTONE });
      expect(notif).toBeDefined();
      expect(notif?.title).toContain('Streak');
    });

    it('should trigger PAYMENT_SUCCESS notification when manual member payment is recorded', async () => {
      await MemberPaymentService.recordManualPayment(gymId, ownerUserId, {
        memberId: memberDocId,
        amount: 3000,
        paymentMethod: 'cash',
      });

      const notif = await Notification.findOne({ userId: memberUserId, type: NotificationType.PAYMENT_SUCCESS });
      expect(notif).toBeDefined();
      expect(notif?.title).toContain('Payment Received');
    });
  });
});
