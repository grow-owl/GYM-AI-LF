import { useState, useEffect } from "react";
import { GitBranch, Search, Plus, MapPin, Phone, CheckCircle2, Loader2 } from "lucide-react";
import { gymApi } from "@/lib/endpoints";
import { useFormValidation } from "@/lib/useFormValidation";
import { toast } from "sonner";
import CustomSelect from "@/components/ui/CustomSelect";

export default function Branches() {
  const [gyms, setGyms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedGymId, setSelectedGymId] = useState("ALL");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const { values, errors, touched, handleChange, handleBlur, validateAll, resetForm } = useFormValidation(
    {
      gymId: "",
      name: "",
      city: "",
      address: "",
      phone: "",
    },
    {
      gymId: { required: "Gym selection is required" },
      name: { required: "Branch name is required" },
      city: { required: "City is required" },
      address: { required: "Address is required" },
      phone: { required: "Branch contact phone is required", phone: "Enter a valid 10-digit phone number" },
    }
  );

  const fetchGyms = async () => {
    setLoading(true);
    try {
      const res = await gymApi.listAllGyms();
      const gymList = res.gyms || [];
      setGyms(gymList);
      if (gymList.length > 0) {
        handleChange("gymId", gymList[0]._id || gymList[0].id);
      }
    } catch {
      toast.error("Failed to load gym tenants and branch network from database.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGyms();
  }, []);

  const branches = gyms.reduce((acc: any[], gym: any) => {
    if (Array.isArray(gym.branches)) {
      const mapped = gym.branches.map((b: any) => ({
        id: b._id || b.id,
        gymId: gym._id || gym.id,
        gymName: gym.name,
        name: b.name,
        city: b.address?.city || "—",
        address: b.address?.line1 || "—",
        phone: b.contactPhone || "—",
        activeMembers: "—",
        status: "ACTIVE",
      }));
      return [...acc, ...mapped];
    }
    return acc;
  }, []);

  const filteredBranches = branches.filter((b) => {
    const matchesSearch =
      b.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.gymName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.city.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesGym = selectedGymId === "ALL" || b.gymId === selectedGymId;
    return matchesSearch && matchesGym;
  });

  const handleCreateBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateAll()) return;
    setSubmitting(true);

    const targetGym = gyms.find((g) => (g._id || g.id) === values.gymId);

    try {
      await gymApi.createBranch(values.gymId, {
        name: values.name,
        address: {
          line1: values.address,
          city: values.city,
          state: "State",
          pincode: "110001",
          country: "India",
        },
        contactPhone: values.phone,
      });

      setIsModalOpen(false);
      resetForm();
      fetchGyms();
      setToastMessage(`Branch "${values.name}" successfully added to ${targetGym?.name || "Gym"}!`);
      setTimeout(() => setToastMessage(null), 4000);
    } catch (err: any) {
      toast.error(err.response?.data?.message || err.message || "Failed to create branch");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-(--color-text) flex items-center gap-2">
            <GitBranch className="text-(--color-accent)" size={26} /> Multi-Branch Network Overview
          </h1>
          <p className="text-sm text-(--color-text-muted)">
            Monitor and manage physical branch locations operating under registered Gym SaaS tenants.
          </p>
        </div>

        <button
          onClick={() => {
            if (gyms.length > 0 && !values.gymId) {
              handleChange("gymId", gyms[0]._id || gyms[0].id);
            }
            setIsModalOpen(true);
          }}
          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-(--color-accent) text-white font-medium rounded-xl hover:bg-(--color-accent-strong) transition-colors shadow-lg shadow-(--color-accent-soft)"
        >
          <Plus size={18} /> Add New Branch
        </button>
      </div>

      {toastMessage && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center gap-3 animate-fade-in text-sm">
          <CheckCircle2 size={20} />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-(--color-text-faint)" />
          <input
            type="text"
            placeholder="Search branch by name, gym, or city..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-(--color-border) bg-(--color-surface) text-sm text-(--color-text) placeholder:text-(--color-text-faint) outline-none focus:border-(--color-accent)"
          />
        </div>

        <CustomSelect
          value={selectedGymId}
          onChange={(val) => setSelectedGymId(val)}
          options={[
            { value: "ALL", label: "All Gym Tenants" },
            ...gyms.map((g) => ({
              value: g._id || g.id,
              label: g.name,
            })),
          ]}
          className="w-56"
        />
      </div>

      {/* Branch Grid */}
      {loading ? (
        <div className="p-12 text-center text-sm text-(--color-text-muted) flex items-center justify-center gap-2">
          <Loader2 className="w-5 h-5 animate-spin text-(--color-accent)" /> Loading branches network...
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredBranches.length === 0 ? (
            <div className="col-span-full p-8 text-center border border-(--color-border) rounded-2xl text-(--color-text-muted)">
              No branches found for the selected criteria.
            </div>
          ) : (
            filteredBranches.map((branch) => (
              <div
                key={branch.id}
                className="p-5 rounded-2xl border border-(--color-border) bg-(--color-surface) hover:border-(--color-accent)/40 transition-all space-y-3 shadow-sm"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-xs font-semibold text-(--color-accent) uppercase tracking-wider">
                      {branch.gymName}
                    </span>
                    <h3 className="text-base font-bold text-(--color-text) mt-0.5">{branch.name}</h3>
                  </div>
                  <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-emerald-500/10 text-emerald-400">
                    {branch.status}
                  </span>
                </div>

                <div className="space-y-1.5 text-xs text-(--color-text-muted)">
                  <p className="flex items-center gap-1.5">
                    <MapPin size={14} className="text-(--color-text-faint)" />
                    {branch.address}, {branch.city}
                  </p>
                  <p className="flex items-center gap-1.5">
                    <Phone size={14} className="text-(--color-text-faint)" />
                    {branch.phone}
                  </p>
                </div>

                <div className="pt-3 border-t border-(--color-border) flex items-center justify-between text-xs">
                  <span className="text-(--color-text-muted)">Active Members</span>
                  <span className="font-bold text-(--color-text) text-sm">{branch.activeMembers}</span>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Add Branch Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="w-full max-w-md rounded-2xl border border-(--color-border) bg-(--color-surface) p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-(--color-border) pb-4">
              <h2 className="text-lg font-bold text-(--color-text) flex items-center gap-2">
                <GitBranch className="text-(--color-accent)" size={20} /> Register New Branch
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="text-(--color-text-faint) hover:text-(--color-text)">
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateBranch} className="space-y-4">
              <div>
                <CustomSelect
                  label="Select Gym Tenant"
                  value={values.gymId}
                  onChange={(val) => handleChange("gymId", val)}
                  options={gyms.map((g) => ({
                    value: g._id || g.id,
                    label: g.name,
                  }))}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-(--color-text-muted) mb-1">Branch Name</label>
                <input
                  type="text"
                  placeholder="e.g. Connaught Place Flagship"
                  value={values.name}
                  onChange={(e) => handleChange("name", e.target.value)}
                  onBlur={() => handleBlur("name")}
                  className={`w-full px-3.5 py-2.5 rounded-xl border bg-(--color-surface) text-sm text-(--color-text) outline-none focus:border-(--color-accent) ${
                    touched.name && errors.name ? "border-rose-500" : "border-(--color-border)"
                  }`}
                />
                {touched.name && errors.name && <p className="text-xs text-rose-400 mt-1">{errors.name}</p>}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-(--color-text-muted) mb-1">City</label>
                  <input
                    type="text"
                    placeholder="New Delhi"
                    value={values.city}
                    onChange={(e) => handleChange("city", e.target.value)}
                    onBlur={() => handleBlur("city")}
                    className={`w-full px-3.5 py-2.5 rounded-xl border bg-(--color-surface) text-sm text-(--color-text) outline-none focus:border-(--color-accent) ${
                      touched.city && errors.city ? "border-rose-500" : "border-(--color-border)"
                    }`}
                  />
                  {touched.city && errors.city && <p className="text-xs text-rose-400 mt-1">{errors.city}</p>}
                </div>

                <div>
                  <label className="block text-xs font-medium text-(--color-text-muted) mb-1">Phone</label>
                  <input
                    type="text"
                    placeholder="9876543210"
                    value={values.phone}
                    onChange={(e) => handleChange("phone", e.target.value)}
                    onBlur={() => handleBlur("phone")}
                    className={`w-full px-3.5 py-2.5 rounded-xl border bg-(--color-surface) text-sm text-(--color-text) outline-none focus:border-(--color-accent) ${
                      touched.phone && errors.phone ? "border-rose-500" : "border-(--color-border)"
                    }`}
                  />
                  {touched.phone && errors.phone && <p className="text-xs text-rose-400 mt-1">{errors.phone}</p>}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-(--color-text-muted) mb-1">Full Street Address</label>
                <input
                  type="text"
                  placeholder="Block A, Inner Circle, CP"
                  value={values.address}
                  onChange={(e) => handleChange("address", e.target.value)}
                  onBlur={() => handleBlur("address")}
                  className={`w-full px-3.5 py-2.5 rounded-xl border bg-(--color-surface) text-sm text-(--color-text) outline-none focus:border-(--color-accent) ${
                    touched.address && errors.address ? "border-rose-500" : "border-(--color-border)"
                  }`}
                />
                {touched.address && errors.address && <p className="text-xs text-rose-400 mt-1">{errors.address}</p>}
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
                  {submitting ? "Registering..." : "Add Branch"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
