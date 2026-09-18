import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import app from '../../src/app';
import { User } from '../../src/modules/user/user.model';
import { Gym } from '../../src/modules/gym/gym.model';
import { Branch } from '../../src/modules/gym/branch.model';
import { Member } from '../../src/modules/member/member.model';
import { Attendance } from '../../src/modules/attendance/attendance.model';
import { MemberService } from '../../src/modules/member/member.service';
import { AttendanceService } from '../../src/modules/attendance/attendance.service';
import { Role } from '../../src/common/constants/roles.enum';
import { AttendanceStatus } from '../../src/modules/attendance/attendance.types';
import { MembershipStatus } from '../../src/modules/member/member.types';
import { generateAccessToken } from '../../src/common/utils/generateTokens';
import { getDayKeyForBranch } from '../../src/common/utils/timezone';

let mongoServer: MongoMemoryServer;
let ownerToken: string;
let memberToken: string;
let memberUserId: string;
let memberDocId: string;
let gymId: string;
let branchId: string;
let memberQrCode: string;

describe('Attendance Module Integration Tests', () => {
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
    await Attendance.deleteMany({});

    // 1. Create Owner & Gym & Branch with IANA timezone
    const owner = await User.create({
      fullName: 'Gym Owner',
      email: 'owner@gym.com',
      phone: '9876543210',
      password: 'Password123',
      role: Role.GYM_OWNER,
      isActive: true,
    });

    const gym = await Gym.create({
      name: 'Olympus Gym',
      ownerId: owner._id,
      billingEmail: 'owner@gym.com',
    });
    gymId = gym._id.toString();

    const branch = await Branch.create({
      gymId: gym._id,
      name: 'Kolkata Branch',
      address: { line1: 'L1', city: 'Kolkata', state: 'WB', pincode: '700001', country: 'India' },
      contactPhone: '9998887776',
      timezone: 'Asia/Kolkata',
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
      fullName: 'Member John',
      email: 'john@member.com',
      phone: '1112223333',
      password: 'Password123',
      branchId,
      planName: 'Monthly Pass',
      membershipStartDate: now,
      membershipEndDate: nextMonth,
    });

    memberDocId = member._id.toString();
    memberUserId = member.userId.toString();
    memberQrCode = member.qrCode;

    memberToken = generateAccessToken({
      id: memberUserId,
      role: Role.MEMBER,
      gymId,
      branchId,
    });
  });

  describe('QR Check-In Workflow', () => {
    it('should check in member successfully using QR payload and calculate branch dayKey', async () => {
      const res = await request(app)
        .post('/api/v1/attendance/check-in')
        .set('Authorization', `Bearer ${memberToken}`)
        .send({ qrPayload: memberQrCode });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.attendance.status).toBe(AttendanceStatus.CHECKED_IN);

      const expectedDayKey = getDayKeyForBranch(new Date(), 'Asia/Kolkata');
      expect(res.body.data.attendance.dayKey).toBe(expectedDayKey);
    });

    it('should reject double check-in on the same day with 409 Conflict', async () => {
      // 1st Check-in
      await request(app)
        .post('/api/v1/attendance/check-in')
        .set('Authorization', `Bearer ${memberToken}`)
        .send({ qrPayload: memberQrCode });

      // 2nd Check-in attempt same day
      const res = await request(app)
        .post('/api/v1/attendance/check-in')
        .set('Authorization', `Bearer ${memberToken}`)
        .send({ qrPayload: memberQrCode });

      expect(res.status).toBe(409);
      expect(res.body.error.message).toContain('already checked in');
    });

    it('should reject check-in if membership is FROZEN or EXPIRED', async () => {
      // Set membership status to FROZEN
      await Member.findByIdAndUpdate(memberDocId, { membershipStatus: MembershipStatus.FROZEN });

      const res = await request(app)
        .post('/api/v1/attendance/check-in')
        .set('Authorization', `Bearer ${memberToken}`)
        .send({ qrPayload: memberQrCode });

      expect(res.status).toBe(403);
      expect(res.body.error.message).toContain('currently FROZEN');
    });
  });

  describe('Check-Out & Duration Computation', () => {
    it('should check out member and calculate workout duration in minutes', async () => {
      // Check in
      await request(app)
        .post('/api/v1/attendance/check-in')
        .set('Authorization', `Bearer ${memberToken}`)
        .send({ qrPayload: memberQrCode });

      // Check out
      const res = await request(app)
        .post('/api/v1/attendance/check-out')
        .set('Authorization', `Bearer ${memberToken}`)
        .send({ qrPayload: memberQrCode });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.attendance.status).toBe(AttendanceStatus.CHECKED_OUT);
      expect(res.body.data.attendance.durationMinutes).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Reactive Auto-Close Stale Previous Day Sessions', () => {
    it('should auto-close open session from yesterday when checking in today', async () => {
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const yesterdayDayKey = getDayKeyForBranch(yesterday, 'Asia/Kolkata');

      // Create open session from yesterday
      await Attendance.create({
        gymId: new mongoose.Types.ObjectId(gymId),
        branchId: new mongoose.Types.ObjectId(branchId),
        memberId: new mongoose.Types.ObjectId(memberDocId),
        checkInAt: yesterday,
        status: AttendanceStatus.CHECKED_IN,
        dayKey: yesterdayDayKey,
      });

      // Today's check-in
      const res = await request(app)
        .post('/api/v1/attendance/check-in')
        .set('Authorization', `Bearer ${memberToken}`)
        .send({ qrPayload: memberQrCode });

      expect(res.status).toBe(201);

      // Verify yesterday session was auto-closed
      const oldSession = await Attendance.findOne({ dayKey: yesterdayDayKey });
      expect(oldSession?.status).toBe(AttendanceStatus.AUTO_CLOSED);
      expect(oldSession?.durationMinutes).toBe(240);
    });
  });

  describe('Staff Manual Attendance & Proactive Cron Auto-Close', () => {
    it('should record staff manual attendance entry with audit reason', async () => {
      const res = await request(app)
        .post('/api/v1/attendance/manual')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          memberId: memberDocId,
          checkInAt: new Date().toISOString(),
          reason: 'Member lost phone, manual kiosk check-in',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.attendance.checkInSource).toBe('MANUAL');
      expect(res.body.data.attendance.manualAuditReason).toBe('Member lost phone, manual kiosk check-in');
    });

    it('should auto-close stale sessions older than 12 hours via autoCloseStaleSessions()', async () => {
      const fourteenHoursAgo = new Date(Date.now() - 14 * 60 * 60 * 1000);

      await Attendance.create({
        gymId: new mongoose.Types.ObjectId(gymId),
        branchId: new mongoose.Types.ObjectId(branchId),
        memberId: new mongoose.Types.ObjectId(memberDocId),
        checkInAt: fourteenHoursAgo,
        status: AttendanceStatus.CHECKED_IN,
        dayKey: getDayKeyForBranch(fourteenHoursAgo, 'Asia/Kolkata'),
      });

      const count = await AttendanceService.autoCloseStaleSessions(12);
      expect(count).toBe(1);
    });
  });
});
