import { Navigate, Outlet } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth, roleHome } from "@/store/authStore";
import type { Role } from "@/lib/endpoints";

export default function ProtectedRoute({ allowedRoles }: { allowedRoles?: Role[] }) {
  const { isAuthenticated, initializing, user } = useAuth();

  // Wait for the initial "do we already have a valid session" check before deciding —
  // otherwise a page refresh would bounce a logged-in user to /login for a split second.
  if (initializing) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 size={22} className="animate-spin text-(--color-accent)" />
      </div>
    );
  }

  if (!isAuthenticated) return <Navigate to="/login" replace />;

  if (allowedRoles && user && !allowedRoles.includes(user.role)) {
    // Logged in, but the wrong role for this section — send them to their own dashboard
    // instead of letting them view (or "become") a role they don't have.
    return <Navigate to={roleHome[user.role] ?? "/login"} replace />;
  }

  return <Outlet />;
}
