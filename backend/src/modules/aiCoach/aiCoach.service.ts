import mongoose from 'mongoose';
import { AIReport } from './aiReport.model';
import { GoalPrediction } from './goalPrediction.model';
import { AIDataAggregatorService } from './aiDataAggregator.service';
import { AIProviderFactory } from './providers/aiProvider.factory';
import { Member } from '../member/member.model';
import { IAIReport, IGoalPrediction, AIReportType, AIProvider } from './aiCoach.types';
import { aiSuggestionsResponseSchema } from './aiCoach.validation';
import { NotificationService } from '../notification/notification.service';
import { NotificationType } from '../notification/notification.types';
import { notificationTemplates } from '../notification/notificationTemplates';
import { logger } from '../../config/logger';

const MEDICAL_DISCLAIMER =
  'IMPORTANT MEDICAL DISCLAIMER: AI fitness recommendations and insights are for educational and motivational purposes only. They do not constitute medical, diagnostic, or prescription advice. Always consult a qualified healthcare professional or certified personal trainer before starting new intensive training or dietary regimens.';

/**
 * Robust helper to clean and parse JSON responses from AI models that may be enclosed in markdown code fences
 */
function parseAIJsonResponse(raw: string): any {
  let cleaned = raw.trim();
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.replace(/^```json\s*/, '').replace(/\s*```$/, '');
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```\s*/, '').replace(/\s*```$/, '');
  }
  return JSON.parse(cleaned.trim());
}

export class AICoachService {
  public static async generatePersonalizedSuggestions(memberId: string): Promise<{
    insights: string[];
    recommendations: string[];
    disclaimer: string;
    insufficientData?: boolean;
  }> {
    const context = await AIDataAggregatorService.buildMemberContext(memberId);

    if (context.insufficientData) {
      return {
        insights: ['Log more workouts, attendance, and weight entries to unlock personalized AI insights.'],
        recommendations: [
          'Check in at your gym branch via QR code on your next visit.',
          'Log your completed sets tap-by-tap in the Workout tab.',
        ],
        disclaimer: MEDICAL_DISCLAIMER,
        insufficientData: true,
      };
    }

    const systemPrompt = `You are an elite AI Fitness Coach for a premium Gym SaaS platform.
Analyze the provided member fitness context and respond ONLY in STRICT JSON format with the schema:
{
  "insights": ["observation 1", "observation 2"],
  "recommendations": ["action step 1", "action step 2"]
}`;

    const userPrompt = `Member Context: ${JSON.stringify(context)}`;

    try {
      const { result } = await AIProviderFactory.executeWithFailover(systemPrompt, userPrompt, {
        jsonMode: true,
      });

      const parsedJson = parseAIJsonResponse(result);
      const validated = aiSuggestionsResponseSchema.parse(parsedJson);

      return {
        insights: validated.insights,
        recommendations: validated.recommendations,
        disclaimer: MEDICAL_DISCLAIMER,
      };
    } catch (error) {
      logger.warn(`⚠️ Failed to parse AI JSON response: ${error}. Falling back to safe default.`);
      return {
        insights: [
          `Consistency is strong with ${context.attendanceStats.totalVisits} gym visit(s) recorded.`,
          `Workout completion rate is currently at ${context.workoutStats.completionRatePercent}%.`,
        ],
        recommendations: [
          'Maintain steady hydration before and after intense sessions.',
          'Aim for 7-8 hours of restful sleep to optimize recovery.',
        ],
        disclaimer: MEDICAL_DISCLAIMER,
      };
    }
  }

