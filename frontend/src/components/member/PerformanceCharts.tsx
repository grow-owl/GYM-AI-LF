import { useState, useMemo } from "react";
import { TrendingDown, Scale, Calendar, Plus, Activity, Dumbbell, Flame } from "lucide-react";
import Card from "@/components/ui/Card";
import WorkoutConsistencyChart from "./WorkoutConsistencyChart";

interface WeightLogItem {
  _id?: string;
  weightKg: number;
  notes?: string;
  createdAt?: string;
  recordedAt?: string;
}

interface PerformanceChartsProps {
  memberId?: string;
  weightLogs?: WeightLogItem[];
  targetWeightKg?: number;
  attendanceStats?: any;
  workoutVolumeLogs?: any[];
  onLogWeightClick: () => void;
  isLoading?: boolean;
}

export default function PerformanceCharts({
  memberId,
  weightLogs = [],
  targetWeightKg,
  attendanceStats,
  workoutVolumeLogs = [],
  onLogWeightClick,
}: PerformanceChartsProps) {
  const [activeTab, setActiveTab] = useState<"consistency" | "weight" | "volume" | "attendance">("consistency");

  const displayLogs = useMemo(() => {
    if (weightLogs && weightLogs.length > 0) {
      return [...weightLogs]
        .map((item) => ({
          ...item,
          weightKg: Number(item.weightKg || (item as any).value || 0),
          createdAt: item.createdAt || item.recordedAt || (item as any).date || new Date().toISOString(),
        }))
        .filter((item) => item.weightKg > 0)
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    }
    return [];
  }, [weightLogs]);

  // Calculations for stats summary
  const latestWeight = displayLogs.length > 0 ? displayLogs[displayLogs.length - 1].weightKg : null;
  const initialWeight = displayLogs.length > 0 ? displayLogs[0].weightKg : null;
  const totalChange = (latestWeight !== null && initialWeight !== null) ? Number((latestWeight - initialWeight).toFixed(1)) : 0;
  const diffToTarget = (latestWeight !== null && targetWeightKg) ? Number((latestWeight - targetWeightKg).toFixed(1)) : null;

  // Compute SVG coordinates for Weight Chart
  const svgChartData = useMemo(() => {
    if (displayLogs.length === 0) return { pathString: "", areaString: "", points: [], targetY: null, minW: 0, maxW: 0 };

    const width = 600;
    const height = 200;
    const padding = 35;

    const weights = displayLogs.map((d) => d.weightKg);
    const minW = Math.min(...weights, ...(targetWeightKg ? [targetWeightKg] : [])) - 1;
    const maxW = Math.max(...weights, ...(targetWeightKg ? [targetWeightKg] : [])) + 1;

    const points = displayLogs.map((d, idx) => {
      const x = displayLogs.length === 1 ? width / 2 : padding + (idx / (displayLogs.length - 1)) * (width - 2 * padding);
      const y = height - padding - ((d.weightKg - minW) / (maxW - minW || 1)) * (height - 2 * padding);
      const dateLabel = new Date(d.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" });
      return { x, y, weight: d.weightKg, label: dateLabel };
    });

    let pathString = "";
    let areaString = "";

    if (points.length > 1) {
      pathString = `M ${points[0].x} ${points[0].y}`;
      for (let i = 1; i < points.length; i++) {
        const prev = points[i - 1];
        const curr = points[i];
        const cx = (prev.x + curr.x) / 2;
        pathString += ` C ${cx} ${prev.y}, ${cx} ${curr.y}, ${curr.x} ${curr.y}`;
      }
      areaString = `${pathString} L ${points[points.length - 1].x} ${height - padding} L ${points[0].x} ${height - padding} Z`;
    }

    const targetY = targetWeightKg ? height - padding - ((targetWeightKg - minW) / (maxW - minW || 1)) * (height - 2 * padding) : null;

    return { pathString, areaString, points, targetY, minW, maxW };
  }, [displayLogs, targetWeightKg]);

  // Derived real attendance analytics
  const totalVisits = attendanceStats?.totalVisits ?? attendanceStats?.totalDays ?? 0;
  const avgSessionMins = attendanceStats?.averageSessionMinutes ?? 0;
  const dayDistribution = attendanceStats?.dayOfWeekDistribution;
  let topTrainingDay = "N/A";
  if (dayDistribution && typeof dayDistribution === "object") {
    let maxCount = 0;
    for (const [day, count] of Object.entries(dayDistribution)) {
      if ((count as number) > maxCount) {
        maxCount = count as number;
        topTrainingDay = day;
      }
    }
  }

  // Volume chart items from props or empty weekly structure
  const volumeData = useMemo(() => {
    const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    if (!workoutVolumeLogs || workoutVolumeLogs.length === 0) {
      return days.map((day) => ({ day, volume: 0, label: "No log" }));
    }
    return days.map((day) => {
      const found = workoutVolumeLogs.find((v) => v.day === day || v.dayName === day);
      return {
        day,
        volume: found?.volume || found?.totalWeight || 0,
        label: found?.label || (found?.volume ? "Logged Workout" : "Rest"),
      };
    });
  }, [workoutVolumeLogs]);

  const maxVolume = useMemo(() => Math.max(1000, ...volumeData.map((v) => v.volume)), [volumeData]);
  const totalWeekVolume = useMemo(() => volumeData.reduce((sum, v) => sum + (v.volume || 0), 0), [volumeData]);
  const activeVolumeDays = useMemo(() => volumeData.filter((v) => v.volume > 0).length, [volumeData]);

  return (
    <Card className="relative overflow-hidden border border-(--color-border) bg-(--color-surface) p-3.5 sm:p-5 shadow-xl">
      {/* Top Controls Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-5 pb-4 border-b border-(--color-border-soft)">
        <div>
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-(--color-accent)" />
            <h3 className="font-display text-base sm:text-lg font-extrabold text-(--color-text)">
              Performance & Metrics Analytics
            </h3>
          </div>
          <p className="text-xs text-(--color-text-muted) mt-0.5">
            Track weight progression, workout volume, and gym consistency
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto justify-between sm:justify-start">
          {/* Tab Buttons - Grid on mobile for equal width */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:flex items-center gap-1 bg-(--color-surface-2) p-1 rounded-xl border border-(--color-border) w-full lg:w-auto">
            <button
              onClick={() => setActiveTab("consistency")}
              className={`flex items-center justify-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === "consistency"
                  ? "bg-(--color-accent) text-(--color-navbar) shadow-md"
                  : "text-(--color-text-muted) hover:text-(--color-text)"
              }`}
            >
              <Flame className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">Consistency</span>
            </button>

            <button
              onClick={() => setActiveTab("weight")}
              className={`flex items-center justify-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === "weight"
                  ? "bg-(--color-accent) text-(--color-navbar) shadow-md"
                  : "text-(--color-text-muted) hover:text-(--color-text)"
              }`}
            >
              <Scale className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">Weight Log</span>
            </button>

            <button
              onClick={() => setActiveTab("volume")}
              className={`flex items-center justify-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === "volume"
                  ? "bg-(--color-accent) text-(--color-navbar) shadow-md"
                  : "text-(--color-text-muted) hover:text-(--color-text)"
              }`}
            >
              <Dumbbell className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">Volume</span>
            </button>

            <button
              onClick={() => setActiveTab("attendance")}
              className={`flex items-center justify-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === "attendance"
                  ? "bg-(--color-accent) text-(--color-navbar) shadow-md"
                  : "text-(--color-text-muted) hover:text-(--color-text)"
              }`}
            >
              <Calendar className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">Check-ins</span>
            </button>
          </div>

          {activeTab === "weight" && (
            <button
              onClick={onLogWeightClick}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-(--color-accent) text-(--color-navbar) text-xs font-bold shadow-md hover:brightness-110 transition-all cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" /> Log Weight
            </button>
          )}
        </div>
      </div>

      {/* Consistency Progress View */}
      {activeTab === "consistency" && (
        <WorkoutConsistencyChart memberId={memberId} />
      )}

      {/* Weight Progress View */}
      {activeTab === "weight" && (
        <div className="space-y-4">
          {/* Key Weight Stat Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 sm:p-3.5 rounded-xl bg-(--color-surface-2) border border-(--color-border-soft)">
              <span className="text-[10px] sm:text-[11px] text-(--color-text-muted) font-extrabold uppercase tracking-wider">Current Weight</span>
              <p className="text-lg sm:text-xl font-extrabold text-(--color-text) mt-1">
                {latestWeight !== null ? `${latestWeight} ` : "— "}
                <span className="text-xs font-normal text-(--color-text-muted)">{latestWeight !== null ? "kg" : "No logs"}</span>
              </p>
            </div>

            <div className="p-3 sm:p-3.5 rounded-xl bg-(--color-surface-2) border border-(--color-border-soft)">
              <span className="text-[10px] sm:text-[11px] text-(--color-text-muted) font-extrabold uppercase tracking-wider">Target Goal</span>
              <p className="text-lg sm:text-xl font-extrabold text-emerald-500 mt-1">
                {targetWeightKg ? `${targetWeightKg} ` : "— "}
                <span className="text-xs font-normal text-(--color-text-muted)">{targetWeightKg ? "kg" : "Not set"}</span>
              </p>
            </div>

            <div className="p-3 sm:p-3.5 rounded-xl bg-(--color-surface-2) border border-(--color-border-soft)">
              <span className="text-[10px] sm:text-[11px] text-(--color-text-muted) font-extrabold uppercase tracking-wider">Total Progress</span>
              <p className={`text-lg sm:text-xl font-extrabold mt-1 flex items-center gap-1 ${totalChange <= 0 ? "text-emerald-500" : "text-amber-500"}`}>
                <TrendingDown className="h-4 w-4 shrink-0" />
                {totalChange > 0 ? `+${totalChange}` : totalChange} <span className="text-xs font-normal text-(--color-text-muted)">kg</span>
              </p>
            </div>

            <div className="p-3 sm:p-3.5 rounded-xl bg-(--color-surface-2) border border-(--color-border-soft)">
              <span className="text-[10px] sm:text-[11px] text-(--color-text-muted) font-extrabold uppercase tracking-wider">Remaining</span>
              <p className="text-lg sm:text-xl font-extrabold text-(--color-accent-text) mt-1">
                {diffToTarget !== null ? `${Math.abs(diffToTarget)} ` : "— "}
                <span className="text-xs font-normal text-(--color-text-muted)">{diffToTarget !== null ? "kg" : "N/A"}</span>
              </p>
            </div>
          </div>

          {/* SVG Interactive Line Chart */}
          <div className="relative w-full rounded-2xl bg-(--color-surface-2) p-4 border border-(--color-border)">
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs font-semibold text-(--color-text-muted)">Weight Curve (kg)</span>
              <div className="flex items-center gap-2">
                {targetWeightKg ? (
                  <span className="flex items-center gap-1 text-[11px] text-emerald-500 font-medium">
                    <span className="h-2 w-2 rounded-full bg-emerald-500" /> Target Line ({targetWeightKg}kg)
                  </span>
                ) : null}
                <span className="flex items-center gap-1 text-[11px] text-(--color-accent-text) font-medium">
                  <span className="h-2 w-2 rounded-full bg-(--color-accent)" /> Logged History
                </span>
              </div>
            </div>

            <svg viewBox="0 0 600 200" className="w-full h-48 overflow-visible">
              <defs>
                <linearGradient id="weightAreaGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-accent, #FCA311)" stopOpacity="0.35" />
                  <stop offset="100%" stopColor="var(--color-accent, #FCA311)" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {/* Horizontal Grid lines */}
              <line x1="35" y1="40" x2="565" y2="40" stroke="var(--color-border)" strokeDasharray="4 4" />
              <line x1="35" y1="100" x2="565" y2="100" stroke="var(--color-border)" strokeDasharray="4 4" />
              <line x1="35" y1="160" x2="565" y2="160" stroke="var(--color-border)" strokeDasharray="4 4" />

              {/* Target Weight Reference Line */}
              {svgChartData.targetY && (
                <line
                  x1="35"
                  y1={svgChartData.targetY}
                  x2="565"
                  y2={svgChartData.targetY}
                  stroke="#10b981"
                  strokeWidth="2"
                  strokeDasharray="6 4"
                />
              )}

              {/* Area Fill */}
              {svgChartData.areaString && (
                <path d={svgChartData.areaString} fill="url(#weightAreaGrad)" />
              )}

              {/* Line Curve */}
              {svgChartData.pathString ? (
                <path
                  d={svgChartData.pathString}
                  fill="none"
                  stroke="var(--color-accent, #FCA311)"
                  strokeWidth="3"
                  strokeLinecap="round"
                />
              ) : svgChartData.points.length === 0 ? (
                /* Empty State Dotted Preview Line Curve */
                <>
                  <path
                    d="M 35 140 C 150 90, 300 130, 450 70 L 565 100"
                    fill="none"
                    stroke="var(--color-accent, #FCA311)"
                    strokeWidth="2.5"
                    strokeDasharray="6 6"
                    opacity="0.4"
                  />
                  <foreignObject x="100" y="45" width="400" height="110">
                    <div className="flex flex-col items-center justify-center h-full text-center bg-(--color-surface) p-3.5 rounded-2xl border border-(--color-border) shadow-xl">
                      <p className="text-xs font-extrabold text-(--color-text)">📈 Weight Progression Curve</p>
                      <p className="text-[11px] text-(--color-text-muted) mt-0.5">
                        Log your weight to start mapping your personal weight trend graph!
                      </p>
                      <button
                        onClick={onLogWeightClick}
                        className="mt-2 text-[11px] font-bold text-(--color-navbar) bg-(--color-accent) px-3.5 py-1.5 rounded-full shadow-md hover:brightness-110 transition-all flex items-center gap-1 cursor-pointer"
                      >
                        <Plus className="h-3 w-3" /> Log Weight Now
                      </button>
                    </div>
                  </foreignObject>
                </>
              ) : null}

              {/* Data Points & Tooltip Dots */}
              {svgChartData.points.map((pt, idx) => (
                <g key={idx} className="group cursor-pointer">
                  <circle
                    cx={pt.x}
                    cy={pt.y}
                    r="5"
                    fill="var(--color-accent, #FCA311)"
                    stroke="var(--color-surface)"
                    strokeWidth="2"
                    className="transition-all duration-200 group-hover:r-7"
                  />
                  {/* Point Label - High Contrast Dark Navy */}
                  <text
                    x={pt.x}
                    y={pt.y - 12}
                    textAnchor="middle"
                    fill="var(--color-text)"
                    fontSize="11"
                    fontWeight="bold"
                    className="opacity-90 group-hover:opacity-100 font-sans"
                  >
                    {pt.weight}kg
                  </text>
                  <text
                    x={pt.x}
                    y="190"
                    textAnchor="middle"
                    fill="var(--color-text-muted)"
                    fontSize="10"
                    fontWeight="500"
                  >
                    {pt.label}
                  </text>
                </g>
              ))}
            </svg>
          </div>
        </div>
      )}

      {/* Workout Volume Tab */}
      {activeTab === "volume" && (
        <div className="space-y-4">
          <div>
            <h4 className="font-display text-sm sm:text-base font-extrabold text-(--color-text)">
              Weekly Workout Volume (kg)
            </h4>
            <p className="text-xs text-(--color-text-muted) mt-0.5">
              Daily estimated weight lifted over the current week
            </p>
          </div>

          {/* Volume Summary KPI Cards */}
          <div className="grid grid-cols-2 gap-2 sm:gap-3">
            <div className="p-2.5 sm:p-3 rounded-xl bg-(--color-surface-2) border border-(--color-border) flex flex-col justify-between">
              <span className="text-[10px] sm:text-[11px] font-bold text-(--color-text-muted) uppercase tracking-wider block">
                Total Week Volume
              </span>
              <p className="font-mono text-base sm:text-xl font-extrabold text-(--color-text) mt-1">
                {totalWeekVolume > 0 ? `${totalWeekVolume.toLocaleString()} kg` : "0 kg"}
              </p>
            </div>
            <div className="p-2.5 sm:p-3 rounded-xl bg-(--color-surface-2) border border-(--color-border) flex flex-col justify-between">
              <span className="text-[10px] sm:text-[11px] font-bold text-(--color-text-muted) uppercase tracking-wider block">
                Active Lifting Days
              </span>
              <p className="font-mono text-base sm:text-xl font-extrabold text-amber-500 mt-1">
                {activeVolumeDays} <span className="text-[10px] sm:text-xs font-medium text-(--color-text-muted)">/ 7 days</span>
              </p>
            </div>
          </div>

          {/* 7-Day Responsive Volume Bars (NO horizontal overflow, all 7 days fit 100%) */}
          <div className="w-full bg-(--color-surface-2) rounded-2xl border border-(--color-border) p-3 sm:p-4">
            <div className="grid grid-cols-7 gap-1 sm:gap-2 h-48 sm:h-56 items-end pt-6 pb-1">
              {volumeData.map((item, idx) => {
                const heightPct = item.volume > 0 ? Math.round((item.volume / maxVolume) * 100) : 0;
                return (
                  <div key={idx} className="flex flex-col items-center h-full justify-end group min-w-0">
                    {/* Value on top of bar */}
                    <span className="text-[9px] sm:text-[10px] text-(--color-text-muted) font-mono mb-1 font-bold truncate">
                      {item.volume >= 1000
                        ? `${(item.volume / 1000).toFixed(1)}k`
                        : item.volume > 0
                        ? item.volume
                        : "—"}
                    </span>
                    {/* The bar */}
                    <div className="w-full max-w-[28px] sm:max-w-[38px] bg-(--color-surface-3) rounded-t-lg overflow-hidden flex flex-col justify-end h-full border border-(--color-border)/40">
                      <div
                        className={`w-full rounded-t-lg transition-all duration-500 ${
                          item.volume > 0
                            ? "bg-gradient-to-t from-amber-500 to-amber-400 shadow-sm"
                            : "bg-(--color-surface-3)"
                        }`}
                        style={{ height: `${item.volume > 0 ? Math.max(15, heightPct) : 6}%` }}
                      />
                    </div>
                    {/* Day label */}
                    <span className="text-[10px] sm:text-xs font-extrabold text-(--color-text) mt-2">
                      {item.day}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {volumeData.every((v) => v.volume === 0) && (
            <p className="text-[11px] text-(--color-text-muted) text-center bg-(--color-surface-2) p-2.5 rounded-xl border border-(--color-border-soft)">
              No workout volume recorded this week yet. Complete your logged workout sessions to track weekly volume progression!
            </p>
          )}
        </div>
      )}

      {/* Attendance Check-ins Tab */}
      {activeTab === "attendance" && (
        <div className="space-y-4">
          <p className="text-xs text-(--color-text-muted)">Your monthly check-in frequency and attendance statistics</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-4 rounded-xl bg-(--color-surface-2) border border-(--color-border) text-center">
              <span className="text-xs font-semibold text-(--color-text-muted)">Total Gym Visits</span>
              <p className="text-3xl font-extrabold text-(--color-text) mt-1">{totalVisits} Days</p>
              <span className="text-[11px] text-emerald-500 font-semibold">{totalVisits > 0 ? "Active Gym Member" : "Start visiting to log visits"}</span>
            </div>
            <div className="p-4 rounded-xl bg-(--color-surface-2) border border-(--color-border) text-center">
              <span className="text-xs font-semibold text-(--color-text-muted)">Avg Session Length</span>
              <p className="text-3xl font-extrabold text-(--color-text) mt-1">{avgSessionMins > 0 ? `${avgSessionMins} Mins` : "--"}</p>
              <span className="text-[11px] text-indigo-500 font-semibold">{avgSessionMins > 0 ? "Live session average" : "Log workout sessions to track"}</span>
            </div>
            <div className="p-4 rounded-xl bg-(--color-surface-2) border border-(--color-border) text-center">
              <span className="text-xs font-semibold text-(--color-text-muted)">Peak Workout Day</span>
              <p className="text-3xl font-extrabold text-(--color-text) mt-1">{topTrainingDay}</p>
              <span className="text-[11px] text-amber-500 font-semibold">{topTrainingDay !== "N/A" ? "Most frequent visit day" : "No day frequency yet"}</span>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}
