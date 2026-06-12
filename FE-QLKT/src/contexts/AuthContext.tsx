'use client';

import { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import type { UserRole } from '@/lib/types/common';
import { clearAuthStorage } from '@/lib/http/authStorage';
import axiosInstance from '@/lib/http/axiosInstance';

/*
 * ════════════════════════════════════════════════════════════════════════════
 *  AUTH CONTEXT — quản lý state user toàn app (React Context API)
 * ════════════════════════════════════════════════════════════════════════════
 *
 *  KIẾN TRÚC:
 *  - State source of truth: localStorage (persist qua refresh trang).
 *  - In-memory cache: useState<AuthUser> để React component subscribe.
 *  - Sync hai chiều:
 *      localStorage → state khi mount (loadAuth).
 *      state → localStorage khi login/logout/updateUser.
 *
 *  WHY localStorage thay vì cookie:
 *  - Cookie httpOnly an toàn hơn (XSS không đọc được) NHƯNG:
 *      + Cần BE set cookie qua Set-Cookie header.
 *      + CORS phức tạp (credentials: 'include' + Access-Control-Allow-Credentials).
 *      + Không đọc được từ FE → khó hiển thị tên user trên header.
 *  - localStorage đơn giản, đủ an toàn cho intranet (XSS risk thấp do
 *    không có user-generated HTML).
 *  - Trade-off: chấp nhận để đơn giản hoá; production thật nên cookie.
 *
 *  TOKEN VALIDATION TRƯỚC KHI MOUNT (isTokenValid):
 *  - Decode payload không verify signature (atob + JSON.parse).
 *  - Check `exp` field (Unix timestamp seconds × 1000).
 *  - CẢ HAI token (access + refresh) hết hạn → forceLogout → redirect.
 *  - Refresh còn hạn → vẫn để vào app, axios interceptor sẽ tự refresh.
 *
 *  PUBLIC PATHS (skip redirect):
 *  - `/login`: hiển thị form đăng nhập (vô lý redirect ngược).
 *  - `/dev_zone`: dev tool, không bắt auth.
 *
 *  TOKEN REFRESH EVENT BUS:
 *  Khi axios interceptor refresh thành công → dispatch 'tokenRefreshed'
 *  custom event → AuthContext re-load từ localStorage. Pattern này:
 *    - Decouple axios khỏi React (axios không import React được).
 *    - Multi-tab sync: nếu tab 1 refresh, tab 2 cũng pickup được token mới
 *      (cần thêm 'storage' event listener — hiện chưa implement).
 *
 *  HYDRATION (Next.js SSR):
 *  isLoading=true ở mount đầu tiên, set false sau loadAuth. Component
 *  child nên check `if (isLoading) return <Spinner />` để tránh flash
 *  "chưa login" trước khi state hydrate xong.
 * ════════════════════════════════════════════════════════════════════════════
 */

interface AuthUser {
  id: string;
  username: string;
  role: UserRole;
  quan_nhan_id?: string;
  ho_ten?: string;
  don_vi_id?: string;
}

interface AuthContextType {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (token: string, user: AuthUser) => void;
  logout: () => Promise<void>;
  updateUser: (user: Partial<AuthUser>) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/** Decode JWT payload without library (chỉ đọc, không verify signature) */
function decodeTokenPayload(token: string): { exp?: number } | null {
  try {
    const base64 = token.split('.')[1];
    return JSON.parse(atob(base64));
  } catch {
    return null;
  }
}

/** Check xem token còn valid không (chưa hết hạn) */
function isTokenValid(token: string | null): boolean {
  if (!token) return false;
  const payload = decodeTokenPayload(token);
  if (!payload?.exp) return false;
  return payload.exp * 1000 > Date.now();
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const applyUserFromStorage = (): boolean => {
      const role = localStorage.getItem('role') as UserRole | null;
      const userId = localStorage.getItem('userId');
      if (!role || !userId) return false;
      setUser({
        id: userId,
        username: localStorage.getItem('username') || '',
        role,
        quan_nhan_id: localStorage.getItem('quan_nhan_id') || undefined,
        ho_ten: localStorage.getItem('ho_ten') || undefined,
        don_vi_id: localStorage.getItem('don_vi_id') || undefined,
      });
      return true;
    };

    const loadAuth = async () => {
      try {
        const publicPaths = ['/login', '/dev_zone'];
        const onPublicPath = publicPaths.includes(window.location.pathname);
        const token = localStorage.getItem('accessToken');

        if (isTokenValid(token) && applyUserFromStorage()) return;

        // Access expired/missing — only the httpOnly refresh cookie can revive the session.
        // Skip on public paths (and when no prior session) to avoid a needless /refresh + redirect.
        if (!onPublicPath && localStorage.getItem('userId')) {
          try {
            const res = await axiosInstance.post('/api/auth/refresh');
            const newAccess = res.data?.data?.accessToken as string | undefined;
            if (newAccess) {
              localStorage.setItem('accessToken', newAccess);
              if (applyUserFromStorage()) return;
            }
          } catch {
            // refresh failed (no/expired cookie) — fall through to logout
          }
        }

        clearAuthStorage();
        setUser(null);
        if (!onPublicPath) {
          window.location.href = '/login';
        }
      } catch {
        // localStorage not available (SSR)
      } finally {
        setIsLoading(false);
      }
    };

    loadAuth();

    const handleTokenRefreshed = () => loadAuth();
    window.addEventListener('tokenRefreshed', handleTokenRefreshed);
    return () => window.removeEventListener('tokenRefreshed', handleTokenRefreshed);
  }, []);

  const login = useCallback((token: string, userData: AuthUser) => {
    localStorage.setItem('accessToken', token);
    localStorage.setItem('role', userData.role);
    localStorage.setItem('username', userData.username);
    localStorage.setItem('userId', userData.id);
    if (userData.quan_nhan_id) {
      localStorage.setItem('quan_nhan_id', userData.quan_nhan_id);
    }
    if (userData.ho_ten) {
      localStorage.setItem('ho_ten', userData.ho_ten);
    }
    if (userData.don_vi_id) {
      localStorage.setItem('don_vi_id', String(userData.don_vi_id));
    }
    setUser(userData);
  }, []);

  const logout = useCallback(async () => {
    try {
      await axiosInstance.post('/api/auth/logout');
    } catch {
      // best-effort: clear client state even if the server call fails
    }
    clearAuthStorage();
    setUser(null);
  }, []);

  const updateUser = useCallback((updates: Partial<AuthUser>) => {
    setUser(prev => (prev ? { ...prev, ...updates } : null));
  }, []);

  const value = useMemo(
    () => ({
      user,
      isAuthenticated: !!user,
      isLoading,
      login,
      logout,
      updateUser,
    }),
    [user, isLoading, login, logout, updateUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * useAuth hook - lấy auth state từ context
 * Thay thế việc đọc localStorage.getItem('role') rải rác
 */
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
