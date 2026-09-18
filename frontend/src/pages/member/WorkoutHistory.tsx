import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Dumbbell, Calendar, Clock, ChevronLeft, ChevronRight, Loader2, RefreshCw, Activity } from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import { workoutApi, memberApi } from "@/lib/endpoints";
import { useAuthStore } from "@/store/authStore";

export interface WorkoutHistoryProps {
  isEmbedded?: boolean;
  refreshTrigger?: number;
}

export default function WorkoutHistory({ isEmbedded = false, refreshTrigger = 0 }: WorkoutHistoryProps = {}) {
  const user = useAuthStore((s) => s.user);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<any[]>([]);
  const [meta, setMeta] = useState<any | null>(null);
  const [page, setPage] = useState(1);

  const fetchHistory = async (targetPage = 1) => {
    setLoading(true);
    setError(null);
    try {
      const profRes = await memberApi.getSelfProfile().catch(() => null);
      const memberId = profRes?.member?._id || user?._id;

      if (!memberId) {
        setError("Member profile not found.");
        return;
      }

      const res: any = await workoutApi.getHistory(memberId, targetPage, 10);
      const historyList = Array.isArray(res) ? res : res?.logs || [];
      const paginationMeta = res?.meta || res?.pagination || null;

      setLogs(historyList);
      setMeta(paginationMeta);
      setPage(targetPage);
    } catch {
      setError("Failed to load workout history.");
      setLogs([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory(1);
  }, [user, refreshTrigger]);

  const handlePrevPage = () => {
    if (page > 1) fetchHistory(page - 1);
  };

  const handleNextPage = () => {
    if (!meta || meta.hasNextPage || (meta.totalPages && page < meta.totalPages)) {
      fetchHistory(page + 1);
    }
  };

  return (
    <div className="space-y-4 max-w-3xl mx-auto w-full">
      {!isEmbedded && (
        <PageHeader
          title="Workout History"
          subtitle="Review your past completed training sessions"
          backTo="/member"
          action={
            <Link
              to="/member/workout-tracking"
              className="inline-flex items-center gap-1.5 rounded-full bg-(--color-accent) text-(--color-navbar) text-xs font-bold px-3.5 py-2 hover:opacity-90 shadow-sm transition-all"
            >
              <Dumbbell size={14} /> Log Workout
            </Link>
          }
        />
      )}

      {loading ? (
        <Card className="flex items-center justify-center p-12 text-sm text-(--color-text-muted) gap-2">
          <Loader2 className="w-5 h-5 animate-spin text-(--color-accent)" /> Loading workout history...
        </Card>
      ) : error ? (
        <Card className="text-center py-8">
          <p className="text-sm text-(--color-danger) mb-3">{error}</p>
          <button
            onClick={() => fetchHistory(1)}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs rounded-full bg-(--color-surface-3) text-(--color-text)"
          >
            <RefreshCw size={14} /> Retry
          </button>
        </Card>
      ) : logs.length === 0 ? (
        <Card className="text-center py-12 text-(--color-text-muted) space-y-3">
          <Activity className="w-12 h-12 mx-auto text-(--color-text-faint) opacity-60" />
          <p className="text-base font-bold text-(--color-text)">No Workout Sessions Logged Yet</p>
          <p className="text-xs text-(--color-text-muted) max-w-sm mx-auto">
            You haven't logged any completed workouts. Start tracking your sets & reps to build your history!
          </p>
          <Link
            to="/member/workout-tracking"
            className="inline-flex items-center gap-2 rounded-full bg-(--color-accent) text-white text-xs font-bold px-5 py-2.5 shadow-md hover:brightness-110 transition-all mt-2"
          >
            <Dumbbell size={15} /> Log Your First Workout
          </Link>
        </Card>
      ) : (
        <div className="space-y-4">
          {logs.map((log: any) => {
            const logId = log._id || log.id;
            const dayLabel = log.dayLabel || "Custom Workout Session";
            const dateStr = log.startedAt || log.createdAt;
            const formattedDate = dateStr
              ? new Date(dateStr).toLocaleDateString(undefined, {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })
              : "Past Session";
            const formattedTime = dateStr
              ? new Date(dateStr).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })
              : "";

            const exercises = log.exercises || [];
            const totalSets = exercises.reduce((sum: number, ex: any) => sum + (ex.sets?.length || 0), 0);
            const totalVolume = exercises.reduce((sum: number, ex: any) => {
              const exVol = (ex.sets || []).reduce((sSum: number, s: any) => sSum + (s.reps || 0) * (s.weightKg || 0), 0);
              return sum + exVol;
            }, 0);

            return (
              <Card key={logId} className="p-4 space-y-3 hover:border-(--color-border-strong) transition-all">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-(--color-border-soft) pb-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-display text-sm font-extrabold text-(--color-text) truncate">{dayLabel}</span>
                      <Badge tone="good">Completed</Badge>
                    </div>
                    <div className="flex items-center gap-3 text-[11px] text-(--color-text-muted) mt-1">
                      <span className="flex items-center gap-1">
                        <Calendar size={12} className="text-(--color-accent)" /> {formattedDate} {formattedTime && `at ${formattedTime}`}
                      </span>
                      {log.totalDurationMinutes && (
                        <span className="flex items-center gap-1">
                          <Clock size={12} className="text-(--color-accent)" /> {log.totalDurationMinutes} mins
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 text-right self-start sm:self-auto shrink-0 text-xs">
                    <div>
                      <p className="text-[10px] text-(--color-text-faint) uppercase font-bold">Exercises / Sets</p>
                      <p className="font-bold text-(--color-text)">{exercises.length} ex · {totalSets} sets</p>
                    </div>
                    {totalVolume > 0 && (
                      <div>
                        <p className="text-[10px] text-(--color-text-faint) uppercase font-bold">Total Volume</p>
                        <p className="font-bold text-amber-400">{totalVolume.toLocaleString()} kg</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Exercises & Sets List */}
                <div className="space-y-2.5">
                  {exercises.map((ex: any, exIdx: number) => {
                    const exName =
                      typeof ex.exerciseId === "object" && ex.exerciseId?.name
                        ? ex.exerciseId.name
                        : ex.exerciseName || ex.name || "Exercise";
                    const muscleGroup = typeof ex.exerciseId === "object" ? ex.exerciseId?.muscleGroup : undefined;
                    const sets = ex.sets || [];

                    return (
                      <div key={exIdx} className="p-3 rounded-xl bg-(--color-surface-2) border border-(--color-border-soft) space-y-1.5">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 min-w-0">
                            <Dumbbell size={14} className="text-(--color-accent) shrink-0" />
                            <span className="text-xs font-bold text-(--color-text) truncate">{exName}</span>
                            {muscleGroup && (
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-(--color-surface-3) text-(--color-text-muted) capitalize">
                                {muscleGroup}
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] text-(--color-text-muted) shrink-0">{sets.length} sets</span>
                        </div>

                        {/* Sets detail */}
                        <div className="flex flex-wrap gap-2 text-[11px]">
                          {sets.map((s: any, sIdx: number) => (
                            <span
                              key={sIdx}
                              className="px-2 py-1 rounded-lg bg-(--color-surface) border border-(--color-border-soft) text-(--color-text-muted)"
                            >
                              S{s.setNumber || sIdx + 1}: <strong className="text-(--color-text)">{s.reps || 0}</strong> reps {s.weightKg ? `@ ${s.weightKg}kg` : ""}
                            </span>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>
            );
          })}

          {/* Pagination Controls */}
          {meta && (meta.totalPages > 1 || meta.hasNextPage || page > 1) && (
            <div className="flex items-center justify-between pt-2 px-1 text-xs text-(--color-text-muted)">
              <button
                onClick={handlePrevPage}
                disabled={page <= 1}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-(--color-surface-2) border border-(--color-border) text-(--color-text) disabled:opacity-40 disabled:cursor-not-allowed hover:bg-(--color-surface-3) transition-all cursor-pointer"
              >
                <ChevronLeft size={14} /> Previous
              </button>
              <span>
                Page <strong className="text-(--color-text)">{page}</strong> {meta.totalPages ? `of ${meta.totalPages}` : ""}
              </span>
              <button
                onClick={handleNextPage}
                disabled={meta.totalPages ? page >= meta.totalPages : !meta.hasNextPage}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-(--color-surface-2) border border-(--color-border) text-(--color-text) disabled:opacity-40 disabled:cursor-not-allowed hover:bg-(--color-surface-3) transition-all cursor-pointer"
              >
                Next <ChevronRight size={14} />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
