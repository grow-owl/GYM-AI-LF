// Typed service functions grouped by backend module.
// Each function maps 1:1 to a real route in backend/src/modules/**/*.routes.ts.
import { api } from "./api";
import type {
  IGym,
  IBranch,
  IMember,
  IMemberClient,
  ITrainer,
  IWorkoutPlan,
  IExerciseLibraryItem,
  IDietPlan,
  IPayment,
  IRecoveryStatus,
  IWellnessHistoryResponse,
  IAttendanceCheckInResponse,
  IStaffUser,
} from "../types";

export type Role = "SUPER_ADMIN" | "GYM_OWNER" | "BRANCH_MANAGER" | "TRAINER" | "MEMBER" | "KIOSK";

export interface AuthUser {
  _id: string;
  fullName: string;
  email: string;
  phone: string;
  role: Role;
  gymId?: string;
  branchId?: string;
  gymName?: string;
  branchName?: string;
  isActive: boolean;
  createdAt: string;
  [key: string]: unknown;
}

interface AuthResponse {
  user: AuthUser;
  accessToken: string;
}

export const authApi = {
  register: (input: {
    fullName: string;
    email: string;
    phone: string;
    password: string;
    role?: "MEMBER";
    referralCode?: string;
  }) => api.post<AuthResponse>("/auth/register", input),

  registerOwner: (input: {
    fullName: string;
    email: string;
    phone: string;
    password?: string;
    gymName: string;
    branchName?: string;
    plan?: string;
    trialDays?: number;
  }) => api.post<{ user: AuthUser; gym: IGym; primaryBranch: IBranch; tempPassword?: string }>("/auth/register-owner", input),

  adminResetPassword: (userId: string, newPassword: string) =>
    api.patch<{ message: string }>(`/auth/users/${userId}/reset-password`, { newPassword }),

  login: (email: string, password: string) => api.post<AuthResponse>("/auth/login", { email, password }),

  logout: () => api.post<null>("/auth/logout"),

  logoutAll: () => api.post<null>("/auth/logout-all"),

  getMe: () => api.get<{ user: AuthUser }>("/auth/me"),

  forgotPassword: (email: string) => api.post<{ message: string }>("/auth/forgot-password", { email }),

  resetPassword: (token: string, newPassword: string) =>
    api.post<{ message: string }>("/auth/reset-password", { token, newPassword }),

  updateProfile: (data: { fullName?: string; phone?: string; avatarUrl?: string }) =>
    api.patch<{ user: AuthUser }>("/auth/profile", data),

  changePassword: (data: { currentPassword?: string; newPassword: string }) =>
    api.patch<{ message: string }>("/auth/change-password", data),
};

export const gymApi = {
  listAllGyms: () => api.get<{ gyms: IGym[] }>("/gyms"),

  createGym: (input: { name: string; billingEmail: string }) =>
    api.post<{ gym: IGym }>("/gyms", input),

  createBranch: (
    gymId: string,
    input: {
      name: string;
      address: { line1: string; city: string; state: string; pincode: string; country: string };
      contactPhone: string;
      timezone?: string;
    }
  ) => api.post<{ branch: IBranch }>(`/gyms/${gymId}/branches`, input),

  listBranches: (gymId: string) => api.get<{ branches: IBranch[] }>(`/gyms/${gymId}/branches`),

  getGymById: (gymId: string) => api.get<{ gym: IGym }>(`/gyms/${gymId}`),

  updateGym: (gymId: string, data: Partial<IGym> | Record<string, unknown>) => api.patch<{ gym: IGym }>(`/gyms/${gymId}`, data),

  deleteGym: (gymId: string) => api.delete<{ success: boolean; message?: string }>(`/gyms/${gymId}`),

  updateGymPlan: (gymId: string, plan: string) => api.patch<{ gym: IGym }>(`/gyms/${gymId}/plan`, { plan }),

  getOverview: (gymId: string) => api.get<Record<string, unknown>>(`/gyms/${gymId}/overview`),

  getBranchById: (gymId: string, branchId: string) => api.get<{ branch: IBranch }>(`/gyms/${gymId}/branches/${branchId}`),

  updateBranch: (gymId: string, branchId: string, data: Partial<IBranch> | Record<string, unknown>) =>
    api.patch<{ branch: IBranch }>(`/gyms/${gymId}/branches/${branchId}`, data),

  deleteBranch: (gymId: string, branchId: string) => api.delete<{ success: boolean; message?: string }>(`/gyms/${gymId}/branches/${branchId}`),

  assignBranchManager: (gymId: string, branchId: string, managerId: string) =>
    api.patch<{ branch: IBranch }>(`/gyms/${gymId}/branches/${branchId}/manager`, { managerId }),

  getMembershipPlans: (gymId: string) =>
    api.get<{ plans: GymPlanOption[] }>(`/gyms/${gymId}/membership-plans`),

  updateMembershipPlans: (gymId: string, plans: GymPlanOption[]) =>
    api.put<{ plans: GymPlanOption[] }>(`/gyms/${gymId}/membership-plans`, { plans }),
};

