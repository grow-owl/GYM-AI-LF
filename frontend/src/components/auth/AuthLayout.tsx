import { Dumbbell, ShieldCheck, Sparkles, TrendingUp } from "lucide-react";
import type { ReactNode } from "react";

const highlights = [
  { icon: TrendingUp, text: "Live revenue & churn insights across every branch", tone: "blue" },
  { icon: Sparkles, text: "AI coach, diet & workout plans generated in seconds", tone: "pink" },
  { icon: ShieldCheck, text: "Role-based access for owners, trainers & reception", tone: "green" },
];

const toneBg: Record<string, string> = {
  blue: "bg-(--tone-blue)",
  pink: "bg-(--tone-pink)",
  green: "bg-(--tone-green)",
};

export default function AuthLayout({
  eyebrow,
  title,
  subtitle,
  children,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <div className="h-screen w-full flex flex-col lg:flex-row bg-(--color-base) overflow-hidden">
      {/* Left / top brand panel — bold gradient hero, distinct from the light app UI */}
      <aside className="relative lg:w-[40%] xl:w-[36%] shrink-0 overflow-hidden px-6 sm:px-10 py-6 lg:py-10 flex-col justify-between hidden lg:flex text-white">
        {/* Base gradient mesh */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(150deg, #0B1226 0%, #14213D 30%, #1E3560 55%, #2C4374 78%, #D6890B 100%)",
          }}
        />
        <div
          className="pointer-events-none absolute -left-20 -top-24 h-96 w-96 rounded-full blur-[90px] opacity-60 animate-float"
          style={{ background: "var(--tone-purple)" }}
        />
        <div
          className="pointer-events-none absolute -right-16 top-1/3 h-80 w-80 rounded-full blur-[90px] opacity-50 animate-float"
          style={{ background: "var(--tone-pink)", animationDelay: "1.2s" }}
        />
        <div
          className="pointer-events-none absolute left-1/4 -bottom-24 h-72 w-72 rounded-full blur-[90px] opacity-40 animate-float"
          style={{ background: "var(--tone-blue)", animationDelay: "2.4s" }}
        />
        {/* Fine grid texture for depth */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)",
            backgroundSize: "36px 36px",
          }}
        />

        <div className="relative animate-fade-in">
          <div className="flex items-center gap-2.5">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-(--color-text) shadow-lg shadow-black/20">
              <Dumbbell size={20} strokeWidth={2.5} />
            </span>
            <span className="font-display text-xl font-semibold tracking-tight">GYMAI</span>
          </div>

          <p className="mt-6 lg:mt-8 text-xs font-semibold tracking-[0.25em] uppercase text-white/60">{eyebrow}</p>
          <h1 className="font-display text-2xl sm:text-3xl xl:text-[2.25rem] font-semibold mt-3 leading-[1.15] max-w-sm">
            {title}
          </h1>
          <p className="text-white/70 mt-3 max-w-sm text-sm leading-relaxed">{subtitle}</p>
        </div>

        {/* Platform capability badges — verified SaaS features without fake mock numbers */}
        <div className="relative hidden lg:flex gap-3 mt-6 animate-fade-in-up stagger-item" style={{ ["--stagger-i" as string]: 3 }}>
          <div className="rounded-2xl bg-white/10 backdrop-blur-sm border border-white/15 px-4 py-2.5 flex-1">
            <div className="flex items-center gap-1.5 text-white/75 text-[11px] font-medium">
              <Sparkles size={13} className="text-amber-300 shrink-0" /> AI Insights
            </div>
            <p className="font-display text-sm font-bold mt-1 text-white">Smart Workout & Diet</p>
          </div>
          <div className="rounded-2xl bg-white/10 backdrop-blur-sm border border-white/15 px-4 py-2.5 flex-1">
            <div className="flex items-center gap-1.5 text-white/75 text-[11px] font-medium">
              <ShieldCheck size={13} className="text-emerald-300 shrink-0" /> Secure Cloud
            </div>
            <p className="font-display text-sm font-bold mt-1 text-white">Role-Based & QR Sync</p>
          </div>
        </div>

        <div className="relative mt-6 hidden lg:flex flex-col gap-2.5">
          {highlights.map(({ icon: Icon, text, tone }, i) => (
            <div
              key={text}
              className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.06] backdrop-blur-sm px-4 py-2.5 transition-colors hover:bg-white/[0.1] hover:border-white/20 animate-fade-in-up stagger-item"
              style={{ ["--stagger-i" as string]: i }}
            >
              <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${toneBg[tone]} text-white`}>
                <Icon size={16} strokeWidth={2.25} />
              </span>
              <span className="text-sm text-white/80">{text}</span>
            </div>
          ))}
        </div>
      </aside>

      {/* Right / bottom form panel */}
      <main className="flex-1 min-h-0 flex items-center justify-center px-5 sm:px-8 py-6 sm:py-8 bg-(--color-base) relative overflow-y-auto overflow-x-hidden">
        <div
          className="pointer-events-none absolute -top-24 -right-24 h-80 w-80 rounded-full blur-[100px] opacity-40"
          style={{ background: "var(--tone-purple)" }}
        />
        <div className="w-full max-w-md animate-fade-in-up relative z-10 my-auto">{children}</div>
      </main>
    </div>
  );
}
