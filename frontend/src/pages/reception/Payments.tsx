import { useState, useEffect } from "react";
import { Plus, Loader2, RefreshCw, CreditCard } from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Modal from "@/components/ui/Modal";
import CustomSelect from "@/components/ui/CustomSelect";
import { paymentApi, memberApi } from "@/lib/endpoints";
import { useAuthStore } from "@/store/authStore";
import { toast } from "sonner";
import { formatApiError, showApiErrorToast } from "@/lib/api";

export default function ReceptionPayments() {
  const user = useAuthStore((s) => s.user);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [payments, setPayments] = useState<any[]>([]);
  const [membersList, setMembersList] = useState<any[]>([]);

  // Modal state
  const [showRecordModal, setShowRecordModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    memberId: "",
    amount: 1500,
    purpose: "membership_fee",
    method: "cash",
    notes: "",
    triggerRenewal: true,
  });

  const fetchData = async () => {
    if (!user?.gymId) return;
    setLoading(true);
    setError(null);
    try {
      const [payRes, memRes] = await Promise.all([
        paymentApi.listMemberPayments(user.gymId),
        memberApi.list(user.gymId, user.branchId || undefined).catch(() => []),
      ]);

      const paymentArray = Array.isArray(payRes) ? payRes : payRes?.payments || [];
      setPayments(paymentArray);

      const mList = Array.isArray(memRes) ? memRes : memRes?.members || [];
      setMembersList(mList);
    } catch (err: any) {
      setError(formatApiError(err, "Failed to load payments data."));
      showApiErrorToast(err, "Failed to load payments");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [user]);

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    const activeGymId = user?.gymId || "";
    if (!formData.memberId) {
      toast.error("Please select a member");
      return;
    }
    setSubmitting(true);
    const selectedMem = membersList.find((m) => m._id === formData.memberId || m.id === formData.memberId);
    const memName = selectedMem?.fullName || selectedMem?.name || selectedMem?.userId?.fullName || "Gym Member";

    try {
      const res = await paymentApi.recordMemberPayment(activeGymId, {
        ...formData,
        branchId: user?.branchId || "",
      });

      const recordedPayment = (res as any)?.payment || res || {
        _id: `pay-${Date.now()}`,
        amount: formData.amount,
        purpose: formData.purpose,
        method: formData.method,
        notes: formData.notes,
        createdAt: new Date().toISOString(),
        memberId: { fullName: memName },
      };

      setPayments((prev) => [recordedPayment, ...prev]);
      toast.success(`Payment of ₹${Number(formData.amount).toLocaleString("en-IN")} recorded for ${memName}!`);
      setShowRecordModal(false);
      fetchData();
    } catch (err: any) {
      showApiErrorToast(err, "Failed to record payment");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Payments"
        subtitle="Collect & record member payments at front desk"
        backTo="/reception"
        action={
          <button
            onClick={() => setShowRecordModal(true)}
            className="inline-flex items-center gap-1.5 rounded-full bg-(--color-accent) text-(--color-navbar) text-sm font-bold px-4 py-2 hover:opacity-90 transition-opacity"
          >
            <Plus size={15} /> Collect Payment
          </button>
        }
      />

      {loading ? (
        <div className="flex items-center justify-center p-12 text-sm text-(--color-text-muted) gap-2">
          <Loader2 className="w-5 h-5 animate-spin text-(--color-accent)" /> Loading payments...
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
      ) : payments.length === 0 ? (
        <Card className="flex flex-col items-center justify-center py-12 text-center">
          <CreditCard className="w-8 h-8 text-(--color-text-faint) mb-2 opacity-50" />
          <p className="text-sm font-medium text-(--color-text)">No payment entries recorded</p>
          <p className="text-xs text-(--color-text-faint) mt-1 max-w-xs">
            Record member cash, UPI, or bank transfer payments directly here.
          </p>
          <button
            onClick={() => setShowRecordModal(true)}
            className="mt-4 inline-flex items-center gap-1 text-xs font-medium text-(--color-accent-text) hover:underline"
          >
            <Plus size={13} /> Collect first payment
          </button>
        </Card>
      ) : (
        <div className="space-y-3">
          {payments.map((p) => {
            const memberName = p.memberId?.userId?.fullName || p.memberName || "Member";
            const plan = p.memberId?.planName || p.purpose || "Fee";
            const status = p.status || "SUCCESS";

            return (
              <Card key={p._id || p.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-(--color-text) truncate">{memberName}</p>
                  <p className="text-xs text-(--color-text-faint) mt-0.5 truncate">
                    {plan} · ₹{p.amount?.toLocaleString("en-IN")} ({p.method || "cash"})
                  </p>
                </div>
                <Badge tone={status === "REFUNDED" ? "danger" : "good"} className="self-start sm:self-auto shrink-0">
                  {status === "REFUNDED" ? "Refunded" : "Paid"}
                </Badge>
              </Card>
            );
          })}
        </div>
      )}

      {/* Manual Payment Modal */}
      {showRecordModal && (
        <Modal onClose={() => setShowRecordModal(false)} maxWidth="md" title="Record Front-Desk Payment">
          <form onSubmit={handleRecordPayment} className="space-y-3">
            <div>
              {membersList.length > 0 ? (
                <CustomSelect
                  label="Member"
                  value={formData.memberId}
                  onChange={(v) => setFormData({ ...formData, memberId: v })}
                  placeholder="Select a member..."
                  options={membersList.map((m) => ({
                    value: String(m._id || m.id),
                    label: `${m.userId?.fullName || m.fullName || m.name || "Member"} (${m.planName || m.plan || "Plan"})`,
                  }))}
                />
              ) : (
                <div>
                  <label className="text-xs text-(--color-text-muted)">Member</label>
                  <input
                    required
                    value={formData.memberId}
                    onChange={(e) => setFormData({ ...formData, memberId: e.target.value })}
                    placeholder="Enter Member ID"
                    className="w-full mt-1 p-2 rounded-lg bg-(--color-surface-2) border border-(--color-border) text-sm text-(--color-text) outline-none"
                  />
                </div>
              )}
            </div>

            <div>
              <label className="text-xs text-(--color-text-muted)">Amount (₹)</label>
              <input
                type="number"
                required
                min={1}
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: Number(e.target.value) })}
                className="w-full mt-1 p-2 rounded-lg bg-(--color-surface-2) border border-(--color-border) text-sm text-(--color-text) outline-none"
              />
            </div>

            <CustomSelect
              label="Purpose"
              value={formData.purpose}
              onChange={(v) => setFormData({ ...formData, purpose: v })}
              options={[
                { value: "membership_fee", label: "Membership Fee" },
                { value: "personal_training", label: "Personal Training" },
                { value: "merchandise", label: "Merchandise" },
                { value: "other", label: "Other" },
              ]}
            />

            <CustomSelect
              label="Method"
              value={formData.method}
              onChange={(v) => setFormData({ ...formData, method: v })}
              options={[
                { value: "cash", label: "Cash" },
                { value: "upi", label: "UPI" },
                { value: "bank_transfer", label: "Bank Transfer" },
                { value: "card", label: "Card (POS)" },
              ]}
            />

            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="receptionTriggerRenewal"
                checked={formData.triggerRenewal}
                onChange={(e) => setFormData({ ...formData, triggerRenewal: e.target.checked })}
                className="rounded border-(--color-border)"
              />
              <label htmlFor="receptionTriggerRenewal" className="text-xs text-(--color-text)">
                Trigger 1-month membership renewal
              </label>
            </div>

            <div className="flex justify-end gap-2 pt-3">
              <button
                type="button"
                onClick={() => setShowRecordModal(false)}
                className="px-4 py-2 text-xs font-medium text-(--color-text-muted)"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-2 text-xs font-bold rounded-full bg-(--color-accent) text-(--color-navbar) disabled:opacity-50"
              >
                {submitting ? "Saving..." : "Record Payment"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
