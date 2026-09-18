import { Request, Response } from 'express';
import { AICoachService } from './aiCoach.service';
import { AIChatbotService } from './aiChatbot.service';
import { ChurnPredictionService } from './churnPrediction.service';
import { OwnerInsightsService } from './ownerInsights.service';
import { SupplementPTRecommendationService } from './supplementPTRecommendation.service';
import { AIDataAggregatorService } from './aiDataAggregator.service';
import { AIReport } from './aiReport.model';
import { AIReportType } from './aiCoach.types';
import { sendSuccess } from '../../common/utils/ApiResponse';
import { asyncHandler } from '../../common/utils/asyncHandler';

function resolveTargetMemberId(req: Request): string {
  const param = req.params.memberId;
  if (!param || param === 'me') {
    return req.user!.id;
  }
  return param;
}

export class AICoachController {
  public static getSuggestions = asyncHandler(async (req: Request, res: Response) => {
    const memberId = resolveTargetMemberId(req);
    const suggestions = await AICoachService.generatePersonalizedSuggestions(memberId);
    return sendSuccess(res, suggestions, 'Personalized AI suggestions generated successfully');
  });

  public static getDietRecommendation = asyncHandler(async (req: Request, res: Response) => {
    const memberId = resolveTargetMemberId(req);
    const dietRec = await AICoachService.generateDietRecommendation(memberId);
    return sendSuccess(res, dietRec, 'AI diet recommendation generated successfully');
  });

  public static getReports = asyncHandler(async (req: Request, res: Response) => {
    const memberId = resolveTargetMemberId(req);
    const type = (req.query.type as AIReportType) || AIReportType.WEEKLY;

    const reports = await AIReport.find({ memberId, type }).sort({ periodStart: -1 });
    return sendSuccess(res, { reports, type }, 'AI reports retrieved successfully');
  });

  public static generateNewReport = asyncHandler(async (req: Request, res: Response) => {
    const memberId = resolveTargetMemberId(req);
    const type = (req.query.type as AIReportType) || AIReportType.WEEKLY;

    const report = await AICoachService.generateReport(memberId, type);
    return sendSuccess(res, { report }, 'New AI report generated successfully', 201);
  });

  public static getGoalPrediction = asyncHandler(async (req: Request, res: Response) => {
    const memberId = resolveTargetMemberId(req);
    const goalType = (req.query.goalType as string) || 'target_weight';

    const prediction = await AICoachService.predictGoalAchievement(memberId, goalType);
    return sendSuccess(res, { prediction }, 'Goal prediction generated successfully');
  });

  public static getRecoveryStatus = asyncHandler(async (req: Request, res: Response) => {
    const memberId = resolveTargetMemberId(req);
    const context = await AIDataAggregatorService.buildMemberContext(memberId);

    const sleepTarget = '8h 00m';
    const formatSleep = (hours?: number): string => {
      if (hours === undefined || hours === null) return '--';
      const wholeHours = Math.floor(hours);
      const minutes = Math.round((hours - wholeHours) * 60);
      return `${wholeHours}h ${minutes.toString().padStart(2, '0')}m`;
    };

    const avgSleepFormatted = context.wellnessAverages.avgSleepHours !== undefined
      ? formatSleep(context.wellnessAverages.avgSleepHours)
      : '--';
    const avgHydrationFormatted = context.wellnessAverages.avgWaterMl !== undefined
      ? `${(context.wellnessAverages.avgWaterMl / 1000).toFixed(1)}L`
      : '--';

    let trainingStatus = 'Ready';
    if (context.recoveryCategory === 'Fatigued' || (context.recoveryScore ?? 0) < 50) {
      trainingStatus = 'Rest Needed';
    } else if (context.recoveryCategory === 'Adequate' || (context.recoveryScore ?? 0) < 70) {
      trainingStatus = 'Moderate';
    }

    const todayWellness = context.todayWellness;
    const todaySleepFormatted =
      todayWellness?.sleepHours !== undefined && todayWellness?.sleepHours !== null
        ? formatSleep(todayWellness.sleepHours)
        : null;
    const todayHydrationFormatted =
      todayWellness?.waterIntakeMl !== undefined && todayWellness?.waterIntakeMl !== null
        ? `${(todayWellness.waterIntakeMl / 1000).toFixed(1)}L`
        : null;

    return sendSuccess(
      res,
      {
        recoveryScore: context.insufficientData ? null : context.recoveryScore,
        recoveryCategory: context.insufficientData
          ? 'BASELINE BUILDING'
          : (context.recoveryCategory || 'Adequate').toUpperCase(),
        recoveryAdvice: context.recoveryAdvice,
        sleepTarget,
        todayWellness: context.todayWellness || null,
        todayDayKey: todayWellness?.dayKey,
        todaySleepHours: todayWellness?.sleepHours,
        todaySleepFormatted,
        todayWaterMl: todayWellness?.waterIntakeMl,
        todayHydrationFormatted,
        todayMood: todayWellness?.mood,
        avgSleepHours: context.wellnessAverages.avgSleepHours,
        avgSleepFormatted,
        avgWaterMl: context.wellnessAverages.avgWaterMl,
        avgHydrationFormatted,
        trainingStatus: context.insufficientData ? 'Building Baseline' : trainingStatus,
        totalVisits: context.attendanceStats.totalVisits,
        totalWorkouts: context.workoutStats.totalWorkoutSessions,
        insufficientData: context.insufficientData,
      },
      'AI Recovery & Training status retrieved successfully'
    );
  });

