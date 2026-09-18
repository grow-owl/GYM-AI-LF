import { useState, useEffect } from "react";
import { Building2, Bell, ShieldCheck, Plus, Loader2, Download, Trash2, Megaphone, Send, RefreshCw, KeyRound } from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Modal from "@/components/ui/Modal";
import CustomSelect from "@/components/ui/CustomSelect";
import { gymApi, privacyApi, notificationApi, jobApi, authApi } from "@/lib/endpoints";
import { useAuthStore } from "@/store/authStore";
import { invalidateBranchesCache } from "@/hooks/useGymBranch";
import { toast } from "sonner";

import { api } from "@/lib/api";
import type { IBranch, IGym } from "@/types";

type TabKey = "branches" | "notifications" | "compliance" | "security";

export default function Settings() {
  const user = useAuthStore((s) => s.user);
  const [activeTab, setActiveTab] = useState<TabKey>("branches");
  const [branches, setBranches] = useState<IBranch[]>([]);
  const [, setGymInfo] = useState<Partial<IGym>>(() => ({
    name: user?.gymName || "My Gym Center",
  }));
  const [loading, setLoading] = useState(true);

  // Clean up legacy stale localStorage entries on mount

  // Change password state
  const [passForm, setPassForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [changingPass, setChangingPass] = useState(false);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passForm.newPassword !== passForm.confirmPassword) {
      toast.error("New passwords do not match");
      return;
    }
    if (passForm.newPassword.length < 8 || !/(?=.*[a-zA-Z])(?=.*[0-9])/.test(passForm.newPassword)) {
      toast.error("New password must be at least 8 characters long and include letters and numbers");
      return;
    }
    setChangingPass(true);
    try {
      await api.patch('/auth/change-password', {
        currentPassword: passForm.currentPassword,
        newPassword: passForm.newPassword,
      });
      toast.success("Password changed successfully!");
      setPassForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
    } catch (err: any) {
      toast.error(err.response?.data?.message || err.message || "Failed to change password");
    } finally {
      setChangingPass(false);
    }
  };

  // Channel toggles
  const [broadcastEnabled, setBroadcastEnabled] = useState(true);

  // Broadcast state
  const [broadcastTitle, setBroadcastTitle] = useState("");
  const [broadcastMessage, setBroadcastMessage] = useState("");
  const [broadcastTargetRole, setBroadcastTargetRole] = useState("ALL");
  const [sendingBroadcast, setSendingBroadcast] = useState(false);

  const handleSendBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!broadcastTitle.trim()) {
      toast.error("Announcement title is required.");
      return;
    }
    if (!broadcastMessage.trim()) {
      toast.error("Announcement message is required.");
      return;
    }
    const gymId = user?.gymId || "";
    if (!gymId) {
      toast.error("Gym ID not found.");
      return;
    }
    setSendingBroadcast(true);
    try {
      const res = await notificationApi.broadcast(gymId, {
        title: broadcastTitle.trim(),
        body: broadcastMessage.trim(),
        message: broadcastMessage.trim(),
        targetRole: broadcastTargetRole,
      });
      toast.success(res?.message || "Gym broadcast announcement sent successfully!");
      setBroadcastTitle("");
      setBroadcastMessage("");
      setBroadcastTargetRole("ALL");
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || err.response?.data?.message || err.message || "Failed to send broadcast announcement.");
    } finally {
      setSendingBroadcast(false);
    }
  };

  // Modals state
  const [showAddBranchModal, setShowAddBranchModal] = useState(false);
  const [submittingBranch, setSubmittingBranch] = useState(false);

  const [branchForm, setBranchForm] = useState({
    name: "",
    contactPhone: "",
    timezone: "Asia/Kolkata",
    line1: "",
    city: "",
    state: "",
    pincode: "",
    country: "India",
  });

  const fetchData = async () => {
    const activeGymId = user?.gymId || "";
    if (!activeGymId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [bRes, gRes] = await Promise.all([
        gymApi.listBranches(activeGymId).catch(() => null),
        gymApi.getGymById(activeGymId).catch(() => null),
      ]);

      const bList: IBranch[] = Array.isArray(bRes) ? bRes : bRes?.branches || [];
      setBranches(bList);

      if (gRes?.gym) {
        setGymInfo(gRes.gym);
      }
    } catch {
      // keep current state on error
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [user]);

  const handleCreateBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    const activeGymId = user?.gymId || "";
    if (!activeGymId) {
      toast.error("Active gym ID not found.");
      return;
    }
    setSubmittingBranch(true);

    try {
      const res = await gymApi.createBranch(activeGymId, {
        name: branchForm.name.trim(),
        contactPhone: branchForm.contactPhone.trim(),
        timezone: branchForm.timezone || "Asia/Kolkata",
        address: {
          line1: branchForm.line1.trim() || "",
          city: branchForm.city.trim() || "",
          state: branchForm.state.trim() || "",
          pincode: branchForm.pincode.trim() || "",
          country: branchForm.country.trim() || "India",
        },
      });

      const newBranch = (res as any)?.branch || (res as any)?.data?.branch;
      if (newBranch) {
        setBranches((prev) => [...prev, newBranch]);
      } else {
        await fetchData();
      }

      invalidateBranchesCache(activeGymId);
      window.dispatchEvent(new CustomEvent("gymai-branch-changed"));

      toast.success(`Branch ${branchForm.name} created successfully!`);
      setShowAddBranchModal(false);
      setBranchForm({
        name: "",
        contactPhone: "",
        timezone: "Asia/Kolkata",
        line1: "",
        city: "",
        state: "",
        pincode: "",
        country: "India",
      });
    } catch (err: any) {
      toast.error(err.response?.data?.message || err.message || "Failed to create branch");
    } finally {
      setSubmittingBranch(false);
    }
  };

  const handleExportData = async () => {
    try {
      const data = await privacyApi.exportData();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `gym-saas-user-data-${user?._id || "me"}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("GDPR User Data exported successfully!");
    } catch {
      toast.error("Failed to export compliance data.");
    }
  };

  const handleRequestDeletion = async () => {
    if (!confirm("Are you sure you want to submit an account deletion request?")) return;
    try {
      await privacyApi.requestDeletion();
      toast.success("Account deletion request submitted. An admin will review it.");
    } catch {
      toast.error("Failed to submit deletion request.");
    }
  };

  const handleCancelDeletion = async () => {
    try {
      await privacyApi.cancelDeletion();
      toast.success("Account deletion request cancelled successfully!");
    } catch {
      toast.error("Failed to cancel deletion request.");
    }
  };

  const handleRunReminders = async () => {
    const activeId = user?.gymId || "";
    if (!activeId) return;
    try {
      await jobApi.runReminders(activeId);
      toast.success("Automated membership reminders job triggered successfully!");
    } catch {
      toast.error("Failed to run automated reminders.");
    }
  };

  const handleLogoutAll = async () => {
    if (!confirm("Are you sure you want to log out from all active devices?")) return;
    try {
      await authApi.logoutAll();
      toast.success("Logged out from all devices.");
      useAuthStore.getState().logout();
    } catch {
      toast.error("Failed to log out from all devices.");
    }
  };

  const tabs: { key: TabKey; icon: any; label: string; desc: string }[] = [
    { key: "branches", icon: Building2, label: "Gym & Branches", desc: "Branch locations & address setup" },
    { key: "notifications", icon: Bell, label: "Notifications", desc: "In-app alerts & broadcast preferences" },
    { key: "compliance", icon: ShieldCheck, label: "Data & Compliance", desc: "Export data & deletion requests" },
    { key: "security", icon: KeyRound, label: "Security & Password", desc: "Change account password" },
  ];

  return (
    <div className="space-y-5">
      <PageHeader title="Settings" backTo="/owner" />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {tabs.map(({ key, icon: Icon, label }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`flex items-center gap-2 p-2.5 sm:p-3 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
              activeTab === key
                ? "bg-(--color-accent-soft) border-(--color-accent) text-(--color-accent-text) shadow-sm"
                : "bg-(--color-surface) border-(--color-border) text-(--color-text-muted) hover:text-(--color-text)"
            }`}
          >
            <Icon size={16} className="shrink-0" />
            <span className="text-left leading-tight break-words">{label}</span>
          </button>
        ))}
      </div>

      {loading ? (
        <Card className="flex items-center justify-center p-12 text-sm text-(--color-text-muted) gap-2">
          <Loader2 className="w-5 h-5 animate-spin text-(--color-accent)" /> Loading settings...
        </Card>
      ) : (
        <div className="space-y-4">
          {/* Gym & Branches Tab */}
          {activeTab === "branches" && (
            <Card className="space-y-4">
              <div className="flex items-center justify-between gap-3 border-b border-(--color-border-soft) pb-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-(--color-text)">Gym Branches ({branches.length})</p>
                </div>
                <button
                  onClick={() => setShowAddBranchModal(true)}
                  className="inline-flex items-center gap-1.5 rounded-full bg-(--color-accent) text-(--color-navbar) text-xs font-bold px-3.5 sm:px-4 py-2 hover:opacity-90 shrink-0 whitespace-nowrap cursor-pointer shadow-sm"
                >
                  <Plus size={14} /> Add Branch
                </button>
              </div>

              {branches.length === 0 ? (
                <div className="py-8 text-center text-xs text-(--color-text-faint)">
                  No branches configured. Click "Add Branch" to add your first location.
                </div>
              ) : (
                <div className="grid sm:grid-cols-2 gap-3">
                  {branches.map((b) => (
                    <div key={b._id || b.id} className="p-4 rounded-xl bg-(--color-surface-2) space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-(--color-text) min-w-0 truncate">{b.name}</p>
                        {b.isPrimary && <Badge tone="accent" className="shrink-0">Primary</Badge>}
                      </div>
                      <p className="text-xs text-(--color-text-muted)">Phone: {b.contactPhone || "—"}</p>
                      <p className="text-xs text-(--color-text-faint)">Timezone: {b.timezone || "Asia/Kolkata"}</p>
                      {b.address && (
                        <p className="text-xs text-(--color-text-faint) pt-1 border-t border-(--color-border-soft)/50">
                          {[b.address.line1, b.address.city, b.address.state, b.address.pincode].filter(Boolean).join(", ")}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}

            </Card>
          )}

          {/* Notifications Tab */}
          {activeTab === "notifications" && (
            <Card className="space-y-4">
              <p className="text-sm font-semibold text-(--color-text) border-b border-(--color-border-soft) pb-3">
                Notification Channel Preferences & Member Broadcasts
              </p>
              <div className="space-y-3 text-xs text-(--color-text-muted)">
                <div className="flex items-center justify-between p-3 rounded-xl bg-(--color-surface-2)">
                  <div>
                    <p className="font-medium text-(--color-text)">In-App Broadcast & Push Notifications</p>
                    <p className="text-(--color-text-faint)">Broadcast announcements, renewals, and workout alerts sent to member mobile apps</p>
                  </div>
                  <button
                    onClick={() => {
                      setBroadcastEnabled(!broadcastEnabled);
                      toast.success(`In-App Broadcasts ${!broadcastEnabled ? "Enabled" : "Disabled"}`);
                    }}
                  >
                    <Badge tone={broadcastEnabled ? "good" : "danger"}>{broadcastEnabled ? "Enabled" : "Disabled"}</Badge>
                  </button>
                </div>
              </div>

              {/* Send Announcement Form */}
              <div className="pt-4 border-t border-(--color-border-soft) space-y-3">
                <div className="flex items-center gap-2">
                  <Megaphone className="w-4 h-4 text-(--color-accent)" />
                  <p className="text-xs font-semibold text-(--color-text) uppercase tracking-wide">Send Gym-wide Announcement</p>
                </div>
                <form onSubmit={handleSendBroadcast} className="p-4 rounded-2xl bg-(--color-surface-2) border border-(--color-border) space-y-3">
                  <div className="grid sm:grid-cols-3 gap-3">
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-medium text-(--color-text-muted) mb-1">Announcement Title</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Special Holiday Hours / Maintenance Notice"
                        value={broadcastTitle}
                        onChange={(e) => setBroadcastTitle(e.target.value)}
                        className="w-full rounded-xl bg-(--color-surface) p-2.5 text-xs text-(--color-text) border border-(--color-border) outline-none focus:border-(--color-accent)"
                      />
                    </div>
                    <div>
                      <CustomSelect
                        label="Target Audience"
                        value={broadcastTargetRole}
                        onChange={(val) => setBroadcastTargetRole(val)}
                        options={[
                          { label: "All Gym Users", value: "ALL" },
                          { label: "Members Only", value: "MEMBER" },
                          { label: "Trainers Only", value: "TRAINER" },
                        ]}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-(--color-text-muted) mb-1">Message Content</label>
                    <textarea
                      required
                      rows={3}
                      placeholder="Write your announcement details here..."
                      value={broadcastMessage}
                      onChange={(e) => setBroadcastMessage(e.target.value)}
                      className="w-full rounded-xl bg-(--color-surface) p-2.5 text-xs text-(--color-text) border border-(--color-border) outline-none focus:border-(--color-accent) resize-none"
                    />
                  </div>
                  <div className="flex justify-end pt-1">
                    <button
                      type="submit"
                      disabled={sendingBroadcast}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-(--color-accent) text-(--color-navbar) text-xs font-bold hover:opacity-90 disabled:opacity-50 shadow-sm"
                    >
                      {sendingBroadcast ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                      {sendingBroadcast ? "Sending Broadcast..." : "Send Announcement"}
                    </button>
                  </div>
                </form>
              </div>

              {/* Background Reminders Runner */}
              <div className="pt-3 border-t border-(--color-border-soft) flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl bg-(--color-surface-2)">
                <div>
                  <p className="text-xs font-semibold text-(--color-text)">Membership Renewal Reminders</p>
                  <p className="text-[11px] text-(--color-text-faint)">Run the background scheduler manually to trigger in-app renewal reminders for expiring memberships.</p>
                </div>
                <button
                  type="button"
                  onClick={handleRunReminders}
                  className="inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-full bg-(--color-accent) text-(--color-navbar) text-xs font-bold hover:opacity-90 cursor-pointer whitespace-nowrap shrink-0 shadow-sm"
                >
                  <RefreshCw size={13} /> Run Reminders Job Now
                </button>
              </div>
            </Card>
          )}

          {/* Data & Compliance Tab */}
          {activeTab === "compliance" && (
            <Card className="space-y-4">
              <p className="text-sm font-semibold text-(--color-text) border-b border-(--color-border-soft) pb-3">
                GDPR & Data Privacy Actions
              </p>
              <div className="grid sm:grid-cols-3 gap-3">
                <button
                  onClick={handleExportData}
                  className="flex items-center gap-2 p-4 rounded-xl bg-(--color-surface-2) border border-(--color-border) text-left hover:border-(--color-accent) transition-colors cursor-pointer"
                >
                  <Download size={18} className="text-(--color-accent) shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-(--color-text)">Export User Data</p>
                    <p className="text-xs text-(--color-text-faint) mt-0.5">Download JSON copy of account data</p>
                  </div>
                </button>

                <button
                  onClick={handleCancelDeletion}
                  className="flex items-center gap-2 p-4 rounded-xl bg-(--color-surface-2) border border-emerald-500/30 text-left hover:border-emerald-500 transition-colors cursor-pointer"
                >
                  <RefreshCw size={18} className="text-emerald-400 shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-emerald-400">Cancel Deletion Request</p>
                    <p className="text-xs text-(--color-text-faint) mt-0.5">Withdraw account purge request</p>
                  </div>
                </button>

                <button
                  onClick={handleRequestDeletion}
                  className="flex items-center gap-2 p-4 rounded-xl bg-(--color-surface-2) border border-rose-500/30 text-left hover:border-rose-500 transition-colors cursor-pointer"
                >
                  <Trash2 size={18} className="text-rose-400 shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-rose-400">Request Deletion</p>
                    <p className="text-xs text-(--color-text-faint) mt-0.5">Purge account and personal data</p>
                  </div>
                </button>
              </div>
            </Card>
          )}

          {/* Security & Password Tab */}
          {activeTab === "security" && (
            <Card className="space-y-4 max-w-lg">
              <div className="flex items-center gap-2 border-b border-(--color-border-soft) pb-3">
                <KeyRound className="text-(--color-accent)" size={18} />
                <div>
                  <h3 className="text-sm font-semibold text-(--color-text)">Change Account Password</h3>
                  <p className="text-xs text-(--color-text-faint)">Update your login credentials securely</p>
                </div>
              </div>

              <form onSubmit={handleChangePassword} className="space-y-3.5">
                <div>
                  <label className="text-xs font-medium text-(--color-text-muted)">Current Password</label>
                  <input
                    type="password"
                    required
                    value={passForm.currentPassword}
                    onChange={(e) => setPassForm({ ...passForm, currentPassword: e.target.value })}
                    placeholder="Enter your current password"
                    className="w-full mt-1 p-2.5 rounded-xl bg-(--color-surface-2) border border-(--color-border) text-sm text-(--color-text) outline-none focus:border-(--color-accent)"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-(--color-text-muted)">New Password</label>
                  <input
                    type="password"
                    required
                    value={passForm.newPassword}
                    onChange={(e) => setPassForm({ ...passForm, newPassword: e.target.value })}
                    placeholder="At least 8 characters (letters & numbers)"
                    className="w-full mt-1 p-2.5 rounded-xl bg-(--color-surface-2) border border-(--color-border) text-sm text-(--color-text) outline-none focus:border-(--color-accent)"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-(--color-text-muted)">Confirm New Password</label>
                  <input
                    type="password"
                    required
                    value={passForm.confirmPassword}
                    onChange={(e) => setPassForm({ ...passForm, confirmPassword: e.target.value })}
                    placeholder="Re-enter new password"
                    className="w-full mt-1 p-2.5 rounded-xl bg-(--color-surface-2) border border-(--color-border) text-sm text-(--color-text) outline-none focus:border-(--color-accent)"
                  />
                </div>

                <div className="pt-2 flex flex-col sm:flex-row gap-2.5 sm:items-center sm:justify-between">
                  <button
                    type="button"
                    onClick={handleLogoutAll}
                    className="w-full sm:w-auto px-4 py-2.5 text-xs font-semibold rounded-xl bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 transition-all cursor-pointer whitespace-nowrap text-center order-2 sm:order-1"
                  >
                    Logout from All Devices
                  </button>
                  <button
                    type="submit"
                    disabled={changingPass}
                    className="w-full sm:w-auto px-5 py-2.5 text-xs font-bold rounded-xl bg-(--color-accent) text-(--color-navbar) hover:bg-(--color-accent-strong) disabled:opacity-50 cursor-pointer whitespace-nowrap text-center order-1 sm:order-2 shadow-sm"
                  >
                    {changingPass ? "Updating Password..." : "Update Password"}
                  </button>
                </div>
              </form>
            </Card>
          )}
        </div>
      )}

      {/* Add Branch Modal */}
      {showAddBranchModal && (
        <Modal onClose={() => setShowAddBranchModal(false)} maxWidth="md" title="Add New Gym Branch">
          <form onSubmit={handleCreateBranch} className="space-y-3">
            <div>
              <label className="text-xs text-(--color-text-muted)">Branch Name</label>
              <input
                required
                value={branchForm.name}
                onChange={(e) => setBranchForm({ ...branchForm, name: e.target.value })}
                placeholder="e.g. Downtown Branch"
                className="w-full mt-1 p-2 rounded-lg bg-(--color-surface-2) border border-(--color-border) text-sm text-(--color-text) outline-none"
              />
            </div>

            <div>
              <label className="text-xs text-(--color-text-muted)">Contact Phone</label>
              <input
                required
                value={branchForm.contactPhone}
                onChange={(e) => setBranchForm({ ...branchForm, contactPhone: e.target.value })}
                placeholder="+91 9876543210"
                className="w-full mt-1 p-2 rounded-lg bg-(--color-surface-2) border border-(--color-border) text-sm text-(--color-text) outline-none"
              />
            </div>

            <div>
              <label className="text-xs text-(--color-text-muted)">Address Line 1</label>
              <input
                required
                value={branchForm.line1}
                onChange={(e) => setBranchForm({ ...branchForm, line1: e.target.value })}
                placeholder="123 Fitness Street"
                className="w-full mt-1 p-2 rounded-lg bg-(--color-surface-2) border border-(--color-border) text-sm text-(--color-text) outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-(--color-text-muted)">City</label>
                <input
                  required
                  value={branchForm.city}
                  onChange={(e) => setBranchForm({ ...branchForm, city: e.target.value })}
                  placeholder="Mumbai"
                  className="w-full mt-1 p-2 rounded-lg bg-(--color-surface-2) border border-(--color-border) text-sm text-(--color-text) outline-none"
                />
              </div>
              <div>
                <label className="text-xs text-(--color-text-muted)">State</label>
                <input
                  required
                  value={branchForm.state}
                  onChange={(e) => setBranchForm({ ...branchForm, state: e.target.value })}
                  placeholder="Maharashtra"
                  className="w-full mt-1 p-2 rounded-lg bg-(--color-surface-2) border border-(--color-border) text-sm text-(--color-text) outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-(--color-text-muted)">Pincode</label>
                <input
                  required
                  value={branchForm.pincode}
                  onChange={(e) => setBranchForm({ ...branchForm, pincode: e.target.value })}
                  placeholder="400001"
                  className="w-full mt-1 p-2 rounded-lg bg-(--color-surface-2) border border-(--color-border) text-sm text-(--color-text) outline-none"
                />
              </div>
              <div>
                <label className="text-xs text-(--color-text-muted)">Timezone</label>
                <input
                  required
                  value={branchForm.timezone}
                  onChange={(e) => setBranchForm({ ...branchForm, timezone: e.target.value })}
                  className="w-full mt-1 p-2 rounded-lg bg-(--color-surface-2) border border-(--color-border) text-sm text-(--color-text) outline-none"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowAddBranchModal(false)}
                className="px-4 py-2 text-xs font-medium text-(--color-text-muted)"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submittingBranch}
                className="px-4 py-2 text-xs font-bold rounded-full bg-(--color-accent) text-(--color-navbar) disabled:opacity-50"
              >
                {submittingBranch ? "Creating..." : "Create Branch"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
