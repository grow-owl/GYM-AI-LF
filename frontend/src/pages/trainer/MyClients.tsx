import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, RefreshCw, Users, Star, MessageSquare, Scale, Plus, Activity } from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Modal from "@/components/ui/Modal";
import { trainerApi, feedbackApi, progressApi } from "@/lib/endpoints";
import { useAuthStore } from "@/store/authStore";
import { toast } from "sonner";

export default function MyClients() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [clients, setClients] = useState<any[]>([]);
  const [clientFeedbacks, setClientFeedbacks] = useState<Record<string, any[]>>({});

  // Metrics Modal state
  const [activeClient, setActiveClient] = useState<any | null>(null);
  const [weightKg, setWeightKg] = useState<string>("70.0");
  const [heightCm, setHeightCm] = useState<string>("175");
  const [targetWeightKg, setTargetWeightKg] = useState<string>("68.0");
  const [savingMetrics, setSavingMetrics] = useState(false);

  const fetchClients = async () => {
    if (!user?.gymId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await trainerApi.getMyClients(user.gymId);
      const list = Array.isArray(res) ? res : res?.clients || [];
      setClients(list);

      // Fetch feedback for each client
      const feedbackMap: Record<string, any[]> = {};
      await Promise.all(
        list.map(async (c: any) => {
          const clientId = c._id || c.id;
          if (clientId) {
            try {
              const fbRes = await feedbackApi.list(clientId);
              const fbList = Array.isArray(fbRes) ? fbRes : fbRes?.feedback || fbRes?.data || [];
              feedbackMap[clientId] = fbList;
            } catch {
              feedbackMap[clientId] = [];
            }
          }
        })
      );
      setClientFeedbacks(feedbackMap);
    } catch {
      setError("Failed to load assigned clients.");
      setClients([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClients();
  }, [user]);

  const openMetricsModal = (client: any) => {
    setActiveClient(client);
    setWeightKg(String(client?.healthInfo?.currentWeight_kg || client?.weightKg || "70.0"));
    setHeightCm(String(client?.healthInfo?.height_cm || client?.heightCm || "175"));
    setTargetWeightKg(String(client?.healthInfo?.targetWeight_kg || client?.targetWeightKg || "68.0"));
  };

  const handleSaveMetrics = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeClient) return;
    const clientId = activeClient._id || activeClient.id;
    const w = parseFloat(weightKg);
    const h = parseFloat(heightCm);
    const t = parseFloat(targetWeightKg);

    if (isNaN(w) || w <= 0) {
      toast.error("Please enter a valid weight in kg");
      return;
    }

    setSavingMetrics(true);
    try {
      await progressApi.logWeight({
        memberId: clientId,
        weightKg: w,
        heightCm: !isNaN(h) && h > 0 ? h : undefined,
        targetWeightKg: !isNaN(t) && t > 0 ? t : undefined,
      });
      toast.success(`Body metrics & BMI updated for ${activeClient.userId?.fullName || "Client"}!`);
      setActiveClient(null);
      fetchClients();
    } catch (err: any) {
      toast.error(err.response?.data?.message || err.message || "Failed to update body metrics");
    } finally {
      setSavingMetrics(false);
    }
  };

  // Helper for BMI calculation
  const calcBmi = (wStr: string, hStr: string) => {
    const w = parseFloat(wStr);
    const h = parseFloat(hStr);
    if (!w || !h || h <= 0) return null;
    const heightM = h / 100;
    const bmiVal = Number((w / (heightM * heightM)).toFixed(1));
    let category = "Normal";
    let colorClass = "text-emerald-500";
    if (bmiVal < 18.5) {
      category = "Underweight";
      colorClass = "text-amber-500";
    } else if (bmiVal >= 25 && bmiVal < 29.9) {
      category = "Overweight";
      colorClass = "text-amber-500";
    } else if (bmiVal >= 30) {
      category = "Obese";
      colorClass = "text-rose-500";
    }
    return { bmiVal, category, colorClass };
  };

  return (
    <div className="space-y-4">
      <PageHeader title="My Clients" subtitle={`${clients.length} assigned`} backTo="/trainer" />

      {loading ? (
        <div className="flex items-center justify-center p-12 text-sm text-(--color-text-muted) gap-2">
          <Loader2 className="w-5 h-5 animate-spin text-(--color-accent)" /> Loading assigned clients...
        </div>
      ) : error ? (
        <Card className="text-center py-8">
          <p className="text-sm text-(--color-danger) mb-3">{error}</p>
          <button
            onClick={fetchClients}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs rounded-full bg-(--color-surface-3) text-(--color-text)"
          >
            <RefreshCw size={14} /> Retry
          </button>
        </Card>
      ) : clients.length === 0 ? (
        <Card className="flex flex-col items-center justify-center py-12 text-center">
          <Users className="w-8 h-8 text-(--color-text-faint) mb-2 opacity-50" />
          <p className="text-sm font-medium text-(--color-text)">No assigned clients yet</p>
          <p className="text-xs text-(--color-text-faint) mt-1 max-w-xs">
            Members assigned to you by the gym manager will appear here.
          </p>
        </Card>
      ) : (
        <div className="space-y-4">
          {clients.map((c) => {
            const clientId = c._id || c.id;
            const name = c.userId?.fullName || c.name || "Client";
            const plan = c.planName || c.plan || "Membership";
            const status = c.membershipStatus || c.status || "ACTIVE";
            const initials = name
              .split(" ")
              .map((n: string) => n[0])
              .join("")
              .slice(0, 2);

            const feedbacks = clientFeedbacks[clientId] || [];

            const h = c.healthInfo?.height_cm || c.heightCm;
            const w = c.healthInfo?.currentWeight_kg || c.currentWeight_kg || c.weightKg;
            const targetW = c.healthInfo?.targetWeight_kg || c.targetWeightKg;
            const bmi = h && w ? (w / Math.pow(h / 100, 2)).toFixed(1) : null;

            return (
              <Card key={clientId} className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-(--color-surface-3) text-sm font-semibold text-(--color-text)">
                      {initials}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-(--color-text) truncate">{name}</p>
                      <p className="text-xs text-(--color-text-faint) truncate">{plan}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => navigate(`/trainer/progress?clientId=${clientId}`)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-(--color-surface-3) text-(--color-text) text-xs font-bold border border-(--color-border) hover:border-(--color-accent) transition-all cursor-pointer"
                    >
                      <Activity size={13} className="text-(--color-accent)" /> View Progress & Report
                    </button>
                    <button
                      onClick={() => openMetricsModal(c)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-(--color-accent) text-(--color-navbar) text-xs font-bold shadow-md hover:brightness-110 transition-all cursor-pointer"
                    >
                      <Scale size={13} /> Log Body Metrics & BMI
                    </button>
                    {status === "FROZEN" || c.churnRisk === "high" ? (
                      <Badge tone="danger" className="shrink-0">Needs attention</Badge>
                    ) : (
                      <Badge tone="good" className="shrink-0">On track</Badge>
                    )}
                  </div>
                </div>

                {/* Health Metrics & BMI Card */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-(--color-surface-2) p-3 rounded-xl border border-(--color-border-soft)">
                  <div>
                    <span className="text-[10px] font-extrabold uppercase text-(--color-text-muted)">Current Weight</span>
                    <p className="text-sm font-extrabold text-(--color-text)">{w ? `${w} kg` : "—"}</p>
                  </div>
                  <div>
                    <span className="text-[10px] font-extrabold uppercase text-(--color-text-muted)">Height</span>
                    <p className="text-sm font-extrabold text-(--color-text)">{h ? `${h} cm` : "—"}</p>
                  </div>
                  <div>
                    <span className="text-[10px] font-extrabold uppercase text-(--color-text-muted)">Target Goal</span>
                    <p className="text-sm font-extrabold text-emerald-500">{targetW ? `${targetW} kg` : "—"}</p>
                  </div>
                  <div>
                    <span className="text-[10px] font-extrabold uppercase text-(--color-text-muted)">Calculated BMI</span>
                    <p className="text-sm font-extrabold text-(--color-accent-text)">{bmi ? `${bmi}` : "—"}</p>
                  </div>
                </div>

                {/* Feedback section */}
                <div className="pt-2 border-t border-(--color-border-soft) space-y-2">
                  <div className="flex items-center gap-1.5 text-xs text-(--color-text-muted) font-medium">
                    <MessageSquare size={13} className="text-(--color-accent)" />
                    <span>Client Feedback ({feedbacks.length})</span>
                  </div>

                  {feedbacks.length === 0 ? (
                    <p className="text-xs text-(--color-text-faint) italic">No feedback submitted yet.</p>
                  ) : (
                    <div className="space-y-1.5">
                      {feedbacks.map((fb: any, idx: number) => (
                        <div key={fb._id || idx} className="p-2.5 rounded-xl bg-(--color-surface-2) text-xs space-y-1">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1 text-amber-400">
                              {[1, 2, 3, 4, 5].map((star) => (
                                <Star
                                  key={star}
                                  size={12}
                                  fill={star <= (fb.rating || 5) ? "currentColor" : "none"}
                                />
                              ))}
                              <span className="text-[11px] font-semibold text-(--color-text) ml-1">
                                {fb.rating || 5}/5
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] text-(--color-text-faint)">
                                {new Date(fb.createdAt || Date.now()).toLocaleDateString()}
                              </span>
                              <button
                                onClick={async () => {
                                  const fbId = fb._id || fb.id;
                                  if (!fbId) return;
                                  try {
                                    await feedbackApi.delete(fbId);
                                    fetchClients();
                                  } catch (err) {
                                    console.warn("Failed to delete feedback:", err);
                                  }
                                }}
                                className="text-rose-400 hover:text-rose-300 text-[10px] cursor-pointer"
                                title="Delete Feedback"
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                          <p className="text-(--color-text) text-xs leading-relaxed">{fb.note}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Trainer Body Metrics & BMI Log Modal */}
      {activeClient && (
        <Modal
          onClose={() => setActiveClient(null)}
          title={`Log Body Metrics & BMI — ${activeClient.userId?.fullName || "Client"}`}
          maxWidth="md"
        >
          <form onSubmit={handleSaveMetrics} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-semibold text-(--color-text-muted) block mb-1">Current Weight (kg)</label>
                <input
                  type="number"
                  step="0.1"
                  required
                  value={weightKg}
                  onChange={(e) => setWeightKg(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-(--color-surface-2) border border-(--color-border) text-sm font-bold text-(--color-text) outline-none focus:border-(--color-accent)"
                  placeholder="70.0"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-(--color-text-muted) block mb-1">Height (cm)</label>
                <input
                  type="number"
                  step="1"
                  value={heightCm}
                  onChange={(e) => setHeightCm(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-(--color-surface-2) border border-(--color-border) text-sm font-bold text-(--color-text) outline-none focus:border-(--color-accent)"
                  placeholder="175"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-(--color-text-muted) block mb-1">Target Goal (kg)</label>
                <input
                  type="number"
                  step="0.1"
                  value={targetWeightKg}
                  onChange={(e) => setTargetWeightKg(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-(--color-surface-2) border border-(--color-border) text-sm font-bold text-(--color-text) outline-none focus:border-(--color-accent)"
                  placeholder="68.0"
                />
              </div>
            </div>

            {/* Real-time BMI Display Banner */}
            {(() => {
              const res = calcBmi(weightKg, heightCm);
              if (!res) return null;
              return (
                <div className="p-3.5 rounded-2xl bg-(--color-surface-2) border border-(--color-border) flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Activity className="h-5 w-5 text-(--color-accent)" />
                    <div>
                      <p className="text-xs font-semibold text-(--color-text-muted)">Calculated BMI Score</p>
                      <p className={`text-base font-extrabold ${res.colorClass}`}>
                        {res.bmiVal} — <span className="underline">{res.category}</span>
                      </p>
                    </div>
                  </div>
                  <span className="text-[11px] text-(--color-text-faint) font-mono">Formula: kg / m²</span>
                </div>
              );
            })()}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setActiveClient(null)}
                className="px-4 py-2 rounded-full text-xs font-semibold text-(--color-text-muted) hover:bg-(--color-surface-2)"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={savingMetrics}
                className="px-5 py-2 rounded-full text-xs font-bold bg-(--color-accent) text-(--color-navbar) shadow-md flex items-center gap-1"
              >
                {savingMetrics ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus size={14} />} Save Client Metrics
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
