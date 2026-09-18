import { useEffect, lazy, Suspense, useMemo } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import RoleSelect from "@/pages/RoleSelect";
import Landing from "@/pages/Landing";
import DashboardShell from "@/components/layout/DashboardShell";
import MobileShell from "@/components/layout/MobileShell";
import { ownerNav, ownerNavSecondary, trainerNav, receptionNav } from "@/data/nav";
import { useAuth, useAuthStore } from "@/store/authStore";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import PublicOnlyRoute from "@/components/auth/PublicOnlyRoute";
import ErrorBoundary from "@/components/ErrorBoundary";
import AnimatedBackground from "@/components/ui/AnimatedBackground";

// Lazy-loaded auth pages
const Login = lazy(() => import("@/pages/auth/Login"));
const Register = lazy(() => import("@/pages/auth/Register"));
const ForgotPassword = lazy(() => import("@/pages/auth/ForgotPassword"));
const ResetPassword = lazy(() => import("@/pages/auth/ResetPassword"));

// Lazy-loaded Owner pages
const OwnerDashboard = lazy(() => import("@/pages/owner/OwnerDashboard"));
const Members = lazy(() => import("@/pages/owner/Members"));
const Trainers = lazy(() => import("@/pages/owner/Trainers"));
const Staff = lazy(() => import("@/pages/owner/Staff"));
const OwnerAttendance = lazy(() => import("@/pages/owner/Attendance"));
const OwnerPayments = lazy(() => import("@/pages/owner/Payments"));
const Reports = lazy(() => import("@/pages/owner/Reports"));
const AIInsights = lazy(() => import("@/pages/owner/AIInsights"));
const Settings = lazy(() => import("@/pages/owner/Settings"));
const Inventory = lazy(() => import("@/pages/owner/Inventory"));
const Expenses = lazy(() => import("@/pages/owner/Expenses"));
const Equipment = lazy(() => import("@/pages/owner/Equipment"));
const Billing = lazy(() => import("@/pages/owner/Billing"));
const BranchComparison = lazy(() => import("@/pages/owner/BranchComparison"));

// Lazy-loaded Trainer pages
const TrainerDashboard = lazy(() => import("@/pages/trainer/TrainerDashboard"));
const MyClients = lazy(() => import("@/pages/trainer/MyClients"));
const Sessions = lazy(() => import("@/pages/trainer/Sessions"));
const WorkoutPlans = lazy(() => import("@/pages/trainer/WorkoutPlans"));
const DietPlans = lazy(() => import("@/pages/trainer/DietPlans"));
const TrainerProgress = lazy(() => import("@/pages/trainer/Progress"));
const RecoveryAlerts = lazy(() => import("@/pages/trainer/RecoveryAlerts"));
const TrainerProfile = lazy(() => import("@/pages/trainer/Profile"));

// Lazy-loaded Member pages
const MemberHome = lazy(() => import("@/pages/member/MemberHome"));
const WorkoutPlan = lazy(() => import("@/pages/member/WorkoutPlan"));
const WorkoutTracking = lazy(() => import("@/pages/member/WorkoutTracking"));
const WorkoutHistory = lazy(() => import("@/pages/member/WorkoutHistory"));
const DietPlan = lazy(() => import("@/pages/member/DietPlan"));
const AICoach = lazy(() => import("@/pages/member/AICoach"));
const MemberAttendance = lazy(() => import("@/pages/member/Attendance"));
const MemberProgress = lazy(() => import("@/pages/member/Progress"));
const Gamification = lazy(() => import("@/pages/member/Gamification"));
const MemberPayments = lazy(() => import("@/pages/member/Payments"));
const Profile = lazy(() => import("@/pages/member/Profile"));
const Referral = lazy(() => import("@/pages/member/Referral"));

// Lazy-loaded Reception & Admin pages
const ReceptionDashboard = lazy(() => import("@/pages/reception/ReceptionDashboard"));
const CheckIn = lazy(() => import("@/pages/reception/CheckIn"));
const ReceptionPayments = lazy(() => import("@/pages/reception/Payments"));
const ReceptionProfile = lazy(() => import("@/pages/reception/Profile"));
const AdminPanel = lazy(() => import("@/pages/admin/AdminPanel"));
const AdminShell = lazy(() => import("@/components/layout/AdminShell"));
const Gyms = lazy(() => import("@/pages/admin/Gyms"));
const Branches = lazy(() => import("@/pages/admin/Branches"));
const AdminMembers = lazy(() => import("@/pages/admin/Members"));
const AdminTrainers = lazy(() => import("@/pages/admin/Trainers"));
const AdminStaff = lazy(() => import("@/pages/admin/Staff"));
const PasswordReset = lazy(() => import("@/pages/admin/PasswordReset"));
const Analytics = lazy(() => import("@/pages/admin/Analytics"));
const AdminSettings = lazy(() => import("@/pages/admin/Settings"));
const Notifications = lazy(() => import("@/pages/Notifications"));
const NotFound = lazy(() => import("@/pages/NotFound"));

