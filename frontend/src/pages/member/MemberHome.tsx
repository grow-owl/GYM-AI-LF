import { useState, useEffect, useCallback, useMemo } from "react";
import { Link } from "react-router-dom";
import { ShieldCheck, AlertCircle, QrCode, Camera, MapPin, Lock } from "lucide-react";
import { memberApi, progressApi, attendanceApi, workoutApi, feedbackApi, gamificationApi } from "@/lib/endpoints";
import { useAuthStore } from "@/store/authStore";
import { useAttendanceStore } from "@/store/attendanceStore";
import { showApiErrorToast } from "@/lib/api";
import PerformanceCharts from "@/components/member/PerformanceCharts";
import ConsistencyProgressTracker from "@/components/member/ConsistencyProgressTracker";
import LeaderboardCard from "@/components/member/LeaderboardCard";
import WorkoutDietOverview from "@/components/member/WorkoutDietOverview";
import QuickActionDrawer from "@/components/member/QuickActionDrawer";
import { getShortBranchName, getCleanDesktopBranchName } from "@/lib/branchUtils";

export default function MemberHome() {
  const user = useAuthStore((s) => s.user);
  const { isCheckedIn, fetchCurrentSession, initialized } = useAttendanceStore();

  useEffect(() => {
    if (!initialized) {
      fetchCurrentSession();
    }
  }, [initialized, fetchCurrentSession]);
  
  // Primary States
  const [loading, setLoading] = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [memberProfile, setMemberProfile] = useState<any | null>(null);
  const [gameProfile, setGameProfile] = useState<any | null>(null);
  const [weightLogs, setWeightLogs] = useState<any[]>([]);
  const [attendanceStats, setAttendanceStats] = useState<any | null>(null);
  const [completedWorkoutsCount, setCompletedWorkoutsCount] = useState<number>(0);
  const [workoutVolumeLogs, setWorkoutVolumeLogs] = useState<any[]>([]);
  const [activePlanName, setActivePlanName] = useState<string | null>(null);
  const [activePlanDescription, setActivePlanDescription] = useState<string | null>(null);
  const [trainerFeedbacks, setTrainerFeedbacks] = useState<any[]>([]);

  // Modal State
  const [activeModal, setActiveModal] = useState<"weight" | "feedback" | "privacy" | "referral" | null>(null);

  const fetchDashboardData = useCallback(async () => {
    setLoading(true);
    setProfileError(null);
    try {
      // 1. Get Self Member Profile
      const profRes = await memberApi.getSelfProfile().catch(() => null);
      const m = profRes?.member;
      if (m) setMemberProfile(m);

      const memberId = m?._id || user?._id;
      const gymId = m?.gymId || user?.gymId;

      if (!memberId && !gymId) {
        setProfileError("Couldn't load your profile — please try logging in again.");
        return;
      }

      // 2. Fetch parallel endpoints
      const [weightRes, attStatsRes, workoutStatsRes, feedbackRes, gameProfRes] = await Promise.all([
        memberId ? progressApi.getHistory(memberId).catch(() => null) : null,
        attendanceApi.getMyStats().catch(() => null),
        memberId ? workoutApi.getCompletionStats(memberId).catch(() => null) : null,
        memberId ? feedbackApi.list(memberId).catch(() => null) : null,
        gamificationApi.getMyProfile().catch(() => null),
      ]);

      if (weightRes) {
        const logs = Array.isArray(weightRes) ? weightRes : weightRes?.history || weightRes?.logs || [];
        setWeightLogs(logs);
      }
      if (attStatsRes) setAttendanceStats(attStatsRes);
      if (gameProfRes) {
        const gProf = (gameProfRes as any)?.profile || (gameProfRes as any)?.gameProfile || gameProfRes;
        setGameProfile(gProf);
      }
      if (workoutStatsRes) {
        const stats = workoutStatsRes?.stats || workoutStatsRes;
        const count = stats?.totalWorkoutSessions ?? 0;
        setCompletedWorkoutsCount(count);
        if (stats?.weeklyVolumeLogs && Array.isArray(stats.weeklyVolumeLogs)) {
          setWorkoutVolumeLogs(stats.weeklyVolumeLogs);
        }
      }

      if (feedbackRes) {
        const fbs = Array.isArray(feedbackRes)
          ? feedbackRes
          : feedbackRes?.feedbacks || feedbackRes?.feedback || feedbackRes?.data || [];
        setTrainerFeedbacks(fbs);
      } else {
        setTrainerFeedbacks([]);
      }

      if (memberId) {
        const planRes = await workoutApi.getActivePlan(memberId).catch(() => null);
        const plan = planRes?.plan || planRes;
        if (plan && (plan.name || plan.title)) {
          setActivePlanName(plan.title || plan.name);
          setActivePlanDescription(plan.description || null);
        } else {
          setActivePlanName(null);
          setActivePlanDescription(null);
        }
      }

    } catch (err: any) {
      console.error("Dashboard fetch error:", err);
      showApiErrorToast(err, "Failed to refresh dashboard data");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const memberName = memberProfile?.userId?.fullName || user?.fullName || "Gym Member";
  const referralCode = memberProfile?.referralCode || "";
  const gymId = memberProfile?.gymId || user?.gymId || "";
  
  const rawBranch = memberProfile?.branchId;
  const branchName = (typeof rawBranch === "object" && rawBranch !== null ? rawBranch.name : user?.branchName) || "";
  const branchCity = (typeof rawBranch === "object" && rawBranch !== null ? rawBranch.city || rawBranch.address?.city : null) || user?.city || "";
  const memberId = memberProfile?._id || user?._id || "";

  const displayBranchName = useMemo(() => {
    return getCleanDesktopBranchName(branchName);
  }, [branchName]);

  const shortBranchName = useMemo(() => {
    return getShortBranchName(branchName, user?.gymName, branchCity);
  }, [branchName, user?.gymName, branchCity]);

  // Single Source of Truth for Streak & Level
  const streakDays =
    gameProfile?.currentStreakDays ??
    attendanceStats?.currentStreak ??
    memberProfile?.currentStreakDays ??
    0;

  const gymLevel =
    gameProfile?.level ??
    memberProfile?.gamificationLevel ??
    1;

  // Strict Membership Validity Calculation
  const remainingInfo = useMemo(() => {
    if (loading) {
      return {
        status: "loading" as const,
        text: "Validating...",
        pillClass: "bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700 animate-pulse",
      };
    }

    const endDateStr = memberProfile?.membershipEndDate;
    if (!endDateStr) {
      return {
        status: "missing" as const,
        text: "Expiry Unavailable",
        pillClass: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800",
      };
    }

    const end = new Date(endDateStr);
    if (isNaN(end.getTime())) {
      return {
        status: "invalid" as const,
        text: "Invalid Date",
        pillClass: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800",
      };
    }

    // Normalize to 23:59:59.999 of target date
    const target = new Date(end);
    target.setHours(23, 59, 59, 999);

    const now = new Date();
    const diffMs = target.getTime() - now.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays > 1) {
      return {
        status: "active" as const,
        text: `Active • ${diffDays} Days Left`,
        pillClass: "bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800",
      };
    }
    if (diffDays === 1) {
      return {
        status: "active" as const,
        text: "Active • 1 Day Left",
        pillClass: "bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800",
      };
    }
    if (diffDays === 0) {
      return {
        status: "expiring" as const,
        text: "Expires Today",
        pillClass: "bg-amber-50 text-amber-900 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800",
      };
    }
    return {
      status: "expired" as const,
      text: `Expired (${Math.abs(diffDays)}d ago)`,
      pillClass: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800",
    };
  }, [loading, memberProfile?.membershipEndDate]);

  // Trainer / Coach Speech Bubble Note Resolution
  const assignedTrainer = memberProfile?.assignedTrainerId;
  const trainerUser = typeof assignedTrainer === "object" && assignedTrainer !== null ? (assignedTrainer as any).userId : null;
  const trainerName = trainerUser?.fullName?.split(" ")[0] || (typeof assignedTrainer === "object" && assignedTrainer !== null && (assignedTrainer as any).fullName ? (assignedTrainer as any).fullName.split(" ")[0] : null);
  const trainerInitial = trainerName ? trainerName.charAt(0).toUpperCase() : "T";
  const trainerAvatarUrl = trainerUser?.profilePicture || (typeof assignedTrainer === "object" && assignedTrainer !== null ? (assignedTrainer as any).avatarUrl : null);

  const trainerNoteTitle = trainerName ? `${trainerName}'s Note:` : "Trainer's Note:";

  const trainerNoteData = useMemo(() => {
    // 1. Check real trainer feedback from database (TrainerFeedback model)
    if (trainerFeedbacks && trainerFeedbacks.length > 0) {
      const validFeedbacks = trainerFeedbacks.filter(
        (f) => f && f.note && typeof f.note === "string" && f.note.trim().length > 0
      );
      if (validFeedbacks.length > 0) {
        const sorted = [...validFeedbacks].sort(
          (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
        );
        const latest = sorted[0];

        let dateLabel = "";
        if (latest.createdAt) {
          const d = new Date(latest.createdAt);
          if (!isNaN(d.getTime())) {
            dateLabel = d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
          }
        }

        return {
          hasRealNote: true,
          message: latest.note.trim(),
          dateLabel,
          rating: latest.rating,
        };
      }
    }

    // 2. Check active plan description from coach/trainer
    if (activePlanDescription && activePlanDescription.trim()) {
      return {
        hasRealNote: true,
        message: activePlanDescription.trim(),
        dateLabel: "Routine Guidance",
      };
    }

    // 3. Proper standard English empty state message (zero hard-coded fake text)
    return {
      hasRealNote: false,
      message: trainerName
        ? `No active notes from ${trainerName} yet. Coaching guidance and workout feedback will appear here.`
        : "No active trainer notes yet. Coaching guidance and workout feedback will appear here.",
      dateLabel: "",
    };
  }, [trainerFeedbacks, activePlanDescription, trainerName]);

  if (!loading && profileError) {
    return (
      <div className="flex flex-col items-center justify-center p-8 bg-(--color-surface) rounded-2xl border border-(--color-border) text-center space-y-4">
        <AlertCircle className="h-10 w-10 text-amber-400 animate-bounce" />
        <h2 className="text-lg font-bold text-(--color-text)">Profile Load Error</h2>
        <p className="text-xs text-(--color-text-muted) max-w-md">{profileError}</p>
        <button
          onClick={fetchDashboardData}
          className="px-4 py-2 rounded-xl bg-(--color-accent) text-white text-xs font-bold"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6 pb-12">
      {/* ============================================================ */}
      {/* DESKTOP ONLY: Original Banner Layout (lg and above)          */}
      {/* ============================================================ */}
      <div className="hidden lg:block bg-white dark:bg-(--color-surface) p-4 sm:p-5 rounded-2xl border border-(--color-border) shadow-xs transition-all hover:border-(--color-border-soft)">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Member Info Left */}
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="relative flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-600 font-display text-xl font-extrabold text-white shadow-sm ring-2 ring-amber-400/30 shrink-0">
              {memberName.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="font-display text-base sm:text-lg font-extrabold text-(--color-text) truncate">
                  Welcome Back, {memberName}! 👋
                </h1>
                <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 shadow-2xs">
                  ACTIVE MEMBER
                </span>
                {displayBranchName && (
                  <span className="text-[10px] font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 flex items-center gap-1">
                    <MapPin size={11} className="text-amber-500 shrink-0" />
                    <span>{displayBranchName}</span>
                  </span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2 mt-1.5 text-xs">
                {activePlanName ? (
                  <span className="px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-900 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800 font-bold text-[11px] flex items-center gap-1">
                    🎯 Today's Focus: <span className="font-semibold text-amber-950 dark:text-amber-200">{activePlanName}</span>
                  </span>
                ) : (
                  <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700 font-medium text-[11px]">
                    🛋️ Rest & Recovery Day
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Quick Stats & Action Right */}
          <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 border-t lg:border-t-0 border-(--color-border-soft) pt-3 lg:pt-0">
            <div className="flex items-center gap-2.5 sm:gap-3 bg-(--color-surface-2) p-1.5 px-3 rounded-xl border border-(--color-border-soft)">
              <div className="flex items-center gap-1 text-xs">
                <span className="text-sm">🔥</span>
                <div>
                  <span className="text-[9px] text-(--color-text-faint) block uppercase font-bold leading-none">Streak</span>
                  <span className="font-mono text-xs font-bold text-(--color-text)">
                    {streakDays}d
                  </span>
                </div>
              </div>
              <span className="text-(--color-border) text-xs">|</span>
              <div className="flex items-center gap-1 text-xs">
                <span className="text-sm">⭐</span>
                <div>
                  <span className="text-[9px] text-(--color-text-faint) block uppercase font-bold leading-none">Rank</span>
                  <span className="font-mono text-xs font-bold text-amber-600">
                    Lvl {gymLevel}
                  </span>
                </div>
              </div>
            </div>

            {isCheckedIn ? (
              <Link
                to="/member/attendance"
                className="flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 font-bold text-xs shadow-xs transition-all cursor-pointer shrink-0 hover:bg-emerald-500/20"
              >
                <span className="relative flex h-2 w-2 mr-0.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                </span>
                <ShieldCheck className="h-4 w-4 text-emerald-500" />
                <span>Currently Checked In</span>
              </Link>
            ) : (
              <Link
                to="/member/attendance"
                className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-(--color-accent) hover:brightness-105 text-white font-bold text-xs shadow-xs transition-all cursor-pointer shrink-0"
              >
                <Lock className="h-4 w-4" /> Check-In
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* ============================================================ */}
      {/* MOBILE & TABLET: Inspired Card 1 (Welcome & QR Check-In)     */}
      {/* ============================================================ */}
      <div className="lg:hidden">
        <div className="bg-white dark:bg-(--color-surface) p-4 sm:p-5 rounded-2xl sm:rounded-3xl border border-(--color-border) shadow-xs transition-all hover:border-(--color-border-soft) space-y-3.5">
          {/* Top Info Row */}
          <div className="flex items-start gap-3.5 min-w-0">
            {/* Amber Squircle Avatar */}
            <div className="relative flex h-13 w-13 sm:h-14 sm:w-14 items-center justify-center rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-600 font-display text-xl sm:text-2xl font-extrabold text-white shadow-sm ring-2 ring-amber-400/30 shrink-0">
              {memberName.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <span className="text-xs sm:text-sm font-semibold text-(--color-text-muted) block leading-tight">
                Welcome Back,
              </span>
              <h1 className="font-display text-base sm:text-lg font-extrabold text-(--color-text) leading-snug">
                {memberName}! 👋
              </h1>
              <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border shadow-2xs flex items-center gap-1 ${remainingInfo.pillClass}`}>
                  {remainingInfo.status === "missing" || remainingInfo.status === "invalid" ? "⚠️" : "●"} {remainingInfo.text}
                </span>
                {(shortBranchName || displayBranchName) && (
                  <span className="text-[10px] font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 flex items-center gap-1">
                    <MapPin size={11} className="text-amber-500 shrink-0" />
                    <span>{shortBranchName || displayBranchName}</span>
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Balanced Streak & Rank Stat Bar */}
          <div className="grid grid-cols-2 gap-2 bg-(--color-surface-2)/80 p-2.5 rounded-2xl border border-(--color-border-soft)">
            <div className="flex items-center justify-center gap-2 text-xs py-0.5">
              <span className="text-base">🔥</span>
              <div>
                <span className="text-[9px] text-(--color-text-faint) block uppercase font-bold leading-none">Day Streak</span>
                <span className="font-mono text-xs font-extrabold text-(--color-text)">
                  {streakDays} {streakDays === 1 ? "Day" : "Days"}
                </span>
              </div>
            </div>
            <div className="flex items-center justify-center gap-2 text-xs py-0.5 border-l border-(--color-border-soft)">
              <span className="text-base">⭐</span>
              <div>
                <span className="text-[9px] text-(--color-text-faint) block uppercase font-bold leading-none">Gym Level</span>
                <span className="font-mono text-xs font-extrabold text-amber-600">
                  Level {gymLevel}
                </span>
              </div>
            </div>
          </div>

          {/* Full-width High-Contrast QR Code Check-In Action Button */}
          <div className="pt-1">
            {isCheckedIn ? (
              <Link
                to="/member/attendance"
                className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl sm:rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 font-extrabold text-xs sm:text-sm shadow-xs hover:bg-emerald-500/25 transition-all duration-200 cursor-pointer"
              >
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
                </span>
                <ShieldCheck size={18} className="text-emerald-500 shrink-0" />
                <span>CURRENTLY CHECKED IN • TAP TO SCAN OUT</span>
              </Link>
            ) : (
              <Link
                to="/member/attendance"
                className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl sm:rounded-2xl bg-gradient-to-r from-amber-500 via-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-extrabold text-xs sm:text-sm tracking-wide shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer"
              >
                <QrCode size={18} className="stroke-[2.5] shrink-0" />
                <span>QR CODE CHECK-IN</span>
                <Camera size={16} className="opacity-90 shrink-0" />
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* ============================================================ */}
      {/* TRAINER / COACH NOTE: Visible on Desktop, Tablet & Mobile    */}
      {/* ============================================================ */}
      <div className="bg-white dark:bg-(--color-surface) p-3 sm:p-4 rounded-2xl border border-(--color-border) shadow-xs flex items-center gap-3">
        {trainerAvatarUrl ? (
          <img
            src={trainerAvatarUrl}
            alt={trainerName || "Trainer"}
            className="h-11 w-11 rounded-2xl object-cover ring-2 ring-amber-400/20 shrink-0 border border-slate-200 dark:border-slate-700"
          />
        ) : (
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-600 text-white font-extrabold text-xs sm:text-sm shadow-xs ring-2 ring-amber-400/20">
            {trainerInitial}
          </div>
        )}
        <div className="flex-1 min-w-0 bg-slate-100/80 dark:bg-slate-800/60 p-2.5 sm:p-3 rounded-2xl border border-slate-200/60 dark:border-slate-700/60 text-xs text-slate-700 dark:text-slate-200">
          <p className="leading-snug">
            <strong className="font-extrabold text-(--color-text) mr-1">{trainerNoteTitle}</strong>
            <span className={trainerNoteData.hasRealNote ? "text-slate-800 dark:text-slate-100 font-medium" : "text-slate-500 dark:text-slate-400 italic"}>
              {trainerNoteData.message}
            </span>
          </p>
          {trainerNoteData.dateLabel && (
            <div className="flex items-center gap-2 mt-1">
              <span className="text-[10px] text-(--color-text-muted) font-medium">
                {trainerNoteData.dateLabel}
              </span>
              {trainerNoteData.rating && (
                <span className="text-[10px] text-amber-500 font-semibold">
                  {"★".repeat(Math.round(trainerNoteData.rating))}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* SECTION 1: Today's Workout & Active Diet Plan Overview (HERO SECTION) */}
      <WorkoutDietOverview memberId={memberId} />

      {/* SECTION 2: Performance & Progress Charts */}
      <PerformanceCharts
        memberId={memberId}
        weightLogs={weightLogs}
        targetWeightKg={memberProfile?.healthInfo?.targetWeight_kg || memberProfile?.targetWeightKg}
        attendanceStats={attendanceStats}
        workoutVolumeLogs={workoutVolumeLogs}
        onLogWeightClick={() => setActiveModal("weight")}
        isLoading={loading}
      />

      {/* SECTION 3: Consistency Tracker & Leaderboard */}
      <div className="space-y-6">
        <ConsistencyProgressTracker
          attendanceStats={attendanceStats}
          workoutVolumeLogs={workoutVolumeLogs}
          completedWorkoutsCount={completedWorkoutsCount}
        />
        <LeaderboardCard gymId={gymId} currentUserId={memberId} />
      </div>

      {/* Quick Action Drawer Modal */}
      <QuickActionDrawer
        type={activeModal}
        onClose={() => setActiveModal(null)}
        memberId={memberId}
        referralCode={referralCode}
        onWeightSuccess={fetchDashboardData}
      />
    </div>
  );
}
