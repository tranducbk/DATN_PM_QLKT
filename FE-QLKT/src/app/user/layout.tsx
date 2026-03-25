'use client';

import MainLayout from '@/components/MainLayout';
import { useAuthGuard } from '@/hooks/useAuthGuard';
import { ROLES } from '@/constants/roles.constants';

export default function UserLayout({ children }: { children: React.ReactNode }) {
  const { isChecking } = useAuthGuard(ROLES.USER);

  if (isChecking) return null;

  return <MainLayout role={ROLES.USER}>{children}</MainLayout>;
}
