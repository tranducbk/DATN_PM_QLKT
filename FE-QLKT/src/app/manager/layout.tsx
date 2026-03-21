'use client';

import MainLayout from '@/components/MainLayout';
import { useAuthGuard } from '@/hooks/useAuthGuard';
import { DevZoneProvider } from '@/contexts/DevZoneContext';

export default function ManagerLayout({ children }: { children: React.ReactNode }) {
  const { isChecking } = useAuthGuard('MANAGER');

  if (isChecking) return null;

  return (
    <DevZoneProvider>
      <MainLayout role="MANAGER">{children}</MainLayout>
    </DevZoneProvider>
  );
}