  public static async generateDietRecommendation(memberId: string): Promise<{
    suggestions: string[];
    disclaimer: string;
    noteToMember: string;
  }> {
    const context = await AIDataAggregatorService.buildMemberContext(memberId);

    const noteToMember =
      'These AI diet suggestions are intended for your review and discussion with your assigned personal trainer.';

    if (context.insufficientData) {
      return {
        suggestions: [
          'Maintain balanced macronutrients: 2.0g protein per kg of target weight.',
          'Hydrate with at least 3,000ml water daily.',
        ],
        disclaimer: MEDICAL_DISCLAIMER,
        noteToMember,
      };
    }

    const systemPrompt = `You are a Sports Nutrition AI Advisor. Generate 3 concise, science-backed dietary adjustments in a JSON array format: ["suggestion 1", "suggestion 2", "suggestion 3"].`;
    const userPrompt = `Member Health & Goals: ${JSON.stringify({
      currentWeight: context.currentWeight_kg,
      targetWeight: context.targetWeight_kg,
      goals: context.fitnessGoals,
      avgWaterMl: context.wellnessAverages.avgWaterMl,
    })}`;

    try {
      const { result } = await AIProviderFactory.executeWithFailover(systemPrompt, userPrompt, {
        jsonMode: true,
      });
      const parsed = parseAIJsonResponse(result);
      const suggestions = Array.isArray(parsed) ? parsed : parsed.suggestions || Object.values(parsed);

      return {
        suggestions: suggestions.map(String),
        disclaimer: MEDICAL_DISCLAIMER,
        noteToMember,
      };
    } catch (error) {
      return {
        suggestions: [
          'Prioritize lean protein intake (chicken, fish, tofu) after resistance workouts.',
          'Consume complex carbohydrates 1-2 hours prior to heavy leg sessions.',
          'Increase water intake on active workout days.',
        ],
        disclaimer: MEDICAL_DISCLAIMER,
        noteToMember,
      };
    }
  }

  public static async generateReport(
    memberId: string,
    type: AIReportType = AIReportType.WEEKLY
  ): Promise<IAIReport> {
    const context = await AIDataAggregatorService.buildMemberContext(memberId);

    const plateau = AIDataAggregatorService.detectPlateau(
      context.weightTrend,
      context.workoutStats.completionRatePercent
    );
    const injuryRisk = AIDataAggregatorService.detectInjuryRisk(
      context.injuries,
      context.workoutStats.completionRatePercent,
      context.workoutStats.mostSkippedExercises
    );

    const now = new Date();
    const periodDays = type === AIReportType.WEEKLY ? 7 : 30;
    const periodStart = new Date(now.getTime() - periodDays * 24 * 60 * 60 * 1000);

    const systemPrompt = `Generate a natural language performance summary for a gym member report. Output JSON: { "summary": "...", "insights": ["..."], "recommendations": ["..."] }`;
    const userPrompt = `Context: ${JSON.stringify(context)}`;

    let summary = `Over the past ${periodDays} days, you logged ${context.attendanceStats.totalVisits} visit(s) with a ${context.workoutStats.completionRatePercent}% workout completion rate.`;
    let insights = ['Consistent workout logging', 'Good attendance habits'];
    let recommendations = ['Keep pushing towards target goals', 'Maintain sleep hygiene'];
    let providerUsed = AIProvider.GEMINI;

    try {
      const { result, providerUsed: pUsed } = await AIProviderFactory.executeWithFailover(
        systemPrompt,
        userPrompt,
        { jsonMode: true }
      );
      providerUsed = pUsed;
      const parsed = parseAIJsonResponse(result);
      if (parsed.summary) summary = parsed.summary;
      if (Array.isArray(parsed.insights)) insights = parsed.insights;
      if (Array.isArray(parsed.recommendations)) recommendations = parsed.recommendations;
    } catch (error) {
      logger.warn(`AI Report completion fallback used for member ${memberId}`);
    }

    const report = new AIReport({
      memberId: new mongoose.Types.ObjectId(context.memberId),
      gymId: new mongoose.Types.ObjectId(context.gymId),
      type,
      periodStart,
      periodEnd: now,
      summary,
      metrics: {
        attendanceRate: Math.min(100, Math.round((context.attendanceStats.totalVisits / (periodDays * 0.6)) * 100)),
        workoutCompletionRate: context.workoutStats.completionRatePercent,
        avgSleepHours: context.wellnessAverages.avgSleepHours,
        avgWaterIntakeMl: context.wellnessAverages.avgWaterMl,
        weightChangeKg:
          context.weightTrend.length >= 2
            ? Math.round((context.weightTrend[0].weightKg - context.weightTrend[context.weightTrend.length - 1].weightKg) * 10) / 10
            : undefined,
        recoveryScore: context.recoveryScore,
        recoveryCategory: context.recoveryCategory,
      },
      insights,
      recommendations,
      plateauDetected: plateau.plateauDetected,
      injuryRiskFlag: injuryRisk.injuryRiskFlag,
      injuryRiskReason: injuryRisk.reason,
      generatedByProvider: providerUsed,
      createdAt: now,
    });

    await report.save();

    // Hook: Send AI Report Ready Notification
    const member = await Member.findById(context.memberId);
    if (member) {
      const template = notificationTemplates[NotificationType.AI_REPORT_READY](type);
      await NotificationService.sendToUser(
        member.userId.toString(),
        context.gymId,
        NotificationType.AI_REPORT_READY,
        template.title,
        template.body,
        { reportId: report._id.toString() }
      );
    }

    logger.info(`📊 AI Report generated: [ID: ${report._id}] [Member: ${memberId}] [Type: ${type}]`);
    return report;
  }

