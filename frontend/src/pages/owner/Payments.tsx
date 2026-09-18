import { useState, useEffect } from "react";
import { Plus, Loader2, RefreshCw, CreditCard, Pencil, Trash2, User, Phone, ShoppingBag } from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import CustomSelect from "@/components/ui/CustomSelect";
import Modal from "@/components/ui/Modal";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import { paymentApi, memberApi } from "@/lib/endpoints";
import { useGymBranch } from "@/hooks/useGymBranch";
import { useAuthStore } from "@/store/authStore";
import { toast } from "sonner";
import { formatApiError, showApiErrorToast } from "@/lib/api";

const paymentMethodOptions = [
  { value: "cash", label: "Cash" },
  { value: "upi", label: "UPI / QR Code" },
  { value: "card", label: "Credit / Debit Card" },
  { value: "bank_transfer", label: "Bank Transfer" },
];

const purposeOptions = [
  { value: "membership_fee", label: "Membership Fee" },
  { value: "personal_training", label: "Personal Training Pack" },
  { value: "merchandise", label: "Store / Supplement Purchase" },
  { value: "other", label: "Other Payment" },
];

export default function Payments() {
  const currentUserRole = useAuthStore((s) => s.user?.role);
  const isOwnerOrAdmin =
    currentUserRole === "GYM_OWNER" ||
    currentUserRole === "SUPER_ADMIN" ||
    currentUserRole === "BRANCH_MANAGER";
  const { gymId, branchId, loading: resolvingBranch } = useGymBranch();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [payments, setPayments] = useState<any[]>([]);
  const [summary, setSummary] = useState<{ total: number; transactions: number }>({ total: 0, transactions: 0 });
  const [membersList, setMembersList] = useState<any[]>([]);

  // Modal state
  const [showRecordModal, setShowRecordModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [customerType, setCustomerType] = useState<"member" | "walk_in">("member");
  const [walkInName, setWalkInName] = useState("");
  const [walkInPhone, setWalkInPhone] = useState("");
  const [formData, setFormData] = useState({
    memberId: "",
    amount: 1500,
    purpose: "membership_fee",
    method: "cash",
    notes: "",
    triggerRenewal: false,
    renewMonths: 1,
  });

  const [showEditModal, setShowEditModal] = useState(false);
  const [submittingEdit, setSubmittingEdit] = useState(false);
  const [editData, setEditData] = useState({
    paymentId: "",
    customerName: "",
    amount: 1500,
    purpose: "membership_fee",
    method: "cash",
    notes: "",
  });

  const fetchData = async () => {
    const activeGymId = gymId || "";
    const activeBranchId = branchId || "";
    if (!activeGymId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const [sumRes, payRes, memRes] = await Promise.all([
        paymentApi.getRevenueSummary(activeGymId).catch(() => null),
        paymentApi.listMemberPayments(activeGymId),
        memberApi.list(activeGymId, activeBranchId).catch(() => null),
      ]);

      const paymentArray: any[] = Array.isArray(payRes) ? (payRes as any[]) : (payRes?.payments || []);
      setPayments(paymentArray);

      let totalRevenue = sumRes?.summary?.total;
      if (typeof totalRevenue !== "number") {
        totalRevenue = 0;
        for (const p of paymentArray) {
          totalRevenue += Number(p?.amount || 0);
        }
      }
      const totalCount = sumRes?.summary?.transactions ?? paymentArray.length;
      setSummary({ total: totalRevenue, transactions: totalCount });

      let mList = Array.isArray(memRes) ? memRes : memRes?.members || [];
      // Fallback: if branch-specific members empty, try fetching all members
      if (mList.length === 0) {
        const fallbackRes = await memberApi.list(activeGymId, "").catch(() => null);
        mList = Array.isArray(fallbackRes) ? fallbackRes : fallbackRes?.members || [];
      }

      setMembersList(mList);
      if (mList.length > 0 && !formData.memberId) {
        const firstId = mList[0]._id || mList[0].id;
        setFormData((prev) => ({ ...prev, memberId: String(firstId) }));
      }
    } catch (err: any) {
      const msg = formatApiError(err, "Failed to load payments ledger from backend.");
      setError(msg);
      showApiErrorToast(err, "Failed to load payments ledger");
      setPayments([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    const handleSync = () => {
      fetchData();
    };

    window.addEventListener("gymai-payments-updated", handleSync);
    return () => {
      window.removeEventListener("gymai-payments-updated", handleSync);
    };
  }, [gymId, branchId]);

  const handleRecordPaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const activeGymId = gymId || "";
    const activeBranchId = branchId || "";

    if (customerType === "member" && !formData.memberId) {
      toast.error("Please select a valid member.");
      return;
    }

    if (customerType === "walk_in" && !walkInName.trim()) {
      toast.error("Please enter the customer's full name.");
      return;
    }

    setSubmitting(true);
    try {
      const payload: Record<string, any> = {
        amount: Number(formData.amount),
        purpose: customerType === "walk_in" ? (formData.purpose || "merchandise") : formData.purpose,
        method: formData.method,
        notes: formData.notes,
        branchId: activeBranchId,
      };

      if (customerType === "member") {
        payload.memberId = formData.memberId;
        payload.triggerRenewal = formData.triggerRenewal;
        payload.renewMonths = Number(formData.renewMonths || 1);
      } else {
        payload.memberId = "walk_in";
        payload.customerName = walkInName.trim();
        payload.customerPhone = walkInPhone.trim();
      }

      await paymentApi.recordMemberPayment(activeGymId, payload);
      toast.success(
        customerType === "walk_in"
          ? `Recorded payment for ${walkInName.trim()}!`
          : "Payment recorded successfully!"
      );
      setShowRecordModal(false);
      setFormData({
        memberId: membersList[0]?._id || "",
        amount: 1500,
        purpose: "membership_fee",
        method: "cash",
        notes: "",
        triggerRenewal: false,
        renewMonths: 1,
      });
      setWalkInName("");
      setWalkInPhone("");
      setCustomerType("member");
      fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.message || err.message || "Failed to record payment");
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditPayment = (p: any) => {
    const existingName =
      (p.customerName && p.customerName !== "Walk-in Customer" && p.customerName !== "N/A" ? p.customerName : "") ||
      p.memberId?.userId?.fullName ||
      (p.memberId?.fullName && p.memberId.fullName !== "Walk-in Customer" ? p.memberId.fullName : "") ||
      "";

    setEditData({
      paymentId: p._id || p.id,
      customerName: existingName,
      amount: p.amount || 0,
      purpose: p.purpose || "membership_fee",
      method: p.method || p.paymentMethod || "cash",
      notes: p.notes || "",
    });
    setShowEditModal(true);
  };

  const handleUpdatePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const activeGymId = gymId || "";
    if (!editData.paymentId) return;
    setSubmittingEdit(true);
    try {
      await paymentApi.update(activeGymId, editData.paymentId, {
        customerName: editData.customerName.trim() || undefined,
        amount: Number(editData.amount),
        purpose: editData.purpose,
        method: editData.method,
        notes: editData.notes,
      });
      toast.success("Payment transaction updated!");
      setShowEditModal(false);
      fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.message || err.message || "Failed to update payment");
    } finally {
      setSubmittingEdit(false);
    }
  };

  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [deletingPayment, setDeletingPayment] = useState(false);

  const confirmDeletePayment = async () => {
    if (!deleteTarget || !gymId) return;
    setDeletingPayment(true);
    try {
      await paymentApi.delete(gymId, deleteTarget.id);
      toast.success("Payment record deleted.");
      setDeleteTarget(null);
      fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.message || err.message || "Failed to delete payment");
    } finally {
      setDeletingPayment(false);
    }
  };

  const handleDeletePayment = (pId: string, name: string) => {
    setDeleteTarget({ id: pId, name });
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Member Payments"
        subtitle="Revenue Collections & Invoices"
        backTo="/owner"
        action={
          <div className="flex items-center gap-2">
            <button
              onClick={fetchData}
              className="inline-flex items-center gap-1 text-xs text-(--color-text-muted) hover:text-(--color-text) p-2 rounded-lg bg-(--color-surface-2)"
              title="Refresh Payments"
            >
              <RefreshCw size={14} className={loading ? "animate-spin text-(--color-accent)" : ""} />
            </button>
            <button
              onClick={() => {
                if (membersList.length > 0 && !formData.memberId) {
                  const firstId = membersList[0]._id || membersList[0].id;
                  setFormData((prev) => ({ ...prev, memberId: String(firstId) }));
                }
                setShowRecordModal(true);
              }}
              className="hidden lg:inline-flex items-center gap-1.5 rounded-full bg-(--color-accent) text-(--color-navbar) text-sm font-bold px-4 py-2 hover:opacity-90 shadow-sm"
            >
              <Plus size={15} /> Record payment
            </button>
          </div>
        }
      />

      {/* Mobile & Tablet Record Payment Button */}
      <div className="block lg:hidden w-full">
        <button
          onClick={() => {
            if (membersList.length > 0 && !formData.memberId) {
              const firstId = membersList[0]._id || membersList[0].id;
              setFormData((prev) => ({ ...prev, memberId: String(firstId) }));
            }
            setShowRecordModal(true);
          }}
          className="w-full h-10 inline-flex items-center justify-center gap-2 rounded-xl bg-(--color-accent) text-(--color-navbar) text-sm font-bold px-4 hover:opacity-90 active:scale-[0.99] shadow-sm transition-all"
        >
          <Plus size={17} /> Record payment
        </button>
      </div>

      {isOwnerOrAdmin && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Card sweep>
            <p className="text-xs text-(--color-text-muted) mb-1">Total Revenue Collected</p>
            <p className="font-display text-2xl font-bold text-(--color-text) font-mono">
              ₹{summary.total.toLocaleString("en-IN")}
            </p>
          </Card>
          <Card>
            <p className="text-xs text-(--color-text-muted) mb-1">Successful Payment Transactions</p>
            <p className="font-display text-2xl font-bold text-(--color-text) font-mono">{summary.transactions} payments</p>
          </Card>
        </div>
      )}

      {resolvingBranch || loading ? (
        <Card className="flex items-center justify-center p-12 text-sm text-(--color-text-muted) gap-2">
          <Loader2 className="w-5 h-5 animate-spin text-(--color-accent)" /> Loading payment ledger from backend...
        </Card>
      ) : error ? (
        <Card className="text-center py-8">
          <p className="text-sm text-(--color-danger) mb-3">{error}</p>
          <button onClick={fetchData} className="px-4 py-2 rounded-full bg-(--color-surface-2) text-xs font-semibold">
            Retry Loading
          </button>
        </Card>
      ) : !isOwnerOrAdmin ? (
        <Card className="text-center py-12 text-(--color-text-muted) space-y-2">
          <CreditCard className="w-8 h-8 mx-auto text-(--color-text-faint)" />
          <p className="text-sm font-medium text-(--color-text)">Reception Payment Terminal</p>
          <p className="text-xs text-(--color-text-muted)">Click "Record payment" to log member cash, card, or UPI payments.</p>
        </Card>
      ) : payments.length === 0 ? (
        <Card className="text-center py-12 text-(--color-text-muted) space-y-2">
          <CreditCard className="w-8 h-8 mx-auto text-(--color-text-faint)" />
          <p className="text-sm font-medium text-(--color-text)">No member payments recorded yet</p>
          <p className="text-xs text-(--color-text-muted)">Click "Record payment" to log member cash/UPI payments.</p>
        </Card>
      ) : (
        <Card className="p-4">
          <div className="space-y-3">
            {payments.map((p) => {
              const pId = p._id || p.id;
              // Display name priority:
              // 1. Explicitly recorded customerName (e.g. "Ramesh", "Ramesh (9876543210)")
              // 2. Real registered member name from member profile / user
              // 3. Fallback to "Walk-in Customer"
              const customerExplicitName =
                p.customerName &&
                p.customerName.trim() !== "" &&
                p.customerName !== "Walk-in Customer" &&
                p.customerName !== "N/A"
                  ? p.customerName
                  : undefined;

              const memberRealName =
                p.memberId?.userId?.fullName ||
                (p.memberId?.fullName && p.memberId.fullName !== "N/A" && p.memberId.fullName !== "Walk-in Customer" ? p.memberId.fullName : undefined) ||
                (p.memberName && p.memberName !== "Walk-in Customer" && p.memberName !== "N/A" ? p.memberName : undefined) ||
                p.user?.fullName;

              const memberName = customerExplicitName || memberRealName || "Walk-in Customer";

              const description =
                p.notes ||
                p.description ||
                (p.purpose === "merchandise"
                  ? "Store / Product Purchase"
                  : p.purpose === "membership_fee"
                  ? "Membership Fee"
                  : p.purpose === "personal_training"
                  ? "Personal Training Pack"
                  : p.purpose?.replace(/_/g, " ") || "Payment");

              return (
                <div key={pId} className="p-3.5 rounded-xl border border-(--color-border) bg-(--color-surface-2)/40 flex flex-col justify-between gap-2.5">
                  {/* Desktop Layout (100% Untouched) */}
                  <div className="hidden lg:flex items-center justify-between gap-3">
                    <div>
                      <h4 className="font-display text-sm font-semibold text-(--color-text)">{memberName}</h4>
                      <p className="text-xs text-(--color-text-muted) mt-0.5 flex items-center gap-1.5 flex-wrap">
                        <span className="font-medium text-(--color-text)">{description}</span>
                        <span>·</span>
                        <span className="uppercase text-(--color-text-faint) font-mono">{p.method || p.paymentMethod || "CASH"}</span>
                        {p.invoiceNumber && <span className="text-[10px] text-(--color-accent) font-mono font-semibold">[{p.invoiceNumber}]</span>}
                      </p>
                    </div>

                    <div className="flex items-center justify-end gap-2 shrink-0">
                      <Badge tone="good">{p.status || "SUCCESS"}</Badge>
                      <span className="font-mono text-sm font-bold text-(--color-text) mr-1">₹{(p.amount || 0).toLocaleString("en-IN")}</span>
                      {isOwnerOrAdmin && (
                        <>
                          <button
                            onClick={() => handleEditPayment(p)}
                            className="p-1.5 rounded-lg hover:bg-white/10 text-amber-400 transition-colors cursor-pointer"
                            title="Edit Payment"
                          >
                            <Pencil size={15} />
                          </button>
                          <button
                            onClick={() => handleDeletePayment(pId, memberName)}
                            className="p-1.5 rounded-lg hover:bg-rose-500/10 text-rose-400 transition-colors cursor-pointer"
                            title="Delete Payment"
                          >
                            <Trash2 size={15} />
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Mobile & Tablet Layout (Clean, properly spaced, no truncated title, high contrast) */}
                  <div className="lg:hidden space-y-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <h4 className="font-display font-semibold text-sm text-(--color-text) break-words">{memberName}</h4>
                        <p className="text-xs text-(--color-text-muted) mt-0.5 flex items-center gap-1.5 flex-wrap">
                          <span className="font-medium text-(--color-text)">{description}</span>
                          <span>·</span>
                          <span className="uppercase text-(--color-text-faint) font-mono">{p.method || p.paymentMethod || "CASH"}</span>
                        </p>
                        {p.invoiceNumber && (
                          <p className="text-[10px] text-(--color-accent) font-mono font-semibold mt-0.5">
                            [{p.invoiceNumber}]
                          </p>
                        )}
                      </div>
                      <Badge tone="good">{p.status || "SUCCESS"}</Badge>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-(--color-border-soft)">
                      <span className="font-mono text-base font-bold text-(--color-text)">
                        ₹{(p.amount || 0).toLocaleString("en-IN")}
                      </span>
                      {isOwnerOrAdmin && (
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => handleEditPayment(p)}
                            className="h-8 w-8 inline-flex items-center justify-center rounded-lg bg-(--color-surface-2) border border-(--color-border) text-amber-500 hover:bg-amber-500/10 active:scale-95 transition-all cursor-pointer"
                            title="Edit Payment"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            onClick={() => handleDeletePayment(pId, memberName)}
                            className="h-8 w-8 inline-flex items-center justify-center rounded-lg bg-(--color-surface-2) border border-(--color-border) text-rose-500 hover:bg-rose-500/10 active:scale-95 transition-all cursor-pointer"
                            title="Delete Payment"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Record Payment Modal */}
      {showRecordModal && (
        <Modal onClose={() => setShowRecordModal(false)} maxWidth="md" title="Record Payment / Supplement Sale">
          <form onSubmit={handleRecordPaymentSubmit} className="space-y-4 text-xs">
            {/* Customer Type Selector (Segmented Tabs) */}
            <div>
              <label className="block text-(--color-text-muted) mb-1.5 font-medium">Customer Type</label>
              <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-(--color-surface-2) border border-(--color-border)">
                <button
                  type="button"
                  onClick={() => {
                    setCustomerType("member");
                    if (formData.purpose === "merchandise") {
                      setFormData((p) => ({ ...p, purpose: "membership_fee" }));
                    }
                  }}
                  className={`min-h-[44px] px-3 py-2 flex items-center justify-center gap-2 rounded-lg text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
                    customerType === "member"
                      ? "bg-(--color-surface) text-(--color-accent) shadow-xs border border-(--color-border)"
                      : "text-(--color-text-muted) hover:text-(--color-text)"
                  }`}
                >
                  <User size={16} className="shrink-0" />
                  <span className="text-center leading-tight">Registered Member</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCustomerType("walk_in");
                    setFormData((p) => ({ ...p, purpose: "merchandise" }));
                  }}
                  className={`min-h-[44px] px-3 py-2 flex items-center justify-center gap-2 rounded-lg text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
                    customerType === "walk_in"
                      ? "bg-(--color-surface) text-(--color-accent) shadow-xs border border-(--color-border)"
                      : "text-(--color-text-muted) hover:text-(--color-text)"
                  }`}
                >
                  <ShoppingBag size={16} className="shrink-0" />
                  <span className="text-center leading-tight">Direct / Walk-in Buyer</span>
                </button>
              </div>
            </div>

            {customerType === "member" ? (
              <div>
                <CustomSelect
                  label="Select Member"
                  placeholder="Choose a gym member..."
                  options={membersList.map((m) => {
                    const mId = m._id || m.id;
                    const name = m.fullName || m.name || m.userId?.fullName || "Member";
                    const phone = m.phone || m.userId?.phone || "";
                    return { label: `${name} ${phone ? `(${phone})` : ""}`, value: String(mId) };
                  })}
                  value={formData.memberId}
                  onChange={(val) => setFormData({ ...formData, memberId: val })}
                />
              </div>
            ) : (
              <div className="p-3 rounded-xl bg-(--color-surface-2)/60 border border-(--color-border) space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-(--color-text-muted) mb-1 font-medium">Customer Full Name *</label>
                    <div className="relative">
                      <input
                        type="text"
                        required
                        placeholder="e.g. Ramesh Kumar"
                        value={walkInName}
                        onChange={(e) => setWalkInName(e.target.value)}
                        className="w-full rounded-xl bg-(--color-surface) p-2.5 pl-8 text-sm text-(--color-text) border border-(--color-border) focus:outline-none focus:border-(--color-accent)"
                      />
                      <User size={14} className="absolute left-2.5 top-3 text-(--color-text-muted)" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-(--color-text-muted) mb-1 font-medium">Phone Number</label>
                    <div className="relative">
                      <input
                        type="tel"
                        placeholder="e.g. 9876543210"
                        value={walkInPhone}
                        onChange={(e) => setWalkInPhone(e.target.value)}
                        className="w-full rounded-xl bg-(--color-surface) p-2.5 pl-8 text-sm text-(--color-text) border border-(--color-border) focus:outline-none focus:border-(--color-accent)"
                      />
                      <Phone size={14} className="absolute left-2.5 top-3 text-(--color-text-muted)" />
                    </div>
                  </div>
                </div>
                <p className="text-[11px] text-(--color-text-muted) flex items-center gap-1.5">
                  <span className="text-emerald-500 font-bold">✓</span> Direct customer record will be maintained with full invoice in payment ledger.
                </p>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-(--color-text-muted) mb-1 font-medium">Amount (₹) *</label>
                <input
                  type="number"
                  required
                  min={1}
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: Number(e.target.value) })}
                  className="w-full rounded-xl bg-(--color-surface-2) p-2.5 text-sm text-(--color-text) border border-(--color-border) focus:outline-none focus:border-(--color-accent)"
                />
              </div>

              <div>
                <CustomSelect
                  label="Payment Method"
                  options={paymentMethodOptions}
                  value={formData.method}
                  onChange={(val) => setFormData({ ...formData, method: val })}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <CustomSelect
                  label="Purpose / Category"
                  options={purposeOptions}
                  value={formData.purpose}
                  onChange={(val) => setFormData({ ...formData, purpose: val })}
                />
              </div>
              <div>
                <label className="block text-(--color-text-muted) mb-1 font-medium">Notes / Items Description</label>
                <input
                  type="text"
                  placeholder={customerType === "walk_in" ? "e.g. Purchased 1x Whey Protein 2kg" : "e.g. Payment details"}
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full rounded-xl bg-(--color-surface-2) p-2.5 text-sm text-(--color-text) border border-(--color-border) focus:outline-none focus:border-(--color-accent)"
                />
              </div>
            </div>

            {customerType === "member" && formData.purpose === "membership_fee" && (
              <div className="p-3 rounded-xl bg-(--color-surface-2) border border-(--color-border) space-y-2.5">
                <div className="flex items-center gap-2.5">
                  <input
                    type="checkbox"
                    id="triggerRenewalCheck"
                    checked={formData.triggerRenewal}
                    onChange={(e) => setFormData({ ...formData, triggerRenewal: e.target.checked })}
                    className="rounded accent-(--color-accent) w-4 h-4 cursor-pointer shrink-0"
                  />
                  <label htmlFor="triggerRenewalCheck" className="text-xs text-(--color-text) font-semibold cursor-pointer">
                    Auto-renew & extend membership validity
                  </label>
                </div>

                {formData.triggerRenewal && (
                  <div className="pt-2 border-t border-(--color-border) space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <label className="text-[11px] text-(--color-text-muted) font-medium">Extend Duration</label>
                      <select
                        value={formData.renewMonths}
                        onChange={(e) => setFormData({ ...formData, renewMonths: Number(e.target.value) })}
                        className="bg-(--color-surface) text-(--color-text) border border-(--color-border) rounded-lg px-2.5 py-1 text-xs font-semibold focus:outline-none focus:border-(--color-accent)"
                      >
                        <option value={1}>+ 1 Month</option>
                        <option value={3}>+ 3 Months (Quarterly)</option>
                        <option value={6}>+ 6 Months (Half-Yearly)</option>
                        <option value={12}>+ 12 Months (Yearly)</option>
                      </select>
                    </div>

                    {(() => {
                      const selectedMem = membersList.find((m) => String(m._id || m.id) === String(formData.memberId));
                      if (!selectedMem) return null;
                      const rawEnd = selectedMem.membershipEndDate ? new Date(selectedMem.membershipEndDate) : null;
                      const currentValid = rawEnd && !isNaN(rawEnd.getTime());
                      const baseDate = currentValid && rawEnd > new Date() ? new Date(rawEnd) : new Date();
                      const newExpiry = new Date(baseDate);
                      newExpiry.setMonth(newExpiry.getMonth() + Number(formData.renewMonths || 1));

                      return (
                        <div className="text-[11px] bg-(--color-surface)/60 p-2 rounded-lg border border-(--color-border-soft) flex items-center justify-between">
                          <span className="text-(--color-text-muted)">
                            Current: <strong className="text-(--color-text)">{currentValid ? rawEnd.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "Expired / Inactive"}</strong>
                          </span>
                          <span className="text-(--color-good) font-medium">
                            ➔ New: <strong className="font-bold">{newExpiry.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</strong>
                          </span>
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowRecordModal(false)}
                className="flex-1 h-11 sm:h-10 rounded-xl bg-(--color-surface-2) font-bold text-xs text-(--color-text) hover:bg-(--color-surface-3) transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 h-11 sm:h-10 rounded-xl bg-(--color-accent) text-(--color-navbar) font-bold text-xs shadow-md flex items-center justify-center gap-1.5 hover:opacity-90 active:scale-[0.98] transition-all cursor-pointer"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Record Payment"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Edit Payment Modal */}
      {showEditModal && (
        <Modal onClose={() => setShowEditModal(false)} maxWidth="md" title="Edit Member Payment Transaction">
          <form onSubmit={handleUpdatePaymentSubmit} className="space-y-4 text-xs">
            <div>
              <label className="block text-(--color-text-muted) mb-1 font-medium font-sans">Customer / Buyer Name</label>
              <input
                type="text"
                placeholder="e.g. Ramesh Kumar"
                value={editData.customerName}
                onChange={(e) => setEditData({ ...editData, customerName: e.target.value })}
                className="w-full rounded-xl bg-(--color-surface-2) p-2.5 text-sm text-(--color-text) border border-(--color-border) focus:outline-none focus:border-(--color-accent)"
              />
              <p className="text-[10px] text-(--color-text-muted) mt-1">
                You can correct or rename the customer on this payment record/invoice.
              </p>
            </div>

            <div>
              <label className="block text-(--color-text-muted) mb-1 font-medium font-sans">Payment Amount (₹)</label>
              <input
                type="number"
                required
                min={0}
                value={editData.amount}
                onChange={(e) => setEditData({ ...editData, amount: Number(e.target.value) })}
                className="w-full rounded-xl bg-(--color-surface-2) p-2.5 text-sm text-(--color-text) border border-(--color-border)"
              />
            </div>

            <div>
              <CustomSelect
                label="Payment Method"
                options={paymentMethodOptions}
                value={editData.method}
                onChange={(val) => setEditData({ ...editData, method: val })}
              />
            </div>

            <div>
              <CustomSelect
                label="Purpose"
                options={purposeOptions}
                value={editData.purpose}
                onChange={(val) => setEditData({ ...editData, purpose: val })}
              />
            </div>

            <div>
              <label className="block text-(--color-text-muted) mb-1 font-medium font-sans">Notes / Internal Reference</label>
              <input
                type="text"
                placeholder="Notes or reference..."
                value={editData.notes}
                onChange={(e) => setEditData({ ...editData, notes: e.target.value })}
                className="w-full rounded-xl bg-(--color-surface-2) p-2.5 text-sm text-(--color-text) border border-(--color-border)"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowEditModal(false)}
                className="flex-1 py-2.5 rounded-xl bg-(--color-surface-2) font-semibold text-(--color-text)"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submittingEdit}
                className="flex-1 py-2.5 rounded-xl bg-(--color-accent) text-(--color-navbar) font-bold shadow-md flex items-center justify-center gap-1.5"
              >
                {submittingEdit ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save Changes"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDeletePayment}
        title="Delete Payment Record"
        description={`Are you sure you want to permanently delete the payment record for "${deleteTarget?.name}"? This action cannot be undone.`}
        confirmText="Delete Record"
        tone="danger"
        loading={deletingPayment}
      />
    </div>
  );
}
