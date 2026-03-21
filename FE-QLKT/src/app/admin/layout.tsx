'use client';

import MainLayout from '@/components/MainLayout';
import { useAuthGuard } from '@/hooks/useAuthGuard';
import { DevZoneProvider } from '@/contexts/DevZoneContext';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { isChecking } = useAuthGuard('ADMIN');

  if (isChecking) return null;

  return (
    <DevZoneProvider>
      <MainLayout role="ADMIN">{children}</MainLayout>
    </DevZoneProvider>
  );
}
