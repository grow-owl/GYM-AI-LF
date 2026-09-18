import { useState, useEffect } from "react";
import { CheckCircle2, QrCode, LogOut, Loader2 } from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import QRScanner from "@/components/member/QRScanner";
import { attendanceApi } from "@/lib/endpoints";
import { useAuthStore } from "@/store/authStore";
import { useAttendanceStore } from "@/store/attendanceStore";
import { toast } from "sonner";
import { showApiErrorToast } from "@/lib/api";

type ScanView = "idle" | "scanning" | "invalid" | "success";

export default function Attendance() {
  const user = useAuthStore((s) => s.user);
  const [view, setView] = useState<ScanView>("idle");
  const [loading, setLoading] = useState(true);
  const [currentSession, setCurrentSession] = useState<any | null>(null);
  const [submittingCheckOut, setSubmittingCheckOut] = useState(false);

  const fetchCurrentSession = async () => {
    setLoading(true);
    try {
      const res = await attendanceApi.getCurrentSession();
      if (res?.session) {
        setCurrentSession(res.session);
      } else {
        setCurrentSession(null);
      }
    } catch {
      setCurrentSession(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCurrentSession();
  }, []);

  const handleScan = async (data: string) => {
    if (!user?.gymId || !user?.branchId) {
      toast.error("User branch context missing");
      return;
    }

    try {
      const payload = data === "MANUAL"
        ? { gymId: user.gymId, branchId: user.branchId, memberId: user._id }
        : { gymId: user.gymId, branchId: user.branchId, qrToken: data };

      const res = await attendanceApi.checkIn(payload);
      const sessionData = res?.checkIn || (res as any)?.attendance;
      if (sessionData) {
        setCurrentSession(sessionData);
        useAttendanceStore.getState().setSession(sessionData);
        window.dispatchEvent(new CustomEvent("gymai:attendance-updated"));
        setView("success");
        toast.success("Checked in successfully! Workout logging unlocked 💪");
      } else {
        setView("invalid");
      }
    } catch (err: any) {
      setView("invalid");
      showApiErrorToast(err, "Check-in rejected: invalid or expired QR token.");
    }
  };

  const handleCheckOut = async () => {
    if (!currentSession) return;
    setSubmittingCheckOut(true);
    try {
      await attendanceApi.checkOut(currentSession._id || currentSession.id);
      toast.success("Checked out! Workout session ended.");
      setCurrentSession(null);
      useAttendanceStore.getState().setSession(null);
      window.dispatchEvent(new CustomEvent("gymai:attendance-updated"));
      setView("idle");
    } catch (err: any) {
      showApiErrorToast(err, "Failed to check out. Please try again.");
    } finally {
      setSubmittingCheckOut(false);
    }
  };

  return (
    <div className="space-y-5 pb-4 md:pb-0 max-w-2xl mx-auto w-full">
      <PageHeader title="GYM ACCESS" subtitle="CHECK IN / OUT" backTo="/member" />

      {loading ? (
        <Card className="flex items-center justify-center p-8 text-sm text-(--color-text-muted) gap-2">
          <Loader2 className="w-4 h-4 animate-spin text-(--color-accent)" /> Checking current session status...
        </Card>
      ) : currentSession ? (
        <Card sweep className="border-emerald-500/30 text-center py-8 px-4 space-y-4">
          <span className="flex h-14 w-14 items-center justify-center mx-auto rounded-full bg-emerald-500/20 text-emerald-400">
            <CheckCircle2 size={32} />
          </span>
          <div>
            <p className="font-display text-xl font-semibold text-(--color-text)">Currently Checked In</p>
            <p className="text-xs text-(--color-text-faint) mt-1">
              Checked in at {new Date(currentSession.checkInAt || currentSession.checkInTime || Date.now()).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </p>
          </div>
          <button
            onClick={handleCheckOut}
            disabled={submittingCheckOut}
            className="w-full rounded-xl bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/30 text-rose-300 text-sm font-semibold py-3 flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
          >
            <LogOut size={16} /> {submittingCheckOut ? "Checking Out..." : "Check Out (End Workout)"}
          </button>
        </Card>
      ) : (
        <Card sweep className="border-(--color-border) px-4 sm:px-5 py-5 sm:py-6">
          {view === "idle" && (
            <div className="space-y-5 text-center">
              <p className="text-sm sm:text-base text-(--color-text-muted)">
                Scan the live QR code at reception or click below to check in.
              </p>

              <button
                onClick={() => setView("scanning")}
                className="w-full rounded-xl bg-(--color-accent) hover:bg-(--color-accent-strong) text-(--color-navbar) text-base sm:text-lg font-semibold py-3.5 flex items-center justify-center gap-2 transition-colors"
              >
                <QrCode size={18} /> Open Camera to Scan
              </button>

              <button
                type="button"
                onClick={() => handleScan("MANUAL")}
                className="inline-flex items-center gap-2 text-sm text-(--color-text-muted) hover:text-(--color-text)"
              >
                Instant One-Tap Check In
              </button>
            </div>
          )}

          {view === "scanning" && (
            <QRScanner onScan={handleScan} onClose={() => setView("idle")} />
          )}

          {view === "invalid" && (
            <div className="flex flex-col items-center text-center py-8">
              <p className="text-sm text-(--color-text)">Could not verify check-in.</p>
              <p className="text-xs text-(--color-text-faint) mt-1">Please try scanning again or ask front desk.</p>
              <button
                onClick={() => setView("scanning")}
                className="mt-5 rounded-full bg-(--color-accent) text-white text-sm font-semibold px-5 py-2.5"
              >
                Try again
              </button>
            </div>
          )}

          {view === "success" && (
            <div className="flex flex-col items-center text-center py-8">
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400">
                <CheckCircle2 size={28} />
              </span>
              <p className="font-display text-lg font-semibold text-(--color-text) mt-4">Checked in!</p>
              <button
                onClick={() => setView("idle")}
                className="mt-6 rounded-full border border-(--color-border) text-(--color-text-muted) text-sm font-medium px-5 py-2.5"
              >
                Done
              </button>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