function PageLoader() {
  return (
    <div className="flex h-64 w-full items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-(--color-accent) border-t-transparent" />
    </div>
  );
}

function getTimeBasedGreeting(firstName: string): string {
  const hour = new Date().getHours();
  const salutation = hour < 12 ? "Good Morning" : hour < 17 ? "Good Afternoon" : "Good Evening";
  return `${salutation}, ${firstName} 👋`;
}

function OwnerShell() {
  const { user } = useAuth();
  const firstName = user?.fullName?.split(" ")[0] ?? "Owner";
  const initial = (user?.fullName?.[0] ?? "O").toUpperCase();
  const isSuperAdmin = user?.role === "SUPER_ADMIN";
  const isBranchManager = user?.role === "BRANCH_MANAGER";

  const primaryNav = useMemo(() => {
    if (isBranchManager) {
      // BRANCH_MANAGER cannot access organization financial reports or expenses
      return ownerNav.filter(
        (item) => item.path !== "/owner/expenses" && item.path !== "/owner/reports"
      );
    }
    return ownerNav;
  }, [isBranchManager]);

  const secondaryNav = useMemo(() => {
    if (isBranchManager) {
      // BRANCH_MANAGER cannot access SaaS billing or multi-branch settings
      return ownerNavSecondary.filter(
        (item) => item.path !== "/owner/billing" && item.path !== "/owner/settings"
      );
    }
    if (isSuperAdmin) {
      return [{ label: "Admin Panel", path: "/admin", icon: "ShieldCheck" }, ...ownerNavSecondary];
    }
    return ownerNavSecondary;
  }, [isBranchManager, isSuperAdmin]);

  const roleLabel = isSuperAdmin
    ? "Super Admin"
    : isBranchManager
    ? "Branch Manager"
    : "Owner / Admin";

  const greeting = isBranchManager
    ? `Branch Operations — ${firstName} 👋`
    : getTimeBasedGreeting(firstName);

  const subtitle = isBranchManager
    ? String(user?.branchName || user?.gymName || "Branch Operations")
    : String(user?.gymName || "My Gym");

  return (
    <DashboardShell
      primary={primaryNav}
      secondary={secondaryNav}
      roleLabel={roleLabel}
      greeting={greeting}
      subtitle={subtitle}
      avatarInitial={initial}
    />
  );
}

function TrainerShell() {
  const { user } = useAuth();
  const firstName = user?.fullName?.split(" ")[0] ?? "Trainer";
  const initial = (user?.fullName?.[0] ?? "T").toUpperCase();
  return (
    <DashboardShell
      primary={trainerNav}
      roleLabel="Trainer"
      greeting={getTimeBasedGreeting(firstName)}
      subtitle={String(user?.gymName || "My Gym")}
      avatarInitial={initial}
    />
  );
}

function ReceptionShell() {
  const { user } = useAuth();
  const filteredNav = useMemo(() => {
    if (user?.role === "KIOSK") {
      return receptionNav.filter((item) => item.path !== "/reception/payments");
    }
    return receptionNav;
  }, [user?.role]);

  return (
    <DashboardShell
      primary={filteredNav}
      roleLabel={user?.role === "BRANCH_MANAGER" ? "Branch Manager" : "Reception Staff"}
      greeting={user?.role === "BRANCH_MANAGER" ? "Branch Desk" : "Front Desk Operations"}
      subtitle={String(user?.gymName || "My Gym")}
      avatarInitial={user?.fullName ? user.fullName[0] : "R"}
    />
  );
}

