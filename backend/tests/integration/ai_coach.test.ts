import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import app from '../../src/app';
import { User } from '../../src/modules/user/user.model';
import { Gym } from '../../src/modules/gym/gym.model';
import { Branch } from '../../src/modules/gym/branch.model';
import { Member } from '../../src/modules/member/member.model';
import { Attendance } from '../../src/modules/attendance/attendance.model';
import { WorkoutLog } from '../../src/modules/workout/workoutLog.model';
import { WeightEntry } from '../../src/modules/progress/weightEntry.model';
import { AIReport } from '../../src/modules/aiCoach/aiReport.model';
import { AIConversation } from '../../src/modules/aiCoach/aiConversation.model';
import { AIChatMessage } from '../../src/modules/aiCoach/aiChatMessage.model';
import { MemberService } from '../../src/modules/member/member.service';
import { AIDataAggregatorService } from '../../src/modules/aiCoach/aiDataAggregator.service';
import { AIProviderFactory } from '../../src/modules/aiCoach/providers/aiProvider.factory';
import { AIReportType, AIProvider } from '../../src/modules/aiCoach/aiCoach.types';
import { Role } from '../../src/common/constants/roles.enum';
import { AttendanceStatus } from '../../src/modules/attendance/attendance.types';
import { generateAccessToken } from '../../src/common/utils/generateTokens';

import { DietPlan } from '../../src/modules/dietPlan/dietPlan.model';
import { DailyWellness } from '../../src/modules/progress/dailyWellness.model';
import { Product } from '../../src/modules/product/product.model';
import { ProgressPhoto } from '../../src/modules/progress/progressPhoto.model';
import { PlanStatus } from '../../src/modules/workout/workoutPlan.types';

let mongoServer: MongoMemoryServer;
let memberToken: string;
let memberDocId: string;
let memberUserId: string;
let gymId: string;
let branchId: string;

