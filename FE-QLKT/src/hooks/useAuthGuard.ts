'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

type UserRole = 'SUPER_ADMIN' | 'ADMIN' | 'MANAGER' | 'USER';

/**
 * Redirect map cho từng role
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
 * Thay thế logic auth check duplicate trong 4 layout files.
 * Kiểm tra authentication + authorization và redirect nếu không hợp lệ.
 *
 * @param requiredRole - Role yêu cầu để truy cập layout
 * @returns { isChecking } - true nếu đang check auth, dùng để render loading
 */
export function useAuthGuard(requiredRole: UserRole) {
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    if (isLoading) return;

    if (!user) {
      router.push('/login');
      return;
    }

    if (user.role !== requiredRole) {
      const redirectPath = ROLE_DASHBOARD_MAP[user.role] ?? '/login';
      router.push(redirectPath);
      return;
    }

    setIsChecking(false);
  }, [user, isLoading, router, requiredRole]);

  return { isChecking: isLoading || isChecking };
}
