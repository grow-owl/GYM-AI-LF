import { useState, useEffect, useMemo } from "react";
import {
  FileDown,
  Eye,
  X,
  FileJson,
  FileSpreadsheet,
  Loader2,
  RefreshCw,
  BarChart2,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  IndianRupee,
  Activity,
  AlertTriangle,
  Award,
  Building2,
} from "lucide-react";
import { Link } from "react-router-dom";
import clsx from "clsx";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import BarChart, { type BarDatum } from "@/components/ui/BarChart";
import DonutChart, { type DonutSegment } from "@/components/ui/DonutChart";
import { reportApi, attendanceApi, trainerApi, aiApi, paymentApi, type DashboardOverview } from "@/lib/endpoints";
import { useAuthStore } from "@/store/authStore";
import { useGymBranch } from "@/hooks/useGymBranch";
import { formatApiError, showApiErrorToast } from "@/lib/api";
import { toast } from "sonner";

interface ReportRow {
  [key: string]: string | number;
}

interface ReportDef {
  key: string;
  name: string;
  desc: string;
  period: string;
  columns: string[];
  rows: () => ReportRow[];
}

function toCsv(columns: string[], rows: ReportRow[]) {
  const header = columns.join(",");
  const body = rows
    .map((r) => columns.map((c) => `"${String(r[c] ?? "").replace(/"/g, '""')}"`).join(","))
    .join("\n");
  return `${header}\n${body}`;
}

