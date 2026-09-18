import { useState, useEffect } from "react";
import { Plus, Users, KeyRound, Loader2, RefreshCw, Trash2, Mail, Phone, MapPin, Eye, EyeOff, Copy, Check } from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Modal from "@/components/ui/Modal";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import CustomSelect from "@/components/ui/CustomSelect";
import { staffApi, authApi, gymApi } from "@/lib/endpoints";
import { useGymBranch } from "@/hooks/useGymBranch";
import { useAuthStore } from "@/store/authStore";
import { showApiErrorToast } from "@/lib/api";
import { toast } from "sonner";

interface StaffProps {
  overrideGymId?: string;
  overrideBranchId?: string;
  backTo?: string;
}

export default function Staff({ overrideGymId, overrideBranchId, backTo: _backTo = "/owner" }: StaffProps = {}) {
  const currentUserRole = useAuthStore((s) => s.user?.role);
  const isOwnerOrAdmin = currentUserRole === "GYM_OWNER" || currentUserRole === "SUPER_ADMIN";
  const { gymId: resolvedGymId, branchId: resolvedBranchId, loading: resolvingBranch } = useGymBranch();
  const gymId = overrideGymId || resolvedGymId;
  const branchId = overrideBranchId || resolvedBranchId;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [staffList, setStaffList] = useState<any[]>([]);
  const [branchesList, setBranchesList] = useState<any[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string>("");

  // Add Staff Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [submittingAdd, setSubmittingAdd] = useState(false);
  const [showStaffPassword, setShowStaffPassword] = useState(false);
  const [createdStaffCreds, setCreatedStaffCreds] = useState<{
    fullName: string;
    email: string;
    phone: string;
    password: string;
    role: string;
  } | null>(null);
  const [showCreatedStaffPassword, setShowCreatedStaffPassword] = useState(true);
  const [copiedCreds, setCopiedCreds] = useState<string | null>(null);

  const copyCredsToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCreds(text);
    toast.success(`${label} copied to clipboard!`);
    setTimeout(() => setCopiedCreds(null), 2000);
  };

  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    phone: "",
    password: "Staff@123",
    role: "BRANCH_MANAGER",
  });

  // Password Reset Modal
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetTargetUser, setResetTargetUser] = useState<any | null>(null);
  const [newPasswordVal, setNewPasswordVal] = useState("Staff@123");
  const [resettingPass, setResettingPass] = useState(false);

  useEffect(() => {
    if (gymId) {
      gymApi
        .listBranches(gymId)
        .then((res) => {
          const list = Array.isArray(res) ? res : (res as any)?.branches || [];
          setBranchesList(list);
          if (list.length === 1) {
            setSelectedBranchId(list[0]._id || list[0].id);
          }
        })
        .catch((err) => {
          console.error("Failed to load branches for staff assignment:", err);
          showApiErrorToast(err, "Failed to load branches");
        });
    }
  }, [gymId]);

  const fetchStaff = async () => {
    if (!gymId) {
      setStaffList([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await staffApi.list(gymId, branchId || undefined);
      const list = Array.isArray(res) ? res : res?.staff || [];
      setStaffList(list);
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || "Failed to load staff list");
      setStaffList([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStaff();
  }, [gymId, branchId]);

  const handleAddStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!gymId) return;
    const targetBranchId =
      branchId || selectedBranchId || (branchesList.length === 1 ? branchesList[0]._id || branchesList[0].id : "");

    if (!targetBranchId && branchesList.length > 1) {
      toast.error("Please select a specific branch for this staff member.");
      return;
    }

    setSubmittingAdd(true);
    try {
      await staffApi.create(gymId, targetBranchId || undefined, {
        ...formData,
        branchId: targetBranchId || undefined,
      });
      toast.success(`Staff member ${formData.fullName} created successfully!`);
      setShowAddModal(false);
      setCreatedStaffCreds({
        fullName: formData.fullName,
        email: formData.email,
        phone: formData.phone,
        password: formData.password || "Staff@123",
        role: formData.role,
      });
      setFormData({
        fullName: "",
        email: "",
        phone: "",
        password: "Staff@123",
        role: "BRANCH_MANAGER",
      });
      fetchStaff();
    } catch (err: any) {
      toast.error(err.response?.data?.message || err.message || "Failed to register staff member");
    } finally {
      setSubmittingAdd(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetTargetUser?._id) return;
    setResettingPass(true);
    try {
      await authApi.adminResetPassword(resetTargetUser._id, newPasswordVal);
      toast.success(`Password reset for ${resetTargetUser.fullName || "Staff"}!`);
      setShowResetModal(false);
      setResetTargetUser(null);
    } catch (err: any) {
      toast.error(err.response?.data?.message || err.message || "Failed to reset password");
    } finally {
      setResettingPass(false);
    }
  };

  // Delete Staff Dialog State
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [deletingStaff, setDeletingStaff] = useState(false);

  const confirmDeleteStaff = async () => {
    if (!deleteTarget || !gymId) return;
    setDeletingStaff(true);
    try {
      await staffApi.delete(gymId, deleteTarget.id, branchId || undefined);
      toast.success(`Staff member "${deleteTarget.name}" deleted successfully.`);
      setDeleteTarget(null);
      fetchStaff();
    } catch (err: any) {
      toast.error(err.response?.data?.message || err.message || "Failed to delete staff member.");
    } finally {
      setDeletingStaff(false);
    }
  };

  const handleDeleteStaff = (staffId: string, name: string) => {
    setDeleteTarget({ id: staffId, name });
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Staff Management"
        backTo="/owner"
        action={
          <div className="flex items-center gap-2">
            <button
              onClick={fetchStaff}
              className="p-2 rounded-full bg-(--color-surface-2) border border-(--color-border) text-(--color-text-muted) hover:text-(--color-text)"
              title="Refresh Staff List"
            >
              <RefreshCw size={14} className={loading ? "animate-spin text-(--color-accent)" : ""} />
            </button>
            {isOwnerOrAdmin && (
              <button
                onClick={() => setShowAddModal(true)}
                className="hidden lg:inline-flex items-center gap-1.5 rounded-full bg-(--color-accent) text-(--color-navbar) text-sm font-bold px-4 py-2 hover:opacity-90 shadow-sm"
              >
                <Plus size={15} /> Add Staff Member
              </button>
            )}
          </div>
        }
      />

      {/* Mobile & Tablet Add Staff Member Button (Full space under header) */}
      {isOwnerOrAdmin && (
        <div className="block lg:hidden w-full">
          <button
            onClick={() => setShowAddModal(true)}
            className="w-full h-10 inline-flex items-center justify-center gap-2 rounded-xl bg-(--color-accent) text-(--color-navbar) text-sm font-bold px-4 hover:opacity-90 active:scale-[0.99] shadow-sm transition-all"
          >
            <Plus size={17} /> Add Staff Member
          </button>
        </div>
      )}

      {resolvingBranch || loading ? (
        <Card className="flex items-center justify-center p-12 text-sm text-(--color-text-muted) gap-2">
          <Loader2 className="w-5 h-5 animate-spin text-(--color-accent)" /> Loading staff members...
        </Card>
      ) : error ? (
        <Card className="text-center py-8">
          <p className="text-sm text-(--color-danger) mb-3">{error}</p>
          <button
            onClick={fetchStaff}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs rounded-full bg-(--color-surface-3) text-(--color-text)"
          >
            <RefreshCw size={14} /> Retry
          </button>
        </Card>
      ) : staffList.length === 0 ? (
        <Card className="text-center py-12 text-(--color-text-muted) space-y-2">
          <Users className="w-10 h-10 mx-auto text-(--color-text-faint)" />
          <p className="text-sm font-medium text-(--color-text)">No staff members found</p>
          <p className="text-xs text-(--color-text-muted)">Click "Add Staff Member" above to create Branch Manager or Front Desk Staff accounts.</p>
        </Card>
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {staffList.map((s) => {
            const name = s.fullName || s.name || "Staff Member";
            const role = s.role || "BRANCH_MANAGER";
            const email = s.email || "N/A";
            const phone = s.phone || "N/A";
            const initials = name
              .split(" ")
              .map((n: string) => n[0])
              .join("")
              .substring(0, 2)
              .toUpperCase();

            return (
              <Card key={s._id || s.id} className="p-4 space-y-3 flex flex-col justify-between">
                {/* Desktop Layout (100% Untouched) */}
                <div className="hidden lg:flex flex-col justify-between h-full space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-(--color-surface-2) font-display text-xs font-bold text-(--color-text)">
                        {initials}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-display text-sm font-semibold text-(--color-text) truncate">{name}</p>
                          {s.branchId?.name && (
                            <span className="text-[11px] px-2 py-0.5 rounded-full bg-(--color-surface-3) text-(--color-text-muted) border border-(--color-border)">
                              📍 {s.branchId.name}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-(--color-text-muted) truncate">{email}</p>
                        <p className="text-xs text-(--color-text-faint) truncate">{phone}</p>
                      </div>
                    </div>
                    <Badge tone={role === "BRANCH_MANAGER" ? "good" : "warn"}>
                      {role === "BRANCH_MANAGER" ? "BRANCH MANAGER" : "RECEPTION / FRONT DESK"}
                    </Badge>
                  </div>

                  {isOwnerOrAdmin && (
                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-(--color-border)">
                      <button
                        onClick={() => {
                          setResetTargetUser(s);
                          setShowResetModal(true);
                        }}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-amber-500/10 text-amber-400 text-xs font-semibold hover:bg-amber-500/20 cursor-pointer"
                        title="Reset Staff Password"
                      >
                        <KeyRound size={13} /> Reset Password
                      </button>
                      <button
                        onClick={() => handleDeleteStaff(s._id || s.id, name)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-rose-500/10 text-rose-400 text-xs font-semibold hover:bg-rose-500/20 cursor-pointer"
                        title="Delete Staff Account"
                      >
                        <Trash2 size={13} /> Delete
                      </button>
                    </div>
                  )}
                </div>

                {/* Mobile & Tablet Layout (Vertically expanded, no overflow) */}
                <div className="lg:hidden space-y-3">
                  <div className="flex items-start justify-between gap-2.5">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-(--color-surface-2) font-display text-xs font-bold text-(--color-text)">
                        {initials}
                      </div>
                      <div className="min-w-0">
                        <h4 className="font-display font-semibold text-sm text-(--color-text) break-words">{name}</h4>
                        <div className="mt-1">
                          <Badge tone={role === "BRANCH_MANAGER" ? "good" : "warn"}>
                            {role === "BRANCH_MANAGER" ? "BRANCH MANAGER" : "RECEPTION"}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </div>

                  {s.branchId?.name && (
                    <div className="pt-0.5">
                      <span className="inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-full bg-(--color-surface-3) text-(--color-text-muted) border border-(--color-border) break-words">
                        <MapPin size={12} className="text-(--color-text-faint) shrink-0" />
                        <span>{s.branchId.name}</span>
                      </span>
                    </div>
                  )}

                  <div className="space-y-1.5 pt-1 text-xs text-(--color-text-muted) border-t border-(--color-border-soft)">
                    {email && email !== "N/A" && (
                      <div className="flex items-center gap-2 break-all">
                        <Mail size={13} className="text-(--color-text-faint) shrink-0" />
                        <span>{email}</span>
                      </div>
                    )}
                    {phone && phone !== "N/A" && (
                      <div className="flex items-center gap-2">
                        <Phone size={13} className="text-(--color-text-faint) shrink-0" />
                        <span className="font-mono text-(--color-text) font-medium">{phone}</span>
                      </div>
                    )}
                  </div>

                  {isOwnerOrAdmin && (
                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-(--color-border-soft)">
                      <button
                        onClick={() => {
                          setResetTargetUser(s);
                          setShowResetModal(true);
                        }}
                        className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-amber-500/10 text-amber-400 text-xs font-semibold hover:bg-amber-500/20 active:scale-95 transition-all"
                        title="Reset Staff Password"
                      >
                        <KeyRound size={14} /> Reset Password
                      </button>
                      <button
                        onClick={() => handleDeleteStaff(s._id || s.id, name)}
                        className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-rose-500/10 text-rose-400 text-xs font-semibold hover:bg-rose-500/20 active:scale-95 transition-all"
                        title="Delete Staff Account"
                      >
                        <Trash2 size={14} /> Delete
                      </button>
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Add Staff Modal */}
      {showAddModal && (
        <Modal onClose={() => setShowAddModal(false)} maxWidth="md" title="Register New Staff Member">
          <form onSubmit={handleAddStaff} className="space-y-4">
            <div className="space-y-3 text-xs">
              {!branchId && (
                <div>
                  <label className="block text-(--color-text-muted) mb-1 font-medium">
                    Branch Assignment <span className="text-red-400">*</span>
                  </label>
                  <select
                    value={selectedBranchId}
                    onChange={(e) => setSelectedBranchId(e.target.value)}
                    required={branchesList.length > 1}
                    className="w-full rounded-xl bg-(--color-surface-2) p-2.5 text-sm text-(--color-text) border border-(--color-border)"
                  >
                    <option value="">Select Branch...</option>
                    {branchesList.map((b) => (
                      <option key={b._id || b.id} value={b._id || b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-(--color-text-muted) mb-1 font-medium">Full Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ramesh Kumar"
                  value={formData.fullName}
                  onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                  className="w-full rounded-xl bg-(--color-surface-2) p-2.5 text-sm text-(--color-text) border border-(--color-border)"
                />
              </div>

              <div>
                <label className="block text-(--color-text-muted) mb-1 font-medium">Email Address</label>
                <input
                  type="email"
                  required
                  placeholder="staff@gym.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full rounded-xl bg-(--color-surface-2) p-2.5 text-sm text-(--color-text) border border-(--color-border)"
                />
              </div>

              <div>
                <label className="block text-(--color-text-muted) mb-1 font-medium">Phone Number</label>
                <input
                  type="tel"
                  required
                  placeholder="+91 9876543210"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full rounded-xl bg-(--color-surface-2) p-2.5 text-sm text-(--color-text) border border-(--color-border)"
                />
              </div>

              <div>
                <label className="block text-(--color-text-muted) mb-1 font-medium">Initial Password</label>
                <div className="relative">
                  <input
                    type={showStaffPassword ? "text" : "password"}
                    required
                    placeholder="e.g. Staff@123"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full rounded-xl bg-(--color-surface-2) p-2.5 pr-10 text-sm text-(--color-text) border border-(--color-border) font-mono focus:outline-none focus:border-(--color-accent)"
                  />
                  <button
                    type="button"
                    onClick={() => setShowStaffPassword(!showStaffPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-(--color-text-muted) hover:text-(--color-text)"
                    tabIndex={-1}
                    title={showStaffPassword ? "Hide password" : "Show password"}
                  >
                    {showStaffPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <CustomSelect
                label="Staff Access Level & Role"
                value={formData.role}
                onChange={(v) => setFormData({ ...formData, role: v })}
                options={[
                  { value: "BRANCH_MANAGER", label: "Branch Manager (Full Branch Admin)" },
                  { value: "KIOSK", label: "Front Desk / Reception Staff" },
                ]}
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="flex-1 py-2.5 rounded-xl bg-(--color-surface-2) font-semibold text-(--color-text) text-xs"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submittingAdd}
                className="flex-1 py-2.5 rounded-xl bg-(--color-accent) text-(--color-navbar) text-xs font-bold shadow-md flex items-center justify-center gap-1.5"
              >
                {submittingAdd ? <Loader2 className="w-4 h-4 animate-spin" /> : "Register Staff Member"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Newly Registered Staff Credentials Modal */}
      {createdStaffCreds && (
        <Modal
          onClose={() => setCreatedStaffCreds(null)}
          maxWidth="md"
          title="Staff Account Created Successfully 🎉"
          subtitle="Share these login credentials directly with the staff member."
        >
          <div className="space-y-4 text-xs">
            <div className="bg-(--color-surface-2) p-4 rounded-xl border border-white/10 space-y-2.5">
              <div className="flex justify-between items-center pb-2 border-b border-white/10">
                <span className="text-(--color-text-muted)">Staff Name:</span>
                <span className="font-bold text-(--color-text)">{createdStaffCreds.fullName}</span>
              </div>
              <div className="flex justify-between items-center pb-2 border-b border-white/10">
                <span className="text-(--color-text-muted)">Login Email:</span>
                <span className="font-bold text-sky-400">{createdStaffCreds.email}</span>
              </div>
              <div className="flex justify-between items-center pb-2 border-b border-white/10">
                <span className="text-(--color-text-muted)">Phone:</span>
                <span className="font-semibold text-(--color-text)">{createdStaffCreds.phone}</span>
              </div>
              <div className="flex justify-between items-center pb-2 border-b border-white/10">
                <span className="text-(--color-text-muted)">Role:</span>
                <Badge tone="accent">
                  {createdStaffCreds.role === "BRANCH_MANAGER" ? "Branch Manager" : "Front Desk / Kiosk Staff"}
                </Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-(--color-text-muted)">Password:</span>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-amber-400 font-mono">
                    {showCreatedStaffPassword ? createdStaffCreds.password : "••••••••••••"}
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowCreatedStaffPassword(!showCreatedStaffPassword)}
                    className="p-1 text-(--color-text-muted) hover:text-(--color-text)"
                    title={showCreatedStaffPassword ? "Hide password" : "Show password"}
                  >
                    {showCreatedStaffPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                  <button
                    type="button"
                    onClick={() => copyCredsToClipboard(createdStaffCreds.password, "Password")}
                    className="p-1 text-(--color-text-muted) hover:text-(--color-accent)"
                    title="Copy Password"
                  >
                    {copiedCreds === createdStaffCreds.password ? (
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
                  const summary = `Staff Name: ${createdStaffCreds.fullName}\nRole: ${createdStaffCreds.role}\nEmail: ${createdStaffCreds.email}\nPassword: ${createdStaffCreds.password}\nLogin URL: https://gymai-one.vercel.app/login`;
                  copyCredsToClipboard(summary, "Staff Credentials");
                }}
                className="py-2.5 px-4 rounded-xl bg-(--color-accent) text-white font-bold shadow-md flex items-center gap-1.5"
              >
                <Copy size={14} /> Copy All Credentials
              </button>
              <button
                type="button"
                onClick={() => setCreatedStaffCreds(null)}
                className="py-2.5 px-4 rounded-xl bg-(--color-surface-2) font-semibold text-(--color-text)"
              >
                Done
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Password Reset Modal */}
      {showResetModal && resetTargetUser && (
        <Modal onClose={() => setShowResetModal(false)} maxWidth="sm" title="Reset Staff Password">
          <form onSubmit={handleResetPassword} className="space-y-3 text-xs">
            <p className="text-(--color-text-muted)">
              Set a new password for <strong className="text-(--color-text)">{resetTargetUser.fullName}</strong> ({resetTargetUser.email}):
            </p>

            <input
              type="text"
              required
              value={newPasswordVal}
              onChange={(e) => setNewPasswordVal(e.target.value)}
              className="w-full rounded-xl bg-(--color-surface-2) p-2.5 text-sm text-(--color-text) border border-(--color-border) font-mono"
            />

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
                className="flex-1 py-2.5 rounded-xl bg-amber-500 text-black font-bold shadow-md flex items-center justify-center gap-1.5"
              >
                {resettingPass ? <Loader2 className="w-4 h-4 animate-spin" /> : "Confirm Reset"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDeleteStaff}
        title="Delete Staff Account"
        description={`Are you sure you want to permanently delete staff member "${deleteTarget?.name}"? This action cannot be undone.`}
        confirmText="Delete Staff"
        tone="danger"
        loading={deletingStaff}
      />
    </div>
  );
}
