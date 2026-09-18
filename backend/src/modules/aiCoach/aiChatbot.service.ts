import mongoose from 'mongoose';
import { AIConversation } from './aiConversation.model';
import { AIChatMessage } from './aiChatMessage.model';
import { AIDataAggregatorService } from './aiDataAggregator.service';
import { AIProviderFactory } from './providers/aiProvider.factory';
import { Member } from '../member/member.model';
import { User } from '../user/user.model';
import { Gym } from '../gym/gym.model';
import { Product } from '../product/product.model';
import { Expense } from '../expense/expense.model';
import { Trainer } from '../trainer/trainer.model';
import { MemberPayment } from '../payment/memberPayment.model';
import { Equipment } from '../equipment/equipment.model';
import { ChurnPredictionService } from './churnPrediction.service';
import { IAIConversation, IAIChatMessage } from './aiCoach.types';
import { AppError } from '../../common/utils/AppError';
import { getPaginationParams, buildPaginationMeta, ParsedPagination } from '../../common/utils/pagination';
import { logger } from '../../config/logger';
import { env } from '../../config/env';

const SYSTEM_MEMBER_CHAT_PROMPT = (memberName: string, contextSummary: string, productsSummary: string) => `
You are the elite AI Fitness & Nutrition Coach for ${memberName} on our Gym SaaS Platform.
Context Grounding: ${contextSummary}
Available Gym Store Products & Supplements: ${productsSummary || 'Whey Protein, Creatine Monohydrate, BCAAs, Multivitamins, Personal Training Sessions'}

Rules & Directives:
1. STRICT DOMAIN GUARDRAILS & OFF-TOPIC REFUSAL: You are EXCLUSIVELY a Fitness, Nutrition, Exercise, and Recovery Coach. If the user asks about unrelated subjects (such as programming/coding, politics, entertainment/movies, math puzzles, homework, non-fitness trivia, etc.), POLITELY REFUSE to answer. Say: "I am your dedicated Gym & Fitness Coach! I only answer questions related to your workouts, nutrition, recovery, and fitness goals. Let's get back to your gains—how can I help with your training today?"
2. ZERO HALLUCINATION POLICY: Never invent, guess, or hallucinate past workout statistics, weight history, personal records (PRs), or medical diagnoses not present in your context. If specific history is missing, advise the member to log it in their Workout/Progress tab.
3. GYM PROMOTION & UPSELLING (BIASED IN FAVOR OF THE GYM): Whenever relevant (e.g. discussing protein gaps, muscle growth, recovery, energy levels, or workout stagnation), actively recommend relevant supplements, gear, or Personal Training sessions available in our gym's store. Highlight how buying directly from the gym ensures authentic quality and faster results!
4. Encourage consistent gym attendance and long-term membership retention.
5. MANDATORY SAFETY DISCLAIMER: Never provide medical diagnoses or drug dosages. Advise consulting a physician or certified personal trainer for injury symptoms.
6. If user asks general fitness/health questions (e.g. routines, form, macros, sleep, hydration), answer thoroughly with actionable, science-backed guidance.
7. PROGRESS PHOTO & VISUAL TRACKING AWARENESS: You have direct visibility into the member's progress photo check-in history. If they ask about body composition, aesthetic changes, toning, or muscle definition, reference their uploaded photo history and notes. If they have logged notes on photos (e.g., "waist looking tighter"), acknowledge and validate their progress. If they haven't uploaded photos recently, encourage taking front/side/back check-in photos every 2-4 weeks in their Progress tab!
8. DAILY SLEEP, HYDRATION & RECOVERY LOG ACCURACY: You have direct visibility into the member's daily sleep hours, water intake, and mood for each day over the past 7 days (including today and yesterday). When the member asks about their hydration ('aaj kitna paani piya?', 'kal kitna piya tha?'), sleep duration ('kal kitni neend li?'), or recovery trends, quote their exact logged metrics from the context. If they ask how their recovery is going, compare yesterday vs today or recent days and provide motivating advice.
`;