export default function App() {
  const init = useAuthStore((s) => s.init);

  useEffect(() => {
    init();
  }, [init]);

  return (
    <ErrorBoundary>
      <AnimatedBackground />
      <div className="content-layer">
        <BrowserRouter>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/" element={<Landing />} />

              {/* Guest / Public Only Auth Routes */}
              <Route element={<PublicOnlyRoute />}>
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                <Route path="/forgot-password" element={<ForgotPassword />} />
                <Route path="/reset-password" element={<ResetPassword />} />
                <Route path="/roles" element={<RoleSelect />} />
              </Route>

              <Route element={<ProtectedRoute allowedRoles={["SUPER_ADMIN"]} />}>
                <Route path="/admin" element={<AdminShell />}>
                  <Route index element={<AdminPanel />} />
                  <Route path="gyms" element={<Gyms />} />
                  <Route path="branches" element={<Branches />} />
                  <Route path="members" element={<AdminMembers />} />
                  <Route path="trainers" element={<AdminTrainers />} />
                  <Route path="staff" element={<AdminStaff />} />
                  <Route path="password-reset" element={<PasswordReset />} />
                  <Route path="analytics" element={<Analytics />} />
                  <Route path="settings" element={<AdminSettings />} />
                  <Route path="notifications" element={<Notifications />} />
                </Route>
              </Route>

              <Route element={<ProtectedRoute allowedRoles={["GYM_OWNER", "SUPER_ADMIN", "BRANCH_MANAGER"]} />}>
                <Route path="/owner" element={<OwnerShell />}>
                  <Route index element={<OwnerDashboard />} />
                  <Route path="members" element={<Members />} />
                  <Route path="trainers" element={<Trainers />} />
                  <Route path="staff" element={<Staff />} />
                  <Route path="attendance" element={<OwnerAttendance />} />
                  <Route path="payments" element={<OwnerPayments />} />
                  <Route path="inventory" element={<Inventory />} />
                  <Route path="equipment" element={<Equipment />} />
                  <Route path="ai-insights" element={<AIInsights />} />
                  <Route path="notifications" element={<Notifications />} />

                  {/* Owner-Only Routes — Restricted from BRANCH_MANAGER */}
                  <Route element={<ProtectedRoute allowedRoles={["GYM_OWNER", "SUPER_ADMIN"]} />}>
                    <Route path="expenses" element={<Expenses />} />
                    <Route path="billing" element={<Billing />} />
                    <Route path="reports" element={<Reports />} />
                    <Route path="branch-comparison" element={<BranchComparison />} />
                    <Route path="settings" element={<Settings />} />
                  </Route>
                </Route>
              </Route>

              {/* Scoped /manager portal alias redirects to /owner */}
              <Route path="/manager" element={<Navigate to="/owner" replace />} />
              <Route path="/manager/*" element={<Navigate to="/owner" replace />} />

              <Route element={<ProtectedRoute allowedRoles={["TRAINER"]} />}>
                <Route path="/trainer" element={<TrainerShell />}>
                  <Route index element={<TrainerDashboard />} />
                  <Route path="clients" element={<MyClients />} />
                  <Route path="sessions" element={<Sessions />} />
                  <Route path="workout-plans" element={<WorkoutPlans />} />
                  <Route path="diet-plans" element={<DietPlans />} />
                  <Route path="progress" element={<TrainerProgress />} />
                  <Route path="recovery-alerts" element={<RecoveryAlerts />} />
                  <Route path="profile" element={<TrainerProfile />} />
                  <Route path="notifications" element={<Notifications />} />
                </Route>
              </Route>

              <Route element={<ProtectedRoute allowedRoles={["KIOSK", "BRANCH_MANAGER", "GYM_OWNER", "SUPER_ADMIN"]} />}>
                <Route path="/reception" element={<ReceptionShell />}>
                  <Route index element={<ReceptionDashboard />} />
                  <Route path="members" element={<Members />} />
                  <Route path="inventory" element={<Inventory />} />
                  <Route path="check-in" element={<CheckIn />} />
                  <Route path="payments" element={<ReceptionPayments />} />
                  <Route path="profile" element={<ReceptionProfile />} />
                  <Route path="notifications" element={<Notifications />} />
                </Route>
              </Route>

              <Route element={<ProtectedRoute allowedRoles={["MEMBER"]} />}>
                <Route path="/member" element={<MobileShell />}>
                  <Route index element={<MemberHome />} />
                  <Route path="workout-plan" element={<WorkoutPlan />} />
                  <Route path="workout-tracking" element={<WorkoutTracking />} />
                  <Route path="workout-history" element={<WorkoutHistory />} />
                  <Route path="diet-plan" element={<DietPlan />} />
                  <Route path="ai-coach" element={<AICoach />} />
                  <Route path="attendance" element={<MemberAttendance />} />
                  <Route path="progress" element={<MemberProgress />} />
                  <Route path="rewards" element={<Gamification />} />
                  <Route path="payments" element={<MemberPayments />} />
                  <Route path="profile" element={<Profile />} />
                  <Route path="referral" element={<Referral />} />
                  <Route path="notifications" element={<Notifications />} />
                </Route>
              </Route>

              {/* Catch-all 404 Route */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </div>
    </ErrorBoundary>
  );
}