export interface GymPlanOption {
  id: string;
  name: string;
  durationMonths: number;
  price: number;
  badge?: string;
  description: string;
  isActive?: boolean;
}

export interface DashboardOverview {
  totalActiveMembers: number;
  totalTrainers: number;
  todayCheckIns: number;
  revenueThisMonth: number;
  membershipsExpiringIn7Days: number;
  avgAttendanceRate30d: number;
}

export const reportApi = {
  getOverview: (gymId: string, branchId?: string) =>
    api.get<DashboardOverview>(`/gyms/${gymId}/dashboard/overview${branchId ? `?branchId=${branchId}` : ""}`),

  getExpiringMemberships: (gymId: string) =>
    api.get<{ expiringMemberships: any[] } | any[]>(`/gyms/${gymId}/dashboard/expiring-memberships`),

  listReports: (gymId: string) => api.get<{ reports: any[] }>(`/gyms/${gymId}/reports`),

  getReportById: (gymId: string, reportRequestId: string) =>
    api.get<any>(`/gyms/${gymId}/reports/${reportRequestId}`),

  requestReport: (
    gymId: string,
    input: { reportType: string; scope: string; periodStart: string; periodEnd: string; format: string }
  ) => api.post<{ reportRequest: any }>(`/gyms/${gymId}/reports`, input),

  getBranchComparison: (gymId: string, metric?: string, period?: string) =>
    api.get<any>(`/gyms/${gymId}/analytics/branch-comparison?metric=${metric || "revenue"}&period=${period || "30d"}`),
};

export const trainerApi = {
  list: (gymId: string, branchId?: string) =>
    api.get<{ trainers: ITrainer[] }>(
      branchId
        ? `/gyms/${gymId}/branches/${branchId}/trainers`
        : `/gyms/${gymId}/trainers`
    ),

  getById: (gymId: string, trainerId: string) =>
    api.get<{ trainer: ITrainer }>(`/gyms/${gymId}/trainers/${trainerId}`),

  create: (gymId: string, branchId: string, data: Partial<ITrainer> | Record<string, unknown>) =>
    api.post<{ trainer: ITrainer }>(`/gyms/${gymId}/branches/${branchId}/trainers`, data),

  update: (gymId: string, trainerId: string, data: Partial<ITrainer> | Record<string, unknown>) =>
    api.patch<{ trainer: ITrainer }>(`/gyms/${gymId}/trainers/${trainerId}`, data),

  assignClient: (gymId: string, _branchId: string, _trainerId: string, memberId: string) =>
    api.patch<{ success: boolean }>(`/gyms/${gymId}/members/${memberId}/assign-trainer`, { trainerId: _trainerId }),

  getWorkload: (gymId: string, trainerId: string) =>
    api.get<{ activeMembersAssigned: number }>(`/gyms/${gymId}/trainers/${trainerId}/workload`),

  getMyClients: (gymId: string) =>
    api.get<{ clients: IMemberClient[] }>(`/gyms/${gymId}/trainers/me/clients`),

  delete: (gymId: string, trainerId: string) =>
    api.delete<{ success: boolean; message?: string }>(`/gyms/${gymId}/trainers/${trainerId}`),
};

