import { useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Eye, EyeOff, Lock, Mail, ArrowRight, Loader2 } from "lucide-react";
import AuthLayout from "@/components/auth/AuthLayout";
import { useAuth, roleHome } from "@/store/authStore";
import { useFormValidation } from "@/lib/useFormValidation";

const roleCopy: Record<string, { eyebrow: string; title: string; subtitle: string }> = {
  owner: {
    eyebrow: "Owner Login",
    title: "Run your gym from one dashboard.",
    subtitle: "Sign in to see today's revenue, attendance, renewals and AI insights the moment you land.",
  },
  trainer: {
    eyebrow: "Trainer Login",
    title: "Your clients, sessions & plans in one place.",
    subtitle: "Sign in to view today's schedule, workout plans and recovery alerts.",
  },
  member: {
    eyebrow: "Member Login",
    title: "Your workouts, diet & progress.",
    subtitle: "Sign in to track streaks, log workouts and chat with your AI coach.",
  },
  reception: {
    eyebrow: "Reception Login",
    title: "Check-ins, members & payments.",
    subtitle: "Sign in to scan members, manage attendance and take payments at the front desk.",
  },
};

export default function Login() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login, loading, error, fieldErrors: apiFieldErrors, clearError } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);

  const { values, errors, touched, handleChange, handleBlur, validateAll } = useFormValidation(
    { email: "", password: "" },
    {
      email: { required: "Email address is required", email: "Enter a valid email address" },
      password: { required: "Password is required", minLength: { value: 6, message: "Password must be at least 6 characters" } },
    }
  );

  const roleHint = searchParams.get("role");
  const copy = (roleHint && roleCopy[roleHint]) || roleCopy.owner;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    clearError();
    if (!validateAll()) return;

    try {
      const loggedInUser = await login(values.email, values.password);
      navigate(roleHome[loggedInUser.role] ?? "/owner");
    } catch {
      // error handled via store
    }
  };

  const emailError = (touched.email && errors.email) || apiFieldErrors.email;
  const passwordError = (touched.password && errors.password) || apiFieldErrors.password;

  return (
    <AuthLayout eyebrow={copy.eyebrow} title={copy.title} subtitle={copy.subtitle}>
      <h1 className="font-display text-xl font-semibold text-(--color-text) mb-1">Welcome back</h1>
      <p className="text-sm text-(--color-text-muted) mb-5">
        Enter your details to access your gym's dashboard.
      </p>

      {error && (
        <div className="mb-4 rounded-xl border border-(--color-danger)/30 bg-(--color-danger-soft) px-4 py-2.5 text-sm text-(--color-danger) animate-fade-in-up">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-3.5">
        <div>
          <label className="block text-xs font-medium text-(--color-text-muted) mb-1.5">Email address</label>
          <div className="relative">
            <Mail size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-(--color-text-faint)" />
            <input
              type="email"
              value={values.email}
              onChange={(e) => handleChange("email", e.target.value)}
              onBlur={() => handleBlur("email")}
              placeholder="owner@yourgym.com"
              className={`w-full rounded-xl border bg-(--color-surface) pl-10 pr-4 py-2.5 text-sm text-(--color-text) placeholder:text-(--color-text-faint) outline-none focus:border-(--color-accent) hover:border-(--color-text-faint) transition-colors ${
                emailError ? "border-rose-500" : "border-(--color-border)"
              }`}
            />
          </div>
          {emailError && <p className="text-xs text-rose-400 mt-1">{emailError}</p>}
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-xs font-medium text-(--color-text-muted)">Password</label>
            <Link to="/forgot-password" className="text-xs text-(--color-accent-text) hover:text-(--color-accent)">
              Forgot password?
            </Link>
          </div>
          <div className="relative">
            <Lock size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-(--color-text-faint)" />
            <input
              type={showPassword ? "text" : "password"}
              value={values.password}
              onChange={(e) => handleChange("password", e.target.value)}
              onBlur={() => handleBlur("password")}
              placeholder="••••••••"
              className={`w-full rounded-xl border bg-(--color-surface) pl-10 pr-10 py-2.5 text-sm text-(--color-text) placeholder:text-(--color-text-faint) outline-none focus:border-(--color-accent) hover:border-(--color-text-faint) transition-colors ${
                passwordError ? "border-rose-500" : "border-(--color-border)"
              }`}
            />
            <button
              type="button"
              onClick={() => setShowPassword((s) => !s)}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-(--color-text-faint) hover:text-(--color-text-muted) hover:scale-110 transition-transform"
            >
              {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
            </button>
          </div>
          {passwordError && <p className="text-xs text-rose-400 mt-1">{passwordError}</p>}
        </div>

        <label className="flex items-center gap-2 text-sm text-(--color-text-muted) cursor-pointer select-none">
          <input
            type="checkbox"
            checked={remember}
            onChange={(e) => setRemember(e.target.checked)}
            className="h-4 w-4 rounded accent-(--color-accent)"
          />
          Remember me on this device
        </label>

        <button
          type="submit"
          disabled={loading}
          className="btn-press w-full flex items-center justify-center gap-2 rounded-xl bg-(--color-accent) hover:bg-(--color-accent-strong) hover:shadow-lg hover:shadow-(--color-accent-soft) text-(--color-navbar) font-bold text-sm py-3 transition-all disabled:opacity-70"
        >
          {loading ? (
            <>
              <Loader2 size={16} className="animate-spin" /> Signing in…
            </>
          ) : (
            <>
              Sign in <ArrowRight size={16} />
            </>
          )}
        </button>
      </form>

      <p className="text-sm text-(--color-text-muted) text-center mt-5">
        New gym owner?{" "}
        <Link to="/register" className="text-(--color-accent-text) hover:text-(--color-accent) font-medium">
          Create your account
        </Link>
      </p>

      <p className="text-xs text-(--color-text-faint) text-center mt-3">
        Signing in as a different role?{" "}
        <Link to="/roles" className="underline hover:text-(--color-text-muted)">
          Choose trainer, reception or member
        </Link>
      </p>
    </AuthLayout>
  );
}
