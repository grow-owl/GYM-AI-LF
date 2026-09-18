import mongoose from 'mongoose';
import { Member } from '../member/member.model';
import { DietPlan } from '../dietPlan/dietPlan.model';
import { PlanStatus } from '../workout/workoutPlan.types';
import { DailyWellness } from '../progress/dailyWellness.model';
import { WeightEntry } from '../progress/weightEntry.model';
import { Product } from '../product/product.model';
import { Trainer } from '../trainer/trainer.model';
import { AIProviderFactory } from './providers/aiProvider.factory';
import { AppError } from '../../common/utils/AppError';
import { logger } from '../../config/logger';

export const MEDICAL_DISCLAIMER =
  'IMPORTANT MEDICAL DISCLAIMER: AI fitness recommendations and insights are for educational and motivational purposes only. They do not constitute medical, diagnostic, or prescription advice. Always consult a qualified healthcare professional or certified personal trainer before starting new intensive training or dietary regimens.';

export const TRAINER_NOTICE =
  'Final decision on supplements or personal training is with your assigned trainer — this is an AI-generated suggestion only.';

export interface UpsellSignals {
  supplementEligible: boolean;
  proteinGapPercent?: number;
  targetProtein_g?: number;
  actualAvgProtein_g?: number;
  ptEligible: boolean;
  weightStalled?: boolean;
  weeksStalled?: number;
}

export class SupplementPTRecommendationService {
  /**
   * Deterministically evaluate member data for supplement and PT upsell signals
   */
  public static async evaluateUpsellSignals(memberId: string): Promise<UpsellSignals> {
    const member = await Member.findOne({
      $or: [
        { _id: mongoose.Types.ObjectId.isValid(memberId) ? memberId : undefined },
        { userId: mongoose.Types.ObjectId.isValid(memberId) ? memberId : undefined },
      ],
      isDeleted: false,
    });

    if (!member) {
      throw AppError.notFound('Member profile not found');
    }

    const now = new Date();

    // 1. Evaluate Protein Gap from Diet Plan & Logged Meals (last 7 days)
    let proteinGapPercent: number | undefined;
    let targetProtein_g: number | undefined;
    let actualAvgProtein_g: number | undefined;

    const activeDietPlan = await DietPlan.findOne({
      memberId: member._id,
      status: PlanStatus.ACTIVE,
      isDeleted: false,
    });

    if (activeDietPlan?.dailyProteinTarget_g && activeDietPlan.dailyProteinTarget_g > 0) {
      targetProtein_g = activeDietPlan.dailyProteinTarget_g;

      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const wellnessLogs = await DailyWellness.find({
        memberId: member._id,
        createdAt: { $gte: sevenDaysAgo },
      });

      let totalProteinLogged = 0;
      wellnessLogs.forEach((log) => {
        if (log.meals) {
          log.meals.forEach((meal: any) => {
            if (meal.protein_g) {
              totalProteinLogged += meal.protein_g;
            }
          });
        }
      });

      actualAvgProtein_g = Math.round((totalProteinLogged / 7) * 10) / 10;

      if (targetProtein_g > actualAvgProtein_g) {
        proteinGapPercent = Math.round(((targetProtein_g - actualAvgProtein_g) / targetProtein_g) * 100);
      } else {
        proteinGapPercent = 0;
      }
    }

    // 2. Evaluate Weight Stalled Progress (spanning 3+ weeks / 21+ days)
    let weightStalled = false;
    let weeksStalled: number | undefined;

    const weightEntries = await WeightEntry.find({ memberId: member._id })
      .sort({ recordedAt: -1 })
      .limit(10);

    if (weightEntries.length >= 2) {
      const latest = weightEntries[0];
      const oldest = weightEntries[weightEntries.length - 1];

      const diffDays = Math.floor(
        (new Date(latest.recordedAt).getTime() - new Date(oldest.recordedAt).getTime()) / (1000 * 60 * 60 * 24)
      );

      if (diffDays >= 21) {
        const weightDiff = Math.abs(latest.weightKg - oldest.weightKg);
        if (weightDiff < 0.5) {
          weightStalled = true;
          weeksStalled = Math.max(3, Math.floor(diffDays / 7));
        }
      }
    }

    // 3. Evaluate Signal Eligibility
    const fitnessGoals = member.fitnessGoals || [];
    const hasMuscleGainGoal = fitnessGoals.includes('muscle_gain') || fitnessGoals.includes('muscle_hypertrophy');

    const supplementEligible = Boolean(hasMuscleGainGoal && proteinGapPercent !== undefined && proteinGapPercent > 20);
    const ptEligible = Boolean(weightStalled === true && !member.assignedTrainerId);

    return {
      supplementEligible,
      proteinGapPercent,
      targetProtein_g,
      actualAvgProtein_g,
      ptEligible,
      weightStalled,
      weeksStalled,
    };
  }