  // Chatbot Endpoints
  public static getChatDailyLimit = asyncHandler(async (req: Request, res: Response) => {
    const quota = await AIChatbotService.checkUserDailyLimit(req.user!.id);
    return sendSuccess(res, quota, 'AI Chat daily limit retrieved successfully');
  });

  public static startConversation = asyncHandler(async (req: Request, res: Response) => {
    const { firstMessage } = req.body;
    const result = await AIChatbotService.startConversation(req.user!.id, firstMessage, req.user!.role);
    const quota = await AIChatbotService.checkUserDailyLimit(req.user!.id);
    return sendSuccess(res, { ...result, quota }, 'AI Chat conversation started successfully', 201);
  });

  public static sendMessage = asyncHandler(async (req: Request, res: Response) => {
    const { conversationId } = req.params;
    const { content } = req.body;

    const replyMessage = await AIChatbotService.sendMessage(conversationId, req.user!.id, content, req.user!.role);
    const quota = await AIChatbotService.checkUserDailyLimit(req.user!.id);
    return sendSuccess(res, { replyMessage, quota }, 'AI Chat message processed successfully');
  });

  public static getConversationHistory = asyncHandler(async (req: Request, res: Response) => {
    const { conversationId } = req.params;
    const { messages, meta } = await AIChatbotService.getConversationHistory(
      conversationId,
      req.user!.id,
      req.query
    );

    return sendSuccess(res, { messages }, 'Conversation history retrieved successfully', 200, {
      pagination: meta,
    });
  });

  public static listConversations = asyncHandler(async (req: Request, res: Response) => {
    const conversations = await AIChatbotService.listConversations(req.user!.id, req.user!.role);
    return sendSuccess(res, { conversations }, 'AI conversations listed successfully');
  });

  public static archiveConversation = asyncHandler(async (req: Request, res: Response) => {
    const { conversationId } = req.params;
    const conversation = await AIChatbotService.archiveConversation(conversationId, req.user!.id);
    return sendSuccess(res, { conversation }, 'Conversation archived successfully');
  });

  // Module 1: Member Churn Prediction
  public static getAtRiskMembers = asyncHandler(async (req: Request, res: Response) => {
    const { gymId } = req.params;
    const { branchId, riskLevel } = req.query;

    const atRiskMembers = await ChurnPredictionService.getAtRiskMembers(
      gymId,
      branchId as string | undefined,
      riskLevel as 'low' | 'medium' | 'high' | undefined
    );
    return sendSuccess(res, { atRiskMembers }, 'At-risk members retrieved successfully');
  });

  // AI Owner Insights Extensions
  public static getTrainerPerformance = asyncHandler(async (req: Request, res: Response) => {
    const { gymId } = req.params;
    const trainerPerformance = await OwnerInsightsService.getTrainerPerformanceComparison(gymId);
    return sendSuccess(res, { trainerPerformance }, 'Trainer performance comparison retrieved successfully');
  });

  public static getPeakHours = asyncHandler(async (req: Request, res: Response) => {
    const { gymId } = req.params;
    const { branchId } = req.query;
    const peakHours = await OwnerInsightsService.getPeakHoursAnalysis(gymId, branchId as string | undefined);
    return sendSuccess(res, { peakHours }, 'Peak hours analysis retrieved successfully');
  });

  public static getRevenueForecast = asyncHandler(async (req: Request, res: Response) => {
    const { gymId } = req.params;
    const revenueForecast = await OwnerInsightsService.getRevenueForecast(gymId);
    return sendSuccess(res, { revenueForecast }, 'Revenue forecast generated successfully');
  });

  public static getPlanProfitability = asyncHandler(async (req: Request, res: Response) => {
    const { gymId } = req.params;
    const planProfitability = await OwnerInsightsService.getPlanProfitabilityAnalysis(gymId);
    return sendSuccess(res, { planProfitability }, 'Plan profitability analysis retrieved successfully');
  });

  public static getWeeklyDigest = asyncHandler(async (req: Request, res: Response) => {
    const { gymId } = req.params;
    const forceRefresh = req.query.refresh === 'true';
    const weeklyDigest = await OwnerInsightsService.generateWeeklyOwnerDigest(gymId, forceRefresh);
    return sendSuccess(res, { weeklyDigest }, 'Weekly owner digest retrieved successfully');
  });

  public static getUpsellRecommendation = asyncHandler(async (req: Request, res: Response) => {
    const memberId = resolveTargetMemberId(req);
    const recommendation = await SupplementPTRecommendationService.generateUpsellRecommendation(memberId);
    return sendSuccess(res, recommendation, 'AI Supplement & PT recommendation generated successfully');
  });
}


