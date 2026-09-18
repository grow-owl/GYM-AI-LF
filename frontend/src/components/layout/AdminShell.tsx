import DashboardShell from '@/components/layout/DashboardShell';
import { adminNav, adminNavSecondary } from '@/data/nav';
import { useAuth } from '@/store/authStore';

/**
 * AdminShell – dedicated layout for Super Admin routes.
 * It uses the admin navigation definitions (adminNav & adminNavSecondary).
 * This component is separate from OwnerShell to avoid UI sharing.
 */
function AdminShell() {
  const { user } = useAuth();
  const firstName = user?.fullName?.split(' ')[0] ?? 'Admin';
  const initial = (user?.fullName?.[0] ?? 'A').toUpperCase();

  return (
    <DashboardShell
      primary={adminNav}
      secondary={adminNavSecondary}
      roleLabel="Super Admin"
      greeting={`Good Morning, ${firstName} 👋`}
      subtitle={String(user?.gymName || 'Platform Admin')}
      avatarInitial={initial}
    />
  );
}

export default AdminShell;
