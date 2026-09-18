import { useState } from "react";
import { KeyRound, Mail, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { authApi } from "@/lib/endpoints";
import { useFormValidation } from "@/lib/useFormValidation";

export default function PasswordReset() {
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  const { values, errors, touched, handleChange, handleBlur, validateAll, resetForm } = useFormValidation(
    { email: "" },
    { email: { required: "Target user email is required", email: "Enter a valid email address" } }
  );

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateAll()) return;

    setSubmitting(true);
    setResult(null);

    try {
      const res = await authApi.forgotPassword(values.email);
      setResult({
        success: true,
        message: res.message || "Password reset token sent to user's registered email.",
      });
      resetForm();
    } catch (err: any) {
      setResult({
        success: false,
        message: err.response?.data?.message || err.message || "An error occurred while resetting password.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-6 max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-(--color-text) flex items-center gap-2">
          <KeyRound className="text-(--color-accent)" size={26} /> Super Admin Password Reset Portal
        </h1>
        <p className="text-sm text-(--color-text-muted)">
          Trigger password resets for gym owners, managers, or trainers across any tenant account securely.
        </p>
      </div>

      <div className="p-6 rounded-2xl border border-(--color-border) bg-(--color-surface) space-y-5 shadow-sm">
        <h2 className="text-base font-bold text-(--color-text)">Reset User Account Credentials</h2>

        {result && (
          <div
            className={`p-4 rounded-xl border flex items-center gap-3 text-sm animate-fade-in ${
              result.success
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                : "bg-rose-500/10 border-rose-500/30 text-rose-400"
            }`}
          >
            {result.success ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
            <span>{result.message}</span>
          </div>
        )}

        <form onSubmit={handleReset} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-(--color-text-muted) mb-1.5">
              Registered User Email Address
            </label>
            <div className="relative">
              <Mail size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-(--color-text-faint)" />
              <input
                type="email"
                placeholder="e.g. rahul@powergym.com"
                value={values.email}
                onChange={(e) => handleChange("email", e.target.value)}
                onBlur={() => handleBlur("email")}
                className={`w-full pl-10 pr-4 py-2.5 rounded-xl border bg-(--color-surface) text-sm text-(--color-text) placeholder:text-(--color-text-faint) outline-none focus:border-(--color-accent) ${
                  touched.email && errors.email ? "border-rose-500" : "border-(--color-border)"
                }`}
              />
            </div>
            {touched.email && errors.email && <p className="text-xs text-rose-400 mt-1">{errors.email}</p>}
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="flex items-center justify-center gap-2 px-5 py-2.5 bg-(--color-accent) text-white font-semibold text-sm rounded-xl hover:bg-(--color-accent-strong) shadow-md transition-all disabled:opacity-60"
          >
            {submitting ? (
              <>
                <Loader2 size={16} className="animate-spin" /> Dispatching Reset Token...
              </>
            ) : (
              "Send Security Reset Link"
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
