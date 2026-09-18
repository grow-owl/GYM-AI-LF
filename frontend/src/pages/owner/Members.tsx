import { useState, useEffect, useCallback } from "react";
import { Search, Plus, Snowflake, CalendarPlus, XCircle, User, Loader2, RefreshCw, Users, KeyRound, Trash2, MoreVertical, CreditCard, IndianRupee, Eye, EyeOff, Copy, Check } from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Modal from "@/components/ui/Modal";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { memberApi, authApi, paymentApi, gymApi } from "@/lib/endpoints";
import { useGymBranch } from "@/hooks/useGymBranch";
import { useSearchStore } from "../../store/searchStore";
import { useAuthStore } from "@/store/authStore";
import { toast } from "sonner";
import { formatApiError } from "@/lib/api";

const statusTone: Record<string, "good" | "warn" | "danger" | "accent"> = {
  active: "good",
  ACTIVE: "good",
  expiring: "warn",
  EXPIRING: "warn",
  overdue: "danger",
  CANCELLED: "danger",
  trial: "accent",
  FROZEN: "accent",
};

const getMembershipDaysLeft = (m: any) => {
  const endDateStr = m.membershipEndDate || m.endDate;
  if (!endDateStr) return null;
  const end = new Date(endDateStr);
  if (isNaN(end.getTime())) return null;

  const now = new Date();
  const endDay = new Date(end.getFullYear(), end.getMonth(), end.getDate()).getTime();
  const nowDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const diffDays = Math.round((endDay - nowDay) / (1000 * 60 * 60 * 24));
  return diffDays;
};

const getMobileMembershipDisplay = (m: any) => {
  const status = m.membershipStatus || "ACTIVE";
  const daysLeft = getMembershipDaysLeft(m);

  if (status === "CANCELLED") {
    return { text: "CANCELLED", tone: "danger" as const };
  }

  if (status === "FROZEN") {
    if (daysLeft !== null && daysLeft > 0) {
      return { text: `${daysLeft}d left (Frozen)`, tone: "accent" as const };
    }
    return { text: "FROZEN", tone: "accent" as const };
  }

  if (daysLeft !== null) {
    if (daysLeft > 1) {
      return {
        text: `${daysLeft} days left`,
        tone: daysLeft <= 7 ? ("warn" as const) : ("good" as const),
      };
    }
    if (daysLeft === 1) {
      return { text: "1 day left", tone: "warn" as const };
    }
    if (daysLeft === 0) {
      return { text: "Expires today", tone: "warn" as const };
    }
    return { text: "Expired", tone: "danger" as const };
  }

  return {
    text: status,
    tone: (statusTone[status] || "good") as "good" | "warn" | "danger" | "accent",
  };
};

const cleanTrainerName = (t: string) => {
  if (!t || t.toLowerCase() === "unassigned") return "Unassigned";
  const cleaned = t.replace(/^Trainer\s+/i, "").trim();
  return cleaned || t;
};

export interface GymPlanOption {
  id: string;
  name: string;
  durationMonths: number;
  price: number;
  badge?: string;
  description: string;
}

export const GYM_MEMBERSHIP_PLANS: GymPlanOption[] = [
  {
    id: "monthly",
    name: "Monthly Fitness",
    durationMonths: 1,
    price: 1500,
    description: "30 Days standard gym access",
  },
  {
    id: "quarterly",
    name: "Quarterly Transformation",
    durationMonths: 3,
    price: 4000,
    badge: "Popular",
    description: "90 Days full gym access",
  },
  {
    id: "half_yearly",
    name: "Half-Yearly Pro",
    durationMonths: 6,
    price: 7500,
    description: "180 Days intensive gym access",
  },
  {
    id: "annual",
    name: "Annual Elite",
    durationMonths: 12,
    price: 14000,
    badge: "Best Value",
    description: "365 Days complete elite access",
  },
  {
    id: "pt_monthly",
    name: "Personal Training (PT) Pack",
    durationMonths: 1,
    price: 5000,
    description: "30 Days 1-on-1 personal trainer",
  },
  {
    id: "custom",
    name: "Custom Plan",
    durationMonths: 1,
    price: 2000,
    description: "Custom duration & fee",
  },
];

interface MembersProps {
  overrideGymId?: string;
  overrideBranchId?: string;
  backTo?: string;
}

