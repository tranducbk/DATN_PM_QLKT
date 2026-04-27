'use client';

import { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import type { UserRole } from '@/lib/types/common';

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
  login: (token: string, refreshToken: string, user: AuthUser) => void;
  logout: () => void;
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
    const loadAuth = () => {
      try {
        const token = localStorage.getItem('accessToken');
        const refreshToken = localStorage.getItem('refreshToken');
        const role = localStorage.getItem('role') as UserRole | null;
        const username = localStorage.getItem('username');
        const userId = localStorage.getItem('userId');
        const quanNhanId = localStorage.getItem('quan_nhan_id');
        const hoTen = localStorage.getItem('ho_ten');
        const donViId = localStorage.getItem('don_vi_id');

        // Both tokens expired — force re-login
        if (!isTokenValid(token) && !isTokenValid(refreshToken)) {
          localStorage.clear();
          setUser(null);
          const publicPaths = ['/login', '/dev_zone'];
          if (!publicPaths.includes(window.location.pathname)) {
            window.location.href = '/login';
          }
          return;
        }

        if (token && role && userId) {
          setUser({
            id: userId,
            username: username || '',
            role,
            quan_nhan_id: quanNhanId || undefined,
            ho_ten: hoTen || undefined,
            don_vi_id: donViId || undefined,
          });
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

  const login = useCallback((token: string, refreshToken: string, userData: AuthUser) => {
    localStorage.setItem('accessToken', token);
    localStorage.setItem('refreshToken', refreshToken);
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

  const logout = useCallback(() => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('role');
    localStorage.removeItem('username');
    localStorage.removeItem('userId');
    localStorage.removeItem('quan_nhan_id');
    localStorage.removeItem('ho_ten');
    localStorage.removeItem('don_vi_id');
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
