import { useState, useEffect } from "react";
import { Building2, Search, Plus, Filter, ShieldCheck, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { gymApi, authApi } from "@/lib/endpoints";
import { useFormValidation } from "@/lib/useFormValidation";
import { toast } from "sonner";
import CustomSelect from "@/components/ui/CustomSelect";

export default function Gyms() {
  const [gyms, setGyms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [tempCredentials, setTempCredentials] = useState<{ email: string; pass: string } | null>(null);

  const { values, errors, touched, handleChange, handleBlur, validateAll, resetForm } = useFormValidation(
    {
      name: "",
      ownerName: "",
      ownerEmail: "",
      ownerPhone: "",
      subscriptionPlan: "PRO" as "STARTER" | "PRO" | "ENTERPRISE",
    },
    {
      name: { required: "Gym name is required" },
      ownerName: { required: "Owner name is required" },
      ownerEmail: { required: "Owner email is required", email: "Enter a valid email address" },
      ownerPhone: { required: "Phone is required", phone: "Enter a valid 10-digit mobile number" },
    }
  );

  const fetchGyms = async () => {
    setLoading(true);
    try {
      const res = await gymApi.listAllGyms();
      setGyms(res.gyms || []);
    } catch {
      toast.error("Failed to load gym tenants list from database.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGyms();
  }, []);

  const handleToggleStatus = async (gymId: string, currentStatus: string) => {
    const nextStatus = currentStatus === "ACTIVE" ? "SUSPENDED" : "ACTIVE";
    try {
      await gymApi.updateGym(gymId, { status: nextStatus });
      toast.success(`Gym status updated to ${nextStatus}!`);
      fetchGyms();
    } catch (err: any) {
      toast.error(err.response?.data?.message || err.message || "Failed to update gym status");
    }
  };

  const handleCreateGym = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateAll()) return;
    setSubmitting(true);
    setTempCredentials(null);

    try {
      const res = await authApi.registerOwner({
        fullName: values.ownerName,
        email: values.ownerEmail,
        phone: values.ownerPhone,
        gymName: values.name,
        branchName: "Main Branch",
        plan: values.subscriptionPlan,
      });

      const serverPass = res?.tempPassword || "";
      setTempCredentials({ email: values.ownerEmail, pass: serverPass });
      setIsModalOpen(false);
      resetForm();
      fetchGyms();
    } catch (err: any) {
      toast.error(err.response?.data?.message || err.message || "Failed to onboard gym owner account");
    } finally {
      setSubmitting(false);
    }
  };

  const filteredGyms = gyms.filter((gym) => {
    const ownerName = gym.owner?.fullName || "";
    const ownerEmail = gym.owner?.email || "";
    const matchesSearch =
      gym.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ownerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ownerEmail.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "ALL" || gym.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-(--color-text) flex items-center gap-2">
            <Building2 className="text-(--color-accent)" size={26} /> Gym Tenants Management
          </h1>
          <p className="text-sm text-(--color-text-muted)">
            Manage all registered gym accounts, subscription plans, and tenant access across the SaaS platform.
          </p>
        </div>

        <button
          onClick={() => {
            setTempCredentials(null);
            setIsModalOpen(true);
          }}
          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-(--color-accent) text-white font-medium rounded-xl hover:bg-(--color-accent-strong) transition-colors shadow-lg shadow-(--color-accent-soft)"
        >
          <Plus size={18} /> Onboard New Gym
        </button>
      </div>

      {tempCredentials && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 space-y-2 animate-fade-in text-xs sm:text-sm">
          <div className="flex items-center gap-2 font-bold">
            <CheckCircle2 size={20} />
            <span>Gym Tenant Successfully Onboarded!</span>
          </div>
          <p>Provide these credentials to the Gym Owner so they can log in to their dashboard:</p>
          <div className="p-3 bg-black/30 rounded-lg font-mono space-y-1 select-all border border-white/5 max-w-md">
            <p><span className="text-(--color-text-faint)">Email:</span> {tempCredentials.email}</p>
            <p><span className="text-(--color-text-faint)">Password:</span> {tempCredentials.pass}</p>
          </div>
          <p className="text-xs text-emerald-500/70 font-semibold">⚠️ Note: Copy these now. The password cannot be recovered once this notice is dismissed.</p>
        </div>
      )}

      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-(--color-text-faint)" />
          <input
            type="text"
            placeholder="Search gym by name, owner or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-(--color-border) bg-(--color-surface) text-sm text-(--color-text) placeholder:text-(--color-text-faint) outline-none focus:border-(--color-accent)"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter size={18} className="text-(--color-text-faint)" />
          <CustomSelect
            value={statusFilter}
            onChange={(val) => setStatusFilter(val)}
            options={[
              { value: "ALL", label: "All Statuses" },
              { value: "ACTIVE", label: "Active Only" },
              { value: "SUSPENDED", label: "Suspended Only" },
            ]}
            className="w-44"
          />
        </div>
      </div>

      {/* Gym Tenants Table */}
      <div className="rounded-2xl border border-(--color-border) bg-(--color-surface) overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          {loading ? (
            <div className="p-12 text-center text-sm text-(--color-text-muted) flex items-center justify-center gap-2">
              <Loader2 className="w-5 h-5 animate-spin text-(--color-accent)" /> Loading registered gyms...
            </div>
          ) : (
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-(--color-border) bg-white/5 text-xs text-(--color-text-muted) uppercase">
                  <th className="p-4 font-semibold">Gym Name</th>
                  <th className="p-4 font-semibold">Owner Info</th>
                  <th className="p-4 font-semibold">Plan</th>
                  <th className="p-4 font-semibold">Branches</th>
                  <th className="p-4 font-semibold">Status</th>
                  <th className="p-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-(--color-border)">
                {filteredGyms.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-(--color-text-muted)">
                      No gym tenants found matching your criteria.
                    </td>
                  </tr>
                ) : (
                  filteredGyms.map((gym) => {
                    const gymId = gym._id || gym.id;
                    const ownerName = gym.owner?.fullName || "—";
                    const ownerEmail = gym.owner?.email || "";
                    const ownerPhone = gym.owner?.phone || "";
                    const branchCount = gym.branches?.length || 0;

                    return (
                      <tr key={gymId} className="hover:bg-white/5 transition-colors">
                        <td className="p-4">
                          <p className="font-semibold text-(--color-text)">{gym.name}</p>
                          <p className="text-xs text-(--color-text-faint)">ID: {gymId}</p>
                        </td>
                        <td className="p-4">
                          <p className="font-medium text-(--color-text)">{ownerName}</p>
                          <p className="text-xs text-(--color-text-muted)">
                            {ownerEmail} {ownerPhone ? `• ${ownerPhone}` : ""}
                          </p>
                        </td>
                        <td className="p-4">
                          <span
                            className={`inline-flex px-2.5 py-1 text-xs font-semibold rounded-full ${
                              gym.plan === "ENTERPRISE"
                                ? "bg-purple-500/20 text-purple-400 border border-purple-500/30"
                                : gym.plan === "PRO"
                                ? "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                                : "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                            }`}
                          >
                            {gym.plan}
                          </span>
                        </td>
                        <td className="p-4 font-medium text-(--color-text)">{branchCount}</td>
                        <td className="p-4">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-full ${
                              gym.status === "ACTIVE"
                                ? "bg-emerald-500/10 text-emerald-400"
                                : "bg-rose-500/10 text-rose-400"
                            }`}
                          >
                            {gym.status === "ACTIVE" ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                            {gym.status}
                          </span>
                        </td>
                        <td className="p-4 text-right">
                          <button
                            onClick={() => handleToggleStatus(gymId, gym.status)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                              gym.status === "ACTIVE"
                                ? "bg-rose-500/10 text-rose-400 hover:bg-rose-500/20"
                                : "bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20"
                            }`}
                          >
                            {gym.status === "ACTIVE" ? "Suspend Gym" : "Activate Gym"}
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Onboard Gym Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="w-full max-w-lg rounded-2xl border border-(--color-border) bg-(--color-surface) p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-(--color-border) pb-4">
              <h2 className="text-lg font-bold text-(--color-text) flex items-center gap-2">
                <ShieldCheck className="text-(--color-accent)" size={20} /> Onboard New Gym Tenant
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="text-(--color-text-faint) hover:text-(--color-text)">
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateGym} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-(--color-text-muted) mb-1">Gym Name</label>
                <input
                  type="text"
                  placeholder="e.g. FitPulse Arena"
                  value={values.name}
                  onChange={(e) => handleChange("name", e.target.value)}
                  onBlur={() => handleBlur("name")}
                  className={`w-full px-3.5 py-2.5 rounded-xl border bg-(--color-surface) text-sm text-(--color-text) outline-none focus:border-(--color-accent) ${
                    touched.name && errors.name ? "border-rose-500" : "border-(--color-border)"
                  }`}
                />
                {touched.name && errors.name && <p className="text-xs text-rose-400 mt-1">{errors.name}</p>}
              </div>

              <div>
                <label className="block text-xs font-medium text-(--color-text-muted) mb-1">Owner Full Name</label>
                <input
                  type="text"
                  placeholder="e.g. Ramesh Kumar"
                  value={values.ownerName}
                  onChange={(e) => handleChange("ownerName", e.target.value)}
                  onBlur={() => handleBlur("ownerName")}
                  className={`w-full px-3.5 py-2.5 rounded-xl border bg-(--color-surface) text-sm text-(--color-text) outline-none focus:border-(--color-accent) ${
                    touched.ownerName && errors.ownerName ? "border-rose-500" : "border-(--color-border)"
                  }`}
                />
                {touched.ownerName && errors.ownerName && <p className="text-xs text-rose-400 mt-1">{errors.ownerName}</p>}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-(--color-text-muted) mb-1">Owner Email</label>
                  <input
                    type="email"
                    placeholder="owner@gym.com"
                    value={values.ownerEmail}
                    onChange={(e) => handleChange("ownerEmail", e.target.value)}
                    onBlur={() => handleBlur("ownerEmail")}
                    className={`w-full px-3.5 py-2.5 rounded-xl border bg-(--color-surface) text-sm text-(--color-text) outline-none focus:border-(--color-accent) ${
                      touched.ownerEmail && errors.ownerEmail ? "border-rose-500" : "border-(--color-border)"
                    }`}
                  />
                  {touched.ownerEmail && errors.ownerEmail && <p className="text-xs text-rose-400 mt-1">{errors.ownerEmail}</p>}
                </div>

                <div>
                  <label className="block text-xs font-medium text-(--color-text-muted) mb-1">Owner Phone</label>
                  <input
                    type="text"
                    placeholder="9876543210"
                    value={values.ownerPhone}
                    onChange={(e) => handleChange("ownerPhone", e.target.value)}
                    onBlur={() => handleBlur("ownerPhone")}
                    className={`w-full px-3.5 py-2.5 rounded-xl border bg-(--color-surface) text-sm text-(--color-text) outline-none focus:border-(--color-accent) ${
                      touched.ownerPhone && errors.ownerPhone ? "border-rose-500" : "border-(--color-border)"
                    }`}
                  />
                  {touched.ownerPhone && errors.ownerPhone && <p className="text-xs text-rose-400 mt-1">{errors.ownerPhone}</p>}
                </div>
              </div>

              <div>
                <CustomSelect
                  label="SaaS Subscription Tier"
                  value={values.subscriptionPlan}
                  onChange={(val) => handleChange("subscriptionPlan", val as any)}
                  options={[
                    { value: "STARTER", label: "Starter Tier (1 Branch)" },
                    { value: "PRO", label: "Pro Tier (Up to 5 Branches)" },
                    { value: "ENTERPRISE", label: "Enterprise Tier (Unlimited)" },
                  ]}
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-(--color-border)">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  disabled={submitting}
                  className="px-4 py-2 text-sm text-(--color-text-muted) hover:text-(--color-text)"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-(--color-accent) text-white font-semibold text-sm rounded-xl hover:bg-(--color-accent-strong) shadow-md flex items-center gap-1.5"
                >
                  {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  {submitting ? "Onboarding..." : "Create Gym Tenant"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
