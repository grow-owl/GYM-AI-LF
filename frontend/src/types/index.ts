export type Role = "owner" | "trainer" | "member" | "reception" | "SUPER_ADMIN" | "GYM_OWNER" | "BRANCH_MANAGER" | "TRAINER" | "MEMBER" | "KIOSK";

export interface NavItem {
  label: string;
  path: string;
  icon: keyof typeof import("lucide-react");
}

export interface KpiDatum {
  label: string;
  value: string;
  delta?: string;
  deltaDirection?: "up" | "down";
  icon: string;
}

export interface QuickLink {
  label: string;
  path: string;
  icon: string;
  tone?: "default" | "accent";
}

export interface Member {
  id: string;
  name: string;
  plan: string;
  status: "active" | "expiring" | "overdue" | "trial";
  joined: string;
  trainer?: string;
  churnRisk?: "low" | "medium" | "high";
}

export interface Trainer {
  id: string;
  name: string;
  clients: number;
  specialty: string;
  rating: number;
  sessionsToday: number;
}

export interface Session {
  id: string;
  time: string;
  clientName: string;
  type: string;
  status: "upcoming" | "done" | "missed";
}

export interface Lead {
  id: string;
  name: string;
  interest: string;
  source: string;
  stage: "new" | "contacted" | "trial" | "joined";
  trialDate?: string;
  assignedTrainer?: string;
}

export interface Exercise {
  id: string;
  name: string;
  sets: { set: number; kg: number; reps: number; done: boolean }[];
  previous: string;
}

// ==========================================
// Domain Model Interfaces (Backend Aligned)
// ==========================================

export interface IAddress {
  line1?: string;
  city?: string;
  state?: string;
  pincode?: string;
  country?: string;
}

export interface IGymSettings {
  defaultTrialPassDays?: number;
  currency?: string;
  timezone?: string;
  allowMemberSelfCheckIn?: boolean;
}

export interface IGym {
  _id: string;
  id?: string;
  name: string;
  billingEmail?: string;
  phone?: string;
  logoUrl?: string;
  plan?: string;
  status?: string;
  branches?: IBranch[];
  settings?: IGymSettings;
  createdAt?: string;
  updatedAt?: string;
}