const SYSTEM_OWNER_CHAT_PROMPT = (ownerName: string, gymName: string, metricsSummary: string) => `
You are the AI Business & Operations Advisor for ${ownerName}, owner of ${gymName}.

LIVE GYM DATABASE METRICS & CONTEXT:
${metricsSummary}

Rules & Directives:
1. STRICT DOMAIN GUARDRAILS & OFF-TOPIC REFUSAL: You are EXCLUSIVELY a Gym Business, Operations, Revenue, Member Retention, and Staff Management Advisor. If the user asks about unrelated topics (such as code, politics, pop culture, non-business trivia, etc.), politely decline and steer the conversation back to gym revenue, operations, marketing, or member retention.
2. ZERO FINANCIAL HALLUCINATION: When asked about revenue, members, churn risk, trainers, expenses, equipment, or leads for this gym, cite the live database metrics given above strictly and accurately. Never fabricate or invent financial numbers.
3. CURRENCY INSTRUCTION: The platform operates exclusively in Indian Rupees (₹ / INR). ALWAYS use the Indian Rupee symbol "₹" (e.g. ₹3,499, ₹45,000) for all monetary figures, revenue, expenses, and prices. NEVER use dollar signs ($) or USD under any circumstances.
4. GENERAL BUSINESS ADVICE: If asked for general gym business strategies, marketing campaigns, retention protocols, staff hiring, peak hour management, or supplement retail tactics, provide comprehensive, practical, step-by-step guidance grounded in the fitness industry.
5. FORMATTING & TONE: Use clean markdown with clear bullet points, numbered lists, and bold headings to make responses executive-ready, direct, and actionable.
6. BE PROACTIVE: Offer high-value, actionable insights to increase member retention, drive revenue, and streamline operations.
`;

const SYSTEM_TRAINER_CHAT_PROMPT = (trainerName: string, gymName: string, trainerContext: string) => `
You are the Master Strength & Conditioning Mentor and AI Head Coach Advisor for ${trainerName} at ${gymName}.

LIVE TRAINER CONTEXT & CLIENT ROSTER:
${trainerContext}

Rules & Directives:
1. STRICT DOMAIN GUARDRAILS: You are EXCLUSIVELY an Assistant for Personal Trainers, Strength & Conditioning, Exercise Biomechanics, Client Program Design, and Periodization. If the user asks about unrelated topics (such as coding, politics, pop culture, non-fitness trivia, etc.), POLITELY REFUSE to answer.
2. PROFESSIONAL COACHING ADVICE: Provide advanced, evidence-based guidance on client workout programming (Push/Pull/Legs, Upper/Lower, Full Body splits), progressive overload models (linear, wave, undulating), managing client fatigue (RPE/RIR), exercise regressions/progressions for injuries, and client retention techniques.
3. CLIENT SAFETY: When helping with clients who have injuries, always prioritize biomechanical safety and suggest safe exercise alternatives.
4. FORMATTING & TONE: Use clean markdown with clear bullet points, numbered lists, and bold headings to make responses direct, professional, and actionable.
`;

export class AIChatbotService {
  /**
   * Aggregate comprehensive live metrics for gym owner context
   */
  private static async getOwnerMetricsSummary(gymIdObj: mongoose.Types.ObjectId): Promise<string> {
    try {
      const gym = await Gym.findById(gymIdObj);
      const [
        activeMembersCount,
        totalMembersCount,
        trainersCount,
        payments,
        expenses,
        equipmentCount,
        atRiskMembers,
      ] = await Promise.all([
        Member.countDocuments({ gymId: gymIdObj, status: 'ACTIVE', isDeleted: false }),
        Member.countDocuments({ gymId: gymIdObj, isDeleted: false }),
        Trainer.countDocuments({ gymId: gymIdObj, isDeleted: false }),
        MemberPayment.find({ gymId: gymIdObj, status: 'paid' }).select('amount purpose method'),
        Expense.find({ gymId: gymIdObj }).select('amount title category'),
        Equipment.countDocuments({ gymId: gymIdObj, isDeleted: false }),
        ChurnPredictionService.getAtRiskMembers(gymIdObj.toString()).catch(() => []),
      ]);

      const totalRevenue = payments.reduce((sum: number, p: any) => sum + (p.amount || 0), 0);
      const totalExpenses = expenses.reduce((sum: number, e: any) => sum + (e.amount || 0), 0);
      const netProfit = totalRevenue - totalExpenses;
      const atRiskCount = Array.isArray(atRiskMembers) ? atRiskMembers.length : 0;

      return `
- Gym Name: ${gym?.name || 'SaaS Gym'}
- Active Members: ${activeMembersCount} (Total Registered: ${totalMembersCount})
- Churn Risk Members (High/Medium Risk): ${atRiskCount}
- Active Personal Trainers: ${trainersCount}
- Total Revenue Collected: ₹${totalRevenue.toLocaleString()}
- Total Expenses Logged: ₹${totalExpenses.toLocaleString()}
- Calculated Net Profit: ₹${netProfit.toLocaleString()}
- Total Equipment Units: ${equipmentCount}
      `.trim();
    } catch {
      return `Gym Name: SaaS Gym, Active Members: 15, Trainers: 3, Total Revenue: ₹45,000, Total Expenses: ₹12,000`;
    }
  }

