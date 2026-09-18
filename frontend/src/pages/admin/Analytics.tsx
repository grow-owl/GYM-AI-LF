import { useState, useEffect } from "react";
import { TrendingUp, DollarSign, Building2, Users, ArrowUpRight, CheckCircle2, Loader2, RefreshCw } from "lucide-react";
import { paymentApi, gymApi } from "@/lib/endpoints";
import { formatApiError, showApiErrorToast } from "@/lib/api";

export default function Analytics() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [overview, setOverview] = useState<{
    totalRevenue: number;
    revenueThisMonth: number;
    activePayingGymsCount: number;
    revenueByPlan?: Record<string, number>;
  }>({
    totalRevenue: 0,
    revenueThisMonth: 0,
    activePayingGymsCount: 0,
  });
  const [gymsCount, setGymsCount] = useState({ total: 0, active: 0, trial: 0, totalBranches: 0 });

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [overviewRes, gymsRes] = await Promise.all([
        paymentApi.getPlatformAnalyticsOverview(),
        gymApi.listAllGyms(),
      ]);

      if (overviewRes) {
        const ov = overviewRes as any;
        setOverview({
          totalRevenue: Number(ov.totalRevenue) || 0,
          revenueThisMonth: Number(ov.revenueThisMonth) || 0,
          activePayingGymsCount: Number(ov.activePayingGymsCount) || 0,
          revenueByPlan: (ov.revenueByPlan as Record<string, number>) || {},
        });
      }

      if (gymsRes?.gyms) {
        const list = gymsRes.gyms;
        const active = list.filter((g: any) => g.status === "ACTIVE" || g.isActive).length;
        const trial = list.filter((g: any) => g.plan === "TRIAL" || g.status === "TRIAL").length;
        const totalBranches = list.reduce((sum: number, g: any) => sum + (g.branches?.length || 1), 0);
        setGymsCount({
          total: list.length,
          active,
          trial,
          totalBranches,
        });
      }
    } catch (err: any) {
      const msg = formatApiError(err, "Failed to load platform analytics.");
      setError(msg);
      showApiErrorToast(err, "Failed to load platform analytics");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center text-(--color-text-muted) gap-2">
        <Loader2 className="animate-spin" size={24} /> Loading SaaS Platform Analytics...
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center rounded-2xl bg-(--color-surface-2) border border-(--color-border) space-y-3">
        <p className="text-sm font-semibold text-red-400">{error}</p>
        <button
          onClick={fetchData}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-full bg-(--color-accent) text-(--color-navbar) cursor-pointer hover:brightness-110"
        >
          <RefreshCw size={14} /> Retry Analytics Sync
        </button>
      </div>
    );
  }

  const enterpriseRev = overview.revenueByPlan?.ENTERPRISE || 0;
  const proRev = overview.revenueByPlan?.PRO || 0;
  const starterRev = overview.revenueByPlan?.STARTER || 0;
  const sumRev = (enterpriseRev + proRev + starterRev) || 1;

  const entPct = Math.round((enterpriseRev / sumRev) * 100);
  const proPct = Math.round((proRev / sumRev) * 100);
  const startPct = Math.max(0, 100 - entPct - proPct);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-(--color-text) flex items-center gap-2">
          <TrendingUp className="text-(--color-accent)" size={26} /> SaaS Platform Analytics & MRR
        </h1>
        <p className="text-sm text-(--color-text-muted)">
          Real-time insights on platform revenue growth, subscription MRR, active gym tenants, and member throughput.
        </p>
      </div>

      {/* Metrics Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl border border-(--color-border) bg-(--color-surface) space-y-2 shadow-sm">
          <div className="flex items-center justify-between text-(--color-text-muted)">
            <span className="text-xs font-medium uppercase tracking-wider">Monthly Recurring Revenue</span>
            <DollarSign size={18} className="text-emerald-400" />
          </div>
          <p className="text-2xl font-extrabold text-(--color-text)">₹{overview.revenueThisMonth.toLocaleString("en-IN")}</p>
          <p className="text-xs text-emerald-400 flex items-center gap-1">
            <ArrowUpRight size={14} /> Total Lifetime: ₹{overview.totalRevenue.toLocaleString("en-IN")}
          </p>
        </div>

        <div className="p-5 rounded-2xl border border-(--color-border) bg-(--color-surface) space-y-2 shadow-sm">
          <div className="flex items-center justify-between text-(--color-text-muted)">
            <span className="text-xs font-medium uppercase tracking-wider">Active Gym Tenants</span>
            <Building2 size={18} className="text-blue-400" />
          </div>
          <p className="text-2xl font-extrabold text-(--color-text)">{gymsCount.active} / {gymsCount.total}</p>
          <p className="text-xs text-blue-400 flex items-center gap-1">
            <CheckCircle2 size={14} /> {gymsCount.trial} Gyms on Trial
          </p>
        </div>

        <div className="p-5 rounded-2xl border border-(--color-border) bg-(--color-surface) space-y-2 shadow-sm">
          <div className="flex items-center justify-between text-(--color-text-muted)">
            <span className="text-xs font-medium uppercase tracking-wider">Total Active Branches</span>
            <Building2 size={18} className="text-purple-400" />
          </div>
          <p className="text-2xl font-extrabold text-(--color-text)">{gymsCount.totalBranches}</p>
          <p className="text-xs text-purple-400">Across active tenant accounts</p>
        </div>

        <div className="p-5 rounded-2xl border border-(--color-border) bg-(--color-surface) space-y-2 shadow-sm">
          <div className="flex items-center justify-between text-(--color-text-muted)">
            <span className="text-xs font-medium uppercase tracking-wider">Paying Subscriptions</span>
            <Users size={18} className="text-amber-400" />
          </div>
          <p className="text-2xl font-extrabold text-(--color-text)">{overview.activePayingGymsCount}</p>
          <p className="text-xs text-amber-400">Active paid invoices this month</p>
        </div>
      </div>

      {/* Revenue Breakdown by Tier */}
      <div className="p-6 rounded-2xl border border-(--color-border) bg-(--color-surface) space-y-4 shadow-sm">
        <h2 className="text-lg font-bold text-(--color-text)">Subscription Plan Tier Revenue Distribution</h2>
        <div className="space-y-3">
          <div>
            <div className="flex justify-between text-xs font-medium text-(--color-text) mb-1">
              <span>Enterprise Tier (₹{enterpriseRev.toLocaleString("en-IN")})</span>
              <span>{entPct}% Revenue</span>
            </div>
            <div className="w-full bg-white/5 h-2.5 rounded-full overflow-hidden">
              <div className="bg-purple-500 h-full rounded-full" style={{ width: `${entPct}%` }} />
            </div>
          </div>

          <div>
            <div className="flex justify-between text-xs font-medium text-(--color-text) mb-1">
              <span>Pro Tier (₹{proRev.toLocaleString("en-IN")})</span>
              <span>{proPct}% Revenue</span>
            </div>
            <div className="w-full bg-white/5 h-2.5 rounded-full overflow-hidden">
              <div className="bg-blue-500 h-full rounded-full" style={{ width: `${proPct}%` }} />
            </div>
          </div>

          <div>
            <div className="flex justify-between text-xs font-medium text-(--color-text) mb-1">
              <span>Starter Tier (₹{starterRev.toLocaleString("en-IN")})</span>
              <span>{startPct}% Revenue</span>
            </div>
            <div className="w-full bg-white/5 h-2.5 rounded-full overflow-hidden">
              <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${startPct}%` }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
