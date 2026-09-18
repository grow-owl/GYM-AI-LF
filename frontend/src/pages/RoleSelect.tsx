import { Link } from "react-router-dom";
import { Dumbbell, ClipboardList, ScanLine, ArrowRight, Sparkles } from "lucide-react";

// Every card routes through /login now — no role can be entered without a real,
// authenticated account. The `hint` is passed along so the login page can show
// which dashboard the person is headed to once they sign in.
// Note: owner sign-in is intentionally NOT listed here — owner accounts are
// invite-only and provisioned directly, never advertised on the public site.
const roles = [
  {
    role: "trainer",
    title: "Trainer",
    desc: "Today's sessions, client workout plans, and recovery alerts.",
    stat: "Sign in with your trainer account",
    icon: Dumbbell,
    path: "/login?role=trainer",
    tone: "purple",
  },
  {
    role: "member",
    title: "Member",
    desc: "Workouts, diet, AI coach, streaks and rewards — mobile first.",
    stat: "Sign in with your member account",
    icon: ClipboardList,
    path: "/login?role=member",
    tone: "orange",
  },
  {
    role: "reception",
    title: "Reception / Staff",
    desc: "Check-in members, scan QR codes, and manage desk operations.",
    stat: "Sign in with your staff account",
    icon: ScanLine,
    path: "/login?role=reception",
    tone: "green",
  },
];

const toneStyles: Record<string, { icon: string; ring: string }> = {
  blue: { icon: "bg-(--tone-blue) text-white", ring: "group-hover:border-(--tone-blue)" },
  purple: { icon: "bg-(--tone-purple) text-white", ring: "group-hover:border-(--tone-purple)" },
  orange: { icon: "bg-(--tone-orange) text-white", ring: "group-hover:border-(--tone-orange)" },
  green: { icon: "bg-(--tone-green) text-white", ring: "group-hover:border-(--tone-green)" },
};

export default function RoleSelect() {
  return (
    <div className="h-screen overflow-y-auto flex flex-col items-center justify-center px-6 py-8 relative z-10">
      <div className="max-w-3xl w-full">
        <div className="flex items-center gap-2.5 mb-6 justify-center animate-fade-in">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-(--color-accent) text-(--color-navbar) shadow-md">
            <Dumbbell size={20} strokeWidth={2.5} />
          </span>
          <span className="font-display text-xl font-semibold text-(--color-text)">GYMAI</span>
        </div>

        <div className="flex items-center justify-center gap-1.5 mb-4 animate-fade-in">
          <Sparkles size={14} className="text-(--color-accent-text)" />
          <span className="text-xs font-semibold tracking-wide uppercase text-(--color-accent-text)">
            Choose your role
          </span>
        </div>

        <h1 className="font-display text-3xl sm:text-4xl font-bold text-center leading-tight text-(--color-text) animate-fade-in-up">
          One gym. <span className="text-(--color-accent-strong)">Four ways in.</span>
        </h1>
        <p
          className="text-center text-(--color-text-muted) mt-3 mb-8 max-w-md mx-auto animate-fade-in-up stagger-item"
          style={{ ["--stagger-i" as string]: 1 }}
        >
          Pick your role, then sign in — each dashboard is only visible to its own account.
        </p>

        <div className="grid sm:grid-cols-2 gap-4">
          {roles.map(({ role, title, desc, stat, icon: Icon, path, tone }, i) => {
            const { icon, ring } = toneStyles[tone];
            return (
              <Link
                key={role}
                to={path}
                data-tone={tone}
                className={`glow-hover card-hover group flex flex-col gap-3 rounded-(--radius-card) border-2 border-(--color-border) bg-(--color-surface) p-5 shadow-md animate-fade-in-up stagger-item ${ring}`}
                style={{ ["--stagger-i" as string]: i + 2 }}
              >
                <div className="flex items-center justify-between">
                  <span className={`flex h-12 w-12 items-center justify-center rounded-2xl shadow-sm ${icon}`}>
                    <Icon size={22} strokeWidth={2.25} />
                  </span>
                  <ArrowRight
                    size={20}
                    strokeWidth={2.25}
                    className="text-(--color-text-faint) group-hover:text-(--color-accent-strong) group-hover:translate-x-1 transition-all"
                  />
                </div>
                <div>
                  <p className="font-display text-lg font-bold text-(--color-text)">{title}</p>
                  <p className="text-sm text-(--color-text-muted) mt-1.5 leading-relaxed">{desc}</p>
                  <p className="text-xs font-medium text-(--color-accent-text) mt-3">{stat}</p>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}