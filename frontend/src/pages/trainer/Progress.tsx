import { useState, useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Loader2,
  RefreshCw,
  Users,
  Dumbbell,
  Scale,
  TrendingUp,
  FileDown,
  ChevronRight,
  Activity,
  CheckCircle2,
  AlertTriangle,
  Calendar,
  Plus,
  Flame,
} from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import ProgressBar from "@/components/ui/ProgressBar";
import Modal from "@/components/ui/Modal";
import { trainerApi, progressApi, workoutApi } from "@/lib/endpoints";
import { useAuthStore } from "@/store/authStore";
import { toast } from "sonner";
import { exportClientProgressCsv, exportClientProgressPdf } from "@/utils/reportExporter";
import type { IMemberClient } from "@/types";

interface ClientProgressItem {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  planTitle: string;
  membershipPlan: string;
  latestWeight: number | null;
  initialWeight: number | null;
  targetWeight: number | null;
  heightCm: number | null;
  bmiScore: number | null;
  bmiCategory: string;
  weightChange: string;
  completionRatePercent: number;
  totalWorkoutSessions: number;
  completedWorkoutSessions: number;
  totalPlannedExercises: number;
  totalCompletedExercises: number;
  weightHistory: Array<{ date: string; label: string; value: number; heightCm?: number }>;
  exerciseStats: Array<{ exerciseId?: string; name: string; maxWeightKg: number; volume?: number; initialWeightKg?: number }>;
  weeklyVolumeLogs: Array<{ day: string; volume: number; label: string }>;
  mostSkippedExercises: Array<{ name: string; skipCount: number }>;
  workoutLogs: Array<{ date: string; title: string; exercisesCount?: number; durationMinutes?: number }>;
  rawClient?: IMemberClient;
}

function SparklineChart({ data }: { data: Array<{ label: string; value: number }> }) {
  if (!data || data.length === 0) return null;

  const width = 140;
  const height = 32;
  const padX = 6;
  const padY = 6;

  const values = data.map((d) => d.value);
  const min = Math.min(...values) - 0.5;
  const max = Math.max(...values) + 0.5;
  const range = Math.max(0.1, max - min);

  if (data.length === 1) {
    const y = padY + ((max - data[0].value) * (height - padY * 2)) / range;
    return (
      <div className="hidden sm:flex flex-col items-center shrink-0">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-24 h-7 shrink-0 overflow-visible">
          <circle cx={width / 2} cy={y} r="3.5" fill="var(--color-accent)" />
          <text x={width / 2} y={y - 5} fontSize="9" textAnchor="middle" fill="var(--color-text)" fontWeight="bold">
            {data[0].value} kg
          </text>
        </svg>
      </div>
    );
  }

  const points = data.map((d, i) => {
    const x = padX + (i * (width - padX * 2)) / (data.length - 1);
    const y = padY + ((max - d.value) * (height - padY * 2)) / range;
    return { x, y, value: d.value };
  });

  const pathStr = points.reduce((acc, pt, idx) => {
    if (idx === 0) return `M ${pt.x} ${pt.y}`;
    const prev = points[idx - 1];
    const cx = (prev.x + pt.x) / 2;
    return `${acc} C ${cx} ${prev.y}, ${cx} ${pt.y}, ${pt.x} ${pt.y}`;
  }, "");

  const lastPt = points[points.length - 1];
  const firstPt = points[0];

  return (
    <div className="hidden sm:flex flex-col items-end shrink-0">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-24 h-7 shrink-0 overflow-visible">
        <path d={pathStr} fill="none" stroke="var(--color-accent)" strokeWidth="2" strokeLinecap="round" />
        <circle cx={firstPt.x} cy={firstPt.y} r="2" fill="var(--color-text-muted)" />
        <circle cx={lastPt.x} cy={lastPt.y} r="3" fill="var(--color-accent)" stroke="var(--color-surface)" strokeWidth="1.5" />
      </svg>
      <span className="text-[9px] font-semibold text-(--color-text-faint)">Weight Trend</span>
    </div>
  );
}

// Calculate BMI details
function getBmiInfo(weightKg: number | null, heightCm: number | null) {
  if (!weightKg || !heightCm || heightCm <= 0) {
    return { score: null, category: "N/A", tone: "neutral" as const };
  }
  const heightM = heightCm / 100;
  const score = Number((weightKg / (heightM * heightM)).toFixed(1));
  if (score < 18.5) return { score, category: "Underweight", tone: "warning" as const };
  if (score < 25) return { score, category: "Normal", tone: "good" as const };
  if (score < 30) return { score, category: "Overweight", tone: "warning" as const };
  return { score, category: "Obese", tone: "danger" as const };
}

