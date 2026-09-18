import { useState, useEffect } from "react";
import { Plus, Utensils, Archive, Loader2, Users, Trash2, Edit2, RefreshCw } from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import CustomSelect from "@/components/ui/CustomSelect";
import Modal from "@/components/ui/Modal";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { trainerApi, dietApi } from "@/lib/endpoints";
import { useAuthStore } from "@/store/authStore";
import { toast } from "sonner";
import { formatApiError, showApiErrorToast } from "@/lib/api";

interface MealItemInput {
  name: string;
  quantity: string;
  calories?: number;
  protein_g?: number;
}

interface MealInput {
  mealType: "breakfast" | "lunch" | "dinner" | "snack";
  items: MealItemInput[];
  notes?: string;
}

const mealTypeOptions = [
  { value: "breakfast", label: "Breakfast" },
  { value: "lunch", label: "Lunch" },
  { value: "dinner", label: "Dinner" },
  { value: "snack", label: "Snack" },
];

export default function DietPlans() {
  const user = useAuthStore((s) => s.user);
  const gymId = user?.gymId || "";

  // Primary States
  const [clients, setClients] = useState<any[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const [plans, setPlans] = useState<any[]>([]);
  
  const [loadingClients, setLoadingClients] = useState(true);
  const [loadingPlans, setLoadingPlans] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [submittingPlan, setSubmittingPlan] = useState(false);

  // Form State
  const [title, setTitle] = useState("");
  const [dailyCalorieTarget, setDailyCalorieTarget] = useState<number>(2400);
  const [dailyProteinTargetG, setDailyProteinTargetG] = useState<number>(160);
  const [startDate, setStartDate] = useState(new Date().toISOString().split("T")[0]);
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null);
  const [meals, setMeals] = useState<MealInput[]>([
    {
      mealType: "breakfast",
      items: [{ name: "Oats & Eggs", quantity: "1 bowl + 4 whites", calories: 450, protein_g: 35 }],
    },
  ]);
  const [dataError, setDataError] = useState<string | null>(null);

  // Load clients on mount
  async function loadInitialData() {
    setLoadingClients(true);
    setDataError(null);
    try {
      if (gymId) {
        const clientRes = await trainerApi.getMyClients(gymId);
        const list = Array.isArray(clientRes) ? clientRes : clientRes?.clients || [];
        setClients(list);
        if (list.length > 0 && !selectedClientId) {
          const firstId = list[0]._id || list[0].id || list[0].userId?._id;
          setSelectedClientId(String(firstId));
        }
      }
    } catch (err: any) {
      const msg = formatApiError(err, "Failed to load assigned clients.");
      setDataError(msg);
      showApiErrorToast(err, "Failed to load assigned clients");
    } finally {
      setLoadingClients(false);
    }
  }

  useEffect(() => {
    loadInitialData();
  }, [gymId]);

  // Load plans when selected client changes
  async function fetchClientPlans(clientId?: string) {
    const cId = clientId || selectedClientId;
    if (!cId) return;
    setLoadingPlans(true);
    try {
      const res = await dietApi.listPlans(cId);
      const list = Array.isArray(res) ? res : ((res as any)?.plans || []);
      setPlans(list);
    } catch (err: any) {
      showApiErrorToast(err, "Failed to load client diet plans");
      setPlans([]);
    } finally {
      setLoadingPlans(false);
    }
  }

  useEffect(() => {
    if (!selectedClientId) return;
    fetchClientPlans();
  }, [selectedClientId]);

  // Meal builder helpers
  const addMeal = () => {
    setMeals((prev) => [
      ...prev,
      { mealType: "lunch", items: [{ name: "", quantity: "" }] },
    ]);
  };

  const removeMeal = (index: number) => {
    setMeals((prev) => prev.filter((_, i) => i !== index));
  };

  const addItemToMeal = (mealIndex: number) => {
    setMeals((prev) => {
      const next = [...prev];
      next[mealIndex].items.push({ name: "", quantity: "" });
      return next;
    });
  };

  const removeItemFromMeal = (mealIndex: number, itemIndex: number) => {
    setMeals((prev) => {
      const next = [...prev];
      next[mealIndex].items = next[mealIndex].items.filter((_, i) => i !== itemIndex);
      return next;
    });
  };

  const updateItem = (mealIndex: number, itemIndex: number, field: keyof MealItemInput, val: any) => {
    setMeals((prev) => {
      const next = [...prev];
      next[mealIndex].items[itemIndex] = { ...next[mealIndex].items[itemIndex], [field]: val };
      return next;
    });
  };

  // Submit new diet plan
  const handleCreatePlanSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClientId) {
      toast.error("Please select a client first.");
      return;
    }
    if (!title.trim()) {
      toast.error("Diet plan title is required.");
      return;
    }
    if (meals.length === 0 || meals.some((m) => m.items.length === 0 || m.items.some((i) => !i.name.trim() || !i.quantity.trim()))) {
      toast.error("Each meal must contain valid food items with names and quantities.");
      return;
    }

    setSubmittingPlan(true);
    try {
      const payload = {
        title: title.trim(),
        dailyCalorieTarget: Number(dailyCalorieTarget),
        dailyProteinTarget_g: Number(dailyProteinTargetG),
        startDate,
        meals: meals.map((m) => ({
          mealType: m.mealType,
          notes: m.notes ? m.notes.trim() : undefined,
          items: m.items.map((i) => ({
            name: i.name.trim(),
            quantity: i.quantity.trim(),
            calories: i.calories ? Number(i.calories) : undefined,
            protein_g: i.protein_g ? Number(i.protein_g) : undefined,
          })),
        })),
      };

      if (editingPlanId) {
        await dietApi.updatePlan(editingPlanId, payload);
        toast.success("Diet plan updated successfully!");
      } else {
        await dietApi.createPlan(selectedClientId, payload);
        toast.success("Diet plan created & assigned successfully!");
      }

      setShowCreateModal(false);
      setEditingPlanId(null);
      setTitle("");
      setMeals([{ mealType: "breakfast", items: [{ name: "Oats & Eggs", quantity: "1 bowl + 4 whites", calories: 450, protein_g: 35 }] }]);

      // Refresh list
      const res = await dietApi.listPlans(selectedClientId).catch(() => null);
      setPlans(Array.isArray(res) ? res : res?.plans || []);
    } catch (err: any) {
      toast.error(err.response?.data?.message || err.message || "Failed to save diet plan");
    } finally {
      setSubmittingPlan(false);
    }
  };

  // Archive Plan
  const handleArchivePlan = async (planId: string) => {
    try {
      await dietApi.archivePlan(planId);
      toast.success("Diet plan archived.");
      setPlans((prev) => prev.map((p) => (p._id === planId || p.id === planId ? { ...p, status: "ARCHIVED" } : p)));
    } catch (err: any) {
      toast.error(err.message || "Failed to archive diet plan");
    }
  };

  // Delete Plan State
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string } | null>(null);
  const [deletingPlan, setDeletingPlan] = useState(false);

  const confirmDeletePlan = async () => {
    if (!deleteTarget) return;
    setDeletingPlan(true);
    try {
      await dietApi.deletePlan(deleteTarget.id);
      toast.success("Diet plan deleted.");
      setPlans((prev) => prev.filter((p) => (p._id || p.id) !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (err: any) {
      toast.error(err.response?.data?.message || err.message || "Failed to delete diet plan");
    } finally {
      setDeletingPlan(false);
    }
  };

  const handleDeletePlan = (planId: string, planTitle: string) => {
    setDeleteTarget({ id: planId, title: planTitle });
  };

  // Update Existing Plan
  const handleEditPlanClick = (p: any) => {
    setEditingPlanId(p._id || p.id);
    setTitle(p.title || "");
    setDailyCalorieTarget(Number(p.dailyCalorieTarget || 2200));
    setDailyProteinTargetG(Number(p.dailyProteinTarget_g || 140));
    setStartDate(p.startDate ? p.startDate.split("T")[0] : new Date().toISOString().split("T")[0]);
    if (p.meals && Array.isArray(p.meals)) {
      setMeals(p.meals);
    }
    setShowCreateModal(true);
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Diet Plans"
        subtitle="Create, assign, and manage client nutrition & macro targets"
        backTo="/trainer"
        action={
          <button
            onClick={() => {
              setEditingPlanId(null);
              setTitle("");
              setDailyCalorieTarget(2400);
              setDailyProteinTargetG(160);
              setMeals([
                {
                  mealType: "breakfast",
                  items: [{ name: "Oats & Eggs", quantity: "1 bowl + 4 whites", calories: 450, protein_g: 35 }],
                },
              ]);
              setShowCreateModal(true);
            }}
            disabled={!selectedClientId}
            className="inline-flex items-center gap-1.5 rounded-full bg-(--color-accent) text-(--color-navbar) text-xs font-bold px-4 py-2 hover:opacity-90 shadow-md disabled:opacity-50 cursor-pointer"
          >
            <Plus size={15} /> Create Diet Plan
          </button>
        }
      />

      {dataError && (
        <Card className="text-center py-4 border-rose-500/20 bg-rose-500/5">
          <p className="text-xs text-(--color-danger) mb-2">{dataError}</p>
          <button
            onClick={loadInitialData}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-full bg-(--color-surface-2) text-(--color-text) hover:bg-(--color-surface-3)"
          >
            <RefreshCw size={13} /> Retry Loading
          </button>
        </Card>
      )}

      {/* Client Selector & Controls */}
      <Card className="p-4 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-(--color-accent)" />
            <h3 className="font-display text-sm font-bold text-(--color-text)">Select Client</h3>
          </div>

          {loadingClients ? (
            <div className="flex items-center gap-2 text-xs text-(--color-text-muted)">
              <Loader2 className="w-4 h-4 animate-spin text-(--color-accent)" /> Loading assigned clients...
            </div>
          ) : clients.length === 0 ? (
            <span className="text-xs text-amber-400 font-medium">No assigned clients found</span>
          ) : (
            <div className="w-full sm:w-72">
              <CustomSelect
                value={selectedClientId}
                onChange={(val) => setSelectedClientId(val)}
                options={clients.map((c) => {
                  const id = String(c._id || c.id || c.userId?._id);
                  const name = c.fullName || c.name || c.userId?.fullName || "Client";
                  const phone = c.phone || c.userId?.phone || "";
                  return { label: `${name} ${phone ? `(${phone})` : ""}`, value: id };
                })}
              />
            </div>
          )}
        </div>
      </Card>

      {/* Diet Plans List */}
      {loadingPlans ? (
        <Card className="flex items-center justify-center p-12 text-sm text-(--color-text-muted) gap-2">
          <Loader2 className="w-5 h-5 animate-spin text-(--color-accent)" /> Loading client's diet plans...
        </Card>
      ) : !selectedClientId ? (
        <Card className="text-center py-12 text-(--color-text-muted)">
          <p className="text-sm">Please select a client above to manage their nutrition plans.</p>
        </Card>
      ) : plans.length === 0 ? (
        <Card className="text-center py-12 text-(--color-text-muted) space-y-2">
          <Utensils className="w-10 h-10 mx-auto text-(--color-text-faint)" />
          <p className="text-sm font-semibold text-(--color-text)">No Diet Plans Found</p>
          <p className="text-xs text-(--color-text-muted)">Click "Create Diet Plan" above to assign a nutrition plan to this client.</p>
        </Card>
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {plans.map((p) => {
            const pId = p._id || p.id;
            const status = p.status || "ACTIVE";
            const mealCount = p.meals?.length || 0;
            const kcal = p.dailyCalorieTarget || 2000;
            const protein = p.dailyProteinTarget_g || 120;

            return (
              <Card key={pId} className="p-4 space-y-3 flex flex-col justify-between border border-(--color-border)">
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4 className="font-display text-sm font-bold text-(--color-text)">{p.title}</h4>
                      <p className="text-xs text-amber-400 font-semibold mt-0.5">
                        {kcal.toLocaleString()} kcal · {protein}g protein
                      </p>
                    </div>
                    <Badge tone={status === "ACTIVE" ? "good" : "neutral"}>{status}</Badge>
                  </div>

                  <p className="text-xs text-(--color-text-faint)">
                    {mealCount} meals · Created {new Date(p.createdAt || Date.now()).toLocaleDateString()}
                  </p>
                </div>

                <div className="flex items-center gap-2 pt-2 border-t border-(--color-border)">
                  <button
                    onClick={() => handleEditPlanClick(p)}
                    className="flex-1 inline-flex items-center justify-center gap-1 py-1.5 rounded-lg bg-(--color-surface-2) text-(--color-text) text-xs font-semibold hover:border-(--color-accent) border border-transparent transition-all cursor-pointer"
                    title="Edit Plan"
                  >
                    <Edit2 size={12} /> Edit Plan
                  </button>
                  {status === "ACTIVE" && (
                    <button
                      onClick={() => handleArchivePlan(pId)}
                      className="flex-1 inline-flex items-center justify-center gap-1 py-1.5 rounded-lg bg-amber-500/10 text-amber-400 text-xs font-semibold hover:bg-amber-500/20 cursor-pointer"
                      title="Archive Plan"
                    >
                      <Archive size={13} /> Archive
                    </button>
                  )}
                  <button
                    onClick={() => handleDeletePlan(pId, p.title)}
                    className="inline-flex items-center justify-center p-1.5 rounded-lg bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 transition-colors cursor-pointer"
                    title="Delete Diet Plan Permanently"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create Diet Plan Modal */}
      {showCreateModal && (
        <Modal onClose={() => setShowCreateModal(false)} maxWidth="2xl" title="Create Diet Plan">
          <form onSubmit={handleCreatePlanSubmit} className="space-y-4 text-xs">
            <div>
              <label className="block text-(--color-text-muted) mb-1 font-medium">Diet Plan Title</label>
              <input
                type="text"
                required
                placeholder="e.g. High Protein Lean Bulk"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full rounded-xl bg-(--color-surface-2) p-2.5 text-sm text-(--color-text) border border-(--color-border)"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-(--color-text-muted) mb-1 font-medium">Daily Calories (kcal)</label>
                <input
                  type="number"
                  required
                  min="500"
                  value={dailyCalorieTarget}
                  onChange={(e) => setDailyCalorieTarget(Number(e.target.value))}
                  className="w-full rounded-xl bg-(--color-surface-2) p-2.5 text-sm text-(--color-text) border border-(--color-border)"
                />
              </div>

              <div>
                <label className="block text-(--color-text-muted) mb-1 font-medium">Protein Target (g)</label>
                <input
                  type="number"
                  required
                  min="10"
                  value={dailyProteinTargetG}
                  onChange={(e) => setDailyProteinTargetG(Number(e.target.value))}
                  className="w-full rounded-xl bg-(--color-surface-2) p-2.5 text-sm text-(--color-text) border border-(--color-border)"
                />
              </div>

              <div>
                <label className="block text-(--color-text-muted) mb-1 font-medium">Start Date</label>
                <input
                  type="date"
                  required
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full rounded-xl bg-(--color-surface-2) p-2.5 text-sm text-(--color-text) border border-(--color-border)"
                />
              </div>
            </div>

            {/* Meals Builder */}
            <div className="space-y-3 pt-2 border-t border-(--color-border)">
              <div className="flex items-center justify-between">
                <span className="font-bold text-(--color-text) uppercase tracking-wider text-[11px]">Daily Meals ({meals.length})</span>
                <button
                  type="button"
                  onClick={addMeal}
                  className="px-2.5 py-1 rounded-lg bg-(--color-surface-2) text-(--color-accent) text-xs font-semibold flex items-center gap-1"
                >
                  <Plus size={13} /> Add Meal
                </button>
              </div>

              {meals.map((meal, mIdx) => (
                <div key={mIdx} className="p-3 rounded-xl bg-(--color-surface-2) space-y-3 border border-white/5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="w-48">
                      <CustomSelect
                        label="Meal Category"
                        value={meal.mealType}
                        onChange={(val) => {
                          setMeals((prev) => {
                            const next = [...prev];
                            next[mIdx].mealType = val as any;
                            return next;
                          });
                        }}
                        options={mealTypeOptions}
                      />
                    </div>
                    {meals.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeMeal(mIdx)}
                        className="text-red-400 text-xs hover:underline font-semibold"
                      >
                        Remove Meal
                      </button>
                    )}
                  </div>

                  {/* Food items list for meal */}
                  <div className="space-y-2">
                    {meal.items.map((item, iIdx) => (
                      <div key={iIdx} className="p-2.5 rounded-lg bg-(--color-surface) space-y-2 border border-white/5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[11px] text-(--color-text-muted) font-semibold">Item #{iIdx + 1}</span>
                          {meal.items.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeItemFromMeal(mIdx, iIdx)}
                              className="text-red-400 text-[10px] hover:underline"
                            >
                              Remove Item
                            </button>
                          )}
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-(--color-text-muted) text-[10px] mb-0.5">Food / Item Name</label>
                            <input
                              type="text"
                              required
                              placeholder="e.g. Oats with Almond Milk"
                              value={item.name}
                              onChange={(e) => updateItem(mIdx, iIdx, "name", e.target.value)}
                              className="w-full rounded-lg bg-(--color-surface-2) p-1.5 text-xs text-(--color-text) border border-(--color-border)"
                            />
                          </div>

                          <div>
                            <label className="block text-(--color-text-muted) text-[10px] mb-0.5">Portion / Quantity</label>
                            <input
                              type="text"
                              required
                              placeholder="e.g. 1 bowl (80g)"
                              value={item.quantity}
                              onChange={(e) => updateItem(mIdx, iIdx, "quantity", e.target.value)}
                              className="w-full rounded-lg bg-(--color-surface-2) p-1.5 text-xs text-(--color-text) border border-(--color-border)"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-(--color-text-muted) text-[10px] mb-0.5">Calories (kcal)</label>
                            <input
                              type="number"
                              placeholder="Opt"
                              value={item.calories || ""}
                              onChange={(e) => updateItem(mIdx, iIdx, "calories", e.target.value ? Number(e.target.value) : undefined)}
                              className="w-full rounded-lg bg-(--color-surface-2) p-1.5 text-xs text-(--color-text) border border-(--color-border)"
                            />
                          </div>

                          <div>
                            <label className="block text-(--color-text-muted) text-[10px] mb-0.5">Protein (g)</label>
                            <input
                              type="number"
                              placeholder="Opt"
                              value={item.protein_g || ""}
                              onChange={(e) => updateItem(mIdx, iIdx, "protein_g", e.target.value ? Number(e.target.value) : undefined)}
                              className="w-full rounded-lg bg-(--color-surface-2) p-1.5 text-xs text-(--color-text) border border-(--color-border)"
                            />
                          </div>
                        </div>
                      </div>
                    ))}

                    <button
                      type="button"
                      onClick={() => addItemToMeal(mIdx)}
                      className="w-full py-2 rounded-lg bg-(--color-surface) text-(--color-accent) text-xs font-semibold border border-dashed border-(--color-border) flex items-center justify-center gap-1"
                    >
                      <Plus size={13} /> Add Food Item to Meal
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="flex-1 py-2.5 rounded-xl bg-(--color-surface-2) font-semibold text-(--color-text)"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submittingPlan}
                className="flex-1 py-2.5 rounded-xl bg-(--color-accent) text-(--color-navbar) font-bold shadow-md flex items-center justify-center gap-1.5"
              >
                {submittingPlan ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save & Assign Diet Plan"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDeletePlan}
        title="Delete Diet Plan"
        description={`Are you sure you want to permanently delete "${deleteTarget?.title}"?`}
        confirmText="Delete Plan"
        tone="danger"
        loading={deletingPlan}
      />
    </div>
  );
}