describe('AI Fitness Coach Module Integration Tests', () => {
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
    await WorkoutLog.deleteMany({});
    await WeightEntry.deleteMany({});
    await AIReport.deleteMany({});
    await AIConversation.deleteMany({});
    await AIChatMessage.deleteMany({});
    await DietPlan.deleteMany({});
    await DailyWellness.deleteMany({});
    await Product.deleteMany({});
    await ProgressPhoto.deleteMany({});

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

    // 2. Onboard Member
    const now = new Date();
    const nextMonth = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const member = await MemberService.createMember(gymId, branchId, {
      fullName: 'Member Bob',
      email: 'bob@member.com',
      phone: '9991112222',
      password: 'Password123',
      branchId,
      planName: 'Pro Plan',
      membershipStartDate: now,
      membershipEndDate: nextMonth,
      fitnessGoals: ['weight_loss', 'muscle_hypertrophy'],
      healthInfo: { targetWeight_kg: 75, currentWeight_kg: 85, injuries: ['Knee strain'] },
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

  describe('Data Aggregation & Deterministic Rules', () => {
    it('should return insufficientData guard when member history < 3 data points', async () => {
      const context = await AIDataAggregatorService.buildMemberContext(memberDocId);
      expect(context.insufficientData).toBe(true);
      expect(context.totalDataPoints).toBe(0);
    });

    it('should detect plateau deterministically when weight is flat despite high workout completion', () => {
      const weightTrend = [
        { date: '2026-07-31', weightKg: 85.0 },
        { date: '2026-07-24', weightKg: 85.1 },
        { date: '2026-07-17', weightKg: 85.2 },
      ];
      const result = AIDataAggregatorService.detectPlateau(weightTrend, 85);
      expect(result.plateauDetected).toBe(true);
      expect(result.reason).toBeDefined();
    });

    it('should detect injury risk deterministically when member has pre-existing injuries and high training intensity', () => {
      const result = AIDataAggregatorService.detectInjuryRisk(['Knee strain'], 95, []);
      expect(result.injuryRiskFlag).toBe(true);
      expect(result.reason).toContain('Knee strain');
    });
  });

  describe('AI Provider Abstraction & Failover', () => {
    it('should execute completion with automatic failover fallback', async () => {
      const { result, providerUsed } = await AIProviderFactory.executeWithFailover(
        'You are a fitness assistant.',
        'Give a tip on sleep hygiene.',
        { preferredProvider: AIProvider.OPENAI }
      );

      expect(result).toBeDefined();
      expect(providerUsed).toBe(AIProvider.OPENAI);
    });
  });

  describe('AI Coach Suggestions & Reports', () => {
    it('should return personalized suggestions endpoint response with medical disclaimer', async () => {
      const res = await request(app)
        .get(`/api/v1/ai/members/${memberDocId}/suggestions`)
        .set('Authorization', `Bearer ${memberToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.insights).toBeDefined();
      expect(res.body.data.recommendations).toBeDefined();
      expect(res.body.data.disclaimer).toContain('MEDICAL DISCLAIMER');
    });

    it('should generate a Weekly AI Report and store it in database', async () => {
      // Seed 3 data points
      await Attendance.create({
        gymId,
        branchId,
        memberId: memberDocId,
        checkInAt: new Date(),
        status: AttendanceStatus.CHECKED_OUT,
        dayKey: '2026-07-31',
      });
      await WeightEntry.create({
        gymId,
        memberId: memberDocId,
        weightKg: 85,
        dayKey: '2026-07-31',
      });
      await WeightEntry.create({
        gymId,
        memberId: memberDocId,
        weightKg: 84.5,
        dayKey: '2026-07-24',
      });

      const res = await request(app)
        .post(`/api/v1/ai/members/${memberDocId}/reports?type=WEEKLY`)
        .set('Authorization', `Bearer ${memberToken}`);

      expect(res.status).toBe(201);
      expect(res.body.data.report.type).toBe(AIReportType.WEEKLY);
      expect(res.body.data.report.summary).toBeDefined();

      const count = await AIReport.countDocuments({ memberId: memberDocId });
      expect(count).toBe(1);
    });

    it('should generate goal achievement prediction with confidence score', async () => {
      await WeightEntry.create({ gymId, memberId: memberDocId, weightKg: 86, dayKey: '2026-07-15' });
      await WeightEntry.create({ gymId, memberId: memberDocId, weightKg: 85, dayKey: '2026-07-22' });
      await WeightEntry.create({ gymId, memberId: memberDocId, weightKg: 84, dayKey: '2026-07-29' });

      const res = await request(app)
        .get(`/api/v1/ai/members/${memberDocId}/goal-prediction?goalType=target_weight`)
        .set('Authorization', `Bearer ${memberToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.prediction.confidence).toBeDefined();
      expect(res.body.data.prediction.basedOnDataPoints).toBe(3);
    });
  });

  describe('AI Chatbot Conversations', () => {
    it('should start conversation, send follow-up message, fetch history, and archive conversation', async () => {
      // 1. Start Conversation
      const startRes = await request(app)
        .post('/api/v1/ai/chat/conversations')
        .set('Authorization', `Bearer ${memberToken}`)
        .send({ firstMessage: 'What is the best way to warm up for squats?' });

      expect(startRes.status).toBe(201);
      expect(startRes.body.data.conversation.title).toContain('What is the best way to warm');
      expect(startRes.body.data.replyMessage.role).toBe('assistant');

      const conversationId = startRes.body.data.conversation._id;

      // 2. Send Follow-up Message
      const msgRes = await request(app)
        .post(`/api/v1/ai/chat/conversations/${conversationId}/messages`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send({ content: 'How long should I rest between heavy sets?' });

      expect(msgRes.status).toBe(200);
      expect(msgRes.body.data.replyMessage.role).toBe('assistant');

      // 3. Get Conversation History
      const historyRes = await request(app)
        .get(`/api/v1/ai/chat/conversations/${conversationId}/messages`)
        .set('Authorization', `Bearer ${memberToken}`);

      expect(historyRes.status).toBe(200);
      expect(historyRes.body.data.messages.length).toBe(4); // 2 user + 2 assistant messages

      // 4. Archive Conversation
      const archiveRes = await request(app)
        .patch(`/api/v1/ai/chat/conversations/${conversationId}/archive`)
        .set('Authorization', `Bearer ${memberToken}`);

      expect(archiveRes.status).toBe(200);
      expect(archiveRes.body.data.conversation.isArchived).toBe(true);
    });

    it('should include progress photo context in buildMemberContext', async () => {
      await ProgressPhoto.create({
        gymId,
        memberId: memberDocId,
        imageUrl: 'https://res.cloudinary.com/demo/image/upload/sample.jpg',
        angle: 'front',
        notes: 'Feeling leaner around the waist',
        recordedAt: new Date(),
        dayKey: '2026-08-01',
      });

      const context = await AIDataAggregatorService.buildMemberContext(memberDocId);
      expect(context.progressPhotos).toBeDefined();
      expect(context.progressPhotos?.totalCount).toBe(1);
      expect(context.progressPhotos?.anglesLogged).toContain('front');
      expect(context.progressPhotos?.recentPhotos[0].notes).toBe('Feeling leaner around the waist');
    });

    it('should enforce per-user daily message limit and inform user when limit is reached', async () => {
      // Seed 5 user messages today to reach the 5-message daily limit
      const conv = await AIConversation.create({
        userId: memberUserId,
        gymId,
        title: 'Limit Test',
        lastMessageAt: new Date(),
      });

      for (let i = 0; i < 5; i++) {
        await AIChatMessage.create({
          userId: memberUserId,
          gymId,
          conversationId: conv._id,
          role: 'user',
          content: `Question ${i + 1}`,
          createdAt: new Date(),
        });
      }

      // Sending the 6th message should trigger limit notice without calling Gemini
      const res = await request(app)
        .post(`/api/v1/ai/chat/conversations/${conv._id}/messages`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send({ content: 'One more question please!' });

      expect(res.status).toBe(200);
      expect(res.body.data.replyMessage.content).toContain('limit poora ho chuka hai');
    });

    it('should route chat strictly to Gemini and format honest responses', async () => {
      const result = await AIProviderFactory.executeChatWithGemini(
        [{ role: 'user', content: 'What is progressive overload?' }],
        'You are an AI Coach.'
      );

      expect(result.providerUsed).toBe(AIProvider.GEMINI);
      expect(result.reply).toBeDefined();
      expect(typeof result.reply).toBe('string');
    });
  });

  describe('AI Supplement & Personal Training Recommendations', () => {
    it('should return { eligible: false } when data is insufficient or no gap exists', async () => {
      const res = await request(app)
        .get(`/api/v1/ai/members/${memberDocId}/upsell-recommendation`)
        .set('Authorization', `Bearer ${memberToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.eligible).toBe(false);
    });

    it('should trigger supplement recommendation when member has muscle_gain goal and protein gap > 20%', async () => {
      // 1. Update member fitness goals to include muscle_gain
      await Member.findByIdAndUpdate(memberDocId, { fitnessGoals: ['muscle_gain'] });

      // 2. Create Diet Plan with target 150g protein
      await DietPlan.create({
        gymId,
        memberId: memberDocId,
        createdByTrainerId: new mongoose.Types.ObjectId(),
        title: 'High Protein Plan',
        dailyProteinTarget_g: 150,
        meals: [],
        startDate: new Date(),
        status: PlanStatus.ACTIVE,
      });

      // 3. Log Daily Wellness with low protein (e.g. 50g avg per day -> 66% gap)
      await DailyWellness.create({
        gymId,
        memberId: memberDocId,
        dayKey: '2026-08-01',
        meals: [{ mealType: 'lunch', description: 'Chicken Salad', protein_g: 50 }],
      });

      // 4. Create matching supplement product in gym
      await Product.create({
        gymId,
        name: 'Whey Protein Isolate 1kg',
        category: 'supplement',
        price: 2999,
        stockQuantity: 10,
        isActive: true,
      });

      const res = await request(app)
        .get(`/api/v1/ai/members/${memberDocId}/upsell-recommendation`)
        .set('Authorization', `Bearer ${memberToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.eligible).toBe(true);
      expect(res.body.data.signals.supplementEligible).toBe(true);
      expect(res.body.data.supplementRecommendation).toBeDefined();
      expect(res.body.data.supplementRecommendation.suggestedProducts.length).toBe(1);
      expect(res.body.data.medicalDisclaimer).toContain('IMPORTANT MEDICAL DISCLAIMER');
      expect(res.body.data.trainerNotice).toContain('Final decision on supplements or personal training is with your assigned trainer');
    });

    it('should trigger PT recommendation when member weight is stalled for 3+ weeks and has no assigned trainer', async () => {
      // Create weight entries spanning 25 days with flat weight (85kg)
      const now = Date.now();
      const dayMs = 24 * 60 * 60 * 1000;

      await WeightEntry.create({ gymId, memberId: memberDocId, weightKg: 85.0, recordedAt: new Date(now - 25 * dayMs), dayKey: '2026-07-05' });
      await WeightEntry.create({ gymId, memberId: memberDocId, weightKg: 85.1, recordedAt: new Date(now - 14 * dayMs), dayKey: '2026-07-16' });
      await WeightEntry.create({ gymId, memberId: memberDocId, weightKg: 85.0, recordedAt: new Date(now), dayKey: '2026-07-30' });

      const res = await request(app)
        .get(`/api/v1/ai/members/${memberDocId}/upsell-recommendation`)
        .set('Authorization', `Bearer ${memberToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.eligible).toBe(true);
      expect(res.body.data.signals.ptEligible).toBe(true);
      expect(res.body.data.ptRecommendation).toBeDefined();
      expect(res.body.data.medicalDisclaimer).toContain('IMPORTANT MEDICAL DISCLAIMER');
      expect(res.body.data.trainerNotice).toContain('Final decision on supplements or personal training is with your assigned trainer — this is an AI-generated suggestion only.');
    });
  });
});

