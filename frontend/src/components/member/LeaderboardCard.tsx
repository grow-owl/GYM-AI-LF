import { useState, useEffect } from "react";
import { Trophy, Flame, Shield, Loader2, Zap } from "lucide-react";
import Card from "@/components/ui/Card";
import { gamificationApi } from "@/lib/endpoints";

interface LeaderboardCardProps {
  gymId?: string;
  currentUserId?: string;
}

interface LeaderboardEntry {
  _id?: string;
  memberId?: string;
  rank?: number;
  fullName?: string;
  name?: string;
  score?: number;
  xp?: number;
  points?: number;
  totalXp?: number;
  level?: number;
  currentStreakDays?: number;
  avatarUrl?: string;
  isCurrentUser?: boolean;
}

export default function LeaderboardCard({ gymId, currentUserId }: LeaderboardCardProps) {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"xp" | "streak">("xp");

  const fetchLeaderboard = () => {
    setLoading(true);
    gamificationApi
      .getLeaderboard(gymId, filter)
      .then((res) => {
        const list = Array.isArray(res) ? res : (res as any)?.leaderboard || [];
        const enriched = list.map((item: any) => {
          const xpVal = item.score ?? item.xp ?? item.points ?? item.totalXp ?? 0;
          return {
            ...item,
            totalXp: xpVal,
            isCurrentUser:
              item.isCurrentUser ||
              Boolean(
                currentUserId &&
                  (item._id === currentUserId ||
                    item.memberId === currentUserId ||
                    item.userId === currentUserId)
              ),
          };
        });
        setLeaderboard(enriched);
      })
      .catch((err) => {
        console.error("Failed to load leaderboard card:", err);
        setLeaderboard([]);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchLeaderboard();

    const handleUpdate = () => {
      fetchLeaderboard();
    };
    window.addEventListener("gymai:workout-updated", handleUpdate);
    return () => window.removeEventListener("gymai:workout-updated", handleUpdate);
  }, [gymId, currentUserId, filter]);

  return (
    <Card className="relative overflow-hidden border border-(--color-border) bg-(--color-surface) p-4 sm:p-5 shadow-xl space-y-4">
      {/* Header & Segmented Filter Control */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-(--color-border-soft) pb-3.5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/15 text-amber-500 border border-amber-500/20 shrink-0">
            <Trophy className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-display text-base font-extrabold text-(--color-text) leading-tight">
              Gym Leaderboard
            </h3>
            <p className="text-xs text-(--color-text-muted) mt-0.5">
              Top performers ranked by total XP & streak
            </p>
          </div>
        </div>

        {/* Filter Switcher Segmented Control */}
        <div className="grid grid-cols-2 p-1 rounded-xl bg-(--color-surface-2) border border-(--color-border-soft) w-full sm:w-auto text-xs font-bold gap-1">
          <button
            type="button"
            onClick={() => setFilter("xp")}
            className={`flex items-center justify-center gap-1.5 py-1.5 px-3.5 rounded-lg transition-all cursor-pointer ${
              filter === "xp"
                ? "bg-(--color-surface) text-(--color-text) shadow-xs font-extrabold border border-(--color-border-soft)"
                : "text-(--color-text-muted) hover:text-(--color-text)"
            }`}
          >
            <Zap size={13} className={filter === "xp" ? "text-amber-500 fill-amber-500" : "text-(--color-text-muted)"} />
            <span>Total XP</span>
          </button>
          <button
            type="button"
            onClick={() => setFilter("streak")}
            className={`flex items-center justify-center gap-1.5 py-1.5 px-3.5 rounded-lg transition-all cursor-pointer ${
              filter === "streak"
                ? "bg-(--color-surface) text-(--color-text) shadow-xs font-extrabold border border-(--color-border-soft)"
                : "text-(--color-text-muted) hover:text-(--color-text)"
            }`}
          >
            <Flame size={13} className={filter === "streak" ? "text-orange-500 fill-orange-500" : "text-(--color-text-muted)"} />
            <span>Streak</span>
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8 text-xs text-(--color-text-muted) gap-2">
          <Loader2 className="h-4 w-4 animate-spin text-(--color-accent)" /> Fetching leaderboard...
        </div>
      ) : leaderboard.length === 0 ? (
        <div className="text-center py-8 text-xs text-(--color-text-muted)">
          No members on leaderboard yet. Check in to earn XP and rank up!
        </div>
      ) : (
        <div className="space-y-2.5">
          {leaderboard.slice(0, 6).map((user, idx) => {
            const rank = user.rank || idx + 1;
            const name = user.fullName || user.name || "Gym Member";
            const xp = user.totalXp ?? (user as any).score ?? (user as any).xp ?? (user as any).points ?? 0;
            const streak = user.currentStreakDays ?? 0;
            const level = user.level ?? 1;

            let rankBadge = (
              <div className="w-7 h-7 rounded-full bg-(--color-surface-2) text-(--color-text-muted) border border-(--color-border-soft) flex items-center justify-center font-mono font-bold text-xs shrink-0">
                #{rank}
              </div>
            );
            if (rank === 1) {
              rankBadge = (
                <div className="w-7 h-7 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 flex items-center justify-center text-sm shadow-2xs shrink-0">
                  🥇
                </div>
              );
            } else if (rank === 2) {
              rankBadge = (
                <div className="w-7 h-7 rounded-full bg-slate-300/30 text-slate-700 dark:text-slate-200 border border-slate-400/30 flex items-center justify-center text-sm shadow-2xs shrink-0">
                  🥈
                </div>
              );
            } else if (rank === 3) {
              rankBadge = (
                <div className="w-7 h-7 rounded-full bg-orange-500/15 text-orange-600 dark:text-orange-400 border border-orange-500/30 flex items-center justify-center text-sm shadow-2xs shrink-0">
                  🥉
                </div>
              );
            }

            return (
              <div
                key={user.memberId || user._id || idx}
                className={`p-3 rounded-2xl border transition-all ${
                  user.isCurrentUser
                    ? "bg-gradient-to-r from-amber-500/10 via-indigo-500/10 to-transparent border-amber-500/35 shadow-xs ring-1 ring-amber-500/20"
                    : "bg-(--color-surface-2)/40 border-(--color-border-soft) hover:bg-(--color-surface-2)/70"
                }`}
              >
                {/* Top Row: Rank Badge, Avatar, Full Name & Primary Highlight Metric */}
                <div className="flex items-start sm:items-center justify-between gap-2.5">
                  {/* Left Identity: Rank, Avatar, Full Member Name (ZERO truncation) */}
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <div className="shrink-0">{rankBadge}</div>

                    {user.avatarUrl ? (
                      <img
                        src={user.avatarUrl}
                        alt={name}
                        className="h-9 w-9 rounded-xl object-cover border border-(--color-border-soft) shrink-0"
                      />
                    ) : (
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 font-extrabold text-sm border border-indigo-500/25 shrink-0">
                        {name.charAt(0).toUpperCase()}
                      </div>
                    )}

                    {/* Member Full Name - Wraps naturally, NEVER truncated */}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-display text-sm font-extrabold text-(--color-text) leading-snug break-words">
                          {name}
                        </span>
                        {user.isCurrentUser && (
                          <span className="text-[9px] font-black px-1.5 py-0.5 rounded-md bg-indigo-600 dark:bg-indigo-500 text-white uppercase tracking-wider shrink-0 shadow-xs">
                            YOU
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right: Primary Highlight Metric (XP or Streak depending on active filter) */}
                  <div className="shrink-0 text-right pt-0.5 sm:pt-0">
                    {filter === "streak" ? (
                      <div className="inline-flex items-center gap-1 font-mono text-xs sm:text-sm font-black text-orange-600 dark:text-orange-400 bg-orange-500/10 dark:bg-orange-500/20 px-2.5 py-1 rounded-xl border border-orange-500/20 whitespace-nowrap">
                        <Flame size={13} className="text-orange-500 fill-orange-500 shrink-0" />
                        <span>{streak}d</span>
                      </div>
                    ) : (
                      <div className="inline-flex items-center gap-1 font-mono text-xs sm:text-sm font-black text-amber-600 dark:text-amber-400 bg-amber-500/10 dark:bg-amber-500/20 px-2.5 py-1 rounded-xl border border-amber-500/20 whitespace-nowrap">
                        <Zap size={13} className="text-amber-500 fill-amber-500 shrink-0" />
                        <span>{xp.toLocaleString()} XP</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Bottom Row (Vertical Space): Level on Left & Secondary Metric on Right */}
                <div className="flex items-center justify-between pt-2 mt-2 border-t border-(--color-border-soft)/50 text-[11px]">
                  <div className="flex items-center gap-1.5">
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-(--color-surface-2) border border-(--color-border-soft) text-[10px] font-semibold text-(--color-text-muted)">
                      <Shield size={10} className="text-indigo-500 shrink-0" />
                      Lvl {level}
                    </span>
                    <span className="text-[10px] font-medium text-(--color-text-faint)">
                      Lifter
                    </span>
                  </div>

                  {/* Secondary Metric - Clean & compact without the word "streak" */}
                  <div className="flex items-center gap-1 font-mono text-[10px] sm:text-[11px] font-bold">
                    {filter === "streak" ? (
                      <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                        <Zap size={11} className="fill-amber-500 text-amber-500 shrink-0" />
                        <span>{xp.toLocaleString()} XP</span>
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-orange-600 dark:text-orange-400 bg-orange-500/10 dark:bg-orange-500/20 px-1.5 py-0.5 rounded-md border border-orange-500/20">
                        <Flame size={11} className="fill-orange-500 text-orange-500 shrink-0" />
                        <span>{streak}d</span>
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
