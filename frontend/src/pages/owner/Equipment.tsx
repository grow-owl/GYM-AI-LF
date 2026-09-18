import { useState, useEffect, useCallback } from "react";
import { Plus, Wrench, Loader2, RefreshCw, Pencil, Trash2, MapPin, CheckCircle2 } from "lucide-react";

import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import CustomSelect from "@/components/ui/CustomSelect";
import Modal from "@/components/ui/Modal";
import { equipmentApi, gymApi } from "@/lib/endpoints";
import { useGymBranch } from "@/hooks/useGymBranch";
import { getShortBranchName } from "@/lib/branchUtils";
import { toast } from "sonner";

const statusTone: Record<string, "good" | "warn" | "danger"> = {
  WORKING: "good",
  MAINTENANCE: "warn",
  BROKEN: "danger",
};

const equipmentCategoryOptions = [
  { value: "strength", label: "Strength & Weight Machine" },
  { value: "cardio", label: "Cardio Equipment" },
  { value: "free_weights", label: "Free Weights & Dumbbells" },
  { value: "accessories", label: "Accessories & Cables" },
];

const equipmentStatusOptions = [
  { value: "WORKING", label: "WORKING" },
  { value: "MAINTENANCE", label: "MAINTENANCE" },
  { value: "BROKEN", label: "BROKEN" },
];

