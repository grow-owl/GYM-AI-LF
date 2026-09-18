import { useState, useEffect, useCallback } from "react";
import { Utensils, Loader2, Flame, RefreshCw } from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import { memberApi, dietApi } from "@/lib/endpoints";
import { useAuthStore } from "@/store/authStore";

export default function DietPlan() {
  const user = useAuthStore((s) => s.user);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activePlan, setActivePlan] = useState<any | null>(null);

  const loadPlan = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const profRes = await memberApi.getSelfProfile().catch(() => null);
      const memberId = profRes?.member?._id || user?._id;
      if (memberId) {
        const planRes = await dietApi.getActive(memberId);
        const plan: any = (planRes as any)?.dietPlan || (planRes as any)?.plan || planRes;
        if (plan && (plan._id || plan.id || plan.title)) {
          setActivePlan(plan);
        }
      }
    } catch (err) {
      console.error("Failed to load active diet plan:", err);
      setError("Failed to load your nutrition plan from server.");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadPlan();
  }, [loadPlan]);

  if (loading) {
    return (
      <div>
        <PageHeader title="Diet Plan" subtitle="Loading your assigned nutrition plan..." backTo="/member" />
        <Card className="flex items-center justify-center p-12 text-sm text-(--color-text-muted) gap-2">
          <Loader2 className="w-5 h-5 animate-spin text-(--color-accent)" /> Loading nutrition plan...
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <PageHeader title="Diet Plan" subtitle="Your active nutrition targets" backTo="/member" />
        <Card className="text-center py-12 text-(--color-text-muted) space-y-3">
          <p className="text-base font-bold text-red-400">{error}</p>
          <button
            onClick={loadPlan}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-full bg-(--color-accent) text-(--color-navbar) cursor-pointer hover:brightness-110"
          >
            <RefreshCw size={14} /> Retry Sync
          </button>
        </Card>
      </div>
    );
  }

  if (!activePlan || !activePlan.meals || activePlan.meals.length === 0) {
    return (
      <div>
        <PageHeader title="Diet Plan" subtitle="Your active nutrition targets" backTo="/member" />
        <Card className="text-center py-12 text-(--color-text-muted) space-y-3">
          <Utensils className="w-12 h-12 mx-auto text-(--color-text-faint)" />
          <p className="text-base font-bold text-(--color-text)">No Diet Plan Assigned Yet</p>
          <p className="text-xs text-(--color-text-muted) max-w-sm mx-auto">
            Your trainer has not assigned an active nutrition plan to your profile. Please ask your trainer to create a diet plan for you.
          </p>
        </Card>
      </div>
    );
  }

  const calorieTarget = activePlan.dailyCalorieTarget || 2000;
  const proteinTarget = activePlan.dailyProteinTarget_g || 120;

  return (
    <div className="space-y-4">
      <PageHeader
        title={activePlan.title || "Diet Plan"}
        subtitle={`Target: ${calorieTarget.toLocaleString()} kcal · ${proteinTarget}g Protein`}
        backTo="/member"
      />

      {/* Target Summary Card */}
      <Card sweep className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Flame className="w-5 h-5 text-amber-400" />
            <h3 className="font-display text-sm font-bold text-(--color-text)">Daily Macro Targets</h3>
          </div>
          <Badge tone="good">ACTIVE PLAN</Badge>
        </div>

        <div className="grid grid-cols-2 gap-3 pt-1">
          <div className="bg-(--color-surface-2) p-3 rounded-xl text-center">
            <p className="text-xl font-extrabold text-amber-400">{calorieTarget.toLocaleString()}</p>
            <p className="text-[10px] uppercase font-bold tracking-wider text-(--color-text-muted) mt-0.5">Calories (kcal)</p>
          </div>
          <div className="bg-(--color-surface-2) p-3 rounded-xl text-center">
            <p className="text-xl font-extrabold text-indigo-400">{proteinTarget}g</p>
            <p className="text-[10px] uppercase font-bold tracking-wider text-(--color-text-muted) mt-0.5">Protein Target</p>
          </div>
        </div>
      </Card>

      {/* Meals List */}
      <div className="space-y-3">
        {activePlan.meals.map((m: any, idx: number) => {
          const typeName = m.mealType ? m.mealType.toUpperCase() : `MEAL ${idx + 1}`;
          const itemsList = m.items || [];
          const mealCalories = itemsList.reduce((acc: number, item: any) => acc + (item.calories || 0), 0);
          const mealProtein = itemsList.reduce((acc: number, item: any) => acc + (item.protein_g || 0), 0);

          return (
            <Card key={idx} className="p-4 space-y-2">
              <div className="flex items-center justify-between border-b border-(--color-border) pb-2">
                <p className="text-xs font-bold text-(--color-accent) uppercase tracking-wider">{typeName}</p>
                <div className="flex items-center gap-2 text-xs font-mono text-(--color-text-muted)">
                  {mealCalories > 0 && <span>{mealCalories} kcal</span>}
                  {mealProtein > 0 && <span>· {mealProtein}g protein</span>}
                </div>
              </div>

              <div className="space-y-1.5 pt-1">
                {itemsList.map((item: any, iIdx: number) => (
                  <div key={iIdx} className="flex items-center justify-between text-xs">
                    <span className="font-medium text-(--color-text)">{item.name}</span>
                    <span className="text-(--color-text-muted) font-mono">{item.quantity}</span>
                  </div>
                ))}
              </div>

              {m.notes && (
                <p className="text-[11px] text-amber-400 italic pt-1 border-t border-(--color-border-soft)">
                  Note: {m.notes}
                </p>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
