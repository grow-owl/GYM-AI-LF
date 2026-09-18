import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import app from '../../src/app';
import { User } from '../../src/modules/user/user.model';
import { Gym } from '../../src/modules/gym/gym.model';
import { Branch } from '../../src/modules/gym/branch.model';
import { OwnerGymAccess } from '../../src/modules/gym/ownerGymAccess.model';
import { GymService } from '../../src/modules/gym/gym.service';
import { Role } from '../../src/common/constants/roles.enum';
import { GymPlan, GymStatus } from '../../src/modules/gym/gym.types';
import { generateAccessToken } from '../../src/common/utils/generateTokens';

let mongoServer: MongoMemoryServer;
let ownerToken: string;
let ownerId: string;

describe('Gym & Branch Module Integration Tests', () => {
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
    await OwnerGymAccess.deleteMany({});

    // Create an owner user for tests
    const owner = await User.create({
      fullName: 'Gym Owner',
      email: 'owner@gym.com',
      phone: '9876543210',
      password: 'Password123',
      role: Role.GYM_OWNER,
      isActive: true,
    });
    ownerId = owner._id.toString();

    ownerToken = generateAccessToken({
      id: ownerId,
      role: Role.GYM_OWNER,
    });
  });

  describe('POST /api/v1/gyms', () => {
    it('should create a Gym, provision Main Branch, set OwnerGymAccess and trial date', async () => {
      const res = await request(app)
        .post('/api/v1/gyms')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          name: 'PowerHouse Gym',
          billingEmail: 'billing@powerhouse.com',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.gym.name).toBe('PowerHouse Gym');
      expect(res.body.data.gym.plan).toBe(GymPlan.TRIAL);
      expect(res.body.data.defaultBranch.name).toBe('Main Branch');

      const access = await OwnerGymAccess.findOne({ ownerId, gymId: res.body.data.gym._id });
      expect(access).toBeDefined();
    });
  });

  describe('Branch Creation & Plan Limit Enforcement', () => {
    it('should enforce BASIC plan limit (max 1 branch)', async () => {
      // 1. Create Gym
      const createRes = await request(app)
        .post('/api/v1/gyms')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          name: 'Basic Gym',
          billingEmail: 'basic@gym.com',
        });
      const gymId = createRes.body.data.gym._id;

      // Update plan to BASIC (allows max 1 branch)
      await GymService.updateGymPlan(gymId, GymPlan.BASIC);

      // Main Branch is already created (1 branch count)
      // Attempting to create a 2nd branch on BASIC plan should fail with 409 Conflict
      const branchRes = await request(app)
        .post(`/api/v1/gyms/${gymId}/branches`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          name: 'Second Branch',
          address: {
            line1: '123 Street',
            city: 'Metro',
            state: 'State',
            pincode: '110001',
            country: 'Country',
          },
          contactPhone: '9998887776',
          timezone: 'Asia/Kolkata',
        });

      expect(branchRes.status).toBe(409);
      expect(branchRes.body.error.message).toContain('Branch creation limit reached');
    });

    it('should allow multiple branches on PRO plan and flip isMultiBranch to true', async () => {
      // 1. Create Gym on PRO plan
      const createRes = await request(app)
        .post('/api/v1/gyms')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          name: 'Pro Chain Gym',
          billingEmail: 'pro@gym.com',
          plan: GymPlan.PRO,
        });
      const gymId = createRes.body.data.gym._id;

      // 2. Create 2nd Branch
      const branchRes = await request(app)
        .post(`/api/v1/gyms/${gymId}/branches`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          name: 'East Branch',
          address: {
            line1: 'East St',
            city: 'Metro',
            state: 'State',
            pincode: '110002',
            country: 'Country',
          },
          contactPhone: '9998887777',
          timezone: 'Asia/Kolkata',
        });

      expect(branchRes.status).toBe(201);
      expect(branchRes.body.data.branch.name).toBe('East Branch');

      const gym = await GymService.getGymById(gymId);
      expect(gym.isMultiBranch).toBe(true);
    });
  });

  describe('Plan Downgrade Validation', () => {
    it('should block plan downgrade if current active branch count exceeds target plan limit', async () => {
      // Create Gym on PRO plan and add a 2nd branch
      const { gym } = await GymService.createGymForOwner(ownerId, {
        name: 'Pro Gym',
        billingEmail: 'pro@gym.com',
        plan: GymPlan.PRO,
      });

      await GymService.createBranch(
        gym._id.toString(),
        {
          name: 'Branch 2',
          address: { line1: 'L1', city: 'City', state: 'State', pincode: '000', country: 'Country' },
          contactPhone: '123',
        },
        ownerId,
        Role.GYM_OWNER
      );

      // Attempt downgrade to BASIC (max 1 branch permitted) while having 2 branches
      const downgradeRes = await request(app)
        .patch(`/api/v1/gyms/${gym._id}/plan`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ plan: GymPlan.BASIC });

      expect(downgradeRes.status).toBe(409);
      expect(downgradeRes.body.error.message).toContain('Cannot downgrade to plan');
    });
  });

  describe('Trial Expiry Routine', () => {
    it('should mark active trial gyms with past trialEndsAt as TRIAL_EXPIRED', async () => {
      // Create gym with trialEndsAt in the past
      const pastDate = new Date(Date.now() - 1000 * 60 * 60);
      const gym = await Gym.create({
        name: 'Expired Trial Gym',
        ownerId: new mongoose.Types.ObjectId(ownerId),
        billingEmail: 'expired@gym.com',
        plan: GymPlan.TRIAL,
        status: GymStatus.ACTIVE,
        trialEndsAt: pastDate,
      });

      const modifiedCount = await GymService.checkAndExpireTrials();
      expect(modifiedCount).toBe(1);

      const updatedGym = await Gym.findById(gym._id);
      expect(updatedGym?.status).toBe(GymStatus.TRIAL_EXPIRED);
    });
  });
});
