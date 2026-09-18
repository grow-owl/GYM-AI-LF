import { useState, useEffect, useMemo } from "react";
import {
  HeartPulse,
  AlertTriangle,
  CheckCircle2,
  Zap,
  Moon,
  Droplet,
  Smile,
  Search,
  RefreshCw,
  Loader2,
  MessageCircle,
  Activity,
  Calendar,
  Send,
} from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import Modal from "@/components/ui/Modal";
import { trainerApi, aiApi, progressApi } from "@/lib/endpoints";
import { useAuthStore } from "@/store/authStore";
import { toast } from "sonner";
import { formatApiError } from "@/lib/api";
import type { IMemberClient, IRecoveryStatus, IWellnessLog } from "@/types";

interface ClientRecoveryData {
  client: IMemberClient;
  status: IRecoveryStatus | null;
  history: IWellnessLog[];
  dailyScores: Array<{ day: string; date: string; score: number; sleep: number; water: number; isLogged?: boolean }>;
}

export default function RecoveryAlerts() {
  const user = useAuthStore((s) => s.user);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [clientRecords, setClientRecords] = useState<ClientRecoveryData[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"ALL" | "REST_NEEDED" | "MODERATE" | "OPTIMAL">("ALL");

  // Suggestion Modal State
  const [selectedClientForNudge, setSelectedClientForNudge] = useState<ClientRecoveryData | null>(null);
  const [customNudgeMessage, setCustomNudgeMessage] = useState("");

  // Detailed Metrics Modal
  const [selectedClientForDetail, setSelectedClientForDetail] = useState<ClientRecoveryData | null>(null);

  const fetchClientRecovery = async (isManual = false) => {
    const gymId = user?.gymId || "";
    if (!gymId) {
      setLoading(false);
      return;
    }
    if (isManual) setRefreshing(true);
    else setLoading(true);

    try {
      // 1. Fetch assigned clients
      const clientsRes = await trainerApi.getMyClients(gymId);
      const list: IMemberClient[] = Array.isArray(clientsRes) ? clientsRes : clientsRes?.clients || [];

      // 2. Concurrently fetch recovery status & wellness logs for each client
      const records: ClientRecoveryData[] = await Promise.all(
        list.map(async (client) => {
          const clientId = client._id || client.id || "";
          let status: IRecoveryStatus | null = null;
          let history: IWellnessLog[] = [];

          if (clientId) {
            try {
              const [recRes, histRes] = await Promise.all([
                aiApi.getRecoveryStatus(clientId).catch(() => null),
                progressApi.getWellnessHistory(clientId).catch(() => null),
              ]);

              status = recRes || null;
              if (Array.isArray(histRes)) {
                history = histRes;
              } else if (histRes?.history && Array.isArray(histRes.history)) {
                history = histRes.history;
              }
            } catch {
              // Fallback to null status
            }
          }

          // Build 7-day daily score trend for the graph
          const dailyScores = calculate7DayRecoveryTrend(history, status?.recoveryScore ?? 70);

          return {
            client,
            status,
            history,
            dailyScores,
          };
        })
      );

      setClientRecords(records);
    } catch (err: unknown) {
      toast.error(formatApiError(err, "Failed to load client recovery data."));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchClientRecovery();
  }, [user?.gymId]);

  // Generate 7-day recovery trend
  function calculate7DayRecoveryTrend(
    wellnessHistory: IWellnessLog[],
    fallbackScore: number
  ): Array<{ day: string; date: string; score: number; sleep: number; water: number; isLogged: boolean }> {
    const daysArr: Array<{ day: string; date: string; score: number; sleep: number; water: number; isLogged: boolean }> = [];
    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dayKey = d.toISOString().split("T")[0];
      const dayLabel = dayNames[d.getDay()];

      const match = wellnessHistory.find((w) => w.dayKey === dayKey);

      if (match) {
        const sleep = match.sleepHours ?? 0;
        const water = match.waterIntakeMl ? match.waterIntakeMl / 1000 : 0;
        let computed = 70;
        if (sleep >= 7.5) computed += 15;
        else if (sleep >= 6.5) computed += 5;
        else if (sleep >= 5.5) computed -= 10;
        else if (sleep > 0) computed -= 25;

        if (water >= 2.5) computed += 15;
        else if (water >= 1.5) computed += 5;
        else if (water > 0) computed -= 10;

        const dayScore = Math.max(10, Math.min(100, computed));
        daysArr.push({
          day: dayLabel,
          date: dayKey,
          score: dayScore,
          sleep,
          water,
          isLogged: true,
        });
      } else if (i === 0 && fallbackScore > 0) {
        daysArr.push({
          day: dayLabel,
          date: dayKey,
          score: fallbackScore,
          sleep: 0,
          water: 0,
          isLogged: true,
        });
      } else {
        // No log for this day — do not fabricate fake sleep or water
        daysArr.push({
          day: dayLabel,
          date: dayKey,
          score: 0,
          sleep: 0,
          water: 0,
          isLogged: false,
        });
      }
    }

    return daysArr;
  }

  // Summary Metrics
  const summaryStats = useMemo(() => {
    const total = clientRecords.length;
    let restNeededCount = 0;
    let moderateCount = 0;
    let optimalCount = 0;
    let totalSleepSum = 0;
    let sleepCount = 0;

    for (const record of clientRecords) {
      const score = record.status?.recoveryScore;
      if (score !== null && score !== undefined) {
        if (score < 50) restNeededCount++;
        else if (score < 70) moderateCount++;
        else optimalCount++;
      } else {
        moderateCount++;
      }

      if (record.status?.todaySleepHours) {
        totalSleepSum += record.status.todaySleepHours;
        sleepCount++;
      }
    }

    const avgSleep = sleepCount > 0 ? (totalSleepSum / sleepCount).toFixed(1) : "—";

    return {
      total,
      restNeededCount,
      moderateCount,
      optimalCount,
      avgSleep,
    };
  }, [clientRecords]);

  // Filtered Client List
  const filteredRecords = useMemo(() => {
    return clientRecords.filter((record) => {
      const clientName = (
        record.client.fullName ||
        record.client.name ||
        record.client.userId?.fullName ||
        ""
      ).toLowerCase();
      const phone = (record.client.phone || record.client.userId?.phone || "").toLowerCase();
      const q = searchQuery.trim().toLowerCase();

      if (q && !clientName.includes(q) && !phone.includes(q)) {
        return false;
      }

      const score = record.status?.recoveryScore ?? 65;
      if (activeTab === "REST_NEEDED") return score < 50;
      if (activeTab === "MODERATE") return score >= 50 && score < 70;
      if (activeTab === "OPTIMAL") return score >= 70;
      return true;
    });
  }, [clientRecords, searchQuery, activeTab]);

  // Urgent alerts list (score < 50)
  const urgentAlerts = useMemo(() => {
    return clientRecords.filter((r) => (r.status?.recoveryScore ?? 75) < 50);
  }, [clientRecords]);

  const openNudgeModal = (record: ClientRecoveryData) => {
    const name = record.client.fullName || record.client.name || record.client.userId?.fullName || "Member";
    const score = record.status?.recoveryScore ?? 45;
    const sleep = record.status?.todaySleepHours ?? 5;

    let defaultMsg = `Hi ${name}, your AI recovery score today is ${score}% due to ${sleep}h sleep. Let's adjust today's session to lighter mobility & active recovery to prevent injury and promote muscle repair. See you at the gym!`;
    if (score >= 70) {
      defaultMsg = `Hi ${name}, your AI recovery score is an optimal ${score}% today! You are primed for progressive overload or hitting your target sets. Let's crush today's workout!`;
    }

    setSelectedClientForNudge(record);
    setCustomNudgeMessage(defaultMsg);
  };

  const handleSendNudge = () => {
    if (!selectedClientForNudge) return;
    const phone = selectedClientForNudge.client.phone || selectedClientForNudge.client.userId?.phone || "";
    const cleanPhone = phone.replace(/[^0-9]/g, "");

    if (cleanPhone) {
      const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(customNudgeMessage)}`;
      window.open(url, "_blank");
      toast.success("Opening WhatsApp with personalized recovery advice!");
    } else {
      toast.info("No phone number registered for this member. Recommendation copied to clipboard.");
      navigator.clipboard.writeText(customNudgeMessage);
    }
    setSelectedClientForNudge(null);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <PageHeader
          title="Recovery & Fatigue Alerts"
          subtitle="AI-scored client recovery rate, 7-day fatigue graphs & training recommendations"
          backTo="/trainer"
        />
        <button
          onClick={() => fetchClientRecovery(true)}
          disabled={refreshing || loading}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-(--color-border) bg-(--color-surface-2) text-xs font-semibold text-(--color-text) hover:bg-(--color-surface) transition-colors self-start sm:self-auto cursor-pointer"
        >
          <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
          Refresh Diagnostics
        </button>
      </div>

      {/* Top Urgent Attention Alert Banner (When any client score < 50) */}
      {urgentAlerts.length > 0 && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 shadow-sm animate-pulse">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-rose-500 text-white shrink-0">
              <AlertTriangle size={20} />
            </div>
            <div>
              <p className="text-sm font-bold text-rose-400">
                🚨 Immediate Action: {urgentAlerts.length} Client{urgentAlerts.length > 1 ? "s" : ""} Require Workout Adjustment
              </p>
              <p className="text-xs text-rose-300/80 mt-0.5">
                Low sleep or high cumulative strain detected. Heavy compound lifts (Squats/Deadlifts) are contraindicated today.
              </p>
            </div>
          </div>
          <button
            onClick={() => setActiveTab("REST_NEEDED")}
            className="px-4 py-2 rounded-xl bg-rose-500 text-white text-xs font-bold hover:bg-rose-600 transition-colors shrink-0 cursor-pointer"
          >
            Review At-Risk Clients
          </button>
        </div>
      )}

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <Card className="p-4 space-y-1">
          <div className="flex items-center justify-between text-(--color-text-muted)">
            <span className="text-xs font-medium">Monitored Clients</span>
            <Activity size={16} className="text-(--color-accent)" />
          </div>
          <p className="text-2xl font-black text-(--color-text)">{summaryStats.total}</p>
          <p className="text-[11px] text-(--color-text-faint)">Active roster</p>
        </Card>

        <Card className="p-4 space-y-1 border-rose-500/20 bg-rose-500/5">
          <div className="flex items-center justify-between text-rose-400">
            <span className="text-xs font-medium">Rest Needed</span>
            <AlertTriangle size={16} />
          </div>
          <p className="text-2xl font-black text-rose-400">{summaryStats.restNeededCount}</p>
          <p className="text-[11px] text-rose-400/80">Score &lt; 50 (High Fatigue)</p>
        </Card>

        <Card className="p-4 space-y-1 border-amber-500/20 bg-amber-500/5">
          <div className="flex items-center justify-between text-amber-400">
            <span className="text-xs font-medium">Moderate Fatigue</span>
            <Zap size={16} />
          </div>
          <p className="text-2xl font-black text-amber-400">{summaryStats.moderateCount}</p>
          <p className="text-[11px] text-amber-400/80">Score 50–69 (Light Sets)</p>
        </Card>

        <Card className="p-4 space-y-1 border-emerald-500/20 bg-emerald-500/5">
          <div className="flex items-center justify-between text-emerald-400">
            <span className="text-xs font-medium">Optimal Ready</span>
            <CheckCircle2 size={16} />
          </div>
          <p className="text-2xl font-black text-emerald-400">{summaryStats.optimalCount}</p>
          <p className="text-[11px] text-emerald-400/80">Score ≥ 70 (PR Ready)</p>
        </Card>

        <Card className="p-4 space-y-1 col-span-2 lg:col-span-1">
          <div className="flex items-center justify-between text-(--color-text-muted)">
            <span className="text-xs font-medium">Team Avg Sleep</span>
            <Moon size={16} className="text-indigo-400" />
          </div>
          <p className="text-2xl font-black text-(--color-text)">{summaryStats.avgSleep}h</p>
          <p className="text-[11px] text-(--color-text-faint)">Target: 8.0h / night</p>
        </Card>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 p-1 bg-(--color-surface-2) rounded-xl border border-(--color-border) overflow-x-auto">
          <button
            onClick={() => setActiveTab("ALL")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
              activeTab === "ALL"
                ? "bg-(--color-accent) text-white"
                : "text-(--color-text-muted) hover:text-(--color-text)"
            }`}
          >
            All Clients ({summaryStats.total})
          </button>
          <button
            onClick={() => setActiveTab("REST_NEEDED")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1 cursor-pointer ${
              activeTab === "REST_NEEDED"
                ? "bg-rose-500 text-white"
                : "text-rose-400 hover:bg-rose-500/10"
            }`}
          >
            🚨 Rest Needed ({summaryStats.restNeededCount})
          </button>
          <button
            onClick={() => setActiveTab("MODERATE")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
              activeTab === "MODERATE"
                ? "bg-amber-500 text-white"
                : "text-amber-400 hover:bg-amber-500/10"
            }`}
          >
            ⚡ Moderate ({summaryStats.moderateCount})
          </button>
          <button
            onClick={() => setActiveTab("OPTIMAL")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
              activeTab === "OPTIMAL"
                ? "bg-emerald-500 text-white"
                : "text-emerald-400 hover:bg-emerald-500/10"
            }`}
          >
            ✅ Optimal ({summaryStats.optimalCount})
          </button>
        </div>

        <div className="relative w-full sm:w-64">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-(--color-text-muted)" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search client by name..."
            className="w-full pl-9 pr-3 py-2 rounded-xl bg-(--color-surface-2) border border-(--color-border) text-xs text-(--color-text) outline-none focus:border-(--color-accent)"
          />
        </div>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <Card className="flex items-center justify-center p-16 text-xs text-(--color-text-muted) gap-2">
          <Loader2 className="w-5 h-5 animate-spin text-(--color-accent)" />
          Analyzing client biometric sleep, water, and recovery records...
        </Card>
      ) : filteredRecords.length === 0 ? (
        <Card className="p-12 text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-(--color-surface-2) flex items-center justify-center mx-auto text-(--color-text-muted)">
            <HeartPulse size={24} />
          </div>
          <p className="text-sm font-bold text-(--color-text)">No client recovery records matching this filter</p>
          <p className="text-xs text-(--color-text-muted) max-w-sm mx-auto">
            Try selecting a different filter tab or clearing your search keywords.
          </p>
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {filteredRecords.map((item) => {
            const clientName = item.client.fullName || item.client.name || item.client.userId?.fullName || "Member";
            const score = item.status?.recoveryScore ?? 70;
            const trainingStatus = item.status?.trainingStatus || "Ready";
            const advice = item.status?.recoveryAdvice || "Maintain good hydration and consistent sleep schedules.";
            const sleepHours = item.status?.todaySleepHours ?? item.status?.avgSleepHours ?? 7.0;
            const waterLiters = item.status?.todayWaterMl ? (item.status.todayWaterMl / 1000).toFixed(1) : "2.0";
            const mood = item.status?.todayMood || "good";

            // Status Styling
            const isRestNeeded = score < 50;
            const isModerate = score >= 50 && score < 70;

            const badgeBg = isRestNeeded
              ? "bg-rose-500/10 text-rose-400 border-rose-500/30"
              : isModerate
              ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
              : "bg-emerald-500/10 text-emerald-400 border-emerald-500/30";

            const scoreColor = isRestNeeded
              ? "text-rose-400"
              : isModerate
              ? "text-amber-400"
              : "text-emerald-400";

            return (
              <Card
                key={item.client._id || item.client.id}
                className={`p-5 space-y-4 transition-all hover:border-(--color-accent)/40 ${
                  isRestNeeded ? "border-rose-500/40 shadow-sm" : ""
                }`}
              >
                {/* Top Row: Client Info & Status Badge */}
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-bold text-(--color-text)">{clientName}</h4>
                      <span className={`px-2 py-0.5 rounded-full border text-[10px] font-bold ${badgeBg}`}>
                        {trainingStatus}
                      </span>
                    </div>
                    <p className="text-xs text-(--color-text-muted)">
                      {item.client.planName || item.client.membershipPlan || "Standard Membership"} · Goal: {item.client.fitnessGoals?.[0] || "General Fitness"}
                    </p>
                  </div>

                  {/* Circular Score Gauge */}
                  <div className="flex flex-col items-center">
                    <div className="relative w-14 h-14 flex items-center justify-center">
                      <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                        <path
                          className="text-(--color-surface-2)"
                          strokeWidth="3.5"
                          stroke="currentColor"
                          fill="none"
                          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                        />
                        <path
                          className={scoreColor}
                          strokeDasharray={`${Math.max(10, score)}, 100`}
                          strokeWidth="3.5"
                          strokeLinecap="round"
                          stroke="currentColor"
                          fill="none"
                          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                        />
                      </svg>
                      <span className={`absolute text-xs font-black ${scoreColor}`}>{score}%</span>
                    </div>
                    <span className="text-[10px] text-(--color-text-faint) mt-0.5">Recovery</span>
                  </div>
                </div>

                {/* Biometrics Strip: Sleep, Water, Mood */}
                <div className="grid grid-cols-3 gap-2 py-2 px-3 rounded-xl bg-(--color-surface-2) border border-(--color-border)/60 text-xs">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-1 text-(--color-text-muted) text-[11px]">
                      <Moon size={13} className="text-indigo-400" />
                      <span>Sleep</span>
                    </div>
                    <p className="font-bold text-(--color-text)">
                      {sleepHours}h <span className="text-[10px] font-normal text-(--color-text-faint)">/ 8h</span>
                    </p>
                  </div>

                  <div className="space-y-0.5">
                    <div className="flex items-center gap-1 text-(--color-text-muted) text-[11px]">
                      <Droplet size={13} className="text-cyan-400" />
                      <span>Water</span>
                    </div>
                    <p className="font-bold text-(--color-text)">
                      {waterLiters}L <span className="text-[10px] font-normal text-(--color-text-faint)">logged</span>
                    </p>
                  </div>

                  <div className="space-y-0.5">
                    <div className="flex items-center gap-1 text-(--color-text-muted) text-[11px]">
                      <Smile size={13} className="text-amber-400" />
                      <span>Mood</span>
                    </div>
                    <p className="font-bold text-(--color-text) capitalize">{mood}</p>
                  </div>
                </div>

                {/* 7-Day Interactive Recovery Rate Graph */}
                <div className="space-y-1.5 pt-1">
                  <div className="flex items-center justify-between text-[11px] text-(--color-text-muted)">
                    <span className="font-semibold flex items-center gap-1">
                      <Activity size={12} className="text-(--color-accent)" /> 7-Day Recovery Rate Trend
                    </span>
                    <span className="text-(--color-text-faint)">Daily score (%)</span>
                  </div>

                  <div className="h-20 w-full flex items-end gap-1.5 pt-2 pb-1 px-1 bg-(--color-surface)/50 rounded-xl border border-(--color-border)/40">
                    {item.dailyScores.map((bar, bIdx) => {
                      const isToday = bIdx === item.dailyScores.length - 1;
                      const barColor = !bar.isLogged
                        ? "bg-(--color-surface-3) opacity-35 hover:opacity-50"
                        : bar.score >= 70
                        ? "bg-emerald-500 hover:bg-emerald-400"
                        : bar.score >= 50
                        ? "bg-amber-500 hover:bg-amber-400"
                        : "bg-rose-500 hover:bg-rose-400";

                      return (
                        <div
                          key={bIdx}
                          className="flex-1 flex flex-col items-center justify-end h-full group relative cursor-pointer"
                          title={
                            bar.isLogged
                              ? `${bar.day} (${bar.date}): ${bar.score}% Recovery${bar.sleep > 0 ? ` | Sleep: ${bar.sleep}h` : ""}${bar.water > 0 ? ` | Water: ${bar.water}L` : ""}`
                              : `${bar.day} (${bar.date}): Not Logged`
                          }
                        >
                          <div
                            style={{ height: `${bar.isLogged ? Math.max(12, bar.score) : 8}%` }}
                            className={`w-full rounded-t-md transition-all duration-300 ${barColor} ${
                              isToday && bar.isLogged ? "ring-2 ring-white/50" : ""
                            }`}
                          />
                          <span
                            className={`text-[9px] mt-1 truncate ${
                              isToday ? "font-black text-(--color-accent)" : "text-(--color-text-faint)"
                            }`}
                          >
                            {bar.day}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* AI Recommendation Box */}
                <div
                  className={`p-3 rounded-xl text-xs space-y-1 border ${
                    isRestNeeded
                      ? "bg-rose-500/10 border-rose-500/20 text-rose-300"
                      : isModerate
                      ? "bg-amber-500/10 border-amber-500/20 text-amber-300"
                      : "bg-emerald-500/10 border-emerald-500/20 text-emerald-300"
                  }`}
                >
                  <p className="font-bold flex items-center gap-1.5">
                    <Zap size={13} />
                    AI Training Recommendation:
                  </p>
                  <p className="text-[11px] leading-relaxed opacity-90">{advice}</p>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-2 pt-1">
                  <button
                    onClick={() => openNudgeModal(item)}
                    className="flex-1 py-2 px-3 rounded-xl bg-(--color-accent) text-white text-xs font-bold hover:opacity-90 transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
                  >
                    <MessageCircle size={14} /> Suggest to Member
                  </button>
                  <button
                    onClick={() => setSelectedClientForDetail(item)}
                    className="py-2 px-3 rounded-xl bg-(--color-surface-2) border border-(--color-border) text-xs font-semibold text-(--color-text) hover:bg-(--color-surface) transition-colors cursor-pointer"
                  >
                    Full Analytics
                  </button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Suggest to Member (WhatsApp Nudge) Modal */}
      {selectedClientForNudge && (
        <Modal
          title="Send Recovery Advice to Client"
          maxWidth="md"
          onClose={() => setSelectedClientForNudge(null)}
        >
          <div className="space-y-4">
            <div className="p-3 rounded-xl bg-(--color-surface-2) border border-(--color-border) space-y-1 text-xs">
              <p className="font-bold text-(--color-text)">
                Client: {selectedClientForNudge.client.fullName || selectedClientForNudge.client.name || "Member"}
              </p>
              <p className="text-(--color-text-muted)">
                Phone: {selectedClientForNudge.client.phone || selectedClientForNudge.client.userId?.phone || "Not provided"}
              </p>
              <p className="text-(--color-text-faint)">
                Today's Score: {selectedClientForNudge.status?.recoveryScore ?? 70}% (
                {selectedClientForNudge.status?.trainingStatus || "Ready"})
              </p>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-(--color-text)">
                Personalized Training & Recovery Suggestion
              </label>
              <textarea
                rows={4}
                value={customNudgeMessage}
                onChange={(e) => setCustomNudgeMessage(e.target.value)}
                className="w-full p-3 rounded-xl bg-(--color-surface-2) border border-(--color-border) text-xs text-(--color-text) outline-none focus:border-(--color-accent)"
              />
              <p className="text-[11px] text-(--color-text-faint)">
                You can review or edit this text before sending via WhatsApp.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setSelectedClientForNudge(null)}
                className="px-4 py-2 text-xs font-semibold rounded-xl text-(--color-text-muted) hover:text-(--color-text)"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSendNudge}
                className="px-4 py-2 text-xs font-bold rounded-xl bg-emerald-600 text-white hover:bg-emerald-500 transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
              >
                <Send size={14} /> Send WhatsApp Nudge
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Full Detailed Analytics Modal */}
      {selectedClientForDetail && (
        <Modal
          title={`Recovery Diagnostics — ${
            selectedClientForDetail.client.fullName || selectedClientForDetail.client.name || "Member"
          }`}
          maxWidth="lg"
          onClose={() => setSelectedClientForDetail(null)}
        >
          <div className="space-y-5">
            {/* KPI Strip */}
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="p-3 rounded-xl bg-(--color-surface-2) border border-(--color-border)">
                <span className="text-[11px] text-(--color-text-muted)">Readiness Score</span>
                <p className="text-lg font-black text-(--color-accent)">
                  {selectedClientForDetail.status?.recoveryScore ?? 70}%
                </p>
              </div>
              <div className="p-3 rounded-xl bg-(--color-surface-2) border border-(--color-border)">
                <span className="text-[11px] text-(--color-text-muted)">Total Workouts</span>
                <p className="text-lg font-black text-(--color-text)">
                  {selectedClientForDetail.status?.totalWorkouts ?? 0}
                </p>
              </div>
              <div className="p-3 rounded-xl bg-(--color-surface-2) border border-(--color-border)">
                <span className="text-[11px] text-(--color-text-muted)">Total Visits</span>
                <p className="text-lg font-black text-(--color-text)">
                  {selectedClientForDetail.status?.totalVisits ?? 0}
                </p>
              </div>
            </div>

            {/* 7-Day Day-by-Day Recovery Rate Breakdown */}
            <div className="space-y-2">
              <h5 className="text-xs font-bold text-(--color-text) flex items-center gap-1.5">
                <Calendar size={14} className="text-(--color-accent)" /> 7-Day Logged Recovery Rate Breakdown
              </h5>
              <div className="overflow-hidden rounded-xl border border-(--color-border)">
                <table className="w-full text-xs text-left">
                  <thead className="bg-(--color-surface-2) text-(--color-text-muted) border-b border-(--color-border)">
                    <tr>
                      <th className="p-2.5 font-medium">Day</th>
                      <th className="p-2.5 font-medium">Date</th>
                      <th className="p-2.5 font-medium">Sleep</th>
                      <th className="p-2.5 font-medium">Water</th>
                      <th className="p-2.5 font-medium text-right">Recovery Rate</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-(--color-border)/50">
                    {selectedClientForDetail.dailyScores.map((row, idx) => (
                      <tr key={idx} className="hover:bg-(--color-surface-2)/40">
                        <td className="p-2.5 font-semibold text-(--color-text)">{row.day}</td>
                        <td className="p-2.5 text-(--color-text-faint)">{row.date}</td>
                        <td className="p-2.5 text-(--color-text)">{row.sleep} hrs</td>
                        <td className="p-2.5 text-(--color-text)">{row.water} L</td>
                        <td className="p-2.5 text-right">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              row.score >= 70
                                ? "bg-emerald-500/10 text-emerald-400"
                                : row.score >= 50
                                ? "bg-amber-500/10 text-amber-400"
                                : "bg-rose-500/10 text-rose-400"
                            }`}
                          >
                            {row.score}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* AI Clinical Note */}
            <div className="p-3.5 rounded-xl bg-(--color-surface-2) border border-(--color-border) text-xs space-y-1">
              <p className="font-bold text-(--color-text)">AI Readiness Synthesis:</p>
              <p className="text-(--color-text-muted) leading-relaxed">
                {selectedClientForDetail.status?.recoveryAdvice ||
                  "Client is maintaining satisfactory hydration and steady recovery habits. Standard training progression is appropriate."}
              </p>
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedClientForDetail(null)}
                className="px-4 py-2 text-xs font-semibold rounded-xl bg-(--color-surface-2) text-(--color-text) hover:bg-(--color-surface)"
              >
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

