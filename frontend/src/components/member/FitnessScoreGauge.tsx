import { useState, useMemo } from "react";
import { createPortal } from "react-dom";
import { Activity, Flame, Dumbbell, Award, RefreshCw, Info, HelpCircle, X, Zap, Scale } from "lucide-react";
import Card from "@/components/ui/Card";

interface FitnessScoreProps {
  attendanceRate?: number;
  streakDays?: number;
  completedWorkoutsCount?: number;
  weightLogs?: Array<{ createdAt?: string; recordedAt?: string; weightKg?: number }>;
  hasWeightLogs?: boolean;
  totalXp?: number;
  onRefresh?: () => void;
  isLoading?: boolean;
}

export default function FitnessScoreGauge({
  attendanceRate = 0,
  streakDays = 0,
  completedWorkoutsCount = 0,
  weightLogs,
  hasWeightLogs = false,
  totalXp = 0,
  onRefresh,
  isLoading = false,
}: FitnessScoreProps) {
  const [showExplanation, setShowExplanation] = useState(false);

  // Compute overall performance score dynamically out of 100
  const scores = useMemo(() => {
    // 1. Consistency Score (0-30 pts): Maps attendance rate (0-100%) to 30 pts.
    // Plus 5 pts base credit if member has an active streak.
    const consistencyScore = Math.min(
      30,
      Math.max(streakDays > 0 ? 5 : 0, Math.round((attendanceRate / 100) * 30))
    );
    
    // 2. Workout Execution Score (0-25 pts): Target of 15 completed workouts for max score.
    const workoutScore = Math.min(25, Math.round((completedWorkoutsCount / 15) * 25));
    
    // 3. Streak & Gamification Score (0-25 pts):
    // - Streak component: 3 pts per consecutive day (Max 15 pts at 5-day streak)
    // - XP component: 1 pt per 200 XP earned (Max 10 pts at 2,000 XP)
    const streakBonus = Math.min(15, streakDays * 3);
    const xpBonus = Math.min(10, Math.round((totalXp / 2000) * 10));
    const gamificationScore = Math.min(25, streakBonus + xpBonus);
    
    // 4. Metric & Weight Logging Score (0-20 pts):
    // Evaluates manual weight entries for regularity:
    // - No logs: 0 pts
    // - 1 log (baseline): 10 pts
    // - 2+ logs with recent log within 30 days: 20 pts (Active tracking)
    // - 2+ logs with older log: 12 pts
    let loggingScore = 0;
    if (weightLogs && weightLogs.length > 0) {
      if (weightLogs.length === 1) {
        loggingScore = 10;
      } else {
        const latestLog = weightLogs[weightLogs.length - 1];
        const dateStr = latestLog?.createdAt || latestLog?.recordedAt;
        const daysAgo = dateStr ? (Date.now() - new Date(dateStr).getTime()) / (1000 * 3600 * 24) : 999;
        loggingScore = daysAgo <= 30 ? 20 : 12;
      }
    } else if (hasWeightLogs) {
      loggingScore = 10;
    }

    const totalScore = Math.min(100, consistencyScore + workoutScore + gamificationScore + loggingScore);

    let tierLabel = "Spartan Starter";
    let tierColor = "text-(--color-accent-text)";
    let bgGradient = "from-blue-500 to-indigo-600";
    if (totalScore >= 85) {
      tierLabel = "Elite Champion 🏆";
      tierColor = "text-amber-500";
      bgGradient = "from-amber-400 via-orange-500 to-red-500";
    } else if (totalScore >= 70) {
      tierLabel = "Pro Athlete 💪";
      tierColor = "text-emerald-600";
      bgGradient = "from-emerald-400 to-teal-600";
    } else if (totalScore >= 50) {
      tierLabel = "Dedicated Lifter 🏋️";
      tierColor = "text-indigo-600";
      bgGradient = "from-cyan-400 to-blue-600";
    }

    return {
      totalScore,
      consistencyScore,
      workoutScore,
      gamificationScore,
      loggingScore,
      streakBonus,
      xpBonus,
      tierLabel,
      tierColor,
      bgGradient,
    };
  }, [attendanceRate, streakDays, completedWorkoutsCount, weightLogs, hasWeightLogs, totalXp]);

  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (scores.totalScore / 100) * circumference;

  return (
    <Card className="relative overflow-hidden border border-(--color-border) bg-(--color-surface) p-5 shadow-xl">
      {/* Background glow behind gauge */}
      <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-gradient-to-br opacity-15 blur-3xl" />
      
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-(--color-accent)/15 text-(--color-accent)">
            <Activity className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-display text-base font-bold text-(--color-text)">
                AI Performance Score
              </h3>
              <button
                onClick={() => setShowExplanation(true)}
                className="text-xs text-(--color-text-muted) hover:text-(--color-accent) flex items-center gap-1 transition-colors cursor-pointer"
                title="How is this score calculated?"
              >
                <HelpCircle className="h-3.5 w-3.5" />
              </button>
            </div>
            <p className="text-xs text-(--color-text-muted)">
              Real-time calculated fitness rating (0 - 100 pts)
            </p>
          </div>
        </div>

        {onRefresh && (
          <button
            onClick={onRefresh}
            disabled={isLoading}
            className="flex items-center gap-1 text-xs text-(--color-text-muted) hover:text-(--color-text) transition-colors p-1.5 rounded-md hover:bg-white/5 cursor-pointer"
            title="Recalculate Score"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin text-(--color-accent)" : ""}`} />
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
        {/* Left: Circular Gauge */}
        <div className="md:col-span-5 flex flex-col items-center justify-center p-4 rounded-2xl bg-(--color-surface-2) border border-(--color-border-soft)">
          <div className="relative flex items-center justify-center">
            <svg className="h-36 w-36 transform -rotate-90">
              {/* Track */}
              <circle
                cx="72"
                cy="72"
                r={radius}
                className="stroke-(--color-border)"
                strokeWidth="10"
                fill="transparent"
              />
              {/* Progress Circle */}
              <circle
                cx="72"
                cy="72"
                r={radius}
                stroke="url(#scoreGradient)"
                strokeWidth="10"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                fill="transparent"
                className="transition-all duration-1000 ease-out"
              />
              <defs>
                <linearGradient id="scoreGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#f59e0b" />
                  <stop offset="50%" stopColor="#ec4899" />
                  <stop offset="100%" stopColor="#6366f1" />
                </linearGradient>
              </defs>
            </svg>
            <div className="absolute flex flex-col items-center justify-center text-center">
              <span className="font-display text-3.5xl font-extrabold text-(--color-text) tracking-tight">
                {scores.totalScore}
              </span>
              <span className="text-[10px] font-bold text-(--color-text-faint) uppercase tracking-widest mt-0.5">
                Out of 100
              </span>
            </div>
          </div>

          <div className="mt-3.5 text-center">
            <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full bg-(--color-surface) border border-(--color-border) ${scores.tierColor}`}>
              <Award className="h-3.5 w-3.5" />
              {scores.tierLabel}
            </span>
          </div>
        </div>

        {/* Right: Sub-score Breakdown Bars */}
        <div className="md:col-span-7 space-y-3">
          {/* Consistency */}
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="flex items-center gap-1.5 text-(--color-text-muted) font-semibold">
                <Flame className="h-4 w-4 text-amber-500" /> Attendance & Consistency
              </span>
              <span className="font-bold text-(--color-text)">{scores.consistencyScore} / 30 pts</span>
            </div>
            <div className="h-2.5 w-full rounded-full bg-(--color-surface-3) overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-amber-400 to-orange-500 rounded-full transition-all duration-500"
                style={{ width: `${(scores.consistencyScore / 30) * 100}%` }}
              />
            </div>
          </div>

          {/* Workout Volume */}
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="flex items-center gap-1.5 text-(--color-text-muted) font-semibold">
                <Dumbbell className="h-4 w-4 text-indigo-500" /> Workout Execution
              </span>
              <span className="font-bold text-(--color-text)">{scores.workoutScore} / 25 pts</span>
            </div>
            <div className="h-2.5 w-full rounded-full bg-(--color-surface-3) overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-indigo-500 to-blue-500 rounded-full transition-all duration-500"
                style={{ width: `${(scores.workoutScore / 25) * 100}%` }}
              />
            </div>
          </div>

          {/* Gamification & Streak */}
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="flex items-center gap-1.5 text-(--color-text-muted) font-semibold">
                <Award className="h-4 w-4 text-purple-500" /> Streak & Gamification XP
              </span>
              <span className="font-bold text-(--color-text)">{scores.gamificationScore} / 25 pts</span>
            </div>
            <div className="h-2.5 w-full rounded-full bg-(--color-surface-3) overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full transition-all duration-500"
                style={{ width: `${(scores.gamificationScore / 25) * 100}%` }}
              />
            </div>
          </div>

          {/* Weight & Body Tracking */}
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="flex items-center gap-1.5 text-(--color-text-muted) font-semibold">
                <Activity className="h-4 w-4 text-emerald-500" /> Metric & Weight Logging
              </span>
              <span className="font-bold text-(--color-text)">{scores.loggingScore} / 20 pts</span>
            </div>
            <div className="h-2.5 w-full rounded-full bg-(--color-surface-3) overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-emerald-400 to-teal-500 rounded-full transition-all duration-500"
                style={{ width: `${(scores.loggingScore / 20) * 100}%` }}
              />
            </div>
          </div>

          <div className="flex items-center justify-between text-[11px] text-(--color-text-muted) mt-3">
            <span className="flex items-center gap-1.5 font-medium">
              <Info className="h-3.5 w-3.5 text-(--color-accent)" /> Check-in daily, finish workouts, and log weight!
            </span>
            <button
              onClick={() => setShowExplanation(true)}
              className="text-(--color-accent) font-bold hover:underline cursor-pointer"
            >
              How points work →
            </button>
          </div>
        </div>
      </div>

      {/* Info Explanation Modal via Portal (prevents parent overflow-hidden clipping) */}
      {showExplanation &&
        createPortal(
          <div className="fixed inset-0 z-999 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-in fade-in duration-200">
            <div className="relative w-full max-w-lg rounded-2xl bg-(--color-surface) border border-(--color-border) p-5 sm:p-6 shadow-2xl flex flex-col max-h-[85vh] text-left">
              {/* Sticky Header */}
              <div className="flex items-center justify-between border-b border-(--color-border) pb-3 shrink-0">
                <div className="flex items-center gap-2">
                  <Zap className="h-5 w-5 text-amber-400" />
                  <h3 className="font-display text-base sm:text-lg font-extrabold text-(--color-text)">
                    How AI Performance Score Works
                  </h3>
                </div>
                <button
                  onClick={() => setShowExplanation(false)}
                  className="p-1.5 rounded-xl hover:bg-white/10 text-(--color-text-muted) hover:text-(--color-text) transition-colors cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Scrollable Body */}
              <div className="overflow-y-auto py-4 space-y-3.5 text-xs pr-1">
                <p className="text-xs text-(--color-text-muted) leading-relaxed">
                  Your AI Performance Score (0–100) measures your overall fitness consistency and activity in the gym app. Points are dynamically calculated across 4 key pillars:
                </p>

                <div className="space-y-3">
                  <div className="p-3 rounded-xl bg-(--color-surface-2) border border-(--color-border-soft) space-y-1">
                    <div className="flex items-center justify-between font-bold text-(--color-text)">
                      <span className="flex items-center gap-1.5 text-amber-400">
                        <Flame className="h-4 w-4" /> 1. Attendance & Consistency (Max 30 pts)
                      </span>
                    </div>
                    <p className="text-(--color-text-muted)">
                      Calculated from your monthly attendance rate & consecutive check-in streak. 80%+ attendance gives full 30 pts.
                    </p>
                  </div>

                  <div className="p-3 rounded-xl bg-(--color-surface-2) border border-(--color-border-soft) space-y-1">
                    <div className="flex items-center justify-between font-bold text-(--color-text)">
                      <span className="flex items-center gap-1.5 text-indigo-400">
                        <Dumbbell className="h-4 w-4" /> 2. Workout Execution (Max 25 pts)
                      </span>
                    </div>
                    <p className="text-(--color-text-muted)">
                      Earned by logging and completing workouts in the app. 15 completed workouts gives full 25 pts.
                    </p>
                  </div>

                  <div className="p-3 rounded-xl bg-(--color-surface-2) border border-(--color-border-soft) space-y-1">
                    <div className="flex items-center justify-between font-bold text-(--color-text)">
                      <span className="flex items-center gap-1.5 text-purple-400">
                        <Award className="h-4 w-4" /> 3. Streak & Gamification XP (Max 25 pts)
                      </span>
                    </div>
                    <ul className="text-(--color-text-muted) space-y-1 list-disc pl-4 mt-1">
                      <li><strong>Daily Streak Bonus (Max 15 pts):</strong> 3 pts earned per consecutive workout day.</li>
                      <li><strong>Total XP Bonus (Max 10 pts):</strong> 1 pt per 200 total XP earned in the app.</li>
                      <li><strong>How to earn XP?</strong> Gym Check-in (+50 XP), Complete Workout (+100 XP), Unlock Badges (+200 XP), Challenges (+500 XP).</li>
                    </ul>
                  </div>

                  <div className="p-3 rounded-xl bg-(--color-surface-2) border border-(--color-border-soft) space-y-1">
                    <div className="flex items-center justify-between font-bold text-(--color-text)">
                      <span className="flex items-center gap-1.5 text-emerald-400">
                        <Scale className="h-4 w-4" /> 4. Metric & Weight Logging (Max 20 pts)
                      </span>
                    </div>
                    <p className="text-(--color-text-muted)">
                      Weight logging is manual (enter your weight in the app or via trainer):
                    </p>
                    <ul className="text-(--color-text-muted) space-y-0.5 list-disc pl-4 mt-1">
                      <li>0 logs = 0 pts</li>
                      <li>1 baseline weight log = 10 pts</li>
                      <li>Regular logging (2+ logs with 1 in the last 30 days) = 20 pts (Full score)</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Sticky Footer */}
              <div className="pt-3 border-t border-(--color-border) flex justify-end shrink-0">
                <button
                  onClick={() => setShowExplanation(false)}
                  className="px-5 py-2.5 rounded-xl bg-(--color-accent) hover:brightness-110 text-white font-bold text-xs shadow-lg transition-all cursor-pointer"
                >
                  Got It!
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </Card>
  );
}

