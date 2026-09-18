import { useState, useEffect, useRef, useMemo } from "react";
import { Sparkles, TrendingUp, Clock, Users2, Send, Loader2, AlertTriangle, Phone, MessageCircle } from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import { aiApi } from "@/lib/endpoints";
import { useAuthStore } from "@/store/authStore";
import { formatApiError, showApiErrorToast } from "@/lib/api";
import MarkdownRenderer from "@/components/common/MarkdownRenderer";

interface Msg {
  from: "user" | "ai";
  text: string;
}

const ownerQuickPrompts = [
  "How can I increase supplement sales this month?",
  "Analyze member retention & churn risk",
  "How to handle peak hour crowd from 6-8 PM?",
  "Strategies to boost membership renewals",
];

export default function AIInsights() {
  const user = useAuthStore((s) => s.user);
  const [messages, setMessages] = useState<Msg[]>([
    {
      from: "ai",
      text: "Hello! I am your AI Gym Business Analyst. I can analyze revenue trends, member churn risk, peak workout hours, and recommend high-impact retention strategies. Ask me anything or choose a quick prompt below.",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);

  // At-risk members state
  const [atRiskMembers, setAtRiskMembers] = useState<any[]>([]);
  const [loadingAtRisk, setLoadingAtRisk] = useState(true);

  // AI Insights State
  const [trainerPerf, setTrainerPerf] = useState<any>(null);
  const [peakHoursData, setPeakHoursData] = useState<any>(null);
  const [revenueForecastData, setRevenueForecastData] = useState<any>(null);
  const [planProfitabilityData, setPlanProfitabilityData] = useState<any>(null);
  const [insightsError, setInsightsError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
    const t = setTimeout(scrollToBottom, 300);
    return () => clearTimeout(t);
  }, [messages, loading]);

  // Track desktop vs mobile/tablet viewport to preserve 100% desktop UI
  const [isDesktop, setIsDesktop] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.innerWidth >= 1024;
  });

  useEffect(() => {
    const handleResize = () => {
      setIsDesktop(window.innerWidth >= 1024);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Dynamic height on mobile & tablet: starts compact for 1 message, expands smoothly as chat progresses
  const chatHeightClass = useMemo(() => {
    if (messages.length <= 1) {
      return "min-h-[380px] h-[48vh] max-h-[450px]";
    }
    if (messages.length <= 3) {
      return "min-h-[500px] h-[62vh] max-h-[580px]";
    }
    // 4 or more messages (active conversation)
    return "min-h-[620px] h-[75vh] max-h-[740px]";
  }, [messages.length]);

  useEffect(() => {
    const loadOwnerAi = async () => {
      try {
        const convsRes = await aiApi.listConversations();
        if (convsRes?.conversations?.length) {
          const latestConv = convsRes.conversations[0];
          setConversationId(latestConv._id);
          const historyRes = await aiApi.getHistory(latestConv._id);
          if (historyRes?.messages?.length) {
            setMessages(
              historyRes.messages.map((m: any) => ({
                from: m.role === "user" ? "user" : "ai",
                text: (m.content || "").replace(/\$\s*(\d[\d,.]*)/g, "₹$1").replace(/\bUSD\s*(\d[\d,.]*)/gi, "₹$1"),
              }))
            );
          }
        }
      } catch (err) {
        console.warn("No prior AI conversation found:", err);
      }
    };

    const loadAtRiskAndInsights = async () => {
      const gymId = user?.gymId;
      if (!gymId) return;
      setLoadingAtRisk(true);
      setInsightsError(null);
      try {
        const [riskRes, perfRes, peakRes, revRes, planRes] = await Promise.all([
          aiApi.getAtRiskMembers(gymId).catch(() => null),
          aiApi.getTrainerPerformance(gymId).catch(() => null),
          aiApi.getPeakHours(gymId).catch(() => null),
          aiApi.getRevenueForecast(gymId).catch(() => null),
          aiApi.getPlanProfitability(gymId).catch(() => null),
        ]);

        const list = Array.isArray(riskRes) ? riskRes : riskRes?.atRiskMembers || [];
        setAtRiskMembers(list);
        if (perfRes) setTrainerPerf(perfRes);
        if (peakRes) setPeakHoursData(peakRes);
        if (revRes) setRevenueForecastData(revRes);
        if (planRes) setPlanProfitabilityData(planRes);
      } catch (err: any) {
        const msg = formatApiError(err, "Failed to load gym analytics insights");
        setInsightsError(msg);
        showApiErrorToast(err, "Failed to load gym analytics insights");
        setAtRiskMembers([]);
      } finally {
        setLoadingAtRisk(false);
      }
    };

    loadOwnerAi();
    loadAtRiskAndInsights();
  }, [user]);

  const send = async (text: string) => {
    if (!text.trim() || loading) return;
    const userText = text.trim();
    setInput("");
    setMessages((m) => [...m, { from: "user", text: userText }]);
    setLoading(true);

    try {
      let replyText = "";
      if (!conversationId) {
        const res = await aiApi.startConversation(userText);
        setConversationId(res.conversation._id);
        replyText = res.replyMessage.content;
      } else {
        const res = await aiApi.sendMessage(conversationId, userText);
        replyText = res.replyMessage.content;
      }
      const sanitizedReply = (replyText || "")
        .replace(/\$\s*(\d[\d,.]*)/g, "₹$1")
        .replace(/\bUSD\s*(\d[\d,.]*)/gi, "₹$1");
      setMessages((m) => [...m, { from: "ai", text: sanitizedReply }]);
    } catch (err: any) {
      const errorMsg = formatApiError(err, "AI Assistant is currently unavailable. Please verify connection.");
      showApiErrorToast(err, "AI Assistant query failed");
      setMessages((m) => [
        ...m,
        {
          from: "ai",
          text: `⚠️ **AI Query Failed**\n\n${errorMsg}\n\n*Please try asking again in a moment.*`,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader title="AI Business Advisor & Insights" backTo="/owner" />

      {/* At-Risk Members (Churn Risk Prediction) Section */}
      <Card sweep className="border-amber-500/30 space-y-3">
        <div className="flex items-start sm:items-center justify-between gap-2 border-b border-(--color-border-soft) pb-3">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <AlertTriangle size={18} className="text-amber-400 shrink-0" />
            <div>
              <h3 className="text-sm font-semibold text-(--color-text) leading-snug">
                At-Risk Members
                <span className="hidden sm:inline font-normal text-xs text-(--color-text-muted) ml-1.5">
                  (AI Churn Risk Prediction)
                </span>
              </h3>
              <p className="text-[11px] text-(--color-text-muted) sm:hidden mt-0.5">
                AI Churn Risk Prediction
              </p>
            </div>
          </div>
          <span className="text-[11px] font-semibold text-amber-400 uppercase tracking-wider shrink-0 whitespace-nowrap px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/20">
            {atRiskMembers.length} Flagged
          </span>
        </div>

        {loadingAtRisk ? (
          <div className="flex items-center gap-2 text-xs text-(--color-text-muted) py-4 justify-center">
            <Loader2 size={14} className="animate-spin text-(--color-accent)" /> Calculating member churn probability...
          </div>
        ) : atRiskMembers.length === 0 ? (
          <p className="text-xs text-(--color-text-faint) py-3 text-center">
            No high-risk member churn detected. Member attendance patterns remain healthy across active plans.
          </p>
        ) : (
          <div className="divide-y divide-(--color-border-soft)">
            {atRiskMembers.map((m, idx) => {
              const name = m.name || m.userId?.fullName || "Member";
              const phone = m.phone || m.userId?.phone || "";
              const riskLevel = m.riskLevel || m.churnRisk || "high";
              const probability = m.probability ? `${Math.round(m.probability * 100)}%` : "High Risk";
              const reasons = m.reasons || m.riskFactors || ["Decreased check-in frequency over last 14 days"];

              return (
                <div key={m._id || idx} className="flex items-center justify-between py-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-(--color-text)">{name}</p>
                      <Badge tone={riskLevel === "high" ? "danger" : "warn"}>
                        {probability} Churn Probability
                      </Badge>
                    </div>
                    <p className="text-xs text-(--color-text-faint) mt-0.5">
                      {Array.isArray(reasons) ? reasons.join(" · ") : reasons}
                    </p>
                  </div>

                  {phone && (
                    <div className="flex items-center gap-2 shrink-0">
                      <a
                        href={`tel:${phone}`}
                        className="flex h-8 w-8 items-center justify-center rounded-full border border-(--color-border) text-(--color-text-muted) hover:text-(--color-text)"
                      >
                        <Phone size={14} />
                      </a>
                      <a
                        href={`https://wa.me/${phone.replace(/[^0-9]/g, "")}`}
                        target="_blank"
                        rel="noreferrer"
                        className="flex h-8 w-8 items-center justify-center rounded-full border border-(--color-border) text-(--color-text-muted) hover:text-emerald-400"
                      >
                        <MessageCircle size={14} />
                      </a>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {insightsError && (
        <div className="flex items-center justify-between p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-400">
          <span>⚠️ {insightsError}</span>
          <button onClick={() => window.location.reload()} className="underline font-bold cursor-pointer hover:text-red-300">
            Retry Sync
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="flex flex-col gap-2">
          <TrendingUp size={16} className="text-emerald-400" />
          <p className="text-sm font-medium text-(--color-text)">Revenue Forecast</p>
          <p className="text-xs text-(--color-text-muted) leading-relaxed">
            {revenueForecastData?.forecast
              ? `Projected Next Month: ₹${Number(revenueForecastData.forecast).toLocaleString("en-IN")}`
              : "Awaiting more billing history to generate linear revenue forecast."}
          </p>
        </Card>
        <Card className="flex flex-col gap-2">
          <Clock size={16} className="text-blue-400" />
          <p className="text-sm font-medium text-(--color-text)">Peak Hours Analysis</p>
          <p className="text-xs text-(--color-text-muted) leading-relaxed">
            {peakHoursData?.peakSlot
              ? `Peak Gym Window: ${peakHoursData.peakSlot}`
              : "Awaiting check-in clustering data to identify peak workout hours."}
          </p>
        </Card>
        <Card className="flex flex-col gap-2">
          <Users2 size={16} className="text-purple-400" />
          <p className="text-sm font-medium text-(--color-text)">Trainer Performance</p>
          <p className="text-xs text-(--color-text-muted) leading-relaxed">
            {trainerPerf?.topTrainer
              ? `Top Trainer: ${trainerPerf.topTrainer.name || "Staff"}`
              : "Awaiting client workout session completions to rank trainer performance."}
          </p>
        </Card>
        <Card className="flex flex-col gap-2">
          <Sparkles size={16} className="text-amber-400" />
          <p className="text-sm font-medium text-(--color-text)">Plan Profitability</p>
          <p className="text-xs text-(--color-text-muted) leading-relaxed">
            {planProfitabilityData?.topPlan
              ? `Top Tier Plan: ${planProfitabilityData.topPlan}`
              : "Awaiting active member plan enrollment to analyze tier profitability."}
          </p>
        </Card>
      </div>

      {/* Interactive AI Owner Business Chat */}
      <Card
        className={`border border-(--color-border) flex flex-col transition-[height] duration-300 ease-out lg:h-[480px] ${chatHeightClass}`}
      >
        <div className="flex items-center justify-between pb-3 border-b border-(--color-border) mb-3">
          <div className="flex items-center gap-2">
            <Sparkles size={18} className="text-(--color-accent)" />
            <h3 className="text-sm font-semibold text-(--color-text)">Ask Gym AI Business Advisor</h3>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto space-y-3 mb-3 pr-1">
          {messages.map((m, i) => (
            <div key={i} className={m.from === "user" ? "flex justify-end" : "flex justify-start"}>
              {m.from === "ai" && (
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-(--color-accent-soft) text-(--color-accent-text) mr-2">
                  <Sparkles size={13} />
                </span>
              )}
              <div
                className={
                  m.from === "user"
                    ? "max-w-[88%] sm:max-w-[80%] rounded-2xl rounded-tr-sm bg-(--color-accent) text-(--color-navbar) font-bold text-sm px-4 py-2.5 whitespace-pre-wrap"
                    : "max-w-[88%] sm:max-w-[80%] rounded-2xl rounded-tl-sm bg-(--color-surface-2) text-(--color-text) text-sm px-4 py-2.5 leading-relaxed whitespace-pre-wrap"
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
              <div className="rounded-2xl rounded-tl-sm bg-(--color-surface-2) text-(--color-text-muted) text-xs px-4 py-2 flex items-center gap-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Analyzing gym metrics & generating advice...</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="flex gap-2 overflow-x-auto pb-2 mb-2 no-scrollbar">
          {ownerQuickPrompts.map((p) => (
            <button
              key={p}
              onClick={() => send(p)}
              className="shrink-0 rounded-full border border-(--color-border) text-(--color-text-muted) text-xs font-medium px-3.5 py-1.5 hover:border-(--color-accent)/50 hover:text-(--color-text) active:scale-95 transition-all"
            >
              {p}
            </button>
          ))}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
          className="flex items-center gap-2 rounded-full border border-(--color-border) bg-(--color-surface) px-2 py-1.5"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={isDesktop ? "Ask business advisor about revenue, members, or inventory..." : "Ask business advisor..."}
            className="flex-1 bg-transparent text-sm px-2 py-1.5 outline-none placeholder:text-(--color-text-faint)"
          />
          <button
            type="submit"
            disabled={loading}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-(--color-accent) text-(--color-navbar) disabled:opacity-50"
          >
            <Send size={14} />
          </button>
        </form>
      </Card>

    </div>
  );
}
