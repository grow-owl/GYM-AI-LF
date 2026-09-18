import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import app from '../../src/app';
import { User } from '../../src/modules/user/user.model';
import { Gym } from '../../src/modules/gym/gym.model';
import { Branch } from '../../src/modules/gym/branch.model';
import { Member } from '../../src/modules/member/member.model';
import { Trainer } from '../../src/modules/trainer/trainer.model';
import { Exercise } from '../../src/modules/workout/exercise.model';
import { WorkoutPlan } from '../../src/modules/workout/workoutPlan.model';
import { WorkoutLog } from '../../src/modules/workout/workoutLog.model';
import { DietPlan } from '../../src/modules/dietPlan/dietPlan.model';
import { MemberService } from '../../src/modules/member/member.service';
import { ExerciseService } from '../../src/modules/workout/exercise.service';
import { Role } from '../../src/common/constants/roles.enum';
import { MuscleGroup } from '../../src/modules/workout/exercise.types';
import { PlanStatus } from '../../src/modules/workout/workoutPlan.types';
import { Attendance } from '../../src/modules/attendance/attendance.model';
import { AttendanceStatus } from '../../src/modules/attendance/attendance.types';
import { generateAccessToken } from '../../src/common/utils/generateTokens';

let mongoServer: MongoMemoryServer;
let superAdminToken: string;
let trainerToken: string;
let memberToken: string;
let trainerUserDocId: string;
let memberDocId: string;
let gymId: string;
let branchId: string;
let exercise1Id: string;
let exercise2Id: string;

