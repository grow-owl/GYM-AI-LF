import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { Sparkles, ArrowRight, TrendingUp, Clock, Award, AlertTriangle, Loader2, Calendar, RefreshCw } from "lucide-react";
import KpiCard from "@/components/ui/KpiCard";
import QuickAccessCard from "@/components/ui/QuickAccessCard";
import Card from "@/components/ui/Card";
import Heatmap, { type HeatmapCell } from "@/components/ui/Heatmap";
import MarkdownRenderer from "@/components/common/MarkdownRenderer";
import { ownerQuickAccess } from "@/data/nav";
import { useGymBranch } from "@/hooks/useGymBranch";
import { reportApi, memberApi, aiApi, attendanceApi, type DashboardOverview } from "@/lib/endpoints";
import { useAuthStore } from "@/store/authStore";
import { toast } from "sonner";

const kpiTones = ["blue", "orange", "purple", "amber"] as const;

const miniStatClasses: Record<string, { bg: string; text: string }> = {
  green: { bg: "bg-(--tone-green)", text: "text-white" },
  blue: { bg: "bg-(--tone-blue)", text: "text-white" },
  amber: { bg: "bg-(--tone-amber)", text: "text-white" },
  pink: { bg: "bg-(--tone-pink)", text: "text-white" },
};

function formatPeakHour(peakData: any): { value: string; note: string } {
  const list = Array.isArray(peakData) ? peakData : peakData?.peakHours || [];
  if (!list.length) return { value: "--", note: "no check-ins yet" };
  const sorted = [...list].sort((a, b) => (b.checkInCount || 0) - (a.checkInCount || 0));
  const top = sorted[0];
  if (!top || !top.checkInCount) return { value: "--", note: "no check-ins yet" };
  const h = Number(top.hour);
  const period = h >= 12 ? "PM" : "AM";
  const displayH = h % 12 === 0 ? 12 : h % 12;
  const nextH = (h + 1) % 12 === 0 ? 12 : (h + 1) % 12;
  return { value: `${displayH}–${nextH} ${period}`, note: `${top.checkInCount} check-ins` };
}

function getTopTrainer(perfData: any): { value: string; note: string } {
  const list = Array.isArray(perfData) ? perfData : perfData?.trainerComparison || perfData?.trainerPerformance || [];
  if (!list.length || !list[0]?.trainerName) {
    return { value: "--", note: "no ratings yet" };
  }
  const top = list[0];
  return {
    value: top.trainerName,
    note: top.score ? `${top.score}% score` : `${top.assignedMembersCount || 0} clients`,
  };
}

function formatRevForecast(revData: any, currentRev: number): { value: string; note: string } {
  const forecast = revData?.revenueForecast || revData;
  const projected = forecast?.projectedRevenue;
  if (typeof projected === "number" && projected > 0) {
    return {
      value: `₹${Math.round(projected).toLocaleString("en-IN")}`,
      note: forecast.confidence ? `${forecast.confidence} confidence` : "AI forecast",
    };
  }
  if (currentRev > 0) {
    return {
      value: `₹${Math.round(currentRev * 1.05).toLocaleString("en-IN")}`,
      note: "next month est.",
    };
  }
  return { value: "₹0", note: "next month" };
}

function getChurnRisk(riskData: any): { value: string; note: string } {
  const list = Array.isArray(riskData) ? riskData : riskData?.atRiskMembers || [];
  const count = list.length;
  return {
    value: `${count} member${count === 1 ? "" : "s"}`,
    note: count > 0 ? "act this week" : "all healthy",
  };
}