// SVG Interactive Weight Progression Curve Chart matching Member Dashboard (PerformanceCharts)
function WeightCurveProgressionChart({
  history,
  targetWeightKg,
}: {
  history: Array<{ date: string; label: string; value: number; heightCm?: number }>;
  targetWeightKg?: number | null;
}) {
  const displayLogs = useMemo(() => {
    return [...history]
      .filter((item) => Number(item.value) > 0)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [history]);

  const svgChartData = useMemo(() => {
    if (displayLogs.length === 0) {
      return { pathString: "", areaString: "", points: [], targetY: null, minW: 0, maxW: 0 };
    }

    const width = 600;
    const height = 200;
    const padding = 35;

    const weights = displayLogs.map((d) => Number(d.value));
    const targetVal = targetWeightKg ? Number(targetWeightKg) : null;
    const minW = Math.min(...weights, ...(targetVal ? [targetVal] : [])) - 1.5;
    const maxW = Math.max(...weights, ...(targetVal ? [targetVal] : [])) + 1.5;
    const range = Math.max(0.1, maxW - minW);

    const points = displayLogs.map((d, idx) => {
      const x = displayLogs.length === 1 ? width / 2 : padding + (idx / (displayLogs.length - 1)) * (width - 2 * padding);
      const y = height - padding - ((Number(d.value) - minW) / range) * (height - 2 * padding);
      return { x, y, weight: Number(d.value), label: d.label };
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

    const targetY = targetVal
      ? height - padding - ((targetVal - minW) / range) * (height - 2 * padding)
      : null;

    return { pathString, areaString, points, targetY, minW, maxW };
  }, [displayLogs, targetWeightKg]);

  if (displayLogs.length === 0) {
    return (
      <div className="text-center py-8 bg-(--color-surface-2) rounded-2xl border border-dashed border-(--color-border) text-xs text-(--color-text-muted)">
        <Scale className="w-8 h-8 mx-auto text-(--color-text-faint) mb-2" />
        <p className="font-semibold text-(--color-text)">No weigh-in logs recorded yet</p>
        <p className="text-[11px] text-(--color-text-muted) mt-0.5">Click "Log New Weigh-In" above to record client's current weight and height.</p>
      </div>
    );
  }

  return (
    <div className="relative w-full rounded-2xl bg-(--color-surface-2) p-4 sm:p-5 border border-(--color-border) space-y-3">
      <div className="flex flex-wrap justify-between items-center gap-2 mb-1">
        <div>
          <span className="text-xs font-bold text-(--color-text)">
            Weight Curve Progression ({displayLogs.length} logs)
          </span>
          <p className="text-[11px] text-(--color-text-muted)">
            Initial: {displayLogs[0].value} kg → Latest: {displayLogs[displayLogs.length - 1].value} kg
          </p>
        </div>
        <div className="flex items-center gap-3 text-[11px]">
          {targetWeightKg ? (
            <span className="flex items-center gap-1 text-emerald-500 font-semibold">
              <span className="h-2 w-2 rounded-full bg-emerald-500" /> Target ({targetWeightKg}kg)
            </span>
          ) : null}
          <span className="flex items-center gap-1 text-(--color-accent) font-semibold">
            <span className="h-2 w-2 rounded-full bg-(--color-accent)" /> Weight Trend
          </span>
        </div>
      </div>

      <svg viewBox="0 0 600 200" className="w-full h-48 sm:h-52 overflow-visible">
        <defs>
          <linearGradient id="trainerWeightAreaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-accent, #FCA311)" stopOpacity="0.35" />
            <stop offset="100%" stopColor="var(--color-accent, #FCA311)" stopOpacity="0.0" />
          </linearGradient>
        </defs>

        {/* Horizontal Grid lines */}
        <line x1="35" y1="40" x2="565" y2="40" stroke="var(--color-border)" strokeDasharray="4 4" strokeOpacity="0.6" />
        <line x1="35" y1="100" x2="565" y2="100" stroke="var(--color-border)" strokeDasharray="4 4" strokeOpacity="0.6" />
        <line x1="35" y1="160" x2="565" y2="160" stroke="var(--color-border)" strokeDasharray="4 4" strokeOpacity="0.6" />

        {/* Target Weight Reference Line */}
        {svgChartData.targetY && (
          <g>
            <line
              x1="35"
              y1={svgChartData.targetY}
              x2="565"
              y2={svgChartData.targetY}
              stroke="#10b981"
              strokeWidth="2"
              strokeDasharray="6 4"
            />
            <text x="560" y={svgChartData.targetY - 5} textAnchor="end" fill="#10b981" fontSize="9" fontWeight="bold">
              Target {targetWeightKg}kg
            </text>
          </g>
        )}

        {/* Area Fill */}
        {svgChartData.areaString && (
          <path d={svgChartData.areaString} fill="url(#trainerWeightAreaGrad)" />
        )}

        {/* Smooth Line Curve */}
        {svgChartData.pathString && (
          <path
            d={svgChartData.pathString}
            fill="none"
            stroke="var(--color-accent, #FCA311)"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}

        {/* Data Points & Value Badges */}
        {svgChartData.points.map((pt, idx) => (
          <g key={idx} className="group cursor-pointer">
            <circle
              cx={pt.x}
              cy={pt.y}
              r="5.5"
              fill="var(--color-accent, #FCA311)"
              stroke="var(--color-surface)"
              strokeWidth="2.5"
              className="transition-all duration-200 group-hover:r-7"
            />
            {/* Weight label above node */}
            <text
              x={pt.x}
              y={pt.y - 12}
              textAnchor="middle"
              fill="var(--color-text)"
              fontSize="11"
              fontWeight="800"
              className="font-sans opacity-95 group-hover:opacity-100"
            >
              {pt.weight} kg
            </text>
            {/* Date label on X-axis */}
            <text
              x={pt.x}
              y="188"
              textAnchor="middle"
              fill="var(--color-text-muted)"
              fontSize="10"
              fontWeight="600"
            >
              {pt.label}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}

export default function Progress() {
  const user = useAuthStore((s) => s.user);
  const [searchParams, setSearchParams] = useSearchParams();
  const initialClientId = searchParams.get("clientId") || "";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [clientProgress, setClientProgress] = useState<ClientProgressItem[]>([]);
  const [selectedClient, setSelectedClient] = useState<ClientProgressItem | null>(null);
  const [activeTab, setActiveTab] = useState<"weight" | "workout" | "strength">("weight");

  // Log weigh-in inside modal state
  const [showLogModal, setShowLogModal] = useState(false);
  const [logWeightVal, setLogWeightVal] = useState<string>("");
  const [logHeightVal, setLogHeightVal] = useState<string>("");
  const [logTargetVal, setLogTargetVal] = useState<string>("");
  const [savingLog, setSavingLog] = useState(false);

  const fetchProgress = async () => {
    if (!user?.gymId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const clientsRes = await trainerApi.getMyClients(user.gymId);
      const clientsList = Array.isArray(clientsRes) ? clientsRes : clientsRes?.clients || [];

      if (clientsList.length === 0) {
        setClientProgress([]);
        setLoading(false);
        return;
      }

      const items: ClientProgressItem[] = await Promise.all(
        clientsList.map(async (c: IMemberClient) => {
          const cId = c._id || c.id;
          const name = c.fullName || c.name || c.userId?.fullName || "Member";
          const email = c.email || c.userId?.email || "";
          const phone = c.phone || c.userId?.phone || "";
          const membershipPlan = c.planName || c.membershipPlan || "Membership";

          let latestWeight: number | null = c.healthInfo?.currentWeight_kg || c.weightKg || null;
          let initialWeight: number | null = null;
          let targetWeight: number | null = c.healthInfo?.targetWeight_kg || c.targetWeightKg || null;
          let heightCm: number | null = c.healthInfo?.height_cm || c.heightCm || null;

          let weightChange = "No weight logs yet";
          let planTitle = "No active plan";
          let completionRatePercent = 0;
          let totalWorkoutSessions = 0;
          let completedWorkoutSessions = 0;
          let totalPlannedExercises = 0;
          let totalCompletedExercises = 0;
          let weightHistory: Array<{ date: string; label: string; value: number; heightCm?: number }> = [];
          let exerciseStats: Array<{ exerciseId?: string; name: string; maxWeightKg: number; volume?: number; initialWeightKg?: number }> = [];
          let weeklyVolumeLogs: Array<{ day: string; volume: number; label: string }> = [];
          let mostSkippedExercises: Array<{ name: string; skipCount: number }> = [];
          let workoutLogs: Array<{ date: string; title: string; exercisesCount?: number; durationMinutes?: number }> = [];

          if (cId) {
            const [histRes, planRes, statsRes, logsRes] = await Promise.all([
              progressApi.getHistory(cId).catch(() => null),
              workoutApi.getActivePlan(cId).catch(() => null),
              workoutApi.getCompletionStats(cId).catch(() => null),
              workoutApi.getHistory(cId, 1, 10).catch(() => null),
            ]);

            const history = (histRes as { history?: Array<{ createdAt?: string; recordedAt?: string; weightKg: number; heightCm?: number }> })?.history || (Array.isArray(histRes) ? histRes : []);
            if (Array.isArray(history) && history.length > 0) {
              const sorted = [...history].sort(
                (a, b) => new Date(a.createdAt || a.recordedAt || "").getTime() - new Date(b.createdAt || b.recordedAt || "").getTime()
              );
              const first = sorted[0].weightKg;
              const last = sorted[sorted.length - 1].weightKg;
              initialWeight = first;
              latestWeight = last;
              const diff = Number((last - first).toFixed(1));
              if (history.length === 1) {
                weightChange = `Initial log: ${last} kg`;
              } else {
                weightChange = `${diff >= 0 ? "+" : ""}${diff} kg (${history.length} logs)`;
              }
              weightHistory = sorted.map((item) => ({
                date: new Date(item.createdAt || item.recordedAt || "").toLocaleDateString(),
                label: new Date(item.createdAt || item.recordedAt || "").toLocaleDateString("en-US", { month: "short", day: "numeric" }),
                value: Number(item.weightKg),
                heightCm: item.heightCm || heightCm || undefined,
              }));
            }

            if (planRes && (planRes.plan || (planRes as { title?: string }).title || (planRes as { name?: string }).name)) {
              const p = planRes.plan || planRes;
              planTitle = (p as { title?: string; name?: string }).title || (p as { title?: string; name?: string }).name || "Active Workout Plan";
            }

            if (logsRes) {
              const rawLogs = Array.isArray(logsRes) ? logsRes : logsRes?.logs || [];
              workoutLogs = rawLogs.map((l: { startedAt?: string; createdAt?: string; dayLabel?: string; exercises?: unknown[]; totalDurationMinutes?: number }) => ({
                date: new Date(l.startedAt || l.createdAt || "").toLocaleDateString(),
                title: l.dayLabel || "Workout Session",
                exercisesCount: l.exercises?.length || 0,
                durationMinutes: l.totalDurationMinutes || 0,
              }));
            }

            if (statsRes) {
              const stats = statsRes?.stats || statsRes;
              completionRatePercent = stats?.completionRatePercent ?? 0;
              totalWorkoutSessions = stats?.totalWorkoutSessions ?? 0;
              completedWorkoutSessions = stats?.completedWorkoutSessions ?? (stats?.totalCompletedExercises > 0 ? totalWorkoutSessions : 0);
              totalPlannedExercises = stats?.totalPlannedExercises ?? 0;
              totalCompletedExercises = stats?.totalCompletedExercises ?? 0;
              exerciseStats = stats?.exerciseStats || [];
              weeklyVolumeLogs = stats?.weeklyVolumeLogs || [];
              mostSkippedExercises = stats?.mostSkippedExercises || [];
            }
          }

          const bmi = getBmiInfo(latestWeight, heightCm);

          return {
            id: String(cId || name),
            name,
            phone,
            email,
            planTitle,
            membershipPlan,
            latestWeight,
            initialWeight,
            targetWeight,
            heightCm,
            bmiScore: bmi.score,
            bmiCategory: bmi.category,
            weightChange,
            completionRatePercent,
            totalWorkoutSessions,
            completedWorkoutSessions,
            totalPlannedExercises,
            totalCompletedExercises,
            weightHistory,
            exerciseStats,
            weeklyVolumeLogs,
            mostSkippedExercises,
            workoutLogs,
            rawClient: c,
          };
        })
      );

      setClientProgress(items);

      // Auto select if query param clientId matches
      if (initialClientId) {
        const found = items.find((i) => i.id === initialClientId);
        if (found) setSelectedClient(found);
      }
    } catch {
      setError("Failed to load client progress records from backend.");
      setClientProgress([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProgress();
  }, [user]);

  const handleSelectClient = (client: ClientProgressItem) => {
    setSelectedClient(client);
    setSearchParams({ clientId: client.id });
  };

  const handleCloseModal = () => {
    setSelectedClient(null);
    setSearchParams({});
  };

  const handleOpenLogModal = (client: ClientProgressItem) => {
    setLogWeightVal(client.latestWeight ? String(client.latestWeight) : "70");
    setLogHeightVal(client.heightCm ? String(client.heightCm) : "175");
    setLogTargetVal(client.targetWeight ? String(client.targetWeight) : "68");
    setShowLogModal(true);
  };

  const handleSaveWeightLog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClient) return;

    const w = parseFloat(logWeightVal);
    const h = parseFloat(logHeightVal);
    const t = parseFloat(logTargetVal);

    if (isNaN(w) || w <= 0) {
      toast.error("Please enter a valid weight in kg");
      return;
    }

    setSavingLog(true);
    try {
      await progressApi.logWeight({
        memberId: selectedClient.id,
        weightKg: w,
        heightCm: !isNaN(h) && h > 0 ? h : undefined,
        targetWeightKg: !isNaN(t) && t > 0 ? t : undefined,
      });

      toast.success(`Weight & Body Metrics saved for ${selectedClient.name}!`);
      setShowLogModal(false);
      await fetchProgress();

      // Update selected client
      if (selectedClient) {
        setSelectedClient((prev) => {
          if (!prev) return null;
          const newBmi = getBmiInfo(w, !isNaN(h) ? h : prev.heightCm);
          return {
            ...prev,
            latestWeight: w,
            heightCm: !isNaN(h) ? h : prev.heightCm,
            targetWeight: !isNaN(t) ? t : prev.targetWeight,
            bmiScore: newBmi.score,
            bmiCategory: newBmi.category,
            weightHistory: [
              ...prev.weightHistory,
              {
                date: new Date().toLocaleDateString(),
                label: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" }),
                value: w,
                heightCm: !isNaN(h) ? h : prev.heightCm || undefined,
              },
            ],
          };
        });
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || err.message || "Failed to log weight");
    } finally {
      setSavingLog(false);
    }
  };

  const handleExportPdf = (client: ClientProgressItem) => {
    toast.info("Generating PDF report...");
    exportClientProgressPdf({
      clientName: client.name,
      clientEmail: client.email,
      clientPhone: client.phone,
      planTitle: client.planTitle,
      membershipPlan: client.membershipPlan,
      currentWeight: client.latestWeight,
      initialWeight: client.initialWeight,
      targetWeight: client.targetWeight,
      heightCm: client.heightCm,
      bmiScore: client.bmiScore,
      bmiCategory: client.bmiCategory,
      completionRatePercent: client.completionRatePercent,
      totalWorkoutSessions: client.totalWorkoutSessions,
      weightHistory: client.weightHistory.map((w) => ({
        date: w.date,
        weightKg: w.value,
        heightCm: w.heightCm,
      })),
      exerciseStats: client.exerciseStats,
      workoutLogs: client.workoutLogs,
      trainerName: user?.fullName || "Assigned Trainer",
      gymName: user?.gymName || user?.branchName || "",
    });
    toast.success("Progress report exported to PDF!");
  };

  const handleExportCsv = (client: ClientProgressItem) => {
    toast.info("Generating CSV report...");
    exportClientProgressCsv({
      clientName: client.name,
      clientEmail: client.email,
      clientPhone: client.phone,
      planTitle: client.planTitle,
      membershipPlan: client.membershipPlan,
      currentWeight: client.latestWeight,
      initialWeight: client.initialWeight,
      targetWeight: client.targetWeight,
      heightCm: client.heightCm,
      bmiScore: client.bmiScore,
      bmiCategory: client.bmiCategory,
      completionRatePercent: client.completionRatePercent,
      totalWorkoutSessions: client.totalWorkoutSessions,
      weightHistory: client.weightHistory.map((w) => ({
        date: w.date,
        weightKg: w.value,
        heightCm: w.heightCm,
      })),
      exerciseStats: client.exerciseStats,
      workoutLogs: client.workoutLogs,
      trainerName: user?.fullName || "Assigned Trainer",
      gymName: user?.gymName || user?.branchName || "",
    });
    toast.success("Progress data downloaded as CSV!");
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Client Progress"
        subtitle="Strength & body composition trends across assigned clients"
        backTo="/trainer"
        action={
          <button
            onClick={fetchProgress}
            className="inline-flex items-center gap-1.5 p-2 rounded-lg bg-(--color-surface-2) text-xs text-(--color-text-muted) hover:text-(--color-text) border border-(--color-border) cursor-pointer"
            title="Refresh Progress"
          >
            <RefreshCw size={14} className={loading ? "animate-spin text-(--color-accent)" : ""} /> Refresh
          </button>
        }
      />

      {loading ? (
        <Card className="flex items-center justify-center p-12 text-sm text-(--color-text-muted) gap-2">
          <Loader2 className="w-5 h-5 animate-spin text-(--color-accent)" /> Loading client progress records...
        </Card>
      ) : error ? (
        <Card className="text-center py-8">
          <p className="text-sm text-(--color-danger) mb-3">{error}</p>
          <button
            onClick={fetchProgress}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs rounded-full bg-(--color-surface-3) text-(--color-text) cursor-pointer"
          >
            <RefreshCw size={14} /> Retry
          </button>
        </Card>
      ) : clientProgress.length === 0 ? (
        <Card className="text-center py-12 text-(--color-text-muted) space-y-2">
          <Users className="w-8 h-8 mx-auto text-(--color-text-faint)" />
          <p className="text-sm font-medium text-(--color-text)">No client progress records found</p>
          <p className="text-xs text-(--color-text-muted)">
            As your assigned clients log weights and workouts, their progress trends will appear here.
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {clientProgress.map((p) => (
            <Card
              key={p.id}
              onClick={() => handleSelectClient(p)}
              className="p-4.5 space-y-3 border border-(--color-border) bg-(--color-surface) hover:border-(--color-accent)/40 transition-all cursor-pointer group shadow-sm hover:shadow-md"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-(--color-accent)/15 text-(--color-accent) font-bold text-sm flex items-center justify-center border border-(--color-accent)/30 shrink-0 uppercase group-hover:scale-105 transition-transform">
                    {p.name[0]}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold text-(--color-text) group-hover:text-(--color-accent) transition-colors">
                        {p.name}
                      </p>
                      {p.bmiScore && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-(--color-surface-2) font-semibold text-(--color-text-muted) border border-(--color-border)">
                          BMI {p.bmiScore}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-(--color-text-muted) mt-0.5 flex items-center gap-1">
                      <Dumbbell size={13} className="text-(--color-accent) shrink-0" />
                      {p.planTitle}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3.5 text-right">
                  <SparklineChart data={p.weightHistory} />
                  <div>
                    {p.latestWeight !== null ? (
                      <p className="text-sm font-extrabold text-(--color-text)">
                        {p.latestWeight} <span className="text-xs font-normal text-(--color-text-muted)">kg</span>
                      </p>
                    ) : (
                      <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-(--color-surface-2) text-(--color-text-muted) border border-(--color-border)">
                        No weigh-in
                      </span>
                    )}
                    <p className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold mt-0.5">{p.weightChange}</p>
                  </div>

                  <div className="hidden sm:flex items-center text-(--color-text-muted) group-hover:text-(--color-accent) transition-colors pl-2">
                    <ChevronRight size={18} />
                  </div>
                </div>
              </div>

              <div className="space-y-1 pt-1">
                <div className="flex justify-between text-[11px] font-semibold text-(--color-text-muted)">
                  <span>Workout Completion Rate ({p.totalWorkoutSessions} sessions logged)</span>
                  <span className="font-bold text-(--color-text)">{p.completionRatePercent}%</span>
                </div>
                <ProgressBar value={p.completionRatePercent} max={100} />
              </div>

              <div className="pt-2 border-t border-(--color-border)/50 flex items-center justify-between text-xs">
                <span className="text-[11px] text-(--color-text-faint)">Click to view detailed metrics, PR growth & export reports</span>
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-(--color-accent)">
                  View Details & Report <ChevronRight size={13} />
                </span>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Comprehensive Client Progress Deep-Dive Modal */}
      {selectedClient && (
        <Modal
          onClose={handleCloseModal}
          maxWidth="4xl"
          title={`Progress Report — ${selectedClient.name}`}
          subtitle={`${selectedClient.membershipPlan} · ${selectedClient.planTitle}`}
        >
          <div className="space-y-5">
            {/* Top Action Bar: Export / Download Report Buttons */}
            <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-2xl bg-(--color-surface-2) border border-(--color-border)">
              <div className="flex items-center gap-2">
                <Activity className="w-5 h-5 text-(--color-accent)" />
                <div>
                  <p className="text-xs font-bold text-(--color-text)">Export Client Progress Report</p>
                  <p className="text-[11px] text-(--color-text-muted)">Download comprehensive summary in PDF or raw data in CSV</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleExportPdf(selectedClient)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-(--color-accent) text-(--color-navbar) text-xs font-bold shadow hover:brightness-110 transition-all cursor-pointer"
                >
                  <FileDown size={14} /> Export PDF Report
                </button>
                <button
                  onClick={() => handleExportCsv(selectedClient)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-(--color-surface-3) text-(--color-text) text-xs font-semibold hover:bg-white/10 transition-all border border-(--color-border) cursor-pointer"
                >
                  <FileDown size={14} /> Export CSV
                </button>
              </div>
            </div>

            {/* Quick KPI Stat Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 rounded-2xl bg-(--color-surface-2) border border-(--color-border) space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-(--color-text-muted)">Current Weight</span>
                <p className="text-lg font-black text-(--color-text)">
                  {selectedClient.latestWeight !== null ? `${selectedClient.latestWeight} kg` : "—"}
                </p>
                <p className="text-[11px] font-semibold text-emerald-500">{selectedClient.weightChange}</p>
              </div>

              <div className="p-3 rounded-2xl bg-(--color-surface-2) border border-(--color-border) space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-(--color-text-muted)">BMI Score</span>
                <div className="flex items-baseline gap-1.5">
                  <p className="text-lg font-black text-(--color-text)">{selectedClient.bmiScore ?? "—"}</p>
                  {selectedClient.bmiCategory && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-(--color-accent)/15 text-(--color-accent)">
                      {selectedClient.bmiCategory}
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-(--color-text-muted)">Height: {selectedClient.heightCm ? `${selectedClient.heightCm} cm` : "Not set"}</p>
              </div>

              <div className="p-3 rounded-2xl bg-(--color-surface-2) border border-(--color-border) space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-(--color-text-muted)">Workout Completion</span>
                <p className="text-lg font-black text-emerald-500">{selectedClient.completionRatePercent}%</p>
                <p className="text-[11px] text-(--color-text-muted)">{selectedClient.totalWorkoutSessions} sessions logged</p>
              </div>

              <div className="p-3 rounded-2xl bg-(--color-surface-2) border border-(--color-border) space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-(--color-text-muted)">Target Goal</span>
                <p className="text-lg font-black text-(--color-accent)">
                  {selectedClient.targetWeight ? `${selectedClient.targetWeight} kg` : "—"}
                </p>
                <p className="text-[11px] text-(--color-text-muted)">
                  {selectedClient.latestWeight && selectedClient.targetWeight
                    ? `${Math.abs(Number((selectedClient.latestWeight - selectedClient.targetWeight).toFixed(1)))} kg diff`
                    : "No target set"}
                </p>
              </div>
            </div>

            {/* Tab Header */}
            <div className="flex border-b border-(--color-border) gap-2">
              <button
                onClick={() => setActiveTab("weight")}
                className={`pb-2.5 px-3 text-xs font-bold transition-all border-b-2 cursor-pointer flex items-center gap-1.5 ${
                  activeTab === "weight"
                    ? "border-(--color-accent) text-(--color-accent)"
                    : "border-transparent text-(--color-text-muted) hover:text-(--color-text)"
                }`}
              >
                <Scale size={14} /> Weight & BMI Trend
              </button>
              <button
                onClick={() => setActiveTab("workout")}
                className={`pb-2.5 px-3 text-xs font-bold transition-all border-b-2 cursor-pointer flex items-center gap-1.5 ${
                  activeTab === "workout"
                    ? "border-(--color-accent) text-(--color-accent)"
                    : "border-transparent text-(--color-text-muted) hover:text-(--color-text)"
                }`}
              >
                <CheckCircle2 size={14} /> Workout Completion ({selectedClient.completionRatePercent}%)
              </button>
              <button
                onClick={() => setActiveTab("strength")}
                className={`pb-2.5 px-3 text-xs font-bold transition-all border-b-2 cursor-pointer flex items-center gap-1.5 ${
                  activeTab === "strength"
                    ? "border-(--color-accent) text-(--color-accent)"
                    : "border-transparent text-(--color-text-muted) hover:text-(--color-text)"
                }`}
              >
                <TrendingUp size={14} /> Strength & PR Growth ({selectedClient.exerciseStats.length})
              </button>
            </div>

            {/* TAB 1: Weight & BMI Trend */}
            {activeTab === "weight" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-extrabold uppercase tracking-wider text-(--color-text-muted)">
                    Body Composition & Weigh-In Logs
                  </h4>
                  <button
                    onClick={() => handleOpenLogModal(selectedClient)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-(--color-surface-2) text-(--color-accent) text-xs font-bold border border-(--color-border) hover:bg-(--color-surface-3) transition-colors cursor-pointer"
                  >
                    <Plus size={13} /> Log New Weigh-In
                  </button>
                </div>

                {selectedClient.weightHistory.length === 0 ? (
                  <div className="text-center py-8 bg-(--color-surface-2) rounded-2xl border border-dashed border-(--color-border) text-xs text-(--color-text-muted)">
                    <Scale className="w-8 h-8 mx-auto text-(--color-text-faint) mb-2" />
                    <p className="font-semibold text-(--color-text)">No weigh-in logs recorded yet</p>
                    <p className="text-[11px] text-(--color-text-muted) mt-0.5">Click "Log New Weigh-In" above to record client's current weight and height.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {/* SVG Interactive Weight Curve Graph matching Member Dashboard */}
                    <WeightCurveProgressionChart
                      history={selectedClient.weightHistory}
                      targetWeightKg={selectedClient.targetWeight}
                    />

                    {/* Table of logs */}
                    <div className="overflow-x-auto rounded-2xl border border-(--color-border)">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-(--color-surface-2) text-(--color-text-muted) font-bold text-[10px] uppercase border-b border-(--color-border)">
                          <tr>
                            <th className="p-3">Recorded Date</th>
                            <th className="p-3">Weight (kg)</th>
                            <th className="p-3">Height (cm)</th>
                            <th className="p-3">Calculated BMI</th>
                            <th className="p-3 text-right">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-(--color-border)">
                          {[...selectedClient.weightHistory].reverse().map((log, idx) => {
                            const h = log.heightCm || selectedClient.heightCm;
                            const bmi = h && log.value ? (log.value / Math.pow(h / 100, 2)).toFixed(1) : "—";
                            return (
                              <tr key={idx} className="hover:bg-(--color-surface-2)/50 transition-colors">
                                <td className="p-3 font-medium text-(--color-text)">{log.date}</td>
                                <td className="p-3 font-extrabold text-(--color-text)">{log.value} kg</td>
                                <td className="p-3 text-(--color-text-muted)">{h ? `${h} cm` : "—"}</td>
                                <td className="p-3 font-bold text-(--color-accent)">{bmi}</td>
                                <td className="p-3 text-right">
                                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-500">
                                    <CheckCircle2 size={12} /> Logged
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: Workout Completion */}
            {activeTab === "workout" && (
              <div className="space-y-4">
                <div className="grid sm:grid-cols-3 gap-3">
                  <div className="p-3.5 rounded-2xl bg-(--color-surface-2) border border-(--color-border) text-center space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-(--color-text-muted)">Completed Sessions</span>
                    <p className="text-2xl font-black text-(--color-text)">{selectedClient.completedWorkoutSessions}</p>
                    <p className="text-[11px] text-(--color-text-muted)">{selectedClient.totalWorkoutSessions} logged sessions ({selectedClient.completedWorkoutSessions} finished)</p>
                  </div>
                  <div className="p-3.5 rounded-2xl bg-(--color-surface-2) border border-(--color-border) text-center space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-(--color-text-muted)">Completion Rate</span>
                    <p className="text-2xl font-black text-emerald-500">{selectedClient.completionRatePercent}%</p>
                    <p className="text-[11px] text-(--color-text-muted)">{selectedClient.totalCompletedExercises} of {selectedClient.totalPlannedExercises || 0} exercises completed</p>
                  </div>
                  <div className="p-3.5 rounded-2xl bg-(--color-surface-2) border border-(--color-border) text-center space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-(--color-text-muted)">Exercises Done</span>
                    <p className="text-2xl font-black text-(--color-accent)">
                      {selectedClient.totalCompletedExercises} / {selectedClient.totalPlannedExercises}
                    </p>
                    <p className="text-[11px] text-(--color-text-muted)">Sets & reps recorded</p>
                  </div>
                </div>

                {/* Weekly Consistency Volume Breakdown */}
                {selectedClient.weeklyVolumeLogs && selectedClient.weeklyVolumeLogs.length > 0 && (
                  <div className="p-4 rounded-2xl bg-(--color-surface-2) border border-(--color-border) space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-(--color-text)">Current Week Activity Distribution</span>
                      <span className="text-[11px] text-(--color-text-muted)">Volume in KG Lifted</span>
                    </div>
                    <div className="grid grid-cols-7 gap-1.5 pt-2">
                      {selectedClient.weeklyVolumeLogs.map((item, idx) => (
                        <div key={idx} className="text-center p-2 rounded-xl bg-(--color-surface) border border-white/5 space-y-1">
                          <span className="text-[10px] font-bold text-(--color-text-muted) uppercase block">{item.day}</span>
                          <span className={`text-xs font-black block ${item.volume > 0 ? "text-emerald-500" : "text-(--color-text-faint)"}`}>
                            {item.volume > 0 ? `${Math.round(item.volume)}` : "—"}
                          </span>
                          <span className="text-[9px] text-(--color-text-faint) truncate block">{item.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Most Skipped Exercises Alert */}
                {selectedClient.mostSkippedExercises && selectedClient.mostSkippedExercises.length > 0 && (
                  <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 space-y-2">
                    <div className="flex items-center gap-2 text-amber-400 font-bold text-xs">
                      <AlertTriangle size={15} />
                      <span>Exercises Skipped Most Often</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {selectedClient.mostSkippedExercises.map((sk, idx) => (
                        <span
                          key={idx}
                          className="px-2.5 py-1 rounded-lg bg-(--color-surface) text-xs font-medium text-(--color-text) border border-(--color-border) flex items-center gap-1.5"
                        >
                          <strong>{sk.name}</strong>
                          <span className="text-rose-400 font-bold">({sk.skipCount}x skipped)</span>
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Recent Workout Logs */}
                <div className="space-y-2">
                  <h4 className="text-xs font-extrabold uppercase tracking-wider text-(--color-text-muted)">
                    Recent Workout Logs ({selectedClient.workoutLogs.length})
                  </h4>
                  {selectedClient.workoutLogs.length === 0 ? (
                    <p className="text-xs text-(--color-text-muted) italic">No workout session logs found.</p>
                  ) : (
                    <div className="space-y-2">
                      {selectedClient.workoutLogs.map((log, idx) => (
                        <div
                          key={idx}
                          className="p-3 rounded-xl bg-(--color-surface-2) border border-(--color-border) flex items-center justify-between text-xs"
                        >
                          <div className="flex items-center gap-2.5">
                            <Calendar size={14} className="text-(--color-accent)" />
                            <div>
                              <p className="font-bold text-(--color-text)">{log.title}</p>
                              <p className="text-[11px] text-(--color-text-muted)">{log.date}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <span className="font-semibold text-emerald-500">Completed</span>
                            <p className="text-[10px] text-(--color-text-muted)">{log.durationMinutes ? `${log.durationMinutes} mins duration` : "Untracked duration"}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB 3: Strength & PR Growth */}
            {activeTab === "strength" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-extrabold uppercase tracking-wider text-(--color-text-muted)">
                    Personal Records & Max Lift Progression
                  </h4>
                  <span className="text-xs text-(--color-text-muted)">{selectedClient.exerciseStats.length} exercises tracked</span>
                </div>

                {selectedClient.exerciseStats.length === 0 ? (
                  <div className="text-center py-8 bg-(--color-surface-2) rounded-2xl border border-dashed border-(--color-border) text-xs text-(--color-text-muted)">
                    <Dumbbell className="w-8 h-8 mx-auto text-(--color-text-faint) mb-2" />
                    <p className="font-semibold text-(--color-text)">No strength or PR records logged yet</p>
                    <p className="text-[11px] text-(--color-text-muted) mt-0.5">
                      As the client logs weights for Bench Press, Squats, and other exercises, their PR growth will appear here.
                    </p>
                  </div>
                ) : (
                  <div className="grid sm:grid-cols-2 gap-3">
                    {selectedClient.exerciseStats.map((ex, idx) => {
                      const init = ex.initialWeightKg || ex.maxWeightKg;
                      const growthKg = Number((ex.maxWeightKg - init).toFixed(1));
                      const growthPercent = init > 0 ? Math.round((growthKg / init) * 100) : 0;

                      return (
                        <div
                          key={idx}
                          className="p-3.5 rounded-2xl bg-(--color-surface-2) border border-(--color-border) space-y-2.5 flex flex-col justify-between"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="font-bold text-sm text-(--color-text)">{ex.name}</p>
                              <p className="text-[11px] text-(--color-text-muted)">
                                Volume Lifted: {ex.volume ? `${ex.volume.toLocaleString()} kg` : "—"}
                              </p>
                            </div>
                            <div className="text-right">
                              <span className="text-[10px] uppercase font-bold text-(--color-text-muted) block">Max PR</span>
                              <span className="text-base font-black text-(--color-accent) flex items-center gap-1 justify-end">
                                <Flame size={14} className="text-amber-500" /> {ex.maxWeightKg} kg
                              </span>
                            </div>
                          </div>

                          <div className="pt-2 border-t border-(--color-border)/50 flex items-center justify-between text-xs">
                            <span className="text-[11px] text-(--color-text-muted)">Initial Lift: {init} kg</span>
                            <span className={`text-[11px] font-bold ${growthKg >= 0 ? "text-emerald-500" : "text-rose-500"}`}>
                              {growthKg >= 0 ? `+${growthKg} kg (+${growthPercent}%)` : `${growthKg} kg`}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* Log Weight & Body Metrics Modal */}
      {showLogModal && selectedClient && (
        <Modal
          onClose={() => setShowLogModal(false)}
          title={`Log Weight & Metrics — ${selectedClient.name}`}
          maxWidth="md"
        >
          <form onSubmit={handleSaveWeightLog} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-semibold text-(--color-text-muted) block mb-1">Current Weight (kg)</label>
                <input
                  type="number"
                  step="0.1"
                  required
                  value={logWeightVal}
                  onChange={(e) => setLogWeightVal(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-(--color-surface-2) border border-(--color-border) text-sm font-bold text-(--color-text) outline-none focus:border-(--color-accent)"
                  placeholder="70.0"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-(--color-text-muted) block mb-1">Height (cm)</label>
                <input
                  type="number"
                  step="1"
                  value={logHeightVal}
                  onChange={(e) => setLogHeightVal(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-(--color-surface-2) border border-(--color-border) text-sm font-bold text-(--color-text) outline-none focus:border-(--color-accent)"
                  placeholder="175"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-(--color-text-muted) block mb-1">Target Goal (kg)</label>
                <input
                  type="number"
                  step="0.1"
                  value={logTargetVal}
                  onChange={(e) => setLogTargetVal(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-(--color-surface-2) border border-(--color-border) text-sm font-bold text-(--color-text) outline-none focus:border-(--color-accent)"
                  placeholder="68.0"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowLogModal(false)}
                className="px-4 py-2 rounded-full text-xs font-semibold text-(--color-text-muted) hover:bg-(--color-surface-2) cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={savingLog}
                className="px-5 py-2 rounded-full text-xs font-bold bg-(--color-accent) text-(--color-navbar) shadow-md flex items-center gap-1 cursor-pointer"
              >
                {savingLog ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus size={14} />} Save Weigh-In
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
