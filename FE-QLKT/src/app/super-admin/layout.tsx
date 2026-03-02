'use client';

import MainLayout from '@/components/MainLayout';
import { useAuthGuard } from '@/hooks/useAuthGuard';

export default function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  const { isChecking } = useAuthGuard('SUPER_ADMIN');

  if (isChecking) return null;

  return <MainLayout role="SUPER_ADMIN">{children}</MainLayout>;
}
