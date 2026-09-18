import { useState, useEffect } from "react";
import { Plus, Dumbbell, Copy, Archive, Trash2, Edit2, Loader2, Users, Search, Settings, RefreshCw } from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import CustomSelect from "@/components/ui/CustomSelect";
import Modal from "@/components/ui/Modal";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { trainerApi, workoutApi } from "@/lib/endpoints";
import { useAuthStore } from "@/store/authStore";
import { toast } from "sonner";
import { formatApiError, showApiErrorToast } from "@/lib/api";
import type { IMemberClient, IWorkoutPlan, IExerciseLibraryItem, IWorkoutDay, IWorkoutPlanExercise } from "@/types";

interface ExerciseItem {
  exerciseId: string;
  order: number;
  targetSets: number;
  targetReps: number;
  targetWeightKg?: number;
  restSeconds?: number;
  notes?: string;
}

interface WorkoutDayItem {
  dayLabel: string;
  exercises: ExerciseItem[];
}

export default function WorkoutPlans() {
  const user = useAuthStore((s) => s.user);
  const gymId = user?.gymId || "";

  // Primary States
  const [clients, setClients] = useState<IMemberClient[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const [plans, setPlans] = useState<IWorkoutPlan[]>([]);
  const [exercisesList, setExercisesList] = useState<IExerciseLibraryItem[]>([]);

  const [loadingClients, setLoadingClients] = useState(true);
  const [loadingPlans, setLoadingPlans] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [submittingPlan, setSubmittingPlan] = useState(false);
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null);

  // Exercise Library Manager Modal State
  const [showExerciseManagerModal, setShowExerciseManagerModal] = useState(false);
  const [exSearch, setExSearch] = useState("");
  const [editingCustomExId, setEditingCustomExId] = useState<string | null>(null);

  // Custom Exercise Modal State
  const [showAddCustomExerciseModal, setShowAddCustomExerciseModal] = useState(false);
  const [submittingCustomExercise, setSubmittingCustomExercise] = useState(false);
  const [customExForm, setCustomExForm] = useState({
    name: "",
    muscleGroup: "CHEST",
    equipment: "",
    instructions: "",
    defaultSets: 3,
    defaultReps: 10,
  });

  // Form State
  const [title, setTitle] = useState("");
  const [goal, setGoal] = useState("Muscle Building");
  const [startDate, setStartDate] = useState(new Date().toISOString().split("T")[0]);
  const [days, setDays] = useState<WorkoutDayItem[]>([
    { dayLabel: "Day 1: Push", exercises: [] },
  ]);
  const [dataError, setDataError] = useState<string | null>(null);

  // Load clients & exercise repository on mount
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
      const exRes = await workoutApi.listExercises();
      const exList = Array.isArray(exRes) ? exRes : (exRes as any)?.exercises || [];
      setExercisesList(exList);
    } catch (err: any) {
      const msg = formatApiError(err, "Failed to load trainer clients or exercises.");
      setDataError(msg);
      showApiErrorToast(err, "Failed to load clients or exercises");
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
      const res = await workoutApi.listPlans(cId);
      const list = Array.isArray(res) ? res : (res as any)?.plans || [];
      setPlans(list);
    } catch (err: any) {
      showApiErrorToast(err, "Failed to load client workout plans");
      setPlans([]);
    } finally {
      setLoadingPlans(false);
    }
  }

  useEffect(() => {
    if (!selectedClientId) return;
    fetchClientPlans();
  }, [selectedClientId]);

  // Create or Update Custom Exercise Submit
  const handleCustomExerciseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customExForm.name.trim()) {
      toast.error("Exercise name is required.");
      return;
    }
    setSubmittingCustomExercise(true);
    try {
      const payload = {
        name: customExForm.name.trim(),
        muscleGroup: customExForm.muscleGroup,
        equipment: customExForm.equipment.trim() || undefined,
        instructions: customExForm.instructions.trim() || undefined,
        defaultSets: Number(customExForm.defaultSets) || 3,
        defaultReps: Number(customExForm.defaultReps) || 10,
      };

      if (editingCustomExId) {
        await workoutApi.updateExercise(editingCustomExId, payload);
        toast.success(`Exercise "${customExForm.name}" updated successfully!`);
      } else {
        await workoutApi.createExercise(payload);
        toast.success(`Custom exercise "${customExForm.name}" created!`);
      }

      setShowAddCustomExerciseModal(false);
      setEditingCustomExId(null);
      setCustomExForm({
        name: "",
        muscleGroup: "CHEST",
        equipment: "",
        instructions: "",
        defaultSets: 3,
        defaultReps: 10,
      });

      const updatedList = await workoutApi.listExercises().catch(() => null);
      const exList = Array.isArray(updatedList) ? updatedList : updatedList?.exercises || [];
      setExercisesList(exList);
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || err.response?.data?.message || err.message || "Failed to save exercise");
    } finally {
      setSubmittingCustomExercise(false);
    }
  };

  const handleEditCustomExerciseClick = (ex: IExerciseLibraryItem) => {
    setEditingCustomExId(ex._id || ex.id || "");
    setCustomExForm({
      name: ex.name || "",
      muscleGroup: ex.muscleGroup || "CHEST",
      equipment: ex.equipment || "",
      instructions: ex.instructions || "",
      defaultSets: ex.defaultSets || 3,
      defaultReps: ex.defaultReps || 10,
    });
    setShowAddCustomExerciseModal(true);
  };

  // Delete Custom Exercise State
  const [deleteExTarget, setDeleteExTarget] = useState<{ id: string; name: string } | null>(null);
  const [deletingEx, setDeletingEx] = useState(false);

  const confirmDeleteExercise = async () => {
    if (!deleteExTarget) return;
    setDeletingEx(true);
    try {
      await workoutApi.deleteExercise(deleteExTarget.id);
      toast.success(`Exercise "${deleteExTarget.name}" deleted.`);
      setExercisesList((prev) => prev.filter((item) => (item._id || item.id) !== deleteExTarget.id));
      setDeleteExTarget(null);
    } catch (err: any) {
      toast.error(err.response?.data?.message || err.message || "Failed to delete exercise");
    } finally {
      setDeletingEx(false);
    }
  };

  const handleDeleteCustomExercise = (exerciseId: string, exName: string) => {
    setDeleteExTarget({ id: exerciseId, name: exName });
  };

  // Day builder helpers
  const addDay = () => {
    setDays((prev) => [...prev, { dayLabel: `Day ${prev.length + 1}`, exercises: [] }]);
  };

  const removeDay = (index: number) => {
    setDays((prev) => prev.filter((_, i) => i !== index));
  };

  const addExerciseToDay = (dayIndex: number) => {
    const defaultExId = exercisesList.length > 0 ? (exercisesList[0]._id || exercisesList[0].id || "") : "";
    setDays((prev) => {
      const next = [...prev];
      next[dayIndex].exercises.push({
        exerciseId: defaultExId,
        order: next[dayIndex].exercises.length + 1,
        targetSets: 3,
        targetReps: 10,
        restSeconds: 60,
      });
      return next;
    });
  };

  const removeExerciseFromDay = (dayIndex: number, exIndex: number) => {
    setDays((prev) => {
      const next = [...prev];
      next[dayIndex].exercises = next[dayIndex].exercises.filter((_, i) => i !== exIndex);
      return next;
    });
  };

  const updateExercise = (dayIndex: number, exIndex: number, field: keyof ExerciseItem, val: string | number | undefined) => {
    setDays((prev) => {
      const next = [...prev];
      next[dayIndex].exercises[exIndex] = { ...next[dayIndex].exercises[exIndex], [field]: val };
      return next;
    });
  };

  // Open Edit Modal for a plan
  const handleOpenEditPlanModal = (plan: IWorkoutPlan) => {
    setEditingPlanId(plan._id || plan.id || "");
    setTitle(plan.title || "");
    setGoal(plan.goal || "General Fitness");
    setStartDate(plan.startDate ? plan.startDate.split("T")[0] : new Date().toISOString().split("T")[0]);

    if (plan.days && Array.isArray(plan.days) && plan.days.length > 0) {
      setDays(
        plan.days.map((d: IWorkoutDay) => ({
          dayLabel: d.dayLabel || d.dayName || "Workout Day",
          exercises: (d.exercises || []).map((e: IWorkoutPlanExercise, idx: number) => ({
            exerciseId: typeof e.exerciseId === "object" ? String((e.exerciseId as { _id?: string; id?: string })?._id || (e.exerciseId as { _id?: string; id?: string })?.id) : String(e.exerciseId),
            order: e.order || idx + 1,
            targetSets: Number(e.targetSets || 3),
            targetReps: Number(e.targetReps || 10),
            targetWeightKg: e.targetWeightKg ? Number(e.targetWeightKg) : undefined,
            restSeconds: e.restSeconds ? Number(e.restSeconds) : 60,
            notes: e.notes || undefined,
          })),
        }))
      );
    } else {
      setDays([{ dayLabel: "Day 1: Push", exercises: [] }]);
    }
    setShowCreateModal(true);
  };

  // Submit new or updated workout plan
  const handlePlanFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClientId) {
      toast.error("Please select a client first.");
      return;
    }
    if (!title.trim()) {
      toast.error("Plan title is required.");
      return;
    }
    if (days.length === 0 || days.some((d) => d.exercises.length === 0)) {
      toast.error("Each day must contain at least 1 exercise.");
      return;
    }

    setSubmittingPlan(true);
    try {
      const payload = {
        title: title.trim(),
        goal: goal.trim(),
        startDate,
        days: days.map((d) => ({
          dayLabel: d.dayLabel,
          exercises: d.exercises.map((ex, idx) => ({
            exerciseId: ex.exerciseId,
            order: idx + 1,
            targetSets: Number(ex.targetSets),
            targetReps: Number(ex.targetReps),
            targetWeightKg: ex.targetWeightKg ? Number(ex.targetWeightKg) : undefined,
            restSeconds: ex.restSeconds ? Number(ex.restSeconds) : 60,
            notes: ex.notes ? ex.notes.trim() : undefined,
          })),
        })),
      };

      if (editingPlanId) {
        await workoutApi.updatePlan(editingPlanId, payload);
        toast.success("Workout plan updated successfully!");
      } else {
        await workoutApi.createPlan(selectedClientId, payload);
        toast.success("Workout plan created & assigned successfully!");
      }

      setShowCreateModal(false);
      setEditingPlanId(null);
      setTitle("");
      setDays([{ dayLabel: "Day 1: Push", exercises: [] }]);

      // Refresh list
      const res = await workoutApi.listPlans(selectedClientId).catch(() => null);
      setPlans(Array.isArray(res) ? res : res?.plans || []);
    } catch (err: any) {
      toast.error(err.response?.data?.message || err.message || "Failed to save workout plan");
    } finally {
      setSubmittingPlan(false);
    }
  };

  // Delete Plan State
  const [deletePlanTarget, setDeletePlanTarget] = useState<{ id: string; title: string } | null>(null);
  const [deletingPlan, setDeletingPlan] = useState(false);

  const confirmDeletePlan = async () => {
    if (!deletePlanTarget) return;
    setDeletingPlan(true);
    try {
      await workoutApi.deletePlan(deletePlanTarget.id);
      toast.success("Workout plan deleted.");
      setPlans((prev) => prev.filter((p) => (p._id || p.id) !== deletePlanTarget.id));
      setDeletePlanTarget(null);
    } catch (err: any) {
      toast.error(err.response?.data?.message || err.message || "Failed to delete plan");
    } finally {
      setDeletingPlan(false);
    }
  };

  const handleDeletePlan = (planId: string, planTitle: string) => {
    setDeletePlanTarget({ id: planId, title: planTitle });
  };

  // Archive Plan
  const handleArchivePlan = async (planId: string) => {
    try {
      await workoutApi.archivePlan(planId);
      toast.success("Workout plan archived.");
      setPlans((prev) => prev.map((p) => (p._id === planId || p.id === planId ? { ...p, status: "ARCHIVED" } : p)));
    } catch (err: any) {
      toast.error(err.message || "Failed to archive plan");
    }
  };

  // Duplicate Plan
  const handleDuplicatePlan = async (planId: string) => {
    try {
      await workoutApi.duplicatePlan(planId);
      toast.success("Workout plan duplicated!");
      const res = await workoutApi.listPlans(selectedClientId).catch(() => null);
      setPlans(Array.isArray(res) ? res : res?.plans || []);
    } catch (err: any) {
      toast.error(err.message || "Failed to duplicate plan");
    }
  };

  const handleSeedExercises = async () => {
    try {
      await workoutApi.seedGlobalExercises();
      toast.success("Global exercise library seeded!");
      const exRes = await workoutApi.listExercises().catch(() => null);
      if (exRes) setExercisesList(Array.isArray(exRes) ? exRes : (exRes as any)?.exercises || []);
    } catch (err: any) {
      toast.error(err.message || "Failed to seed exercise library");
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Workout Plans"
        subtitle="Create, assign, update, and delete client workout routines"
        backTo="/trainer"
        action={
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setShowExerciseManagerModal(true)}
              className="inline-flex items-center gap-1.5 rounded-full bg-(--color-surface-2) text-(--color-text) text-xs font-semibold px-3.5 py-2 hover:bg-(--color-surface-3) transition-colors border border-(--color-border) cursor-pointer"
              title="Manage Exercises & Custom Library"
            >
              <Settings size={14} /> Exercise Library ({exercisesList.length})
            </button>
            <button
              onClick={handleSeedExercises}
              className="inline-flex items-center gap-1.5 rounded-full bg-(--color-surface-2) text-(--color-text) text-xs font-semibold px-3.5 py-2 hover:bg-(--color-surface-3) transition-colors border border-(--color-border) cursor-pointer"
              title="Seed Default Exercise Library"
            >
              <Dumbbell size={14} /> Seed Library
            </button>
            <button
              onClick={() => {
                setEditingPlanId(null);
                setTitle("");
                setGoal("Muscle Building");
                setDays([{ dayLabel: "Day 1: Push", exercises: [] }]);
                setShowCreateModal(true);
              }}
              disabled={!selectedClientId}
              className="inline-flex items-center gap-1.5 rounded-full bg-(--color-accent) text-(--color-navbar) text-xs font-bold px-4 py-2 hover:opacity-90 shadow-md disabled:opacity-50 cursor-pointer"
            >
              <Plus size={15} /> Create Plan
            </button>
          </div>
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

      {/* Plans List */}
      {loadingPlans ? (
        <Card className="flex items-center justify-center p-12 text-sm text-(--color-text-muted) gap-2">
          <Loader2 className="w-5 h-5 animate-spin text-(--color-accent)" /> Loading client's workout plans...
        </Card>
      ) : !selectedClientId ? (
        <Card className="text-center py-12 text-(--color-text-muted)">
          <p className="text-sm">Please select a client above to manage their workout plans.</p>
        </Card>
      ) : plans.length === 0 ? (
        <Card className="text-center py-12 text-(--color-text-muted) space-y-2">
          <Dumbbell className="w-10 h-10 mx-auto text-(--color-text-faint)" />
          <p className="text-sm font-semibold text-(--color-text)">No Workout Plans Found</p>
          <p className="text-xs text-(--color-text-muted)">Click "Create Plan" above to create an active routine for this client.</p>
        </Card>
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {plans.map((p) => {
            const pId = p._id || p.id;
            const status = p.status || (p.isActive ? "ACTIVE" : "ARCHIVED");
            const dayCount = p.days?.length || 0;

            return (
              <Card key={pId} className="p-4 space-y-3 flex flex-col justify-between border border-(--color-border)">
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4 className="font-display text-sm font-bold text-(--color-text)">{p.title}</h4>
                      <p className="text-xs text-(--color-text-muted) mt-0.5">Goal: {p.goal || "General Fitness"}</p>
                    </div>
                    <Badge tone={status === "ACTIVE" ? "good" : "neutral"}>{status}</Badge>
                  </div>

                  <p className="text-xs text-(--color-text-faint)">
                    {dayCount} workout days · Created {new Date(p.createdAt || Date.now()).toLocaleDateString()}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-(--color-border)">
                  <button
                    onClick={() => handleOpenEditPlanModal(p)}
                    className="flex-1 inline-flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg bg-(--color-surface-2) text-xs font-semibold text-(--color-text) hover:border-(--color-accent) border border-transparent cursor-pointer"
                    title="Edit Plan"
                  >
                    <Edit2 size={12} /> Edit
                  </button>
                  <button
                    onClick={() => handleDuplicatePlan(pId)}
                    className="flex-1 inline-flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg bg-(--color-surface-2) text-xs font-semibold text-(--color-text) hover:bg-(--color-surface-3) cursor-pointer"
                    title="Duplicate Plan"
                  >
                    <Copy size={12} /> Duplicate
                  </button>
                  {status === "ACTIVE" && (
                    <button
                      onClick={() => handleArchivePlan(pId)}
                      className="flex-1 inline-flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg bg-amber-500/10 text-amber-400 text-xs font-semibold hover:bg-amber-500/20 cursor-pointer"
                      title="Archive Plan"
                    >
                      <Archive size={12} /> Archive
                    </button>
                  )}
                  <button
                    onClick={() => handleDeletePlan(pId, p.title)}
                    className="inline-flex items-center justify-center p-1.5 rounded-lg bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 cursor-pointer"
                    title="Delete Plan Permanently"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create / Edit Workout Plan Modal */}
      {showCreateModal && (
        <Modal
          onClose={() => {
            setShowCreateModal(false);
            setEditingPlanId(null);
          }}
          maxWidth="2xl"
          title={editingPlanId ? "Edit Workout Plan" : "Create Workout Plan"}
        >
          <form onSubmit={handlePlanFormSubmit} className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-(--color-text-muted) mb-1 font-medium">Plan Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Push / Pull / Legs (Intermediate)"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full rounded-xl bg-(--color-surface-2) p-2.5 text-sm text-(--color-text) border border-(--color-border)"
                />
              </div>

              <div>
                <label className="block text-(--color-text-muted) mb-1 font-medium">Training Goal</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Muscle Building / Fat Loss"
                  value={goal}
                  onChange={(e) => setGoal(e.target.value)}
                  className="w-full rounded-xl bg-(--color-surface-2) p-2.5 text-sm text-(--color-text) border border-(--color-border)"
                />
              </div>
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

            {/* Days Builder */}
            <div className="space-y-3 pt-2 border-t border-(--color-border)">
              <div className="flex items-center justify-between">
                <span className="font-bold text-(--color-text) uppercase tracking-wider text-[11px]">Workout Days ({days.length})</span>
                <button
                  type="button"
                  onClick={addDay}
                  className="px-2.5 py-1 rounded-lg bg-(--color-surface-2) text-(--color-accent) text-xs font-semibold flex items-center gap-1 cursor-pointer"
                >
                  <Plus size={13} /> Add Day
                </button>
              </div>

              {days.map((day, dIdx) => (
                <div key={dIdx} className="p-3 rounded-xl bg-(--color-surface-2) space-y-3 border border-white/5">
                  <div className="flex items-center justify-between gap-2">
                    <input
                      type="text"
                      required
                      placeholder="Day Label (e.g. Day 1: Push)"
                      value={day.dayLabel}
                      onChange={(e) => {
                        const val = e.target.value;
                        setDays((prev) => {
                          const next = [...prev];
                          next[dIdx].dayLabel = val;
                          return next;
                        });
                      }}
                      className="bg-transparent font-bold text-sm text-(--color-text) outline-none border-b border-white/10 flex-1 py-1"
                    />
                    {days.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeDay(dIdx)}
                        className="text-red-400 text-xs hover:underline font-semibold cursor-pointer"
                      >
                        Remove Day
                      </button>
                    )}
                  </div>

                  {/* Exercises list for day */}
                  <div className="space-y-2">
                    {day.exercises.map((ex, exIdx) => (
                      <div key={exIdx} className="p-2.5 rounded-lg bg-(--color-surface) space-y-2 border border-white/5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[11px] text-(--color-text-muted) font-semibold">Ex #{exIdx + 1}</span>
                          <button
                            type="button"
                            onClick={() => removeExerciseFromDay(dIdx, exIdx)}
                            className="text-red-400 text-[10px] hover:underline cursor-pointer"
                          >
                            Remove
                          </button>
                        </div>

                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <label className="text-[11px] text-(--color-text-muted) font-medium">Exercise</label>
                            <button
                              type="button"
                              onClick={() => setShowAddCustomExerciseModal(true)}
                              className="text-[10px] text-(--color-accent) font-semibold hover:underline flex items-center gap-0.5 cursor-pointer"
                            >
                              <Plus size={11} /> Add custom exercise
                            </button>
                          </div>
                          <CustomSelect
                            value={ex.exerciseId}
                            onChange={(val) => updateExercise(dIdx, exIdx, "exerciseId", val)}
                            options={exercisesList.map((item) => ({
                              value: String(item._id || item.id),
                              label: `${item.name} (${item.muscleGroup || item.category || "General"})`,
                            }))}
                          />
                        </div>

                        <div className="grid grid-cols-3 gap-2">
                          <div className="min-w-0">
                            <label className="block text-(--color-text-muted) text-[10px] mb-0.5 truncate">Sets</label>
                            <input
                              type="number"
                              required
                              min="1"
                              value={ex.targetSets}
                              onChange={(e) => updateExercise(dIdx, exIdx, "targetSets", Number(e.target.value))}
                              className="w-full rounded-lg bg-(--color-surface-2) p-1.5 text-xs text-(--color-text) border border-(--color-border)"
                            />
                          </div>
                          <div className="min-w-0">
                            <label className="block text-(--color-text-muted) text-[10px] mb-0.5 truncate">Reps</label>
                            <input
                              type="number"
                              required
                              min="1"
                              value={ex.targetReps}
                              onChange={(e) => updateExercise(dIdx, exIdx, "targetReps", Number(e.target.value))}
                              className="w-full rounded-lg bg-(--color-surface-2) p-1.5 text-xs text-(--color-text) border border-(--color-border)"
                            />
                          </div>
                          <div className="min-w-0">
                            <label className="block text-(--color-text-muted) text-[10px] mb-0.5 truncate">Weight (KG)</label>
                            <input
                              type="number"
                              placeholder="Opt"
                              value={ex.targetWeightKg || ""}
                              onChange={(e) => updateExercise(dIdx, exIdx, "targetWeightKg", e.target.value ? Number(e.target.value) : undefined)}
                              className="w-full rounded-lg bg-(--color-surface-2) p-1.5 text-xs text-(--color-text) border border-(--color-border)"
                            />
                          </div>
                        </div>
                      </div>
                    ))}

                    <button
                      type="button"
                      onClick={() => addExerciseToDay(dIdx)}
                      className="w-full py-2 rounded-lg bg-(--color-surface) text-(--color-accent) text-xs font-semibold border border-dashed border-(--color-border) flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <Plus size={13} /> Add Exercise to {day.dayLabel || "Day"}
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowCreateModal(false);
                  setEditingPlanId(null);
                }}
                className="flex-1 py-2.5 rounded-xl bg-(--color-surface-2) font-semibold text-(--color-text) cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submittingPlan}
                className="flex-1 py-2.5 rounded-xl bg-(--color-accent) text-(--color-navbar) font-bold shadow-md flex items-center justify-center gap-1.5 cursor-pointer"
              >
                {submittingPlan ? <Loader2 className="w-4 h-4 animate-spin" /> : editingPlanId ? "Update Workout Plan" : "Save & Assign Plan"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Exercise Library Manager Modal */}
      {showExerciseManagerModal && (
        <Modal
          onClose={() => setShowExerciseManagerModal(false)}
          maxWidth="3xl"
          title="Exercise Library Management"
          subtitle="View, create, edit, and delete custom exercises for your gym"
        >
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="relative w-full sm:w-72">
                <Search size={14} className="absolute left-3 top-3 text-(--color-text-muted)" />
                <input
                  type="text"
                  placeholder="Search exercises..."
                  value={exSearch}
                  onChange={(e) => setExSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 rounded-xl bg-(--color-surface-2) text-xs text-(--color-text) border border-(--color-border) outline-none focus:border-(--color-accent)"
                />
              </div>
              <button
                onClick={() => {
                  setEditingCustomExId(null);
                  setCustomExForm({
                    name: "",
                    muscleGroup: "CHEST",
                    equipment: "",
                    instructions: "",
                    defaultSets: 3,
                    defaultReps: 10,
                  });
                  setShowAddCustomExerciseModal(true);
                }}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-(--color-accent) text-(--color-navbar) text-xs font-bold shadow cursor-pointer"
              >
                <Plus size={14} /> Add Custom Exercise
              </button>
            </div>

            {/* Exercise List */}
            <div className="max-h-96 overflow-y-auto space-y-2 pr-1">
              {exercisesList
                .filter((ex) => !exSearch || ex.name?.toLowerCase().includes(exSearch.toLowerCase()) || ex.muscleGroup?.toLowerCase().includes(exSearch.toLowerCase()))
                .map((ex) => {
                  const isCustom = Boolean(ex.gymId);
                  const exId = ex._id || ex.id;

                  return (
                    <div
                      key={exId}
                      className="p-3 rounded-xl bg-(--color-surface-2) border border-(--color-border) flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-(--color-text)">{ex.name}</p>
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-(--color-surface-3) font-semibold text-(--color-text-muted)">
                            {ex.muscleGroup || "General"}
                          </span>
                          {isCustom ? (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-(--color-accent)/15 font-bold text-(--color-accent)">
                              Custom
                            </span>
                          ) : (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-500/10 font-bold text-slate-400">
                              Global
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-(--color-text-muted)">
                          Equipment: {ex.equipment || "Bodyweight"} · Default: {ex.defaultSets || 3} sets × {ex.defaultReps || 10} reps
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        {isCustom ? (
                          <>
                            <button
                              onClick={() => handleEditCustomExerciseClick(ex)}
                              className="p-1.5 rounded-lg bg-(--color-surface-3) text-(--color-text) hover:text-(--color-accent) transition-colors cursor-pointer"
                              title="Edit Custom Exercise"
                            >
                              <Edit2 size={13} />
                            </button>
                            <button
                              onClick={() => handleDeleteCustomExercise(exId, ex.name)}
                              className="p-1.5 rounded-lg bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 transition-colors cursor-pointer"
                              title="Delete Custom Exercise"
                            >
                              <Trash2 size={13} />
                            </button>
                          </>
                        ) : (
                          <span className="text-[10px] text-(--color-text-faint) italic">Read-only library</span>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        </Modal>
      )}

      {/* Add / Edit Custom Exercise Modal */}
      {showAddCustomExerciseModal && (
        <Modal
          onClose={() => {
            setShowAddCustomExerciseModal(false);
            setEditingCustomExId(null);
          }}
          maxWidth="md"
          title={editingCustomExId ? "Edit Custom Exercise" : "Add Custom Exercise"}
        >
          <form onSubmit={handleCustomExerciseSubmit} className="space-y-3.5 text-xs">
            <div>
              <label className="block text-(--color-text-muted) mb-1 font-medium">Exercise Name</label>
              <input
                type="text"
                required
                placeholder="e.g. Incline Cable Flyes"
                value={customExForm.name}
                onChange={(e) => setCustomExForm({ ...customExForm, name: e.target.value })}
                className="w-full rounded-xl bg-(--color-surface-2) p-2.5 text-sm text-(--color-text) border border-(--color-border) outline-none focus:border-(--color-accent)"
              />
            </div>

            <div>
              <CustomSelect
                label="Muscle Group"
                value={customExForm.muscleGroup}
                onChange={(val) => setCustomExForm({ ...customExForm, muscleGroup: val })}
                options={[
                  { label: "Chest", value: "CHEST" },
                  { label: "Back", value: "BACK" },
                  { label: "Legs", value: "LEGS" },
                  { label: "Shoulders", value: "SHOULDERS" },
                  { label: "Arms", value: "ARMS" },
                  { label: "Core", value: "CORE" },
                  { label: "Full Body", value: "FULL_BODY" },
                  { label: "Cardio", value: "CARDIO" },
                ]}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-(--color-text-muted) mb-1 font-medium">Equipment (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Cable Machine / Dumbbell"
                  value={customExForm.equipment}
                  onChange={(e) => setCustomExForm({ ...customExForm, equipment: e.target.value })}
                  className="w-full rounded-xl bg-(--color-surface-2) p-2.5 text-xs text-(--color-text) border border-(--color-border) outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-(--color-text-muted) mb-1 font-medium">Default Sets</label>
                  <input
                    type="number"
                    min="1"
                    value={customExForm.defaultSets}
                    onChange={(e) => setCustomExForm({ ...customExForm, defaultSets: Number(e.target.value) })}
                    className="w-full rounded-xl bg-(--color-surface-2) p-2.5 text-xs text-(--color-text) border border-(--color-border) outline-none"
                  />
                </div>
                <div>
                  <label className="block text-(--color-text-muted) mb-1 font-medium">Default Reps</label>
                  <input
                    type="number"
                    min="1"
                    value={customExForm.defaultReps}
                    onChange={(e) => setCustomExForm({ ...customExForm, defaultReps: Number(e.target.value) })}
                    className="w-full rounded-xl bg-(--color-surface-2) p-2.5 text-xs text-(--color-text) border border-(--color-border) outline-none"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-(--color-text-muted) mb-1 font-medium">Instructions / Notes (Optional)</label>
              <textarea
                rows={2}
                placeholder="Form cues, bench angle, safety instructions..."
                value={customExForm.instructions}
                onChange={(e) => setCustomExForm({ ...customExForm, instructions: e.target.value })}
                className="w-full rounded-xl bg-(--color-surface-2) p-2 text-xs text-(--color-text) border border-(--color-border) outline-none resize-none"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowAddCustomExerciseModal(false);
                  setEditingCustomExId(null);
                }}
                className="flex-1 py-2.5 rounded-xl bg-(--color-surface-2) font-semibold text-(--color-text) cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submittingCustomExercise}
                className="flex-1 py-2.5 rounded-xl bg-(--color-accent) text-(--color-navbar) font-bold shadow-md flex items-center justify-center gap-1.5 cursor-pointer"
              >
                {submittingCustomExercise ? <Loader2 className="w-4 h-4 animate-spin" /> : editingCustomExId ? "Update Exercise" : "Save Custom Exercise"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Delete Custom Exercise Confirmation Dialog */}
      <ConfirmDialog
        isOpen={!!deleteExTarget}
        onClose={() => setDeleteExTarget(null)}
        onConfirm={confirmDeleteExercise}
        title="Delete Custom Exercise"
        description={`Are you sure you want to delete "${deleteExTarget?.name}"?`}
        confirmText="Delete Exercise"
        tone="danger"
        loading={deletingEx}
      />

      {/* Delete Plan Confirmation Dialog */}
      <ConfirmDialog
        isOpen={!!deletePlanTarget}
        onClose={() => setDeletePlanTarget(null)}
        onConfirm={confirmDeletePlan}
        title="Delete Workout Plan"
        description={`Are you sure you want to permanently delete "${deletePlanTarget?.title}"?`}
        confirmText="Delete Plan"
        tone="danger"
        loading={deletingPlan}
      />
    </div>
  );
}
