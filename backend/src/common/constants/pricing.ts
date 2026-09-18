import { GymPlan } from '../../modules/gym/gym.types';

export const PLATFORM_PLAN_PRICING: Record<GymPlan, { monthly: number; yearly: number }> = {
  [GymPlan.TRIAL]: {
    monthly: 0,
    yearly: 0,
  },
  [GymPlan.BASIC]: {
    monthly: 999, // ₹999/month
    yearly: 9990, // 2 months free on yearly
  },
  [GymPlan.PRO]: {
    monthly: 2999, // ₹2999/month
    yearly: 29990,
  },
  [GymPlan.ENTERPRISE]: {
    monthly: 9999, // Custom quote baseline
    yearly: 99990,
  },
};
