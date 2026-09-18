import { useState, useEffect } from "react";
import { Loader2, RefreshCw, CreditCard } from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import { paymentApi, memberApi } from "@/lib/endpoints";
import { useAuthStore } from "@/store/authStore";

import { formatApiError, showApiErrorToast } from "@/lib/api";

export default function MemberPayments() {
  const user = useAuthStore((s) => s.user);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [payments, setPayments] = useState<any[]>([]);

  const fetchMyPayments = async () => {
    setLoading(true);
    setError(null);
    try {
      let activeGymId = user?.gymId;
      if (!activeGymId) {
        const prof = await memberApi.getSelfProfile().catch(() => null);
        activeGymId = prof?.member?.gymId;
      }
      if (!activeGymId) {
        setLoading(false);
        setError("Unable to resolve your gym membership. Please contact front desk staff.");
        return;
      }

      const res = await paymentApi.getMyPayments(activeGymId);
      const list = Array.isArray(res) ? res : res?.payments || [];
      setPayments(list);
    } catch (err) {
      const msg = formatApiError(err, "Failed to load your payment history.");
      setError(msg);
      showApiErrorToast(err, "Failed to load your payment history");
      setPayments([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMyPayments();
  }, [user]);

  return (
    <div className="space-y-4 max-w-2xl mx-auto w-full">
      <PageHeader title="Payment History" subtitle="Your gym membership payment receipts" backTo="/member" />

      {loading ? (
        <div className="flex items-center justify-center p-12 text-sm text-(--color-text-muted) gap-2">
          <Loader2 className="w-5 h-5 animate-spin text-(--color-accent)" /> Loading your payments...
        </div>
      ) : error ? (
        <Card className="text-center py-8">
          <p className="text-sm text-(--color-danger) mb-3">{error}</p>
          <button
            onClick={fetchMyPayments}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs rounded-full bg-(--color-surface-3) text-(--color-text)"
          >
            <RefreshCw size={14} /> Retry
          </button>
        </Card>
      ) : payments.length === 0 ? (
        <Card className="flex flex-col items-center justify-center py-12 text-center">
          <CreditCard className="w-8 h-8 text-(--color-text-faint) mb-2 opacity-50" />
          <p className="text-sm font-medium text-(--color-text)">No payment history found</p>
          <p className="text-xs text-(--color-text-faint) mt-1 max-w-xs">
            Payment records will appear here when front-desk staff processes your membership fees or purchases.
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {payments.map((p) => {
            const purpose = (p.purpose || "Membership Fee").replace("_", " ");
            const method = (p.method || "Cash").toUpperCase();
            const dateStr = p.paidAt ? new Date(p.paidAt).toLocaleDateString() : "Recent";
            const status = p.status || "SUCCESS";

            return (
              <Card key={p._id || p.id} className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-(--color-text) capitalize">{purpose}</p>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-(--color-surface-3) font-mono text-(--color-text-muted)">
                      {p.invoiceNumber}
                    </span>
                  </div>
                  <p className="text-xs text-(--color-text-faint) mt-0.5">
                    {dateStr} · Method: {method}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-mono text-sm font-semibold text-(--color-text)">
                    ₹{p.amount?.toLocaleString("en-IN")}
                  </span>
                  <Badge tone={status === "REFUNDED" ? "danger" : "good"}>
                    {status === "REFUNDED" ? "Refunded" : "Paid"}
                  </Badge>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