export const staffApi = {
  list: (gymId: string, branchId?: string) =>
    api.get<{ staff: IStaffUser[] }>(branchId ? `/gyms/${gymId}/branches/${branchId}/staff` : `/gyms/${gymId}/staff`),

  create: (gymId: string, branchId?: string, data?: Partial<IStaffUser> | Record<string, unknown>) =>
    api.post<{ staff: IStaffUser }>(branchId ? `/gyms/${gymId}/branches/${branchId}/staff` : `/gyms/${gymId}/staff`, data),

  delete: (gymId: string, staffId: string, branchId?: string) =>
    api.delete<{ success: boolean; message?: string }>(branchId ? `/gyms/${gymId}/branches/${branchId}/staff/${staffId}` : `/gyms/${gymId}/staff/${staffId}`),
};

export const memberApi = {
  list: (gymId: string, branchId?: string) =>
    api.get<{ members: IMember[]; meta?: { total: number; page: number; limit: number } }>(
      branchId ? `/gyms/${gymId}/branches/${branchId}/members` : `/gyms/${gymId}/members`
    ),

  create: (gymId: string, branchId?: string, data?: Record<string, unknown>) =>
    api.post<{ member: IMember }>(branchId ? `/gyms/${gymId}/branches/${branchId}/members` : `/gyms/${gymId}/members`, data),

  getMemberById: (gymId: string, memberId: string) =>
    api.get<{ member: IMember }>(`/gyms/${gymId}/members/${memberId}`),

  updateMember: (gymId: string, memberId: string, data: Partial<IMember> | Record<string, unknown>) =>
    api.patch<{ member: IMember }>(`/gyms/${gymId}/members/${memberId}`, data),

  deleteMember: (gymId: string, memberId: string) =>
    api.delete<{ success: boolean }>(`/gyms/${gymId}/members/${memberId}`),

  freeze: (gymId: string, _branchId: string, memberId: string, reason: string, startDate?: string, endDate?: string) =>
    api.patch<{ member: IMember }>(`/gyms/${gymId}/members/${memberId}/freeze`, { freezeUntil: endDate || startDate, reason }),

  extend: (gymId: string, _branchId: string, memberId: string, days: number, reason: string) =>
    api.patch<{ member: IMember }>(`/gyms/${gymId}/members/${memberId}/extend`, { days, reason }),

  cancel: (gymId: string, _branchId: string, memberId: string, reason: string) =>
    api.patch<{ member: IMember }>(`/gyms/${gymId}/members/${memberId}/cancel`, { reason }),

  renew: (gymId: string, _branchId: string, memberId: string, data: { newEndDate: string; planName?: string }) =>
    api.patch<{ member: IMember }>(`/gyms/${gymId}/members/${memberId}/renew`, data),

  regenerateQR: (gymId: string, memberId: string) =>
    api.post<{ qrCode: string }>(`/gyms/${gymId}/members/${memberId}/regenerate-qr`),

  getMemberQR: (gymId: string, memberId: string) =>
    api.get<{ qrCode: string }>(`/gyms/${gymId}/members/${memberId}/qr`),

  getSelfProfile: () => api.get<{ member: IMember }>("/members/me"),

  updateMe: (data: Partial<IMember> | Record<string, unknown>) => api.patch<{ member: IMember }>("/members/me", data),

  getMyReferralStats: () => api.get<Record<string, unknown>>("/members/me/referral-stats"),

  sendReferralAsk: (memberId: string) => api.post<{ success: boolean }>(`/members/${memberId}/referral-ask`),
};

