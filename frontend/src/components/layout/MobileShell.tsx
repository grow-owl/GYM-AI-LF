import { NavLink, Outlet, useLocation } from "react-router-dom";
import * as icons from "lucide-react";
import clsx from "clsx";
import Sidebar from "./Sidebar";
import TopBar from "./TopBar";
import { memberNav } from "@/data/nav";
import { useAuth } from "@/store/authStore";
import { useAttendanceStore } from "@/store/attendanceStore";
import { Lock } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";

export default function MobileShell() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const { logout } = useAuth();
  const navigate = useNavigate();
  const { isCheckedIn, fetchCurrentSession, initialized } = useAttendanceStore();

  useEffect(() => {
    if (!initialized) {
      fetchCurrentSession();
    }
  }, [initialized, fetchCurrentSession]);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <div className="min-h-screen flex bg-(--color-base)">
      <div className="hidden lg:block">
        <Sidebar
          primary={memberNav}
          collapsed={collapsed}
          onToggle={() => setCollapsed((value) => !value)}
          roleLabel="Member"
        />
      </div>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setMobileOpen(false)} />
          <div className="absolute left-0 top-0 h-full w-72 bg-(--color-navbar) border-r border-(--color-navbar-border) p-4 flex flex-col">
            <div className="flex items-center justify-between mb-6">
              <NavLink to={memberNav[0]?.path || "/"} className="leading-tight block hover:opacity-80">
                <p className="font-display text-sm font-semibold text-(--color-navbar-text)">GYMAI</p>
                <p className="text-[11px] text-(--color-navbar-text-muted)">Member</p>
              </NavLink>
              <button onClick={() => setMobileOpen(false)} className="text-(--color-navbar-text-muted)">
                <icons.X size={20} />
              </button>
            </div>
            <nav className="space-y-1 flex-1 overflow-y-auto max-h-[calc(100vh-140px)]">
              {memberNav.map((item) => {
                const Icon = (icons as unknown as Record<string, icons.LucideIcon>)[item.icon] ?? icons.Circle;
                const isWorkout = item.path === "/member/workout-plan" || item.path.includes("workout");
                const isLocked = isWorkout && !isCheckedIn;

                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    end={item.path === "/member"}
                    onClick={() => setMobileOpen(false)}
                    className={({ isActive }) =>
                      clsx(
                        "group flex items-center justify-between rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200",
                        isActive
                          ? "bg-(--color-accent) text-(--color-navbar) shadow-md font-semibold"
                          : "text-(--color-navbar-text-muted) hover:text-(--color-navbar-text) hover:bg-white/10 hover:translate-x-1"
                      )
                    }
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <Icon size={18} className="icon-hover-pop shrink-0" />
                      <span className="truncate">{item.label}</span>
                    </div>
                    {isLocked && (
                      <span className="flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 shrink-0">
                        <Lock size={10} /> Locked
                      </span>
                    )}
                  </NavLink>
                );
              })}
            </nav>
            <button onClick={handleLogout} className="btn-press mt-auto flex items-center gap-2 text-left text-sm font-medium text-(--color-danger) hover:bg-white/10 rounded-xl px-3 py-2.5 transition-colors">
              <icons.LogOut size={16} /> Log out
            </button>
          </div>
        </div>
      )}

      <div className="flex-1 min-w-0">
        <TopBar
          greeting="Member Dashboard"
          subtitle="Your workouts, progress and attendance"
          onMenuClick={() => setMobileOpen(true)}
          avatarInitial="M"
          navItems={memberNav}
          roleLabel="Member"
          onLogout={handleLogout}
        />

        <main className="px-4 sm:px-6 py-6 max-w-[1400px] w-full pb-24 lg:pb-6">
          <div key={location.pathname} className="page-enter">
            <Outlet />
          </div>
        </main>

        <nav className="fixed bottom-0 left-0 right-0 z-30 border-t border-slate-800/80 bg-[#0F172A]/95 backdrop-blur-xl px-2 py-2 lg:hidden shadow-[0_-4px_25px_rgba(0,0,0,0.25)]">
          <div className="flex items-center justify-around max-w-md mx-auto">
            {memberNav
              .filter((item) => ["/member", "/member/workout-plan", "/member/ai-coach", "/member/progress"].includes(item.path))
              .map((item) => {
                const Icon = (icons as unknown as Record<string, icons.LucideIcon>)[item.icon] ?? icons.Circle;
                const isWorkout = item.path === "/member/workout-plan" || item.path.includes("workout");
                const isLocked = isWorkout && !isCheckedIn;

                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    end={item.path === "/member"}
                    className={({ isActive }) =>
                      clsx(
                        "group flex flex-col items-center gap-1 rounded-xl py-1 px-2 text-[10px] transition-all duration-200",
                        isActive ? "text-amber-400 font-bold" : "text-slate-400 hover:text-slate-200 font-medium"
                      )
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <span
                          className={clsx(
                            "relative flex h-9 w-9 items-center justify-center rounded-xl transition-all duration-200",
                            isActive ? "bg-amber-500/20 text-amber-400 ring-1 ring-amber-500/30 shadow-xs" : "group-hover:bg-white/5"
                          )}
                        >
                          <Icon size={19} strokeWidth={isActive ? 2.5 : 2} />
                          {isLocked && (
                            <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-amber-500 text-[8px] text-white font-bold shadow-xs">
                              <Lock size={8} />
                            </span>
                          )}
                        </span>
                        <span className="truncate max-w-[64px] tracking-tight">{item.label}</span>
                      </>
                    )}
                  </NavLink>
                );
              })}
            <button
              onClick={() => setMobileOpen(true)}
              className={clsx(
                "group flex flex-col items-center gap-1 rounded-xl py-1 px-2 text-[10px] transition-all duration-200",
                memberNav
                  .filter((item) => !["/member", "/member/workout-plan", "/member/ai-coach", "/member/progress"].includes(item.path))
                  .some((item) => location.pathname.startsWith(item.path))
                  ? "text-amber-400 font-bold"
                  : "text-slate-400 hover:text-slate-200 font-medium"
              )}
            >
              <span
                className={clsx(
                  "flex h-9 w-9 items-center justify-center rounded-xl transition-all duration-200",
                  memberNav
                    .filter((item) => !["/member", "/member/workout-plan", "/member/ai-coach", "/member/progress"].includes(item.path))
                    .some((item) => location.pathname.startsWith(item.path))
                    ? "bg-amber-500/20 text-amber-400 ring-1 ring-amber-500/30 shadow-xs"
                    : "group-hover:bg-white/5"
                )}
              >
                <icons.Menu size={19} strokeWidth={2} />
              </span>
              <span className="tracking-tight">More</span>
            </button>
          </div>
        </nav>
      </div>
    </div>
  );
}