export default function Members({ overrideGymId, overrideBranchId, backTo: _backTo = "/owner" }: MembersProps = {}) {
  const currentUserRole = useAuthStore((s) => s.user?.role);
  const isOwnerOrAdmin = currentUserRole === "GYM_OWNER" || currentUserRole === "SUPER_ADMIN" || currentUserRole === "BRANCH_MANAGER";
  const { gymId: resolvedGymId, branchId: resolvedBranchId, loading: resolvingBranch } = useGymBranch();
  const gymId = overrideGymId || resolvedGymId;
  const branchId = overrideBranchId || resolvedBranchId;

  const [memberList, setMemberList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { searchQuery: search, setSearchQuery: setSearch, clearSearchQuery } = useSearchStore();

  // Dynamic Gym Membership Plans from Backend
  const [gymPlans, setGymPlans] = useState<GymPlanOption[]>([]);

  useEffect(() => {
    const activeGymId = gymId || "";
    if (!activeGymId) return;
    gymApi
      .getMembershipPlans(activeGymId)
      .then((res) => {
        if (res?.plans && res.plans.length > 0) {
          setGymPlans(res.plans);
        } else {
          setGymPlans(GYM_MEMBERSHIP_PLANS);
        }
      })
      .catch((err) => {
        console.warn("Could not fetch custom plans, using starter templates:", err);
        setGymPlans(GYM_MEMBERSHIP_PLANS);
      });
  }, [gymId]);

  // Clear search on page unmount so query doesn't bleed into other pages (fix #34)
  useEffect(() => () => { clearSearchQuery(); }, [clearSearchQuery]);

  // Track desktop vs mobile/tablet viewport to preserve 100% desktop UI
  const [isDesktop, setIsDesktop] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.innerWidth >= 1024;
  });

  useEffect(() => {
    const handleResize = () => {
      setIsDesktop(window.innerWidth >= 1024);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Modals state
  const [showAddModal, setShowAddModal] = useState(false);
  const [submittingAdd, setSubmittingAdd] = useState(false);
  const [selectedMember, setSelectedMember] = useState<any | null>(null);
  const [activeModalType, setActiveModalType] = useState<"freeze" | "extend" | "cancel" | "renew" | "view" | null>(null);
  const [activeMobileMenuId, setActiveMobileMenuId] = useState<string | null>(null);

  // Reset Password Modal
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetTargetUser, setResetTargetUser] = useState<any | null>(null);
  const [newPasswordVal, setNewPasswordVal] = useState("Member@123");
  const [resettingPass, setResettingPass] = useState(false);

  // Form states
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    phone: "",
    password: "Member@123",
    referralCode: "",
  });
  const [showMemberPassword, setShowMemberPassword] = useState(false);
  const [createdMemberCreds, setCreatedMemberCreds] = useState<{
    fullName: string;
    email: string;
    phone: string;
    password: string;
    planName: string;
  } | null>(null);
  const [showCreatedMemberPassword, setShowCreatedMemberPassword] = useState(true);
  const [copiedCreds, setCopiedCreds] = useState<string | null>(null);

  const copyCredsToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCreds(text);
    toast.success(`${label} copied to clipboard!`);
    setTimeout(() => setCopiedCreds(null), 2000);
  };

  // Membership Plan Selection states
  const [selectedPlanId, setSelectedPlanId] = useState<string>("monthly");
  const [customPlanName, setCustomPlanName] = useState("");
  const [customDurationMonths, setCustomDurationMonths] = useState(1);
  const [customPrice, setCustomPrice] = useState(2000);

  // Initial Payment Recording states
  const [recordInitialPayment, setRecordInitialPayment] = useState(true);
  const [paymentAmount, setPaymentAmount] = useState(1500);
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "upi" | "card" | "bank_transfer">("cash");
  const [paymentNotes, setPaymentNotes] = useState("");

  const [reason, setReason] = useState("");
  const [extendDays, setExtendDays] = useState(30);
  const [renewPlanName, setRenewPlanName] = useState("");
  const [renewEndDate, setRenewEndDate] = useState("");

  const handleSelectPlan = (planId: string) => {
    setSelectedPlanId(planId);
    if (planId === "custom") {
      setPaymentAmount(customPrice);
    } else {
      const preset = gymPlans.find((p) => p.id === planId);
      if (preset) {
        setPaymentAmount(preset.price);
      }
    }
  };

  const fetchMembers = useCallback(async () => {
    if (!gymId || !branchId) {
      setMemberList([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await memberApi.list(gymId, branchId);
      const list = Array.isArray(res) ? res : res?.members || [];
      setMemberList(list);
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || "Failed to load members from server");
      setMemberList([]);
    } finally {
      setLoading(false);
    }
  }, [gymId, branchId]);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    const activeGymId = gymId || "";
    const activeBranchId = branchId || "";

    if (!activeGymId || !activeBranchId) {
      toast.error("Please select a gym branch before registering members.");
      return;
    }

    const preset = gymPlans.find((p) => p.id === selectedPlanId);
    const effectivePlanName =
      selectedPlanId === "custom"
        ? (customPlanName.trim() || "Custom Plan")
        : (preset?.name || "Monthly Fitness");

    const effectiveMonths =
      selectedPlanId === "custom"
        ? Math.max(1, Number(customDurationMonths) || 1)
        : (preset?.durationMonths || 1);

    setSubmittingAdd(true);
    try {
      const now = new Date();
      const endDate = new Date(now);
      endDate.setMonth(endDate.getMonth() + effectiveMonths);

      const payload = {
        fullName: formData.fullName.trim(),
        email: formData.email.trim().toLowerCase(),
        phone: formData.phone.trim(),
        password: formData.password || "Member@123",
        planName: effectivePlanName,
        referralCode: formData.referralCode?.trim() || undefined,
        branchId: activeBranchId,
        membershipStartDate: now.toISOString(),
        membershipEndDate: endDate.toISOString(),
      };

      const createdRes: any = await memberApi.create(activeGymId, activeBranchId, payload);
      const newMemberId = createdRes?.member?._id || createdRes?._id || createdRes?.member?.id;

      // Auto-record initial payment if selected and valid
      let paymentSuccess = false;
      let paymentErrorMsg = "";
      if (recordInitialPayment && newMemberId && Number(paymentAmount) > 0) {
        try {
          await paymentApi.recordMemberPayment(activeGymId, {
            memberId: String(newMemberId),
            branchId: activeBranchId,
            amount: Number(paymentAmount),
            purpose: selectedPlanId === "pt_monthly" ? "personal_training" : "membership_fee",
            method: paymentMethod,
            notes: paymentNotes.trim() || `Initial admission & payment for ${effectivePlanName}`,
          });
          paymentSuccess = true;
        } catch (payErr: any) {
          paymentErrorMsg = formatApiError(payErr, "Initial payment recording failed");
        }
      }

      if (recordInitialPayment && !paymentSuccess) {
        toast.warning(
          `Member ${formData.fullName} enrolled with ${effectivePlanName} plan, but initial payment of ₹${paymentAmount} failed: ${paymentErrorMsg}. Please record payment manually.`
        );
      } else {
        toast.success(
          `Member ${formData.fullName} enrolled with ${effectivePlanName} plan${
            recordInitialPayment && paymentSuccess ? ` (₹${paymentAmount} payment recorded)` : ""
          }!`
        );
      }

      setShowAddModal(false);
      setCreatedMemberCreds({
        fullName: formData.fullName,
        email: formData.email,
        phone: formData.phone,
        password: formData.password || "Member@123",
        planName: effectivePlanName,
      });
      setFormData({
        fullName: "",
        email: "",
        phone: "",
        password: "Member@123",
        referralCode: "",
      });
      setSelectedPlanId("monthly");
      setCustomPlanName("");
      setCustomDurationMonths(1);
      setCustomPrice(2000);
      setPaymentAmount(1500);
      setPaymentNotes("");
      fetchMembers();
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || err.response?.data?.message || err.message || "Failed to register member");
    } finally {
      setSubmittingAdd(false);
    }
  };

  const handleAction = async (type: "freeze" | "extend" | "cancel" | "renew") => {
    if (!selectedMember || !gymId || !branchId) return;
    const mId = selectedMember._id || selectedMember.id;
    try {
      if (type === "freeze") {
        await memberApi.freeze(gymId, branchId, mId, reason || "Member requested freeze");
        toast.success("Membership frozen.");
      } else if (type === "extend") {
        await memberApi.extend(gymId, branchId, mId, Number(extendDays), reason || "Manual extension");
        toast.success(`Membership extended by ${extendDays} days.`);
      } else if (type === "cancel") {
        await memberApi.cancel(gymId, branchId, mId, reason || "Member requested cancellation");
        toast.success("Membership cancelled.");
      } else if (type === "renew") {
        const targetDate = renewEndDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
        await memberApi.renew(gymId, branchId, mId, { newEndDate: targetDate, planName: renewPlanName || selectedMember.planName });
        toast.success("Membership renewed successfully!");
      }
      setActiveModalType(null);
      setSelectedMember(null);
      fetchMembers();
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || err.response?.data?.message || err.message || "Operation failed");
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetTargetUser?._id) return;
    setResettingPass(true);
    try {
      await authApi.adminResetPassword(resetTargetUser._id, newPasswordVal);
      toast.success(`Password reset for ${resetTargetUser.fullName || "member"}!`);
      setShowResetModal(false);
      setResetTargetUser(null);
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || err.response?.data?.message || err.message || "Failed to reset password");
    } finally {
      setResettingPass(false);
    }
  };

  // Delete Member Confirm Dialog State
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [deletingMember, setDeletingMember] = useState(false);

  const confirmDeleteMember = async () => {
    if (!deleteTarget || !gymId) return;
    setDeletingMember(true);
    try {
      await memberApi.deleteMember(gymId, deleteTarget.id);
      toast.success(`Member "${deleteTarget.name}" deleted successfully.`);
      setDeleteTarget(null);
      fetchMembers();
    } catch (err: any) {
      toast.error(err.response?.data?.message || err.message || "Failed to delete member.");
    } finally {
      setDeletingMember(false);
    }
  };

  const handleDeleteMember = (mId: string, name: string) => {
    setDeleteTarget({ id: mId, name });
  };

  const filteredMembers = memberList.filter((m) => {
    const name = m.fullName || m.name || m.userId?.fullName || "";
    const phone = m.phone || m.userId?.phone || "";
    const qr = m.qrCode || m.qrCodeId || "";
    const q = search.toLowerCase();
    return name.toLowerCase().includes(q) || phone.toLowerCase().includes(q) || qr.toLowerCase().includes(q);
  });

  return (
    <div className="space-y-4">
      <PageHeader
        title="Member Management"
        subtitle="Active Subscriptions & Profiles"
        backTo="/owner"
        action={
          <div className="flex items-center gap-2">
            <button
              onClick={fetchMembers}
              className="inline-flex items-center gap-1 text-xs text-(--color-text-muted) hover:text-(--color-text) p-2 rounded-lg bg-(--color-surface-2)"
              title="Refresh Members"
            >
              <RefreshCw size={14} className={loading ? "animate-spin text-(--color-accent)" : ""} />
            </button>
            <button
              onClick={() => setShowAddModal(true)}
              className="hidden lg:inline-flex items-center gap-1.5 rounded-full bg-(--color-accent) text-(--color-navbar) text-sm font-bold px-4 py-2 hover:opacity-90 shadow-sm"
            >
              <Plus size={15} /> Add member
            </button>
          </div>
        }
      />

      {/* Mobile & Tablet Add Member Button (Full space under header) */}
      <div className="block lg:hidden w-full">
        <button
          onClick={() => setShowAddModal(true)}
          className="w-full h-10 inline-flex items-center justify-center gap-2 rounded-xl bg-(--color-accent) text-(--color-navbar) text-sm font-bold px-4 hover:opacity-90 active:scale-[0.99] shadow-sm transition-all"
        >
          <Plus size={17} /> Add member
        </button>
      </div>

      <Card className="p-3">
        <div className="relative">
          <Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-(--color-text-faint)" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={isDesktop ? "Search by name, phone number, or QR ID..." : "Search"}
            className="w-full rounded-xl border border-(--color-border) bg-(--color-base) pl-9 pr-4 py-2 text-sm text-(--color-text) outline-none focus:border-(--color-accent)"
          />
        </div>
      </Card>

      {resolvingBranch || loading ? (
        <Card className="flex items-center justify-center p-12 text-sm text-(--color-text-muted) gap-2">
          <Loader2 className="w-5 h-5 animate-spin text-(--color-accent)" /> Loading member records from backend...
        </Card>
      ) : error ? (
        <Card className="text-center py-8">
          <p className="text-sm text-(--color-danger) mb-3">{error}</p>
          <button
            onClick={fetchMembers}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs rounded-full bg-(--color-surface-3) text-(--color-text)"
          >
            <RefreshCw size={14} /> Retry
          </button>
        </Card>
      ) : filteredMembers.length === 0 ? (
        <Card className="text-center py-12 text-(--color-text-muted) space-y-2">
          <Users className="w-8 h-8 mx-auto text-(--color-text-faint)" />
          <p className="text-sm font-medium text-(--color-text)">No members found in database</p>
          <p className="text-xs text-(--color-text-muted)">Click "Add Member" to register a new member account.</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {filteredMembers.map((m) => {
            const mId = m._id || m.id;
            const name = m.fullName || m.name || m.userId?.fullName || "Member";
            const plan = m.planName || m.plan || "Monthly Fitness";
            const trainer = m.assignedTrainerId?.userId?.fullName || m.assignedTrainerId?.name || m.trainerName || "Unassigned";
            const status = m.membershipStatus || "ACTIVE";
            const mobileBadge = getMobileMembershipDisplay(m);
            const displayTrainer = cleanTrainerName(trainer);
            const initials = name
              .split(" ")
              .map((n: string) => n[0])
              .join("")
              .substring(0, 2)
              .toUpperCase();

            return (
              <Card key={mId} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4">
                <div className="flex items-start sm:items-center gap-3.5 min-w-0">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-(--color-surface-2) font-display text-xs font-bold text-(--color-text) mt-0.5 sm:mt-0">
                    {initials}
                  </div>
                  <div className="min-w-0">
                    <p className="font-display text-sm font-semibold text-(--color-text) truncate">{name}</p>
                    {/* Desktop layout: exact original single line */}
                    <p className="hidden lg:block text-xs text-(--color-text-muted) truncate mt-0.5">
                      {plan} · Trainer: <span className="font-medium text-(--color-text)">{trainer}</span>
                    </p>
                    {/* Mobile & Tablet layout: stacked cleanly with trainer below plan */}
                    <div className="lg:hidden text-xs text-(--color-text-muted) mt-0.5 space-y-0.5">
                      <p className="font-medium text-(--color-text-muted)">{plan}</p>
                      <p className="text-(--color-text-muted)">
                        Trainer:{" "}
                        <span className={displayTrainer === "Unassigned" ? "text-(--color-text-muted)" : "font-medium text-(--color-text)"}>
                          {displayTrainer}
                        </span>
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                  {/* Desktop status badge (original) */}
                  <Badge tone={statusTone[status] || "good"} className="hidden lg:inline-flex">{status}</Badge>

                  {/* Mobile & Tablet badge: shows actual days left */}
                  <Badge tone={mobileBadge.tone} className="lg:hidden">{mobileBadge.text}</Badge>

                  {/* Desktop action buttons */}
                  <div className="hidden lg:flex items-center gap-1">
                    <button
                      onClick={() => {
                        setSelectedMember(m);
                        setActiveModalType("freeze");
                      }}
                      className="p-1.5 rounded-lg hover:bg-(--color-surface-2) text-(--color-text-muted) hover:text-(--color-text)"
                      title="Freeze Membership"
                    >
                      <Snowflake size={15} />
                    </button>
                    <button
                      onClick={() => {
                        setSelectedMember(m);
                        setActiveModalType("extend");
                      }}
                      className="p-1.5 rounded-lg hover:bg-(--color-surface-2) text-(--color-text-muted) hover:text-(--color-text)"
                      title="Extend Membership"
                    >
                      <CalendarPlus size={15} />
                    </button>
                    <button
                      onClick={() => {
                        setSelectedMember(m);
                        setRenewPlanName(m.planName || m.plan || "Monthly Fitness");
                        const defaultEnd = new Date();
                        defaultEnd.setMonth(defaultEnd.getMonth() + 1);
                        setRenewEndDate(defaultEnd.toISOString().split("T")[0]);
                        setActiveModalType("renew");
                      }}
                      className="p-1.5 rounded-lg hover:bg-(--color-surface-2) text-(--color-text-muted) hover:text-emerald-400"
                      title="Renew Membership"
                    >
                      <RefreshCw size={15} />
                    </button>
                    {isOwnerOrAdmin && (
                      <button
                        onClick={() => {
                          setSelectedMember(m);
                          setActiveModalType("cancel");
                        }}
                        className="p-1.5 rounded-lg hover:bg-(--color-surface-2) text-(--color-text-muted) hover:text-red-400"
                        title="Cancel Membership"
                      >
                        <XCircle size={15} />
                      </button>
                    )}

                    {isOwnerOrAdmin && (
                      <button
                        onClick={() => {
                          setResetTargetUser(m.userId?._id ? m.userId : { _id: m.userId || mId, fullName: name });
                          setShowResetModal(true);
                        }}
                        className="p-1.5 rounded-lg hover:bg-(--color-surface-2) text-amber-400"
                        title="Reset Member Password"
                      >
                        <KeyRound size={15} />
                      </button>
                    )}

                    {isOwnerOrAdmin && (
                      <button
                        onClick={() => handleDeleteMember(mId, name)}
                        className="p-1.5 rounded-lg hover:bg-rose-500/10 text-rose-400 transition-colors cursor-pointer"
                        title="Delete Member Profile"
                      >
                        <Trash2 size={15} />
                      </button>
                    )}

                    <button
                      onClick={() => {
                        setSelectedMember(m);
                        setActiveModalType("view");
                      }}
                      className="p-1.5 rounded-lg hover:bg-(--color-surface-2) text-(--color-text-muted) hover:text-(--color-text)"
                      title="View Details"
                    >
                      <User size={15} />
                    </button>
                  </div>

                  {/* Mobile action buttons & overflow menu */}
                  <div className="flex lg:hidden items-center gap-1 relative">
                    <button
                      onClick={() => {
                        setSelectedMember(m);
                        setRenewPlanName(m.planName || m.plan || "Monthly Fitness");
                        const defaultEnd = new Date();
                        defaultEnd.setMonth(defaultEnd.getMonth() + 1);
                        setRenewEndDate(defaultEnd.toISOString().split("T")[0]);
                        setActiveModalType("renew");
                      }}
                      className="p-1.5 rounded-lg hover:bg-(--color-surface-2) text-(--color-text-muted) hover:text-emerald-400"
                      title="Renew Membership"
                    >
                      <RefreshCw size={15} />
                    </button>
                    <button
                      onClick={() => {
                        setSelectedMember(m);
                        setActiveModalType("view");
                      }}
                      className="p-1.5 rounded-lg hover:bg-(--color-surface-2) text-(--color-text-muted) hover:text-(--color-text)"
                      title="View Details"
                    >
                      <User size={15} />
                    </button>
                    <button
                      onClick={() => setActiveMobileMenuId(activeMobileMenuId === mId ? null : mId)}
                      className="p-1.5 rounded-lg hover:bg-(--color-surface-2) text-(--color-text-muted) hover:text-(--color-text)"
                      title="More Actions"
                    >
                      <MoreVertical size={15} />
                    </button>

                    {activeMobileMenuId === mId && (
                      <div className="absolute right-0 top-full mt-1 w-44 z-30 rounded-xl border border-(--color-border) bg-(--color-surface) shadow-xl p-1">
                        <button
                          onClick={() => {
                            setActiveMobileMenuId(null);
                            setSelectedMember(m);
                            setActiveModalType("freeze");
                          }}
                          className="w-full text-left px-3 py-2 text-xs font-medium text-(--color-text) hover:bg-(--color-surface-2) rounded-lg flex items-center gap-2"
                        >
                          <Snowflake size={14} /> Freeze
                        </button>
                        <button
                          onClick={() => {
                            setActiveMobileMenuId(null);
                            setSelectedMember(m);
                            setActiveModalType("extend");
                          }}
                          className="w-full text-left px-3 py-2 text-xs font-medium text-(--color-text) hover:bg-(--color-surface-2) rounded-lg flex items-center gap-2"
                        >
                          <CalendarPlus size={14} /> Extend
                        </button>
                        {isOwnerOrAdmin && (
                          <button
                            onClick={() => {
                              setActiveMobileMenuId(null);
                              setSelectedMember(m);
                              setActiveModalType("cancel");
                            }}
                            className="w-full text-left px-3 py-2 text-xs font-medium text-red-400 hover:bg-(--color-surface-2) rounded-lg flex items-center gap-2"
                          >
                            <XCircle size={14} /> Cancel
                          </button>
                        )}
                        {isOwnerOrAdmin && (
                          <button
                            onClick={() => {
                              setActiveMobileMenuId(null);
                              setResetTargetUser(m.userId?._id ? m.userId : { _id: m.userId || mId, fullName: name });
                              setShowResetModal(true);
                            }}
                            className="w-full text-left px-3 py-2 text-xs font-medium text-amber-400 hover:bg-(--color-surface-2) rounded-lg flex items-center gap-2"
                          >
                            <KeyRound size={14} /> Reset Password
                          </button>
                        )}
                        {isOwnerOrAdmin && (
                          <button
                            onClick={() => {
                              setActiveMobileMenuId(null);
                              handleDeleteMember(mId, name);
                            }}
                            className="w-full text-left px-3 py-2 text-xs font-medium text-rose-400 hover:bg-rose-500/10 rounded-lg flex items-center gap-2"
                          >
                            <Trash2 size={14} /> Delete Profile
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Add Member Modal */}
      {showAddModal && (
        <Modal onClose={() => setShowAddModal(false)} maxWidth="lg" title="Register New Gym Member">
          <form onSubmit={handleAddMember} className="space-y-4">
            <div className="space-y-3.5 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-(--color-text-muted) mb-1 font-medium">Full Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Rahul Sharma"
                    value={formData.fullName}
                    onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                    className="w-full rounded-xl bg-(--color-surface-2) p-2.5 text-sm text-(--color-text) border border-(--color-border) focus:outline-none focus:border-(--color-accent)"
                  />
                </div>
                <div>
                  <label className="block text-(--color-text-muted) mb-1 font-medium">Email Address *</label>
                  <input
                    type="email"
                    required
                    placeholder="rahul@gmail.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full rounded-xl bg-(--color-surface-2) p-2.5 text-sm text-(--color-text) border border-(--color-border) focus:outline-none focus:border-(--color-accent)"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-(--color-text-muted) mb-1 font-medium">Phone Number *</label>
                  <input
                    type="text"
                    required
                    placeholder="+91 9876543210"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full rounded-xl bg-(--color-surface-2) p-2.5 text-sm text-(--color-text) border border-(--color-border) focus:outline-none focus:border-(--color-accent)"
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-(--color-text-muted) font-medium">Account Password *</label>
                  </div>
                  <div className="relative">
                    <input
                      type={showMemberPassword ? "text" : "password"}
                      required
                      placeholder="e.g. Member@123"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      className="w-full rounded-xl bg-(--color-surface-2) p-2.5 pr-10 text-sm text-(--color-text) border border-(--color-border) focus:outline-none focus:border-(--color-accent) font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setShowMemberPassword(!showMemberPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-(--color-text-muted) hover:text-(--color-text)"
                      tabIndex={-1}
                      title={showMemberPassword ? "Hide password" : "Show password"}
                    >
                      {showMemberPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Membership Plan Selection Grid */}
              <div className="pt-2 border-t border-(--color-border-soft)">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-(--color-text) font-bold flex items-center gap-1.5">
                    <CreditCard size={14} className="text-(--color-accent)" /> Select Membership Plan *
                  </label>
                  <span className="text-[10px] text-(--color-text-muted)">Auto-configures duration & admission fee</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {gymPlans.map((plan) => {
                    const isSelected = selectedPlanId === plan.id;
                    return (
                      <button
                        type="button"
                        key={plan.id}
                        onClick={() => handleSelectPlan(plan.id)}
                        className={`text-left p-2.5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                          isSelected
                            ? "bg-(--color-accent)/10 border-(--color-accent) shadow-sm ring-1 ring-(--color-accent)"
                            : "bg-(--color-surface-2) border-(--color-border) hover:border-(--color-text-muted)/40"
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between gap-1 mb-1">
                            <span className="font-semibold text-xs text-(--color-text) line-clamp-1">{plan.name}</span>
                            {plan.badge && (
                              <span className="px-1.5 py-0.2 rounded-full bg-(--color-accent) text-(--color-navbar) text-[9px] font-extrabold shrink-0">
                                {plan.badge}
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] text-(--color-text-muted) leading-tight mb-2">{plan.description}</p>
                        </div>
                        <div className="flex items-baseline justify-between pt-1 border-t border-(--color-border-soft)/60">
                          <span className="font-bold text-xs text-(--color-accent-text)">
                            {plan.id === "custom" ? "Custom ₹" : `₹${plan.price.toLocaleString("en-IN")}`}
                          </span>
                          <span className="text-[10px] text-(--color-text-faint)">
                            {plan.id === "custom" ? "Custom dur." : `${plan.durationMonths} Mo`}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Custom Plan Extra Fields */}
                {selectedPlanId === "custom" && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 mt-2.5 p-3 rounded-xl bg-(--color-surface-2)/80 border border-(--color-border)">
                    <div>
                      <label className="block text-[11px] text-(--color-text-muted) mb-1 font-medium">Custom Plan Name *</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Student 2-Month Special"
                        value={customPlanName}
                        onChange={(e) => setCustomPlanName(e.target.value)}
                        className="w-full rounded-lg bg-(--color-surface) p-2 text-xs text-(--color-text) border border-(--color-border) focus:outline-none focus:border-(--color-accent)"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-(--color-text-muted) mb-1 font-medium">Duration (Months) *</label>
                      <input
                        type="number"
                        min="1"
                        max="36"
                        required
                        value={customDurationMonths}
                        onChange={(e) => setCustomDurationMonths(Number(e.target.value))}
                        className="w-full rounded-lg bg-(--color-surface) p-2 text-xs text-(--color-text) border border-(--color-border) focus:outline-none focus:border-(--color-accent)"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-(--color-text-muted) mb-1 font-medium">Fee Amount (₹) *</label>
                      <input
                        type="number"
                        min="0"
                        required
                        value={customPrice}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          setCustomPrice(val);
                          setPaymentAmount(val);
                        }}
                        className="w-full rounded-lg bg-(--color-surface) p-2 text-xs text-(--color-text) border border-(--color-border) focus:outline-none focus:border-(--color-accent)"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Initial Payment Collection Option */}
              <div className="pt-2 border-t border-(--color-border-soft)">
                <div className="flex items-center justify-between mb-2">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={recordInitialPayment}
                      onChange={(e) => setRecordInitialPayment(e.target.checked)}
                      className="w-4 h-4 rounded text-(--color-accent) focus:ring-(--color-accent) cursor-pointer"
                    />
                    <span className="font-bold text-xs text-(--color-text) flex items-center gap-1.5">
                      <IndianRupee size={13} className="text-emerald-400" /> Collect & Record Initial Payment
                    </span>
                  </label>
                  <span className="text-[10px] text-emerald-400 font-medium">Auto-syncs with Payments & Invoices</span>
                </div>

                {recordInitialPayment && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/20">
                    <div>
                      <label className="block text-[11px] text-(--color-text-muted) mb-1 font-medium">Amount Received (₹) *</label>
                      <input
                        type="number"
                        min="1"
                        required={recordInitialPayment}
                        value={paymentAmount}
                        onChange={(e) => setPaymentAmount(Number(e.target.value))}
                        className="w-full rounded-lg bg-(--color-surface) p-2 text-xs font-bold text-(--color-text) border border-(--color-border) focus:outline-none focus:border-(--color-accent)"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-(--color-text-muted) mb-1 font-medium">Payment Mode *</label>
                      <select
                        value={paymentMethod}
                        onChange={(e) => setPaymentMethod(e.target.value as any)}
                        className="w-full rounded-lg bg-(--color-surface) p-2 text-xs text-(--color-text) border border-(--color-border) focus:outline-none focus:border-(--color-accent) cursor-pointer"
                      >
                        <option value="cash">Cash</option>
                        <option value="upi">UPI / QR Code (GPay, PhonePe, Paytm)</option>
                        <option value="card">Credit / Debit Card</option>
                        <option value="bank_transfer">Bank Transfer / IMPS</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] text-(--color-text-muted) mb-1 font-medium">Payment Note (Optional)</label>
                      <input
                        type="text"
                        placeholder="e.g. Full cash at reception"
                        value={paymentNotes}
                        onChange={(e) => setPaymentNotes(e.target.value)}
                        className="w-full rounded-lg bg-(--color-surface) p-2 text-xs text-(--color-text) border border-(--color-border) focus:outline-none focus:border-(--color-accent)"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-(--color-text-muted) mb-1 font-medium">Referral Code (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. REF-123456"
                  value={formData.referralCode}
                  onChange={(e) => setFormData({ ...formData, referralCode: e.target.value })}
                  className="w-full rounded-xl bg-(--color-surface-2) p-2.5 text-sm text-(--color-text) border border-(--color-border) focus:outline-none focus:border-(--color-accent)"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-3 border-t border-(--color-border-soft)">
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="flex-1 py-2.5 rounded-xl bg-(--color-surface-2) text-xs font-semibold text-(--color-text) hover:bg-(--color-surface-3) transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submittingAdd}
                className="flex-1 py-2.5 rounded-xl bg-(--color-accent) text-(--color-navbar) text-xs font-bold shadow-md flex items-center justify-center gap-1.5 hover:bg-(--color-accent-hover) transition-colors cursor-pointer disabled:opacity-50"
              >
                {submittingAdd ? <Loader2 className="w-4 h-4 animate-spin" /> : "Register & Enroll Member"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Newly Registered Member Credentials Modal */}
      {createdMemberCreds && (
        <Modal
          onClose={() => setCreatedMemberCreds(null)}
          maxWidth="md"
          title="Member Enrolled Successfully 🎉"
          subtitle="Share these login credentials directly with the member."
        >
          <div className="space-y-4 text-xs">
            <div className="bg-(--color-surface-2) p-4 rounded-xl border border-white/10 space-y-2.5">
              <div className="flex justify-between items-center pb-2 border-b border-white/10">
                <span className="text-(--color-text-muted)">Member Name:</span>
                <span className="font-bold text-(--color-text)">{createdMemberCreds.fullName}</span>
              </div>
              <div className="flex justify-between items-center pb-2 border-b border-white/10">
                <span className="text-(--color-text-muted)">Login Email:</span>
                <span className="font-bold text-sky-400">{createdMemberCreds.email}</span>
              </div>
              <div className="flex justify-between items-center pb-2 border-b border-white/10">
                <span className="text-(--color-text-muted)">Phone:</span>
                <span className="font-semibold text-(--color-text)">{createdMemberCreds.phone}</span>
              </div>
              <div className="flex justify-between items-center pb-2 border-b border-white/10">
                <span className="text-(--color-text-muted)">Membership Plan:</span>
                <Badge tone="good">{createdMemberCreds.planName}</Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-(--color-text-muted)">Password:</span>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-amber-400 font-mono">
                    {showCreatedMemberPassword ? createdMemberCreds.password : "••••••••••••"}
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowCreatedMemberPassword(!showCreatedMemberPassword)}
                    className="p-1 text-(--color-text-muted) hover:text-(--color-text)"
                    title={showCreatedMemberPassword ? "Hide password" : "Show password"}
                  >
                    {showCreatedMemberPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                  <button
                    type="button"
                    onClick={() => copyCredsToClipboard(createdMemberCreds.password, "Password")}
                    className="p-1 text-(--color-text-muted) hover:text-(--color-accent)"
                    title="Copy Password"
                  >
                    {copiedCreds === createdMemberCreds.password ? (
                      <Check size={14} className="text-emerald-400" />
                    ) : (
                      <Copy size={14} />
                    )}
                  </button>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  const summary = `Welcome to our Gym!\nName: ${createdMemberCreds.fullName}\nPlan: ${createdMemberCreds.planName}\nEmail: ${createdMemberCreds.email}\nPassword: ${createdMemberCreds.password}\nLogin URL: https://gymai-one.vercel.app/login`;
                  copyCredsToClipboard(summary, "Member Credentials");
                }}
                className="py-2.5 px-4 rounded-xl bg-(--color-accent) text-white font-bold shadow-md flex items-center gap-1.5"
              >
                <Copy size={14} /> Copy All Credentials
              </button>
              <button
                type="button"
                onClick={() => setCreatedMemberCreds(null)}
                className="py-2.5 px-4 rounded-xl bg-(--color-surface-2) font-semibold text-(--color-text)"
              >
                Done
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Action Modal (Freeze/Extend/Cancel/View) */}
      {activeModalType && selectedMember && (
        <Modal
          onClose={() => {
            setActiveModalType(null);
            setSelectedMember(null);
          }}
          maxWidth="sm"
          title={`${activeModalType.toUpperCase()} Membership: ${selectedMember.fullName || selectedMember.name || selectedMember.userId?.fullName}`}
        >
          <div className="space-y-4 text-xs">
            {activeModalType === "view" ? (
              <div className="space-y-2 text-(--color-text-muted) bg-(--color-surface-2) p-3 rounded-xl">
                <p><strong className="text-(--color-text)">Email:</strong> {selectedMember.email || selectedMember.userId?.email || "N/A"}</p>
                <p><strong className="text-(--color-text)">Phone:</strong> {selectedMember.phone || selectedMember.userId?.phone || "N/A"}</p>
                <p><strong className="text-(--color-text)">Plan:</strong> {selectedMember.planName || selectedMember.plan}</p>
                <p><strong className="text-(--color-text)">Status:</strong> {selectedMember.membershipStatus || "ACTIVE"}</p>
              </div>
            ) : (
              <div className="space-y-3">
                {activeModalType === "extend" && (
                  <div>
                    <label className="block text-(--color-text-muted) mb-1 font-medium">Days to Extend</label>
                    <input
                      type="number"
                      value={extendDays}
                      onChange={(e) => setExtendDays(Number(e.target.value))}
                      className="w-full rounded-xl bg-(--color-surface-2) p-2.5 text-sm text-(--color-text) border border-(--color-border)"
                    />
                  </div>
                )}

                {activeModalType === "renew" && (
                  <div className="space-y-2.5">
                    <div>
                      <label className="block text-(--color-text-muted) mb-1 font-medium">Select Renewal Plan</label>
                      <select
                        value={renewPlanName}
                        onChange={(e) => {
                          const val = e.target.value;
                          setRenewPlanName(val);
                          const matched = gymPlans.find((p) => p.name === val);
                          const months = matched ? matched.durationMonths : 1;
                          const newEnd = new Date();
                          newEnd.setMonth(newEnd.getMonth() + months);
                          setRenewEndDate(newEnd.toISOString().split("T")[0]);
                        }}
                        className="w-full rounded-xl bg-(--color-surface-2) p-2.5 text-sm text-(--color-text) border border-(--color-border) cursor-pointer"
                      >
                        {gymPlans.map((p) => (
                          <option key={p.id} value={p.name}>
                            {p.name} ({p.durationMonths} Mo - ₹{p.price.toLocaleString("en-IN")})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-(--color-text-muted) mb-1 font-medium">New Expiration Date</label>
                      <input
                        type="date"
                        required
                        value={renewEndDate}
                        onChange={(e) => setRenewEndDate(e.target.value)}
                        className="w-full rounded-xl bg-(--color-surface-2) p-2.5 text-sm text-(--color-text) border border-(--color-border)"
                      />
                    </div>
                  </div>
                )}

                {activeModalType !== "renew" && (
                  <div>
                    <label className="block text-(--color-text-muted) mb-1 font-medium">Reason / Note</label>
                    <input
                      type="text"
                      placeholder="Enter reason..."
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      className="w-full rounded-xl bg-(--color-surface-2) p-2.5 text-sm text-(--color-text) border border-(--color-border)"
                    />
                  </div>
                )}
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setActiveModalType(null);
                  setSelectedMember(null);
                }}
                className="flex-1 py-2.5 rounded-xl bg-(--color-surface-2) font-semibold text-(--color-text)"
              >
                Close
              </button>
              {activeModalType !== "view" && (
                <button
                  type="button"
                  onClick={() => handleAction(activeModalType)}
                  className="flex-1 py-2.5 rounded-xl bg-(--color-accent) text-(--color-navbar) font-bold shadow-md capitalize"
                >
                  Confirm {activeModalType}
                </button>
              )}
            </div>
          </div>
        </Modal>
      )}

      {/* Reset Password Modal */}
      {showResetModal && resetTargetUser && (
        <Modal
          onClose={() => setShowResetModal(false)}
          maxWidth="sm"
          title={`Reset Password: ${resetTargetUser.fullName || "Member"}`}
        >
          <form onSubmit={handleResetPassword} className="space-y-4 text-xs">
            <div>
              <label className="block text-(--color-text-muted) mb-1 font-medium">New Password</label>
              <input
                type="text"
                required
                value={newPasswordVal}
                onChange={(e) => setNewPasswordVal(e.target.value)}
                className="w-full rounded-xl bg-(--color-surface-2) p-2.5 text-sm text-(--color-text) border border-(--color-border)"
              />
            </div>
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowResetModal(false)}
                className="flex-1 py-2.5 rounded-xl bg-(--color-surface-2) font-semibold text-(--color-text)"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={resettingPass}
                className="flex-1 py-2.5 rounded-xl bg-amber-500 text-(--color-navbar) font-bold shadow-md flex items-center justify-center gap-1"
              >
                {resettingPass ? <Loader2 className="w-4 h-4 animate-spin" /> : "Reset Password"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDeleteMember}
        title="Delete Member Profile"
        description={`Are you sure you want to permanently delete member "${deleteTarget?.name}"? This action cannot be undone.`}
        confirmText="Delete Member"
        tone="danger"
        loading={deletingMember}
      />
    </div>
  );
}