export const attendanceApi = {
  checkIn: (
    gymIdOrPayload: string | { gymId?: string; branchId?: string; qrToken?: string; memberId?: string; identifier?: string },
    branchId?: string,
    identifier?: string
  ) => {
    if (typeof gymIdOrPayload === "object") {
      return api.post<IAttendanceCheckInResponse>("/attendance/check-in", gymIdOrPayload);
    }
    const payload: Record<string, unknown> = { gymId: gymIdOrPayload, branchId };
    if (identifier?.startsWith("DYN_QR_") || identifier?.includes("_QR_")) {
      payload.qrToken = identifier;
    } else if (identifier) {
      payload.memberId = identifier;
    }
    return api.post<IAttendanceCheckInResponse>("/attendance/check-in", payload);
  },

  checkOut: (attendanceId: string) => api.post<{ success: boolean }>("/attendance/check-out", { attendanceId }),

  manualCheckInOut: (data: Record<string, unknown>) => api.post<IAttendanceCheckInResponse>("/attendance/manual", data),

  generateQR: (gymId: string, branchId?: string, ttlSeconds: number = 25) =>
    api.get<{ qrToken: string; qrCodeDataUrl: string; ttlSeconds: number; expiresAt: string }>(
      branchId
        ? `/gyms/${gymId}/branches/${branchId}/attendance/generate-qr?ttlSeconds=${ttlSeconds}`
        : `/gyms/${gymId}/attendance/generate-qr?ttlSeconds=${ttlSeconds}`
    ),

  getToday: (gymId: string, branchId?: string) =>
    api.get<{ attendance: Array<Record<string, unknown>> }>(
      branchId
        ? `/gyms/${gymId}/branches/${branchId}/attendance/daily`
        : `/gyms/${gymId}/attendance/daily`
    ),

  getCurrentSession: () => api.get<Record<string, unknown> | null>("/attendance/me/current"),

  getMyHistory: () => api.get<Array<Record<string, unknown>>>("/attendance/me/history"),

  getMyStats: () => api.get<Record<string, unknown>>("/attendance/me/stats"),

  getHeatmap: (gymId: string, branchId?: string) =>
    api.get<{ weeks: number[][]; avgAttendanceRate30d: number }>(
      branchId
        ? `/gyms/${gymId}/branches/${branchId}/attendance/heatmap`
        : `/gyms/${gymId}/attendance-heatmap`
    ),
};

export const workoutApi = {
  listExercises: () => api.get<IExerciseLibraryItem[]>("/exercises"),

  getExerciseById: (exerciseId: string) => api.get<IExerciseLibraryItem>(`/exercises/${exerciseId}`),

  createExercise: (data: Partial<IExerciseLibraryItem> | Record<string, unknown>) =>
    api.post<{ exercise: IExerciseLibraryItem }>("/exercises", data),

  updateExercise: (exerciseId: string, data: Partial<IExerciseLibraryItem> | Record<string, unknown>) =>
    api.patch<{ exercise: IExerciseLibraryItem }>(`/exercises/${exerciseId}`, data),

  deleteExercise: (exerciseId: string) => api.delete<{ success: boolean }>(`/exercises/${exerciseId}`),

  seedGlobalExercises: () => api.post<{ success: boolean; count?: number }>("/exercises/seed-global"),

  listPlans: (memberId: string) => api.get<IWorkoutPlan[]>(`/members/${memberId}/workout-plans`),

  getActivePlan: (memberId: string) => api.get<{ plan: IWorkoutPlan | null }>(`/members/${memberId}/workout-plans/active`),

  createPlan: (memberId: string, data: Partial<IWorkoutPlan> | Record<string, unknown>) =>
    api.post<{ plan: IWorkoutPlan }>(`/members/${memberId}/workout-plans`, data),

  updatePlan: (planId: string, data: Partial<IWorkoutPlan> | Record<string, unknown>) =>
    api.patch<{ plan: IWorkoutPlan }>(`/workout-plans/${planId}`, data),

  archivePlan: (planId: string) => api.patch<{ plan: IWorkoutPlan }>(`/workout-plans/${planId}/archive`),

  deletePlan: (planId: string) => api.delete<{ success: boolean }>(`/workout-plans/${planId}`),

  duplicatePlan: (planId: string) => api.post<{ plan: IWorkoutPlan }>(`/workout-plans/${planId}/duplicate`),

  logWorkout: (data: Record<string, unknown>) => api.post<Record<string, unknown>>("/workout-logs/start", data),

  logSetProgress: (logId: string, exerciseId: string, setNumber: number, data: { reps: number; weightKg?: number; completed?: boolean }) =>
    api.patch<Record<string, unknown>>(`/workout-logs/${logId}/exercises/${exerciseId}/sets/${setNumber}`, data),

  markExerciseComplete: (logId: string, exerciseId: string) =>
    api.patch<Record<string, unknown>>(`/workout-logs/${logId}/exercises/${exerciseId}/complete`),

  completeWorkoutLog: (logId: string) =>
    api.patch<Record<string, unknown>>(`/workout-logs/${logId}/complete`),

  getHistory: (memberId: string, page = 1, limit = 10) =>
    api.get<{ logs: Array<Record<string, unknown>>; meta?: { total: number; page: number; limit: number } }>(
      `/members/${memberId}/workout-logs?page=${page}&limit=${limit}`
    ),

  getCompletionStats: (memberId: string) => api.get<Record<string, unknown>>(`/members/${memberId}/workout-stats`),

  getTodayWorkout: (memberId?: string) =>
    api.get<{ today: Record<string, unknown> | null }>(`/workout-logs/today${memberId ? `?memberId=${memberId}` : ""}`),

  toggleExerciseToday: (exerciseId: string) =>
    api.patch<{ today: Record<string, unknown> }>("/workout-logs/today", { exerciseId }),

  getProgressAnalytics: (days = 7, memberId?: string) =>
    api.get<{ data: Array<{ date: string; completionPercentage: number }> }>(
      `/workout-logs/analytics/progress?days=${days}${memberId ? `&memberId=${memberId}` : ""}`
    ),
};

