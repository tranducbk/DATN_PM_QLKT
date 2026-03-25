'use client';

import MainLayout from '@/components/MainLayout';
import { useAuthGuard } from '@/hooks/useAuthGuard';
import { DevZoneProvider } from '@/contexts/DevZoneContext';
import { ROLES } from '@/constants/roles.constants';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { isChecking } = useAuthGuard(ROLES.ADMIN);

  if (isChecking) return null;

  return (
    <DevZoneProvider>
      <MainLayout role={ROLES.ADMIN}>{children}</MainLayout>
    </DevZoneProvider>
  );
}
