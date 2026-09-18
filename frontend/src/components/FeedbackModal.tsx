import { useState } from "react";
import { createPortal } from "react-dom";
import { Star, MessageSquare, X } from "lucide-react";
import { feedbackApi } from "@/lib/endpoints";
import { toast } from "sonner";

interface Props {
  memberId: string;
  workoutLogId?: string;
  onClose: () => void;
  onSuccess?: () => void;
}

const ratingLabels: Record<number, string> = {
  1: "Poor - Needs significant improvement",
  2: "Fair - Okay session",
  3: "Good - Satisfactory experience",
  4: "Very Good - Really enjoyed it!",
  5: "Excellent - Outstanding trainer & session!",
};

export default function FeedbackModal({ memberId, workoutLogId, onClose, onSuccess }: Props) {
  const [rating, setRating] = useState(5);
  const [hoverRating, setHoverRating] = useState<number | null>(null);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const activeRating = hoverRating !== null ? hoverRating : rating;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!note.trim()) {
      toast.error("Please enter your feedback comments.");
      return;
    }
    setSubmitting(true);
    try {
      await feedbackApi.create(memberId, {
        rating,
        note: note.trim(),
        workoutLogId,
      });
      toast.success("Thank you! Feedback submitted successfully.");
      if (onSuccess) onSuccess();
      onClose();
    } catch {
      toast.error("Failed to submit feedback.");
    } finally {
      setSubmitting(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 sm:p-6 md:p-8 animate-in fade-in duration-200">
      <div className="bg-(--color-surface) border border-(--color-border) rounded-3xl p-6 sm:p-8 md:p-10 w-full max-w-3xl space-y-6 shadow-2xl relative overflow-hidden">
        {/* Top Header */}
        <div className="flex items-start justify-between border-b border-(--color-border) pb-5">
          <div className="flex items-center gap-3.5">
            <div className="p-3 rounded-2xl bg-(--color-accent)/10 text-(--color-accent) shrink-0">
              <MessageSquare size={28} />
            </div>
            <div>
              <h3 className="font-display text-xl sm:text-2xl font-bold text-(--color-text)">
                Session & Trainer Feedback
              </h3>
              <p className="text-xs sm:text-sm text-(--color-text-muted) mt-0.5">
                Share your workout experience and help us elevate your training journey
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full text-(--color-text-muted) hover:text-(--color-text) hover:bg-(--color-surface-2) transition-colors"
          >
            <X size={22} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Star Rating Section */}
          <div className="p-5 rounded-2xl bg-(--color-surface-2)/60 border border-(--color-border) space-y-3">
            <label className="text-xs sm:text-sm font-semibold text-(--color-text) block">
              How would you rate your workout session?
            </label>
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setRating(star)}
                    onMouseEnter={() => setHoverRating(star)}
                    onMouseLeave={() => setHoverRating(null)}
                    className="p-1.5 text-amber-400 hover:scale-125 transition-transform focus:outline-none"
                  >
                    <Star
                      size={36}
                      fill={star <= activeRating ? "currentColor" : "none"}
                      className="transition-colors duration-150"
                    />
                  </button>
                ))}
              </div>
              <div className="text-right">
                <span className="font-display text-xl font-bold text-amber-400">{activeRating} / 5 Stars</span>
                <p className="text-xs text-(--color-text-muted) font-medium">{ratingLabels[activeRating]}</p>
              </div>
            </div>
          </div>

          {/* Feedback Note Textarea */}
          <div className="space-y-2">
            <label className="text-xs sm:text-sm font-semibold text-(--color-text) block">
              Your Detailed Feedback & Session Review
            </label>
            <textarea
              required
              rows={5}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="How was your workout session today? Any specific comments about exercises, trainer guidance, or facility cleanliness..."
              className="w-full p-4 rounded-2xl bg-(--color-surface-2) border border-(--color-border) text-sm text-(--color-text) outline-none focus:border-(--color-accent) transition-colors resize-none leading-relaxed"
            />
            <p className="text-[11px] text-(--color-text-faint) text-right">
              {note.length} characters
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-(--color-border)">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-3 rounded-full text-xs sm:text-sm font-semibold text-(--color-text-muted) hover:text-(--color-text) hover:bg-(--color-surface-2) transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-8 py-3 rounded-full text-xs sm:text-sm font-bold bg-(--color-accent) text-white hover:opacity-90 transition-opacity disabled:opacity-50 shadow-lg flex items-center gap-2"
            >
              {submitting ? "Submitting..." : "Submit Feedback"}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
