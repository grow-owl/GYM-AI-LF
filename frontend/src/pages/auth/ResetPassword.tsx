import { useState, type FormEvent } from "react";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import { Lock, Eye, EyeOff, ArrowRight, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import AuthLayout from "@/components/auth/AuthLayout";
import { authApi } from "@/lib/endpoints";
import { toast } from "sonner";

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") || "";
  const navigate = useNavigate();

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!token) {
      setError("Reset token is missing or invalid. Please request a new password reset link.");
      return;
    }
    if (newPassword.length < 8 || !/(?=.*[a-zA-Z])(?=.*[0-9])/.test(newPassword)) {
      setError("Password must be at least 8 characters long and contain both letters and numbers.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await authApi.resetPassword(token, newPassword);
      setSuccess(true);
      toast.success("Password reset successfully! Redirecting to login...");
      setTimeout(() => {
        navigate("/login");
      }, 2500);
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || "Failed to reset password. Token may have expired.";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      eyebrow="Account Security"
      title="Set New Password"
      subtitle="Choose a strong, secure password for your GYMAI account."
    >
      {success ? (
        <div className="flex flex-col items-center text-center gap-4 py-6 animate-scale-in">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-(--color-good-soft) text-(--color-good)">
            <CheckCircle2 size={28} />
          </span>
          <div>
            <h2 className="font-display text-xl font-semibold text-(--color-text)">Password Reset Complete!</h2>
            <p className="text-sm text-(--color-text-muted) mt-1.5">
              Your password has been updated successfully. You will be redirected to sign in shortly.
            </p>
          </div>
          <Link
            to="/login"
            className="btn-press inline-flex items-center gap-2 rounded-xl bg-(--color-accent) text-white font-semibold text-sm px-6 py-2.5 mt-2"
          >
            Sign in now <ArrowRight size={16} />
          </Link>
        </div>
      ) : (
        <>
          <h2 className="font-display text-xl font-semibold text-(--color-text)">Create new password</h2>
          <p className="text-sm text-(--color-text-muted) mt-1 mb-5">
            Your new password must be at least 8 characters and include letters & numbers.
          </p>

          {!token && (
            <div className="mb-4 flex items-center gap-2 rounded-xl border border-(--color-danger)/30 bg-(--color-danger-soft) px-4 py-3 text-xs text-(--color-danger)">
              <AlertCircle size={16} className="shrink-0" />
              <span>No reset token provided in URL. Please click the reset link sent to your email.</span>
            </div>
          )}

          {error && (
            <div className="mb-4 rounded-xl border border-(--color-danger)/30 bg-(--color-danger-soft) px-4 py-2.5 text-xs text-(--color-danger) animate-fade-in-up">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-(--color-text-muted) mb-1.5">New Password</label>
              <div className="relative">
                <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-(--color-text-faint)" />
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Min 8 characters (letters & numbers)"
                  className="w-full rounded-xl border border-(--color-border) bg-(--color-surface) pl-10 pr-10 py-2.5 text-sm text-(--color-text) placeholder:text-(--color-text-faint) outline-none focus:border-(--color-accent) hover:border-(--color-text-faint) transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-(--color-text-faint) hover:text-(--color-text-muted)"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-(--color-text-muted) mb-1.5">Confirm New Password</label>
              <div className="relative">
                <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-(--color-text-faint)" />
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter new password"
                  className="w-full rounded-xl border border-(--color-border) bg-(--color-surface) pl-10 pr-10 py-2.5 text-sm text-(--color-text) placeholder:text-(--color-text-faint) outline-none focus:border-(--color-accent) hover:border-(--color-text-faint) transition-colors"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !token}
              className="btn-press w-full flex items-center justify-center gap-2 rounded-xl bg-(--color-accent) hover:bg-(--color-accent-strong) text-(--color-navbar) font-bold text-sm py-3 transition-colors disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 size={16} className="animate-spin" /> Updating password…
                </>
              ) : (
                <>
                  Reset Password <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>
        </>
      )}

      <p className="text-sm text-(--color-text-muted) text-center mt-7">
        Remembered your password?{" "}
        <Link to="/login" className="text-(--color-accent-text) hover:text-(--color-accent) font-medium">
          Sign in
        </Link>
      </p>
    </AuthLayout>
  );
}
