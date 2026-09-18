import { useState, useEffect } from "react";
import { Share2, Copy, Users, Loader2, RefreshCw, Check, Gift } from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import { memberApi } from "@/lib/endpoints";
import { toast } from "sonner";

export default function Referral() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [referralData, setReferralData] = useState<any | null>(null);
  const [copied, setCopied] = useState(false);

  const fetchStats = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await memberApi.getMyReferralStats();
      setReferralData(res);
    } catch {
      setError("Failed to load referral statistics.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const referralCode = referralData?.referralCode || "";
  const referralLink = referralData?.referralLink || "";
  const totalReferred = referralData?.totalReferred ?? 0;
  const referredMembers = referralData?.referredMembers || [];

  const handleCopy = () => {
    if (!referralCode) return;
    navigator.clipboard.writeText(referralCode);
    setCopied(true);
    toast.success(`Referral code ${referralCode} copied to clipboard!`);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = async () => {
    const shareText = `Join me at the gym using my referral code: ${referralCode}! Link: ${referralLink}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Gym Referral Code",
          text: shareText,
          url: referralLink,
        });
      } catch {}
    } else {
      handleCopy();
    }
  };

  return (
    <div className="space-y-4 max-w-2xl mx-auto w-full">
      <PageHeader title="Refer & Earn" subtitle="Invite friends and track your referral rewards" backTo="/member" />

      {loading ? (
        <Card className="flex items-center justify-center p-12 text-sm text-(--color-text-muted) gap-2">
          <Loader2 className="w-5 h-5 animate-spin text-(--color-accent)" /> Loading referral details...
        </Card>
      ) : error ? (
        <Card className="text-center py-8">
          <p className="text-sm text-(--color-danger) mb-3">{error}</p>
          <button
            onClick={fetchStats}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs rounded-full bg-(--color-surface-3) text-(--color-text)"
          >
            <RefreshCw size={14} /> Retry
          </button>
        </Card>
      ) : (
        <div className="space-y-4">
          <Card sweep className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-full bg-(--color-accent-soft) text-(--color-accent-text)">
                <Gift size={24} />
              </div>
              <div>
                <h3 className="text-base font-bold text-(--color-text)">Your Unique Referral Code</h3>
                <p className="text-xs text-(--color-text-muted)">Share this code with friends when they register</p>
              </div>
            </div>

            <div className="flex items-center justify-between p-3.5 rounded-xl bg-(--color-surface-2) border border-(--color-border)">
              <span className="font-mono text-lg font-extrabold tracking-wider text-(--color-accent-text)">
                {referralCode}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopy}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-full bg-(--color-surface-3) text-(--color-text) hover:bg-(--color-surface)"
                >
                  {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                  <span>{copied ? "Copied" : "Copy"}</span>
                </button>
                <button
                  onClick={handleShare}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-full bg-(--color-accent) text-white hover:opacity-90"
                >
                  <Share2 size={14} />
                  <span>Share</span>
                </button>
              </div>
            </div>
          </Card>

          <Card className="space-y-3">
            <div className="flex items-center justify-between border-b border-(--color-border-soft) pb-2">
              <div className="flex items-center gap-2">
                <Users size={16} className="text-(--color-accent)" />
                <p className="text-xs font-semibold uppercase tracking-wide text-(--color-text-faint)">
                  Referred Members ({totalReferred})
                </p>
              </div>
            </div>

            {referredMembers.length === 0 ? (
              <div className="py-8 text-center text-xs text-(--color-text-faint)">
                You haven't referred any members yet. Share your code to get started!
              </div>
            ) : (
              <div className="divide-y divide-(--color-border-soft) text-xs">
                {referredMembers.map((m: any, idx: number) => (
                  <div key={m._id || idx} className="py-3 flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-(--color-text)">{m.fullName}</p>
                      {m.email && <p className="text-(--color-text-faint) text-[11px]">{m.email}</p>}
                    </div>
                    <Badge tone="good">
                      Joined {m.joinedAt ? new Date(m.joinedAt).toLocaleDateString() : ""}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
