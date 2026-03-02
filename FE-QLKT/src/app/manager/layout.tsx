'use client';

import MainLayout from '@/components/MainLayout';
import { useAuthGuard } from '@/hooks/useAuthGuard';

export default function ManagerLayout({ children }: { children: React.ReactNode }) {
  const { isChecking } = useAuthGuard('MANAGER');

  if (isChecking) return null;

  return <MainLayout role="MANAGER">{children}</MainLayout>;
}
