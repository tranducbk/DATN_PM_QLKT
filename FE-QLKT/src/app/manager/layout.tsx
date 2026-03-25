'use client';

import MainLayout from '@/components/MainLayout';
import { useAuthGuard } from '@/hooks/useAuthGuard';
import { DevZoneProvider } from '@/contexts/DevZoneContext';
import { ROLES } from '@/constants/roles.constants';

export default function ManagerLayout({ children }: { children: React.ReactNode }) {
  const { isChecking } = useAuthGuard(ROLES.MANAGER);

  if (isChecking) return null;

  return (
    <DevZoneProvider>
      <MainLayout role={ROLES.MANAGER}>{children}</MainLayout>
    </DevZoneProvider>
  );
}
