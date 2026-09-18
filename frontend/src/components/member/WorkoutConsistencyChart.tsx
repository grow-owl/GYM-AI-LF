import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
  Calendar,
  Loader2,
  AlertCircle,
  Flame,
  TrendingUp,
  BarChart2,
  CheckCircle2,
  Activity,
  Award,
} from "lucide-react";
import { workoutApi } from "@/lib/endpoints";
import clsx from "clsx";

interface ChartPoint {
  date: string;
  completionPercentage: number;
}

interface WorkoutConsistencyChartProps {
  memberId?: string;
}

interface CompletionTier {
  label: string;
  shortLabel: string;
  color: string;
  textColor: string;
  bgColor: string;
  borderColor: string;
  fillClass: string;
  glowColor: string;
}

export const getCompletionTier = (pct: number): CompletionTier => {
  if (pct >= 100) {
    return {
      label: "100% Completed",
      shortLabel: "100%",
      color: "#10b981", // Emerald
      textColor: "text-emerald-600 dark:text-emerald-400",
      bgColor: "bg-emerald-500/15",
      borderColor: "border-emerald-500/30",
      fillClass: "bg-emerald-500",
      glowColor: "rgba(16, 185, 129, 0.5)",
    };
  }
  if (pct >= 95) {
    return {
      label: "95–99% Near Perfect",
      shortLabel: "95%+",
      color: "#06b6d4", // Cyan
      textColor: "text-cyan-600 dark:text-cyan-400",
      bgColor: "bg-cyan-500/15",
      borderColor: "border-cyan-500/30",
      fillClass: "bg-cyan-500",
      glowColor: "rgba(6, 182, 212, 0.4)",
    };
  }
  if (pct >= 90) {
    return {
      label: "90–94% Excellent",
      shortLabel: "90%+",
      color: "#6366f1", // Indigo
      textColor: "text-indigo-600 dark:text-indigo-400",
      bgColor: "bg-indigo-500/15",
      borderColor: "border-indigo-500/30",
      fillClass: "bg-indigo-500",
      glowColor: "rgba(99, 102, 241, 0.4)",
    };
  }
  if (pct >= 75) {
    return {
      label: "75–89% Great Effort",
      shortLabel: "75%+",
      color: "#f59e0b", // Amber
      textColor: "text-amber-600 dark:text-amber-400",
      bgColor: "bg-amber-500/15",
      borderColor: "border-amber-500/30",
      fillClass: "bg-amber-500",
      glowColor: "rgba(245, 158, 11, 0.4)",
    };
  }
  if (pct > 0) {
    return {
      label: "1–74% Partial",
      shortLabel: "Partial",
      color: "#f97316", // Coral Orange
      textColor: "text-orange-600 dark:text-orange-400",
      bgColor: "bg-orange-500/15",
      borderColor: "border-orange-500/30",
      fillClass: "bg-orange-500",
      glowColor: "rgba(249, 115, 22, 0.4)",
    };
  }
  return {
    label: "Rest / Missed (0%)",
    shortLabel: "0%",
    color: "#94a3b8", // Slate / Muted
    textColor: "text-(--color-text-faint)",
    bgColor: "bg-(--color-surface-3)",
    borderColor: "border-(--color-border)",
    fillClass: "bg-(--color-border)",
    glowColor: "transparent",
  };
};