  public static async predictGoalAchievement(
    memberId: string,
    goalType: string = 'target_weight'
  ): Promise<IGoalPrediction> {
    const context = await AIDataAggregatorService.buildMemberContext(memberId);

    const currentWeight = context.currentWeight_kg || 80;
    const targetWeight = context.targetWeight_kg || 70;

    let predictedDate: Date | undefined = undefined;
    let confidence: 'low' | 'medium' | 'high' = 'low';
    let explanation = 'Insufficient data points to compute an accurate trend date projection.';

    const isWeightGainGoal =
      targetWeight > currentWeight ||
      (context.fitnessGoals &&
        context.fitnessGoals.some((g) => g.toLowerCase().includes('gain') || g.toLowerCase().includes('hypertrophy')));

    if (context.weightTrend.length >= 3) {
      const latest = context.weightTrend[0].weightKg;
      const oldest = context.weightTrend[context.weightTrend.length - 1].weightKg;

      const newestDate = new Date(context.weightTrend[0].date);
      const oldestDate = new Date(context.weightTrend[context.weightTrend.length - 1].date);
      const timeDiffMs = newestDate.getTime() - oldestDate.getTime();
      const actualWeeksElapsed = timeDiffMs / (1000 * 60 * 60 * 24 * 7);

      if (isWeightGainGoal) {
        const totalGainedKg = latest - oldest;
        if (actualWeeksElapsed > 0 && totalGainedKg > 0) {
          const weeklyGainRate = totalGainedKg / actualWeeksElapsed;
          const remainingKg = Math.max(0, targetWeight - latest);
          const weeksNeeded = remainingKg / Math.max(0.1, weeklyGainRate);
          predictedDate = new Date(Date.now() + weeksNeeded * 7 * 24 * 60 * 60 * 1000);
          confidence = context.weightTrend.length > 5 ? 'high' : 'medium';
          explanation = `Based on a steady muscle/weight gain rate of ~${weeklyGainRate.toFixed(1)}kg/week over ${
            context.weightTrend.length
          } data points.`;
        } else {
          explanation = 'Weight progress is steady; maintain a progressive caloric surplus and progressive overload to reach your target bulk goal.';
        }
      } else {
        const totalLossKg = oldest - latest;
        if (actualWeeksElapsed > 0 && totalLossKg > 0) {
          const weeklyLossRate = totalLossKg / actualWeeksElapsed;
          const remainingKg = Math.max(0, latest - targetWeight);
          const weeksNeeded = remainingKg / Math.max(0.1, weeklyLossRate);
          predictedDate = new Date(Date.now() + weeksNeeded * 7 * 24 * 60 * 60 * 1000);
          confidence = context.weightTrend.length > 5 ? 'high' : 'medium';
          explanation = `Based on a steady weight loss rate of ~${weeklyLossRate.toFixed(1)}kg/week over ${
            context.weightTrend.length
          } data points.`;
        } else {
          explanation = 'Weight is currently steady or gaining; maintain caloric deficit to trigger target date calculation.';
        }
      }
    }

    const prediction = await GoalPrediction.findOneAndUpdate(
      { memberId: new mongoose.Types.ObjectId(context.memberId), goalType },
      {
        gymId: new mongoose.Types.ObjectId(context.gymId),
        currentValue: currentWeight,
        targetValue: targetWeight,
        predictedAchievementDate: predictedDate,
        confidence,
        basedOnDataPoints: context.weightTrend.length,
        explanation,
      },
      { upsert: true, new: true }
    );

    return prediction;
  }
}