describe('Workout & Diet Plan Module Integration Tests', () => {
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
    await Exercise.deleteMany({});
    await WorkoutPlan.deleteMany({});
    await WorkoutLog.deleteMany({});
    await DietPlan.deleteMany({});

    // 1. Create Super Admin
    const superAdmin = await User.create({
      fullName: 'Super Admin',
      email: 'admin@platform.com',
      phone: '0000000000',
      password: 'Password123',
      role: Role.SUPER_ADMIN,
      isActive: true,
    });
    superAdminToken = generateAccessToken({
      id: superAdmin._id.toString(),
      role: Role.SUPER_ADMIN,
    });

    // 2. Create Owner, Gym, Branch
    const owner = await User.create({
      fullName: 'Gym Owner',
      email: 'owner@gym.com',
      phone: '9876543210',
      password: 'Password123',
      role: Role.GYM_OWNER,
      isActive: true,
    });

    const gym = await Gym.create({
      name: 'Alpha Fitness',
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

    // 3. Create Trainer
    const trainerUser = await User.create({
      fullName: 'Coach Sam',
      email: 'sam@trainer.com',
      phone: '1112223333',
      password: 'Password123',
      role: Role.TRAINER,
      gymId: gym._id,
      branchId: branch._id,
      isActive: true,
    });
    trainerUserDocId = trainerUser._id.toString();

    const trainerDoc = await Trainer.create({
      userId: trainerUser._id,
      gymId: gym._id,
      branchId: branch._id,
      specializations: ['Strength Training'],
    });

    trainerToken = generateAccessToken({
      id: trainerUser._id.toString(),
      role: Role.TRAINER,
      gymId,
      branchId,
    });

    // 4. Onboard Member assigned to Coach Sam
    const now = new Date();
    const nextMonth = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const member = await MemberService.createMember(gymId, branchId, {
      fullName: 'Member Alice',
      email: 'alice@member.com',
      phone: '5556667777',
      password: 'Password123',
      branchId,
      assignedTrainerId: trainerDoc._id.toString(),
      planName: 'Gold Plan',
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

    // 5. Seed Exercise Library
    await ExerciseService.seedGlobalExerciseLibrary();

    const ex1 = await Exercise.findOne({ name: 'Barbell Bench Press' });
    const ex2 = await Exercise.findOne({ name: 'Lat Pulldown' });
    exercise1Id = ex1!._id.toString();
    exercise2Id = ex2!._id.toString();
  });

  describe('Exercise Library Management', () => {
    it('should allow SuperAdmin to trigger seed global library', async () => {
      const seedRes = await request(app)
        .post('/api/v1/exercises/seed-global')
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(seedRes.status).toBe(200);
      expect(seedRes.body.success).toBe(true);
    });

    it('should list merged global and gym-custom exercises', async () => {
      // Create a gym-custom exercise
      await request(app)
        .post('/api/v1/exercises')
        .set('Authorization', `Bearer ${trainerToken}`)
        .send({
          name: 'Custom TRX Row',
          muscleGroup: MuscleGroup.BACK,
          equipment: 'TRX Straps',
        });

      const res = await request(app)
        .get('/api/v1/exercises')
        .set('Authorization', `Bearer ${trainerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.exercises.length).toBeGreaterThanOrEqual(14);
    });
  });

  describe('Workout Plan Authoring & Duplication', () => {
    it('should allow assigned trainer to author a workout plan with exercise validation', async () => {
      const now = new Date();
      const nextMonth = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

      const res = await request(app)
        .post(`/api/v1/members/${memberDocId}/workout-plans`)
        .set('Authorization', `Bearer ${trainerToken}`)
        .send({
          title: 'Hypertrophy 4-Week Split',
          goal: 'muscle_gain',
          startDate: now.toISOString(),
          endDate: nextMonth.toISOString(),
          days: [
            {
              dayLabel: 'Day 1 - Upper Body',
              exercises: [
                {
                  exerciseId: exercise1Id,
                  order: 1,
                  targetSets: 4,
                  targetReps: 8,
                  targetWeightKg: 60,
                },
                {
                  exerciseId: exercise2Id,
                  order: 2,
                  targetSets: 3,
                  targetReps: 10,
                },
              ],
            },
          ],
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.plan.title).toBe('Hypertrophy 4-Week Split');
      expect(res.body.data.plan.status).toBe(PlanStatus.ACTIVE);
    });

    it('should duplicate an existing workout plan for a new cycle', async () => {
      const now = new Date();
      const plan = await WorkoutPlan.create({
        gymId: new mongoose.Types.ObjectId(gymId),
        branchId: new mongoose.Types.ObjectId(branchId),
        memberId: new mongoose.Types.ObjectId(memberDocId),
        createdByTrainerId: new mongoose.Types.ObjectId(trainerUserDocId),
        title: 'Strength Cycle 1',
        goal: 'strength',
        days: [
          {
            dayLabel: 'Day 1',
            exercises: [{ exerciseId: new mongoose.Types.ObjectId(exercise1Id), order: 1, targetSets: 5, targetReps: 5 }],
          },
        ],
        startDate: now,
        status: PlanStatus.ACTIVE,
      });

      const res = await request(app)
        .post(`/api/v1/workout-plans/${plan._id}/duplicate`)
        .set('Authorization', `Bearer ${trainerToken}`)
        .send({ startDate: new Date().toISOString() });

      expect(res.status).toBe(201);
      expect(res.body.data.plan.title).toContain('(New Cycle)');

      // Verify original was archived
      const archived = await WorkoutPlan.findById(plan._id);
      expect(archived?.status).toBe(PlanStatus.ARCHIVED);
    });
  });

  describe('In-Gym Workout Logging & Atomic Set Progress', () => {
    it('should start log, log set progress tap-by-tap, and complete workout session', async () => {
      const now = new Date();
      const plan = await WorkoutPlan.create({
        gymId: new mongoose.Types.ObjectId(gymId),
        branchId: new mongoose.Types.ObjectId(branchId),
        memberId: new mongoose.Types.ObjectId(memberDocId),
        createdByTrainerId: new mongoose.Types.ObjectId(trainerUserDocId),
        title: 'Push Pull Legs',
        goal: 'fitness',
        days: [
          {
            dayLabel: 'Day 1 - Push',
            exercises: [{ exerciseId: new mongoose.Types.ObjectId(exercise1Id), order: 1, targetSets: 3, targetReps: 10 }],
          },
        ],
        startDate: now,
        status: PlanStatus.ACTIVE,
      });

      // Check in member to satisfy in-gym check-in requirement
      await Attendance.create({
        gymId: new mongoose.Types.ObjectId(gymId),
        branchId: new mongoose.Types.ObjectId(branchId),
        memberId: new mongoose.Types.ObjectId(memberDocId),
        status: AttendanceStatus.CHECKED_IN,
        checkInAt: now,
        dayKey: now.toISOString().slice(0, 10),
      });

      // 1. Start Workout Log
      const startRes = await request(app)
        .post('/api/v1/workout-logs/start')
        .set('Authorization', `Bearer ${memberToken}`)
        .send({
          workoutPlanId: plan._id.toString(),
          dayLabel: 'Day 1 - Push',
        });

      expect(startRes.status).toBe(201);
      const logId = startRes.body.data.log._id;

      // 2. Log Set 1 Progress (with bodyweight 0 kg to verify non-negative support)
      const set1Res = await request(app)
        .patch(`/api/v1/workout-logs/${logId}/exercises/${exercise1Id}/sets/1`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send({ reps: 10, weightKg: 0, completed: true });

      expect(set1Res.status).toBe(200);
      expect(set1Res.body.data.log.exercises[0].sets[0].completed).toBe(true);
      expect(set1Res.body.data.log.exercises[0].sets[0].weightKg).toBe(0);

      // 3. Complete Exercise 1
      const completeExRes = await request(app)
        .patch(`/api/v1/workout-logs/${logId}/exercises/${exercise1Id}/complete`)
        .set('Authorization', `Bearer ${memberToken}`);

      expect(completeExRes.status).toBe(200);

      // 4. Complete Entire Workout Session
      const completeLogRes = await request(app)
        .patch(`/api/v1/workout-logs/${logId}/complete`)
        .set('Authorization', `Bearer ${memberToken}`);

      expect(completeLogRes.status).toBe(200);
      expect(completeLogRes.body.data.log.completedAt).toBeDefined();
    });
  });

  describe('Diet Plan Management', () => {
    it('should create and retrieve active Diet Plan for a member', async () => {
      const now = new Date();
      const res = await request(app)
        .post(`/api/v1/members/${memberDocId}/diet-plans`)
        .set('Authorization', `Bearer ${trainerToken}`)
        .send({
          title: 'High Protein Cut Diet',
          dailyCalorieTarget: 2200,
          dailyProteinTarget_g: 180,
          startDate: now.toISOString(),
          meals: [
            {
              mealType: 'breakfast',
              items: [{ name: 'Oatmeal & Eggs', quantity: '1 bowl + 4 whites', calories: 450, protein_g: 35 }],
            },
          ],
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.dietPlan.dailyProteinTarget_g).toBe(180);

      const activeRes = await request(app)
        .get(`/api/v1/members/${memberDocId}/diet-plans/active`)
        .set('Authorization', `Bearer ${memberToken}`);

      expect(activeRes.status).toBe(200);
      expect(activeRes.body.data.dietPlan.title).toBe('High Protein Cut Diet');
    });
  });
});
