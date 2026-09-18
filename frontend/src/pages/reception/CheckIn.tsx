import { useState, useEffect, useCallback } from "react";
import { QrCode, ShieldCheck, CheckCircle2, RefreshCw, Loader2 } from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import { attendanceApi } from "@/lib/endpoints";
import { useAuthStore } from "@/store/authStore";
import { toast } from "sonner";
import QRCode from "qrcode";
import type { IAttendanceCheckInResponse } from "@/types";
import { formatApiError } from "@/lib/api";

export default function CheckIn() {
  const user = useAuthStore((s) => s.user);
  const [identifier, setIdentifier] = useState("");
  const [loading, setLoading] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);
  const [qrLoading, setQrLoading] = useState(true);
  const [countdown, setCountdown] = useState(25);
  const [ttl, setTtl] = useState(25);

  const fetchKioskQr = useCallback(async () => {
    if (!user?.gymId || !user?.branchId) {
      setQrLoading(false);
      return;
    }
    try {
      setQrLoading(true);
      const res = await attendanceApi.generateQR(user.gymId, user.branchId, 25);
      if (res?.qrCodeDataUrl) {
        setQrCodeUrl(res.qrCodeDataUrl);
      } else if (res?.qrToken) {
        const url = await QRCode.toDataURL(res.qrToken);
        setQrCodeUrl(url);
      }
      const newTtl = res?.ttlSeconds || 25;
      setTtl(newTtl);
      setCountdown(newTtl);
    } catch (err: unknown) {
      console.error("Failed to generate dynamic kiosk QR:", err);
    } finally {
      setQrLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchKioskQr();
  }, [fetchKioskQr]);

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          fetchKioskQr();
          return ttl;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [fetchKioskQr, ttl]);

  const handleManualCheckIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier.trim()) return;
    setLoading(true);
    try {
      let res: IAttendanceCheckInResponse | null = null;
      if (user?.gymId && user?.branchId) {
        res = await attendanceApi.checkIn({ gymId: user.gymId, branchId: user.branchId, identifier: identifier.trim() });
      } else {
        res = await attendanceApi.checkIn({ identifier: identifier.trim() });
      }
      const memberName = res?.attendance?.memberId?.userId?.fullName || res?.checkIn?.memberId?.userId?.fullName || res?.attendance?.memberName || identifier;
      const streak = res?.streakCount || res?.checkIn?.streakCount;
      const streakText = streak ? ` 🔥 ${streak}-day streak!` : "";
      toast.success(`Check-in verified for ${memberName}!${streakText} Access Granted.`);
      setIdentifier("");
    } catch (err: any) {
      const msg = formatApiError(err, `Check-in failed for ${identifier}. Member not found or membership invalid.`);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader title="Member Attendance Check-In" subtitle="Live Rotating Kiosk QR & Reception Verification" backTo="/reception" />

      <Card sweep className="border-(--color-accent)/25 max-w-xl mx-auto">
        <div className="flex flex-col items-center text-center py-6">
          {/* Live Dynamic Kiosk QR Display */}
          <div className="relative flex flex-col items-center">
            <div className="h-48 w-48 rounded-2xl border-2 border-(--color-accent)/40 flex items-center justify-center mb-2 bg-white p-3 shadow-lg relative overflow-hidden">
              {qrLoading && !qrCodeUrl ? (
                <div className="flex flex-col items-center text-gray-500 gap-2">
                  <Loader2 className="animate-spin text-(--color-accent)" size={28} />
                  <span className="text-xs">Generating QR...</span>
                </div>
              ) : qrCodeUrl ? (
                <img src={qrCodeUrl} alt="Live Kiosk QR Code" className="w-full h-full object-contain" />
              ) : (
                <QrCode size={64} className="text-gray-400" />
              )}
            </div>

            <div className="flex items-center gap-2 mb-4">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-semibold">
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" /> Live Kiosk QR (Rotates in {countdown}s)
              </span>
              <button
                onClick={fetchKioskQr}
                disabled={qrLoading}
                title="Refresh QR Code"
                className="p-1 rounded-lg text-(--color-text-muted) hover:text-(--color-text) transition-colors"
              >
                <RefreshCw size={14} className={qrLoading ? "animate-spin" : ""} />
              </button>
            </div>
          </div>

          <p className="font-display text-lg font-semibold text-(--color-text)">Kiosk & Reception Check-in</p>
          <p className="mt-1 text-xs text-(--color-text-muted) max-w-md">
            Members can scan this dynamic QR code using their member app camera, or front desk staff can enter Phone / Member ID below.
          </p>

          <form onSubmit={handleManualCheckIn} className="mt-6 w-full max-w-sm flex items-center gap-2">
            <input
              required
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="Enter Phone or Member ID..."
              className="flex-1 px-4 py-2.5 rounded-full border border-(--color-border) bg-(--color-surface-2) text-sm text-(--color-text) outline-none focus:border-(--color-accent)"
            />
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2.5 rounded-full bg-(--color-accent) text-(--color-navbar) text-xs font-bold hover:opacity-90 flex items-center gap-1 shrink-0 disabled:opacity-50"
            >
              {loading ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />} Verify
            </button>
          </form>

          <div className="mt-8 grid gap-3 w-full sm:grid-cols-2">
            <div className="rounded-2xl border border-(--color-border) bg-(--color-surface) p-4 flex items-center gap-3">
              <QrCode size={20} className="text-(--color-accent)" />
              <div className="text-left">
                <p className="text-xs font-medium text-(--color-text)">Auto-Rotating QR</p>
                <p className="text-[11px] text-(--color-text-faint)">Valid for 25s (Single-use)</p>
              </div>
            </div>
            <div className="rounded-2xl border border-(--color-border) bg-(--color-surface) p-4 flex items-center gap-3">
              <ShieldCheck size={20} className="text-emerald-400" />
              <div className="text-left">
                <p className="text-xs font-medium text-(--color-text)">Manual Verification</p>
                <p className="text-[11px] text-(--color-text-faint)">Front-desk manual check</p>
              </div>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}