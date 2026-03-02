'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

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
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    const checkAuth = () => {
      const token = localStorage.getItem('accessToken');
      const role = localStorage.getItem('role') as UserRole | null;

      if (!token) {
        router.push('/login');
        return;
      }

      if (role !== requiredRole) {
        const redirectPath = role && ROLE_DASHBOARD_MAP[role]
          ? ROLE_DASHBOARD_MAP[role]
          : '/login';
        router.push(redirectPath);
        return;
      }

      setIsChecking(false);
    };

    checkAuth();

    const handleTokenRefreshed = () => {
      setIsChecking(true);
      checkAuth();
    };

    window.addEventListener('tokenRefreshed', handleTokenRefreshed);
    return () => window.removeEventListener('tokenRefreshed', handleTokenRefreshed);
  }, [router, requiredRole]);

  return { isChecking };
}
