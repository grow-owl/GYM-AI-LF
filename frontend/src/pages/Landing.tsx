import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Dumbbell,
  ArrowRight,
  Sparkles,
  Users,
  CreditCard,
  QrCode,
  BarChart3,
  HeartPulse,
  ShieldCheck,
  Check,
  ScanLine,
  ClipboardList,
  LineChart,
  UserCog,
  Mail,
  Phone,
  Send,
  MessageSquare,
  CheckCircle2,
  Menu,
  X,
  Loader2,
} from "lucide-react";
import heroImg from "@/assets/hero-gym.png";
import { saasInquiryApi } from "@/lib/endpoints";

const steps = [
  {
    n: "01",
    title: "Check in",
    desc: "Members scan the live QR code at the front desk to check in — and again on the way out.",
    icon: ScanLine,
  },
  {
    n: "02",
    title: "Train",
    desc: "Trainers hand out AI-generated workout & diet plans members can follow straight from their phone.",
    icon: Dumbbell,
  },
  {
    n: "03",
    title: "Track",
    desc: "Owners watch attendance, renewals and revenue update live — no spreadsheet, no guesswork.",
    icon: LineChart,
  },
];

const features = [
  {
    icon: Users,
    tone: "blue",
    title: "Owner dashboard",
    desc: "Every member, every branch, active vs inactive, and membership expiries — on one screen.",
  },
  {
    icon: Sparkles,
    tone: "pink",
    title: "AI coach & insights",
    desc: "Auto-generated workout & diet plans, plus churn-risk and revenue insights your team can act on.",
  },
  {
    icon: QrCode,
    tone: "green",
    title: "Check-in & attendance",
    desc: "QR check-in at the front desk, live attendance tracking, and streaks that keep members coming back.",
  },
  {
    icon: CreditCard,
    tone: "orange",
    title: "Payments & billing",
    desc: "Collect payments, track renewals, and manage invoices without leaving the dashboard.",
  },
  {
    icon: BarChart3,
    tone: "purple",
    title: "Reports that matter",
    desc: "Attendance history, revenue and retention trends — exportable whenever you need them.",
  },
  {
    icon: HeartPulse,
    tone: "teal",
    title: "Recovery alerts",
    desc: "Flag members at risk of injury or drop-off so trainers can step in before it's too late.",
  },
];

const roleCards = [
  {
    label: "Owners",
    tone: "blue",
    icon: UserCog,
    points: [
      "See every member and their status at a glance",
      "Track membership expiry and record payments",
      "Add trainers and reception staff in seconds",
    ],
  },
  {
    label: "Trainers",
    tone: "purple",
    icon: Dumbbell,
    points: [
      "View only the members assigned to you",
      "Build workout plans day by day",
      "Create diet plans with per-meal breakdowns",
    ],
  },
  {
    label: "Members",
    tone: "orange",
    icon: ClipboardList,
    points: [
      "Check in and out with a QR scan",
      "See today's workout and diet plan",
      "Log progress and build a streak",
    ],
  },
];

import { useAuth, roleHome } from "@/store/authStore";
import { landingPlans as plans } from "@/data/pricing";

const toneBg: Record<string, string> = {
  blue: "bg-(--tone-blue)",
  pink: "bg-(--tone-pink)",
  green: "bg-(--tone-green)",
  orange: "bg-(--tone-orange)",
  purple: "bg-(--tone-purple)",
  teal: "bg-(--tone-teal)",
};