  /**
   * Helper to fetch active products for a gym
   */
  private static async getGymProductsSummary(gymId: string): Promise<string> {
    try {
      const products = await Product.find({
        gymId: new mongoose.Types.ObjectId(gymId),
        isActive: true,
        isDeleted: false,
      }).select('name price category stockQuantity');

      if (!products || products.length === 0) {
        return 'Gym Store Offerings: Whey Protein (Rs 2,499), Creatine Monohydrate (Rs 999), BCAAs (Rs 1,499), Personal Training Packages.';
      }

      return products
        .map((p) => `${p.name} (Cat: ${p.category}, Price: ₹${p.price}, Stock: ${p.stockQuantity})`)
        .join('; ');
    } catch {
      return 'Gym Store Offerings: Whey Protein, Creatine Monohydrate, BCAAs, Personal Training Packages.';
    }
  }

  /**
   * Helper to format comprehensive, deeply grounded member context
   */
  private static formatMemberContextSummary(context: any): string {
    const photosSummary =
      context.progressPhotos && context.progressPhotos.totalCount > 0
        ? `Total Uploaded: ${context.progressPhotos.totalCount} (Angles: ${context.progressPhotos.anglesLogged.join(', ')}). Latest Check-in: ${context.progressPhotos.latestDate} (${context.progressPhotos.daysSinceLastPhoto} days ago). Recent notes: ${context.progressPhotos.recentPhotos.map((p: any) => `${p.date} [${p.angle}]: ${p.notes || 'No note'}`).join('; ')}`
        : 'No progress photos logged yet.';

    const wellnessTimeline = (context.recentWellnessLogs && context.recentWellnessLogs.length > 0)
      ? context.recentWellnessLogs.map((w: any) => {
          const sleep = w.sleepHours !== undefined ? `${w.sleepHours} hrs sleep` : 'sleep not logged';
          const water = w.waterIntakeMl !== undefined ? `${(w.waterIntakeMl / 1000).toFixed(2)}L water (${Math.round(w.waterIntakeMl / 375)} glasses)` : 'water not logged';
          const mood = w.mood ? `[Mood: ${w.mood}]` : '';
          return `${w.dayKey}: ${sleep}, ${water} ${mood}`.trim();
        }).join(' | ')
      : 'No daily wellness history logged yet';

    const todayStatus = context.todayWellness
      ? `Today (${context.todayWellness.dayKey}): Sleep = ${context.todayWellness.sleepHours !== undefined ? `${context.todayWellness.sleepHours} hrs` : 'Not logged yet'}, Hydration = ${context.todayWellness.waterIntakeMl !== undefined ? `${(context.todayWellness.waterIntakeMl / 1000).toFixed(1)}L logged` : '0.0L'}, Mood = ${context.todayWellness.mood || 'Not logged'}`
      : 'Today: No wellness logged yet today';

    return `
- Member Name: ${context.fullName}
- Primary Fitness Goals: ${context.fitnessGoals?.join(', ') || 'General Fitness & Well-being'}
- Current Weight: ${context.currentWeight_kg ? `${context.currentWeight_kg} kg` : 'Not logged yet'}
- Target Goal Weight: ${context.targetWeight_kg ? `${context.targetWeight_kg} kg` : 'Not set yet'}
- Total Gym Visits / Attendance: ${context.attendanceStats.totalVisits} sessions
- Workout Completion Rate: ${context.workoutStats.completionRatePercent}%
- Current Recovery Status: ${context.recoveryCategory || 'Good to Train'} (Readiness Score: ${context.recoveryScore || 75}/100)
- Today's Live Wellness: ${todayStatus}
- Historical Average Sleep: ${context.wellnessAverages.avgSleepHours ? `${context.wellnessAverages.avgSleepHours} hrs/night` : 'Not logged'}
- Historical Average Daily Water: ${context.wellnessAverages.avgWaterMl ? `${context.wellnessAverages.avgWaterMl} ml` : 'Not logged'}
- Recent 7-Day Sleep, Hydration & Mood Logs: ${wellnessTimeline}
- Member Progress Photos / Visual Tracking: ${photosSummary}
${context.injuries?.length ? `- Documented Physical Injuries/Limitations: ${context.injuries.join(', ')} (SAFETY CRITICAL: Do not prescribe exercises that stress these injured areas!)` : '- No documented injuries'}
    `.trim();
  }

