import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { User } from '../../src/modules/user/user.model';
import { Gym } from '../../src/modules/gym/gym.model';
import { Branch } from '../../src/modules/gym/branch.model';
import { Member } from '../../src/modules/member/member.model';
import { Trainer } from '../../src/modules/trainer/trainer.model';
import { Notification } from '../../src/modules/notification/notification.model';
import { MembershipReminderLog } from '../../src/jobs/membershipReminderLog.model';
import { BirthdayReminderLog } from '../../src/jobs/birthdayReminderLog.model';
import { AuthService } from '../../src/modules/auth/auth.service';
import { MemberService } from '../../src/modules/member/member.service';
import { MembershipReminderJob } from '../../src/jobs/membershipReminder.job';
import { BirthdayReminderJob } from '../../src/jobs/birthdayReminder.job';
import { Role } from '../../src/common/constants/roles.enum';
import { MembershipStatus } from '../../src/modules/member/member.types';
import { NotificationType } from '../../src/modules/notification/notification.types';

let mongoServer: MongoMemoryServer;
let gymId: string;
let branchId: string;
let referrerMemberId: string;
let referralCode: string;

describe('Bug Fixes Verification Suite', () => {
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
    await Notification.deleteMany({});
    await MembershipReminderLog.deleteMany({});
    await BirthdayReminderLog.deleteMany({});

    // Create Gym, Branch and Referrer Member
    const owner = await User.create({
      fullName: 'Gym Owner',
      email: 'owner@bugfixes.com',
      password: 'password123',
      role: Role.GYM_OWNER,
      phone: '+919876543210',
    });

    const gym = await Gym.create({
      name: 'Titan Fitness',
      ownerId: owner._id,
      slug: 'titan-fitness-bugs',
      billingEmail: 'titan@bugs.com',
    });
    gymId = gym._id.toString();

    const branch = await Branch.create({
      gymId: gym._id,
      name: 'Main Branch',
      code: 'MB-01',
      address: { line1: '1 Main St', city: 'Delhi', state: 'DL', pincode: '110001', country: 'India' },
      contactPhone: '+919876543210',
    });
    branchId = branch._id.toString();

    const referrer = await MemberService.createMember(gymId, branchId, {
      fullName: 'Referrer Member',
      email: 'referrer@bugfixes.com',
      phone: '+919876543999',
      planName: 'Gold Plan',
      membershipStartDate: new Date(),
      membershipEndDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      referralCode: 'REF-BUGFIX1',
    });
    referrerMemberId = referrer._id.toString();
    referralCode = 'REF-BUGFIX1';
  });


  it('BUG 1: Self-registration with a referralCode resolves and sets referredByMemberId on User', async () => {
    const { user } = await AuthService.registerUser({
      fullName: 'Self Registered Member',
      email: 'selfreg@gmail.com',
      phone: '+919876543222',
      password: 'Password123',
      role: Role.MEMBER,
      referralCode: referralCode,
    });

    expect(user.referredByMemberId?.toString()).toBe(referrerMemberId);
  });

  it('BUG 2: Renewal discount offer is sent ONLY ONCE per expiry cycle across 5 daily job runs', async () => {
    // Expire member 4 days ago
    const fourDaysAgo = new Date(Date.now() - 4 * 24 * 60 * 60 * 1000);
    await Member.findByIdAndUpdate(referrerMemberId, {
      membershipEndDate: fourDaysAgo,
      membershipStatus: MembershipStatus.EXPIRED,
    });

    // Run job 5 consecutive times (simulating 5 days)
    for (let day = 1; day <= 5; day++) {
      await MembershipReminderJob.runReminders(gymId);
    }

    const offerLogs = await MembershipReminderLog.find({
      memberId: referrerMemberId,
      tier: 'RENEWAL_OFFER',
    });

    expect(offerLogs.length).toBe(1);
  });

  it('BUG 3: Feb 29 birthday member receives wish when job runs on Feb 28 of a non-leap year', async () => {
    // Onboard member born Feb 29, 2000
    const leapDayDob = new Date('2000-02-29T12:00:00Z');
    const leapMember = await MemberService.createMember(gymId, branchId, {
      fullName: 'Leap Year Baby',
      email: 'leapbaby@gmail.com',
      phone: '+919876543888',
      planName: 'Gold Plan',
      membershipStartDate: new Date(),
      membershipEndDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      dateOfBirth: leapDayDob,
    });

    // Mock system Date to Feb 28, 2025 (non-leap year)
    const RealDate = global.Date;
    const fakeFeb28 = new Date('2025-02-28T12:00:00Z');
    
    // @ts-ignore
    global.Date = class extends RealDate {
      constructor(...args: any[]) {
        if (args.length > 0) {
          // @ts-ignore
          super(...args);
        } else {
          super(fakeFeb28.getTime());
        }
      }
      static now() {
        return fakeFeb28.getTime();
      }
    };

    try {
      const res = await BirthdayReminderJob.runBirthdayWishes(gymId);
      expect(res.wishesSent).toBeGreaterThanOrEqual(1);

      const bdayLog = await BirthdayReminderLog.findOne({
        memberId: leapMember._id.toString(),
      });
      expect(bdayLog).toBeDefined();
    } finally {
      global.Date = RealDate;
    }
  });

  it('BUG 4: Trainer assignment uses NEW_MEMBER_ASSIGNED notification type with member full name', async () => {
    const trainerUser = await User.create({
      fullName: 'Coach John',
      email: 'coachjohn@bugfixes.com',
      password: 'password123',
      role: Role.TRAINER,
      phone: '+919876543777',
      gymId,
      branchId,
    });

    const trainer = await Trainer.create({
      userId: trainerUser._id,
      gymId,
      branchId,
      specializations: ['Strength'],
      experienceYears: 5,
    });

    await MemberService.createMember(gymId, branchId, {
      fullName: 'Bob Trainee',
      email: 'bobtrainee@gmail.com',
      phone: '+919876543666',
      planName: 'Gold Plan',
      membershipStartDate: new Date(),
      membershipEndDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      assignedTrainerId: trainer._id.toString(),
    });

    const notif = await Notification.findOne({
      userId: trainerUser._id,
      type: NotificationType.NEW_MEMBER_ASSIGNED,
    });

    expect(notif).toBeDefined();
    expect(notif?.title).toBe('👤 New Member Assigned');
    expect(notif?.body).toContain('Bob Trainee');
  });
});