export default function WorkoutConsistencyChart({ memberId }: WorkoutConsistencyChartProps) {
  const [days, setDays] = useState<7 | 14 | 30>(7);
  const [viewMode, setViewMode] = useState<"graph" | "bar">("graph");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dataPoints, setDataPoints] = useState<ChartPoint[]>([]);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const chartContainerRef = useRef<HTMLDivElement>(null);

  const fetchAnalytics = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await workoutApi.getProgressAnalytics(days, memberId);
      const rawData = res?.data ?? (res as any)?.data?.data ?? [];
      setDataPoints(Array.isArray(rawData) ? rawData : []);
    } catch (err: any) {
      console.error("Failed to fetch workout consistency analytics:", err);
      setError(
        err?.response?.data?.message ||
        err?.message ||
        "Unable to load consistency analytics from server."
      );
    } finally {
      setLoading(false);
    }
  }, [days, memberId]);

  useEffect(() => {
    fetchAnalytics();

    const handleWorkoutUpdated = () => {
      fetchAnalytics();
    };

    window.addEventListener("gymai:workout-updated", handleWorkoutUpdated);
    return () => {
      window.removeEventListener("gymai:workout-updated", handleWorkoutUpdated);
    };
  }, [fetchAnalytics]);

  // Derived metrics
  const stats = useMemo(() => {
    if (dataPoints.length === 0) {
      return { avgPct: 0, activeDays: 0, perfectDays: 0 };
    }
    const totalPct = dataPoints.reduce((sum, p) => sum + (p.completionPercentage || 0), 0);
    const activeDays = dataPoints.filter((p) => p.completionPercentage > 0).length;
    const perfectDays = dataPoints.filter((p) => p.completionPercentage === 100).length;
    const avgPct = Math.round(totalPct / dataPoints.length);

    return { avgPct, activeDays, perfectDays };
  }, [dataPoints]);

  // Format short date (numeric day only, e.g. "3" or "28" without weekday text)
  const formatTickDate = (isoString: string) => {
    try {
      const parts = isoString.split("-");
      const day = parseInt(parts[2] || parts[0], 10);
      return isNaN(day) ? isoString : String(day);
    } catch {
      return isoString;
    }
  };

  // Format full date for tooltip
  const formatFullDate = (isoString: string) => {
    try {
      const [year, month, day] = isoString.split("-").map(Number);
      const d = new Date(Date.UTC(year, month - 1, day));
      return d.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric", timeZone: "UTC" });
    } catch {
      return isoString;
    }
  };

  // Compute SVG coordinates for the trend line & area graph
  const svgData = useMemo(() => {
    if (dataPoints.length === 0) return { pathString: "", areaString: "", points: [], baselineY: 170 };

    const width = 680;
    const height = 240;
    const padLeft = 46;
    const padRight = 24;
    const padTop = 20;
    const baselineY = 205;
    const graphWidth = width - padLeft - padRight;
    const graphHeight = baselineY - padTop;

    const points = dataPoints.map((point, idx) => {
      const pct = Math.min(100, Math.max(0, point.completionPercentage || 0));
      const x =
        dataPoints.length === 1
          ? padLeft + graphWidth / 2
          : padLeft + (idx / (dataPoints.length - 1)) * graphWidth;
      const y = padTop + ((100 - pct) / 100) * graphHeight;
      const tier = getCompletionTier(pct);

      return {
        idx,
        x,
        y,
        pct,
        date: point.date,
        tier,
      };
    });

    let pathString = "";
    let areaString = "";

    if (points.length === 1) {
      pathString = `M ${points[0].x - 30} ${points[0].y} L ${points[0].x + 30} ${points[0].y}`;
      areaString = `M ${points[0].x - 30} ${points[0].y} L ${points[0].x + 30} ${points[0].y} L ${points[0].x + 30} ${baselineY} L ${points[0].x - 30} ${baselineY} Z`;
    } else if (points.length > 1) {
      pathString = `M ${points[0].x} ${points[0].y}`;
      for (let i = 1; i < points.length; i++) {
        const prev = points[i - 1];
        const curr = points[i];
        const cpX1 = prev.x + (curr.x - prev.x) / 2;
        const cpY1 = prev.y;
        const cpX2 = prev.x + (curr.x - prev.x) / 2;
        const cpY2 = curr.y;
        pathString += ` C ${cpX1} ${cpY1}, ${cpX2} ${cpY2}, ${curr.x} ${curr.y}`;
      }
      const lastX = points[points.length - 1].x;
      const firstX = points[0].x;
      areaString = `${pathString} L ${lastX} ${baselineY} L ${firstX} ${baselineY} Z`;
    }

    return { pathString, areaString, points, baselineY, width, height, padLeft, padRight, padTop, graphWidth, graphHeight };
  }, [dataPoints]);

  const activeHoverPoint = hoveredIdx !== null && svgData.points ? svgData.points[hoveredIdx] : null;

  return (
    <div className="space-y-4">
      {/* Top Header & Range/View Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-(--color-border-soft)">
        <div>
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-(--color-accent-soft) flex items-center justify-center text-(--color-accent-text) shrink-0">
              <Flame className="h-4 w-4" />
            </div>
            <h4 className="font-display text-sm sm:text-base font-extrabold text-(--color-text)">
              Workout Completion & Consistency
            </h4>
          </div>
          <p className="text-xs text-(--color-text-muted) mt-0.5">
            Daily percentage of assigned workout exercises completed
          </p>
        </div>

        <div className="grid grid-cols-2 lg:flex lg:items-center gap-2 w-full lg:w-auto">
          {/* View Mode Toggle (Graph vs Bar) */}
          <div className="grid grid-cols-2 gap-1 bg-(--color-surface-2) p-1 rounded-xl border border-(--color-border) lg:flex lg:items-center">
            <button
              onClick={() => setViewMode("graph")}
              className={clsx(
                "flex items-center justify-center gap-1 px-2 sm:px-2.5 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer",
                viewMode === "graph"
                  ? "bg-(--color-surface) text-(--color-text) shadow-sm border border-(--color-border-soft)"
                  : "text-(--color-text-muted) hover:text-(--color-text)"
              )}
              title="Line Graph View"
            >
              <TrendingUp className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
              <span>Graph</span>
            </button>
            <button
              onClick={() => setViewMode("bar")}
              className={clsx(
                "flex items-center justify-center gap-1 px-2 sm:px-2.5 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer",
                viewMode === "bar"
                  ? "bg-(--color-surface) text-(--color-text) shadow-sm border border-(--color-border-soft)"
                  : "text-(--color-text-muted) hover:text-(--color-text)"
              )}
              title="Bar Chart View"
            >
              <BarChart2 className="h-3.5 w-3.5 text-(--color-accent) shrink-0" />
              <span>Bars</span>
            </button>
          </div>

          {/* Day Range Filter Buttons - Strictly 7D & 14D on Mobile & Tablet (30D Hidden on Mobile & Tablet) */}
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-1 bg-(--color-surface-2) p-1 rounded-xl border border-(--color-border) lg:flex lg:items-center">
            <button
              onClick={() => setDays(7)}
              className={clsx(
                "text-center px-2 lg:px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer",
                days === 7
                  ? "bg-(--color-surface) text-(--color-text) shadow-sm border border-(--color-border-soft)"
                  : "text-(--color-text-muted) hover:text-(--color-text)"
              )}
            >
              <span className="lg:hidden">7D</span>
              <span className="hidden lg:inline">7 Days</span>
            </button>
            <button
              onClick={() => setDays(14)}
              className={clsx(
                "text-center px-2 lg:px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer",
                days === 14
                  ? "bg-(--color-surface) text-(--color-text) shadow-sm border border-(--color-border-soft)"
                  : "text-(--color-text-muted) hover:text-(--color-text)"
              )}
            >
              <span className="lg:hidden">14D</span>
              <span className="hidden lg:inline">14 Days</span>
            </button>
            <button
              onClick={() => setDays(30)}
              className={clsx(
                "hidden lg:block text-center px-2 lg:px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer",
                days === 30
                  ? "bg-(--color-surface) text-(--color-text) shadow-sm border border-(--color-border-soft)"
                  : "text-(--color-text-muted) hover:text-(--color-text)"
              )}
            >
              <span>30 Days</span>
            </button>
          </div>
        </div>
      </div>

      {/* Summary KPI Cards - Mobile Ergonomic with Zero Text Truncation */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <div className="p-2.5 sm:p-3 rounded-xl bg-(--color-surface-2) border border-(--color-border) flex flex-col justify-between">
          <div className="flex items-center justify-between gap-1">
            <span className="text-[10px] sm:text-[11px] font-bold text-(--color-text-muted) uppercase tracking-wider block leading-tight">
              Avg Score
            </span>
            <Activity className="h-3 w-3 text-sky-500 shrink-0 opacity-75 hidden xs:block" />
          </div>
          <p className="font-mono text-base sm:text-xl font-extrabold text-(--color-text) mt-1">
            {stats.avgPct}%
          </p>
        </div>

        <div className="p-2.5 sm:p-3 rounded-xl bg-(--color-surface-2) border border-(--color-border) flex flex-col justify-between">
          <div className="flex items-center justify-between gap-1">
            <span className="text-[10px] sm:text-[11px] font-bold text-(--color-text-muted) uppercase tracking-wider block leading-tight">
              Active Days
            </span>
            <Flame className="h-3 w-3 text-orange-500 shrink-0 opacity-75 hidden xs:block" />
          </div>
          <p className="font-mono text-base sm:text-xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-1">
            {stats.activeDays} <span className="text-[10px] sm:text-xs font-medium text-(--color-text-muted)">/ {days}</span>
          </p>
        </div>

        <div className="p-2.5 sm:p-3 rounded-xl bg-(--color-surface-2) border border-(--color-border) flex flex-col justify-between">
          <div className="flex items-center justify-between gap-1">
            <span className="text-[10px] sm:text-[11px] font-bold text-(--color-text-muted) uppercase tracking-wider block leading-tight">
              <span className="xs:hidden">Perfect</span>
              <span className="hidden xs:inline">100% Score</span>
            </span>
            <Award className="h-3 w-3 text-amber-500 shrink-0 opacity-75 hidden xs:block" />
          </div>
          <p className="font-mono text-base sm:text-xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-1">
            {stats.perfectDays} <span className="text-[10px] sm:text-xs font-medium text-(--color-text-muted)">days</span>
          </p>
        </div>
      </div>

      {/* Chart View */}
      {loading ? (
        <div className="h-64 flex flex-col items-center justify-center text-(--color-text-muted) gap-2 bg-(--color-surface-2)/40 rounded-xl border border-dashed border-(--color-border)">
          <Loader2 className="h-6 w-6 animate-spin text-(--color-accent)" />
          <p className="text-xs font-semibold">Loading consistency data...</p>
        </div>
      ) : error ? (
        <div className="h-64 flex flex-col items-center justify-center text-center p-4 bg-(--color-surface-2)/40 rounded-xl border border-dashed border-(--color-border)">
          <AlertCircle className="h-8 w-8 text-amber-500 mb-1" />
          <p className="text-xs font-bold text-(--color-text)">{error}</p>
          <button
            onClick={fetchAnalytics}
            className="mt-2 text-xs font-bold text-(--color-accent) hover:underline"
          >
            Try Again
          </button>
        </div>
      ) : dataPoints.length === 0 ? (
        <div className="h-64 flex flex-col items-center justify-center text-center p-4 bg-(--color-surface-2)/40 rounded-xl border border-dashed border-(--color-border)">
          <Calendar className="h-8 w-8 text-(--color-text-faint) mb-1" />
          <p className="text-xs font-bold text-(--color-text)">No workout logs in this period</p>
          <p className="text-[11px] text-(--color-text-muted) mt-0.5">Complete your scheduled workouts to view your consistency score.</p>
        </div>
      ) : (
        <div className="bg-(--color-surface-2)/30 rounded-xl p-3 sm:p-5 border border-(--color-border-soft)">
          {viewMode === "graph" ? (
            /* ======================================================== */
            /*  INTERACTIVE SVG LINE & AREA TREND GRAPH                 */
            /* ======================================================== */
            <div className="relative w-full" ref={chartContainerRef}>
              {/* Floating Tooltip Card on Hover */}
              {activeHoverPoint && (
                <div
                  className="absolute pointer-events-none z-30 transition-all duration-150 transform -translate-x-1/2 -translate-y-full"
                  style={{
                    left: `${(activeHoverPoint.x / (svgData.width || 680)) * 100}%`,
                    top: `${(activeHoverPoint.y / (svgData.height || 210)) * 100}%`,
                    marginTop: "-12px",
                  }}
                >
                  <div className="bg-(--color-navbar) text-(--color-navbar-text) rounded-xl px-3 py-2 shadow-2xl border border-white/10 text-xs backdrop-blur-md min-w-[130px]">
                    <div className="text-[10px] text-gray-300 font-medium pb-1 border-b border-white/10 flex items-center justify-between gap-2">
                      <span>{formatFullDate(activeHoverPoint.date)}</span>
                      {activeHoverPoint.pct === 100 && (
                        <CheckCircle2 className="h-3 w-3 text-emerald-400 shrink-0" />
                      )}
                    </div>
                    <div className="mt-1 flex items-center justify-between gap-3">
                      <span className="font-mono text-sm font-black text-white">
                        {activeHoverPoint.pct}%
                      </span>
                      <span
                        className={clsx(
                          "text-[9px] font-bold px-1.5 py-0.5 rounded-full",
                          activeHoverPoint.tier.bgColor,
                          activeHoverPoint.tier.textColor,
                          "border",
                          activeHoverPoint.tier.borderColor
                        )}
                      >
                        {activeHoverPoint.tier.shortLabel}
                      </span>
                    </div>
                    <div className="text-[10px] text-gray-400 mt-0.5">
                      {activeHoverPoint.tier.label}
                    </div>
                  </div>
                </div>
              )}

              {/* Main SVG Area & Curve */}
              <div className="w-full overflow-hidden select-none">
                <div className="w-full">
                  <svg
                    viewBox={`0 0 ${svgData.width || 680} ${svgData.height || 240}`}
                    className="w-full h-56 sm:h-64 overflow-visible"
                    onMouseLeave={() => setHoveredIdx(null)}
                  >
                    <defs>
                      {/* Gradient for smooth under-fill */}
                      <linearGradient id="consistencyAreaGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#10b981" stopOpacity="0.4" />
                        <stop offset="50%" stopColor="#06b6d4" stopOpacity="0.15" />
                        <stop offset="100%" stopColor="#6366f1" stopOpacity="0.0" />
                      </linearGradient>

                      {/* Gradient for the line curve */}
                      <linearGradient id="consistencyStrokeGrad" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="#10b981" />
                        <stop offset="50%" stopColor="#06b6d4" />
                        <stop offset="100%" stopColor="#10b981" />
                      </linearGradient>

                      {/* Glow filter for highlighted nodes */}
                      <filter id="pointGlow" x="-50%" y="-50%" width="200%" height="200%">
                        <feDropShadow dx="0" dy="0" stdDeviation="3" floodColor="#10b981" floodOpacity="0.6" />
                      </filter>
                    </defs>

                    {/* Horizontal Reference Gridlines (100%, 75%, 50%, 0%) */}
                    {[
                      { val: 100, label: "100%", y: svgData.padTop },
                      { val: 75, label: "75%", y: svgData.padTop + 0.25 * (svgData.graphHeight || 151) },
                      { val: 50, label: "50%", y: svgData.padTop + 0.5 * (svgData.graphHeight || 151) },
                      { val: 0, label: "0%", y: svgData.baselineY },
                    ].map((grid, gIdx) => (
                      <g key={gIdx}>
                        <line
                          x1={svgData.padLeft}
                          y1={grid.y}
                          x2={(svgData.width || 680) - (svgData.padRight || 24)}
                          y2={grid.y}
                          stroke="var(--color-border)"
                          strokeDasharray={grid.val === 0 ? "none" : "4 4"}
                          strokeWidth={grid.val === 0 ? "1.5" : "1"}
                          strokeOpacity={grid.val === 0 ? "0.8" : "0.5"}
                        />
                        <text
                          x={svgData.padLeft - 8}
                          y={grid.y + 3.5}
                          textAnchor="end"
                          fontSize="10"
                          fontFamily="monospace"
                          fontWeight="bold"
                          fill="var(--color-text-faint)"
                        >
                          {grid.label}
                        </text>
                      </g>
                    ))}

                    {/* Area Gradient Fill Under Curve */}
                    {svgData.areaString && (
                      <path
                        d={svgData.areaString}
                        fill="url(#consistencyAreaGrad)"
                        className="transition-all duration-300 pointer-events-none"
                      />
                    )}

                    {/* The Smooth Trend Curve Line */}
                    {svgData.pathString && (
                      <path
                        d={svgData.pathString}
                        fill="none"
                        stroke="url(#consistencyStrokeGrad)"
                        strokeWidth="3.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="transition-all duration-300 pointer-events-none"
                      />
                    )}

                    {/* Active Hover Vertical Crosshair Guide */}
                    {activeHoverPoint && (
                      <line
                        x1={activeHoverPoint.x}
                        y1={svgData.padTop}
                        x2={activeHoverPoint.x}
                        y2={svgData.baselineY}
                        stroke={activeHoverPoint.tier.color}
                        strokeWidth="1.5"
                        strokeDasharray="3 3"
                        strokeOpacity="0.8"
                        className="pointer-events-none"
                      />
                    )}

                    {/* Data Points on the Curve */}
                    {svgData.points.map((p, idx) => {
                      const isHovered = hoveredIdx === idx;
                      const isPerfect = p.pct === 100;
                      const isZero = p.pct === 0;

                      return (
                        <g key={idx} className="cursor-pointer">
                          {/* Outer pulse / halo ring for 100% or hovered */}
                          {isHovered ? (
                            <>
                              <circle
                                cx={p.x}
                                cy={p.y}
                                r="12"
                                fill={p.tier.color}
                                fillOpacity="0.25"
                                stroke={p.tier.color}
                                strokeWidth="1.5"
                              />
                              <circle
                                cx={p.x}
                                cy={p.y}
                                r="6.5"
                                fill={p.tier.color}
                                stroke="var(--color-surface)"
                                strokeWidth="2.5"
                              />
                            </>
                          ) : isPerfect ? (
                            <>
                              <circle
                                cx={p.x}
                                cy={p.y}
                                r="8"
                                fill="rgba(16, 185, 129, 0.2)"
                                stroke="#10b981"
                                strokeWidth="1.5"
                                filter="url(#pointGlow)"
                              />
                              <circle
                                cx={p.x}
                                cy={p.y}
                                r="5"
                                fill="#10b981"
                                stroke="var(--color-surface)"
                                strokeWidth="2"
                              />
                            </>
                          ) : isZero ? (
                            <circle
                              cx={p.x}
                              cy={p.y}
                              r="3.5"
                              fill="var(--color-surface-2)"
                              stroke="var(--color-border)"
                              strokeWidth="1.5"
                            />
                          ) : (
                            <>
                              <circle
                                cx={p.x}
                                cy={p.y}
                                r="4.5"
                                fill={p.tier.color}
                                stroke="var(--color-surface)"
                                strokeWidth="2"
                              />
                            </>
                          )}

                          {/* Quick Percentage Label on top of points (for 7-day view or when hovered) */}
                          {days === 7 && !isZero && !isHovered && (
                            <text
                              x={p.x}
                              y={p.y - 10}
                              textAnchor="middle"
                              fontSize="10"
                              fontFamily="monospace"
                              fontWeight="bold"
                              fill={p.tier.color}
                              className="pointer-events-none select-none"
                            >
                              {p.pct}%
                            </text>
                          )}

                          {/* Large Transparent Hit Target for Mouse / Touch Interaction */}
                          <rect
                            x={p.x - ((svgData.graphWidth || 592) / (dataPoints.length || 1)) / 2}
                            y={svgData.padTop}
                            width={(svgData.graphWidth || 592) / (dataPoints.length || 1)}
                            height={(svgData.baselineY || 175) - (svgData.padTop || 24) + 20}
                            fill="transparent"
                            onMouseEnter={() => setHoveredIdx(idx)}
                            onTouchStart={() => setHoveredIdx(idx)}
                          />
                        </g>
                      );
                    })}
                  </svg>

                  {/* X-Axis Date Labels */}
                  <div
                    className="flex items-center justify-between mt-2 text-[10px] font-semibold text-(--color-text-muted)"
                    style={{ paddingLeft: "6.8%", paddingRight: "3.5%" }}
                  >
                    {dataPoints.map((point, idx) => {
                      const showLabel =
                        days === 7 ||
                        (days === 14 && (dataPoints.length - 1 - idx) % 2 === 0) ||
                        (days === 30 && (dataPoints.length - 1 - idx) % 5 === 0);

                      return (
                        <div key={idx} className="flex-1 text-center min-w-0">
                          {showLabel ? (
                            <span
                              className={clsx(
                                "block text-[10px] sm:text-[11px] font-mono transition-colors",
                                hoveredIdx === idx
                                  ? "text-(--color-text) font-black scale-110"
                                  : "text-(--color-text-muted) font-bold"
                              )}
                            >
                              {formatTickDate(point.date)}
                            </span>
                          ) : (
                            <span className="block text-[8px] text-(--color-text-faint)/30 select-none">
                              ·
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* ======================================================== */
            /*  TIERED BAR CHART VIEW (FALLBACK/ALTERNATIVE)            */
            /* ======================================================== */
            <div className="w-full">
              <div className="h-56 sm:h-64 flex items-end gap-1 sm:gap-2 pt-6 pb-2 border-b border-(--color-border)">
                {dataPoints.map((point, idx) => {
                  const pct = Math.min(100, Math.max(0, point.completionPercentage || 0));
                  const tier = getCompletionTier(pct);
                  const isZero = pct === 0;

                  return (
                    <div
                      key={idx}
                      className="flex-1 flex flex-col items-center justify-end h-full group relative min-w-0"
                    >
                      {/* Tooltip on hover */}
                      <div className="absolute -top-8 opacity-0 group-hover:opacity-100 transition-opacity bg-(--color-navbar) text-(--color-navbar-text) text-[10px] font-bold px-2 py-0.5 rounded shadow-lg pointer-events-none whitespace-nowrap z-20">
                        {formatFullDate(point.date)}: {pct}% ({tier.shortLabel})
                      </div>

                      {/* Percentage Label on top */}
                      <span
                        className={clsx(
                          "text-[9px] sm:text-[10px] font-mono font-bold mb-1 transition-colors truncate",
                          tier.textColor
                        )}
                      >
                        {pct > 0 ? `${pct}%` : "—"}
                      </span>

                      {/* The Bar */}
                      <div className="w-full max-w-[36px] bg-(--color-surface-3) rounded-t-md h-full flex items-end overflow-hidden">
                        <div
                          style={{
                            height: `${isZero ? 4 : pct}%`,
                            backgroundColor: tier.color,
                          }}
                          className="w-full rounded-t-md transition-all duration-500"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* X-Axis Date Labels for Bars */}
              <div className="flex items-center justify-between gap-0.5 mt-2 text-[10px] font-semibold text-(--color-text-muted)">
                {dataPoints.map((point, idx) => {
                  const showLabel =
                    days === 7 ||
                    (days === 14 && (dataPoints.length - 1 - idx) % 2 === 0) ||
                    (days === 30 && (dataPoints.length - 1 - idx) % 5 === 0);

                  return (
                    <div key={idx} className="flex-1 text-center min-w-0">
                      {showLabel ? (
                        <span className="block text-[10px] sm:text-[11px] font-mono font-bold text-(--color-text-muted)">
                          {formatTickDate(point.date)}
                        </span>
                      ) : (
                        <span className="block text-[8px] text-(--color-text-faint)/30 select-none">
                          ·
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Tiered Legend based on User's requested ranges */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:flex lg:flex-wrap items-center justify-center gap-x-3 gap-y-2 mt-4 pt-3 border-t border-(--color-border-soft) text-[10px] sm:text-[11px] text-(--color-text-muted)">
            <div className="flex items-center gap-1.5 min-w-0">
              <div className="h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-emerald-500/20 shrink-0" />
              <span className="font-semibold text-(--color-text) truncate">100% Completed</span>
            </div>
            <div className="flex items-center gap-1.5 min-w-0">
              <div className="h-2.5 w-2.5 rounded-full bg-cyan-500 shrink-0" />
              <span className="font-medium truncate">95–99%</span>
            </div>
            <div className="flex items-center gap-1.5 min-w-0">
              <div className="h-2.5 w-2.5 rounded-full bg-indigo-500 shrink-0" />
              <span className="font-medium truncate">90–94%</span>
            </div>
            <div className="flex items-center gap-1.5 min-w-0">
              <div className="h-2.5 w-2.5 rounded-full bg-amber-500 shrink-0" />
              <span className="font-medium truncate">75–89%</span>
            </div>
            <div className="flex items-center gap-1.5 min-w-0">
              <div className="h-2.5 w-2.5 rounded-full bg-orange-500 shrink-0" />
              <span className="font-medium truncate">1–74% Partial</span>
            </div>
            <div className="flex items-center gap-1.5 min-w-0">
              <div className="h-2.5 w-2.5 rounded-full bg-slate-400 shrink-0" />
              <span className="font-medium truncate">Rest / 0%</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
