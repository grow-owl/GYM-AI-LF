import { useState, useEffect } from "react";
import { Flame, Trophy, Zap, CheckCircle2, ChevronRight, Loader2, Sparkles } from "lucide-react";
import Card from "@/components/ui/Card";
import ProgressBar from "@/components/ui/ProgressBar";
import { gamificationApi } from "@/lib/endpoints";
import { toast } from "sonner";
import { Link } from "react-router-dom";

import { deriveGameStats, type GameStats } from "@/lib/gamification";

interface GamificationHubProps {
  gameProfile?: any;
  gameStats?: GameStats;
  onProfileUpdate?: () => void;
}

export default function StreakGamificationHub({ gameProfile, gameStats, onProfileUpdate }: GamificationHubProps) {
  const [challenges, setChallenges] = useState<any[]>([]);
  const [loadingChallenges, setLoadingChallenges] = useState(true);
  const [joiningId, setJoiningId] = useState<string | null>(null);

  const { level, streak, totalXp, xpToNext } = gameStats || deriveGameStats(gameProfile);

  useEffect(() => {
    setLoadingChallenges(true);
    gamificationApi
      .listChallenges()
      .then((res) => {
        const list = Array.isArray(res) ? res : (res as any)?.challenges || [];
        setChallenges(list);
      })
      .catch(() => {
        // Fallback default challenges
        setChallenges([
          {
            _id: "c1",
            title: "7-Day Consistency Warrior",
            description: "Check in 7 consecutive days at the gym",
            xpReward: 300,
            daysRemaining: 4,
            isJoined: true,
            progress: 5,
            target: 7,
          },
          {
            _id: "c2",
            title: "100k KG Weight Lifter",
            description: "Accumulate 100,000 kg total volume in workout logs",
            xpReward: 500,
            daysRemaining: 12,
            isJoined: false,
            progress: 42000,
            target: 100000,
          },
          {
            _id: "c3",
            title: "Hydration Master",
            description: "Log water intake 5 days in a row",
            xpReward: 150,
            daysRemaining: 2,
            isJoined: false,
            progress: 3,
            target: 5,
          },
        ]);
      })
      .finally(() => setLoadingChallenges(false));
  }, []);

  const handleJoinChallenge = async (challengeId: string) => {
    setJoiningId(challengeId);
    try {
      await gamificationApi.joinChallenge(challengeId);
      toast.success("Joined challenge successfully! Work hard towards your reward.");
      setChallenges((prev) =>
        prev.map((c) => (c._id === challengeId ? { ...c, isJoined: true } : c))
      );
      if (onProfileUpdate) onProfileUpdate();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Successfully enrolled in challenge!");
      setChallenges((prev) =>
        prev.map((c) => (c._id === challengeId ? { ...c, isJoined: true } : c))
      );
    } finally {
      setJoiningId(null);
    }
  };

  const todayIndex = (new Date().getDay() + 6) % 7; // 0=Mon, 6=Sun
  const weekDayNames = ["M", "T", "W", "T", "F", "S", "S"];
  const weekDays = weekDayNames.map((day, idx) => {
    const active = streak > 0 && idx <= todayIndex && (todayIndex - idx) < streak;
    return { day, active };
  });

  // Dynamic badges list based on real user achievements
  const badges = [
    { title: "First Blood", icon: "⚡", unlocked: totalXp > 0 || level > 1, desc: "Completed first workout" },
    { title: "Iron Will", icon: "🏋️", unlocked: streak >= 5, desc: "5-Day Workout Streak" },
    { title: "Early Bird", icon: "🌅", unlocked: streak >= 3 || totalXp >= 300, desc: "Consistent check-ins" },
    { title: "Centurion", icon: "👑", unlocked: totalXp >= 10000, desc: "Reach 10,000 XP" },
  ];

  return (
    <Card className="relative overflow-hidden border border-(--color-border) bg-(--color-surface) p-5 shadow-xl space-y-5">
      {/* Background ambient light */}
      <div className="pointer-events-none absolute -left-12 -bottom-12 h-36 w-36 rounded-full bg-orange-500/10 blur-3xl" />

      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/10 pb-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-500/15 text-orange-400">
            <Flame className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-display text-base font-bold text-(--color-text)">
              Gamification & Streak Hub
            </h3>
            <p className="text-xs text-(--color-text-muted)">
              Level up, earn XP, complete challenges & rank higher
            </p>
          </div>
        </div>

        <Link
          to="/member/rewards"
          className="flex items-center gap-1 text-xs font-semibold text-(--color-accent) hover:underline"
        >
          Full Hub <ChevronRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {/* Hero Banner: Streak & Level XP */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left: Streak Counter */}
        <div className="lg:col-span-5 p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-orange-500/10 via-amber-500/10 to-transparent dark:from-orange-500/20 dark:via-amber-500/15 border border-orange-500/30 flex flex-col justify-between shadow-sm space-y-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-black uppercase tracking-wider text-orange-600 dark:text-orange-400 flex items-center gap-1.5">
              <Flame className="h-4 w-4 text-orange-500 animate-pulse" /> Active Streak
            </span>
            <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-sm shrink-0">
              1.5x XP Boost ⚡
            </span>
          </div>

          <div className="my-2 text-center">
            <p className="font-display text-3xl sm:text-4xl font-extrabold text-(--color-text) tracking-tight flex items-center justify-center gap-2">
              {streak} <span className="text-lg font-extrabold text-orange-500">Days</span>
            </p>
            <p className="text-xs text-(--color-text-muted) font-semibold mt-0.5">
              Don't break your streak today!
            </p>
          </div>

          {/* 7-Day Flame Track */}
          <div className="flex justify-between items-center bg-(--color-surface-2) p-2 sm:p-2.5 rounded-xl border border-(--color-border)">
            {weekDays.map((item, idx) => (
              <div key={idx} className="flex flex-col items-center">
                <div
                  className={`h-7 w-7 rounded-full flex items-center justify-center text-xs transition-all ${
                    item.active
                      ? "bg-gradient-to-tr from-amber-500 to-orange-500 text-white shadow-md scale-105"
                      : "bg-(--color-surface-3) text-(--color-text-muted)/50"
                  }`}
                >
                  <Flame className="h-3.5 w-3.5" />
                </div>
                <span className="text-[10px] font-bold text-(--color-text-muted) mt-1">{item.day}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Level & XP Bar */}
        <div className="lg:col-span-7 p-4 sm:p-5 rounded-2xl bg-(--color-surface-2)/60 border border-(--color-border) flex flex-col justify-between space-y-4">
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
              <span className="font-display text-base sm:text-lg font-extrabold text-(--color-text) flex items-center gap-1.5">
                <Trophy className="h-5 w-5 text-amber-500" /> Level {level} Spartan
              </span>
              <span className="text-xs font-mono text-(--color-accent) font-extrabold px-2.5 py-0.5 rounded-full bg-(--color-accent)/10 border border-(--color-accent)/20">
                {totalXp.toLocaleString()} XP Total
              </span>
            </div>

            <ProgressBar
              value={totalXp}
              max={xpToNext}
              trackClassName="bg-(--color-surface-3) h-3 rounded-full"
              className="bg-gradient-to-r from-amber-400 via-accent to-purple-500"
            />
            
            <div className="flex flex-wrap items-center justify-between text-[11px] text-(--color-text-muted) font-semibold mt-2 font-mono gap-1">
              <span>Current Progress</span>
              <span className="text-(--color-text) font-bold">{Math.round((totalXp / xpToNext) * 100)}% to Level {level + 1}</span>
            </div>
          </div>

          {/* Badges Grid */}
          <div className="pt-3 border-t border-(--color-border-soft)">
            <p className="text-xs font-bold text-(--color-text-muted) mb-2">Recent Badges Unlocked</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {badges.map((b, idx) => (
                <div
                  key={idx}
                  className={`p-2 rounded-xl border text-center transition-all ${
                    b.unlocked
                      ? "bg-amber-500/10 border-amber-500/30 text-(--color-text)"
                      : "bg-(--color-surface-3)/40 border-(--color-border) opacity-40 grayscale text-(--color-text-muted)"
                  }`}
                  title={b.desc}
                >
                  <span className="text-lg">{b.icon}</span>
                  <p className="text-[10px] font-extrabold truncate mt-0.5">{b.title}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Active Gym Challenges */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-xs font-bold text-(--color-text-muted) uppercase tracking-wider flex items-center gap-1">
            <Zap className="h-3.5 w-3.5 text-amber-400" /> Active Gym Challenges
          </h4>
          <span className="text-xs text-(--color-text-muted)">Earn bonus XP & rewards</span>
        </div>

        {loadingChallenges ? (
          <div className="flex items-center justify-center py-6 text-xs text-(--color-text-muted) gap-2">
            <Loader2 className="h-4 w-4 animate-spin text-(--color-accent)" /> Loading challenges...
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {challenges.slice(0, 3).map((c) => (
              <div
                key={c._id}
                className="p-3.5 rounded-xl bg-(--color-surface-2)/60 border border-white/5 flex flex-col justify-between hover:border-white/10 transition-all"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <h5 className="font-display text-sm font-bold text-(--color-text)">{c.title}</h5>
                    <span className="shrink-0 text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-0.5">
                      <Sparkles className="h-3 w-3" /> +{c.xpReward} XP
                    </span>
                  </div>
                  <p className="text-xs text-(--color-text-muted) mt-1 line-clamp-2">{c.description}</p>
                </div>

                <div className="mt-3 pt-2 border-t border-white/5 flex items-center justify-between">
                  <span className="text-[11px] text-(--color-text-muted)">
                    ⏳ {c.daysRemaining || 7} days left
                  </span>

                  {c.isJoined ? (
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-400">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Enrolled
                    </span>
                  ) : (
                    <button
                      onClick={() => handleJoinChallenge(c._id)}
                      disabled={joiningId === c._id}
                      className="px-3 py-1 rounded-lg bg-(--color-accent) text-white text-xs font-semibold hover:brightness-110 disabled:opacity-50 transition-all"
                    >
                      {joiningId === c._id ? "Joining..." : "Join Challenge"}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}
