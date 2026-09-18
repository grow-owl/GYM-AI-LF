import { useEffect, useState } from "react";
import { Award, Loader2, Plus, UserPlus, RefreshCw, Dumbbell, Trash2, Search, KeyRound, Mail, Phone, Eye, EyeOff, Copy, Check } from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import CustomSelect from "@/components/ui/CustomSelect";
import Modal from "@/components/ui/Modal";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import { useGymBranch } from "@/hooks/useGymBranch";
import { trainerApi, memberApi, authApi } from "@/lib/endpoints";
import { useSearchStore } from "../../store/searchStore";
import { toast } from "sonner";
import { showApiErrorToast } from "@/lib/api";

interface TrainerRow {
  _id: string;
  name?: string;
  fullName?: string;
  email?: string;
  phone?: string;
  specialization?: string;
  clients?: number;
  assignedMembersCount?: number;
  activeClientsCount?: number;
  status?: string;
  userId?: { _id?: string; fullName?: string; email?: string; phone?: string } | any;
  specializations?: string[];
  maxMemberCapacity?: number;
}

interface TrainersProps {
  overrideGymId?: string;
  overrideBranchId?: string;
  backTo?: string;
}

export default function Trainers({ overrideGymId, overrideBranchId, backTo: _backTo = "/owner" }: TrainersProps = {}) {
  const { gymId: resolvedGymId, branchId: resolvedBranchId, loading: resolvingBranch } = useGymBranch();
  const gymId = overrideGymId || resolvedGymId;
  const branchId = overrideBranchId || resolvedBranchId;

  const [trainers, setTrainers] = useState<TrainerRow[]>([]);
  const [workloads, setWorkloads] = useState<Record<string, number | null>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { searchQuery: search, setSearchQuery: setSearch, clearSearchQuery } = useSearchStore();

  // Clear search on page unmount so query doesn't bleed into other pages (fix #34)
  useEffect(() => () => { clearSearchQuery(); }, [clearSearchQuery]);

  const [showAddModal, setShowAddModal] = useState(false);
  const [submittingAdd, setSubmittingAdd] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedTrainer, setSelectedTrainer] = useState<TrainerRow | null>(null);

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

  // Reset Password Modal
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetTargetUser, setResetTargetUser] = useState<any | null>(null);
  const [newPasswordVal, setNewPasswordVal] = useState("Trainer@123");
  const [resettingPass, setResettingPass] = useState(false);

  // Members dropdown list for assigning
  const [membersList, setMembersList] = useState<any[]>([]);
  const [selectedMemberId, setSelectedMemberId] = useState("");
  const [memberSearchQuery, setMemberSearchQuery] = useState("");

  const filteredMembersDropdown = membersList.filter((m) => {
    const q = memberSearchQuery.toLowerCase().trim();
    if (!q) return true;
    const name = (m.fullName || m.name || m.userId?.fullName || "").toLowerCase();
    const phone = (m.phone || m.userId?.phone || "").toLowerCase();
    return name.includes(q) || phone.includes(q);
  });

  const [newTrainer, setNewTrainer] = useState({
    fullName: "",
    email: "",
    phone: "",
    password: "Trainer@123",
    specializations: "Strength & Conditioning",
  });
  const [showTrainerPassword, setShowTrainerPassword] = useState(false);
  const [createdTrainerCreds, setCreatedTrainerCreds] = useState<{
    fullName: string;
    email: string;
    phone: string;
    password: string;
  } | null>(null);
  const [showCreatedTrainerPassword, setShowCreatedTrainerPassword] = useState(true);
  const [copiedCreds, setCopiedCreds] = useState<string | null>(null);

  const copyCredsToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCreds(text);
    toast.success(`${label} copied to clipboard!`);
    setTimeout(() => setCopiedCreds(null), 2000);
  };

  const fetchTrainers = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await trainerApi.list(gymId, branchId);
      const list = Array.isArray(res) ? res : (res as any)?.trainers || [];
      setTrainers(list);

      // Async batch-fetch workloads per trainer without blocking initial render
      if (gymId && list.length > 0) {
        Promise.all(
          list.map(async (t: TrainerRow) => {
            const tId = t._id;
            if (!tId) return;
            try {
              const wRes = await trainerApi.getWorkload(gymId, tId);
              const count = typeof wRes?.activeMembersAssigned === "number" ? wRes.activeMembersAssigned : (wRes as any)?.count ?? 0;
              setWorkloads((prev) => ({ ...prev, [tId]: count }));
            } catch {
              setWorkloads((prev) => ({ ...prev, [tId]: 0 }));
            }
          })
        );
      }
    } catch {
      setError("Failed to load trainers from backend.");
      setTrainers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTrainers();
  }, [gymId, branchId]);

  const handleAddTrainer = async (e: React.FormEvent) => {
    e.preventDefault();
    const activeGymId = gymId || "";
    const activeBranchId = branchId || "";

    setSubmittingAdd(true);
    try {
      const specsArray = typeof newTrainer.specializations === 'string'
        ? newTrainer.specializations.split(',').map((s) => s.trim()).filter(Boolean)
        : newTrainer.specializations;

      const payload = {
        ...newTrainer,
        specializations: specsArray,
        branchId: activeBranchId,
      };

      await trainerApi.create(activeGymId, activeBranchId, payload);
      toast.success(`Trainer ${newTrainer.fullName} registered successfully!`);
      setShowAddModal(false);
      setCreatedTrainerCreds({
        fullName: newTrainer.fullName,
        email: newTrainer.email,
        phone: newTrainer.phone,
        password: newTrainer.password || "Trainer@123",
      });
      setNewTrainer({ fullName: "", email: "", phone: "", password: "Trainer@123", specializations: "Strength & Conditioning" });
      fetchTrainers();
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || err.response?.data?.message || err.message || "Failed to create trainer");
    } finally {
      setSubmittingAdd(false);
    }
  };

  const handleOpenAssign = async (t: TrainerRow) => {
    setSelectedTrainer(t);
    setSelectedMemberId("");
    setMemberSearchQuery("");
    setShowAssignModal(true);
    if (gymId && branchId) {
      try {
        const res = await memberApi.list(gymId, branchId);
        const mList = Array.isArray(res) ? res : (res as any)?.members || [];
        setMembersList(mList);
      } catch (err: any) {
        showApiErrorToast(err, "Failed to load members for client assignment");
      }
    }
  };

  const handleAssignClientSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTrainer || !selectedMemberId || !gymId || !branchId) {
      toast.error("Please select a valid member to assign.");
      return;
    }
    const tId = selectedTrainer._id;
    try {
      await trainerApi.assignClient(gymId, branchId, tId, selectedMemberId);
      toast.success("Client assigned to trainer successfully!");
      setShowAssignModal(false);
      fetchTrainers();
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || err.response?.data?.message || err.message || "Failed to assign client");
    }
  };

  // Delete Trainer Dialog State
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name?: string } | null>(null);
  const [deletingTrainer, setDeletingTrainer] = useState(false);

  const confirmDeleteTrainer = async () => {
    if (!deleteTarget || !gymId) return;
    setDeletingTrainer(true);
    try {
      await trainerApi.delete(gymId, deleteTarget.id);
      toast.success("Trainer removed successfully.");
      setDeleteTarget(null);
      fetchTrainers();
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || err.response?.data?.message || err.message || "Failed to delete trainer");
    } finally {
      setDeletingTrainer(false);
    }
  };

  const handleDeleteTrainer = (tId: string) => {
    setDeleteTarget({ id: tId });
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetTargetUser?._id) return;
    setResettingPass(true);
    try {
      await authApi.adminResetPassword(resetTargetUser._id, newPasswordVal);
      toast.success(`Password reset for ${resetTargetUser.fullName || "trainer"}!`);
      setShowResetModal(false);
      setResetTargetUser(null);
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || err.response?.data?.message || err.message || "Failed to reset password");
    } finally {
      setResettingPass(false);
    }
  };

  const filteredTrainers = trainers.filter((t) => {
    const name = t.fullName || t.name || t.userId?.fullName || "";
    const phone = t.phone || t.userId?.phone || "";
    const spec = (t.specializations || []).join(" ") || t.specialization || "";
    const q = search.toLowerCase();
    return name.toLowerCase().includes(q) || phone.toLowerCase().includes(q) || spec.toLowerCase().includes(q);
  });

  return (
    <div className="space-y-4">
      <PageHeader
        title="Trainers Management"
        backTo="/owner"
        action={
          <div className="flex items-center gap-2">
            <button
              onClick={fetchTrainers}
              className="inline-flex items-center gap-1 text-xs text-(--color-text-muted) hover:text-(--color-text) p-2 rounded-lg bg-(--color-surface-2)"
              title="Refresh Trainers"
            >
              <RefreshCw size={14} className={loading ? "animate-spin text-(--color-accent)" : ""} />
            </button>
            <button
              onClick={() => setShowAddModal(true)}
              className="hidden lg:inline-flex items-center gap-1.5 rounded-full bg-(--color-accent) text-(--color-navbar) text-sm font-bold px-4 py-2 hover:opacity-90 shadow-sm"
            >
              <Plus size={15} /> Add Trainer
            </button>
          </div>
        }
      />

      {/* Mobile & Tablet Add Trainer Button (Full space under header) */}
      <div className="block lg:hidden w-full">
        <button
          onClick={() => setShowAddModal(true)}
          className="w-full h-10 inline-flex items-center justify-center gap-2 rounded-xl bg-(--color-accent) text-(--color-navbar) text-sm font-bold px-4 hover:opacity-90 active:scale-[0.99] shadow-sm transition-all"
        >
          <Plus size={17} /> Add Trainer
        </button>
      </div>

      <Card className="p-3">
        <div className="relative">
          <Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-(--color-text-faint)" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={isDesktop ? "Search trainers by name, phone, specialization..." : "Search"}
            className="w-full rounded-xl border border-(--color-border) bg-(--color-base) pl-9 pr-4 py-2 text-sm text-(--color-text) outline-none focus:border-(--color-accent)"
          />
        </div>
      </Card>

      {resolvingBranch || loading ? (
        <Card className="flex items-center justify-center p-12 text-sm text-(--color-text-muted) gap-2">
          <Loader2 className="w-5 h-5 animate-spin text-(--color-accent)" /> Loading trainer profiles...
        </Card>
      ) : error ? (
        <Card className="text-center py-8">
          <p className="text-sm text-(--color-danger) mb-3">{error}</p>
          <button
            onClick={fetchTrainers}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs rounded-full bg-(--color-surface-3) text-(--color-text)"
          >
            <RefreshCw size={14} /> Retry
          </button>
        </Card>
      ) : filteredTrainers.length === 0 ? (
        <Card className="text-center py-12 text-(--color-text-muted) space-y-2">
          <Dumbbell className="w-8 h-8 mx-auto text-(--color-text-faint)" />
          <p className="text-sm font-medium text-(--color-text)">No trainers found</p>
          <p className="text-xs text-(--color-text-muted)">Click "Add Trainer" to register a new trainer profile.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredTrainers.map((t) => {
            const tId = t._id;
            const name = t.fullName || t.name || t.userId?.fullName || "Trainer";
            const email = t.email || t.userId?.email || "";
            const phone = t.phone || t.userId?.phone || "N/A";
            const specs = Array.isArray(t.specializations) && t.specializations.length > 0
              ? t.specializations.join(", ")
              : t.specialization || "General Fitness";
            const workloadVal = workloads[tId];
            const clientsCount = workloadVal ?? t.clients ?? t.assignedMembersCount ?? t.activeClientsCount ?? 0;

            return (
              <Card key={tId} className="p-4 space-y-3 flex flex-col justify-between">
                {/* Desktop Layout (100% Untouched) */}
                <div className="hidden lg:flex flex-col justify-between h-full space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-(--color-surface-2) flex items-center justify-center font-bold text-sm text-(--color-text) shrink-0">
                        {name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-display font-semibold text-sm text-(--color-text) truncate">{name}</h4>
                          {workloadVal !== undefined && workloadVal !== null ? (
                            <Badge tone="accent">{workloadVal} active {workloadVal === 1 ? "client" : "clients"}</Badge>
                          ) : (
                            <span className="text-[10px] text-(--color-text-faint) animate-pulse">Loading workload...</span>
                          )}
                        </div>
                        <p className="text-xs text-(--color-accent) font-medium truncate">{specs}</p>
                        {email && <p className="text-[11px] text-(--color-text-muted) truncate">{email}</p>}
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => {
                          setResetTargetUser(t.userId?._id ? t.userId : { _id: t.userId || tId, fullName: name });
                          setShowResetModal(true);
                        }}
                        className="p-1.5 rounded-lg hover:bg-(--color-surface-2) text-amber-400"
                        title="Reset Trainer Password"
                      >
                        <KeyRound size={15} />
                      </button>
                      <button
                        onClick={() => handleOpenAssign(t)}
                        className="p-1.5 rounded-lg hover:bg-(--color-surface-2) text-(--color-accent)"
                        title="Assign Client"
                      >
                        <UserPlus size={15} />
                      </button>
                      <button
                        onClick={() => handleDeleteTrainer(tId)}
                        className="p-1.5 rounded-lg hover:bg-(--color-surface-2) text-red-400"
                        title="Delete Trainer"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-center text-xs">
                    <div className="p-2.5 rounded-xl bg-(--color-surface-2)/50">
                      <Award className="w-4 h-4 mx-auto text-amber-400 mb-0.5" />
                      <p className="font-bold text-(--color-text)">{clientsCount}</p>
                      <p className="text-[10px] text-(--color-text-muted)">Clients assigned</p>
                    </div>
                    <div className="p-2.5 rounded-xl bg-(--color-surface-2)/50">
                      <p className="font-mono text-xs font-semibold text-(--color-text) truncate mt-1">{phone}</p>
                      <p className="text-[10px] text-(--color-text-muted)">Phone</p>
                    </div>
                  </div>
                </div>

                {/* Mobile & Tablet Layout (Vertically expanded, no overflow) */}
                <div className="lg:hidden space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-10 h-10 rounded-full bg-(--color-surface-2) flex items-center justify-center font-bold text-sm text-(--color-text) shrink-0">
                        {name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <h4 className="font-display font-semibold text-sm text-(--color-text) truncate">{name}</h4>
                        {workloadVal !== undefined && workloadVal !== null ? (
                          <Badge tone="accent" className="mt-0.5">{workloadVal} active {workloadVal === 1 ? "client" : "clients"}</Badge>
                        ) : (
                          <span className="text-[10px] text-(--color-text-faint) animate-pulse">Loading workload...</span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0 bg-(--color-surface-2)/60 p-1 rounded-xl border border-(--color-border-soft)">
                      <button
                        onClick={() => {
                          setResetTargetUser(t.userId?._id ? t.userId : { _id: t.userId || tId, fullName: name });
                          setShowResetModal(true);
                        }}
                        className="p-1.5 rounded-lg hover:bg-(--color-surface-2) text-amber-400 active:scale-95"
                        title="Reset Trainer Password"
                      >
                        <KeyRound size={15} />
                      </button>
                      <button
                        onClick={() => handleOpenAssign(t)}
                        className="p-1.5 rounded-lg hover:bg-(--color-surface-2) text-(--color-accent) active:scale-95"
                        title="Assign Client"
                      >
                        <UserPlus size={15} />
                      </button>
                      <button
                        onClick={() => handleDeleteTrainer(tId)}
                        className="p-1.5 rounded-lg hover:bg-(--color-surface-2) text-red-400 active:scale-95"
                        title="Delete Trainer"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2 pt-1 border-t border-(--color-border-soft) text-xs">
                    <div>
                      <span className="text-[10px] font-bold text-(--color-text-muted) uppercase tracking-wider block mb-0.5">
                        Specializations
                      </span>
                      <p className="text-xs text-(--color-accent) font-medium leading-relaxed break-words">
                        {specs}
                      </p>
                    </div>

                    {email && (
                      <div className="flex items-center gap-2 text-xs text-(--color-text-muted) break-all">
                        <Mail size={13} className="text-(--color-text-faint) shrink-0" />
                        <span>{email}</span>
                      </div>
                    )}

                    <div className="flex items-center gap-2 text-xs text-(--color-text-muted)">
                      <Phone size={13} className="text-(--color-text-faint) shrink-0" />
                      <span className="font-mono font-medium text-(--color-text)">{phone}</span>
                    </div>

                    <div className="flex items-center justify-between p-2.5 rounded-xl bg-(--color-surface-2)/50 border border-(--color-border-soft)">
                      <div className="flex items-center gap-2">
                        <Award className="w-4 h-4 text-amber-400 shrink-0" />
                        <span className="text-xs text-(--color-text-muted)">Clients Assigned</span>
                      </div>
                      <span className="text-xs font-bold text-(--color-text)">{clientsCount}</span>
                    </div>
                  </div>
                </div>
              </Card>
            );

          })}
        </div>
      )}

      {/* Add Trainer Modal */}
      {showAddModal && (
        <Modal onClose={() => setShowAddModal(false)} maxWidth="md" title="Register New Trainer">
          <form onSubmit={handleAddTrainer} className="space-y-4">
            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-(--color-text-muted) mb-1 font-medium">Full Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Rajesh Sharma"
                  value={newTrainer.fullName}
                  onChange={(e) => setNewTrainer({ ...newTrainer, fullName: e.target.value })}
                  className="w-full rounded-xl bg-(--color-surface-2) p-2.5 text-sm text-(--color-text) border border-(--color-border) focus:outline-none focus:border-(--color-accent)"
                />
              </div>
              <div>
                <label className="block text-(--color-text-muted) mb-1 font-medium">Email Address</label>
                <input
                  type="email"
                  required
                  placeholder="rajesh@gym.com"
                  value={newTrainer.email}
                  onChange={(e) => setNewTrainer({ ...newTrainer, email: e.target.value })}
                  className="w-full rounded-xl bg-(--color-surface-2) p-2.5 text-sm text-(--color-text) border border-(--color-border) focus:outline-none focus:border-(--color-accent)"
                />
              </div>
              <div>
                <label className="block text-(--color-text-muted) mb-1 font-medium">Phone Number</label>
                <input
                  type="text"
                  required
                  placeholder="+91 9876543210"
                  value={newTrainer.phone}
                  onChange={(e) => setNewTrainer({ ...newTrainer, phone: e.target.value })}
                  className="w-full rounded-xl bg-(--color-surface-2) p-2.5 text-sm text-(--color-text) border border-(--color-border) focus:outline-none focus:border-(--color-accent)"
                />
              </div>
              <div>
                <label className="block text-(--color-text-muted) mb-1 font-medium">Account Password</label>
                <div className="relative">
                  <input
                    type={showTrainerPassword ? "text" : "password"}
                    required
                    placeholder="e.g. Trainer@123"
                    value={newTrainer.password}
                    onChange={(e) => setNewTrainer({ ...newTrainer, password: e.target.value })}
                    className="w-full rounded-xl bg-(--color-surface-2) p-2.5 pr-10 text-sm text-(--color-text) border border-(--color-border) focus:outline-none focus:border-(--color-accent) font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowTrainerPassword(!showTrainerPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-(--color-text-muted) hover:text-(--color-text)"
                    tabIndex={-1}
                    title={showTrainerPassword ? "Hide password" : "Show password"}
                  >
                    {showTrainerPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-(--color-text-muted) mb-1 font-medium">Specializations</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Strength, Bodybuilding, Weight Loss"
                  value={newTrainer.specializations}
                  onChange={(e) => setNewTrainer({ ...newTrainer, specializations: e.target.value })}
                  className="w-full rounded-xl bg-(--color-surface-2) p-2.5 text-sm text-(--color-text) border border-(--color-border) focus:outline-none focus:border-(--color-accent)"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="flex-1 py-2.5 rounded-xl bg-(--color-surface-2) text-xs font-semibold text-(--color-text)"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submittingAdd}
                className="flex-1 py-2.5 rounded-xl bg-(--color-accent) text-(--color-navbar) text-xs font-bold shadow-md flex items-center justify-center gap-1.5"
              >
                {submittingAdd ? <Loader2 className="w-4 h-4 animate-spin" /> : "Register Trainer"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Newly Registered Trainer Credentials Modal */}
      {createdTrainerCreds && (
        <Modal
          onClose={() => setCreatedTrainerCreds(null)}
          maxWidth="md"
          title="Trainer Account Created Successfully 🎉"
          subtitle="Share these login credentials directly with the trainer."
        >
          <div className="space-y-4 text-xs">
            <div className="bg-(--color-surface-2) p-4 rounded-xl border border-white/10 space-y-2.5">
              <div className="flex justify-between items-center pb-2 border-b border-white/10">
                <span className="text-(--color-text-muted)">Trainer Name:</span>
                <span className="font-bold text-(--color-text)">{createdTrainerCreds.fullName}</span>
              </div>
              <div className="flex justify-between items-center pb-2 border-b border-white/10">
                <span className="text-(--color-text-muted)">Login Email:</span>
                <span className="font-bold text-sky-400">{createdTrainerCreds.email}</span>
              </div>
              <div className="flex justify-between items-center pb-2 border-b border-white/10">
                <span className="text-(--color-text-muted)">Phone:</span>
                <span className="font-semibold text-(--color-text)">{createdTrainerCreds.phone}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-(--color-text-muted)">Password:</span>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-amber-400 font-mono">
                    {showCreatedTrainerPassword ? createdTrainerCreds.password : "••••••••••••"}
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowCreatedTrainerPassword(!showCreatedTrainerPassword)}
                    className="p-1 text-(--color-text-muted) hover:text-(--color-text)"
                    title={showCreatedTrainerPassword ? "Hide password" : "Show password"}
                  >
                    {showCreatedTrainerPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                  <button
                    type="button"
                    onClick={() => copyCredsToClipboard(createdTrainerCreds.password, "Password")}
                    className="p-1 text-(--color-text-muted) hover:text-(--color-accent)"
                    title="Copy Password"
                  >
                    {copiedCreds === createdTrainerCreds.password ? (
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
                  const summary = `Trainer Name: ${createdTrainerCreds.fullName}\nEmail: ${createdTrainerCreds.email}\nPassword: ${createdTrainerCreds.password}\nLogin URL: https://gymai-one.vercel.app/login`;
                  copyCredsToClipboard(summary, "Trainer Credentials");
                }}
                className="py-2.5 px-4 rounded-xl bg-(--color-accent) text-white font-bold shadow-md flex items-center gap-1.5"
              >
                <Copy size={14} /> Copy All Credentials
              </button>
              <button
                type="button"
                onClick={() => setCreatedTrainerCreds(null)}
                className="py-2.5 px-4 rounded-xl bg-(--color-surface-2) font-semibold text-(--color-text)"
              >
                Done
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Assign Client Modal */}
      {showAssignModal && selectedTrainer && (
        <Modal
          onClose={() => setShowAssignModal(false)}
          maxWidth="md"
          title={`Assign Client to: ${selectedTrainer.fullName || selectedTrainer.name || selectedTrainer.userId?.fullName}`}
        >
          <form onSubmit={handleAssignClientSubmit} className="space-y-4">
            <div className="space-y-2 text-xs">
              <label className="block text-(--color-text-muted) font-medium">Select Gym Member</label>
              <input
                type="text"
                placeholder="Search member by name or phone..."
                value={memberSearchQuery}
                onChange={(e) => setMemberSearchQuery(e.target.value)}
                className="w-full rounded-xl bg-(--color-surface-2) p-2.5 text-sm text-(--color-text) border border-(--color-border) outline-none focus:border-(--color-accent)"
              />
              <CustomSelect
                value={selectedMemberId}
                onChange={(val) => setSelectedMemberId(val)}
                placeholder="-- Click to choose a member --"
                options={filteredMembersDropdown.map((m) => {
                  const name = m.fullName || m.name || m.userId?.fullName || "Member";
                  const phone = m.phone || m.userId?.phone || "";
                  return {
                    value: m._id || m.id,
                    label: `${name} ${phone ? `(${phone})` : ""}`,
                  };
                })}
              />
            </div>

            <div className="flex gap-2 pt-2 text-xs">
              <button
                type="button"
                onClick={() => setShowAssignModal(false)}
                className="flex-1 py-2.5 rounded-xl bg-(--color-surface-2) font-semibold text-(--color-text)"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 py-2.5 rounded-xl bg-(--color-accent) text-(--color-navbar) font-bold shadow-md"
              >
                Confirm Assignment
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Reset Password Modal */}
      {showResetModal && resetTargetUser && (
        <Modal
          onClose={() => setShowResetModal(false)}
          maxWidth="sm"
          title={`Reset Password: ${resetTargetUser.fullName || "Trainer"}`}
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
        onConfirm={confirmDeleteTrainer}
        title="Remove Trainer"
        description="Are you sure you want to remove this trainer? Their assigned clients will become unassigned."
        confirmText="Remove Trainer"
        tone="danger"
        loading={deletingTrainer}
      />
    </div>
  );
}
