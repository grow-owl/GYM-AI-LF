import { useState, useEffect, useRef } from "react";
import { Sparkles, Send, Bot, User as UserIcon, Loader2, RefreshCw, Zap } from "lucide-react";
import Card from "@/components/ui/Card";
import { aiApi } from "@/lib/endpoints";
import { formatApiError, showApiErrorToast } from "@/lib/api";
import MarkdownRenderer from "@/components/common/MarkdownRenderer";

interface ChatMessage {
  id?: string;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt?: string;
  isFallback?: boolean;
}

export default function AIChatWidget() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content:
        "Hey Champion! 🖐️ I'm your AI Fitness & Workout Assistant. How can I help you reach your goals today? Ask me about workout plans, diet tips, or performance analysis!",
      createdAt: new Date().toISOString(),
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [recommendation, setRecommendation] = useState<any | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  // Fetch initial recommendation
  useEffect(() => {
    aiApi
      .getUpsellRecommendation()
      .then((res) => {
        if (res && res.recommendation) {
          setRecommendation(res.recommendation);
        }
      })
      .catch(() => {});
  }, []);

  const handleSend = async (customText?: string) => {
    const textToSend = customText || input;
    if (!textToSend.trim() || loading) return;

    const userMsg: ChatMessage = {
      role: "user",
      content: textToSend,
      createdAt: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!customText) setInput("");
    setLoading(true);

    try {
      if (!conversationId) {
        // Start new conversation
        const res = await aiApi.startConversation(textToSend);
        if (res?.conversation?._id) {
          setConversationId(res.conversation._id);
        }
        if (res?.replyMessage?.content) {
          setMessages((prev) => [
            ...prev,
            {
              role: "assistant",
              content: res.replyMessage.content,
              createdAt: new Date().toISOString(),
            },
          ]);
        }
      } else {
        // Send to existing conversation
        const res = await aiApi.sendMessage(conversationId, textToSend);
        if (res?.replyMessage?.content) {
          setMessages((prev) => [
            ...prev,
            {
              role: "assistant",
              content: res.replyMessage.content,
              createdAt: new Date().toISOString(),
            },
          ]);
        }
      }
    } catch (err: any) {
      const errorMsg = formatApiError(err, "AI Fitness Assistant is temporarily unavailable. Please try again.");
      showApiErrorToast(err, "AI Assistant error");
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `⚠️ **Message Failed to Send**\n\n${errorMsg}\n\n*Please try asking your question again in a moment.*`,
          createdAt: new Date().toISOString(),
          isFallback: true,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const quickPrompts = [
    "🏋️ Chest & Triceps routine",
    "🥗 Post-workout nutrition advice",
    "📈 How to boost my score?",
    "🔥 Fast fat loss tip",
  ];

  return (
    <Card className="relative flex flex-col overflow-hidden border border-(--color-border) bg-(--color-surface) p-5 shadow-xl h-[480px]">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-3">
        <div className="flex items-center gap-2.5">
          <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-500 text-white shadow-lg">
            <Sparkles className="h-5 w-5 animate-pulse" />
            <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-400 border-2 border-black" />
          </div>
          <div>
            <h3 className="font-display text-base font-bold text-(--color-text) flex items-center gap-1.5">
              Spartan AI Fitness Coach
              <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                PRO ACTIVE
              </span>
            </h3>
            <p className="text-xs text-(--color-text-muted)">Ask anything about training, diet & recovery</p>
          </div>
        </div>

        <button
          onClick={() => {
            setMessages([
              {
                role: "assistant",
                content: "Chat cleared! How can I assist you with your fitness journey now?",
                createdAt: new Date().toISOString(),
              },
            ]);
            setConversationId(null);
          }}
          className="text-xs text-(--color-text-muted) hover:text-(--color-text) p-1.5 rounded-lg hover:bg-white/5 transition-colors"
          title="Reset Chat"
        >
          <RefreshCw className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Smart AI Recommendation Banner if available */}
      {recommendation && (
        <div className="mb-3 flex items-center justify-between rounded-xl bg-gradient-to-r from-purple-900/40 via-indigo-900/30 to-purple-900/40 p-2.5 border border-purple-500/20 text-xs">
          <div className="flex items-center gap-2 text-purple-200">
            <Zap className="h-4 w-4 text-amber-400 shrink-0" />
            <span>{recommendation.tip || recommendation.title || "AI Insight: Hydrate well before leg day!"}</span>
          </div>
        </div>
      )}

      {/* Messages Scroll Container */}
      <div className="flex-1 overflow-y-auto space-y-3 pr-2 scrollbar-thin scrollbar-thumb-white/10">
        {messages.map((msg, index) => (
          <div
            key={index}
            className={`flex gap-2.5 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            {msg.role === "assistant" && (
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-purple-600 text-white text-xs font-bold mt-1">
                <Bot className="h-4 w-4" />
              </div>
            )}

            <div className="max-w-[82%]">
              <div
                className={`rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed ${
                  msg.role === "user"
                    ? "bg-(--color-accent) text-white rounded-tr-none shadow-md font-medium"
                    : "bg-(--color-surface-2) text-(--color-text) rounded-tl-none border border-white/5"
                }`}
              >
                {msg.role === "user" ? (
                  msg.content
                ) : (
                  <MarkdownRenderer content={msg.content} isUser={false} />
                )}
              </div>
              {msg.isFallback && (
                <p className="text-[10px] text-(--color-text-muted) mt-1 ml-1 font-medium">
                  Offline reply — reconnecting...
                </p>
              )}
            </div>

            {msg.role === "user" && (
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-white text-xs font-bold mt-1">
                <UserIcon className="h-4 w-4" />
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="flex items-center gap-2 text-xs text-(--color-text-muted) py-2 px-3 bg-(--color-surface-2)/40 rounded-xl w-fit">
            <Loader2 className="h-4 w-4 animate-spin text-(--color-accent)" />
            AI Coach is thinking...
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick Prompt Chips */}
      <div className="flex items-center gap-1.5 overflow-x-auto py-2 border-t border-white/5 scrollbar-none">
        {quickPrompts.map((prompt, idx) => (
          <button
            key={idx}
            onClick={() => handleSend(prompt)}
            disabled={loading}
            className="shrink-0 text-[11px] font-medium px-2.5 py-1 rounded-full bg-white/5 hover:bg-white/10 text-(--color-text-muted) hover:text-(--color-text) transition-colors border border-white/5"
          >
            {prompt}
          </button>
        ))}
      </div>

      {/* Input Form */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSend();
        }}
        className="mt-1 flex items-center gap-2"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask AI Coach anything..."
          disabled={loading}
          className="flex-1 rounded-xl bg-(--color-surface-2) px-3.5 py-2.5 text-xs text-(--color-text) placeholder-(--color-text-muted) border border-white/10 focus:outline-none focus:border-(--color-accent)"
        />
        <button
          type="submit"
          disabled={!input.trim() || loading}
          className="flex h-9 w-9 items-center justify-center rounded-xl bg-(--color-accent) text-white hover:brightness-110 disabled:opacity-40 transition-all shrink-0"
        >
          <Send className="h-4 w-4" />
        </button>
      </form>
    </Card>
  );
}
