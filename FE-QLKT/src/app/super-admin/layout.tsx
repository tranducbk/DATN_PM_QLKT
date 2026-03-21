'use client';

import MainLayout from '@/components/MainLayout';
import { useAuthGuard } from '@/hooks/useAuthGuard';
import { DevZoneProvider } from '@/contexts/DevZoneContext';

export default function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  const { isChecking } = useAuthGuard('SUPER_ADMIN');

  if (isChecking) return null;

  return (
    <DevZoneProvider>
      <MainLayout role="SUPER_ADMIN">{children}</MainLayout>
    </DevZoneProvider>
  );
}
