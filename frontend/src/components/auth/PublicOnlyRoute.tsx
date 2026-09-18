import { Navigate, Outlet } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth, roleHome } from "@/store/authStore";

export default function PublicOnlyRoute() {
  const { isAuthenticated, initializing, user } = useAuth();

  if (initializing) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 size={22} className="animate-spin text-(--color-accent)" />
      </div>
    );
  }

  if (isAuthenticated && user) {
    const targetHome = roleHome[user.role] ?? "/owner";
    return <Navigate to={targetHome} replace />;
  }

  return <Outlet />;
}