export default function Landing() {
  const { isAuthenticated, user } = useAuth();
  const dashboardPath = user ? (roleHome[user.role] ?? "/owner") : "/login";
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    gymName: "",
    city: "",
    message: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submittedEmail, setSubmittedEmail] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const name = formData.name.trim();
    const phone = formData.phone.trim();
    const gym = formData.gymName.trim() || `${name}'s Gym`;

    if (!name || name.length < 2) {
      setFormError("Please enter your name (at least 2 characters).");
      return;
    }
    if (!phone || phone.length < 8) {
      setFormError("Please enter a valid phone number (at least 8 digits).");
      return;
    }

    setSubmitting(true);
    try {
      await saasInquiryApi.create({
        ownerName: name,
        gymName: gym,
        phone: phone,
        email: formData.email.trim() || undefined,
        city: formData.city.trim() || "Unspecified",
        message: formData.message.trim() || undefined,
      });

      setSubmittedEmail(formData.email.trim() || formData.phone.trim());
      setSubmitted(true);
      setFormData({ name: "", email: "", phone: "", gymName: "", city: "", message: "" });
    } catch (err: any) {
      setFormError(
        err?.response?.data?.message ||
        err?.message ||
        "Failed to submit inquiry. Please try again or reach out to us directly."
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="relative z-10 min-h-screen bg-(--color-surface)">
      {/* Navbar */}
      <header className="sticky top-0 z-30 border-b border-(--color-border) bg-(--color-surface)/95 backdrop-blur-sm">
        <div className="flex items-center justify-between px-6 sm:px-10 py-4 max-w-6xl mx-auto">
          <div className="flex items-center gap-2.5 animate-fade-in group cursor-pointer">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-(--color-accent) text-(--color-navbar) shadow-md icon-hover-pop">
              <Dumbbell size={18} strokeWidth={2.5} />
            </span>
            <span className="font-display text-lg font-bold tracking-tight text-(--color-text) group-hover:text-(--color-accent-text) transition-colors">GYMAI</span>
          </div>
          {/* Desktop Nav */}
          <nav className="hidden sm:flex items-center gap-7 animate-fade-in">
            <a href="#features" className="nav-link-underline text-sm font-medium text-(--color-text-muted) hover:text-(--color-text) transition-colors">
              Features
            </a>
            <a href="#how-it-works" className="nav-link-underline text-sm font-medium text-(--color-text-muted) hover:text-(--color-text) transition-colors">
              How it works
            </a>
            <a href="#pricing" className="nav-link-underline text-sm font-medium text-(--color-text-muted) hover:text-(--color-text) transition-colors">
              Pricing
            </a>
            <a href="#contact" className="nav-link-underline text-sm font-medium text-(--color-text-muted) hover:text-(--color-text) transition-colors">
              Contact Us
            </a>
            {isAuthenticated && user ? (
              <Link
                to={dashboardPath}
                className="btn-press btn-sheen text-sm font-semibold text-(--color-navbar) bg-(--color-accent) hover:bg-(--color-accent-strong) rounded-xl px-4 py-2.5 transition-all"
              >
                Go to Dashboard →
              </Link>
            ) : (
              <>
                <Link to="/login" className="nav-link-underline text-sm font-medium text-(--color-text-muted) hover:text-(--color-text) transition-colors">
                  Sign in
                </Link>
                <Link
                  to="/register"
                  className="btn-press btn-sheen text-sm font-semibold text-(--color-navbar) bg-(--color-accent) hover:bg-(--color-accent-strong) hover:shadow-[0_10px_30px_-8px_var(--color-accent-soft)] rounded-xl px-4 py-2.5 transition-all animate-fade-in"
                >
                  Start Free Trial
                </Link>
              </>
            )}
          </nav>
          {/* Mobile hamburger */}
          <button
            className="sm:hidden p-2 rounded-lg text-(--color-text-muted) hover:text-(--color-text) hover:bg-(--color-surface-2) transition-colors"
            onClick={() => setMobileMenuOpen((v) => !v)}
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>

        {/* Mobile dropdown menu */}
        {mobileMenuOpen && (
          <nav className="sm:hidden border-t border-(--color-border) bg-(--color-surface)/98 px-6 py-4 flex flex-col gap-4 animate-fade-in">
            <a href="#features" onClick={() => setMobileMenuOpen(false)} className="text-sm font-medium text-(--color-text-muted) hover:text-(--color-text) transition-colors">Features</a>
            <a href="#how-it-works" onClick={() => setMobileMenuOpen(false)} className="text-sm font-medium text-(--color-text-muted) hover:text-(--color-text) transition-colors">How it works</a>
            <a href="#pricing" onClick={() => setMobileMenuOpen(false)} className="text-sm font-medium text-(--color-text-muted) hover:text-(--color-text) transition-colors">Pricing</a>
            <a href="#contact" onClick={() => setMobileMenuOpen(false)} className="text-sm font-medium text-(--color-text-muted) hover:text-(--color-text) transition-colors">Contact Us</a>
            <div className="flex flex-col gap-2 pt-2 border-t border-(--color-border)">
              {isAuthenticated && user ? (
                <Link to={dashboardPath} onClick={() => setMobileMenuOpen(false)} className="w-full text-center py-2.5 rounded-xl bg-(--color-accent) text-(--color-navbar) font-semibold text-sm">
                  Go to Dashboard →
                </Link>
              ) : (
                <>
                  <Link to="/login" onClick={() => setMobileMenuOpen(false)} className="w-full text-center py-2.5 rounded-xl border border-(--color-border) text-(--color-text) font-medium text-sm hover:bg-(--color-surface-2) transition-colors">
                    Sign in
                  </Link>
                  <Link to="/register" onClick={() => setMobileMenuOpen(false)} className="w-full text-center py-2.5 rounded-xl bg-(--color-accent) text-(--color-navbar) font-semibold text-sm">
                    Start Free Trial
                  </Link>
                </>
              )}
            </div>
          </nav>
        )}
      </header>

      {/* Hero — dark, image-backed, motivational */}
      <section className="relative overflow-hidden bg-(--color-navbar) group">
        <img
          src={heroImg}
          alt="GYMAI Gym member training"
          // Mandatory LCP Optimization: fetchPriority="high" for hero image
          // @ts-ignore
          fetchPriority="high"
          decoding="async"
          width={1200}
          height={800}
          className="pointer-events-none absolute inset-y-0 right-0 h-full w-full sm:w-3/4 lg:w-3/5 object-cover object-[75%_30%] opacity-90 group-hover:scale-105 transition-transform duration-700 ease-out"
        />
        {/* Gradient scrim: solid navy on the left where the copy sits, fading out over the photo */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "linear-gradient(100deg, #14213D 0%, #14213D 42%, rgba(20,33,61,0.85) 55%, rgba(20,33,61,0.35) 72%, transparent 88%)",
          }}
        />
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.05]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)",
            backgroundSize: "34px 34px",
          }}
        />

        <div className="relative max-w-6xl mx-auto px-6 sm:px-10 pt-16 pb-20 sm:pt-24 sm:pb-28">
          <div className="max-w-xl">
            <div className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 mb-6 animate-fade-in-up hover:border-white/30 hover:bg-white/10 transition-all cursor-pointer">
              <Sparkles size={13} className="text-(--color-accent) icon-hover-pop" />
              <span className="text-xs font-semibold tracking-[0.15em] uppercase text-white/80">
                A new way to gym
              </span>
            </div>

            <h1
              className="font-display text-4xl sm:text-5xl lg:text-[3.4rem] font-bold uppercase leading-[1.05] text-white animate-fade-in-up stagger-item"
              style={{ ["--stagger-i" as string]: 1 }}
            >
              Train harder.
              <br />
              Manage <span className="text-(--color-accent)">smarter.</span>
            </h1>

            <p
              className="mt-5 text-base sm:text-lg text-white/70 max-w-md leading-relaxed animate-fade-in-up stagger-item"
              style={{ ["--stagger-i" as string]: 2 }}
            >
              GYMAI replaces the register, the spreadsheet and the WhatsApp groups with one AI-powered dashboard for
              owners, trainers and members — so your gym runs itself, and your members actually show up.
            </p>

            <div
              className="mt-8 flex flex-wrap items-center gap-3 animate-fade-in-up stagger-item"
              style={{ ["--stagger-i" as string]: 3 }}
            >
              {isAuthenticated && user ? (
                <Link
                  to={dashboardPath}
                  className="btn-press btn-sheen flex items-center gap-2 rounded-xl bg-(--color-accent) hover:bg-(--color-accent-strong) text-(--color-navbar) font-semibold text-sm px-6 py-3.5 transition-all"
                >
                  Go to Dashboard <ArrowRight size={16} className="icon-hover-pop" />
                </Link>
              ) : (
                <>
                  <Link
                    to="/register"
                    className="btn-press btn-sheen flex items-center gap-2 rounded-xl bg-(--color-accent) hover:bg-(--color-accent-strong) hover:shadow-[0_10px_30px_-8px_var(--color-accent-soft)] text-(--color-navbar) font-semibold text-sm px-6 py-3.5 transition-all"
                  >
                    Start 1-week free trial <ArrowRight size={16} className="icon-hover-pop" />
                  </Link>
                  <Link
                    to="/login"
                    className="btn-press flex items-center gap-2 rounded-xl border border-white/20 hover:border-white/40 bg-white/5 hover:bg-white/10 text-white font-semibold text-sm px-6 py-3.5 transition-all"
                  >
                    Sign in
                  </Link>
                </>
              )}
            </div>
            <p
              className="mt-3 text-xs text-white/50 animate-fade-in-up stagger-item"
              style={{ ["--stagger-i" as string]: 4 }}
            >
              No card required. Cancel anytime.
            </p>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="max-w-6xl mx-auto px-6 sm:px-10 py-20">
        <p className="text-xs font-semibold tracking-wide uppercase text-(--color-accent-text) mb-2">How it works</p>
        <h2 className="font-display text-2xl sm:text-3xl font-bold text-(--color-text) mb-10">
          Three steps, one loop.
        </h2>
        <div className="grid sm:grid-cols-3 gap-8 sm:gap-6">
          {steps.map(({ n, title, desc, icon: Icon }, i) => (
            <div key={n} className="card-hover group p-5 rounded-2xl border border-(--color-border) bg-(--color-surface) animate-fade-in-up stagger-item" style={{ ["--stagger-i" as string]: i }}>
              <div className="flex items-center gap-3 mb-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-(--color-accent-soft) text-(--color-accent-text) icon-hover-pop">
                  <Icon size={17} strokeWidth={2.25} />
                </span>
                <span className="font-mono text-xs font-semibold text-(--color-text-faint)">{n}</span>
              </div>
              <p className="font-display text-lg font-bold text-(--color-text) group-hover:text-(--color-accent-text) transition-colors">{title}</p>
              <p className="text-sm text-(--color-text-muted) mt-1.5 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="features" className="heavy-section-deferred bg-(--color-surface-2) border-y border-(--color-border-soft)">
        <div className="max-w-6xl mx-auto px-6 sm:px-10 py-20">
          <p className="text-xs font-semibold tracking-wide uppercase text-(--color-accent-text) mb-2">Everything included</p>
          <h2 className="font-display text-2xl sm:text-3xl font-bold text-(--color-text) mb-10">
            Built for the whole gym floor.
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {features.map(({ icon: Icon, tone, title, desc }, i) => (
              <div
                key={title}
                data-tone={tone}
                className="glow-hover card-hover group rounded-(--radius-card) border border-(--color-border) bg-(--color-surface) p-5 animate-fade-in-up stagger-item"
                style={{ ["--stagger-i" as string]: i }}
              >
                <span
                  className={`flex h-10 w-10 items-center justify-center rounded-xl text-white mb-4 icon-hover-pop ${toneBg[tone]}`}
                >
                  <Icon size={18} strokeWidth={2.25} />
                </span>
                <p className="font-display text-base font-semibold text-(--color-text) group-hover:text-(--color-accent-text) transition-colors">{title}</p>
                <p className="text-sm text-(--color-text-muted) mt-1.5 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Roles */}
      <section id="roles" className="heavy-section-deferred max-w-6xl mx-auto px-6 sm:px-10 py-20">
        <p className="text-xs font-semibold tracking-wide uppercase text-(--color-accent-text) mb-2">One login, every role</p>
        <h2 className="font-display text-2xl sm:text-3xl font-bold text-(--color-text) mb-10">
          Built for everyone in the gym.
        </h2>
        <div className="grid sm:grid-cols-3 gap-4">
          {roleCards.map(({ label, tone, icon: Icon, points }, i) => (
            <div
              key={label}
              className="card-hover group rounded-(--radius-card) border border-(--color-border) bg-(--color-surface) p-5 animate-fade-in-up stagger-item"
              style={{ ["--stagger-i" as string]: i }}
            >
              <span className={`flex h-10 w-10 items-center justify-center rounded-xl text-white mb-4 icon-hover-pop ${toneBg[tone]}`}>
                <Icon size={18} strokeWidth={2.25} />
              </span>
              <p className="font-display text-xs font-bold tracking-wide uppercase text-(--color-text) group-hover:text-(--color-accent-text) transition-colors">{label}</p>
              <ul className="mt-3 flex flex-col gap-2">
                {points.map((p) => (
                  <li key={p} className="flex items-start gap-2 text-sm text-(--color-text-muted) leading-snug">
                    <Check size={14} className="text-(--color-good) shrink-0 mt-0.5 icon-hover-pop" /> {p}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="heavy-section-deferred bg-(--color-surface-2) border-y border-(--color-border-soft)">
        <div className="max-w-6xl mx-auto px-6 sm:px-10 py-20">
          <p className="text-xs font-semibold tracking-wide uppercase text-(--color-accent-text) mb-2">Simple pricing</p>
          <h2 className="font-display text-2xl sm:text-3xl font-bold text-(--color-text) mb-10">
            One app for your whole gym. Pick a plan.
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {plans.map((plan, i) => (
              <div
                key={plan.name}
                className={`card-hover group relative flex flex-col rounded-(--radius-card) border p-5 animate-fade-in-up stagger-item ${
                  plan.popular
                    ? "border-(--color-accent) bg-(--color-surface) shadow-lg"
                    : "border-(--color-border) bg-(--color-surface)"
                }`}
                style={{ ["--stagger-i" as string]: i }}
              >
                {plan.popular && (
                  <span className="absolute -top-3 left-5 rounded-full bg-(--color-accent) text-(--color-navbar) text-[10px] font-bold tracking-wide uppercase px-2.5 py-1 shadow-sm">
                    Popular
                  </span>
                )}
                <p className="text-xs font-semibold tracking-wide uppercase text-(--color-text-faint)">{plan.name}</p>
                <p className="mt-2 flex items-baseline gap-1">
                  <span className="font-display text-2xl font-bold text-(--color-text) group-hover:text-(--color-accent-text) transition-colors">{plan.price}</span>
                  {plan.period && <span className="text-xs text-(--color-text-faint)">{plan.period}</span>}
                </p>
                {plan.sub && <p className="text-xs text-(--color-text-faint) mt-1">{plan.sub}</p>}
                <ul className="mt-4 flex flex-col gap-2 flex-1">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm text-(--color-text-muted) leading-snug">
                      <Check size={14} className="text-(--color-good) shrink-0 mt-0.5 icon-hover-pop" /> {f}
                    </li>
                  ))}
                </ul>
                <Link
                  to="/register"
                  className={`btn-press btn-sheen mt-5 text-center rounded-xl text-sm font-semibold py-2.5 transition-all ${
                    plan.tone === "accent"
                      ? "bg-(--color-accent) hover:bg-(--color-accent-strong) text-(--color-navbar) shadow-sm"
                      : "bg-(--color-surface-3) hover:bg-(--color-border) text-(--color-text)"
                  }`}
                >
                  {plan.cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Trust strip */}
      <section id="trust" className="heavy-section-deferred max-w-4xl mx-auto px-6 sm:px-10 py-20">
        <div className="card-hover group rounded-(--radius-card) border border-(--color-border) bg-(--color-surface) p-6 sm:p-8 flex flex-col sm:flex-row items-center gap-6 sm:gap-10">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-(--color-accent-soft) text-(--color-accent-text) icon-hover-pop">
            <ShieldCheck size={22} />
          </span>
          <div className="flex-1">
            <p className="font-display text-base font-semibold text-(--color-text) group-hover:text-(--color-accent-text) transition-colors">
              Role-based access, built in.
            </p>
            <p className="text-sm text-(--color-text-muted) mt-1 leading-relaxed">
              Every dashboard is only visible to its own signed-in account — owners, trainers, reception and members
              each see exactly what they need, nothing more.
            </p>
          </div>
          <ul className="flex flex-col gap-1.5 text-sm text-(--color-text-muted) shrink-0">
            {["Secure sign in", "Per-role dashboards", "No shared logins"].map((t) => (
              <li key={t} className="flex items-center gap-2">
                <Check size={14} className="text-(--color-good) icon-hover-pop" /> {t}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Final CTA & Contact Section */}
      <section id="contact" className="heavy-section-deferred bg-(--color-navbar) border-t border-(--color-navbar-border)">
        <div className="max-w-6xl mx-auto px-6 sm:px-10 py-16 sm:py-20">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
            {/* Left Side: CTA Copy & Buttons */}
            <div className="lg:col-span-6 text-left">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-(--color-accent) mb-4">
                <Sparkles size={13} /> Get Started Today
              </span>
              <h2 className="font-display text-3xl sm:text-4xl lg:text-4xl font-bold uppercase leading-tight text-white">
                Run your gym from one screen.
              </h2>
              <p className="text-white/70 mt-3 text-base leading-relaxed max-w-lg">
                Set up your gym in a couple of minutes and start checking members in today.
              </p>

              <div className="mt-6 flex flex-wrap items-center gap-3">
                <Link
                  to="/register"
                  className="btn-press btn-sheen inline-flex items-center gap-2 rounded-xl bg-(--color-accent) hover:bg-(--color-accent-strong) hover:shadow-[0_10px_30px_-8px_var(--color-accent-soft)] text-(--color-navbar) font-semibold text-sm px-6 py-3.5 transition-all"
                >
                  Start 1-week free trial <ArrowRight size={16} className="icon-hover-pop" />
                </Link>
                <Link
                  to="/login"
                  className="btn-press inline-flex items-center gap-2 rounded-xl border border-white/20 hover:border-white/40 bg-white/5 hover:bg-white/10 text-white font-semibold text-sm px-5 py-3.5 transition-all"
                >
                  Sign in
                </Link>
              </div>

              {/* Direct Support Contacts below left copy */}
              <div className="mt-8 pt-6 border-t border-white/10 flex flex-wrap items-center gap-6 text-xs text-white/70">
                <a href="mailto:admin@admin.com" className="inline-flex items-center gap-2 hover:text-(--color-accent) transition-colors">
                  <Mail size={15} className="text-(--color-accent)" /> admin@admin.com
                </a>
                <a href="tel:+918609504186" className="inline-flex items-center gap-2 hover:text-(--color-accent) transition-colors">
                  <Phone size={15} className="text-(--color-good)" /> +91 86095 04186
                </a>
              </div>
            </div>

            {/* Right Side: Contact Form Card */}
            <div className="lg:col-span-6 rounded-2xl border border-white/15 bg-white/5 p-6 sm:p-8 backdrop-blur-sm shadow-xl">
              <h3 className="font-display text-xl font-bold text-white mb-1 flex items-center gap-2">
                <MessageSquare size={20} className="text-(--color-accent)" /> Contact Us & Request Demo
              </h3>
              <p className="text-xs text-white/60 mb-5">Have questions or want a custom trial workspace? Drop us your details below.</p>

              {submitted ? (
                <div className="flex flex-col items-center justify-center py-8 text-center animate-fade-in">
                  <span className="flex h-12 w-12 items-center justify-center rounded-full bg-(--color-good-soft) text-(--color-good) mb-3">
                    <CheckCircle2 size={28} />
                  </span>
                  <h4 className="font-display text-lg font-bold text-white">Inquiry Received Successfully!</h4>
                  <p className="text-xs text-white/70 mt-1.5 max-w-xs leading-relaxed">
                    Thank you for reaching out! Our team will contact you at{" "}
                    <span className="font-semibold text-white">{submittedEmail || "your contact info"}</span> within 1 business day to set up your gym demo & custom trial.
                  </p>
                  <button
                    type="button"
                    onClick={() => setSubmitted(false)}
                    className="mt-4 text-xs font-semibold text-(--color-accent) hover:underline cursor-pointer"
                  >
                    Submit another inquiry
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
                  {formError && (
                    <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3.5 py-2.5 text-xs text-rose-300">
                      {formError}
                    </div>
                  )}

                  <div className="grid sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold uppercase tracking-wider text-white/70 mb-1">Your Name *</label>
                      <input
                        type="text"
                        required
                        placeholder="Rahul Sharma"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className="w-full rounded-xl border border-white/15 bg-white/5 px-3.5 py-2 text-xs text-white placeholder-white/40 focus:border-(--color-accent) focus:bg-white/10 focus:outline-none transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold uppercase tracking-wider text-white/70 mb-1">Email</label>
                      <input
                        type="email"
                        placeholder="rahul@fitgym.com"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        className="w-full rounded-xl border border-white/15 bg-white/5 px-3.5 py-2 text-xs text-white placeholder-white/40 focus:border-(--color-accent) focus:bg-white/10 focus:outline-none transition-all"
                      />
                    </div>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold uppercase tracking-wider text-white/70 mb-1">Phone Number *</label>
                      <input
                        type="tel"
                        required
                        minLength={8}
                        placeholder="+91 98765 43210"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        className="w-full rounded-xl border border-white/15 bg-white/5 px-3.5 py-2 text-xs text-white placeholder-white/40 focus:border-(--color-accent) focus:bg-white/10 focus:outline-none transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold uppercase tracking-wider text-white/70 mb-1">Gym Name *</label>
                      <input
                        type="text"
                        required
                        placeholder="Gold's Fitness"
                        value={formData.gymName}
                        onChange={(e) => setFormData({ ...formData, gymName: e.target.value })}
                        className="w-full rounded-xl border border-white/15 bg-white/5 px-3.5 py-2 text-xs text-white placeholder-white/40 focus:border-(--color-accent) focus:bg-white/10 focus:outline-none transition-all"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold uppercase tracking-wider text-white/70 mb-1">City / Location</label>
                    <input
                      type="text"
                      placeholder="e.g. Mumbai, Delhi, Bengaluru"
                      value={formData.city}
                      onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                      className="w-full rounded-xl border border-white/15 bg-white/5 px-3.5 py-2 text-xs text-white placeholder-white/40 focus:border-(--color-accent) focus:bg-white/10 focus:outline-none transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold uppercase tracking-wider text-white/70 mb-1">Message / Requirements</label>
                    <textarea
                      rows={3}
                      placeholder="Ask about gym onboarding, custom trial, trainer plans, or pricing..."
                      value={formData.message}
                      onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                      className="w-full rounded-xl border border-white/15 bg-white/5 px-3.5 py-2 text-xs text-white placeholder-white/40 focus:border-(--color-accent) focus:bg-white/10 focus:outline-none transition-all resize-none"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={submitting}
                    className="btn-press btn-sheen mt-1 flex items-center justify-center gap-2 rounded-xl bg-(--color-accent) hover:bg-(--color-accent-strong) disabled:opacity-60 text-(--color-navbar) font-semibold text-xs py-2.5 transition-all cursor-pointer shadow-md"
                  >
                    {submitting ? (
                      <>
                        <Loader2 size={14} className="animate-spin" /> Submitting Inquiry...
                      </>
                    ) : (
                      <>
                        Send Message / Request Demo <Send size={14} className="icon-hover-pop" />
                      </>
                    )}
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Footer — dark navy bar */}
      <footer className="border-t border-(--color-navbar-border) bg-(--color-navbar)">
        <div className="max-w-6xl mx-auto px-6 sm:px-10 py-10">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-8">
            <div className="max-w-xs">
              <div className="flex items-center gap-2.5 group cursor-pointer">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-(--color-accent) text-(--color-navbar) shadow-md icon-hover-pop">
                  <Dumbbell size={18} strokeWidth={2.5} />
                </span>
                <span className="font-display text-lg font-semibold text-(--color-navbar-text) group-hover:text-(--color-accent) transition-colors">GYMAI</span>
              </div>
              <p className="text-sm text-(--color-navbar-text-muted) mt-3 leading-relaxed">
                AI-powered gym management for owners, trainers, reception and members — one dashboard, every role.
              </p>
            </div>

            <div className="flex flex-wrap gap-10">
              <div>
                <p className="text-xs font-semibold tracking-wide uppercase text-(--color-accent) mb-3">Product</p>
                <ul className="flex flex-col gap-2 text-sm text-(--color-navbar-text-muted)">
                  <li><a href="#features" className="nav-link-underline hover:text-(--color-navbar-text) transition-colors">Features</a></li>
                  <li><a href="#how-it-works" className="nav-link-underline hover:text-(--color-navbar-text) transition-colors">How it works</a></li>
                  <li><a href="#pricing" className="nav-link-underline hover:text-(--color-navbar-text) transition-colors">Pricing</a></li>
                  <li><a href="#contact" className="nav-link-underline hover:text-(--color-navbar-text) transition-colors">Contact Us</a></li>
                </ul>
              </div>
              <div>
                <p className="text-xs font-semibold tracking-wide uppercase text-(--color-accent) mb-3">Account</p>
                <ul className="flex flex-col gap-2 text-sm text-(--color-navbar-text-muted)">
                  <li><Link to="/login" className="nav-link-underline hover:text-(--color-navbar-text) transition-colors">Sign in</Link></li>
                  <li><Link to="/register" className="nav-link-underline hover:text-(--color-navbar-text) transition-colors">Start free trial</Link></li>
                  <li><Link to="/roles" className="nav-link-underline hover:text-(--color-navbar-text) transition-colors">Explore demo</Link></li>
                </ul>
              </div>
            </div>
          </div>

          <div className="mt-10 pt-6 border-t border-(--color-navbar-border) flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-(--color-navbar-text-muted)">
            <span>© {new Date().getFullYear()} GYMAI. Direct Contact: admin@admin.com | +91 86095 04186</span>
            <span>Owner accounts require an invite code — ask your GYMAI admin.</span>
          </div>
        </div>
      </footer>
    </div>
  );
}