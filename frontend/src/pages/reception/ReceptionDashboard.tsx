import { useState, useEffect } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import KpiCard from "@/components/ui/KpiCard";
import QuickAccessCard from "@/components/ui/QuickAccessCard";
import Card from "@/components/ui/Card";
import { useAuthStore } from "@/store/authStore";
import { reportApi, attendanceApi } from "@/lib/endpoints";
import { formatApiError, showApiErrorToast } from "@/lib/api";

const quickAccess = [
  { label: "Add & Manage Members", path: "/reception/members", icon: "Users", tone: "accent" as const },
  { label: "Store & POS Sales", path: "/reception/inventory", icon: "Package" },
  { label: "Check-in Desk", path: "/reception/check-in", icon: "QrCode" },
  { label: "Record Payments", path: "/reception/payments", icon: "CreditCard" },
];

export default function ReceptionDashboard() {
  const user = useAuthStore((s) => s.user);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [todayCheckIns, setTodayCheckIns] = useState(0);
  const [currentlyIn, setCurrentlyIn] = useState(0);

  const fetchOverview = () => {
    if (!user?.gymId) return;
    setLoading(true);
    setError(null);
    Promise.all([
      reportApi.getOverview(user.gymId, user.branchId ?? undefined),
      user.branchId ? attendanceApi.getToday(user.gymId, user.branchId).catch(() => null) : Promise.resolve(null),
    ])
      .then(([ovRes, attRes]) => {
        const attList = Array.isArray(attRes) ? attRes : attRes?.attendance || [];
        setTodayCheckIns(Math.max(ovRes?.todayCheckIns ?? 0, attList.length));
        setCurrentlyIn(
          attList.filter(
            (a: any) =>
              a.status === "CHECKED_IN" || (!a.checkOutAt && !a.checkOutTime && a.status !== "CHECKED_OUT" && a.status !== "AUTO_CLOSED")
          ).length
        );
      })
      .catch((err: any) => {
        const msg = formatApiError(err, "Failed to load reception desk overview");
        setError(msg);
        showApiErrorToast(err, "Failed to load reception desk overview");
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchOverview();
  }, [user]);

  const kpis = [
    { label: "Checked in today", value: String(todayCheckIns), icon: "QrCode", tone: "blue" as const },
    { label: "Currently in gym", value: String(currentlyIn), icon: "Users", tone: "green" as const },
  ];

  return (
    <div className="space-y-6">
      {error && (
        <Card className="text-center py-4 border-rose-500/20 bg-rose-500/5">
          <p className="text-xs text-(--color-danger) mb-2">{error}</p>
          <button
            onClick={fetchOverview}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-full bg-(--color-surface-2) text-(--color-text) hover:bg-(--color-surface-3)"
          >
            <RefreshCw size={13} /> Retry Overview
          </button>
        </Card>
      )}

      {loading ? (
        <div className="flex items-center justify-center p-8 text-sm text-(--color-text-muted) gap-2">
          <Loader2 className="w-4 h-4 animate-spin text-(--color-accent)" /> Loading reception desk overview...
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          {kpis.map((k) => (
            <KpiCard key={k.label} {...k} />
          ))}
        </div>
      )}

      <div>
        <p className="text-xs font-medium tracking-wide text-(--color-text-faint) uppercase mb-3">Quick access</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {(user?.role === "KIOSK"
            ? quickAccess.filter((item) => item.path !== "/reception/payments")
            : quickAccess
          ).map((item) => (
            <QuickAccessCard key={item.label + item.path} {...item} />
          ))}
        </div>
      </div>
    </div>
  );
}