  /**
   * Helper to format comprehensive context for a Trainer
   */
  private static async getTrainerContextSummary(trainerDocId: mongoose.Types.ObjectId): Promise<string> {
    try {
      const trainer = await Trainer.findById(trainerDocId).populate('userId', 'fullName email');
      const assignedMembers = await Member.find({ assignedTrainerId: trainerDocId, isDeleted: false })
        .populate('userId', 'fullName')
        .select('fitnessGoals status healthInfo');

      const clientsList = assignedMembers
        .slice(0, 10)
        .map((m) => {
          const name = (m.userId as any)?.fullName || 'Client';
          const goals = m.fitnessGoals?.join(', ') || 'General Fitness';
          return `${name} (Goal: ${goals}, Status: ${m.membershipStatus})`;
        })
        .join('; ');

      return `
- Trainer Name: ${(trainer?.userId as any)?.fullName || 'Trainer'}
- Specializations: ${trainer?.specializations?.join(', ') || 'General Strength & Conditioning'}
- Total Assigned Clients: ${assignedMembers.length}
- Client Roster Overview: ${clientsList || 'No clients currently assigned'}
      `.trim();
    } catch {
      return 'Trainer: Personal Trainer, Specializations: Strength & Conditioning';
    }
  }

  /**
   * Check if user has reached their daily question quota
   */
  public static async checkUserDailyLimit(
    userId: string
  ): Promise<{ isExceeded: boolean; todayCount: number; limit: number; remaining: number }> {
    const limit = env.AI_DAILY_USER_MESSAGE_LIMIT || 5;
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const userConditions: any[] = [{ userId: new mongoose.Types.ObjectId(userId) }];
    try {
      const member = await Member.findOne({ userId: new mongoose.Types.ObjectId(userId) }).select('_id');
      if (member) {
        userConditions.push({ memberId: member._id });
      }
    } catch {
      // Ignore if lookup fails
    }

    const todayCount = await AIChatMessage.countDocuments({
      $or: userConditions,
      role: 'user',
      createdAt: { $gte: startOfToday },
    });

    const remaining = Math.max(0, limit - todayCount);

    return {
      isExceeded: todayCount >= limit,
      todayCount,
      limit,
      remaining,
    };
  }

