'use client';

import MainLayout from '@/components/MainLayout';
import { useAuthGuard } from '@/hooks/useAuthGuard';
import { DevZoneProvider } from '@/contexts/DevZoneContext';
import { ROLES } from '@/constants/roles.constants';

export default function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  const { isChecking } = useAuthGuard(ROLES.SUPER_ADMIN);

  if (isChecking) return null;

  return (
    <DevZoneProvider>
      <MainLayout role={ROLES.SUPER_ADMIN}>{children}</MainLayout>
    </DevZoneProvider>
  );
}
