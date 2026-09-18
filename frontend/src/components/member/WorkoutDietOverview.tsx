import { useState, useEffect, useCallback } from "react";
import { Salad, Droplets, ChevronRight, Plus, Minus } from "lucide-react";
import Card from "@/components/ui/Card";
import { dietApi, progressApi } from "@/lib/endpoints";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { showApiErrorToast } from "@/lib/api";
import { getLocalDateKey } from "@/lib/dateUtils";
import TodayWorkoutChecklist from "./TodayWorkoutChecklist";

interface WorkoutDietProps {
  memberId?: string;
}

export default function WorkoutDietOverview({ memberId }: WorkoutDietProps) {
  const [dietPlan, setDietPlan] = useState<any | null>(null);

  const dateKey = getLocalDateKey();
  const storageKey = memberId ? `gymai_water_${memberId}_${dateKey}` : `gymai_water_${dateKey}`;

  // Instant cached initialization from localStorage
  const [waterGlasses, setWaterGlasses] = useState<number>(() => {
    try {
      const saved = localStorage.getItem("gymai_water_glasses");
      const savedDate = localStorage.getItem("gymai_water_glasses_date");
      if (saved !== null && savedDate === dateKey) {
        return parseInt(saved, 10);
      }
      const localByKey = localStorage.getItem(storageKey);
      return localByKey !== null ? parseInt(localByKey, 10) : 0;
    } catch {
      return 0;
    }
  });

  // Sync today's logged water from database on mount or memberId arrival
  const syncServerWellness = useCallback(async () => {
    try {
      const res: any = await progressApi.getWellnessHistory().catch(() => null);
      const historyList = Array.isArray(res) ? res : res?.history || [];
      const todayEntry = historyList.find((w: any) => w.dayKey === dateKey);

      if (todayEntry && typeof todayEntry.waterIntakeMl === "number") {
        const glasses = Math.min(12, Math.round(todayEntry.waterIntakeMl / 375));
        setWaterGlasses(glasses);
        localStorage.setItem("gymai_water_glasses", String(glasses));
        localStorage.setItem("gymai_water_glasses_date", dateKey);
        if (memberId) {
          localStorage.setItem(`gymai_water_${memberId}_${dateKey}`, String(glasses));
        }
      } else {
        // New day: No water logged yet today! Clean reset to 0.
        setWaterGlasses(0);
        localStorage.setItem("gymai_water_glasses", "0");
        localStorage.setItem("gymai_water_glasses_date", dateKey);
        localStorage.setItem("gymai_water_liters", "0.00");
        if (memberId) {
          localStorage.setItem(`gymai_water_${memberId}_${dateKey}`, "0");
        }
      }
    } catch (err) {
      console.error("Error syncing wellness history:", err);
    }
  }, [dateKey, memberId]);

  useEffect(() => {
    syncServerWellness();
  }, [syncServerWellness]);

  // Listen to external wellness updates (e.g. from Progress modal or AI Coach)
  useEffect(() => {
    const handleWellnessEvent = (e: any) => {
      const g = e?.detail?.waterGlasses;
      if (typeof g === "number") {
        setWaterGlasses(g);
      } else {
        syncServerWellness();
      }
    };
    window.addEventListener("gymai:wellness-updated", handleWellnessEvent);
    return () => {
      window.removeEventListener("gymai:wellness-updated", handleWellnessEvent);
    };
  }, [syncServerWellness]);

  useEffect(() => {
    if (memberId) {
      dietApi.getActive(memberId)
        .then((dRes) => {
          if (dRes && (dRes.dietPlan || dRes.plan)) {
            setDietPlan(dRes.dietPlan || dRes.plan || null);
          }
        })
        .catch(() => {});
    }
  }, [memberId]);

  const handleWaterAdd = (delta: number) => {
    const next = Math.max(0, Math.min(12, waterGlasses + delta));
    setWaterGlasses(next);
    
    // 1. Immediately cache in localStorage for zero-latency UI
    try {
      localStorage.setItem("gymai_water_glasses", String(next));
      localStorage.setItem("gymai_water_glasses_date", dateKey);
      localStorage.setItem(storageKey, String(next));
      localStorage.setItem("gymai_water_liters", (next * 0.375).toFixed(2));
    } catch {}

    // 2. Persist to backend database (upsert DailyWellness)
    const waterMl = Math.round(next * 375);
    progressApi.logWellness({ waterIntakeMl: waterMl, dayKey: dateKey }).catch((err) => {
      console.error("Failed to sync water intake to server:", err);
      showApiErrorToast(err, "Failed to sync hydration to server");
    });

    // 3. Dispatch real-time events for AICoach and Progress page
    window.dispatchEvent(
      new CustomEvent("gymai:wellness-updated", {
        detail: {
          waterGlasses: next,
          waterMl,
          waterLiters: (next * 0.375).toFixed(2),
          dayKey: dateKey,
        },
      })
    );
    window.dispatchEvent(new Event("gymai:workout-updated"));

    if (delta > 0) {
      toast.success(`Hydration saved! ${next}/8 glasses (${(next * 0.375).toFixed(2)}L) 💧`);
    }
  };

  const hasDietPlan = !!(dietPlan && (dietPlan.name || dietPlan.title || dietPlan.dailyCalorieTarget || dietPlan.targetCalories));
  const dietTitle = hasDietPlan ? (dietPlan.name || dietPlan.title || "Assigned Diet Plan") : "No Active Diet Plan";
  const caloriesDisplay = hasDietPlan
    ? `${dietPlan.dailyCalorieTarget || dietPlan.targetCalories || dietPlan.totalCalories || "--"} kcal`
    : "-- kcal";
  const proteinDisplay = hasDietPlan
    ? `${dietPlan.dailyProteinTarget_g || dietPlan.proteinGrams || dietPlan.protein || "--"}g`
    : "-- g";

  return (
    <div className="space-y-5">
      {/* Active Today's Workout Checklist */}
      <TodayWorkoutChecklist memberId={memberId} compact={true} />

      {/* Diet Plan & Water Tracker */}
      <Card className="relative overflow-hidden border border-(--color-border) bg-(--color-surface) p-5 shadow-xl space-y-4">
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-400">
              <Salad className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-display text-base font-bold text-(--color-text)">
                Diet & Nutrition
              </h3>
              <p className="text-xs text-(--color-text-muted)">
                {dietTitle}
              </p>
            </div>
          </div>

          <Link
            to="/member/diet-plan"
            className="text-xs font-semibold text-emerald-400 hover:underline flex items-center gap-0.5"
          >
            Diet Plan <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {/* Macro Calories Cards */}
        <div className="grid grid-cols-2 gap-2 text-center">
          <div className="p-2.5 rounded-xl bg-(--color-surface-2) border border-(--color-border)">
            <span className="text-[10px] text-(--color-text-muted) uppercase font-extrabold tracking-wider">Daily Calories</span>
            <p className="text-base font-extrabold text-(--color-text) mt-0.5">{caloriesDisplay}</p>
          </div>
          <div className="p-2.5 rounded-xl bg-(--color-surface-2) border border-(--color-border)">
            <span className="text-[10px] text-(--color-text-muted) uppercase font-extrabold tracking-wider">Protein Goal</span>
            <p className="text-base font-extrabold text-emerald-600 dark:text-emerald-400 mt-0.5">{proteinDisplay}</p>
          </div>
        </div>

        {/* Water Hydration Tracker */}
        <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-sky-500/[0.06] via-(--color-surface) to-blue-500/[0.04] border border-sky-500/20 dark:border-sky-500/30 shadow-xs space-y-3.5">
          {/* Header Row: Icon + Full Title + Clean 1/8 Pill (No target 3.0L, No Liters below) */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-sky-400 to-blue-600 text-white flex items-center justify-center shadow-sm shadow-sky-500/25 shrink-0">
                <Droplets size={19} className="fill-white/80" />
              </div>
              <div className="min-w-0">
                <h4 className="font-display text-sm sm:text-base font-extrabold text-(--color-text) leading-tight">
                  Daily Water Hydration
                </h4>
              </div>
            </div>

            {/* Clean 1 / 8 Pill (Only 1 / 8, zero liters text underneath) */}
            <div className="shrink-0 bg-sky-500/10 dark:bg-sky-500/20 px-3 py-1.5 rounded-xl border border-sky-500/25 font-mono text-xs sm:text-sm font-black text-sky-600 dark:text-sky-400">
              {waterGlasses} <span className="text-[11px] font-semibold text-(--color-text-muted)">/ 8</span>
            </div>
          </div>

          {/* Smooth Progress Bar */}
          <div className="h-2 w-full rounded-full bg-sky-100/80 dark:bg-sky-950/60 border border-sky-200/50 dark:border-sky-800/40 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-sky-400 via-cyan-400 to-blue-600 transition-all duration-500 ease-out shadow-xs"
              style={{ width: `${Math.min(100, (waterGlasses / 8) * 100)}%` }}
            />
          </div>

          {/* 8 Interactive Glass Buttons */}
          <div className="grid grid-cols-8 gap-1.5 sm:gap-2 py-0.5">
            {Array.from({ length: 8 }).map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => {
                  const next = i + 1 === waterGlasses ? i : i + 1;
                  const diff = next - waterGlasses;
                  handleWaterAdd(diff);
                }}
                className={`h-8 sm:h-9 rounded-xl flex items-center justify-center transition-all duration-150 cursor-pointer border active:scale-95 ${
                  i < waterGlasses
                    ? "bg-gradient-to-b from-sky-400 to-blue-600 text-white border-sky-400 shadow-sm shadow-sky-500/25 scale-[1.02]"
                    : "bg-(--color-surface-2) hover:bg-sky-500/10 text-sky-400/40 hover:text-sky-600 border-(--color-border-soft) hover:border-sky-300"
                }`}
                title={`Glass ${i + 1}`}
              >
                <Droplets size={13} className={i < waterGlasses ? "fill-white" : "opacity-35"} />
              </button>
            ))}
          </div>

          {/* Action Section: Status Line + Fits-within-Card Stepper Buttons */}
          <div className="pt-2.5 border-t border-(--color-border-soft) space-y-2.5 lg:space-y-0 lg:flex lg:items-center lg:justify-between lg:gap-4">
            {/* Status Line: "X glasses left" (No "to reach 3.0L") */}
            <div className="flex items-center justify-between lg:justify-start lg:gap-3 text-xs">
              {waterGlasses >= 8 ? (
                <span className="inline-flex items-center gap-1 font-bold text-emerald-600 dark:text-emerald-400">
                  🎉 Daily Goal Reached!
                </span>
              ) : (
                <span className="text-(--color-text-muted) font-medium">
                  <strong className="font-bold text-(--color-text)">{Math.max(0, 8 - waterGlasses)}</strong> glasses left
                </span>
              )}
              <span className="font-mono text-[11px] font-bold text-sky-600 dark:text-sky-400">
                {Math.round((waterGlasses / 8) * 100)}%
              </span>
            </div>

            {/* Stepper Buttons: Strictly Fits Inside Card Without Any Overflow */}
            <div className="flex items-center gap-2 w-full lg:w-auto shrink-0">
              <button
                type="button"
                onClick={() => handleWaterAdd(-1)}
                disabled={waterGlasses <= 0}
                className="h-9 px-3 rounded-xl bg-(--color-surface-2) hover:bg-(--color-surface-3) text-(--color-text) flex items-center justify-center gap-1 disabled:opacity-30 disabled:pointer-events-none text-xs font-bold border border-(--color-border-soft) cursor-pointer transition-all active:scale-95 shrink-0"
                title="Remove glass"
                aria-label="Remove glass"
              >
                <Minus size={13} className="stroke-[2.5]" />
                <span>Remove</span>
              </button>
              <button
                type="button"
                onClick={() => handleWaterAdd(1)}
                disabled={waterGlasses >= 12}
                className="flex-1 lg:flex-none lg:w-auto h-9 px-3 lg:px-5 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 text-white text-xs font-extrabold shadow-sm shadow-sky-500/25 cursor-pointer transition-all active:scale-95 flex items-center justify-center gap-1.5 disabled:opacity-40 disabled:pointer-events-none"
                title="Add glass"
                aria-label="Add glass"
              >
                <Plus size={14} className="stroke-[2.5] shrink-0" />
                <span className="truncate">Add 1 Glass</span>
              </button>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