export const dietApi = {
  listPlans: (memberId: string) => api.get<IDietPlan[]>(`/members/${memberId}/diet-plans`),

  createPlan: (memberId: string, data: Partial<IDietPlan> | Record<string, unknown>) =>
    api.post<{ plan: IDietPlan }>(`/members/${memberId}/diet-plans`, data),

  getActive: (memberId: string) =>
    api.get<{ plan?: IDietPlan | null; dietPlan?: IDietPlan | null }>(`/members/${memberId}/diet-plans/active`),

  updatePlan: (planId: string, data: Partial<IDietPlan> | Record<string, unknown>) =>
    api.patch<{ plan: IDietPlan }>(`/diet-plans/${planId}`, data),

  archivePlan: (planId: string) => api.patch<{ plan: IDietPlan }>(`/diet-plans/${planId}/archive`),

  deletePlan: (planId: string) => api.delete<{ success: boolean }>(`/diet-plans/${planId}`),
};

export const progressApi = {
  getHistory: (memberId?: string) => api.get<{ history: Array<Record<string, unknown>> }>(`/progress/weight/history${memberId ? `/${memberId}` : ""}`),

  logWeight: (
    payload: number | { memberId?: string; weightKg: number; heightCm?: number; targetWeightKg?: number; notes?: string },
    notes?: string
  ) => {
    const body = typeof payload === "number" ? { weightKg: payload, notes } : payload;
    return api.post<{ log: Record<string, unknown> }>("/progress/weight", body);
  },

  uploadPhoto: (data: { image?: string; imageUrl?: string; photoUrl?: string; angle?: 'front' | 'side' | 'back'; notes?: string }) =>
    api.post<{ photo: Record<string, unknown> }>("/progress/photos", data),

  getPhotos: (memberId?: string) => api.get<{ photos: Array<Record<string, unknown>> }>(memberId ? `/progress/photos/${memberId}` : "/progress/photos"),

  deletePhoto: (photoId: string) => api.delete<{ success: boolean }>(`/progress/photos/${photoId}`),

  logWellness: (data: {
    waterIntakeMl?: number;
    sleepHours?: number;
    mood?: "great" | "good" | "okay" | "tired" | "stressed";
    energyRating?: number;
    stressLevel?: string;
    sorenessNotes?: string;
    dayKey?: string;
  }) => api.patch<Record<string, unknown>>("/progress/wellness", data),

  getWellnessHistory: (memberId?: string) =>
    api.get<IWellnessHistoryResponse>(`/progress/wellness/history${memberId ? `/${memberId}` : ""}`),

  logDietMeal: (data: { mealType: string; calories?: number; proteinGrams?: number; carbsGrams?: number; fatGrams?: number; notes?: string }) =>
    api.post<{ meal: Record<string, unknown> }>("/progress/diet-log", data),

  getDietLogs: () => api.get<Array<Record<string, unknown>>>("/progress/diet-log"),

  getSummary: () => api.get<Record<string, unknown>>("/progress/summary"),
};

