import { useState, useEffect } from "react";
import { CheckCircle2, Zap, Mail, PhoneCall, Loader2 } from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Modal from "@/components/ui/Modal";
import { gymApi, paymentApi } from "@/lib/endpoints";
import { useAuthStore } from "@/store/authStore";
import { useGymBranch } from "@/hooks/useGymBranch";
import { toast } from "sonner";
import { showApiErrorToast } from "@/lib/api";

import { plans, CARD_ID_TO_GYM_PLAN, GYM_PLAN_TO_CARD_ID } from "@/data/pricing";

export default function Billing() {
  const user = useAuthStore((s) => s.user);
  const { gymId } = useGymBranch();
  const [currentPlanCardId, setCurrentPlanCardId] = useState<string | null>(null);
  const [currentPlanRaw, setCurrentPlanRaw] = useState<string | null>(null);
  const [loadingPlan, setLoadingPlan] = useState(true);
  const [selectedPlanForUpgrade, setSelectedPlanForUpgrade] = useState<any | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [pendingDowngrade, setPendingDowngrade] = useState<string | null>(null);

  useEffect(() => {
    const fetchPlan = async () => {
      setLoadingPlan(true);
      try {
        const activeGymId = gymId || user?.gymId;
        if (activeGymId) {
          const gymRes = await gymApi.getGymById(activeGymId).catch(() => null);
          const rawPlan = gymRes?.gym?.plan || (gymRes as any)?.plan;
          if (rawPlan) {
            const raw = String(rawPlan).toUpperCase();
            setCurrentPlanRaw(raw);
            setCurrentPlanCardId(GYM_PLAN_TO_CARD_ID[raw] || raw.toLowerCase());
            return;
          }
        }

        const billingRes = await paymentApi.getPlatformBilling().catch(() => null);
        if (billingRes?.plan) {
          const raw = String(billingRes.plan).toUpperCase();
          setCurrentPlanRaw(raw);
          setCurrentPlanCardId(GYM_PLAN_TO_CARD_ID[raw] || raw.toLowerCase());
        } else if (billingRes?.invoices?.length) {
          const latestInvoice = billingRes.invoices[0];
          const raw = String(latestInvoice.plan || "PRO").toUpperCase();
          setCurrentPlanRaw(raw);
          setCurrentPlanCardId(GYM_PLAN_TO_CARD_ID[raw] || raw.toLowerCase());
        } else {
          setCurrentPlanRaw("STARTER");
          setCurrentPlanCardId("starter");
        }
      } catch {
        setCurrentPlanRaw("STARTER");
        setCurrentPlanCardId("starter");
      } finally {
        setLoadingPlan(false);
      }
    };

    fetchPlan();
  }, [gymId, user?.gymId]);

  const handleOpenUpgradeModal = (plan: any) => {
    setSelectedPlanForUpgrade(plan);
  };

  const handleConfirmRequest = async () => {
    if (!selectedPlanForUpgrade) return;
    const targetGymId = gymId || user?.gymId;
    if (!targetGymId) {
      toast.error("No active gym selected. Please select a gym to request an upgrade.");
      return;
    }
    const requestedPlanEnum = CARD_ID_TO_GYM_PLAN[selectedPlanForUpgrade.id] || selectedPlanForUpgrade.id.toUpperCase();

    setSubmitting(true);
    try {
      await paymentApi.requestUpgrade(targetGymId, {
        requestedPlan: requestedPlanEnum,
        billingCycle: "MONTHLY",
      });
      if (selectedPlanForUpgrade.id === "starter" && currentPlanCardId !== "starter") {
        setPendingDowngrade(selectedPlanForUpgrade.name);
        toast.success(`Downgrade request for ${selectedPlanForUpgrade.name} submitted to Super Admin.`);
      } else {
        toast.success(`Upgrade request for ${selectedPlanForUpgrade.name} submitted! Super Admin will process your tier change.`);
      }
    } catch (err: any) {
      showApiErrorToast(err, "Failed to submit plan change request. Please try again.");
    } finally {
      setSubmitting(false);
      setSelectedPlanForUpgrade(null);
    }
  };

  const handleRevokeDowngrade = async () => {
    const activeGymId = gymId || user?.gymId;
    if (activeGymId) {
      try {
        await paymentApi.cancelUpgradeRequest(activeGymId);
      } catch (err: any) {
        showApiErrorToast(err, "Failed to cancel request on server.");
        return;
      }
    }
    setPendingDowngrade(null);
    toast.success("Downgrade request revoked successfully! Your active plan remains active.");
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Platform Subscription & Billing"
        titleClassName="text-base sm:text-xl font-semibold whitespace-normal break-words leading-tight"
        backTo="/owner"
      />

      <Card sweep className="mb-4">
        <div className="w-full">
          <p className="text-xs font-semibold text-(--color-text-muted) mb-1">Active Plan</p>
          {loadingPlan ? (
            <div className="flex items-center gap-2 text-sm text-(--color-text-muted) py-1">
              <Loader2 size={16} className="animate-spin text-(--color-accent)" /> Loading subscription tier...
            </div>
          ) : (
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-2xl sm:text-3xl font-extrabold text-(--color-text) capitalize">
                {currentPlanRaw} Plan
              </h2>
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-600 text-white shadow-xs shrink-0 tracking-wide">
                Active
              </span>
            </div>
          )}
          {pendingDowngrade && (
            <div className="mt-2.5 flex items-center gap-2 flex-wrap">
              <Badge tone="warn">Pending Downgrade: {pendingDowngrade}</Badge>
              <button
                onClick={handleRevokeDowngrade}
                className="text-xs font-semibold text-rose-400 hover:underline cursor-pointer"
              >
                Revoke Downgrade Request
              </button>
            </div>
          )}
        </div>
      </Card>

      <div className="grid sm:grid-cols-3 gap-4">
        {plans.map((p) => (
          <Card
            key={p.id}
            className={`flex flex-col justify-between p-5 ${
              p.popular ? "border-2 border-(--color-accent) shadow-lg" : ""
            }`}
          >
            <div>
              {p.popular && (
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-(--color-accent) text-(--color-navbar) inline-block mb-2">
                  Most Popular
                </span>
              )}
              <h3 className="text-lg font-bold text-(--color-text)">{p.name}</h3>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="text-2xl font-extrabold text-(--color-text)">{p.price}</span>
                <span className="text-xs text-(--color-text-faint)">{p.period}</span>
              </div>
              <ul className="mt-4 space-y-2 text-xs text-(--color-text-muted)">
                {p.features.map((f) => (
                  <li key={f} className="flex items-center gap-2">
                    <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            </div>

            <button
              disabled={loadingPlan || currentPlanCardId === p.id}
              onClick={() => handleOpenUpgradeModal(p)}
              className={`mt-6 w-full py-2.5 rounded-full text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                currentPlanCardId === p.id
                  ? "bg-(--color-surface-3) text-(--color-text-muted) cursor-default"
                  : "bg-(--color-accent) text-(--color-navbar) font-bold hover:opacity-90 shadow-md cursor-pointer"
              }`}
            >
              {loadingPlan ? (
                <>
                  <Loader2 size={13} className="animate-spin" /> Checking Plan...
                </>
              ) : currentPlanCardId === p.id ? (
                "Current Active Plan"
              ) : (
                <>
                  <Zap size={14} /> Request {p.id === "starter" ? "Downgrade" : "Upgrade"}
                </>
              )}
            </button>
          </Card>
        ))}
      </div>

      {/* Offline Upgrade/Downgrade Request Guidance Modal */}
      {selectedPlanForUpgrade && (
        <Modal
          onClose={() => setSelectedPlanForUpgrade(null)}
          maxWidth="md"
          title={`Subscription Request: ${selectedPlanForUpgrade.name} (${selectedPlanForUpgrade.price})`}
        >
          <div className="space-y-4">
            <p className="text-xs text-(--color-text-muted) leading-relaxed">
              Platform subscription modifications are verified directly by Super Admin. Downgrade requests can be revoked directly from your dashboard at any time.
            </p>

            <div className="p-3 rounded-xl bg-(--color-surface-2) space-y-2 text-xs text-(--color-text-muted)">
              <p className="font-semibold text-(--color-text)">Direct Super Admin Support:</p>
              <div className="flex items-center gap-2">
                <Mail size={14} className="text-(--color-accent)" />
                <span>Mail Support: <strong>support@gymai.com</strong></span>
              </div>
              <div className="flex items-center gap-2">
                <PhoneCall size={14} className="text-(--color-accent)" />
                <span>Super Admin Line: <strong>+91 98765 43210</strong></span>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setSelectedPlanForUpgrade(null)}
                className="px-4 py-2 text-xs font-medium text-(--color-text-muted)"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={handleConfirmRequest}
                className="px-4 py-2 text-xs font-bold rounded-full bg-(--color-accent) text-(--color-navbar) disabled:opacity-50"
              >
                {submitting ? "Submitting..." : "Submit Request"}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