export default function Equipment() {
  const { gymId, branchId, loading: resolvingBranch } = useGymBranch();
  const [equipmentList, setEquipmentList] = useState<any[]>([]);
  const [branchesList, setBranchesList] = useState<any[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [submittingAdd, setSubmittingAdd] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [submittingEdit, setSubmittingEdit] = useState(false);

  const [newEquipment, setNewEquipment] = useState({
    name: "",
    category: "strength",
    status: "WORKING",
  });

  const [editEquipment, setEditEquipment] = useState({
    id: "",
    name: "",
    category: "strength",
    status: "WORKING",
  });

  const [showMaintenanceDueOnly, setShowMaintenanceDueOnly] = useState(false);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 20;

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
        .catch(() => {});
    }
  }, [gymId]);

  const fetchEquipment = useCallback(async () => {
    if (!gymId) {
      setEquipmentList([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      if (showMaintenanceDueOnly) {
        const res = await equipmentApi.getMaintenanceDue(gymId, branchId || undefined);
        const list = Array.isArray(res) ? res : (res as any)?.equipment || [];
        setEquipmentList(list);
      } else {
        const res = await equipmentApi.list(gymId, branchId || undefined);
        const list = Array.isArray(res) ? res : (res as any)?.equipment || [];
        setEquipmentList(list);
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || err.message || "Failed to load equipment");
      setEquipmentList([]);
    } finally {
      setLoading(false);
    }
  }, [gymId, branchId, showMaintenanceDueOnly]);

  useEffect(() => {
    fetchEquipment();
    setPage(1);
  }, [fetchEquipment]);

  const handleAddEquipment = async (e: React.FormEvent) => {
    e.preventDefault();
    const activeGymId = gymId || "";
    const activeBranchId =
      branchId || selectedBranchId || (branchesList.length === 1 ? branchesList[0]._id || branchesList[0].id : "");

    if (!activeBranchId && branchesList.length > 1) {
      toast.error("Branch is required. Please select which branch this equipment belongs to.");
      return;
    }

    setSubmittingAdd(true);
    try {
      await equipmentApi.add(activeGymId, activeBranchId || undefined, {
        ...newEquipment,
        branchId: activeBranchId || undefined,
      });
      toast.success(`Equipment ${newEquipment.name} registered!`);
      setShowAddModal(false);
      setNewEquipment({ name: "", category: "strength", status: "WORKING" });
      fetchEquipment();
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || err.response?.data?.message || err.message || "Failed to register equipment.");
    } finally {
      setSubmittingAdd(false);
    }
  };

  const handleEditEquipment = (item: any) => {
    setEditEquipment({
      id: item._id || item.id,
      name: item.name || "",
      category: item.category || "strength",
      status: item.status || "WORKING",
    });
    setShowEditModal(true);
  };

  const handleUpdateEquipment = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingEdit(true);
    try {
      await equipmentApi.update(editEquipment.id, {
        name: editEquipment.name,
        category: editEquipment.category,
        status: editEquipment.status,
      });
      toast.success(`Equipment "${editEquipment.name}" updated successfully!`);
      setShowEditModal(false);
      fetchEquipment();
    } catch (err: any) {
      toast.error(err.response?.data?.message || err.message || "Failed to update equipment.");
    } finally {
      setSubmittingEdit(false);
    }
  };

  const handleDeleteEquipment = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete equipment "${name}"?`)) return;
    try {
      await equipmentApi.delete(id);
      toast.success(`Equipment "${name}" deleted.`);
      fetchEquipment();
    } catch {
      toast.error("Failed to delete equipment item.");
    }
  };

  const handleSetExactStatus = async (id: string, status: string) => {
    try {
      await equipmentApi.updateStatus(id, status);
      toast.success(`Equipment status updated to ${status}.`);
      fetchEquipment();
    } catch {
      toast.error("Failed to update equipment status.");
    }
  };


  return (
    <div className="space-y-4">
      <PageHeader
        title="Equipment Maintenance"
        subtitle="Gym Machines & Maintenance Log"
        backTo="/owner"
        action={
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowMaintenanceDueOnly(!showMaintenanceDueOnly)}
              className={`hidden lg:inline-flex items-center gap-1 text-xs font-semibold px-3 py-2 rounded-lg transition-colors cursor-pointer ${
                showMaintenanceDueOnly
                  ? "bg-amber-500/20 text-amber-400 border border-amber-500/40"
                  : "bg-(--color-surface-2) text-(--color-text-muted) hover:text-(--color-text)"
              }`}
              title="Toggle Maintenance Due Equipment"
            >
              <Wrench size={14} /> {showMaintenanceDueOnly ? "Maintenance Due Only" : "All Equipment"}
            </button>
            <button
              onClick={fetchEquipment}
              className="inline-flex items-center gap-1 text-xs text-(--color-text-muted) hover:text-(--color-text) p-2 rounded-lg bg-(--color-surface-2) cursor-pointer"
              title="Refresh Equipment"
            >
              <RefreshCw size={14} className={loading ? "animate-spin text-(--color-accent)" : ""} />
            </button>
            <button
              onClick={() => setShowAddModal(true)}
              className="hidden lg:inline-flex items-center gap-1.5 rounded-full bg-(--color-accent) text-(--color-navbar) text-sm font-bold px-4 py-2 hover:opacity-90 cursor-pointer"
            >
              <Plus size={15} /> Add equipment
            </button>
          </div>
        }
      />

      {/* Mobile & Tablet Toolbar (Full width below header) */}
      <div className="flex lg:hidden items-center gap-2 w-full">
        <button
          onClick={() => setShowMaintenanceDueOnly(!showMaintenanceDueOnly)}
          className={`flex-1 h-10 inline-flex items-center justify-center gap-1.5 text-xs font-bold px-3 rounded-xl transition-all ${
            showMaintenanceDueOnly
              ? "bg-(--color-navbar) text-amber-400 border border-amber-400/40 shadow-xs"
              : "bg-(--color-surface-2) text-(--color-text) border border-(--color-border)"
          }`}
        >
          <Wrench size={14} className={showMaintenanceDueOnly ? "text-amber-400" : "text-(--color-text-muted)"} />
          {showMaintenanceDueOnly ? "Due Only" : "All Equipment"}
        </button>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex-1 h-10 inline-flex items-center justify-center gap-1.5 rounded-xl bg-(--color-accent) text-(--color-navbar) text-xs font-bold px-3 hover:opacity-90 active:scale-[0.98] shadow-sm transition-all"
        >
          <Plus size={16} /> Add equipment
        </button>
      </div>

      {resolvingBranch || loading ? (
        <Card className="flex items-center justify-center p-12 text-sm text-(--color-text-muted) gap-2">
          <Loader2 className="w-5 h-5 animate-spin text-(--color-accent)" /> Loading equipment items...
        </Card>
      ) : equipmentList.length === 0 ? (
        <Card className="text-center py-12 text-(--color-text-muted) space-y-2">
          <Wrench className="w-8 h-8 mx-auto text-(--color-text-faint)" />
          <p className="text-sm font-medium text-(--color-text)">No equipment logged in database</p>
          <p className="text-xs text-(--color-text-muted)">Click "Add equipment" to log machines and gear.</p>
        </Card>
      ) : (
        <Card className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {equipmentList.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map((item) => {
              const eqId = item._id || item.id;
              const status = item.status || "WORKING";
              const shortBranch = getShortBranchName(item.branchId?.name);

              return (
                <div key={eqId} className="p-3.5 rounded-xl border border-(--color-border) bg-(--color-surface-2)/40 flex flex-col justify-between gap-2.5">
                  {/* Desktop Layout (100% Untouched) */}
                  <div className="hidden lg:flex items-center justify-between gap-3">
                    <div>
                      <h4 className="font-display text-sm font-semibold text-(--color-text)">{item.name}</h4>
                      <div className="flex items-center gap-2 mt-0.5">
                        <p className="text-xs text-(--color-text-muted) capitalize">{item.category}</p>
                        {item.branchId?.name && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-500/10 text-slate-400 border border-slate-500/20 font-medium">
                            📍 {item.branchId.name}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Badge tone={statusTone[status] || "good"}>{status}</Badge>

                      {status !== "WORKING" && (
                        <button
                          onClick={() => handleSetExactStatus(eqId, "WORKING")}
                          className="px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 text-xs font-medium"
                        >
                          Mark Working
                        </button>
                      )}
                      {status !== "MAINTENANCE" && (
                        <button
                          onClick={() => handleSetExactStatus(eqId, "MAINTENANCE")}
                          className="px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 text-xs font-medium"
                        >
                          Maintenance
                        </button>
                      )}
                      <button
                        onClick={() => handleEditEquipment(item)}
                        className="p-1.5 rounded-lg text-amber-400 hover:bg-amber-500/10 transition-all cursor-pointer"
                        title="Edit Equipment"
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        onClick={() => handleDeleteEquipment(eqId, item.name)}
                        className="p-1.5 rounded-lg text-rose-400 hover:bg-rose-500/10 transition-all cursor-pointer"
                        title="Delete Equipment"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>

                  {/* Mobile & Tablet Layout (Clean, properly spaced, hard colors, no overflow) */}
                  <div className="lg:hidden space-y-3">
                    {/* Top Row: Equipment Name + Hard Status Badge */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <h4 className="font-display font-semibold text-sm text-(--color-text) break-words">{item.name}</h4>
                        <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                          <span className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-(--color-surface-3) text-(--color-text-muted) border border-(--color-border) capitalize">
                            {item.category}
                          </span>
                          {shortBranch && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-md bg-(--color-surface-3) text-(--color-text) border border-(--color-border)">
                              <MapPin size={11} className="text-(--color-accent) shrink-0" />
                              <span className="truncate max-w-[150px]">{shortBranch}</span>
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="shrink-0">
                        {status === "WORKING" ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-600 text-white shadow-xs">
                            <span className="w-1.5 h-1.5 rounded-full bg-white shrink-0" />
                            WORKING
                          </span>
                        ) : status === "MAINTENANCE" ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-600 text-white shadow-xs">
                            <span className="w-1.5 h-1.5 rounded-full bg-white shrink-0" />
                            MAINTENANCE
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-600 text-white shadow-xs">
                            <span className="w-1.5 h-1.5 rounded-full bg-white shrink-0" />
                            BROKEN
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Bottom Row: Status Action Button + Edit & Delete Action Icons */}
                    <div className="flex items-center gap-2 pt-2 border-t border-(--color-border-soft)">
                      {status !== "WORKING" ? (
                        <button
                          onClick={() => handleSetExactStatus(eqId, "WORKING")}
                          className="flex-1 h-9 inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold active:scale-[0.98] transition-all shadow-xs cursor-pointer"
                        >
                          <CheckCircle2 size={14} /> Mark Working
                        </button>
                      ) : (
                        <button
                          onClick={() => handleSetExactStatus(eqId, "MAINTENANCE")}
                          className="flex-1 h-9 inline-flex items-center justify-center gap-1.5 rounded-xl bg-(--color-surface-2) hover:bg-(--color-surface-3) text-(--color-text) border border-(--color-border) text-xs font-bold active:scale-[0.98] transition-all cursor-pointer"
                        >
                          <Wrench size={14} className="text-amber-500" /> Mark Maintenance
                        </button>
                      )}

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => handleEditEquipment(item)}
                          className="h-9 w-9 inline-flex items-center justify-center rounded-xl bg-(--color-surface-2) border border-(--color-border) text-amber-500 hover:bg-amber-500/10 active:scale-95 transition-all cursor-pointer"
                          title="Edit Equipment"
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          onClick={() => handleDeleteEquipment(eqId, item.name)}
                          className="h-9 w-9 inline-flex items-center justify-center rounded-xl bg-(--color-surface-2) border border-(--color-border) text-rose-500 hover:bg-rose-500/10 active:scale-95 transition-all cursor-pointer"
                          title="Delete Equipment"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pagination Controls */}
          {equipmentList.length > PAGE_SIZE && (
            <div className="flex items-center justify-between mt-4 pt-3 border-t border-(--color-border)">
              <p className="text-xs text-(--color-text-muted)">
                Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, equipmentList.length)} of {equipmentList.length} items
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-3 py-1.5 rounded-lg text-xs bg-(--color-surface-2) text-(--color-text) disabled:opacity-40 hover:bg-(--color-accent)/10 transition-colors"
                >
                  ← Prev
                </button>
                <span className="px-3 py-1.5 text-xs text-(--color-text-muted)">Page {page} of {Math.ceil(equipmentList.length / PAGE_SIZE)}</span>
                <button
                  onClick={() => setPage((p) => Math.min(Math.ceil(equipmentList.length / PAGE_SIZE), p + 1))}
                  disabled={page >= Math.ceil(equipmentList.length / PAGE_SIZE)}
                  className="px-3 py-1.5 rounded-lg text-xs bg-(--color-surface-2) text-(--color-text) disabled:opacity-40 hover:bg-(--color-accent)/10 transition-colors"
                >
                  Next →
                </button>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Add Equipment Modal */}
      {showAddModal && (
        <Modal onClose={() => setShowAddModal(false)} maxWidth="md" title="Register Gym Equipment">
          <form onSubmit={handleAddEquipment} className="space-y-4">
            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-(--color-text-muted) mb-1 font-medium">Equipment Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Commercial Treadmill T80"
                  value={newEquipment.name}
                  onChange={(e) => setNewEquipment({ ...newEquipment, name: e.target.value })}
                  className="w-full rounded-xl bg-(--color-surface-2) p-2.5 text-sm text-(--color-text) border border-(--color-border) focus:outline-none focus:border-(--color-accent)"
                />
              </div>

              <div>
                <label className="block text-(--color-text-muted) mb-1 font-medium">Category</label>
                <CustomSelect
                  value={newEquipment.category}
                  onChange={(val) => setNewEquipment({ ...newEquipment, category: val })}
                  options={equipmentCategoryOptions}
                />
              </div>

              {(!branchId && branchesList.length > 0) && (
                <div>
                  <label className="block text-(--color-text-muted) mb-1 font-medium">
                    Branch Assignment {branchesList.length > 1 && <span className="text-rose-400">*</span>}
                  </label>
                  {branchesList.length === 1 ? (
                    <div className="p-2.5 rounded-xl bg-(--color-surface-2) text-xs text-(--color-text) border border-(--color-border)">
                      📍 {branchesList[0].name} (Default Branch)
                    </div>
                  ) : (
                    <CustomSelect
                      value={selectedBranchId}
                      onChange={(val) => setSelectedBranchId(val)}
                      options={branchesList.map((b) => ({ value: b._id || b.id, label: b.name }))}
                      placeholder="Select branch for this equipment..."
                    />
                  )}
                  {branchesList.length > 1 && !selectedBranchId && (
                    <p className="text-[11px] text-amber-400 mt-1">Please select which branch this equipment belongs to.</p>
                  )}
                </div>
              )}
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
                {submittingAdd ? <Loader2 className="w-4 h-4 animate-spin" /> : "Register Machine"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Edit Equipment Modal */}
      {showEditModal && (
        <Modal onClose={() => setShowEditModal(false)} maxWidth="md" title="Edit Gym Equipment">
          <form onSubmit={handleUpdateEquipment} className="space-y-4">
            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-(--color-text-muted) mb-1 font-medium">Equipment Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Commercial Treadmill T80"
                  value={editEquipment.name}
                  onChange={(e) => setEditEquipment({ ...editEquipment, name: e.target.value })}
                  className="w-full rounded-xl bg-(--color-surface-2) p-2.5 text-sm text-(--color-text) border border-(--color-border) focus:outline-none focus:border-(--color-accent)"
                />
              </div>

              <div>
                <label className="block text-(--color-text-muted) mb-1 font-medium">Category</label>
                <CustomSelect
                  value={editEquipment.category}
                  onChange={(val) => setEditEquipment({ ...editEquipment, category: val })}
                  options={equipmentCategoryOptions}
                />
              </div>

              <div>
                <label className="block text-(--color-text-muted) mb-1 font-medium">Operating Status</label>
                <CustomSelect
                  value={editEquipment.status}
                  onChange={(val) => setEditEquipment({ ...editEquipment, status: val })}
                  options={equipmentStatusOptions}
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowEditModal(false)}
                className="flex-1 py-2.5 rounded-xl bg-(--color-surface-2) text-xs font-semibold text-(--color-text)"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submittingEdit}
                className="flex-1 py-2.5 rounded-xl bg-(--color-accent) text-(--color-navbar) text-xs font-bold shadow-md flex items-center justify-center gap-1.5"
              >
                {submittingEdit ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save Changes"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