export const gamificationApi = {
  getMyProfile: () => api.get<Record<string, unknown>>("/gamification/me"),

  updateRestDays: (restDays: string[]) => api.put<{ success: boolean }>("/gamification/me/rest-days", { restDays }),

  getLeaderboard: (gymId?: string, type?: string) => {
    const params = new URLSearchParams();
    if (gymId) params.append("gymId", gymId);
    if (type) params.append("type", type);
    const q = params.toString();
    return api.get<{ leaderboard: Array<Record<string, unknown>> }>(`/gamification/leaderboard${q ? `?${q}` : ""}`);
  },

  listChallenges: (gymId?: string) => api.get<Array<Record<string, unknown>>>(`/gamification/challenges${gymId ? `?gymId=${gymId}` : ""}`),

  createChallenge: (gymId: string, data: Record<string, unknown>) => api.post<{ challenge: Record<string, unknown> }>(`/gyms/${gymId}/challenges`, data),

  joinChallenge: (challengeId: string) => api.post<{ success: boolean }>(`/gamification/challenges/${challengeId}/join`),
};

export const paymentApi = {
  listMemberPayments: (gymId: string) => api.get<{ payments: IPayment[] }>(`/gyms/${gymId}/payments`),

  recordMemberPayment: (gymId: string, data: Partial<IPayment> | Record<string, unknown>) =>
    api.post<{ payment: IPayment }>(`/gyms/${gymId}/payments/manual`, data),

  initiateOnlineOrder: (gymId: string, data: { amount: number; planName?: string; billingCycle?: string }) =>
    api.post<{ orderId: string; amount: number; currency: string }>(`/gyms/${gymId}/payments/online-order`, data),

  refundPayment: (gymId: string, paymentId: string, reason?: string) =>
    api.patch<{ payment: IPayment }>(`/gyms/${gymId}/payments/${paymentId}/refund`, { reason }),

  update: (gymId: string, paymentId: string, data: Partial<IPayment> | Record<string, unknown>) =>
    api.patch<{ payment: IPayment }>(`/gyms/${gymId}/payments/${paymentId}`, data),

  delete: (gymId: string, paymentId: string) =>
    api.delete<{ success: boolean }>(`/gyms/${gymId}/payments/${paymentId}`),

  getRevenueSummary: (gymId: string) => api.get<Record<string, unknown>>(`/gyms/${gymId}/payments/revenue-summary`),

  getMyPayments: (gymId: string) => api.get<{ payments: IPayment[] }>(`/gyms/${gymId}/payments/me`),

  getPlatformBilling: () => api.get<Record<string, unknown>>("/billing/platform/invoices"),

  upgradePlatformTier: (planId: string) => api.post<Record<string, unknown>>("/billing/platform/upgrade", { planId }),

  getPlatformAnalyticsOverview: () => api.get<Record<string, unknown>>("/billing/platform/analytics/overview"),

  recordManualPlatformPayment: (gymId: string, data: Record<string, unknown>) =>
    api.post<Record<string, unknown>>(`/billing/platform/gyms/${gymId}/manual-payment`, data),

  requestUpgrade: (gymId: string, data: { requestedPlan: string; billingCycle?: string; notes?: string }) =>
    api.post<Record<string, unknown>>(`/billing/platform/gyms/${gymId}/upgrade-request`, data),

  cancelUpgradeRequest: (gymId: string) =>
    api.delete<{ success: boolean; count?: number }>(`/billing/platform/gyms/${gymId}/upgrade-request`),

  listUpgradeRequests: () => api.get<Array<Record<string, unknown>>>("/billing/platform/upgrade-requests"),
  getPlatformSettings: () => api.get<{ settings: Record<string, any> }>("/billing/platform/settings"),
  updatePlatformSettings: (data: Record<string, any>) => api.put<{ settings: Record<string, any> }>("/billing/platform/settings", data),
};

