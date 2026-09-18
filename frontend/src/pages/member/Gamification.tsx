import { useState, useEffect } from "react";
import { Trophy, Flame, Loader2, RefreshCw, Flag } from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import StreakGamificationHub from "@/components/member/StreakGamificationHub";
import { gamificationApi } from "@/lib/endpoints";
import { useAuthStore } from "@/store/authStore";
import { toast } from "sonner";

export default function Gamification() {
  const user = useAuthStore((s) => s.user);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [challenges, setChallenges] = useState<any[]>([]);
  const [gameProfile, setGameProfile] = useState<any | null>(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [lbRes, chRes, profRes] = await Promise.all([
        gamificationApi.getLeaderboard(user?.gymId),
        gamificationApi.listChallenges(user?.gymId).catch(() => null),
        gamificationApi.getMyProfile().catch(() => null),
      ]);

      const lbList = Array.isArray(lbRes) ? lbRes : (lbRes as any)?.leaderboard || [];
      setLeaderboard(lbList);

      const chList = Array.isArray(chRes) ? chRes : (chRes as any)?.challenges || [];
      setChallenges(chList);

      if (profRes) {
        const prof = (profRes as any)?.profile || (profRes as any)?.gameProfile || profRes;
        setGameProfile(prof);
      }
    } catch (err: any) {
      console.error("Failed to load gamification data:", err);
      setError(
        err?.response?.data?.message ||
        err?.message ||
        "Failed to load leaderboard data from server. Please check your network or try again."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [user]);

  const handleJoinChallenge = async (id: string) => {
    try {
      await gamificationApi.joinChallenge(id);
      toast.success("Joined challenge successfully!");
      fetchData();
    } catch (err: any) {
      const errMsg = err?.response?.data?.message || err?.message || "Failed to join challenge.";
      toast.error(errMsg);
    }
  };

  const myItem = leaderboard.find(
    (item) => item.memberId === user?._id || item.name === user?.name || item.name === (user as any)?.fullName
  );
  const myRank = myItem ? leaderboard.indexOf(myItem) + 1 : null;

  return (
    <div className="space-y-5 max-w-2xl mx-auto w-full">
      <PageHeader title="Leaderboard & Challenges" subtitle="Compete with gym members" backTo="/member" />

      {loading ? (
        <Card className="flex items-center justify-center p-12 text-sm text-(--color-text-muted) gap-2">
          <Loader2 className="w-5 h-5 animate-spin text-(--color-accent)" /> Loading leaderboard...
        </Card>
      ) : error ? (
        <Card className="text-center py-8">
          <p className="text-sm text-(--color-danger) mb-3">{error}</p>
          <button
            onClick={fetchData}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs rounded-full bg-(--color-surface-3) text-(--color-text) hover:bg-(--color-surface-2) transition-colors cursor-pointer"
          >
            <RefreshCw size={14} /> Retry
          </button>
        </Card>
      ) : (
        <>
          {/* Main Interactive Streak & Gamification Hub */}
          <StreakGamificationHub gameProfile={gameProfile} onProfileUpdate={fetchData} />

          {/* User's Own Standing Card */}
          {myItem && (
            <Card sweep className="p-4 bg-gradient-to-br from-amber-500/10 via-(--color-surface) to-(--color-surface-2) border-amber-500/30">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-11 w-11 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 font-display font-extrabold text-base">
                    #{myRank}
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider block">Your Standing</span>
                    <p className="text-sm sm:text-base font-bold text-(--color-text)">{myItem.name || "You"}</p>
                    <p className="text-xs text-(--color-text-muted)">Level {myItem.level || 1} Athlete</p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="flex items-center gap-1.5 justify-end text-amber-400">
                    <Flame size={16} />
                    <span className="font-display text-xl font-bold text-(--color-text)">
                      {(myItem.score ?? myItem.xp ?? myItem.points ?? 0).toLocaleString()}
                    </span>
                    <span className="text-xs font-bold text-amber-400">XP</span>
                  </div>
                  <p className="text-[11px] text-(--color-text-faint) mt-0.5">
                    {myItem.currentStreakDays || 0} Day Streak
                  </p>
                </div>
              </div>
            </Card>
          )}

          {/* Leaderboard Section */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Trophy size={16} className="text-amber-400" />
              <p className="text-xs font-semibold uppercase tracking-wide text-(--color-text-faint)">Gym Leaderboard</p>
            </div>

            <Card className="p-0 overflow-hidden">
              {leaderboard.length === 0 ? (
                <div className="py-8 text-center text-xs text-(--color-text-faint) px-4">
                  No leaderboard rankings recorded yet.
                </div>
              ) : (
                <div className="divide-y divide-(--color-border-soft)">
                  {leaderboard.map((item, index) => {
                    const isMe = item.memberId === user?._id || item.name === user?.name || item.name === (user as any)?.fullName;
                    const itemScore = item.score ?? item.xp ?? item.points ?? 0;

                    return (
                      <div
                        key={item.memberId || item._id || index}
                        className={`flex items-center justify-between px-5 py-3.5 transition-colors ${
                          isMe ? "bg-amber-500/10 border-l-3 border-amber-500" : "hover:bg-(--color-surface-2)"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span className={`font-mono text-sm font-bold w-6 ${index === 0 ? "text-amber-400" : index === 1 ? "text-slate-300" : index === 2 ? "text-amber-600" : "text-(--color-text-muted)"}`}>
                            #{index + 1}
                          </span>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-medium text-(--color-text)">{item.userName || item.name || "Member"}</p>
                              {isMe && (
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30">
                                  You
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-(--color-text-faint)">Level {item.level || 1}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Flame size={14} className="text-amber-400" />
                          <span className="font-mono text-sm font-semibold text-(--color-text)">
                            {itemScore.toLocaleString()} XP
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          </div>

          {/* Active Challenges Section */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center gap-2">
              <Flag size={16} className="text-(--color-accent)" />
              <p className="text-xs font-semibold uppercase tracking-wide text-(--color-text-faint)">Active Challenges</p>
            </div>

            {challenges.length === 0 ? (
              <Card className="py-8 text-center text-xs text-(--color-text-faint)">
                No active challenges available right now.
              </Card>
            ) : (
              <div className="space-y-3">
                {challenges.map((c) => {
                  const daysLeft = c.endDate
                    ? Math.max(0, Math.ceil((new Date(c.endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
                    : 0;
                  const hasJoined = Boolean(c.hasJoined);

                  return (
                    <Card key={c._id || c.id} className="flex items-center justify-between p-4">
                      <div className="space-y-1">
                        <p className="text-sm font-semibold text-(--color-text)">{c.title || c.name}</p>
                        <p className="text-xs text-(--color-text-faint)">{c.description || "Gym fitness challenge"}</p>
                        <div className="flex items-center gap-3 pt-1 text-[11px] text-(--color-text-muted)">
                          <span>Target: <strong>{c.targetValue || 1}</strong> {c.metric ? c.metric.replace("_", " ") : ""}</span>
                          <span>Reward: <strong className="text-amber-400">+{c.rewardXp || 500} XP</strong></span>
                          <span>{daysLeft} days remaining</span>
                        </div>
                      </div>

                      {hasJoined ? (
                        <div className="text-right">
                          <span className="px-3 py-1.5 text-xs font-semibold rounded-full bg-(--color-surface-3) text-(--color-text-muted) inline-block">
                            Joined ({c.userProgress || 0}/{c.targetValue || 1})
                          </span>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleJoinChallenge(c._id || c.id)}
                          className="px-3.5 py-1.5 text-xs font-medium rounded-full bg-(--color-accent) text-white hover:opacity-90 shrink-0"
                        >
                          Join Challenge
                        </button>
                      )}
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