export interface IBranch {
  _id: string;
  id?: string;
  gymId?: string;
  name: string;
  contactPhone?: string;
  timezone?: string;
  address?: IAddress;
  city?: string;
  state?: string;
  isPrimary?: boolean;
  managerId?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface IUser {
  _id: string;
  id?: string;
  fullName: string;
  email: string;
  phone?: string;
  role: Role;
  gymId?: string;
  branchId?: string;
  gymName?: string;
  branchName?: string;
  avatarUrl?: string;
  isActive?: boolean;
}

export interface IStaffUser {
  _id: string;
  id?: string;
  userId?: {
    _id: string;
    fullName: string;
    email: string;
    phone?: string;
    avatarUrl?: string;
    role: string;
  };
  fullName?: string;
  email?: string;
  phone?: string;
  role: string;
  branchId?: string;
  branchName?: string;
  specializations?: string[];
  bio?: string;
  isActive?: boolean;
  createdAt?: string;
}

export type MembershipStatus = "ACTIVE" | "EXPIRED" | "FROZEN" | "CANCELLED" | "TRIAL";

export interface IEmergencyContact {
  name?: string;
  phone?: string;
  relation?: string;
}

export interface IHealthInfo {
  height_cm?: number;
  currentWeight_kg?: number;
  targetWeight_kg?: number;
  medicalConditions?: string[];
  injuries?: string[];
}

export interface IMember {
  _id: string;
  id?: string;
  userId?: string | IUser;
  gymId?: string;
  branchId?: string;
  assignedTrainerId?: string | ITrainer;
  membershipStatus: MembershipStatus;
  membershipStartDate?: string;
  membershipEndDate?: string;
  planName?: string;
  emergencyContact?: IEmergencyContact;
  healthInfo?: IHealthInfo;
  fitnessGoals?: string[];
  qrCode?: string;
  currentStreakDays?: number;
  longestStreakDays?: number;
  lastCheckInDate?: string;
  totalXpPoints?: number;
  gamificationLevel?: number;
  createdAt?: string;
}

export interface IMemberClient {
  _id: string;
  id?: string;
  userId?: {
    _id: string;
    fullName: string;
    email?: string;
    phone?: string;
    avatarUrl?: string;
  };
  name?: string;
  fullName?: string;
  email?: string;
  phone?: string;
  avatarUrl?: string;
  membershipStatus?: MembershipStatus;
  planName?: string;
  membershipPlan?: string;
  healthInfo?: IHealthInfo;
  fitnessGoals?: string[];
  weightKg?: number;
  heightCm?: number;
  targetWeightKg?: number;
  currentStreakDays?: number;
  latestWorkoutAt?: string;
  assignedTrainerId?: string;
  joinedAt?: string;
  createdAt?: string;
}

export interface ICertification {
  name: string;
  issuedBy?: string;
  year?: number;
}

export interface ITrainer {
  _id: string;
  id?: string;
  userId?: string | IUser;
  gymId: string;
  branchId: string;
  specializations: string[];
  bio?: string;
  certifications?: ICertification[];
  maxMemberCapacity?: number;
  activeMembersAssigned?: number;
  isDeleted?: boolean;
  createdAt?: string;
}

export interface ITrainerWorkload {
  activeMembersAssigned: number;
}

export type PlanStatus = "ACTIVE" | "COMPLETED" | "ARCHIVED";

export interface IWorkoutPlanExercise {
  exerciseId: string;
  name?: string;
  muscleGroup?: string;
  order?: number;
  targetSets: number;
  targetReps: number;
  targetWeightKg?: number;
  restSeconds?: number;
  notes?: string;
}

export interface IWorkoutDay {
  dayLabel: string;
  dayName?: string;
  exercises: IWorkoutPlanExercise[];
}

export interface IWorkoutPlan {
  _id: string;
  id?: string;
  gymId: string;
  branchId?: string;
  memberId: string;
  createdBy?: string;
  createdByTrainerId?: string;
  title: string;
  description?: string;
  durationWeeks?: number;
  daysPerWeek?: number;
  goal?: string;
  days: IWorkoutDay[];
  startDate?: string;
  endDate?: string;
  status?: PlanStatus;
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface IExerciseLibraryItem {
  _id: string;
  id?: string;
  name: string;
  muscleGroup: string;
  category?: string;
  equipment?: string;
  instructions?: string;
  defaultSets?: number;
  defaultReps?: number;
  isCustom?: boolean;
  gymId?: string;
}

export interface IMeal {
  mealType: "breakfast" | "lunch" | "dinner" | "snack";
  description: string;
  calories?: number;
  proteinGrams?: number;
  carbsGrams?: number;
  fatGrams?: number;
  time?: string;
}

export interface IDietDay {
  dayLabel: string;
  meals: IMeal[];
}

export interface IDietPlan {
  _id: string;
  id?: string;
  gymId: string;
  memberId: string;
  title: string;
  dailyCalories?: number;
  proteinGrams?: number;
  carbsGrams?: number;
  fatGrams?: number;
  days: IDietDay[];
  createdAt?: string;
}

export type PaymentStatus = "PAID" | "PENDING" | "FAILED" | "REFUNDED";
export type PaymentMethod = "CASH" | "UPI" | "CARD" | "BANK_TRANSFER" | "ONLINE";
export type PaymentPurpose = "MEMBERSHIP" | "PERSONAL_TRAINING" | "PRODUCT" | "LOCKER" | "OTHER";

export interface IPayment {
  _id: string;
  id?: string;
  gymId: string;
  branchId?: string;
  memberId?: string | { _id: string; userId?: { fullName: string; email: string; phone: string } };
  amount: number;
  purpose: PaymentPurpose | string;
  method: PaymentMethod | string;
  status: PaymentStatus;
  paidAt?: string;
  transactionId?: string;
  notes?: string;
  createdAt?: string;
}

// AI & Recovery Types
export interface ITodayWellness {
  dayKey?: string;
  sleepHours?: number;
  waterIntakeMl?: number;
  mood?: "great" | "good" | "okay" | "tired" | "stressed" | string;
  energyRating?: number;
  stressLevel?: string;
  sorenessNotes?: string;
}

export interface IWellnessLog {
  _id?: string;
  dayKey: string;
  sleepHours?: number;
  waterIntakeMl?: number;
  mood?: string;
  recordedAt?: string;
  createdAt?: string;
}

export interface IWellnessHistoryResponse {
  history: IWellnessLog[];
  meta?: {
    total: number;
    page: number;
    limit: number;
  };
}

export interface IRecoveryStatus {
  recoveryScore: number | null;
  recoveryCategory: "OPTIMAL RECOVERY" | "GOOD TO TRAIN" | "MODERATE FATIGUE" | "HIGH FATIGUE / REST RECOMMENDED" | "BASELINE BUILDING" | string;
  recoveryAdvice?: string;
  trainingStatus: "Ready" | "Moderate" | "Rest Needed" | "Building Baseline" | string;
  sleepTarget?: string;
  todayWellness?: ITodayWellness | null;
  todayDayKey?: string;
  todaySleepHours?: number;
  todaySleepFormatted?: string | null;
  todayWaterMl?: number;
  todayHydrationFormatted?: string | null;
  todayMood?: string;
  avgSleepHours?: number;
  avgSleepFormatted?: string;
  avgWaterMl?: number;
  avgHydrationFormatted?: string;
  totalVisits?: number;
  totalWorkouts?: number;
  insufficientData?: boolean;
}

export interface IAttendanceCheckInResponse {
  success: boolean;
  message?: string;
  attendance?: {
    _id: string;
    checkInTime: string;
    memberName?: string;
    memberId?: {
      _id: string;
      userId?: {
        fullName: string;
      };
    };
  };
  checkIn?: {
    _id: string;
    streakCount?: number;
    memberId?: {
      userId?: {
        fullName: string;
      };
    };
  };
  streakCount?: number;
}

export interface IQRTokenResponse {
  qrToken?: string;
  qrCodeDataUrl?: string;
  ttlSeconds?: number;
}