function download(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function reportDataToCsv(reportType: string, data: any): string {
  if (!data) return "";
  
  const typeKey = String(reportType || "").toLowerCase();
  
  if (typeKey.includes("attendance")) {
    const headers = ["Period Start", "Period End", "Total Visits", "Total Minutes", "Avg Duration Minutes"];
    const overviewRow = [
      data.period?.start || "",
      data.period?.end || "",
      data.totalVisits ?? 0,
      data.totalMinutes ?? 0,
      data.avgDurationMinutes ?? 0
    ];
    
    let csv = headers.join(",") + "\n" + overviewRow.join(",") + "\n\n";
    
    if (data.perMember && data.perMember.length > 0) {
      csv += "Member ID,Member Name,Membership Status,Visit Count,Total Minutes\n";
      data.perMember.forEach((m: any) => {
        csv += `"${m.memberId || ""}","${m.memberName || ""}","${m.membershipStatus || ""}",${m.visitCount ?? 0},${m.totalMinutes ?? 0}\n`;
      });
    }
    return csv;
  }
  
  if (typeKey.includes("revenue") || typeKey.includes("collection")) {
    const rd = data.revenueData || {};
    const headers = ["Period Start", "Period End", "Total Revenue", "Payments Count", "Avg Payment Value"];
    const overviewRow = [
      data.period?.start || "",
      data.period?.end || "",
      rd.totalRevenue ?? 0,
      rd.paymentsCount ?? 0,
      rd.averagePaymentValue ?? 0
    ];
    
    let csv = headers.join(",") + "\n" + overviewRow.join(",") + "\n\n";
    
    if (rd.breakdownByPlan && rd.breakdownByPlan.length > 0) {
      csv += "Plan Name,Payments Count,Revenue Collected\n";
      rd.breakdownByPlan.forEach((b: any) => {
        csv += `"${b.planName || ""}","${b.count ?? 0}",${b.revenue ?? 0}\n`;
      });
    }
    return csv;
  }
  
  if (typeKey.includes("churn") || typeKey.includes("risk") || typeKey.includes("ai")) {
    let csv = "Period Start,Period End,Total AI Reports\n";
    csv += `${data.period?.start || ""},${data.period?.end || ""},${data.totalAIReports ?? 0}\n\n`;
    
    if (data.reportsSummary && data.reportsSummary.length > 0) {
      csv += "Report ID,Member ID,Type,Summary,Plateau Detected,Injury Risk\n";
      data.reportsSummary.forEach((r: any) => {
        csv += `"${r.reportId || ""}","${r.memberId || ""}","${r.type || ""}","${(r.summary || "").replace(/"/g, '""')}",${r.plateauDetected ?? false},${r.injuryRiskFlag ?? false}\n`;
      });
    }
    return csv;
  }
  
  if (typeKey.includes("trainer") || typeKey.includes("performance")) {
    let csv = "Period Start,Period End,Total Feedback Entries\n";
    csv += `${data.period?.start || ""},${data.period?.end || ""},${data.totalFeedbackEntries ?? 0}\n\n`;
    
    if (data.feedbacks && data.feedbacks.length > 0) {
      csv += "Feedback ID,Trainer Name,Member Name,Rating,Comment,Created At\n";
      data.feedbacks.forEach((f: any) => {
        const trainerName = f.trainerId?.userId?.fullName || "";
        const memberName = f.memberId?.userId?.fullName || "";
        csv += `"${f._id || ""}","${trainerName}","${memberName}",${f.rating ?? 0},"${(f.comment || "").replace(/"/g, '""')}","${f.createdAt || ""}"\n`;
      });
    }
    return csv;
  }

  if (typeKey.includes("workout")) {
    let csv = "Period Start,Period End,Total Completed Workouts\n";
    csv += `${data.period?.start || ""},${data.period?.end || ""},${data.totalCompletedWorkouts ?? 0}\n\n`;
    
    if (data.memberBreakdown && data.memberBreakdown.length > 0) {
      csv += "Member ID,Total Completed Workouts,Total Exercises Completed,Total Duration Minutes\n";
      data.memberBreakdown.forEach((mb: any) => {
        csv += `"${mb.memberId || ""}",${mb.totalCompletedWorkouts ?? 0},${mb.totalExercisesCompleted ?? 0},${mb.totalDurationMinutes ?? 0}\n`;
      });
    }
    return csv;
  }
  
  return JSON.stringify(data, null, 2);
}

export default function Reports() {
  const user = useAuthStore((s) => s.user);
  const { gymId, branchId } = useGymBranch();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [overview, setOverview] = useState<DashboardOverview | null>(null);
  const [generatedReports, setGeneratedReports] = useState<any[]>([]);
  const [trainersList, setTrainersList] = useState<any[]>([]);
  const [heatmapData, setHeatmapData] = useState<any>(null);
  const [atRiskList, setAtRiskList] = useState<any[]>([]);
  const [paymentsList, setPaymentsList] = useState<any[]>([]);
  const [active, setActive] = useState<ReportDef | null>(null);
  const [viewingReport, setViewingReport] = useState<any | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [reportTab, setReportTab] = useState<"overview" | "attendance" | "revenue" | "churn" | "trainer">("overview");
  const [modalViewTab, setModalViewTab] = useState<"graph" | "data">("graph");

  const handleDownloadReportData = (r: any) => {
    if (r.format === "pdf" && r.fileUrl) {
      window.open(r.fileUrl, "_blank");
      return;
    }
    const csvContent = reportDataToCsv(r.reportType, r.reportData);
    const filename = `${(r.reportType || "export").toLowerCase()}_${r._id || Date.now()}.csv`;
    download(filename, csvContent, "text/csv");
  };

  const handleViewReportData = async (r: any) => {
    setViewingReport(r);
    setModalViewTab("graph");
    const activeGymId = gymId || user?.gymId || "";
    const reportId = r._id || r.id;
    if (activeGymId && reportId) {
      try {
        const detailRes = await reportApi.getReportById(activeGymId, reportId);
        if (detailRes?.reportRequest) {
          setViewingReport(detailRes.reportRequest);
        }
      } catch (err) {
        console.warn("Failed to fetch report detail:", err);
      }
    }
  };

  const fetchData = async () => {
    const activeGymId = gymId || user?.gymId || "";
    const activeBranchId = branchId || user?.branchId || "";
    setLoading(true);
    setError(null);
    try {
      const [ovRes, repRes, trainRes, heatRes, riskRes, payRes] = await Promise.all([
        reportApi.getOverview(activeGymId, activeBranchId),
        reportApi.listReports(activeGymId),
        activeGymId ? trainerApi.list(activeGymId, activeBranchId || undefined).catch(() => null) : null,
        activeGymId ? attendanceApi.getHeatmap(activeGymId, activeBranchId || undefined).catch(() => null) : null,
        activeGymId ? aiApi.getAtRiskMembers(activeGymId).catch(() => null) : null,
        activeGymId ? paymentApi.listMemberPayments(activeGymId).catch(() => null) : null,
      ]);

      const zeroOverview: DashboardOverview = {
        totalActiveMembers: 0,
        totalTrainers: 0,
        todayCheckIns: 0,
        revenueThisMonth: 0,
        membershipsExpiringIn7Days: 0,
        avgAttendanceRate30d: 0,
      };
      setOverview(ovRes || zeroOverview);

      if (repRes?.reports) {
        setGeneratedReports(repRes.reports);
        setCurrentPage(1);
      }
      if (trainRes) {
        const tList = Array.isArray(trainRes) ? trainRes : trainRes.trainers || [];
        setTrainersList(tList);
      }
      if (heatRes) setHeatmapData(heatRes);
      if (riskRes) {
        const rList = Array.isArray(riskRes) ? riskRes : riskRes.atRiskMembers || [];
        setAtRiskList(rList);
      }
      if (payRes) {
        const pList = Array.isArray(payRes) ? payRes : payRes.payments || [];
        setPaymentsList(pList);
      }
    } catch (err: any) {
      const msg = formatApiError(err, "Failed to load reports data.");
      setError(msg);
      showApiErrorToast(err, "Failed to load reports data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [gymId, branchId, user]);

  const reportDefinitions: ReportDef[] = [
    {
      key: "overview",
      name: "Dashboard Overview Report",
      desc: "Active members, trainers, attendance & revenue summary",
      period: "Current Month",
      columns: ["Metric", "Value"],
      rows: () => [
        { Metric: "Total Active Members", Value: overview?.totalActiveMembers ?? 0 },
        { Metric: "Total Trainers", Value: overview?.totalTrainers ?? 0 },
        { Metric: "Today Check-Ins", Value: overview?.todayCheckIns ?? 0 },
        { Metric: "Revenue This Month (₹)", Value: overview?.revenueThisMonth ?? 0 },
        { Metric: "Memberships Expiring in 7 Days", Value: overview?.membershipsExpiringIn7Days ?? 0 },
        { Metric: "30-Day Attendance Rate (%)", Value: `${overview?.avgAttendanceRate30d ?? 0}%` },
      ],
    },
    {
      key: "generated",
      name: "Generated Custom Reports",
      desc: "History of requested custom reporting export files",
      period: "All Time",
      columns: ["Report Type", "Scope", "Format", "Created Date"],
      rows: () =>
        generatedReports.map((r) => ({
          "Report Type": r.reportType || "General",
          Scope: r.scope || "Branch",
          Format: (r.format || "CSV").toUpperCase(),
          "Created Date": r.createdAt ? new Date(r.createdAt).toLocaleDateString() : "Recent",
        })),
    },
  ];

  const handleRequestReport = async (type: string) => {
    const activeGymId = user?.gymId || "";
    try {
      const now = new Date();
      const past30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      await reportApi.requestReport(activeGymId, {
        reportType: type,
        scope: "GYM_WIDE",
        periodStart: past30.toISOString(),
        periodEnd: now.toISOString(),
        format: "csv",
      });
      toast.success(`Report for ${type.replace(/_/g, " ")} requested successfully! Backend processing.`);
      fetchData();
    } catch (err) {
      showApiErrorToast(err, `Failed to request ${type.replace(/_/g, " ")} report`);
    }
  };

  const itemsPerPage = 5;
  const totalPages = Math.ceil(generatedReports.length / itemsPerPage) || 1;
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedReports = generatedReports.slice(startIndex, startIndex + itemsPerPage);

  const overviewBarData: BarDatum[] = useMemo(
    () => [
      { label: "Active Members", value: overview?.totalActiveMembers ?? 0, color: "var(--color-accent)" },
      { label: "Check-Ins Today", value: overview?.todayCheckIns ?? 0, color: "#10b981" },
      { label: "Trainers", value: overview?.totalTrainers ?? 0, color: "#6366f1" },
      { label: "Expiring (7d)", value: overview?.membershipsExpiringIn7Days ?? 0, color: "#f59e0b" },
      { label: "Attendance %", value: overview?.avgAttendanceRate30d ?? 0, color: "#3b82f6", formattedValue: `${overview?.avgAttendanceRate30d ?? 0}%` },
    ],
    [overview]
  );

  const overviewDonutData: DonutSegment[] = useMemo(() => {
    const total = overview?.totalActiveMembers ?? 0;
    const expiring = overview?.membershipsExpiringIn7Days ?? 0;
    const healthy = Math.max(0, total - expiring);
    const atRisk = atRiskList.length;

    if (total === 0 && atRisk === 0) {
      return [{ label: "No Active Members", value: 1, color: "var(--color-surface-3)" }];
    }

    return [
      { label: "Active & Healthy", value: healthy, color: "#10b981" },
      { label: "Expiring in 7 Days", value: expiring, color: "#f59e0b" },
      { label: "At Risk / Inactive", value: atRisk, color: "#ef4444" },
    ];
  }, [overview, atRiskList]);

  const attendanceBarData: BarDatum[] = useMemo(() => {
    const weeks = heatmapData?.weeks;
    if (Array.isArray(weeks) && weeks.length > 0) {
      const latestWeek = weeks[weeks.length - 1];
      if (Array.isArray(latestWeek) && latestWeek.length > 0) {
        return latestWeek.map((cell: any) => {
          const val = Number(cell.value ?? cell.checkInCount ?? cell.count ?? 0);
          const dateStr = cell.date ?? cell.dayKey;
          const dayLabel = cell.label || (dateStr ? new Date(dateStr).toLocaleDateString("en-US", { weekday: "short" }) : "Day");
          return {
            label: dayLabel,
            value: val,
            color: "var(--color-accent)",
          };
        });
      }
    }
    const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    const todayIndex = (new Date().getDay() + 6) % 7;
    return days.map((d, i) => ({
      label: d,
      value: i === todayIndex ? (overview?.todayCheckIns ?? 0) : 0,
      color: i === todayIndex ? "var(--color-accent)" : "var(--color-surface-3)",
    }));
  }, [heatmapData, overview]);

  const revenueBarData: BarDatum[] = useMemo(() => {
    const totalRev = overview?.revenueThisMonth ?? 0;
    if (totalRev === 0 && paymentsList.length === 0) {
      return [
        { label: "Week 1", value: 0, color: "var(--color-surface-3)", formattedValue: "₹0" },
        { label: "Week 2", value: 0, color: "var(--color-surface-3)", formattedValue: "₹0" },
        { label: "Week 3", value: 0, color: "var(--color-surface-3)", formattedValue: "₹0" },
        { label: "Week 4", value: 0, color: "var(--color-surface-3)", formattedValue: "₹0" },
      ];
    }

    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const thisMonthPayments = paymentsList.filter((p: any) => {
      if (p.status && p.status !== "success" && p.status !== "SUCCESS") return false;
      const d = new Date(p.paidAt || p.createdAt);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    });

    let w1 = 0, w2 = 0, w3 = 0, w4 = 0;
    thisMonthPayments.forEach((p: any) => {
      const day = new Date(p.paidAt || p.createdAt).getDate();
      const amt = Number(p.amount) || 0;
      if (day <= 7) w1 += amt;
      else if (day <= 14) w2 += amt;
      else if (day <= 21) w3 += amt;
      else w4 += amt;
    });

    return [
      { label: "Week 1", value: Math.round(w1), color: "#10b981", formattedValue: `₹${Math.round(w1).toLocaleString("en-IN")}` },
      { label: "Week 2", value: Math.round(w2), color: "#10b981", formattedValue: `₹${Math.round(w2).toLocaleString("en-IN")}` },
      { label: "Week 3", value: Math.round(w3), color: "#10b981", formattedValue: `₹${Math.round(w3).toLocaleString("en-IN")}` },
      { label: "Week 4", value: Math.round(w4), color: "var(--color-accent)", formattedValue: `₹${Math.round(w4).toLocaleString("en-IN")}` },
    ];
  }, [overview, paymentsList]);

  const churnBarData: BarDatum[] = useMemo(() => {
    const total = overview?.totalActiveMembers ?? 0;
    const atRisk = atRiskList.length;
    const healthy = Math.max(0, total - atRisk);
    return [
      { label: "Healthy (Regular)", value: healthy, color: "#10b981" },
      { label: "At Risk (Low Att.)", value: atRisk, color: "#ef4444" },
    ];
  }, [overview, atRiskList]);

  const trainerBarData: BarDatum[] = useMemo(() => {
    if (trainersList.length === 0) {
      return [{ label: "No Trainers Registered", value: 0, color: "var(--color-surface-3)" }];
    }
    return trainersList.slice(0, 6).map((t: any, idx: number) => ({
      label: (t.userId?.fullName || t.fullName || `Trainer ${idx + 1}`).split(" ")[0],
      value: t.assignedMembersCount || t.clientCount || t.clients?.length || 0,
      color: idx % 2 === 0 ? "var(--color-accent)" : "#10b981",
    }));
  }, [trainersList]);

  const activeBarData: BarDatum[] = useMemo(() => {
    switch (reportTab) {
      case "overview":
        return overviewBarData;
      case "attendance":
        return attendanceBarData;
      case "revenue":
        return revenueBarData;
      case "churn":
        return churnBarData;
      case "trainer":
        return trainerBarData;
      default:
        return overviewBarData;
    }
  }, [reportTab, overviewBarData, attendanceBarData, revenueBarData, churnBarData, trainerBarData]);

  const parsedModalChartData = useMemo(() => {
    if (!viewingReport || !viewingReport.reportData) return null;
    const data = viewingReport.reportData;
    const typeKey = String(viewingReport.reportType || "").toLowerCase();

    if (typeKey.includes("attendance")) {
      const perMember = data.perMember || [];
      const bar: BarDatum[] = perMember.slice(0, 6).map((m: any, idx: number) => ({
        label: m.memberName ? m.memberName.split(" ")[0] : `M#${idx + 1}`,
        value: m.visitCount ?? 0,
        color: idx % 2 === 0 ? "var(--color-accent)" : "#10b981",
      }));
      const high = perMember.filter((m: any) => (m.visitCount || 0) >= 10).length;
      const reg = perMember.filter((m: any) => (m.visitCount || 0) >= 4 && (m.visitCount || 0) < 10).length;
      const low = perMember.filter((m: any) => (m.visitCount || 0) < 4).length;
      const donut: DonutSegment[] = (high + reg + low === 0)
        ? [{ label: "No Attendance Data", value: 1, color: "var(--color-surface-3)" }]
        : [
            { label: "High Visits (10+)", value: high, color: "#10b981" },
            { label: "Regular Visits (4-9)", value: reg, color: "var(--color-accent)" },
            { label: "Low Visits (1-3)", value: low, color: "#f59e0b" },
          ];
      return { bar, donut, title: "Attendance & Visit Breakdown" };
    }

    if (typeKey.includes("revenue") || typeKey.includes("collection")) {
      const rd = data.revenueData || {};
      const plans = rd.breakdownByPlan || [];
      const bar: BarDatum[] = plans.map((p: any) => ({
        label: p.planName || "Plan",
        value: p.revenue ?? 0,
        color: "#10b981",
      }));
      const donut: DonutSegment[] = plans.length === 0
        ? [{ label: "No Revenue Data", value: 1, color: "var(--color-surface-3)" }]
        : plans.map((p: any, idx: number) => ({
            label: p.planName || "Plan",
            value: p.count ?? 0,
            color: idx === 0 ? "var(--color-accent)" : idx === 1 ? "#10b981" : "#6366f1",
          }));
      return { bar, donut, title: "Revenue & Plan Performance" };
    }

    if (typeKey.includes("churn") || typeKey.includes("risk") || typeKey.includes("ai")) {
      const summary = data.reportsSummary || [];
      const plateauCount = summary.filter((s: any) => s.plateauDetected).length;
      const injuryCount = summary.filter((s: any) => s.injuryRiskFlag).length;
      const normalCount = Math.max(0, summary.length - plateauCount - injuryCount);

      const bar: BarDatum[] = [
        { label: "Plateau Detected", value: plateauCount, color: "#f59e0b" },
        { label: "Injury Risk", value: injuryCount, color: "#ef4444" },
        { label: "Normal Progress", value: normalCount, color: "#10b981" },
      ];
      const donut: DonutSegment[] = (plateauCount + injuryCount + normalCount === 0)
        ? [{ label: "No Churn Data", value: 1, color: "var(--color-surface-3)" }]
        : [
            { label: "Optimal Progress", value: normalCount, color: "#10b981" },
            { label: "Plateau Alert", value: plateauCount, color: "#f59e0b" },
            { label: "Injury Risk Flag", value: injuryCount, color: "#ef4444" },
          ];
      return { bar, donut, title: "Member Churn & AI Risk Flags" };
    }

    if (typeKey.includes("trainer") || typeKey.includes("performance")) {
      const feedbacks = data.feedbacks || [];
      const f5 = feedbacks.filter((f: any) => (f.rating || 0) >= 5).length;
      const f4 = feedbacks.filter((f: any) => (f.rating || 0) === 4).length;
      const f3 = feedbacks.filter((f: any) => (f.rating || 0) <= 3).length;

      const bar: BarDatum[] = [
        { label: "5 Stars", value: f5, color: "#10b981" },
        { label: "4 Stars", value: f4, color: "#3b82f6" },
        { label: "3 Stars & Below", value: f3, color: "#f59e0b" },
      ];
      const donut: DonutSegment[] = (f5 + f4 + f3 === 0)
        ? [{ label: "No Feedback Recorded", value: 1, color: "var(--color-surface-3)" }]
        : [
            { label: "5 Stars", value: f5, color: "#10b981" },
            { label: "4 Stars", value: f4, color: "#3b82f6" },
            { label: "3 Stars & Below", value: f3, color: "#f59e0b" },
          ];
      return { bar, donut, title: "Trainer Rating & Workload Distribution" };
    }

    return {
      bar: overviewBarData,
      donut: overviewDonutData,
      title: "Business Metrics Visual Report",
    };
  }, [viewingReport, overviewBarData, overviewDonutData]);

  return (
    <div className="space-y-6 max-w-6xl mx-auto w-full">
      <PageHeader
        title="Reports & Visual Analytics"
        subtitle="Real-time performance, retention & financial records"
        backTo="/owner"
        action={
          <Link
            to="/owner/branch-comparison"
            className="hidden sm:inline-flex items-center gap-1.5 rounded-full bg-(--color-surface-2) text-(--color-text) text-xs font-semibold px-4 py-2 hover:bg-(--color-surface-3) transition-colors border border-(--color-border) whitespace-nowrap"
          >
            <Building2 size={14} /> Multi-Branch Analytics
          </Link>
        }
      />

      {/* Mobile & Small Screen Action Button (Full space under header) */}
      <div className="block sm:hidden w-full">
        <Link
          to="/owner/branch-comparison"
          className="w-full h-10 inline-flex items-center justify-center gap-2 rounded-xl bg-(--color-surface-2) border border-(--color-border) text-(--color-text) text-xs font-semibold px-4 hover:bg-(--color-surface-3) active:scale-[0.99] transition-all shadow-2xs"
        >
          <Building2 size={15} className="text-(--color-accent)" /> Multi-Branch Analytics
        </Link>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center p-12 text-sm text-(--color-text-muted) gap-2">
          <Loader2 className="w-6 h-6 animate-spin text-(--color-accent)" /> Loading report analytics & charts...
        </div>
      ) : error ? (
        <Card className="text-center py-8">
          <p className="text-sm text-(--color-danger) mb-3">{error}</p>
          <button
            onClick={fetchData}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs rounded-full bg-(--color-surface-3) text-(--color-text)"
          >
            <RefreshCw size={14} /> Retry
          </button>
        </Card>
      ) : (
        <div className="space-y-6">
          <Card className="p-5 sm:p-6 space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-(--color-border) pb-4">
              <div className="flex items-center gap-2.5">
                <span className="p-2 rounded-xl bg-(--color-accent-soft) text-(--color-accent)">
                  <BarChart2 size={20} />
                </span>
                <div>
                  <h2 className="font-display text-base font-semibold text-(--color-text)">Live Graphical Performance Suite</h2>
                  <p className="text-xs text-(--color-text-muted)">Real-time visual breakdown of revenue, attendance, retention & trainers</p>
                </div>
              </div>

              <div className="flex flex-col gap-1.5 w-full sm:w-auto sm:flex-row sm:items-center sm:gap-1 sm:overflow-x-auto sm:pb-0">
                {[
                  { id: "overview", label: "Overview", icon: TrendingUp },
                  { id: "attendance", label: "Attendance", icon: Activity },
                  { id: "revenue", label: "Revenue", icon: IndianRupee },
                  { id: "churn", label: "Risk & Churn", icon: AlertTriangle },
                  { id: "trainer", label: "Trainers", icon: Award },
                ].map((t) => {
                  const Icon = t.icon;
                  const activeTab = reportTab === t.id;
                  return (
                    <button
                      key={t.id}
                      onClick={() => setReportTab(t.id as any)}
                      className={clsx(
                        "group flex items-center justify-between sm:justify-start gap-2.5 sm:gap-1.5 w-full sm:w-auto px-3.5 py-2.5 sm:px-3 sm:py-1.5 text-xs font-medium rounded-xl sm:rounded-full transition-all duration-200 shrink-0 cursor-pointer",
                        activeTab
                          ? "bg-(--color-accent) text-(--color-navbar) shadow-xs font-bold"
                          : "bg-(--color-surface-2) text-(--color-text-muted) hover:text-(--color-text) hover:bg-(--color-surface-3) border border-(--color-border-soft)/60 sm:border-transparent"
                      )}
                    >
                      <div className="flex items-center gap-2 sm:gap-1.5">
                        <Icon size={14} className="icon-hover-pop shrink-0" />
                        <span>{t.label}</span>
                      </div>
                      <div className="flex items-center sm:hidden">
                        {activeTab ? (
                          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-(--color-navbar)/15 text-(--color-navbar)">
                            Active
                          </span>
                        ) : (
                          <ChevronRight size={14} className="text-(--color-text-muted)/40 group-hover:text-(--color-text) transition-transform group-hover:translate-x-0.5" />
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="w-full bg-(--color-surface-2)/60 rounded-2xl p-4 sm:p-6 border border-(--color-border-soft) space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-(--color-border-soft)/80 pb-3">
                <div className="flex items-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-(--color-accent-soft) text-(--color-accent)">
                    <BarChart2 size={16} />
                  </span>
                  <p className="text-xs sm:text-sm font-bold text-(--color-text) uppercase tracking-wide">
                    {reportTab === "overview" && "Key Growth Metrics Breakdown"}
                    {reportTab === "attendance" && "Daily Attendance Check-Ins"}
                    {reportTab === "revenue" && "Weekly Revenue Collections (₹)"}
                    {reportTab === "churn" && "Member Risk Level Breakdown"}
                    {reportTab === "trainer" && "Trainer Assigned Client Load"}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {reportTab === "overview" && (
                    <span className="text-[11px] font-semibold text-(--color-text-muted) px-2.5 py-1 rounded-full bg-(--color-surface-3)">
                      {overview?.totalActiveMembers ?? 0} Total Active Members
                    </span>
                  )}
                  {reportTab === "attendance" && (
                    <span className="text-[11px] font-semibold text-(--color-text-muted) px-2.5 py-1 rounded-full bg-(--color-surface-3)">
                      Avg {overview?.avgAttendanceRate30d ?? 0}% Active (30d)
                    </span>
                  )}
                  {reportTab === "revenue" && (
                    <span className="text-[11px] font-semibold text-(--color-text-muted) px-2.5 py-1 rounded-full bg-(--color-surface-3)">
                      ₹{(overview?.revenueThisMonth ?? 0).toLocaleString("en-IN")} Total Revenue
                    </span>
                  )}
                  {reportTab === "churn" && (
                    <span className="text-[11px] font-semibold text-(--color-text-muted) px-2.5 py-1 rounded-full bg-(--color-surface-3)">
                      {atRiskList.length} Flagged at Risk
                    </span>
                  )}
                  {reportTab === "trainer" && (
                    <span className="text-[11px] font-semibold text-(--color-text-muted) px-2.5 py-1 rounded-full bg-(--color-surface-3)">
                      {trainersList.length} Active Personal Trainers
                    </span>
                  )}
                  <span className="text-[10px] sm:text-xs font-mono text-(--color-accent) font-semibold px-2 py-0.5 rounded-md bg-(--color-accent)/10 border border-(--color-accent)/20">
                    Live Data
                  </span>
                </div>
              </div>

              <div className="pt-3 pb-2 w-full overflow-x-auto no-scrollbar">
                <BarChart height={210} data={activeBarData} />
              </div>

              <div className="pt-3 border-t border-(--color-border-soft)/60">
                {/* Mobile View: Clean stacked breakdown rows (one below another) with full labels and zero truncation */}
                <div className="flex flex-col divide-y divide-(--color-border-soft)/70 rounded-xl bg-(--color-surface-1) border border-(--color-border-soft) overflow-hidden sm:hidden shadow-2xs">
                  {activeBarData.map((item) => (
                    <div
                      key={item.label}
                      className="flex items-center justify-between px-3.5 py-2.5 text-xs hover:bg-(--color-surface-2)/40 transition-colors"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0 shadow-2xs"
                          style={{ backgroundColor: item.color ?? "var(--color-accent)" }}
                        />
                        <span className="font-medium text-(--color-text) text-xs">
                          {item.label}
                        </span>
                      </div>
                      <span className="font-bold text-(--color-text) font-mono text-xs px-2.5 py-0.5 rounded-md bg-(--color-surface-2) border border-(--color-border-soft) shrink-0 ml-2 shadow-2xs">
                        {item.formattedValue ?? (typeof item.value === "number" ? item.value.toLocaleString("en-IN") : item.value)}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Tablet & Desktop View: Clean horizontal pills row */}
                <div className="hidden sm:flex sm:flex-wrap sm:items-center sm:justify-center sm:gap-2">
                  {activeBarData.map((item) => (
                    <div
                      key={item.label}
                      className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-(--color-surface-3) text-[11px] text-(--color-text-muted)"
                    >
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: item.color ?? "var(--color-accent)" }}
                      />
                      <span className="font-medium text-(--color-text)">{item.label}:</span>
                      <span className="font-bold text-(--color-text) font-mono">
                        {item.formattedValue ?? (typeof item.value === "number" ? item.value.toLocaleString("en-IN") : item.value)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Card>

          <div className="grid sm:grid-cols-2 gap-4">
            {reportDefinitions.map((r) => (
              <Card key={r.key} className="flex items-center justify-between gap-3 hover:border-(--color-accent) transition-all">
                <div>
                  <p className="text-sm font-semibold text-(--color-text)">{r.name}</p>
                  <p className="text-xs text-(--color-text-muted) mt-0.5">{r.desc}</p>
                  <p className="text-[11px] text-(--color-accent) font-medium mt-1">{r.period}</p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => setActive(r)}
                    title="View graphical & tabular report"
                    className="flex h-9 w-9 items-center justify-center rounded-full bg-(--color-surface-3) text-(--color-text-muted) hover:text-(--color-accent) hover:bg-(--color-accent-soft) transition-all hover:scale-105"
                  >
                    <Eye size={16} className="icon-hover-pop" />
                  </button>
                  <button
                    onClick={() => download(`${r.key}.json`, JSON.stringify(r.rows(), null, 2), "application/json")}
                    title="Export JSON"
                    className="flex h-9 w-9 items-center justify-center rounded-full bg-(--color-surface-3) text-(--color-text-muted) hover:text-(--color-text) hover:bg-(--color-surface-2) transition-all hover:scale-105"
                  >
                    <FileJson size={16} className="icon-hover-pop" />
                  </button>
                  <button
                    onClick={() => download(`${r.key}.csv`, toCsv(r.columns, r.rows()), "text/csv")}
                    title="Export CSV"
                    className="flex h-9 w-9 items-center justify-center rounded-full bg-(--color-surface-3) text-(--color-text-muted) hover:text-(--color-text) hover:bg-(--color-surface-2) transition-all hover:scale-105"
                  >
                    <FileDown size={16} className="icon-hover-pop" />
                  </button>
                </div>
              </Card>
            ))}
          </div>

          <Card className="mt-4">
            <div className="flex items-center justify-center sm:justify-start gap-2 mb-3.5">
              <BarChart2 size={16} className="text-(--color-accent) icon-hover-pop" />
              <p className="text-xs font-semibold tracking-wide text-(--color-text-muted) uppercase text-center sm:text-left">
                Request New Backend Export
              </p>
            </div>
            <div className="flex flex-col items-center justify-center sm:grid sm:grid-cols-2 lg:flex lg:flex-row lg:flex-wrap lg:justify-start gap-2.5 w-full">
              {[
                { type: "ATTENDANCE_SUMMARY", label: "Attendance Summary" },
                { type: "REVENUE_COLLECTIONS", label: "Revenue Collections" },
                { type: "MEMBER_CHURN_RISK", label: "Member Churn Risk" },
                { type: "TRAINER_PERFORMANCE", label: "Trainer Performance" },
              ].map(({ type, label }) => (
                <button
                  key={type}
                  onClick={() => handleRequestReport(type)}
                  className="w-full max-w-xs sm:max-w-none sm:w-auto px-4 py-2.5 sm:py-2 text-xs font-semibold rounded-full bg-(--color-surface-2) border border-(--color-border) text-(--color-text) hover:bg-(--color-accent-soft) hover:text-(--color-accent-text) hover:border-(--color-accent) transition-all duration-200 btn-press text-center inline-flex items-center justify-center shadow-2xs cursor-pointer"
                >
                  Generate {label}
                </button>
              ))}
            </div>
          </Card>

          <Card className="mt-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <FileSpreadsheet size={16} className="text-(--color-accent) icon-hover-pop" />
                <p className="text-xs font-semibold tracking-wide text-(--color-text-muted) uppercase">Generated Export Files</p>
              </div>
              <button
                onClick={fetchData}
                className="p-1.5 rounded-full hover:bg-(--color-surface-2) text-(--color-text-muted) transition-colors"
                title="Refresh history"
              >
                <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
              </button>
            </div>

            {generatedReports.length === 0 ? (
              <p className="text-xs text-(--color-text-faint) text-center py-6">No custom exports generated yet. Click a button above to request one.</p>
            ) : (
              <div className="table-responsive-container">
                <table className="w-full text-xs text-left">
                  <thead>
                    <tr className="border-b border-(--color-border) text-(--color-text-muted) pb-2">
                      <th className="py-2">Report Type</th>
                      <th className="py-2">Scope</th>
                      <th className="py-2">Format</th>
                      <th className="py-2">Created Date</th>
                      <th className="py-2">Status</th>
                      <th className="py-2 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedReports.map((r) => (
                      <tr key={r._id} className="border-b border-(--color-border-soft) hover:bg-black/5 transition-colors">
                        <td className="py-2.5 font-semibold text-(--color-text)">
                          {r.reportType ? r.reportType.replace(/_/g, " ") : "General"}
                        </td>
                        <td className="py-2.5 text-(--color-text-muted)">
                          {r.scope?.memberId ? "Member Scoped" : "Gym Wide"}
                        </td>
                        <td className="py-2.5">
                          <span className="px-1.5 py-0.5 rounded text-[10px] bg-(--color-surface-3) font-mono font-medium">
                            {String(r.format || "CSV").toUpperCase()}
                          </span>
                        </td>
                        <td className="py-2.5 text-(--color-text-faint)">
                          {r.createdAt ? new Date(r.createdAt).toLocaleString() : "Recent"}
                        </td>
                        <td className="py-2.5">
                          <span className={clsx(
                            "px-2 py-0.5 rounded-full text-[10px] font-semibold",
                            r.status === "READY" && "bg-(--color-good-soft) text-(--color-good)",
                            r.status === "PROCESSING" && "bg-(--color-warn-soft) text-(--color-warn)",
                            r.status === "FAILED" && "bg-(--color-danger-soft) text-(--color-danger)"
                          )}>
                            {r.status || "PROCESSING"}
                          </span>
                        </td>
                        <td className="py-2.5 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {r.status === "READY" && (
                              <>
                                <button
                                  onClick={() => handleViewReportData(r)}
                                  className="p-1.5 rounded-full hover:bg-(--color-accent-soft) text-(--color-text-muted) hover:text-(--color-accent) transition-all hover:scale-105"
                                  title="View Report Graphs & Data"
                                >
                                  <Eye size={14} className="icon-hover-pop" />
                                </button>
                                <button
                                  onClick={() => handleDownloadReportData(r)}
                                  className="p-1.5 rounded-full hover:bg-(--color-surface-3) text-(--color-text-muted) hover:text-(--color-text) transition-all hover:scale-105"
                                  title="Download File"
                                >
                                  <FileDown size={14} className="icon-hover-pop" />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {totalPages > 1 && (
                  <div className="flex items-center justify-between border-t border-(--color-border-soft) pt-3 mt-3">
                    <p className="text-[11px] text-(--color-text-faint)">
                      Showing {startIndex + 1} to {Math.min(startIndex + itemsPerPage, generatedReports.length)} of {generatedReports.length} exports
                    </p>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                        disabled={currentPage === 1}
                        className="p-1 rounded bg-(--color-surface-2) border border-(--color-border) text-(--color-text-muted) hover:text-(--color-text) disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        title="Previous Page"
                      >
                        <ChevronLeft size={14} />
                      </button>
                      <span className="text-[11px] text-(--color-text-muted) px-1 font-medium">
                        Page {currentPage} of {totalPages}
                      </span>
                      <button
                        onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                        disabled={currentPage === totalPages}
                        className="p-1 rounded bg-(--color-surface-2) border border-(--color-border) text-(--color-text-muted) hover:text-(--color-text) disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        title="Next Page"
                      >
                        <ChevronRight size={14} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </Card>
        </div>
      )}

      {/* Graphical Report Modal for Standard Definitions */}
      {active && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-xs" onClick={() => setActive(null)} />
          <div className="relative w-full max-w-4xl max-h-[85vh] overflow-auto rounded-2xl bg-(--color-surface) border border-(--color-border) shadow-2xl flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-(--color-border) sticky top-0 bg-(--color-surface) z-10">
              <div>
                <p className="text-sm font-semibold text-(--color-text)">{active.name}</p>
                <p className="text-xs text-(--color-accent) font-medium">{active.period}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => download(`${active.key}.csv`, toCsv(active.columns, active.rows()), "text/csv")}
                  className="flex items-center gap-1.5 rounded-full bg-(--color-accent) text-(--color-navbar) text-xs font-bold px-3.5 py-1.5 hover:bg-(--color-accent-hover) transition-colors shadow-sm cursor-pointer"
                >
                  <FileSpreadsheet size={13} /> Export CSV
                </button>
                <button onClick={() => setActive(null)} className="text-(--color-text-muted) p-1 rounded-full hover:bg-(--color-surface-2) cursor-pointer">
                  <X size={18} />
                </button>
              </div>
            </div>

            <div className="p-5 space-y-5">
              <div className="w-full bg-(--color-surface-2)/60 rounded-2xl p-4 sm:p-5 border border-(--color-border-soft) flex flex-col justify-between space-y-3">
                <div className="flex items-center justify-between border-b border-(--color-border-soft)/60 pb-2">
                  <p className="text-xs font-bold text-(--color-text) uppercase tracking-wide">Metric Comparison</p>
                  <span className="text-[10px] text-(--color-text-muted) font-semibold">Live Data</span>
                </div>
                <div className="pt-2 pb-1">
                  <BarChart height={170} data={overviewBarData} />
                </div>
              </div>

              <div className="rounded-xl border border-(--color-border-soft) overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-(--color-surface-2)">
                      {active.columns.map((c) => (
                        <th key={c} className="text-left px-4 py-2.5 text-xs font-semibold text-(--color-text-muted)">
                          {c}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {active.rows().length === 0 ? (
                      <tr>
                        <td colSpan={active.columns.length} className="px-4 py-6 text-center text-xs text-(--color-text-faint)">
                          No report records found
                        </td>
                      </tr>
                    ) : (
                      active.rows().map((row, i) => (
                        <tr key={i} className="border-t border-(--color-border-soft) hover:bg-black/5 transition-colors">
                          {active.columns.map((c) => (
                            <td key={c} className="px-4 py-2.5 text-(--color-text) font-medium">
                              {row[c]}
                            </td>
                          ))}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Graphical + Raw Data View Modal for Custom Export Requests */}
      {viewingReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-xs" onClick={() => setViewingReport(null)} />
          <div className="relative w-full max-w-4xl max-h-[85vh] overflow-auto rounded-2xl bg-(--color-surface) border border-(--color-border) shadow-2xl flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-(--color-border) sticky top-0 bg-(--color-surface) z-10">
              <div>
                <p className="text-sm font-semibold text-(--color-text)">
                  {viewingReport.reportType ? viewingReport.reportType.replace(/_/g, " ") : "Custom Export Data"}
                </p>
                <p className="text-xs text-(--color-accent) font-medium">
                  Format: {String(viewingReport.format || "CSV").toUpperCase()} | Status: {viewingReport.status}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleDownloadReportData(viewingReport)}
                  className="flex items-center gap-1.5 rounded-full bg-(--color-accent) text-(--color-navbar) text-xs font-bold px-3.5 py-1.5 hover:bg-(--color-accent-hover) transition-colors shadow-sm cursor-pointer"
                >
                  <FileSpreadsheet size={13} /> Download
                </button>
                <button onClick={() => setViewingReport(null)} className="text-(--color-text-muted) p-1 rounded-full hover:bg-(--color-surface-2) cursor-pointer">
                  <X size={18} />
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2 px-5 py-2.5 border-b border-(--color-border-soft) bg-(--color-surface-2)/40">
              <button
                onClick={() => setModalViewTab("graph")}
                className={clsx(
                  "flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full transition-all duration-200 cursor-pointer",
                  modalViewTab === "graph"
                    ? "bg-(--color-accent) text-(--color-navbar) font-bold"
                    : "text-(--color-text-muted) hover:text-(--color-text) hover:bg-(--color-surface-3)"
                )}
              >
                <BarChart2 size={13} /> Graphical Analytics
              </button>
              <button
                onClick={() => setModalViewTab("data")}
                className={clsx(
                  "flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full transition-all duration-200 cursor-pointer",
                  modalViewTab === "data"
                    ? "bg-(--color-accent) text-(--color-navbar) font-bold"
                    : "text-(--color-text-muted) hover:text-(--color-text) hover:bg-(--color-surface-3)"
                )}
              >
                <FileJson size={13} /> Raw Data / CSV
              </button>
            </div>

            <div className="p-5 overflow-auto max-h-[60vh]">
              {modalViewTab === "graph" && parsedModalChartData ? (
                <div className="space-y-5">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold text-(--color-text) uppercase tracking-wide">{parsedModalChartData.title}</p>
                    <span className="px-2.5 py-0.5 rounded-full bg-(--color-accent-soft) text-(--color-accent-text) text-[10px] font-bold">
                      Parsed Visual Data
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-(--color-surface-2)/60 rounded-2xl p-4 sm:p-5 border border-(--color-border-soft) flex flex-col justify-between space-y-3">
                      <div className="flex items-center justify-between border-b border-(--color-border-soft)/60 pb-2">
                        <p className="text-xs font-bold text-(--color-text) uppercase tracking-wide">Bar Comparison</p>
                        <span className="text-[10px] text-(--color-text-muted) font-semibold">Distribution</span>
                      </div>
                      <div className="pt-2 pb-1">
                        <BarChart height={150} data={parsedModalChartData.bar} />
                      </div>
                    </div>
                    <div className="bg-(--color-surface-2)/60 rounded-2xl p-4 sm:p-5 border border-(--color-border-soft) flex flex-col justify-between space-y-3">
                      <div className="flex items-center justify-between border-b border-(--color-border-soft)/60 pb-2">
                        <p className="text-xs font-bold text-(--color-text) uppercase tracking-wide">Donut Distribution</p>
                        <span className="text-[10px] text-(--color-text-muted) font-semibold">Proportions</span>
                      </div>
                      <DonutChart size={120} thickness={15} segments={parsedModalChartData.donut} layout="horizontal" />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-4 text-xs font-mono bg-(--color-surface-2) rounded-xl border border-(--color-border-soft) overflow-auto">
                  <pre className="whitespace-pre-wrap text-left text-(--color-text-muted)">
                    {viewingReport.format === "pdf"
                      ? `PDF Report is stored in the cloud. Click Download above to open file.`
                      : reportDataToCsv(viewingReport.reportType, viewingReport.reportData)}
                  </pre>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
