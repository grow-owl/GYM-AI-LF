import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { Dumbbell, Loader2, Calendar, Play, Lock, RefreshCw } from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import { memberApi, workoutApi } from "@/lib/endpoints";
import { useAuthStore } from "@/store/authStore";
import { useAttendanceStore } from "@/store/attendanceStore";
import { toast } from "sonner";
import WorkoutTracking from "./WorkoutTracking";
import WorkoutHistory from "./WorkoutHistory";
import TodayWorkoutChecklist from "@/components/member/TodayWorkoutChecklist";
import clsx from "clsx";

export default function WorkoutPlan() {
  const user = useAuthStore((s) => s.user);
  const [searchParams, setSearchParams] = useSearchParams();
  const rawTab = searchParams.get("tab");
  const activeTab = rawTab || "today"; // "today", "tracking", "routine", "history"
  
  const [loading, setLoading] = useState(true);
  const [activePlan, setActivePlan] = useState<any | null>(null);
  const [selectedRoutine, setSelectedRoutine] = useState<any | null>(null);
  const [selectedDayIndex, setSelectedDayIndex] = useState<number | null>(null);
  const [completedDayIndices, setCompletedDayIndices] = useState<number[]>([]);
  const [refreshHistory, setRefreshHistory] = useState(0);

  const [error, setError] = useState<string | null>(null);

  const loadPlan = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const profRes = await memberApi.getSelfProfile().catch(() => null);
      const memberId = profRes?.member?._id || user?._id;
      if (memberId) {
        const planRes = await workoutApi.getActivePlan(memberId);
        const plan: any = (planRes as any)?.plan || planRes;
        if (plan && (plan._id || plan.id || plan.title)) {
          setActivePlan(plan);
        }
      }
    } catch (err) {
      console.error("Failed to load active workout plan:", err);
      setError("Failed to load your workout plan from server.");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadPlan();
  }, [loadPlan]);

  const { isCheckedIn, fetchCurrentSession, initialized } = useAttendanceStore();

  useEffect(() => {
    if (!initialized) {
      fetchCurrentSession();
    }
  }, [initialized, fetchCurrentSession]);

  const handleStartWorkout = (day: any, dayIdx: number) => {
    if (!isCheckedIn) {
      toast.warning("🔒 Gym Check-In Required! Please check in at your gym before tracking workout sessions.", {
        action: {
          label: "Check-In",
          onClick: () => {
            window.location.href = "/member/attendance";
          },
        },
      });
      return;
    }

    const dayTitle = day.title || day.dayLabel || day.dayName || `Day ${dayIdx + 1}`;
    const exercises = (day.exercises || []).map((ex: any) => ({
      exerciseId: ex.exerciseId?._id || ex.exerciseId || undefined,
      exerciseName: ex.name || ex.exerciseName || ex.exerciseId?.name || "Exercise",
      sets: Number(ex.targetSets || ex.sets) || 3,
      reps: Number(ex.targetReps || ex.reps) || 10,
      weightKg: Number(ex.targetWeightKg || ex.weightKg) || 20,
    }));
    
    setSelectedRoutine({ name: dayTitle, exercises });
    setSelectedDayIndex(dayIdx);
    setSearchParams({ tab: "tracking" });
  };

  const handleWorkoutComplete = () => {
    if (selectedDayIndex !== null) {
      setCompletedDayIndices(prev => Array.from(new Set([...prev, selectedDayIndex])));
    }
    setRefreshHistory(prev => prev + 1);
  };

  const renderTabs = () => (
    <div className="grid grid-cols-2 sm:grid-cols-4 bg-(--color-surface-2) p-1.5 rounded-2xl gap-1.5 mb-5 border border-(--color-border)">
      <button 
        onClick={() => setSearchParams({ tab: "today" })}
        className={clsx(
          "text-center py-2.5 px-2 text-xs font-bold rounded-xl transition-all cursor-pointer truncate flex items-center justify-center gap-1",
          activeTab === "today"
            ? "bg-(--color-surface) text-(--color-text) shadow-sm border border-(--color-border-soft)"
            : "text-(--color-text-muted) hover:text-(--color-text)"
        )}
      >
        <span>⚡ Today's Workout</span>
        {!isCheckedIn && <Lock size={10} className="text-amber-500 shrink-0" />}
      </button>
      <button 
        onClick={() => setSearchParams({ tab: "tracking" })}
        className={clsx(
          "text-center py-2.5 px-2 text-xs font-bold rounded-xl transition-all cursor-pointer truncate flex items-center justify-center gap-1",
          activeTab === "tracking"
            ? "bg-(--color-surface) text-(--color-text) shadow-sm border border-(--color-border-soft)"
            : "text-(--color-text-muted) hover:text-(--color-text)"
        )}
      >
        <span>🏋️ Detailed Logger</span>
        {!isCheckedIn && <Lock size={10} className="text-amber-500 shrink-0" />}
      </button>
      <button 
        onClick={() => setSearchParams({ tab: "routine" })}
        className={clsx(
          "text-center py-2.5 px-2 text-xs font-bold rounded-xl transition-all cursor-pointer truncate",
          (activeTab === "routine" || activeTab === "plan")
            ? "bg-(--color-surface) text-(--color-text) shadow-sm border border-(--color-border-soft)"
            : "text-(--color-text-muted) hover:text-(--color-text)"
        )}
      >
        📅 Full Routine
      </button>
      <button 
        onClick={() => setSearchParams({ tab: "history" })}
        className={clsx(
          "text-center py-2.5 px-2 text-xs font-bold rounded-xl transition-all cursor-pointer truncate",
          activeTab === "history"
            ? "bg-(--color-surface) text-(--color-text) shadow-sm border border-(--color-border-soft)"
            : "text-(--color-text-muted) hover:text-(--color-text)"
        )}
      >
        📜 History
      </button>
    </div>
  );

  if (loading) {
    return (
      <div className="space-y-4 max-w-3xl mx-auto w-full">
        <PageHeader title="Workout Hub" subtitle="Loading your fitness journey..." backTo="/member" />
        {renderTabs()}
        <Card className="flex items-center justify-center p-12 text-sm text-(--color-text-muted) gap-2">
          <Loader2 className="w-5 h-5 animate-spin text-(--color-accent)" /> Loading...
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4 max-w-3xl mx-auto w-full">
        <PageHeader title="Workout Hub" subtitle="Your active fitness plan" backTo="/member" />
        {renderTabs()}
        <Card className="text-center py-12 text-(--color-text-muted) space-y-3">
          <p className="text-base font-bold text-red-400">{error}</p>
          <button
            onClick={loadPlan}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-full bg-(--color-accent) text-(--color-navbar) cursor-pointer hover:brightness-110"
          >
            <RefreshCw size={14} /> Retry Plan Sync
          </button>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-3xl mx-auto w-full pb-12">
      <PageHeader
        title={
          activeTab === "today"
            ? "Today's Workout"
            : activeTab === "tracking"
            ? "Detailed Workout Logger"
            : (activeTab === "routine" || activeTab === "plan")
            ? "Assigned Workout Routine"
            : "Workout History"
        }
        subtitle={
          activeTab === "today"
            ? "One-tap checklist with real-time streak tracking"
            : activeTab === "tracking"
            ? "Record exact weights, reps & personal records"
            : (activeTab === "routine" || activeTab === "plan")
            ? (activePlan ? `Goal: ${activePlan.goal || "Fitness & Strength"}` : "Your active workout routine")
            : "Review your past completed training sessions"
        }
        backTo="/member"
      />
      
      {renderTabs()}

      {/* Today's Workout Tab */}
      {activeTab === "today" && (
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
          <TodayWorkoutChecklist onOpenDetailedTracker={() => setSearchParams({ tab: "tracking" })} />
        </div>
      )}

      {/* Plan / Routine Tab Content */}
      {(activeTab === "routine" || activeTab === "plan") && (
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
          {!activePlan || !activePlan.days || activePlan.days.length === 0 ? (
            <Card className="text-center py-12 text-(--color-text-muted) space-y-3">
              <Dumbbell className="w-12 h-12 mx-auto text-(--color-text-faint)" />
              <p className="text-base font-bold text-(--color-text)">No Workout Plan Assigned Yet</p>
              <p className="text-xs text-(--color-text-muted) max-w-sm mx-auto">
                Your trainer has not assigned an active workout routine to your profile. Please ask your trainer to create a plan for you, or log custom workouts in the tracker.
              </p>
            </Card>
          ) : (
            <div className="space-y-4">
              <div className="bg-(--color-surface-2) px-4 py-3 rounded-xl border border-(--color-border-soft) flex items-center justify-between">
                <div>
                  <h3 className="font-display font-bold text-(--color-text)">{activePlan.title || "My Workout Plan"}</h3>
                  <p className="text-xs text-(--color-text-muted)">{activePlan.days.length} Days / Week Schedule</p>
                </div>
              </div>
              
              {activePlan.days.filter((_: any, idx: number) => !completedDayIndices.includes(idx)).length === 0 && (
                <Card className="text-center py-8 text-(--color-text-muted) space-y-2">
                  <p className="text-sm font-bold text-emerald-500">All caught up! 🎉</p>
                  <p className="text-xs">You've completed all scheduled workouts.</p>
                </Card>
              )}

              {activePlan.days.map((d: any, idx: number) => {
                if (completedDayIndices.includes(idx)) return null;
                
                const dayTitle = d.title || d.dayLabel || d.dayName || `Day ${idx + 1}`;
                const exercises = d.exercises || [];

                return (
                  <Card key={idx} className="p-4 space-y-3">
                    <div className="flex items-center justify-between border-b border-(--color-border-soft) pb-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-(--color-accent)/10 text-(--color-accent)">
                          <Calendar className="w-4 h-4" />
                        </div>
                        <h3 className="font-display text-sm font-bold text-(--color-text) truncate">{dayTitle}</h3>
                      </div>
                      
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge tone="neutral">{exercises.length} Exercises</Badge>
                        {exercises.length > 0 && (
                          <button 
                            onClick={() => handleStartWorkout(d, idx)}
                            className={clsx(
                              "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer",
                              !isCheckedIn
                                ? "bg-amber-500/15 border border-amber-500/30 text-amber-700 dark:text-amber-300 hover:bg-amber-500/25"
                                : "bg-(--color-accent) text-white hover:brightness-110"
                            )}
                          >
                            {!isCheckedIn ? (
                              <>
                                <Lock size={12} /> Start (Locked)
                              </>
                            ) : (
                              <>
                                <Play size={12} className="fill-white" /> Start
                              </>
                            )}
                          </button>
                        )}
                      </div>
                    </div>

                    {exercises.length === 0 ? (
                      <p className="text-xs text-(--color-text-faint) italic p-2 text-center">Rest Day / Active Recovery</p>
                    ) : (
                      <div className="space-y-2">
                        {exercises.map((ex: any, exIdx: number) => {
                          const exName = typeof ex.exerciseId === "object" ? ex.exerciseId?.name : ex.exerciseName || ex.name || "Exercise";
                          const sets = ex.targetSets || ex.sets || 3;
                          const reps = ex.targetReps || ex.reps || 10;
                          const weight = ex.targetWeightKg ? `${ex.targetWeightKg} kg` : null;
                          const rest = ex.restSeconds ? `${ex.restSeconds}s rest` : null;

                          return (
                            <div key={exIdx} className="flex items-center justify-between bg-(--color-surface-2)/50 p-2.5 rounded-lg border border-(--color-border-soft)">
                              <div className="min-w-0 flex-1 pr-2">
                                <p className="text-xs font-semibold text-(--color-text) truncate">{exName}</p>
                                <p className="text-[11px] text-(--color-text-muted) mt-0.5">
                                  {sets} Sets × {reps} Reps {weight ? `· ${weight}` : ""} {rest ? `· ${rest}` : ""}
                                </p>
                                {ex.notes && <p className="text-[10px] text-amber-400 mt-0.5 italic truncate">Note: {ex.notes}</p>}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Tracking Tab Content */}
      {activeTab === "tracking" && (
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
           <WorkoutTracking 
             isEmbedded 
             initialRoutine={selectedRoutine} 
             onWorkoutComplete={handleWorkoutComplete}
             onNavigateToPlan={() => setSearchParams({ tab: "plan" })}
           />
        </div>
      )}

      {/* History Tab Content */}
      {activeTab === "history" && (
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
           <WorkoutHistory isEmbedded refreshTrigger={refreshHistory} />
        </div>
      )}
    </div>
  );
}