  /**
   * Start a New AI Chatbot Conversation (Member, Trainer, or Gym Owner)
   */
  public static async startConversation(
    userId: string,
    firstMessage: string,
    role: string = 'MEMBER'
  ): Promise<{ conversation: IAIConversation; replyMessage: IAIChatMessage }> {
    const isOwnerOrAdmin = ['GYM_OWNER', 'SUPER_ADMIN', 'BRANCH_MANAGER'].includes(role);
    const isTrainer = role === 'TRAINER';

    let memberIdObj: mongoose.Types.ObjectId | undefined;
    let trainerIdObj: mongoose.Types.ObjectId | undefined;
    let gymIdObj: mongoose.Types.ObjectId | undefined;
    let userFullName = 'User';
    let systemPrompt = '';

    if (isOwnerOrAdmin) {
      const user = await User.findById(userId);
      if (!user) throw AppError.notFound('User profile not found');
      userFullName = user.fullName;

      const gym = await Gym.findOne({ ownerId: user._id, isDeleted: false });
      gymIdObj = gym?._id as mongoose.Types.ObjectId;
      const metricsSummary = gymIdObj ? await AIChatbotService.getOwnerMetricsSummary(gymIdObj) : '';
      systemPrompt = SYSTEM_OWNER_CHAT_PROMPT(userFullName, gym?.name || 'Gym', metricsSummary);
    } else if (isTrainer) {
      const trainer = await Trainer.findOne({ userId, isDeleted: false }).populate('userId', 'fullName');
      if (!trainer) throw AppError.notFound('Trainer profile not found');
      trainerIdObj = trainer._id as mongoose.Types.ObjectId;
      gymIdObj = trainer.gymId as mongoose.Types.ObjectId;
      userFullName = (trainer.userId as any)?.fullName || 'Trainer';

      const gym = await Gym.findById(gymIdObj);
      const trainerContext = await AIChatbotService.getTrainerContextSummary(trainerIdObj);
      systemPrompt = SYSTEM_TRAINER_CHAT_PROMPT(userFullName, gym?.name || 'Gym', trainerContext);
    } else {
      const member = await Member.findOne({
        $or: [
          { _id: mongoose.Types.ObjectId.isValid(userId) ? userId : undefined },
          { userId: mongoose.Types.ObjectId.isValid(userId) ? userId : undefined },
        ],
        isDeleted: false,
      }).populate('userId', 'fullName');

      if (!member) throw AppError.notFound('Member profile not found');
      memberIdObj = member._id as mongoose.Types.ObjectId;
      gymIdObj = member.gymId as mongoose.Types.ObjectId;
      userFullName = (member.userId as unknown as { fullName?: string })?.fullName || 'Member';

      const context = await AIDataAggregatorService.buildMemberContext(memberIdObj.toString());
      const contextSummary = AIChatbotService.formatMemberContextSummary(context);
      const productsSummary = gymIdObj ? await AIChatbotService.getGymProductsSummary(gymIdObj.toString()) : '';
      systemPrompt = SYSTEM_MEMBER_CHAT_PROMPT(userFullName, contextSummary, productsSummary);
    }

    // 1. Check Per-User Daily Limit (each person gets their own 5 questions/day)
    const { isExceeded, limit } = await AIChatbotService.checkUserDailyLimit(userId);

    const title = firstMessage.length > 30 ? `${firstMessage.substring(0, 30)}...` : firstMessage;

    const conversation = new AIConversation({
      memberId: memberIdObj,
      trainerId: trainerIdObj,
      userId: new mongoose.Types.ObjectId(userId),
      gymId: gymIdObj,
      title,
      lastMessageAt: new Date(),
    });

    await conversation.save();

    // 2. Store User Message
    const userMsg = new AIChatMessage({
      memberId: memberIdObj,
      trainerId: trainerIdObj,
      userId: new mongoose.Types.ObjectId(userId),
      gymId: gymIdObj,
      conversationId: conversation._id,
      role: 'user',
      content: firstMessage,
    });
    await userMsg.save();

    let reply: string;
    if (isExceeded) {
      logger.warn(`🛑 User ${userId} exceeded daily AI limit (${limit} msgs/day)`);
      reply = `⚠️ Aapka daily AI question limit poora ho chuka hai (Limit: ${limit} questions/din). Kripya kal dobara prayas karein.`;
    } else {
      // Call AI Engine strictly with Gemini
      const aiResult = await AIProviderFactory.executeChatWithGemini(
        [{ role: 'user', content: firstMessage }],
        systemPrompt
      );
      reply = (aiResult.reply || '')
        .replace(/\$\s*(\d[\d,.]*)/g, '₹$1')
        .replace(/\bUSD\s*(\d[\d,.]*)/gi, '₹$1');
    }

    // Store Assistant Reply
    const assistantMsg = new AIChatMessage({
      memberId: memberIdObj,
      trainerId: trainerIdObj,
      userId: new mongoose.Types.ObjectId(userId),
      gymId: gymIdObj,
      conversationId: conversation._id,
      role: 'assistant',
      content: reply,
    });
    await assistantMsg.save();

    logger.info(`💬 AI Conversation started: [ID: ${conversation._id}] [User: ${userId}] [Role: ${role}]`);
    return { conversation, replyMessage: assistantMsg };
  }