export const aiApi = {
  getWeeklyDigest: (gymId: string, refresh?: boolean) =>
    api.get<{ weeklyDigest: string }>(
      `/ai/gyms/${gymId}/insights/weekly-digest${refresh ? "?refresh=true" : ""}`
    ),

  getAtRiskMembers: (gymId: string, riskLevel?: string) =>
    api.get<Array<Record<string, unknown>>>(`/ai/gyms/${gymId}/at-risk-members${riskLevel ? `?riskLevel=${riskLevel}` : ""}`),

  getTrainerPerformance: (gymId: string) => api.get<Array<Record<string, unknown>>>(`/ai/gyms/${gymId}/insights/trainer-performance`),

  getPeakHours: (gymId: string) => api.get<Record<string, unknown>>(`/ai/gyms/${gymId}/insights/peak-hours`),

  getRevenueForecast: (gymId: string) => api.get<Record<string, unknown>>(`/ai/gyms/${gymId}/insights/revenue-forecast`),

  getPlanProfitability: (gymId: string) => api.get<Record<string, unknown>>(`/ai/gyms/${gymId}/insights/plan-profitability`),

  getSuggestions: (memberId: string) => api.get<Record<string, unknown>>(`/ai/members/${memberId}/suggestions`),

  getDietRecommendation: (memberId: string) => api.get<Record<string, unknown>>(`/ai/members/${memberId}/diet-recommendation`),

  getReports: (memberId: string) => api.get<Array<Record<string, unknown>>>(`/ai/members/${memberId}/reports`),

  generateReport: (memberId: string) => api.post<Record<string, unknown>>(`/ai/members/${memberId}/reports`),

  getGoalPrediction: (memberId: string) => api.get<Record<string, unknown>>(`/ai/members/${memberId}/goal-prediction`),

  startConversation: (firstMessage: string) =>
    api.post<{
      conversation: { _id: string; title: string };
      replyMessage: { content: string };
      quota?: { isExceeded: boolean; todayCount: number; limit: number; remaining: number };
    }>("/ai/chat/conversations", { firstMessage }),

  sendMessage: (conversationId: string, content: string) =>
    api.post<{
      replyMessage: { content: string; role: string };
      quota?: { isExceeded: boolean; todayCount: number; limit: number; remaining: number };
    }>(`/ai/chat/conversations/${conversationId}/messages`, { content }),

  getHistory: (conversationId: string) =>
    api.get<{ messages: { _id: string; role: string; content: string; createdAt: string }[] }>(`/ai/chat/conversations/${conversationId}/messages`),

  listConversations: () =>
    api.get<{ conversations: { _id: string; title: string; lastMessageAt: string }[] }>("/ai/chat/conversations"),

  archiveConversation: (conversationId: string) =>
    api.patch<{ success: boolean }>(`/ai/chat/conversations/${conversationId}/archive`),

  getUpsellRecommendation: (memberId?: string) =>
    api.get<Record<string, unknown>>(`/ai/members/${memberId || "me"}/upsell-recommendation`),

  getRecoveryStatus: (memberId?: string) =>
    api.get<IRecoveryStatus>(`/ai/members/${memberId || "me"}/recovery-status`),

  getChatDailyLimit: () =>
    api.get<{ isExceeded: boolean; todayCount: number; limit: number; remaining: number }>("/ai/chat/daily-limit"),
};

export const productApi = {
  list: (gymId: string, branchId?: string) =>
    api.get<any[]>(`/gyms/${gymId}/products${branchId ? `?branchId=${branchId}` : ""}`),

  add: (gymId: string, data: any) => api.post<any>(`/gyms/${gymId}/products`, data),

  update: (productId: string, data: any) => api.patch<any>(`/products/${productId}`, data),

  delete: (productId: string) => api.delete<any>(`/products/${productId}`),

  checkout: (productId: string, data: { quantity: number; memberId?: string; paymentMethod?: string; notes?: string }) =>
    api.post<any>(`/products/${productId}/purchase`, data),
};

export const expenseApi = {
  list: (gymId: string) => api.get<any[]>(`/gyms/${gymId}/expenses`),

  add: (gymId: string, data: any) => api.post<any>(`/gyms/${gymId}/expenses`, data),

  getProfitSummary: (gymId: string) => api.get<any>(`/gyms/${gymId}/dashboard/profit-summary`),

  update: (expenseId: string, data: any) => api.patch<any>(`/expenses/${expenseId}`, data),

  delete: (expenseId: string) => api.delete<any>(`/expenses/${expenseId}`),
};

