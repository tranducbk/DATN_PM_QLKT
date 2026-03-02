'use client';

import MainLayout from '@/components/MainLayout';
import { useAuthGuard } from '@/hooks/useAuthGuard';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { isChecking } = useAuthGuard('ADMIN');

  if (isChecking) return null;

  return <MainLayout role="ADMIN">{children}</MainLayout>;
}