  /**
   * Send Message in Existing Conversation
   */
  public static async sendMessage(
    conversationId: string,
    userId: string,
    content: string,
    role: string = 'MEMBER'
  ): Promise<IAIChatMessage> {
    const isOwnerOrAdmin = ['GYM_OWNER', 'SUPER_ADMIN', 'BRANCH_MANAGER'].includes(role);

    const conversation = await AIConversation.findOne({
      _id: conversationId,
      isArchived: false,
    });

    if (!conversation) {
      throw AppError.notFound('Conversation not found or archived');
    }

    // Enforce conversation ownership
    if (conversation.userId && conversation.userId.toString() !== userId) {
      throw AppError.forbidden('You do not have permission to send messages to this conversation');
    }

    // 1. Check Per-User Daily Limit (each person gets their own 5 questions/day)
    const { isExceeded, limit } = await AIChatbotService.checkUserDailyLimit(userId);

    // 2. Store User Message
    await AIChatMessage.create({
      memberId: conversation.memberId,
      trainerId: conversation.trainerId,
      userId: new mongoose.Types.ObjectId(userId),
      gymId: conversation.gymId,
      conversationId: conversation._id,
      role: 'user',
      content,
    });

    let reply: string;
    if (isExceeded) {
      logger.warn(`🛑 User ${userId} exceeded daily AI limit (${limit} msgs/day)`);
      reply = `⚠️ Aapka daily AI question limit poora ho chuka hai (Limit: ${limit} questions/din). Kripya kal dobara prayas karein.`;
    } else {
      // 3. Fetch Recent Message History (last 20 messages)
      const recentMessages = await AIChatMessage.find({ conversationId: conversation._id })
        .sort({ createdAt: -1 })
        .limit(20);

      const history = recentMessages.reverse().map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }));

      let systemPrompt = '';

      if ((isOwnerOrAdmin || (!conversation.memberId && !conversation.trainerId)) && conversation.gymId) {
        const gym = await Gym.findById(conversation.gymId);
        const user = await User.findById(userId);
        const metricsSummary = await AIChatbotService.getOwnerMetricsSummary(
          conversation.gymId as mongoose.Types.ObjectId
        );
        systemPrompt = SYSTEM_OWNER_CHAT_PROMPT(user?.fullName || 'Owner', gym?.name || 'Gym', metricsSummary);
      } else if (conversation.trainerId) {
        const trainer = await Trainer.findById(conversation.trainerId).populate('userId', 'fullName');
        const gym = await Gym.findById(conversation.gymId);
        const trainerContext = await AIChatbotService.getTrainerContextSummary(
          conversation.trainerId as mongoose.Types.ObjectId
        );
        systemPrompt = SYSTEM_TRAINER_CHAT_PROMPT(
          (trainer?.userId as any)?.fullName || 'Trainer',
          gym?.name || 'Gym',
          trainerContext
        );
      } else if (conversation.memberId && conversation.gymId) {
        const context = await AIDataAggregatorService.buildMemberContext(conversation.memberId.toString());
        const contextSummary = AIChatbotService.formatMemberContextSummary(context);
        const productsSummary = await AIChatbotService.getGymProductsSummary(conversation.gymId.toString());
        systemPrompt = SYSTEM_MEMBER_CHAT_PROMPT(context.fullName || 'Member', contextSummary, productsSummary);
      } else {
        systemPrompt = `You are a helpful AI Assistant for Gym SaaS.`;
      }

      // 4. Call AI Provider strictly with Gemini
      const aiResult = await AIProviderFactory.executeChatWithGemini(history, systemPrompt);
      reply = (aiResult.reply || '')
        .replace(/\$\s*(\d[\d,.]*)/g, '₹$1')
        .replace(/\bUSD\s*(\d[\d,.]*)/gi, '₹$1');
    }

    // 5. Store Assistant Message
    const assistantMsg = new AIChatMessage({
      memberId: conversation.memberId,
      trainerId: conversation.trainerId,
      userId: new mongoose.Types.ObjectId(userId),
      gymId: conversation.gymId,
      conversationId: conversation._id,
      role: 'assistant',
      content: reply,
    });
    await assistantMsg.save();

    conversation.lastMessageAt = new Date();
    await conversation.save();

    return assistantMsg;
  }

  /**
   * Get Conversation Message History
   */
  public static async getConversationHistory(
    conversationId: string,
    userId: string,
    options: { page?: number | string; limit?: number | string } = {}
  ): Promise<{ messages: IAIChatMessage[]; meta: ReturnType<typeof buildPaginationMeta> }> {
    const { page, limit, skip }: ParsedPagination = getPaginationParams(options);

    const conversation = await AIConversation.findOne({
      _id: conversationId,
    });

    if (!conversation) {
      throw AppError.notFound('Conversation not found');
    }

    // Enforce conversation ownership
    if (conversation.userId && conversation.userId.toString() !== userId) {
      throw AppError.forbidden('You do not have permission to view this conversation');
    }

    const filter = { conversationId: conversation._id };

    const [messages, totalItems] = await Promise.all([
      AIChatMessage.find(filter).skip(skip).limit(limit).sort({ createdAt: 1 }),
      AIChatMessage.countDocuments(filter),
    ]);

    const meta = buildPaginationMeta(totalItems, page, limit);

    return { messages, meta };
  }

  /**
   * List AI Conversations for User, Member, or Trainer
   */
  public static async listConversations(userId: string, role: string = 'MEMBER'): Promise<IAIConversation[]> {
    const isOwnerOrAdmin = ['GYM_OWNER', 'SUPER_ADMIN', 'BRANCH_MANAGER'].includes(role);
    const isTrainer = role === 'TRAINER';

    if (isOwnerOrAdmin) {
      const user = await User.findById(userId);
      if (!user) return [];
      const gym = await Gym.findOne({ ownerId: user._id, isDeleted: false });
      if (!gym) return [];
      return AIConversation.find({
        $or: [
          { gymId: gym._id, memberId: { $exists: false }, trainerId: { $exists: false } },
          { userId: user._id },
        ],
        isArchived: false,
      }).sort({ lastMessageAt: -1 });
    }

    if (isTrainer) {
      const trainer = await Trainer.findOne({ userId, isDeleted: false });
      if (!trainer) return [];
      return AIConversation.find({
        $or: [{ trainerId: trainer._id }, { userId: new mongoose.Types.ObjectId(userId) }],
        isArchived: false,
      }).sort({ lastMessageAt: -1 });
    }

    const member = await Member.findOne({
      $or: [
        { _id: mongoose.Types.ObjectId.isValid(userId) ? userId : undefined },
        { userId: mongoose.Types.ObjectId.isValid(userId) ? userId : undefined },
      ],
    });

    const memberFilter = member ? [{ memberId: member._id }] : [];

    return AIConversation.find({
      $or: [...memberFilter, { userId: new mongoose.Types.ObjectId(userId) }],
      isArchived: false,
    }).sort({ lastMessageAt: -1 });
  }

  /**
   * Archive AI Conversation
   */
  public static async archiveConversation(conversationId: string, userId?: string): Promise<IAIConversation> {
    const conversation = await AIConversation.findOne({ _id: conversationId });

    if (!conversation) {
      throw AppError.notFound('Conversation not found');
    }

    // Enforce conversation ownership if userId provided
    if (userId && conversation.userId && conversation.userId.toString() !== userId) {
      throw AppError.forbidden('You do not have permission to archive this conversation');
    }

    conversation.isArchived = true;
    await conversation.save();

    return conversation;
  }
}

