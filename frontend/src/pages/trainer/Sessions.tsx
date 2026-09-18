import { useState, useEffect } from "react";
import { Loader2, RefreshCw, CalendarClock } from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import { attendanceApi, trainerApi } from "@/lib/endpoints";
import { useAuthStore } from "@/store/authStore";
import { formatApiError, showApiErrorToast } from "@/lib/api";

export default function Sessions() {
  const user = useAuthStore((s) => s.user);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sessions, setSessions] = useState<any[]>([]);

  const fetchSessions = async () => {
    if (!user?.gymId || !user?.branchId) return;
    setLoading(true);
    setError(null);
    try {
      const [attRes, clientRes] = await Promise.all([
        attendanceApi.getToday(user.gymId, user.branchId),
        trainerApi.getMyClients(user.gymId),
      ]);

      const attList = Array.isArray(attRes) ? attRes : attRes?.attendance || [];
      const clientList = Array.isArray(clientRes) ? clientRes : clientRes?.clients || [];
      const clientUserIds = new Set(clientList.map((c: any) => c.userId?._id || c.userId));

      const mySessions = attList.filter((a: any) => clientUserIds.has(a.memberId?.userId?._id || a.memberId?.userId));
      setSessions(mySessions);
    } catch (err: any) {
      const msg = formatApiError(err, "Failed to load today's sessions.");
      setError(msg);
      showApiErrorToast(err, "Failed to load today's sessions");
      setSessions([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSessions();
  }, [user]);

  const todayStr = new Date().toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "short" });

  return (
    <div>
      <PageHeader title="Today's Sessions" subtitle={todayStr} backTo="/trainer" />

      {loading ? (
        <div className="flex items-center justify-center p-12 text-sm text-(--color-text-muted) gap-2">
          <Loader2 className="w-5 h-5 animate-spin text-(--color-accent)" /> Loading sessions...
        </div>
      ) : error ? (
        <Card className="text-center py-8">
          <p className="text-sm text-(--color-danger) mb-3">{error}</p>
          <button
            onClick={fetchSessions}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs rounded-full bg-(--color-surface-3) text-(--color-text)"
          >
            <RefreshCw size={14} /> Retry
          </button>
        </Card>
      ) : sessions.length === 0 ? (
        <Card className="flex flex-col items-center justify-center py-12 text-center">
          <CalendarClock className="w-8 h-8 text-(--color-text-faint) mb-2 opacity-50" />
          <p className="text-sm font-medium text-(--color-text)">No client sessions or check-ins today</p>
          <p className="text-xs text-(--color-text-faint) mt-1 max-w-xs">
            When your assigned clients scan in for workouts, their live sessions will show here.
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {sessions.map((s, idx) => {
            const clientName = s.memberId?.userId?.fullName || "Client";
            const rawTime = s.checkInAt || s.checkInTime;
            const timeStr = rawTime ? new Date(rawTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—";
            const status = (s.status === "CHECKED_OUT" || s.status === "AUTO_CLOSED" || s.checkOutAt || s.checkOutTime) ? "done" : "active";

            return (
              <Card key={s._id || idx} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="font-mono text-xs text-(--color-text-faint) w-16 shrink-0">{timeStr}</span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-(--color-text) truncate">{clientName}</p>
                    <p className="text-xs text-(--color-text-faint) truncate">Check-in Session</p>
                  </div>
                </div>
                <Badge tone={status === "done" ? "good" : "neutral"} className="self-start sm:self-auto shrink-0">{status}</Badge>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
