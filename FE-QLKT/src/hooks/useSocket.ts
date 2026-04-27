import { useEffect, useRef, useState, useCallback } from 'react';
import { io } from 'socket.io-client';
import type { Socket } from 'socket.io-client';
import axiosInstance from '@/lib/axiosInstance';

const SOCKET_URL = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:4000';

export type SocketConnectionStatus = 'connecting' | 'connected' | 'disconnected';

/**
 * Manages Socket.IO connection with auto-reconnect and token synchronization.
 * @param token - JWT access token; pass `null` to skip connection
 * @param onNotification - Callback for new notifications from server
 * @param onConnectionChange - Callback when connection status changes
 * @param onForceLogout - Callback when server triggers forced logout
 * @returns `socketRef` for socket instance access and current `connectionStatus`
 */
export function useSocket(
  token: string | null,
  onNotification: (notification: unknown) => void,
  onConnectionChange?: (status: SocketConnectionStatus) => void,
  onForceLogout?: (data: { message: string }) => void
) {
  const socketRef = useRef<Socket | null>(null);
  const onNotificationRef = useRef(onNotification);
  onNotificationRef.current = onNotification;

  const onConnectionChangeRef = useRef(onConnectionChange);
  onConnectionChangeRef.current = onConnectionChange;

  const onForceLogoutRef = useRef(onForceLogout);
  onForceLogoutRef.current = onForceLogout;

  const tokenRefreshHandlerRef = useRef<((e: Event) => void) | null>(null);

  const [connectionStatus, setConnectionStatus] = useState<SocketConnectionStatus>('disconnected');

  const updateStatus = useCallback((status: SocketConnectionStatus) => {
    setConnectionStatus(status);
    onConnectionChangeRef.current?.(status);
  }, []);

  useEffect(() => {
    if (!token) return;

    const socket = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 10,
    });

    updateStatus('connecting');

    socket.on('connect', () => updateStatus('connected'));
    socket.on('disconnect', () => updateStatus('disconnected'));
    socket.on('reconnect_attempt', () => updateStatus('connecting'));
    socket.on('reconnect', () => updateStatus('connected'));
    socket.on('reconnect_failed', () => updateStatus('disconnected'));

    socket.on('connect_error', async (err: Error) => {
      if (err.message === 'TOKEN_EXPIRED') {
        const storedRefresh = localStorage.getItem('refreshToken');
        if (!storedRefresh) return;
        try {
          const res = await axiosInstance.post('/api/auth/refresh', { refreshToken: storedRefresh });
          const newToken = res.data?.data?.accessToken;
          if (newToken) {
            localStorage.setItem('accessToken', newToken);
            const newRefresh = res.data?.data?.refreshToken;
            if (newRefresh) localStorage.setItem('refreshToken', newRefresh);
            (socket.auth as Record<string, string>).token = newToken;
            window.dispatchEvent(new CustomEvent('tokenRefreshed', { detail: { accessToken: newToken } }));
            socket.connect();
          }
        } catch {
          // Refresh failed — let axiosInstance interceptor handle force logout on next API call
        }
        return;
      }
      const latestToken = localStorage.getItem('accessToken');
      if (latestToken && latestToken !== (socket.auth as Record<string, string>)?.token) {
        (socket.auth as Record<string, string>).token = latestToken;
      }
    });

    socket.on('new_notification', n => onNotificationRef.current(n));
    socket.on('force_logout', (data: { message: string }) => onForceLogoutRef.current?.(data));

    const handleTokenRefreshed = (e: Event) => {
      const newToken = (e as CustomEvent).detail?.accessToken;
      if (newToken && socket) {
        (socket.auth as Record<string, string>).token = newToken;
        if (!socket.connected) socket.connect();
      }
    };
    window.addEventListener('tokenRefreshed', handleTokenRefreshed);
    tokenRefreshHandlerRef.current = handleTokenRefreshed;

    socketRef.current = socket;

    return () => {
      if (tokenRefreshHandlerRef.current) {
        window.removeEventListener('tokenRefreshed', tokenRefreshHandlerRef.current);
        tokenRefreshHandlerRef.current = null;
      }
      socket.disconnect();
      socketRef.current = null;
      updateStatus('disconnected');
    };
  }, [token, updateStatus]);

  return { socketRef, connectionStatus };
}
