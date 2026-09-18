import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Building2, Phone, Mail, User, CheckCircle2, Loader2, MessageSquare } from "lucide-react";
import AuthLayout from "@/components/auth/AuthLayout";

import { saasInquiryApi } from "@/lib/endpoints";

interface InquiryForm {
  ownerName: string;
  gymName: string;
  email: string;
  phone: string;
  city: string;
  message: string;
}

export default function Register() {
  const [form, setForm] = useState<InquiryForm>({
    ownerName: "",
    gymName: "",
    email: "",
    phone: "",
    city: "",
    message: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!form.ownerName.trim() || !form.gymName.trim() || !form.email.trim() || !form.phone.trim()) {
      setError("Please fill in all required fields.");
      return;
    }

    setSubmitting(true);
    try {
      await saasInquiryApi.create({
        ownerName: form.ownerName.trim(),
        gymName: form.gymName.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        city: form.city.trim() || "Unspecified",
        message: form.message.trim() || undefined,
      });
      setSubmitted(true);
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || "Something went wrong. Please try again or email us directly.");
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <AuthLayout
        eyebrow="Inquiry Submitted"
        title="We'll Be in Touch!"
        subtitle="Our team will review your inquiry and reach out within 1 business day."
      >
        <div className="space-y-6 text-center py-4">
          <div className="mx-auto w-16 h-16 rounded-full bg-emerald-500/15 flex items-center justify-center">
            <CheckCircle2 size={32} className="text-emerald-400" />
          </div>
          <div>
            <h2 className="font-display text-xl font-semibold text-(--color-text)">Inquiry Received!</h2>
            <p className="text-sm text-(--color-text-muted) mt-2 leading-relaxed">
              Thanks <strong className="text-(--color-text)">{form.ownerName}</strong>! We've received your inquiry for{" "}
              <strong className="text-(--color-text)">{form.gymName}</strong>. We'll contact you at{" "}
              <strong className="text-(--color-text)">{form.email}</strong> within 1 business day to set up your gym workspace.
            </p>
          </div>
          <Link
            to="/login"
            className="btn-press inline-flex items-center justify-center gap-2 rounded-xl bg-(--color-accent) text-(--color-navbar) font-bold text-sm px-6 py-3 hover:bg-(--color-accent-strong) w-full"
          >
            Go to Login <ArrowRight size={16} />
          </Link>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      eyebrow="Get Started"
      title="Request Your Gym Workspace"
      subtitle="Fill in your details and our team will set up your GYMAI account within 1 business day."
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-xs text-(--color-text-faint) bg-(--color-surface-2) rounded-xl px-3 py-2.5 border border-(--color-border)">
          ⚡ Gym owner accounts are provisioned by our team. Submit your inquiry and we'll reach out shortly.
        </p>

        {/* Owner Name */}
        <div className="space-y-1.5">
          <label htmlFor="reg-ownerName" className="block text-xs font-semibold text-(--color-text-muted) tracking-wide uppercase">
            Your Name <span className="text-rose-400">*</span>
          </label>
          <div className="relative">
            <User size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-(--color-text-faint)" />
            <input
              id="reg-ownerName"
              name="ownerName"
              type="text"
              autoComplete="name"
              value={form.ownerName}
              onChange={handleChange}
              placeholder="Your full name"
              required
              className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-(--color-border) bg-(--color-surface) text-(--color-text) text-sm placeholder:text-(--color-text-faint) focus:outline-none focus:ring-2 focus:ring-(--color-accent)/40 focus:border-(--color-accent) transition-colors"
            />
          </div>
        </div>

        {/* Gym Name */}
        <div className="space-y-1.5">
          <label htmlFor="reg-gymName" className="block text-xs font-semibold text-(--color-text-muted) tracking-wide uppercase">
            Gym Name <span className="text-rose-400">*</span>
          </label>
          <div className="relative">
            <Building2 size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-(--color-text-faint)" />
            <input
              id="reg-gymName"
              name="gymName"
              type="text"
              value={form.gymName}
              onChange={handleChange}
              placeholder="Your gym's name"
              required
              className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-(--color-border) bg-(--color-surface) text-(--color-text) text-sm placeholder:text-(--color-text-faint) focus:outline-none focus:ring-2 focus:ring-(--color-accent)/40 focus:border-(--color-accent) transition-colors"
            />
          </div>
        </div>

        {/* Email + Phone — single column on mobile, two columns on tablet/desktop */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label htmlFor="reg-email" className="block text-xs font-semibold text-(--color-text-muted) tracking-wide uppercase">
              Email <span className="text-rose-400">*</span>
            </label>
            <div className="relative">
              <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-(--color-text-faint)" />
              <input
                id="reg-email"
                name="email"
                type="email"
                autoComplete="email"
                value={form.email}
                onChange={handleChange}
                placeholder="you@example.com"
                required
                className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-(--color-border) bg-(--color-surface) text-(--color-text) text-base sm:text-sm placeholder:text-(--color-text-faint) focus:outline-none focus:ring-2 focus:ring-(--color-accent)/40 focus:border-(--color-accent) transition-colors"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <label htmlFor="reg-phone" className="block text-xs font-semibold text-(--color-text-muted) tracking-wide uppercase">
              Phone <span className="text-rose-400">*</span>
            </label>
            <div className="relative">
              <Phone size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-(--color-text-faint)" />
              <input
                id="reg-phone"
                name="phone"
                type="tel"
                autoComplete="tel"
                value={form.phone}
                onChange={handleChange}
                placeholder="+91 98765 43210"
                required
                className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-(--color-border) bg-(--color-surface) text-(--color-text) text-base sm:text-sm placeholder:text-(--color-text-faint) focus:outline-none focus:ring-2 focus:ring-(--color-accent)/40 focus:border-(--color-accent) transition-colors"
              />
            </div>
          </div>
        </div>

        {/* City */}
        <div className="space-y-1.5">
          <label htmlFor="reg-city" className="block text-xs font-semibold text-(--color-text-muted) tracking-wide uppercase">
            City
          </label>
          <input
            id="reg-city"
            name="city"
            type="text"
            value={form.city}
            onChange={handleChange}
            placeholder="City where your gym is located"
            className="w-full px-4 py-2.5 rounded-xl border border-(--color-border) bg-(--color-surface) text-(--color-text) text-sm placeholder:text-(--color-text-faint) focus:outline-none focus:ring-2 focus:ring-(--color-accent)/40 focus:border-(--color-accent) transition-colors"
          />
        </div>

        {/* Message */}
        <div className="space-y-1.5">
          <label htmlFor="reg-message" className="block text-xs font-semibold text-(--color-text-muted) tracking-wide uppercase">
            <span className="flex items-center gap-1.5"><MessageSquare size={12} /> Anything else?</span>
          </label>
          <textarea
            id="reg-message"
            name="message"
            value={form.message}
            onChange={handleChange}
            placeholder="Number of branches, members, special requirements..."
            rows={2}
            className="w-full px-4 py-2.5 rounded-xl border border-(--color-border) bg-(--color-surface) text-(--color-text) text-sm placeholder:text-(--color-text-faint) focus:outline-none focus:ring-2 focus:ring-(--color-accent)/40 focus:border-(--color-accent) transition-colors resize-none"
          />
        </div>

        {error && (
          <p className="text-xs text-rose-400 bg-rose-500/10 px-3 py-2 rounded-lg border border-rose-500/20">{error}</p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="btn-press w-full inline-flex items-center justify-center gap-2 rounded-xl bg-(--color-accent) text-(--color-navbar) font-bold text-sm px-6 py-3 hover:bg-(--color-accent-strong) disabled:opacity-60 disabled:cursor-not-allowed transition-all"
        >
          {submitting ? (
            <><Loader2 size={16} className="animate-spin" /> Submitting...</>
          ) : (
            <>Send Inquiry <ArrowRight size={16} /></>
          )}
        </button>

        <p className="text-center text-xs text-(--color-text-faint)">
          Already have an account?{" "}
          <Link to="/login" className="text-(--color-accent) hover:underline font-medium">
            Sign in
          </Link>
        </p>
      </form>
    </AuthLayout>
  );
}
