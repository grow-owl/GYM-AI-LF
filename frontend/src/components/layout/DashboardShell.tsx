import { useState, useMemo } from "react";
import { Outlet, NavLink, useNavigate, useLocation } from "react-router-dom";
import * as icons from "lucide-react";
import { X, Dumbbell } from "lucide-react";
import clsx from "clsx";
import Sidebar from "./Sidebar";
import TopBar from "./TopBar";
import { useAuth } from "@/store/authStore";

interface NavEntry {
  label: string;
  path: string;
  icon: string;
}

export default function DashboardShell({
  primary,
  secondary,
  roleLabel,
  greeting,
  subtitle,
  avatarInitial,
}: {
  primary: NavEntry[];
  secondary?: NavEntry[];
  roleLabel: string;
  greeting: string;
  subtitle?: string;
  avatarInitial?: string;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const allItems = [...primary, ...(secondary ?? [])];
  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  // Key 4 items for the mobile & tablet bottom navigation bar
  const bottomNavItems = useMemo(() => {
    if (primary.some((p) => p.path === "/owner")) {
      return [
        { label: "Dashboard", path: "/owner", icon: "LayoutGrid" },
        { label: "Members", path: "/owner/members", icon: "Users" },
        { label: "Attendance", path: "/owner/attendance", icon: "QrCode" },
        { label: "AI Insights", path: "/owner/ai-insights", icon: "Sparkles" },
      ];
    }
    if (primary.some((p) => p.path === "/trainer")) {
      return [
        { label: "Dashboard", path: "/trainer", icon: "LayoutGrid" },
        { label: "Clients", path: "/trainer/clients", icon: "Users" },
        { label: "Sessions", path: "/trainer/sessions", icon: "CalendarClock" },
        { label: "Plans", path: "/trainer/workout-plans", icon: "Dumbbell" },
      ];
    }
    if (primary.some((p) => p.path === "/reception")) {
      return [
        { label: "Dashboard", path: "/reception", icon: "LayoutGrid" },
        { label: "Members", path: "/reception/members", icon: "Users" },
        { label: "Check-in", path: "/reception/check-in", icon: "QrCode" },
        { label: "Payments", path: "/reception/payments", icon: "CreditCard" },
      ];
    }
    if (primary.some((p) => p.path === "/admin")) {
      return [
        { label: "Dashboard", path: "/admin", icon: "ShieldCheck" },
        { label: "Gyms", path: "/admin/gyms", icon: "Building2" },
        { label: "Branches", path: "/admin/branches", icon: "MapPin" },
        { label: "Analytics", path: "/admin/analytics", icon: "BarChart3" },
      ];
    }
    return primary.slice(0, 4);
  }, [primary]);

  // Check if any drawer-only item is currently active
  const isDrawerActive = useMemo(() => {
    const bottomPaths = bottomNavItems.map((b) => b.path);
    return allItems
      .filter((item) => !bottomPaths.includes(item.path))
      .some(
        (item) =>
          location.pathname === item.path ||
          (item.path !== "/" && location.pathname.startsWith(item.path))
      );
  }, [allItems, bottomNavItems, location.pathname]);

  return (
    <div className={clsx("min-h-screen flex bg-(--color-base)", collapsed ? "sidebar-collapsed" : "sidebar-expanded")}>
      <Sidebar
        primary={primary}
        secondary={secondary}
        collapsed={collapsed}
        onToggle={() => setCollapsed((c) => !c)}
        roleLabel={roleLabel}
      />

      {/* Mobile & Tablet Drawer (when More is clicked or opened) */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setMobileOpen(false)} />
          <div className="absolute left-0 top-0 h-full w-72 bg-(--color-navbar) border-r border-(--color-navbar-border) p-4 flex flex-col">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2.5">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-(--color-accent) text-(--color-navbar)">
                  <Dumbbell size={18} strokeWidth={2.5} />
                </span>
                <div className="leading-tight">
                  <p className="font-display text-sm font-semibold text-(--color-navbar-text)">GYMAI</p>
                  <p className="text-[11px] text-(--color-navbar-text-muted)">{roleLabel}</p>
                </div>
              </div>
              <button onClick={() => setMobileOpen(false)} className="text-(--color-navbar-text-muted) cursor-pointer">
                <X size={20} />
              </button>
            </div>
            <nav className="space-y-1 overflow-y-auto max-h-[calc(100vh-140px)] flex-1">
              {allItems.map((item) => {
                const Icon = (icons as unknown as Record<string, icons.LucideIcon>)[item.icon] ?? icons.Circle;
                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    end={item.path === primary[0]?.path}
                    onClick={() => setMobileOpen(false)}
                    className={({ isActive }) =>
                      clsx(
                        "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200",
                        isActive
                          ? "bg-(--color-accent) text-(--color-navbar) shadow-md font-semibold"
                          : "text-(--color-navbar-text-muted) hover:text-(--color-navbar-text) hover:bg-white/10 hover:translate-x-1"
                      )
                    }
                  >
                    <Icon size={18} className="icon-hover-pop shrink-0" />
                    {item.label}
                  </NavLink>
                );
              })}
            </nav>
            <button onClick={handleLogout} className="btn-press mt-auto flex items-center gap-2 text-left text-sm font-medium text-(--color-danger) hover:bg-white/10 rounded-xl px-3 py-2.5 transition-colors cursor-pointer">
              <icons.LogOut size={16} /> Log out
            </button>
          </div>
        </div>
      )}

      <div className="flex-1 min-w-0">
        <TopBar
          greeting={greeting}
          subtitle={subtitle}
          onMenuClick={() => setMobileOpen(true)}
          avatarInitial={avatarInitial}
          navItems={allItems}
          roleLabel={roleLabel}
          onLogout={handleLogout}
        />
        <main className="px-4 sm:px-6 py-6 max-w-[1400px] w-full pb-24 lg:pb-6">
          <Outlet />
        </main>

        {/* Bottom Navigation Bar — Mobile & Tablet only (< 1024px) */}
        <nav className="fixed bottom-0 left-0 right-0 z-30 border-t border-slate-800/80 bg-[#0F172A]/95 backdrop-blur-xl px-2 py-2 lg:hidden shadow-[0_-4px_25px_rgba(0,0,0,0.25)]">
          <div className="flex items-center justify-around max-w-md mx-auto">
            {bottomNavItems.map((item) => {
              const Icon = (icons as unknown as Record<string, icons.LucideIcon>)[item.icon] ?? icons.Circle;
              const isExact =
                item.path === "/owner" ||
                item.path === "/trainer" ||
                item.path === "/reception" ||
                item.path === "/admin";

              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  end={isExact}
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
                "group flex flex-col items-center gap-1 rounded-xl py-1 px-2 text-[10px] transition-all duration-200 cursor-pointer",
                isDrawerActive
                  ? "text-amber-400 font-bold"
                  : "text-slate-400 hover:text-slate-200 font-medium"
              )}
            >
              <span
                className={clsx(
                  "flex h-9 w-9 items-center justify-center rounded-xl transition-all duration-200",
                  isDrawerActive
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