  /**
   * Generate AI-assisted Upsell Recommendation with mandatory disclaimers and product/trainer links
   */
  public static async generateUpsellRecommendation(memberId: string): Promise<Record<string, unknown>> {
    const member = await Member.findOne({
      $or: [
        { _id: mongoose.Types.ObjectId.isValid(memberId) ? memberId : undefined },
        { userId: mongoose.Types.ObjectId.isValid(memberId) ? memberId : undefined },
      ],
      isDeleted: false,
    });

    if (!member) {
      throw AppError.notFound('Member profile not found');
    }

    const signals = await SupplementPTRecommendationService.evaluateUpsellSignals(member._id.toString());

    if (!signals.supplementEligible && !signals.ptEligible) {
      return { eligible: false };
    }

    // Query matching products & available trainers for actionable links
    const [matchingProducts, availableTrainers] = await Promise.all([
      signals.supplementEligible
        ? Product.find({
            gymId: member.gymId,
            category: 'supplement',
            isActive: true,
            isDeleted: false,
          }).select('_id name price category stockQuantity')
        : Promise.resolve([]),
      signals.ptEligible
        ? Trainer.find({
            gymId: member.gymId,
            isDeleted: false,
          }).select('_id specializations bio')
        : Promise.resolve([]),
    ]);

    const systemPrompt = `You are an expert Gym AI Coach. Provide a supportive, plain-language recommendation grounded strictly in the computed signals provided below.
RULES:
1. Explain the recommendation in plain language, grounded ONLY in the computed gap (protein gap %, or weeks without weight progress).
2. Phrase supplement/PT as "consider discussing with your trainer" — NEVER as a certainty or required purchase.
3. NEVER claim a medical condition or diagnosis.`;

    const userPrompt = JSON.stringify({
      supplementEligible: signals.supplementEligible,
      proteinGapPercent: signals.proteinGapPercent,
      ptEligible: signals.ptEligible,
      weeksStalled: signals.weeksStalled,
    });

    let aiExplanation = '';
    try {
      const { result } = await AIProviderFactory.executeWithFailover(systemPrompt, userPrompt);
      aiExplanation = result;
    } catch (error) {
      logger.warn(`AI Provider failed for upsell recommendation, using fallback text: ${error}`);
      aiExplanation = 'Based on your recent training logs, you may benefit from reviewing your nutrition target or consulting a personal trainer.';
    }

    return {
      eligible: true,
      signals,
      explanation: aiExplanation,
      supplementRecommendation: signals.supplementEligible
        ? {
            title: 'Protein Supplementation Suggestion',
            explanation: aiExplanation,
            proteinGapPercent: signals.proteinGapPercent,
            suggestedProducts: matchingProducts,
          }
        : undefined,
      ptRecommendation: signals.ptEligible
        ? {
            title: 'Personal Training Guidance',
            explanation: aiExplanation,
            weeksStalled: signals.weeksStalled,
            availableTrainersCount: availableTrainers.length,
          }
        : undefined,
      medicalDisclaimer: MEDICAL_DISCLAIMER,
      trainerNotice: TRAINER_NOTICE,
    };
  }
}
