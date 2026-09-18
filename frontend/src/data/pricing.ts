export interface PlanItem {
  id: string;
  gymPlanEnum?: "BASIC" | "PRO" | "ENTERPRISE";
  name: string;
  price: string;
  period: string;
  sub?: string;
  features: string[];
  cta?: string;
  popular?: boolean;
  tone?: "accent" | "ghost";
}

export const trialPlan: PlanItem = {
  id: "trial",
  name: "Trial",
  price: "Free",
  period: "1 week, full access",
  sub: "Free trial for new gyms",
  features: ["Up to 20 members", "Owner dashboard", "QR attendance"],
  cta: "Start free trial",
  tone: "ghost",
};

export const plans: PlanItem[] = [
  {
    id: "starter",
    gymPlanEnum: "BASIC",
    name: "Starter Gym",
    price: "₹2,499",
    period: "/month",
    sub: "For single-trainer gyms",
    features: [
      "Up to 150 Active Members",
      "1 Branch Support",
      "QR Check-in System",
      "Membership & payment tracking",
      "Basic Reports",
    ],
    cta: "Choose Starter",
    popular: false,
    tone: "ghost",
  },
  {
    id: "pro",
    gymPlanEnum: "PRO",
    name: "Pro AI SaaS",
    price: "₹4,999",
    period: "/month",
    sub: "For growing multi-trainer gyms",
    features: [
      "Unlimited Members & Trainers",
      "Up to 3 Gym Branches",
      "AI Coach & Supplement Upsell Engine",
      "Advanced Analytics & Reports",
      "POS Store & Inventory System",
    ],
    cta: "Choose Pro AI",
    popular: true,
    tone: "accent",
  },
  {
    id: "enterprise",
    gymPlanEnum: "ENTERPRISE",
    name: "Enterprise Chain",
    price: "₹9,999",
    period: "/month",
    sub: "For multi-branch gym chains",
    features: [
      "Unlimited Branches & Franchises",
      "Dedicated AI Business Advisor",
      "Custom Brand White-Labeling",
      "24/7 Priority Support & Setup",
    ],
    cta: "Choose Enterprise",
    popular: false,
    tone: "ghost",
  },
];

export const landingPlans: PlanItem[] = [trialPlan, ...plans];

export const CARD_ID_TO_GYM_PLAN: Record<string, string> = {
  starter: "BASIC",
  pro: "PRO",
  enterprise: "ENTERPRISE",
};

export const GYM_PLAN_TO_CARD_ID: Record<string, string> = {
  TRIAL: "starter",
  BASIC: "starter",
  PRO: "pro",
  ENTERPRISE: "enterprise",
};