export const equipmentApi = {
  list: (gymId: string, branchId?: string) =>
    api.get<any[]>(branchId ? `/gyms/${gymId}/branches/${branchId}/equipment` : `/gyms/${gymId}/equipment`),

  getMaintenanceDue: (gymId: string, branchId?: string) =>
    api.get<any[]>(`/gyms/${gymId}/equipment/maintenance-due${branchId ? `?branchId=${branchId}` : ""}`),

  add: (gymId: string, branchId?: string, data?: any) =>
    api.post<any>(branchId ? `/gyms/${gymId}/branches/${branchId}/equipment` : `/gyms/${gymId}/equipment`, data),

  updateStatus: (id: string, status: string) => api.patch<any>(`/equipment/${id}`, { status }),

  update: (id: string, data: any) => api.patch<any>(`/equipment/${id}`, data),

  delete: (id: string) => api.delete<any>(`/equipment/${id}`),
};

export interface INotificationItem {
  _id: string;
  id?: string;
  title: string;
  body: string;
  type?: string;
  isRead: boolean;
  readAt?: string;
  createdAt: string;
  data?: Record<string, string>;
}

export interface NotificationPaginationMeta {
  page: number;
  limit: number;
  totalItems: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export const notificationApi = {
  list: (params?: { page?: number; limit?: number; isRead?: boolean; type?: string }) => {
    const query = new URLSearchParams();
    if (params?.page) query.append("page", params.page.toString());
    if (params?.limit) query.append("limit", params.limit.toString());
    if (params?.isRead !== undefined) query.append("isRead", params.isRead.toString());
    if (params?.type) query.append("type", params.type);
    const qStr = query.toString();
    return api.get<{ notifications: INotificationItem[]; pagination?: NotificationPaginationMeta }>(
      `/notifications${qStr ? `?${qStr}` : ""}`
    );
  },

  getUnreadCount: () => api.get<{ unreadCount: number }>("/notifications/unread-count"),

  markAsRead: (notificationId: string) =>
    api.patch<{ notification: INotificationItem }>(`/notifications/${notificationId}/read`),

  markAllAsRead: () => api.patch<{ markedCount: number }>("/notifications/read-all"),

  registerDeviceToken: (deviceToken: string, platform: string = "web") =>
    api.post<any>("/notifications/device-token", { deviceToken, platform }),

  deactivateDeviceToken: (deviceToken: string) =>
    api.delete<any>("/notifications/device-token", { body: { deviceToken } }),

  broadcast: (gymId: string, data: { title: string; message?: string; body?: string; targetRole?: string }) =>
    api.post<any>(`/gyms/${gymId}/notifications/broadcast`, data),
};

export const privacyApi = {
  exportData: () => api.get<any>("/users/me/export-data"),
  requestDeletion: () => api.post<any>("/users/me/request-deletion"),
  cancelDeletion: () => api.post<any>("/users/me/cancel-deletion"),
};

export const feedbackApi = {
  create: (memberId: string, data: { note: string; rating?: number; workoutLogId?: string }) =>
    api.post<any>(`/members/${memberId}/feedback`, { memberId, ...data }),

  list: (memberId: string) => api.get<any>(`/members/${memberId}/feedback`),

  update: (feedbackId: string, data: any) => api.patch<any>(`/feedback/${feedbackId}`, data),

  delete: (feedbackId: string) => api.delete<any>(`/feedback/${feedbackId}`),
};

export const jobApi = {
  runReminders: (gymId: string) => api.post<any>(`/gyms/${gymId}/jobs/run-reminders`),
};

export const saasInquiryApi = {
  create: (data: {
    ownerName: string;
    gymName: string;
    phone: string;
    city: string;
    email?: string;
    message?: string;
  }) => api.post<{ id: string; ownerName: string; gymName: string }>("/public/saas-inquiry", data),

  list: (params?: { status?: string; page?: number; limit?: number }) => {
    const sp = new URLSearchParams();
    if (params?.status) sp.set("status", params.status);
    if (params?.page) sp.set("page", String(params.page));
    if (params?.limit) sp.set("limit", String(params.limit));
    const qs = sp.toString() ? `?${sp.toString()}` : "";
    return api.get<{ inquiries: any[]; total: number; page: number; totalPages: number }>(`/admin/saas-inquiries${qs}`);
  },

  updateStatus: (id: string, data: { status: string; note?: string; trialGymId?: string }) =>
    api.patch<any>(`/admin/saas-inquiries/${id}/status`, data),

  addNote: (id: string, note: string) =>
    api.post<any>(`/admin/saas-inquiries/${id}/notes`, { note }),
};