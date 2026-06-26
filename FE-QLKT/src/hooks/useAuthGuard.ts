'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import type { UserRole } from '@/lib/types/common';

/*
 * ════════════════════════════════════════════════════════════════════════════
 *  useAuthGuard HOOK — route guard cho từng layout theo role
 * ════════════════════════════════════════════════════════════════════════════
 *
 *  KIẾN TRÚC ROUTE PROTECTION:
 *  Next.js App Router KHÔNG có middleware-level role check ở client (chỉ
 *  có server-side). Vì vậy guard bằng hook trong layout:
 *
 *      app/admin/layout.tsx → useAuthGuard('ADMIN')
 *      app/super-admin/layout.tsx → useAuthGuard('SUPER_ADMIN')
 *      app/manager/layout.tsx → useAuthGuard(['MANAGER', 'ADMIN'])
 *      app/user/layout.tsx → useAuthGuard('USER')
 *
 *  3-STATE LOGIC:
 *  ① isLoading (AuthContext đang hydrate localStorage):
 *     → CHỜ, không redirect (tránh flash redirect rồi load lại).
 *  ② !user (đã hydrate xong, không có user):
 *     → redirect /login.
 *  ③ user có nhưng role không match required:
 *     → redirect về dashboard role mình (vd: USER vào /admin → kick về /user/dashboard).
 *  ④ Match: setIsChecking(false) → layout render children.
 *
 *  WHY redirect VỀ DASHBOARD MÌNH thay vì /login:
 *  - User đã đăng nhập, không cần đăng nhập lại.
 *  - Trải nghiệm tốt hơn: thay vì error 403, dẫn về trang user có thể dùng.
 *  - Anti-pattern: redirect loop. Vd: ADMIN vào /user → kick về /admin/dashboard
 *    → guard /admin OK → render. Không loop.
 *
 *  isChecking RETURN VALUE:
 *  Layout dùng để hiển thị spinner trong khi check:
 *      const { isChecking } = useAuthGuard('ADMIN');
 *      if (isChecking) return <Spinner />;
 *      return <DashboardLayout>{children}</DashboardLayout>;
 *  → Tránh content flash trong lúc redirect.
 *
 *  EDGE CASE: Bypass client-side guard:
 *  Kẻ tấn công có thể disable JavaScript → bypass guard này. Vì vậy
 *  BACKEND CŨNG PHẢI check role qua middleware (xem auth.ts BE). Hook
 *  này chỉ là UX layer, không phải security layer thật sự.
 * ════════════════════════════════════════════════════════════════════════════
 */

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
