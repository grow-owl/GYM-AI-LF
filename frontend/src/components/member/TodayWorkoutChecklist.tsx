import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import {
  Dumbbell,
  CheckCircle2,
  Circle,
  Loader2,
  Flame,
  Award,
  ArrowUpRight,
  RotateCcw,
  SlidersHorizontal,
  Lock,
  ShieldCheck,
  ChevronRight,
} from "lucide-react";
import { workoutApi } from "@/lib/endpoints";
import { useAttendanceStore } from "@/store/attendanceStore";
import { toast } from "sonner";
import clsx from "clsx";

interface ExerciseItem {
  exerciseId: string;
  name: string;
  muscleGroup?: string;
  equipment?: string;
  targetSets: number;
  targetReps: number;
  restSeconds?: number;
  order: number;
  isCompleted: boolean;
}

interface TodayWorkoutData {
  logId: string | null;
  planId: string;
  planTitle: string;
  dayIndex: number;
  dayLabel: string;
  totalExercises: number;
  completedExerciseIds: string[];
  exercises: ExerciseItem[];
}

interface TodayWorkoutChecklistProps {
  memberId?: string;
  compact?: boolean;
  onOpenDetailedTracker?: () => void;
}

export default function TodayWorkoutChecklist({
  memberId,
  compact = false,
  onOpenDetailedTracker,
}: TodayWorkoutChecklistProps) {
  const [loading, setLoading] = useState(true);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [todayData, setTodayData] = useState<TodayWorkoutData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { isCheckedIn, fetchCurrentSession, initialized } = useAttendanceStore();

  useEffect(() => {
    if (!initialized) {
      fetchCurrentSession();
    }
  }, [initialized, fetchCurrentSession]);

  const fetchTodayWorkout = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await workoutApi.getTodayWorkout(memberId);
      const data = res?.today ?? (res as any)?.data?.today ?? null;
      setTodayData(data);
    } catch (err: any) {
      console.error("Failed to fetch today's workout:", err);
      setError("Unable to load today's workout. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [memberId]);

  useEffect(() => {
    fetchTodayWorkout();
  }, [fetchTodayWorkout]);

  const handleToggle = async (exerciseId: string, currentCompleted: boolean) => {
    if (!isCheckedIn) {
      toast.warning("🔒 Gym Check-In Required! Please scan the QR code at your gym kiosk to unlock exercise completion.", {
        action: {
          label: "Check-In",
          onClick: () => {
            window.location.href = "/member/attendance";
          },
        },
      });
      return;
    }

    if (togglingId) return; // Prevent double-clicks
    setTogglingId(exerciseId);

    // Optimistic UI update for instant tactile feedback
    setTodayData((prev) => {
      if (!prev) return prev;
      const updatedExercises = prev.exercises.map((ex) =>
        ex.exerciseId === exerciseId ? { ...ex, isCompleted: !currentCompleted } : ex
      );
      const nextCompletedIds = !currentCompleted
        ? [...prev.completedExerciseIds, exerciseId]
        : prev.completedExerciseIds.filter((id) => id !== exerciseId);

      return {
        ...prev,
        exercises: updatedExercises,
        completedExerciseIds: nextCompletedIds,
      };
    });

    try {
      const res = await workoutApi.toggleExerciseToday(exerciseId);
      const updated = res?.today ?? (res as any)?.data?.today;
      if (updated) {
        setTodayData(updated);
        if (updated.isCompleted) {
          toast.success("🎉 Full routine completed! +100 XP awarded to your profile!");
        } else if (!currentCompleted) {
          toast.success("Exercise marked as completed! Keep going! 💪");
        } else {
          toast.info("Exercise unmarked.");
        }
      }
      // Notify other components (Consistency chart, Gamification, Performance charts)
      window.dispatchEvent(new CustomEvent("gymai:workout-updated"));
    } catch (err: any) {
      console.error("Failed to toggle exercise:", err);
      const errMsg = err?.response?.data?.message || err?.message || "Failed to update exercise completion.";
      toast.error(`Error: ${errMsg}. Restoring state.`);
      // Rollback on error
      fetchTodayWorkout();
    } finally {
      setTogglingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-8 bg-(--color-surface) rounded-2xl border border-(--color-border) text-center space-y-3">
        <Loader2 className="h-7 w-7 animate-spin text-(--color-accent)" />
        <p className="text-xs font-semibold text-(--color-text-muted)">Loading your workout for today...</p>
      </div>
    );
  }

  if (error || !todayData) {
    return (
      <>
        {/* Mobile & Tablet View: Merged Unified Workout Card (No Dumbbell Icon) */}
        <div className="lg:hidden bg-white dark:bg-(--color-surface) p-4 sm:p-5 rounded-2xl border border-(--color-border) shadow-xs space-y-3.5">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-(--color-text-faint) block">
              Daily Focus
            </span>
            <h4 className="font-display text-base sm:text-lg font-extrabold text-(--color-text) mt-0.5">
              No Active Workout Plan
            </h4>
            <p className="text-xs text-(--color-text-muted) mt-1 leading-relaxed">
              There is no active workout plan scheduled for today. Ask your trainer to assign a routine or browse available plans.
            </p>
          </div>

          <div className="flex flex-col gap-2 pt-0.5">
            <Link
              to="/member/workout-plan?tab=routine"
              className="w-full flex items-center justify-center gap-1.5 py-2.5 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-extrabold text-xs sm:text-sm tracking-wide shadow-xs hover:shadow-md transition-all duration-200 cursor-pointer"
            >
              <span>VIEW FULL WORKOUT ROUTINE</span>
              <ChevronRight size={16} />
            </Link>
            <button
              onClick={fetchTodayWorkout}
              className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-(--color-surface-2) hover:bg-(--color-surface-3) text-(--color-text) text-xs font-semibold transition-all border border-(--color-border-soft) cursor-pointer"
            >
              <RotateCcw className="h-3.5 w-3.5 text-(--color-text-muted)" />
              <span>Refresh Status</span>
            </button>
          </div>
        </div>

        {/* Desktop View: Original Empty State Preserved */}
        <div className="hidden lg:flex flex-col items-center justify-center py-8 px-5 bg-(--color-surface) rounded-2xl border border-dashed border-(--color-border) text-center space-y-3">
          <div className="h-12 w-12 rounded-2xl bg-(--color-surface-2) flex items-center justify-center text-(--color-text-faint)">
            <Dumbbell className="h-6 w-6" />
          </div>
          <div>
            <h4 className="font-display text-sm sm:text-base font-bold text-(--color-text)">
              No Active Workout Plan
            </h4>
            <p className="text-xs text-(--color-text-muted) max-w-sm mt-1">
              There is no active workout plan scheduled for today. Ask your trainer to assign a routine or browse available plans.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Link
              to="/member/workout-plan?tab=routine"
              className="px-4 py-2 rounded-xl bg-(--color-navbar) text-(--color-navbar-text) text-xs font-bold hover:brightness-110 transition-all shadow-sm"
            >
              Browse Routines
            </Link>
            <button
              onClick={fetchTodayWorkout}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-(--color-surface-2) text-(--color-text) text-xs font-semibold hover:bg-(--color-surface-3) transition-all border border-(--color-border-soft)"
            >
              <RotateCcw className="h-3.5 w-3.5" /> Refresh
            </button>
          </div>
        </div>
      </>
    );
  }

  const { planTitle, dayLabel, exercises, completedExerciseIds, totalExercises } = todayData;
  const completedCount = completedExerciseIds.length;
  const percentage = totalExercises > 0 ? Math.round((completedCount / totalExercises) * 100) : 0;
  const isAllComplete = totalExercises > 0 && completedCount === totalExercises;

  return (
    <div className="bg-(--color-surface) rounded-2xl border border-(--color-border) p-4 sm:p-5 shadow-xl space-y-4">
      {/* ============================================================ */}
      {/* Top Header: Mobile Layout (< sm)                            */}
      {/* Prevents any overlap between long plan title & progress pill */}
      {/* ============================================================ */}
      <div className="sm:hidden space-y-2 border-b border-(--color-border-soft) pb-3.5">
        {/* Top Row: Session Tag on Left, Progress Pill on Right (Guaranteed no overlap) */}
        <div className="flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-(--color-accent-soft) text-(--color-accent-text) text-[11px] font-bold border border-(--color-accent)/30 shrink-0">
            <Flame className="h-3 w-3" /> TODAY'S SESSION
          </span>

          <div className="flex items-center gap-2 bg-(--color-surface-2)/80 px-2.5 py-1 rounded-xl border border-(--color-border-soft) shrink-0 shadow-2xs">
            <div className="text-right">
              <span className="font-mono text-xs font-black text-(--color-text) block leading-none">
                {completedCount} <span className="text-(--color-text-faint)">/ {totalExercises}</span>
              </span>
              <span
                className={clsx(
                  "text-[9px] font-extrabold block leading-none mt-1 uppercase tracking-wide",
                  isAllComplete ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"
                )}
              >
                {percentage}% Done
              </span>
            </div>
            <div className="relative h-7 w-7 flex items-center justify-center shrink-0">
              <svg className="h-7 w-7 -rotate-90" viewBox="0 0 36 36">
                <path
                  className="text-(--color-surface-3)"
                  stroke="currentColor"
                  strokeWidth="4"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
                <path
                  className={clsx(
                    "transition-all duration-500 ease-out",
                    isAllComplete ? "text-emerald-500" : "text-(--color-accent)"
                  )}
                  stroke="currentColor"
                  strokeDasharray={`${percentage}, 100`}
                  strokeLinecap="round"
                  strokeWidth="4"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
              </svg>
            </div>
          </div>
        </div>

        {/* Title Row: Day Label + Plan Title Tag (Full width available on mobile) */}
        <div className="flex flex-wrap items-center gap-2 min-w-0">
          <h3 className="font-display text-base font-extrabold text-(--color-text) truncate">
            {dayLabel}
          </h3>
          {planTitle && (
            <span className="text-[11px] font-bold text-(--color-text-muted) px-2 py-0.5 rounded-full bg-(--color-surface-2) border border-(--color-border-soft) truncate max-w-[200px]">
              {planTitle}
            </span>
          )}
        </div>
      </div>

      {/* ============================================================ */}
      {/* Top Header: Tablet & Desktop Layout (>= sm)                 */}
      {/* 100% Preserved: Zero changes to tablet and desktop view      */}
      {/* ============================================================ */}
      <div className="hidden sm:flex items-center justify-between gap-3 border-b border-(--color-border-soft) pb-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-(--color-accent-soft) text-(--color-accent-text) text-[11px] font-bold border border-(--color-accent)/30 shrink-0">
              <Flame className="h-3 w-3" /> TODAY'S SESSION
            </span>
            {planTitle && (
              <span className="text-xs font-bold text-(--color-text-muted) truncate">
                {planTitle}
              </span>
            )}
          </div>
          <h3 className="font-display text-base sm:text-lg font-extrabold text-(--color-text) mt-1 truncate">
            {dayLabel}
          </h3>
        </div>

        {/* Desktop & Tablet Progress Pill */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="text-right">
            <span className="font-mono text-sm font-extrabold text-(--color-text)">
              {completedCount} <span className="text-(--color-text-faint)">/ {totalExercises}</span>
            </span>
            <p className="text-[10px] font-bold text-(--color-text-muted) uppercase tracking-wider">
              {percentage}% DONE
            </p>
          </div>
          <div className="relative h-10 w-10 flex items-center justify-center shrink-0">
            <svg className="h-10 w-10 -rotate-90" viewBox="0 0 36 36">
              <path
                className="text-(--color-surface-3)"
                stroke="currentColor"
                strokeWidth="3.5"
                fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
              <path
                className={clsx(
                  "transition-all duration-500 ease-out",
                  isAllComplete ? "text-emerald-500" : "text-(--color-accent)"
                )}
                stroke="currentColor"
                strokeDasharray={`${percentage}, 100`}
                strokeLinecap="round"
                strokeWidth="3.5"
                fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
            </svg>
            <span className="absolute font-mono text-[10px] font-black text-(--color-text)">
              {percentage}%
            </span>
          </div>
        </div>
      </div>

      {/* Progress Bar (Smooth Linear) */}
      <div className="w-full bg-(--color-surface-3) h-2 rounded-full overflow-hidden">
        <div
          className={clsx(
            "h-full rounded-full transition-all duration-500 ease-out",
            isAllComplete ? "bg-emerald-500" : "bg-(--color-accent)"
          )}
          style={{ width: `${percentage}%` }}
        />
      </div>

      {/* 100% Celebration Banner */}
      {isAllComplete && (
        <div className="flex items-center gap-3 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300">
          <Award className="h-6 w-6 text-emerald-600 shrink-0" />
          <div className="min-w-0">
            <p className="text-xs font-bold leading-tight">Session Complete! Outstanding Work 🎉</p>
            <p className="text-[11px] opacity-90">All assigned exercises for today are completed.</p>
          </div>
        </div>
      )}

      {/* Gym Check-In Required Alert Banner */}
      {!isCheckedIn && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="h-8 w-8 rounded-lg bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
              <Lock className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xs font-bold leading-tight">Gym Check-In Required to Log Exercises</p>
            </div>
          </div>
          <Link
            to="/member/attendance"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold shadow-xs transition-all shrink-0 cursor-pointer"
          >
            <ShieldCheck className="h-3.5 w-3.5" /> Check-In Now
          </Link>
        </div>
      )}

      {/* Exercises Checklist (Mobile Touch Friendly) */}
      <div className="space-y-2">
        {exercises.map((exercise, idx) => {
          const isDone = exercise.isCompleted;
          const isBusy = togglingId === exercise.exerciseId;

          return (
            <div
              key={exercise.exerciseId || idx}
              onClick={() => handleToggle(exercise.exerciseId, isDone)}
              role="button"
              tabIndex={0}
              aria-pressed={isDone}
              className={clsx(
                "group min-h-[56px] flex items-center justify-between p-3.5 rounded-xl border transition-all cursor-pointer select-none",
                isDone
                  ? "bg-emerald-500/5 border-emerald-500/30 text-(--color-text)"
                  : !isCheckedIn
                  ? "bg-(--color-surface-2)/40 border-(--color-border-soft) hover:border-amber-500/40"
                  : "bg-(--color-surface-2)/60 border-(--color-border-soft) hover:border-(--color-border) hover:bg-(--color-surface-2)"
              )}
            >
              <div className="flex items-center gap-3 min-w-0 flex-1">
                {/* Checkbox Touch Target (Min 44x44px ergonomic touch) */}
                <div
                  className={clsx(
                    "h-8 w-8 sm:h-9 sm:w-9 rounded-xl flex items-center justify-center shrink-0 transition-all",
                    isDone
                      ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/20 scale-100"
                      : !isCheckedIn
                      ? "border-2 border-dashed border-amber-500/40 bg-amber-500/5 text-amber-500"
                      : "border-2 border-(--color-border) bg-(--color-surface) text-transparent group-hover:border-(--color-accent)"
                  )}
                >
                  {isBusy ? (
                    <Loader2 className="h-4 w-4 animate-spin text-(--color-accent)" />
                  ) : isDone ? (
                    <CheckCircle2 className="h-5 w-5 stroke-[2.5]" />
                  ) : !isCheckedIn ? (
                    <Lock className="h-3.5 w-3.5 text-amber-500/80" />
                  ) : (
                    <Circle className="h-4 w-4 text-transparent" />
                  )}
                </div>

                {/* Exercise Details */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p
                      className={clsx(
                        "font-display text-sm font-bold text-(--color-text) truncate transition-colors",
                        isDone && "line-through text-(--color-text-muted)"
                      )}
                    >
                      {exercise.name}
                    </p>
                    {isDone && (
                      <span className="hidden sm:inline-flex text-[10px] font-extrabold px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-700 dark:text-emerald-300">
                        DONE
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5 mt-1 text-[11px] text-(--color-text-muted)">
                    <span className="font-semibold text-(--color-text)">
                      {exercise.targetSets} Sets × {exercise.targetReps} Reps
                    </span>
                    {exercise.muscleGroup && (
                      <>
                        <span className="text-(--color-border)">•</span>
                        <span className="px-1.5 py-0.2 rounded bg-(--color-surface-3) font-medium">
                          {exercise.muscleGroup}
                        </span>
                      </>
                    )}
                    {exercise.equipment && (
                      <>
                        <span className="text-(--color-border)">•</span>
                        <span className="hidden xs:inline truncate text-(--color-text-faint)">
                          {exercise.equipment}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Status Pill on Right */}
              <div className="shrink-0 pl-2">
                <span
                  className={clsx(
                    "text-[10px] sm:text-xs font-bold px-2.5 py-1 rounded-lg transition-colors flex items-center gap-1",
                    isDone
                      ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                      : !isCheckedIn
                      ? "bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20"
                      : "bg-(--color-surface-3) text-(--color-text-muted) group-hover:text-(--color-text)"
                  )}
                >
                  {isDone ? (
                    "Completed"
                  ) : !isCheckedIn ? (
                    <>
                      <Lock size={10} /> Check-In to Log
                    </>
                  ) : (
                    "Tap to Complete"
                  )}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Bottom Action Footer */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-(--color-border-soft)">
        <p className="text-xs text-(--color-text-muted) text-center sm:text-left flex items-center gap-1.5">
          {!isCheckedIn ? (
            <>
              <Lock className="h-3.5 w-3.5 text-amber-500 shrink-0" />
              <span>Workout logging is locked. Check in at your gym to record sets.</span>
            </>
          ) : (
            <span>💡 Tap any exercise when done to build your daily workout streak.</span>
          )}
        </p>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          {onOpenDetailedTracker ? (
            <button
              onClick={onOpenDetailedTracker}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-(--color-surface-2) hover:bg-(--color-surface-3) text-(--color-text) text-xs font-bold border border-(--color-border-soft) transition-all cursor-pointer"
            >
              {isCheckedIn ? (
                <SlidersHorizontal className="h-3.5 w-3.5 text-(--color-accent)" />
              ) : (
                <Lock className="h-3.5 w-3.5 text-amber-500" />
              )}
              <span>Detailed Logger {!isCheckedIn && "(Locked)"}</span>
            </button>
          ) : (
            <Link
              to="/member/workout-plan?tab=tracking"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-(--color-surface-2) hover:bg-(--color-surface-3) text-(--color-text) text-xs font-bold border border-(--color-border-soft) transition-all cursor-pointer"
            >
              {isCheckedIn ? (
                <SlidersHorizontal className="h-3.5 w-3.5 text-(--color-accent)" />
              ) : (
                <Lock className="h-3.5 w-3.5 text-amber-500" />
              )}
              <span>Detailed Logger {!isCheckedIn && "(Locked)"}</span>
            </Link>
          )}

          {!compact && (
            <Link
              to="/member/workout-history"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-1 px-3.5 py-2 rounded-xl bg-(--color-surface-2) hover:bg-(--color-surface-3) text-(--color-text-muted) hover:text-(--color-text) text-xs font-semibold border border-(--color-border-soft) transition-all"
            >
              History <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
