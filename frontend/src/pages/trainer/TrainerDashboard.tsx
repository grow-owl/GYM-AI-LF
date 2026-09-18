import { useState, useEffect } from "react";
import { AlertTriangle, CalendarCheck, Loader2, RefreshCw } from "lucide-react";
import { Link } from "react-router-dom";
import QuickAccessCard from "@/components/ui/QuickAccessCard";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import DonutChart from "@/components/ui/DonutChart";
import { trainerApi, attendanceApi } from "@/lib/endpoints";
import { useAuthStore } from "@/store/authStore";
import { formatApiError, showApiErrorToast } from "@/lib/api";

const quickAccess = [
  { label: "My Clients", path: "/trainer/clients", icon: "Users" },
  { label: "Today's Sessions", path: "/trainer/sessions", icon: "CalendarClock" },
  { label: "Workout Plans", path: "/trainer/workout-plans", icon: "Dumbbell" },
  { label: "Diet Plans", path: "/trainer/diet-plans", icon: "Salad" },
  { label: "Progress Tracking", path: "/trainer/progress", icon: "LineChart" },
  { label: "Recovery Alerts", path: "/trainer/recovery-alerts", icon: "HeartPulse", tone: "pink" as const },
];

const statusTone: Record<string, "good" | "danger" | "neutral"> = {
  done: "good",
  completed: "good",
  missed: "danger",
  upcoming: "neutral",
};

export default function TrainerDashboard() {
  const user = useAuthStore((s) => s.user);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [clients, setClients] = useState<any[]>([]);
  const [todayAttendance, setTodayAttendance] = useState<any[]>([]);

  const fetchData = async () => {
    if (!user?.gymId) return;
    setLoading(true);
    setError(null);
    try {
      const [clientRes, attRes] = await Promise.all([
        trainerApi.getMyClients(user.gymId),
        user.branchId ? attendanceApi.getToday(user.gymId, user.branchId).catch(() => null) : Promise.resolve(null),
      ]);

      const cList = Array.isArray(clientRes) ? clientRes : clientRes?.clients || [];
      setClients(cList);

      const aList = Array.isArray(attRes) ? attRes : attRes?.attendance || [];
      setTodayAttendance(aList);
    } catch (err: any) {
      const msg = formatApiError(err, "Failed to load trainer dashboard.");
      setError(msg);
      showApiErrorToast(err, "Failed to load trainer dashboard");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [user]);

  // Match client attendance sessions
  const clientUserIds = new Set(clients.map((c) => c.userId?._id || c.userId));
  const myClientAttendance = todayAttendance.filter((a) => clientUserIds.has(a.memberId?.userId?._id || a.memberId?.userId));

  const doneCount = myClientAttendance.filter((a) => a.status === "CHECKED_OUT" || a.status === "AUTO_CLOSED" || Boolean(a.checkOutAt) || Boolean(a.checkOutTime)).length;
  const inGymCount = myClientAttendance.filter((a) => a.status === "CHECKED_IN" || (!a.checkOutAt && !a.checkOutTime)).length;

  const sessionSegments = [
    { label: "Completed", value: doneCount, color: "var(--tone-green)" },
    { label: "Active in Gym", value: inGymCount, color: "var(--tone-blue)" },
  ];

  return (
    <div className="space-y-6">
      {loading ? (
        <div className="flex items-center justify-center p-12 text-sm text-(--color-text-muted) gap-2">
          <Loader2 className="w-5 h-5 animate-spin text-(--color-accent)" /> Loading trainer dashboard...
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
        <>
          <div className="grid lg:grid-cols-[1.4fr_1fr] gap-4">
            <Card sweep className="flex flex-col justify-center">
              <p className="text-sm text-(--color-text-muted)">Assigned Clients & Today's Activity</p>
              <p className="font-display text-2xl font-semibold text-(--color-text)">
                {clients.length} active client{clients.length === 1 ? "" : "s"}
              </p>
              <p className="text-xs text-(--color-text-faint) mt-1">
                {myClientAttendance.length} client check-in(s) today
              </p>
            </Card>
            <Card>
              <div className="flex items-center gap-2 mb-2">
                <CalendarCheck size={15} className="text-(--tone-blue-text)" />
                <p className="text-xs font-semibold tracking-wide text-(--color-text-faint) uppercase">Client session status</p>
              </div>
              <DonutChart segments={sessionSegments} size={104} thickness={13} />
            </Card>
          </div>

          <div>
            <p className="text-xs font-medium tracking-wide text-(--color-text-faint) uppercase mb-3">Today's Client Attendance & Workouts</p>
            <Card className="p-0 overflow-hidden">
              {myClientAttendance.length === 0 ? (
                <div className="py-8 text-center text-xs text-(--color-text-faint) px-4">
                  No assigned clients checked in yet today.
                </div>
              ) : (
                <div className="divide-y divide-(--color-border-soft)">
                  {myClientAttendance.map((s, idx) => {
                    const clientName = s.memberId?.userId?.fullName || "Client";
                    const rawTime = s.checkInAt || s.checkInTime;
                    const timeStr = rawTime ? new Date(rawTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—";
                    const status = (s.status === "CHECKED_OUT" || s.status === "AUTO_CLOSED" || s.checkOutAt || s.checkOutTime) ? "done" : "in-gym";

                    return (
                      <div key={s._id || idx} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-4 sm:px-5 py-3.5 hover:bg-(--color-surface-2) transition-colors">
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="font-mono text-xs text-(--color-text-faint) w-16 shrink-0">{timeStr}</span>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-(--color-text) truncate">{clientName}</p>
                            <p className="text-xs text-(--color-text-faint) truncate">Check-in Session</p>
                          </div>
                        </div>
                        <Badge tone={statusTone[status] ?? "neutral"} className="self-start sm:self-auto shrink-0">{status}</Badge>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          </div>
        </>
      )}

      <div>
        <p className="text-xs font-medium tracking-wide text-(--color-text-faint) uppercase mb-3">Quick access</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {quickAccess.map((item) => (
            <QuickAccessCard key={item.path} {...item} />
          ))}
        </div>
      </div>

      <div>
        <p className="text-xs font-medium tracking-wide text-(--color-text-faint) uppercase mb-3">Client attention required</p>
        <Card className="border-(--color-border) bg-(--color-surface)">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle size={15} className="text-(--color-accent)" />
            <p className="text-xs font-semibold text-(--color-accent-text) uppercase tracking-wide">Client Recovery & Goals</p>
          </div>
          <p className="text-sm font-medium text-(--color-text)">
            {clients.length > 0 ? `${clients.length} Active Clients Under Your Guidance` : "No Assigned Clients"}
          </p>
          <p className="text-xs text-(--color-text-faint) mb-3">
            Review your assigned client list and progress tracking for customized workout plans.
          </p>
          <Link
            to="/trainer/clients"
            className="inline-flex items-center rounded-full bg-(--color-surface-3) text-(--color-text) text-xs font-medium px-3.5 py-1.5 hover:bg-(--color-surface-2) transition-colors"
          >
            View clients
          </Link>
        </Card>
      </div>
    </div>
  );
}
