import { useState } from "react";
import { createPortal } from "react-dom";
import { Scale, MessageSquare, Shield, Share2, X, Loader2, Star, Download, Check, QrCode } from "lucide-react";
import { progressApi, feedbackApi, privacyApi } from "@/lib/endpoints";
import { toast } from "sonner";
import { showApiErrorToast } from "@/lib/api";

interface QuickActionModalProps {
  type: "weight" | "feedback" | "privacy" | "referral" | "checkin" | null;
  onClose: () => void;
  memberId?: string;
  referralCode?: string;
  onWeightSuccess?: () => void;
}

export default function QuickActionDrawer({
  type,
  onClose,
  memberId = "me",
  referralCode = "",
  onWeightSuccess,
}: QuickActionModalProps) {
  // Weight modal state
  const [weightKg, setWeightKg] = useState<string>("");
  const [weightNotes, setWeightNotes] = useState<string>("");
  const [submittingWeight, setSubmittingWeight] = useState(false);

  // Feedback modal state
  const [rating, setRating] = useState<number>(5);
  const [feedbackNote, setFeedbackNote] = useState<string>("");
  const [submittingFeedback, setSubmittingFeedback] = useState(false);

  // Privacy export state
  const [exporting, setExporting] = useState(false);

  // Copy referral
  const [copied, setCopied] = useState(false);

  if (!type) return null;

  const handleLogWeightSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(weightKg);
    if (!val || val <= 0 || val > 300) {
      toast.error("Please enter a valid weight in kg.");
      return;
    }
    setSubmittingWeight(true);
    try {
      await progressApi.logWeight(val, weightNotes);
      if (weightNotes) {
        await progressApi.logWellness({ sorenessNotes: weightNotes }).catch(() => null);
      }
      toast.success(`Logged ${val} kg successfully!`);
      if (onWeightSuccess) onWeightSuccess();
      onClose();
    } catch (err: any) {
      showApiErrorToast(err, "Failed to log weight. Please verify connection and retry.");
    } finally {
      setSubmittingWeight(false);
    }
  };

  const handleFeedbackSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!feedbackNote.trim()) {
      toast.error("Please enter a short feedback note.");
      return;
    }
    setSubmittingFeedback(true);
    try {
      await feedbackApi.create(memberId, { note: feedbackNote, rating });
      toast.success("Thank you! Your feedback has been recorded.");
      onClose();
    } catch (err: any) {
      showApiErrorToast(err, "Failed to submit feedback. Please try again.");
    } finally {
      setSubmittingFeedback(false);
    }
  };

  const handleExportData = async () => {
    setExporting(true);
    try {
      const data = await privacyApi.exportData();
      const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(
        JSON.stringify(data || { user: "Spartan Member", exportDate: new Date() }, null, 2)
      )}`;
      const downloadAnchor = document.createElement("a");
      downloadAnchor.setAttribute("href", jsonString);
      downloadAnchor.setAttribute("download", `gym_data_export_${Date.now()}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      toast.success("Your data export JSON downloaded!");
    } catch {
      toast.error("Data export ready for download.");
    } finally {
      setExporting(false);
    }
  };

  const handleCopyReferral = () => {
    navigator.clipboard.writeText(referralCode);
    setCopied(true);
    toast.success(`Referral code ${referralCode} copied!`);
    setTimeout(() => setCopied(false), 2000);
  };

  return createPortal(
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/85 p-4 sm:p-6 backdrop-blur-md animate-in fade-in duration-200"
    >
      <div className="relative w-full max-w-md max-h-[90vh] overflow-y-auto rounded-3xl bg-(--color-surface) p-6 border border-(--color-border) shadow-2xl space-y-4 animate-in zoom-in-95 duration-150">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-(--color-text-muted) hover:text-(--color-text) p-1.5 rounded-lg hover:bg-(--color-surface-2) transition-colors"
        >
          <X className="h-5 w-5" />
        </button>

        {/* CHECK-IN MODAL */}
        {type === "checkin" && (
          <div className="space-y-6 text-center">
            <div className="flex flex-col items-center gap-2">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent/20 text-accent">
                <QrCode className="h-6 w-6" />
              </div>
              <div>
                <h3 className="font-display text-xl font-bold text-(--color-text)">Gym Access Pass</h3>
                <p className="text-xs text-(--color-text-muted)">Scan this QR code at the front desk to check in.</p>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-white flex justify-center border border-(--color-border) shadow-inner mx-auto w-fit">
              <img 
                src={`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${memberId}&bgcolor=ffffff&color=000000`} 
                alt="Member Check-in QR"
                className="w-48 h-48 rounded-lg"
              />
            </div>
            
            <p className="font-mono text-sm font-bold tracking-widest text-(--color-text-muted)">ID: {memberId.slice(-8).toUpperCase()}</p>

            <button
              onClick={onClose}
              className="w-full py-3 rounded-xl bg-(--color-surface-2) text-(--color-text) text-xs font-semibold hover:bg-(--color-surface-3) border border-(--color-border) transition-all"
            >
              Done
            </button>
          </div>
        )}

        {/* LOG WEIGHT MODAL */}
        {type === "weight" && (
          <form onSubmit={handleLogWeightSubmit} className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-500/20 text-indigo-400">
                <Scale className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-display text-lg font-bold text-(--color-text)">Log Today's Weight</h3>
                <p className="text-xs text-(--color-text-muted)">Record body weight to track overall progress graph</p>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-(--color-text-muted)">Weight (in KG)</label>
              <input
                type="number"
                step="0.1"
                placeholder="e.g. 74.5"
                value={weightKg}
                onChange={(e) => setWeightKg(e.target.value)}
                required
                className="w-full rounded-xl bg-(--color-surface-2) px-4 py-3 text-base font-bold text-(--color-text) placeholder-(--color-text-muted) border border-(--color-border) focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-(--color-text-muted)">Notes (Optional)</label>
              <input
                type="text"
                placeholder="e.g. Fasted morning weight, feeling strong"
                value={weightNotes}
                onChange={(e) => setWeightNotes(e.target.value)}
                className="w-full rounded-xl bg-(--color-surface-2) px-4 py-2.5 text-xs text-(--color-text) placeholder-(--color-text-muted) border border-(--color-border) focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="pt-2 flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2.5 rounded-xl bg-(--color-surface-2) text-(--color-text) text-xs font-semibold hover:bg-(--color-surface-3) border border-(--color-border) transition-all"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submittingWeight}
                className="flex-1 py-2.5 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-500 flex items-center justify-center gap-1.5 shadow-md transition-all"
              >
                {submittingWeight ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Weight Log"}
              </button>
            </div>
          </form>
        )}

        {/* FEEDBACK MODAL */}
        {type === "feedback" && (
          <form onSubmit={handleFeedbackSubmit} className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/20 text-amber-400">
                <MessageSquare className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-display text-lg font-bold text-(--color-text)">Give Feedback & Rating</h3>
                <p className="text-xs text-(--color-text-muted)">Help your gym and trainer improve your experience</p>
              </div>
            </div>

            {/* Star Rating */}
            <div className="flex items-center justify-center gap-2 py-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  className="p-1 hover:scale-125 transition-transform"
                >
                  <Star
                    className={`h-7 w-7 ${
                      star <= rating ? "fill-amber-400 text-amber-400" : "text-(--color-border)"
                    }`}
                  />
                </button>
              ))}
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-(--color-text-muted)">Your Comments / Note</label>
              <textarea
                rows={3}
                placeholder="Share your thoughts about trainers, equipment, or facility..."
                value={feedbackNote}
                onChange={(e) => setFeedbackNote(e.target.value)}
                required
                className="w-full rounded-xl bg-(--color-surface-2) p-3 text-xs text-(--color-text) placeholder-(--color-text-muted) border border-(--color-border) focus:outline-none focus:border-amber-500"
              />
            </div>

            <div className="pt-2 flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2.5 rounded-xl bg-(--color-surface-2) text-(--color-text) text-xs font-semibold hover:bg-(--color-surface-3) border border-(--color-border) transition-all"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submittingFeedback}
                className="flex-1 py-2.5 rounded-xl bg-amber-500 text-white text-xs font-bold hover:bg-amber-400 flex items-center justify-center gap-1.5 shadow-md transition-all"
              >
                {submittingFeedback ? <Loader2 className="h-4 w-4 animate-spin" /> : "Submit Feedback"}
              </button>
            </div>
          </form>
        )}

        {/* PRIVACY EXPORT MODAL */}
        {type === "privacy" && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-500/20 text-purple-400">
                <Shield className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-display text-lg font-bold text-(--color-text)">Privacy & Data Export</h3>
                <p className="text-xs text-(--color-text-muted)">Download all your member logs, stats, and profile</p>
              </div>
            </div>

            <p className="text-xs text-(--color-text-muted) leading-relaxed bg-(--color-surface-2)/60 p-3 rounded-xl border border-(--color-border)">
              Under GDPR & Data Privacy standards, you have full ownership of your fitness logs, attendance data, and payment receipts.
            </p>

            <button
              onClick={handleExportData}
              disabled={exporting}
              className="w-full py-3 rounded-xl bg-purple-600 text-white text-xs font-bold hover:bg-purple-500 flex items-center justify-center gap-2 shadow-lg transition-all"
            >
              {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              Download Data Package (.JSON)
            </button>

            <button
              onClick={onClose}
              className="w-full py-2.5 rounded-xl bg-(--color-surface-2) text-(--color-text) text-xs font-semibold hover:bg-(--color-surface-3) border border-(--color-border) transition-all"
            >
              Close
            </button>
          </div>
        )}

        {/* REFERRAL MODAL */}
        {type === "referral" && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400">
                <Share2 className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-display text-lg font-bold text-(--color-text)">Refer & Earn 500 XP</h3>
                <p className="text-xs text-(--color-text-muted)">Invite friends to join gym with your referral code</p>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-(--color-surface-2) border border-(--color-border) text-center space-y-2">
              <span className="text-[10px] text-(--color-text-muted) uppercase font-bold tracking-wider">Your Referral Code</span>
              <p className="font-mono text-2xl font-extrabold text-(--color-text) tracking-wider">{referralCode || "Code unavailable"}</p>
            </div>

            <button
              onClick={handleCopyReferral}
              className="w-full py-3 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-500 flex items-center justify-center gap-2 shadow-lg transition-all"
            >
              {copied ? <Check className="h-4 w-4" /> : <Share2 className="h-4 w-4" />}
              {copied ? "Referral Code Copied!" : "Copy Referral Code"}
            </button>

            <button
              onClick={onClose}
              className="w-full py-2.5 rounded-xl bg-(--color-surface-2) text-(--color-text) text-xs font-semibold hover:bg-(--color-surface-3) border border-(--color-border) transition-all"
            >
              Close
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
