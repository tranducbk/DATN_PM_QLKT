'use client';

import MainLayout from '@/components/MainLayout';
import { useAuthGuard } from '@/hooks/useAuthGuard';

export default function UserLayout({ children }: { children: React.ReactNode }) {
  const { isChecking } = useAuthGuard('USER');

  if (isChecking) return null;

  return <MainLayout role="USER">{children}</MainLayout>;
}
