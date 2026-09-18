import { useState, useEffect } from "react";
import { Phone, Mail, KeyRound } from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import { authApi } from "@/lib/endpoints";
import { useAuthStore } from "@/store/authStore";
import { toast } from "sonner";

export default function TrainerProfile() {
  const user = useAuthStore((s) => s.user);
  const init = useAuthStore((s) => s.init);

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ fullName: "", phone: "" });

  useEffect(() => {
    if (user) {
      setForm({
        fullName: user.fullName || "",
        phone: user.phone || "",
      });
    }
  }, [user]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await authApi.updateProfile(form);
      await init();
      toast.success("Profile updated successfully!");
      setEditing(false);
    } catch {
      toast.error("Failed to update profile.");
    }
  };

  const userName = user?.fullName || "Trainer User";
  const gymName = String(user?.gymName || "My Gym");
  const branchName = String(user?.branchName || "Main Branch");

  return (
    <div className="space-y-4 max-w-2xl mx-auto w-full">
      <PageHeader title="My Profile" subtitle="Personal details & security settings" backTo="/trainer" />

      <div className="space-y-4">
        {/* Profile Identity Header */}
        <Card sweep className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-(--color-surface-3) font-display text-xl font-bold text-(--color-text)">
              {userName.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
            </div>
            <div>
              <p className="font-display text-lg font-semibold text-(--color-text)">{userName}</p>
              <p className="text-xs text-(--color-text-faint)">Personal Trainer</p>
            </div>
          </div>
          <Badge tone="good">ACTIVE</Badge>
        </Card>

        {/* Contact Information */}
        <Card className="space-y-3">
          <div className="flex items-center justify-between border-b border-(--color-border-soft) pb-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-(--color-text-faint)">Contact Information</p>
            <button
              onClick={() => setEditing(!editing)}
              className="text-xs text-(--color-accent-text) font-medium hover:underline"
            >
              {editing ? "Cancel" : "Edit"}
            </button>
          </div>

          {editing ? (
            <form onSubmit={handleSaveProfile} className="space-y-3 pt-1">
              <div>
                <label className="text-xs text-(--color-text-muted)">Full Name</label>
                <input
                  value={form.fullName}
                  onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                  className="w-full mt-1 p-2 rounded-lg bg-(--color-surface-2) border border-(--color-border) text-sm text-(--color-text) outline-none focus:border-(--color-accent)"
                />
              </div>
              <div>
                <label className="text-xs text-(--color-text-muted)">Phone Number</label>
                <input
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className="w-full mt-1 p-2 rounded-lg bg-(--color-surface-2) border border-(--color-border) text-sm text-(--color-text) outline-none focus:border-(--color-accent)"
                />
              </div>
              <button
                type="submit"
                className="px-4 py-2 text-xs font-medium rounded-full bg-(--color-accent) text-white"
              >
                Save Changes
              </button>
            </form>
          ) : (
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2 text-(--color-text-muted)">
                <Mail size={15} /> <span>{user?.email || "—"}</span>
              </div>
              <div className="flex items-center gap-2 text-(--color-text-muted)">
                <Phone size={15} /> <span>{user?.phone || "—"}</span>
              </div>
            </div>
          )}
        </Card>

        {/* Organization Info */}
        <Card className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-(--color-text-faint)">Gym & Assignment</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <div className="rounded-xl bg-(--color-surface-2) p-3">
              <p className="text-xs text-(--color-text-faint)">Gym Organization</p>
              <p className="font-semibold text-(--color-text) mt-0.5 truncate">{gymName}</p>
            </div>
            <div className="rounded-xl bg-(--color-surface-2) p-3">
              <p className="text-xs text-(--color-text-faint)">Branch Assignment</p>
              <p className="font-semibold text-(--color-text) mt-0.5 truncate">{branchName}</p>
            </div>
          </div>
        </Card>

        {/* Security & Password */}
        <Card className="space-y-3">
          <div className="flex items-center gap-2 border-b border-(--color-border-soft) pb-2">
            <KeyRound className="text-(--color-accent)" size={16} />
            <p className="text-xs font-semibold uppercase tracking-wide text-(--color-text-faint)">Security & Password</p>
          </div>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const target = e.target as any;
              const currentPassword = target.currentPassword.value;
              const newPassword = target.newPassword.value;
              const confirmPassword = target.confirmPassword.value;

              if (newPassword !== confirmPassword) {
                toast.error("New passwords do not match");
                return;
              }
              if (newPassword.length < 8 || !/(?=.*[a-zA-Z])(?=.*[0-9])/.test(newPassword)) {
                toast.error("Password must be at least 8 characters with letters & numbers");
                return;
              }

              try {
                await authApi.changePassword({ currentPassword, newPassword });
                toast.success("Password updated successfully!");
                target.reset();
              } catch (err: any) {
                toast.error(err.response?.data?.message || err.message || "Failed to change password");
              }
            }}
            className="space-y-3 text-sm pt-1"
          >
            <div>
              <label className="text-xs text-(--color-text-muted)">Current Password</label>
              <input
                name="currentPassword"
                type="password"
                required
                placeholder="Current password"
                className="w-full mt-1 p-2 rounded-lg bg-(--color-surface-2) border border-(--color-border) text-sm text-(--color-text) outline-none focus:border-(--color-accent)"
              />
            </div>
            <div className="grid sm:grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-(--color-text-muted)">New Password</label>
                <input
                  name="newPassword"
                  type="password"
                  required
                  placeholder="New password (8+ chars)"
                  className="w-full mt-1 p-2 rounded-lg bg-(--color-surface-2) border border-(--color-border) text-sm text-(--color-text) outline-none focus:border-(--color-accent)"
                />
              </div>
              <div>
                <label className="text-xs text-(--color-text-muted)">Confirm New Password</label>
                <input
                  name="confirmPassword"
                  type="password"
                  required
                  placeholder="Confirm new password"
                  className="w-full mt-1 p-2 rounded-lg bg-(--color-surface-2) border border-(--color-border) text-sm text-(--color-text) outline-none focus:border-(--color-accent)"
                />
              </div>
            </div>
            <div className="flex justify-end pt-1">
              <button
                type="submit"
                className="px-4 py-2 text-xs font-semibold rounded-full bg-(--color-accent) text-white hover:bg-(--color-accent-strong)"
              >
                Update Password
              </button>
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
}
