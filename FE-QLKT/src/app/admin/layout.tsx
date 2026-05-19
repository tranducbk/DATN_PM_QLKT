'use client';

import { MainLayout } from '@/components/MainLayout';
import { useAuthGuard } from '@/hooks/useAuthGuard';
import { DevZoneProvider } from '@/contexts/DevZoneContext';
import { ROLES } from '@/constants/roles.constants';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { isChecking } = useAuthGuard([ROLES.ADMIN, ROLES.SUPER_ADMIN]);

  if (isChecking) return null;

  // MainLayout reads user.role from AuthContext to render the correct sidebar — when SA
  // accesses /admin/* (shared management pages), they still see the SA menu.
  return (
    <DevZoneProvider>
      <MainLayout role={ROLES.ADMIN}>{children}</MainLayout>
    </DevZoneProvider>
  );
}
