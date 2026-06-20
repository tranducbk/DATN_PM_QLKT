'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import type { UserRole } from '@/lib/types/common';

/**
 * Redirect target per role.
 */
const ROLE_DASHBOARD_MAP: Record<UserRole, string> = {
  SUPER_ADMIN: '/super-admin/dashboard',
  ADMIN: '/admin/dashboard',
  MANAGER: '/manager/dashboard',
  USER: '/user/dashboard',
};

/**
 * useAuthGuard - Custom Hook Pattern
 *
 * Replaces the auth-check logic duplicated across the 4 layout files.
 * Verifies authentication + authorization and redirects when invalid.
 *
 * @param requiredRole - Role hoặc danh sách role được phép vào layout
 * @returns { isChecking } - true nếu đang check auth, dùng để render loading
 */
export function useAuthGuard(requiredRole: UserRole | UserRole[]) {
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    if (isLoading) return;

    if (!user) {
      router.push('/login');
      return;
    }

    const allowedRoles = Array.isArray(requiredRole) ? requiredRole : [requiredRole];
    if (!allowedRoles.includes(user.role)) {
      const redirectPath = ROLE_DASHBOARD_MAP[user.role] ?? '/login';
      router.push(redirectPath);
      return;
    }

    setIsChecking(false);
  }, [user, isLoading, router, requiredRole]);

  return { isChecking: isLoading || isChecking };
}
