import { useEffect, useRef, useState, useCallback } from 'react';
import { io } from 'socket.io-client';
import type { Socket } from 'socket.io-client';
import axiosInstance from '@/lib/http/axiosInstance';

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

  // Always holds the latest token without being a socket-effect dependency, so a
  // token refresh updates the auth payload in place instead of rebuilding the socket.
  const tokenRef = useRef(token);
  tokenRef.current = token;
  const hasToken = Boolean(token);

  const [connectionStatus, setConnectionStatus] = useState<SocketConnectionStatus>('disconnected');

  const updateStatus = useCallback((status: SocketConnectionStatus) => {
    setConnectionStatus(status);
    onConnectionChangeRef.current?.(status);
  }, []);

  useEffect(() => {
    if (!hasToken) return;

    const socket = io(SOCKET_URL, {
      // Read the freshest token on every (re)connect so a rotated token is sent
      // without tearing the socket down and back up.
      auth: (cb: (data: object) => void) => cb({ token: tokenRef.current }),
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
        try {
          // Refresh token lives in an httpOnly cookie sent automatically (withCredentials)
          const res = await axiosInstance.post('/api/auth/refresh');
          const newToken = res.data?.data?.accessToken;
          if (newToken) {
            localStorage.setItem('accessToken', newToken);
            tokenRef.current = newToken;
            window.dispatchEvent(new CustomEvent('tokenRefreshed', { detail: { accessToken: newToken } }));
            socket.connect();
          }
        } catch {
          // Refresh failed — let axiosInstance interceptor handle force logout on next API call
        }
        return;
      }
      const latestToken = localStorage.getItem('accessToken');
      if (latestToken && latestToken !== tokenRef.current) {
        tokenRef.current = latestToken;
      }
    });

    socket.on('new_notification', n => onNotificationRef.current(n));
    socket.on('force_logout', (data: { message: string }) => onForceLogoutRef.current?.(data));

    const handleTokenRefreshed = (e: Event) => {
      const newToken = (e as CustomEvent).detail?.accessToken;
      if (newToken) {
        tokenRef.current = newToken;
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
  }, [hasToken, updateStatus]);

  return { socketRef, connectionStatus };
}