export default function OwnerDashboard() {
  const user = useAuthStore((s) => s.user);
  const isBranchManager = user?.role === "BRANCH_MANAGER";
  const { gymId, branchId, loading: resolvingBranch, error: branchError } = useGymBranch();
  const [overview, setOverview] = useState<DashboardOverview | null>(null);
  const [memberList, setMemberList] = useState<any[]>([]);
  const [expiringList, setExpiringList] = useState<any[]>([]);
  const [weeklyDigest, setWeeklyDigest] = useState<string | null>(null);
  const [loadingOverview, setLoadingOverview] = useState(true);
  const [digestLoading, setDigestLoading] = useState(true);
  const [heatmapWeeks, setHeatmapWeeks] = useState<HeatmapCell[][]>([]);
  const [avgActive30d, setAvgActive30d] = useState(0);

  // Dynamic AI Mini Stats states
  const [revenueForecast, setRevenueForecast] = useState<any>(null);
  const [peakHours, setPeakHours] = useState<any>(null);
  const [trainerPerf, setTrainerPerf] = useState<any>(null);
  const [atRiskData, setAtRiskData] = useState<any>(null);

  const [overviewError, setOverviewError] = useState<string | null>(null);

  const sanitizeCurrency = (text: string) =>
    text.replace(/\$\s*(\d[\d,.]*)/g, "₹$1").replace(/\bUSD\s*(\d[\d,.]*)/gi, "₹$1");

  const fetchWeeklyDigest = async (forceRefresh: boolean = false) => {
    if (!gymId) return;

    // Check client storage cache when not forcing refresh
    if (!forceRefresh) {
      try {
        const cached =
          sessionStorage.getItem(`gymai.weekly_digest.${gymId}`) ||
          localStorage.getItem(`gymai.weekly_digest.${gymId}`);
        if (cached) {
          const sanitized = sanitizeCurrency(cached);
          setWeeklyDigest(sanitized);
          if (sanitized !== cached) {
            sessionStorage.setItem(`gymai.weekly_digest.${gymId}`, sanitized);
            localStorage.setItem(`gymai.weekly_digest.${gymId}`, sanitized);
          }
          setDigestLoading(false);
          return;
        }
      } catch {}
    }

    setDigestLoading(true);
    try {
      const res = await aiApi.getWeeklyDigest(gymId, forceRefresh);
      const rawDigest =
        res?.weeklyDigest ||
        "No AI weekly digest available yet. Add members and check-ins to generate insights.";
      const digestText = sanitizeCurrency(rawDigest);
      setWeeklyDigest(digestText);
      try {
        sessionStorage.setItem(`gymai.weekly_digest.${gymId}`, digestText);
        localStorage.setItem(`gymai.weekly_digest.${gymId}`, digestText);
      } catch {}
      if (forceRefresh) {
        toast.success("AI Gym Co-Pilot digest updated successfully!");
      }
    } catch (err) {
      console.error("Failed to fetch weekly digest:", err);
      if (forceRefresh) {
        toast.error("Failed to refresh AI digest. Keeping current summary.");
      } else if (!weeklyDigest) {
        setWeeklyDigest("AI executive digest currently offline. Check back shortly.");
      }
    } finally {
      setDigestLoading(false);
    }
  };

  useEffect(() => {
    if (branchError) {
      toast.error(`Branch error: ${branchError}`);
    }
    if (!gymId) return;

    setLoadingOverview(true);
    setOverviewError(null);

    // Fetch weekly digest with client & server caching (bypasses LLM on page navigation)
    fetchWeeklyDigest(false);

    Promise.all([
      reportApi.getOverview(gymId, branchId ?? undefined).catch((err) => {
        console.error("Overview error:", err);
        setOverviewError("Failed to sync overview metrics from server.");
        toast.error("Failed to load gym overview metrics.");
        return null;
      }),
      branchId ? memberApi.list(gymId, branchId).catch(() => []) : Promise.resolve([]),
      reportApi.getExpiringMemberships(gymId).catch(() => []),
      attendanceApi.getHeatmap(gymId, branchId ?? undefined).catch(() => null),
      aiApi.getRevenueForecast(gymId).catch(() => null),
      aiApi.getPeakHours(gymId).catch(() => null),
      aiApi.getTrainerPerformance(gymId).catch(() => null),
      aiApi.getAtRiskMembers(gymId).catch(() => null),
    ])
      .then(([ovRes, memRes, expRes, heatRes, revRes, peakRes, perfRes, riskRes]) => {
        const zeroOverview: DashboardOverview = {
          totalActiveMembers: 0,
          totalTrainers: 0,
          todayCheckIns: 0,
          revenueThisMonth: 0,
          membershipsExpiringIn7Days: 0,
          avgAttendanceRate30d: 0,
        };
        setOverview(ovRes || zeroOverview);

        const mList = Array.isArray(memRes) ? memRes : memRes?.members || [];
        setMemberList(mList);

        const expList = Array.isArray(expRes) ? expRes : (expRes as any)?.expiringMemberships || [];
        setExpiringList(expList);

        if (heatRes?.weeks) {
          setHeatmapWeeks(heatRes.weeks);
          setAvgActive30d(heatRes.avgAttendanceRate30d || 0);
        } else {
          setHeatmapWeeks([]);
          setAvgActive30d(0);
        }

        setRevenueForecast(revRes);
        setPeakHours(peakRes);
        setTrainerPerf(perfRes);
        setAtRiskData(riskRes);
      })
      .finally(() => {
        setLoadingOverview(false);
      });
  }, [gymId, branchId]);

  const totalMembersCount = overview?.totalActiveMembers ?? memberList.length;

  const kpis = overview
    ? [
        { label: "Members", value: String(totalMembersCount), icon: "Users" },
        { label: "Revenue (this month)", value: `₹${(overview.revenueThisMonth || 0).toLocaleString("en-IN")}`, icon: "IndianRupee" },
        { label: "Trainers", value: String(overview.totalTrainers), icon: "Dumbbell" },
        { label: "Expiring in 7d", value: String(expiringList.length || overview.membershipsExpiringIn7Days || 0), icon: "AlertTriangle" },
      ]
    : [];

  const revForecastItem = formatRevForecast(revenueForecast, overview?.revenueThisMonth || 0);
  const peakHourItem = formatPeakHour(peakHours);
  const topTrainerItem = getTopTrainer(trainerPerf);
  const churnRiskItem = getChurnRisk(atRiskData);

  const miniStats = [
    { label: "Revenue Forecast", value: revForecastItem.value, note: revForecastItem.note, icon: TrendingUp, tone: "green" as const },
    { label: "Peak Hours", value: peakHourItem.value, note: peakHourItem.note, icon: Clock, tone: "blue" as const },
    { label: "Top Trainer", value: topTrainerItem.value, note: topTrainerItem.note, icon: Award, tone: "amber" as const },
    { label: "Churn Risk", value: churnRiskItem.value, note: churnRiskItem.note, icon: AlertTriangle, tone: "pink" as const },
  ];

  return (
    <div className="space-y-6">
      {overviewError && (
        <div className="flex items-center justify-between p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-400">
          <span>⚠️ {overviewError}</span>
          <button onClick={() => window.location.reload()} className="underline font-bold cursor-pointer hover:text-red-300">
            Retry Sync
          </button>
        </div>
      )}

      {resolvingBranch || loadingOverview ? (
        <div className="flex items-center justify-center p-12 text-sm text-(--color-text-muted) gap-2">
          <Loader2 className="w-5 h-5 animate-spin text-(--color-accent)" /> Loading dashboard metrics...
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {kpis.map((k, i) => (
            <KpiCard key={k.label} {...k} tone={kpiTones[i % kpiTones.length]} />
          ))}
        </div>
      )}

      {/* AI Assistant Banner */}
      <Card sweep className="relative overflow-hidden border-(--color-accent)/25 bg-gradient-to-br from-(--color-accent)/10 via-(--color-accent)/5 to-transparent p-4 sm:p-5 shadow-xs">
        {/* Decorative ambient glow */}
        <div className="pointer-events-none absolute -top-12 -right-12 h-36 w-36 rounded-full bg-(--color-accent)/10 blur-2xl" />

        <div className="flex flex-col gap-3 sm:gap-3.5 relative">
          {/* Header Row: Branding on Left, Refresh & Action Button on Right */}
          <div className="flex items-center justify-between gap-3 pb-3 border-b border-(--color-accent)/15">
            <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
              <span className="flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-xl bg-(--color-accent) text-(--color-navbar) shadow-md">
                <Sparkles size={18} className="sm:w-5 sm:h-5" strokeWidth={2.2} />
              </span>
              <div className="min-w-0">
                <span className="text-xs sm:text-sm font-bold uppercase tracking-wider text-(--color-accent-text)">
                  AI Gym Co-Pilot
                </span>
                <p className="text-[11px] text-(--color-text-muted) hidden sm:block">
                  Weekly Executive Business Digest
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => fetchWeeklyDigest(true)}
                disabled={digestLoading}
                className="flex items-center justify-center h-8 w-8 sm:h-9 sm:w-9 rounded-xl bg-(--color-surface) text-(--color-text-muted) hover:text-(--color-accent-text) border border-(--color-border) hover:border-(--color-accent) active:scale-95 transition-all cursor-pointer disabled:opacity-50 shadow-2xs"
                title="Refresh AI Digest with latest live data"
                aria-label="Refresh AI Digest"
              >
                <RefreshCw size={16} className={digestLoading ? "animate-spin text-(--color-accent)" : ""} />
              </button>

              <Link
                to="/owner/ai-insights"
                className="hidden sm:inline-flex items-center gap-2 rounded-full bg-(--color-accent) text-(--color-navbar) text-sm font-bold px-5 py-2 hover:opacity-90 active:scale-95 transition-all shadow-md shrink-0"
              >
                <span>AI Insights</span>
                <ArrowRight size={16} />
              </Link>
            </div>
          </div>

          {/* Digest Body: Spans full width across mobile, tablet, and desktop */}
          <div className="pt-0.5">
            {digestLoading ? (
              <p className="text-xs sm:text-sm text-(--color-text-muted) flex items-center gap-2 py-1">
                <Loader2 size={15} className="animate-spin text-(--color-accent)" />
                Synthesizing executive business digest...
              </p>
            ) : (
              <div className="text-xs sm:text-sm font-normal text-(--color-text)/90 leading-relaxed">
                <MarkdownRenderer content={weeklyDigest} className="leading-relaxed" />
              </div>
            )}
          </div>

          {/* Mobile Full-Width Button */}
          <div className="pt-2 sm:hidden">
            <Link
              to="/owner/ai-insights"
              className="flex w-full items-center justify-center gap-2.5 rounded-xl bg-(--color-accent) text-(--color-navbar) text-sm font-bold py-3.5 px-5 hover:opacity-90 active:scale-98 transition-all shadow-md text-center"
            >
              <span>AI Insights</span>
              <ArrowRight size={18} />
            </Link>
          </div>
        </div>
      </Card>

      {/* Quick Access */}
      <div>
        <p className="text-xs font-medium tracking-wide text-(--color-text-faint) uppercase mb-3">Quick access</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {(isBranchManager
            ? ownerQuickAccess.filter(
                (item) => item.path !== "/owner/expenses" && item.path !== "/owner/reports"
              )
            : ownerQuickAccess
          ).map((item) => (
            <QuickAccessCard key={item.path} {...item} />
          ))}
        </div>
      </div>

      {/* Activity & Performance Highlights */}
      <div className="grid lg:grid-cols-2 xl:grid-cols-12 gap-4 sm:gap-6 min-w-0 items-stretch">
        <Card className="lg:col-span-1 xl:col-span-7 flex flex-col justify-between min-w-0 overflow-hidden p-3.5 sm:p-5">
          <div>
            <div className="flex items-start sm:items-center justify-between gap-2 mb-2 sm:mb-3">
              <p className="text-[11px] sm:text-xs font-semibold tracking-wide text-(--color-text-faint) uppercase flex items-center gap-1.5">
                <Calendar size={14} className="text-(--color-accent)" />
                Check-in frequency (14 Weeks)
              </p>
              <span className="font-mono text-[10px] sm:text-xs text-(--color-text-muted) whitespace-nowrap shrink-0">
                Avg {avgActive30d || overview?.avgAttendanceRate30d || 0}% active
              </span>
            </div>
            <Heatmap weeks={heatmapWeeks} />
          </div>
        </Card>

        {/* AI Operational Highlights */}
        <div className="lg:col-span-1 xl:col-span-5 grid grid-cols-2 gap-2.5 sm:gap-3 lg:gap-3.5 lg:h-full">
          {miniStats.map(({ label, value, note, icon: Icon, tone }) => {
            const { bg, text } = miniStatClasses[tone];
            return (
              <Card
                key={label}
                className="p-3.5 sm:p-4 lg:p-4.5 flex flex-col justify-between gap-2.5 sm:gap-3 min-w-0 hover:border-(--color-accent)/30 transition-colors"
              >
                <div className="flex items-center justify-between w-full">
                  <span
                    className={`flex h-8 w-8 sm:h-9 sm:w-9 lg:h-10 lg:w-10 shrink-0 items-center justify-center rounded-xl ${bg} ${text} shadow-2xs`}
                  >
                    <Icon size={16} className="sm:w-[18px] sm:h-[18px] lg:w-5 lg:h-5" strokeWidth={2} />
                  </span>
                </div>
                <div className="min-w-0 w-full mt-1 sm:mt-2">
                  <p
                    className="font-display text-sm sm:text-base font-bold text-(--color-text) truncate"
                    title={value}
                  >
                    {value}
                  </p>
                  <p className="text-[10px] sm:text-[11px] font-medium text-(--color-text-muted) truncate mt-0.5">
                    {label}
                  </p>
                  {note && (
                    <p className="text-[9px] sm:text-[10px] text-(--color-text-faint) truncate mt-0.5">
                      {note}
                    </p>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
