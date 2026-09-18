import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { Mail, ArrowRight, CheckCircle2, Loader2 } from "lucide-react";
import AuthLayout from "@/components/auth/AuthLayout";
import { authApi } from "@/lib/endpoints";
import { toast } from "sonner";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setLoading(true);
    setError(null);

    try {
      await authApi.forgotPassword(email.trim());
      setSent(true);
      toast.success("Password reset instructions sent to your email!");
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || "Failed to send reset link.";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      eyebrow="Reset Password"
      title="Forgot your password?"
      subtitle="No worries — enter your email and we'll send you a link to reset it."
    >
      {sent ? (
        <div className="flex flex-col items-center text-center gap-4 py-6 animate-scale-in">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-(--color-good-soft) text-(--color-good)">
            <CheckCircle2 size={26} />
          </span>
          <div>
            <h2 className="font-display text-xl font-semibold text-(--color-text)">Check your inbox</h2>
            <p className="text-sm text-(--color-text-muted) mt-1.5">
              If an account exists for <span className="text-(--color-text)">{email}</span>, a reset link is on its way.
            </p>
          </div>
          <Link to="/login" className="text-sm text-(--color-accent-text) hover:text-(--color-accent) font-medium mt-2">
            Back to sign in
          </Link>
        </div>
      ) : (
        <>
          <h2 className="font-display text-xl font-semibold text-(--color-text)">Reset your password</h2>
          <p className="text-sm text-(--color-text-muted) mt-1.5 mb-5">We'll email you a secure reset link.</p>

          {error && (
            <div className="mb-4 rounded-xl border border-(--color-danger)/30 bg-(--color-danger-soft) px-4 py-2.5 text-xs text-(--color-danger) animate-fade-in-up">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-(--color-text-muted) mb-1.5">Email address</label>
              <div className="relative">
                <Mail size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-(--color-text-faint)" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="owner@yourgym.com"
                  className="w-full rounded-xl border border-(--color-border) bg-(--color-surface) pl-10 pr-4 py-2.5 text-sm text-(--color-text) placeholder:text-(--color-text-faint) outline-none focus:border-(--color-accent) hover:border-(--color-text-faint) transition-colors"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-press w-full flex items-center justify-center gap-2 rounded-xl bg-(--color-accent) hover:bg-(--color-accent-strong) text-(--color-navbar) font-bold text-sm py-3 transition-colors disabled:opacity-70"
            >
              {loading ? (
                <>
                  <Loader2 size={16} className="animate-spin" /> Sending reset link…
                </>
              ) : (
                <>
                  Send reset link <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>
        </>
      )}

      <p className="text-sm text-(--color-text-muted) text-center mt-7">
        Remembered it?{" "}
        <Link to="/login" className="text-(--color-accent-text) hover:text-(--color-accent) font-medium">
          Sign in
        </Link>
      </p>
    </AuthLayout>
  );
}
