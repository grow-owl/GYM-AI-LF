import { useState, useEffect, useRef, useMemo } from "react";
import {
  Sparkles,
  Send,
  ShoppingBag,
  Loader2,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Activity,
  Moon,
  Droplets,
  Target,
  Utensils,
} from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import { aiApi } from "@/lib/endpoints";
import { toast } from "sonner";
import MarkdownRenderer from "@/components/common/MarkdownRenderer";

const quickPrompts = [
  "Which supplement should I take for muscle gain?",
  "Workout Advice for today",
  "How can I improve my recovery?",
  "Protein gap analysis",
];

interface Msg {
  from: "user" | "ai";
  text: string;
}

export default function AICoach() {
  const [messages, setMessages] = useState<Msg[]>([
    {
      from: "ai",
      text: "Hello! I am your AI Fitness & Recovery Coach. Ask me anything about workout plans, nutrition, supplement timing, or recovery optimization!",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);

  // Daily Chat Quota State (Live counter)
  const [quota, setQuota] = useState<{
    isExceeded: boolean;
    todayCount: number;
    limit: number;
    remaining: number;
  }>({
    isExceeded: false,
    todayCount: 0,
    limit: 5,
    remaining: 5,
  });

  const [upsellData, setUpsellData] = useState<any>(null);
  const [goalPrediction, setGoalPrediction] = useState<any>(null);
  const [dietRec, setDietRec] = useState<any>(null);

  const [recoveryData, setRecoveryData] = useState<any>(null);
  const [recoveryLoading, setRecoveryLoading] = useState<boolean>(true);
  const [recoveryError, setRecoveryError] = useState<string | null>(null);

  // Toggle to expand detailed AI insights & recovery cards without pushing chat off-screen
  const [showInsights, setShowInsights] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
    const t = setTimeout(scrollToBottom, 320);
    return () => clearTimeout(t);
  }, [messages, loading]);

  const loadAiData = async () => {
    setRecoveryLoading(true);
    try {
      const [upsellRes, convsRes, goalRes, dietRes, recoveryRes, quotaRes] =
        await Promise.allSettled([
          aiApi.getUpsellRecommendation(),
          aiApi.listConversations(),
          aiApi.getGoalPrediction("me"),
          aiApi.getDietRecommendation("me"),
          aiApi.getRecoveryStatus("me"),
          aiApi.getChatDailyLimit(),
        ]);

      if (quotaRes.status === "fulfilled" && quotaRes.value) {
        setQuota(quotaRes.value);
      }

      if (upsellRes.status === "fulfilled" && upsellRes.value) {
        setUpsellData(upsellRes.value);
      }
      if (goalRes.status === "fulfilled" && goalRes.value) {
        setGoalPrediction(goalRes.value);
      }
      if (dietRes.status === "fulfilled" && dietRes.value) {
        setDietRec(dietRes.value);
      }

      if (recoveryRes.status === "fulfilled" && recoveryRes.value) {
        setRecoveryData(recoveryRes.value);
        setRecoveryError(null);
      } else if (recoveryRes.status === "rejected") {
        const err: any = recoveryRes.reason;
        console.error("Failed to load recovery status:", err);
        setRecoveryError(
          err?.response?.data?.message ||
            err?.message ||
            "Unable to fetch recovery status from AI server."
        );
      }

      if (convsRes.status === "fulfilled" && convsRes.value?.conversations?.length) {
        const latestConv = convsRes.value.conversations[0];
        setConversationId(latestConv._id);
        const historyRes = await aiApi.getHistory(latestConv._id);
        if (historyRes?.messages?.length) {
          setMessages(
            historyRes.messages.map((m: any) => ({
              from: m.role === "user" ? "user" : "ai",
              text: m.content,
            }))
          );
        }
      }
    } catch (err: any) {
      console.error("Unexpected error in loadAiData:", err);
    } finally {
      setRecoveryLoading(false);
    }
  };

  useEffect(() => {
    loadAiData();

    const handleWellnessEvent = (e?: Event) => {
      const detail = (e as CustomEvent)?.detail;
      if (detail) {
        setRecoveryData((prev: any) => {
          if (!prev) return prev;
          const updated = { ...prev };
          if (detail.waterIntakeMl !== undefined) {
            updated.todayWaterMl = detail.waterIntakeMl;
            updated.todayHydrationFormatted = `${(detail.waterIntakeMl / 1000).toFixed(1)}L`;
          }
          if (detail.sleepHours !== undefined) {
            updated.todaySleepHours = detail.sleepHours;
            updated.todaySleepFormatted = `${detail.sleepHours}h 00m`;
          }
          if (detail.mood !== undefined) {
            updated.todayMood = detail.mood;
          }
          return updated;
        });
      }
      loadAiData();
    };

    window.addEventListener("gymai:wellness-updated", handleWellnessEvent);
    window.addEventListener("gymai:workout-updated", handleWellnessEvent);
    return () => {
      window.removeEventListener("gymai:wellness-updated", handleWellnessEvent);
      window.removeEventListener("gymai:workout-updated", handleWellnessEvent);
    };
  }, []);

  const send = async (text: string) => {
    if (!text.trim() || loading) return;

    if (quota.remaining <= 0 || quota.isExceeded) {
      toast.error("Daily free AI chat limit reached (5/5). Resets at midnight.");
      return;
    }

    const userText = text.trim();
    setInput("");
    setMessages((m) => [...m, { from: "user", text: userText }]);
    setLoading(true);

    // Optimistically decrement live counter immediately
    setQuota((prev) => ({
      ...prev,
      todayCount: prev.todayCount + 1,
      remaining: Math.max(0, prev.remaining - 1),
      isExceeded: prev.remaining - 1 <= 0,
    }));

    try {
      let replyText = "";
      let returnedQuota = null;

      if (!conversationId) {
        const res = await aiApi.startConversation(userText);
        setConversationId(res.conversation._id);
        replyText = res.replyMessage.content;
        returnedQuota = res.quota;
      } else {
        const res = await aiApi.sendMessage(conversationId, userText);
        replyText = res.replyMessage.content;
        returnedQuota = res.quota;
      }

      if (returnedQuota) {
        setQuota(returnedQuota);
      }

      setMessages((m) => [...m, { from: "ai", text: replyText }]);
    } catch (err: any) {
      const errMsg = err?.response?.data?.message || err?.message || "Failed to get AI response.";
      toast.error(errMsg);
      setMessages((m) => [
        ...m,
        {
          from: "ai",
          text: `Error connecting to AI service: ${errMsg}. If you're looking for genuine supplements or routine adjustments, please speak directly to your gym desk staff!`,
        },
      ]);
      // Refetch live quota from server if failed
      try {
        const freshQuota = await aiApi.getChatDailyLimit();
        if (freshQuota) setQuota(freshQuota);
      } catch {}
    } finally {
      setLoading(false);
    }
  };

  // Safe extraction helper to prevent React child object crash
  const goalText = typeof goalPrediction?.prediction === "string"
    ? goalPrediction.prediction
    : goalPrediction?.prediction?.explanation ||
      goalPrediction?.explanation ||
      goalPrediction?.message ||
      null;

  const dietText = typeof dietRec?.recommendation === "string"
    ? dietRec.recommendation
    : dietRec?.recommendation?.summary ||
      (Array.isArray(dietRec?.suggestions) && dietRec.suggestions.length > 0 ? dietRec.suggestions[0] : null) ||
      dietRec?.message ||
      null;

  const sleepDisplay = (() => {
    if (recoveryData?.todaySleepFormatted) {
      return recoveryData.todaySleepFormatted;
    }
    if (recoveryData?.todaySleepHours !== undefined && recoveryData?.todaySleepHours !== null) {
      const h = recoveryData.todaySleepHours;
      const wholeHours = Math.floor(h);
      const mins = Math.round((h - wholeHours) * 60);
      return `${wholeHours}h ${mins.toString().padStart(2, "0")}m`;
    }
    if (recoveryData?.avgSleepFormatted && recoveryData.avgSleepFormatted !== "--") {
      return `${recoveryData.avgSleepFormatted} (avg)`;
    }
    return "-- (8h target)";
  })();

  const sleepDisplayShort = (() => {
    if (recoveryData?.todaySleepFormatted) {
      return recoveryData.todaySleepFormatted;
    }
    if (recoveryData?.todaySleepHours !== undefined && recoveryData?.todaySleepHours !== null) {
      const h = recoveryData.todaySleepHours;
      const wholeHours = Math.floor(h);
      const mins = Math.round((h - wholeHours) * 60);
      return `${wholeHours}h${mins > 0 ? ` ${mins}m` : ""}`;
    }
    if (recoveryData?.avgSleepFormatted && recoveryData.avgSleepFormatted !== "--") {
      return `${recoveryData.avgSleepFormatted}`;
    }
    return "--";
  })();

  const hydrationDisplay = (() => {
    if (recoveryData?.todayWaterMl !== undefined && recoveryData?.todayWaterMl !== null) {
      return `${(recoveryData.todayWaterMl / 1000).toFixed(1)}L logged`;
    }
    if (recoveryData?.todayHydrationFormatted) {
      return `${recoveryData.todayHydrationFormatted} logged`;
    }
    if (recoveryData?.avgWaterMl && recoveryData.avgWaterMl > 0) {
      return `${(recoveryData.avgWaterMl / 1000).toFixed(1)}L (avg)`;
    }
    return "0.0L logged";
  })();

  const hydrationDisplayShort = (() => {
    if (recoveryData?.todayWaterMl !== undefined && recoveryData?.todayWaterMl !== null) {
      return `${(recoveryData.todayWaterMl / 1000).toFixed(1)}L`;
    }
    if (recoveryData?.todayHydrationFormatted) {
      return recoveryData.todayHydrationFormatted.replace(" logged", "");
    }
    if (recoveryData?.avgWaterMl && recoveryData.avgWaterMl > 0) {
      return `${(recoveryData.avgWaterMl / 1000).toFixed(1)}L`;
    }
    return "0.0L";
  })();

  const trainingStatusShort = (() => {
    const s = recoveryData?.trainingStatus;
    if (!s) return "Ready";
    if (s.toLowerCase().includes("baseline")) return "Baseline";
    if (s.toLowerCase().includes("rest")) return "Rest";
    if (s.toLowerCase().includes("moderate")) return "Moderate";
    return s;
  })();

  // Dynamic height on mobile & tablet: starts compact for 1 message, expands smoothly as chat progresses so 4-6 messages fit cleanly
  const chatHeightClass = useMemo(() => {
    if (messages.length <= 1) {
      return "min-h-[390px] h-[48vh] max-h-[460px]";
    }
    if (messages.length <= 3) {
      return "min-h-[520px] h-[64vh] max-h-[600px]";
    }
    // 4 or more messages (active conversation)
    return "min-h-[650px] h-[78vh] max-h-[760px]";
  }, [messages.length]);

  return (
    <div className="flex flex-col min-h-[calc(100vh-140px)] lg:h-[calc(100vh-115px)] max-w-5xl mx-auto w-full pb-6 lg:pb-0">
      {/* Top Header with Live Daily Chat Quota Counter */}
      <PageHeader
        title="AI Fitness Coach"
        backTo="/member"
        action={
          <div className="flex items-center gap-2">
            <div
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold bg-white border shadow-xs transition-all ${
                quota.remaining > 2
                  ? "border-(--color-border) text-(--color-text)"
                  : quota.remaining > 0
                  ? "border-amber-300 text-amber-900 bg-amber-50/50"
                  : "border-rose-300 text-rose-900 bg-rose-50/50"
              }`}
              title="Daily free AI queries limit (resets every midnight)"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0" />
              <span className="tabular-nums font-mono font-extrabold text-amber-600">
                {quota.remaining} / {quota.limit}
              </span>
              <span className="hidden sm:inline font-semibold text-(--color-text-muted)">Daily Chats Left</span>
              <span className="sm:hidden font-semibold text-(--color-text-muted)">Left</span>
            </div>
          </div>
        }
      />

      {/* Compact / Collapsible AI Insights & Recovery Bar */}
      <div className="mb-3 sm:mb-4 shrink-0">
        {/* MOBILE & TABLET VIEW (< lg) */}
        <div className="lg:hidden p-3 rounded-2xl bg-white border border-(--color-border) shadow-xs space-y-2.5">
          {recoveryLoading ? (
            <div className="flex items-center gap-2 text-xs text-(--color-text-muted) py-1">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-(--color-accent)" />
              <span>Syncing recovery & readiness baseline...</span>
            </div>
          ) : recoveryError ? (
            <div className="flex items-center gap-1.5 text-xs text-(--color-danger) py-1">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">Recovery unavailable</span>
            </div>
          ) : (
            <>
              {/* Row 1: Full Recovery Status (No clipping or truncation) */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-(--color-text-faint) uppercase text-[10px] font-extrabold tracking-wider shrink-0">
                  Recovery:
                </span>
                <span className="font-bold text-(--color-text) tabular-nums text-xs shrink-0">
                  {recoveryData?.recoveryScore !== null && recoveryData?.recoveryScore !== undefined
                    ? `${recoveryData.recoveryScore}/100`
                    : "--"}
                </span>
                <span
                  className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full border shadow-2xs tracking-wide shrink-0 ${
                    recoveryData?.recoveryCategory === "OPTIMAL" ||
                    recoveryData?.recoveryCategory === "OPTIMAL RECOVERY"
                      ? "bg-emerald-50 text-emerald-800 border-emerald-300"
                      : recoveryData?.recoveryCategory === "FATIGUED" ||
                        recoveryData?.recoveryCategory === "RECOVERY NEEDED" ||
                        recoveryData?.recoveryCategory?.includes("HIGH FATIGUE")
                      ? "bg-rose-50 text-rose-800 border-rose-300"
                      : "bg-amber-100 text-amber-900 border-amber-300"
                  }`}
                >
                  {recoveryData?.recoveryCategory || "BASELINE BUILDING"}
                </span>
              </div>

              {/* Row 2: 3 Balanced Micro-Tiles (Sleep, Hydration, Training Status) */}
              <div className="grid grid-cols-3 gap-1.5 sm:gap-2.5 text-xs">
                {/* Sleep */}
                <div className="p-2 sm:p-2.5 rounded-xl bg-(--color-surface-2)/60 border border-(--color-border-soft) flex flex-col items-center justify-center text-center">
                  <div className="flex items-center gap-1 text-[10px] font-semibold text-(--color-text-muted) mb-0.5">
                    <Moon size={11} className="text-indigo-500 shrink-0" />
                    <span>Sleep</span>
                  </div>
                  <span className="text-xs font-bold text-(--color-text) tabular-nums truncate max-w-full">
                    {sleepDisplayShort}
                  </span>
                </div>

                {/* Hydration */}
                <div className="p-2 sm:p-2.5 rounded-xl bg-(--color-surface-2)/60 border border-(--color-border-soft) flex flex-col items-center justify-center text-center">
                  <div className="flex items-center gap-1 text-[10px] font-semibold text-(--color-text-muted) mb-0.5">
                    <Droplets size={11} className="text-sky-500 shrink-0" />
                    <span>Water</span>
                  </div>
                  <span className="text-xs font-bold text-(--color-text) tabular-nums truncate max-w-full">
                    {hydrationDisplayShort}
                  </span>
                </div>

                {/* Training Status */}
                <div className="p-2 sm:p-2.5 rounded-xl bg-(--color-surface-2)/60 border border-(--color-border-soft) flex flex-col items-center justify-center text-center">
                  <div className="flex items-center gap-1 text-[10px] font-semibold text-(--color-text-muted) mb-0.5">
                    <Activity size={11} className="text-emerald-600 shrink-0" />
                    <span>Status</span>
                  </div>
                  <span className="text-xs font-bold text-(--color-text) truncate max-w-full">
                    {trainingStatusShort}
                  </span>
                </div>
              </div>

              {/* Row 3: AI Insights Button (Full width on mobile/tablet) */}
              <button
                type="button"
                onClick={() => setShowInsights(!showInsights)}
                className="w-full flex items-center justify-center gap-1.5 text-xs font-bold text-(--color-text) hover:text-(--color-accent-text) bg-(--color-surface-2) hover:bg-(--color-surface-3) px-3 py-2 rounded-xl border border-(--color-border) transition-all cursor-pointer shadow-2xs"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                <span>{showInsights ? "Hide AI Insights" : "AI Insights & Recommendations"}</span>
                {showInsights ? <ChevronUp size={14} className="text-(--color-text-muted)" /> : <ChevronDown size={14} className="text-(--color-text-muted)" />}
              </button>
            </>
          )}
        </div>

        {/* DESKTOP VIEW (>= lg) */}
        <div className="hidden lg:flex p-3 px-4 rounded-2xl bg-white border border-(--color-border) items-center justify-between gap-4 shadow-xs">
          {recoveryLoading ? (
            <div className="flex items-center gap-2 text-xs text-(--color-text-muted)">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-(--color-accent)" />
              <span>Syncing recovery & readiness baseline...</span>
            </div>
          ) : recoveryError ? (
            <div className="flex items-center gap-1.5 text-xs text-(--color-danger)">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">Recovery unavailable</span>
            </div>
          ) : (
            <div className="flex items-center gap-4 text-xs py-0.5 min-w-0">
              {/* Recovery Score */}
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-(--color-text-faint) uppercase text-[10px] font-extrabold tracking-wider">
                  Recovery:
                </span>
                <span className="font-bold text-(--color-text) tabular-nums">
                  {recoveryData?.recoveryScore !== null && recoveryData?.recoveryScore !== undefined
                    ? `${recoveryData.recoveryScore}/100`
                    : "--"}
                </span>
                <span
                  className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full border shadow-2xs tracking-wide ${
                    recoveryData?.recoveryCategory === "OPTIMAL" ||
                    recoveryData?.recoveryCategory === "OPTIMAL RECOVERY"
                      ? "bg-emerald-50 text-emerald-800 border-emerald-300"
                      : recoveryData?.recoveryCategory === "FATIGUED" ||
                        recoveryData?.recoveryCategory === "RECOVERY NEEDED" ||
                        recoveryData?.recoveryCategory?.includes("HIGH FATIGUE")
                      ? "bg-rose-50 text-rose-800 border-rose-300"
                      : "bg-amber-100 text-amber-900 border-amber-300"
                  }`}
                >
                  {recoveryData?.recoveryCategory || "GOOD TO TRAIN"}
                </span>
              </div>

              <span className="text-(--color-border) text-xs">|</span>

              {/* Sleep */}
              <div className="flex items-center gap-1.5 text-[11px] text-(--color-text-muted) shrink-0">
                <Moon className="w-3.5 h-3.5 text-indigo-500" />
                <span className="font-medium text-(--color-text)">
                  {sleepDisplay}
                </span>
              </div>

              <span className="text-(--color-border) text-xs">|</span>

              {/* Hydration */}
              <div className="flex items-center gap-1.5 text-[11px] text-(--color-text-muted) shrink-0">
                <Droplets className="w-3.5 h-3.5 text-sky-500 fill-sky-500/20" />
                <span className="font-semibold text-(--color-text)">
                  {hydrationDisplay}
                </span>
                <span className="text-[10px] text-(--color-text-faint)">(3.0L target)</span>
              </div>

              <span className="text-(--color-border) text-xs">|</span>

              {/* Training Status */}
              <div className="flex items-center gap-1.5 text-[11px] text-(--color-text-muted) shrink-0">
                <Activity className="w-3.5 h-3.5 text-emerald-600" />
                <span className="font-bold text-(--color-text)">
                  {recoveryData?.trainingStatus || "Ready"}
                </span>
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={() => setShowInsights(!showInsights)}
            className="shrink-0 flex items-center gap-1 text-xs font-bold text-(--color-text) hover:text-(--color-accent-text) bg-(--color-surface-2) hover:bg-(--color-surface-3) px-3 py-1.5 rounded-xl border border-(--color-border) transition-all cursor-pointer shadow-2xs"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0" />
            <span>{showInsights ? "Hide Insights" : "AI Insights"}</span>
            {showInsights ? <ChevronUp size={14} className="text-(--color-text-muted)" /> : <ChevronDown size={14} className="text-(--color-text-muted)" />}
          </button>
        </div>

        {/* Expanded Insights Section (Smoothly visible when toggled) */}
        {showInsights && (
          <div className="mt-2.5 space-y-2.5 animate-fade-in">
            {/* Supplement Recommendation if eligible */}
            {upsellData?.eligible && upsellData?.supplementRecommendation && (
              <div className="p-4 rounded-2xl bg-white border border-amber-300/80 shadow-xs flex items-start gap-3">
                <div className="h-8 w-8 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 shrink-0 mt-0.5">
                  <ShoppingBag className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="font-bold text-(--color-text) text-xs">
                      {upsellData.supplementRecommendation.title}
                    </p>
                    <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300">
                      Gym Store
                    </span>
                  </div>
                  <p className="text-xs text-(--color-text-muted) leading-relaxed">
                    {upsellData.supplementRecommendation.explanation}
                  </p>
                  <button
                    onClick={() => send("Tell me more about gym supplements and protein gap")}
                    className="mt-2 text-xs font-bold text-(--color-accent-text) hover:underline cursor-pointer flex items-center gap-1"
                  >
                    <span>Ask AI Coach about Supplement Store</span> &rarr;
                  </button>
                </div>
              </div>
            )}

            {/* Goal Prediction & Macro Advice */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
              {goalText && (
                <div className="p-4 rounded-2xl bg-white border border-(--color-border) shadow-xs hover:border-indigo-300 transition-all space-y-1.5">
                  <div className="flex items-center gap-2">
                    <div className="h-6 w-6 rounded-lg bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600 shrink-0">
                      <Target className="w-3.5 h-3.5" />
                    </div>
                    <span className="text-xs font-bold text-(--color-text)">Target Goal Projection</span>
                  </div>
                  <p className="text-xs text-(--color-text-muted) leading-relaxed font-normal pl-8">
                    {goalText}
                  </p>
                </div>
              )}

              {dietText && (
                <div className="p-4 rounded-2xl bg-white border border-(--color-border) shadow-xs hover:border-emerald-300 transition-all space-y-1.5">
                  <div className="flex items-center gap-2">
                    <div className="h-6 w-6 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 shrink-0">
                      <Utensils className="w-3.5 h-3.5" />
                    </div>
                    <span className="text-xs font-bold text-(--color-text)">Daily Macro AI Advice</span>
                  </div>
                  <p className="text-xs text-(--color-text-muted) leading-relaxed font-normal pl-8">
                    {dietText}
                  </p>
                </div>
              )}
            </div>

            {recoveryData?.insufficientData && (
              <div className="p-3 rounded-xl bg-white border border-(--color-border) flex items-center justify-between text-[11px] text-(--color-text-muted) shadow-2xs">
                <span>Baseline is building. Log daily sleep & water in Progress tab to refine score.</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Main Interactive Chat Window */}
      <div
        className={`w-full flex flex-col rounded-2xl border border-(--color-border-soft) bg-(--color-surface)/70 backdrop-blur-sm overflow-hidden shadow-sm transition-[height] duration-300 ease-out lg:flex-1 lg:min-h-0 lg:h-auto lg:max-h-none ${chatHeightClass}`}
      >
        {/* Messages List Area */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3 min-h-0">
          {messages.map((m, i) => (
            <div key={i} className={m.from === "user" ? "flex justify-end" : "flex justify-start"}>
              {m.from === "ai" && (
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-(--color-accent-soft) text-(--color-accent-text) mr-2 mt-0.5">
                  <Sparkles size={13} />
                </span>
              )}
              <div
                className={
                  m.from === "user"
                    ? "max-w-[85%] sm:max-w-[75%] rounded-2xl rounded-tr-sm bg-(--color-accent) text-white text-sm px-4 py-2.5 shadow-xs"
                    : "max-w-[85%] sm:max-w-[75%] rounded-2xl rounded-tl-sm bg-(--color-surface-2) text-(--color-text) text-sm px-4 py-2.5 leading-relaxed border border-(--color-border-soft) shadow-xs"
                }
              >
                {m.from === "user" ? (
                  m.text
                ) : (
                  <MarkdownRenderer content={m.text} isUser={false} />
                )}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex justify-start items-center gap-2">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-(--color-accent-soft) text-(--color-accent-text) mr-2">
                <Sparkles size={13} className="animate-spin" />
              </span>
              <div className="rounded-2xl rounded-tl-sm bg-(--color-surface-2) text-(--color-text-muted) text-xs px-4 py-2.5 flex items-center gap-2 border border-(--color-border-soft)">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-(--color-accent)" />
                <span>AI Coach is thinking...</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Footer Area: Limit Reached Warning + Quick Chips + Pinned Input Bar */}
        <div className="p-3 bg-(--color-surface-2)/60 border-t border-(--color-border-soft) shrink-0">
          {/* Daily Quota Exhausted Banner */}
          {(quota.remaining === 0 || quota.isExceeded) && (
            <div className="mb-2.5 p-2.5 px-3 rounded-xl bg-rose-500/10 border border-rose-500/25 text-xs text-rose-300 flex items-center justify-between gap-3 animate-fade-in">
              <div className="flex items-center gap-2 min-w-0">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                <span className="truncate sm:whitespace-normal">
                  <strong>Daily chat quota reached (5/5).</strong> Resets at 12:00 AM midnight.
                </span>
              </div>
              <span className="font-mono text-[10px] bg-rose-500/20 px-2 py-0.5 rounded text-rose-200 shrink-0">
                Resets @ 00:00
              </span>
            </div>
          )}

          {/* Quick Prompts */}
          <div className="flex gap-1.5 overflow-x-auto pb-2 scrollbar-none">
            {quickPrompts.map((p) => (
              <button
                key={p}
                onClick={() => {
                  if (quota.remaining === 0 || quota.isExceeded) {
                    toast.error("Daily free AI chat limit reached (5/5). Resets at midnight.");
                    return;
                  }
                  send(p);
                }}
                disabled={loading || quota.remaining === 0 || quota.isExceeded}
                className="shrink-0 rounded-full border border-(--color-border) text-(--color-text-muted) text-xs font-medium px-3 py-1.5 hover:border-(--color-accent)/50 hover:text-(--color-text) disabled:opacity-40 disabled:cursor-not-allowed transition-colors bg-(--color-surface)/80"
              >
                {p}
              </button>
            ))}
          </div>

          {/* Input Form */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
            className="flex items-center gap-2 rounded-full border border-(--color-border) bg-(--color-surface) px-2 py-1.5 focus-within:border-(--color-accent) transition-all shadow-xs"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={loading || quota.remaining === 0 || quota.isExceeded}
              placeholder={
                quota.remaining === 0 || quota.isExceeded
                  ? "Daily free AI chat limit reached (0/5). Resets at midnight 🌙"
                  : "Ask your AI Coach anything..."
              }
              className="flex-1 bg-transparent text-sm px-3 py-1 outline-none placeholder:text-(--color-text-faint) disabled:opacity-60 disabled:cursor-not-allowed text-(--color-text)"
            />
            <button
              type="submit"
              disabled={
                loading ||
                quota.remaining === 0 ||
                quota.isExceeded ||
                !input.trim()
              }
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-(--color-accent) text-white disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 transition-all cursor-pointer shadow-xs"
              title={
                quota.remaining === 0 || quota.isExceeded
                  ? "Daily chat limit reached"
                  : "Send message"
              }
            >
              <Send size={14} />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
