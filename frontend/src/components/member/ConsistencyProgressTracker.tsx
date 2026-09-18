import { CheckCircle2, Circle, Activity, Target } from "lucide-react";
import Card from "@/components/ui/Card";

interface ConsistencyProgressTrackerProps {
  attendanceStats: any;
  workoutVolumeLogs: any[];
  completedWorkoutsCount: number;
}

export default function ConsistencyProgressTracker({
  attendanceStats,
  workoutVolumeLogs = [],
  completedWorkoutsCount = 0
}: ConsistencyProgressTrackerProps) {
  // Weekly Attendance Visualizer (Mon - Sun)
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const weekVisits = days.map((day) => {
    // A simplified check if there's a volume log or attendance record for this day
    const foundLog = workoutVolumeLogs?.find((v: any) => v.day === day || v.dayName === day);
    // Real check-in logic would ideally use an array of check-in dates for the current week from attendanceStats
    // For now we map to volume logs as proxy for active training days
    return {
      day,
      attended: !!foundLog && (foundLog.volume > 0 || foundLog.totalWeight > 0),
    };
  });

  const currentMonthTarget = 20;
  const currentMonthAttended = typeof attendanceStats?.monthlyVisits === "number" ? attendanceStats.monthlyVisits : 0;
  const attendanceProgress = Math.min(100, Math.round((currentMonthAttended / currentMonthTarget) * 100));

  const totalProgramWorkouts = 24;
  const currentProgramCompleted = Math.min(completedWorkoutsCount, totalProgramWorkouts);
  const programProgress = Math.min(100, Math.round((currentProgramCompleted / totalProgramWorkouts) * 100));

  return (
    <Card className="border border-(--color-border) bg-(--color-surface) p-5 sm:p-6 shadow-xl relative overflow-hidden">
      <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
        <Activity className="h-32 w-32" />
      </div>

      <div className="relative z-10 space-y-6">
        {/* Header */}
        <div>
          <h3 className="font-display text-lg font-extrabold text-(--color-text) flex items-center gap-2">
            <Target className="h-5 w-5 text-accent" />
            Consistency & Progress
          </h3>
          <p className="text-xs text-(--color-text-muted) mt-1">
            Track your weekly check-ins and program completion
          </p>
        </div>

        {/* Weekly Attendance row */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-(--color-text)">This Week's Check-ins</span>
          </div>
          <div className="flex items-center justify-between bg-(--color-surface-2) p-3 rounded-2xl border border-(--color-border-soft)">
            {weekVisits.map((v, i) => (
              <div key={i} className="flex flex-col items-center gap-1.5">
                {v.attended ? (
                  <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                ) : (
                  <Circle className="h-5 w-5 text-(--color-text-faint)" />
                )}
                <span className={`text-[10px] font-bold ${v.attended ? "text-emerald-500" : "text-(--color-text-muted)"}`}>
                  {v.day}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Program Progress Bars */}
        <div className="space-y-5 pt-2">
          {/* Workout Completion */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-(--color-text-muted)">Program Progress</span>
              <span className="font-bold text-(--color-text)">{currentProgramCompleted} / {totalProgramWorkouts} Workouts</span>
            </div>
            <div className="h-2.5 w-full rounded-full bg-(--color-surface-3) overflow-hidden border border-(--color-border)">
              <div
                className="h-full bg-accent transition-all duration-1000 ease-out"
                style={{ width: `${programProgress}%` }}
              />
            </div>
          </div>

          {/* Monthly Target */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-(--color-text-muted)">Monthly Target</span>
              <span className="font-bold text-emerald-500">{currentMonthAttended} / {currentMonthTarget} Days</span>
            </div>
            <div className="h-2.5 w-full rounded-full bg-(--color-surface-3) overflow-hidden border border-(--color-border)">
              <div
                className="h-full bg-emerald-500 transition-all duration-1000 ease-out"
                style={{ width: `${attendanceProgress}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}
