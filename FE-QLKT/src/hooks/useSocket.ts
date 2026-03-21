import { useEffect, useRef, useState, useCallback } from 'react';
import type { Socket } from 'socket.io-client';

const SOCKET_URL = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:4000';

export type SocketConnectionStatus = 'connecting' | 'connected' | 'disconnected';

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

    let socket: Socket;
    let cancelled = false;

    updateStatus('connecting');

    import('socket.io-client').then(({ io }) => {
      if (cancelled) return;

      socket = io(SOCKET_URL, {
        auth: { token },
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        reconnectionAttempts: 10,
      });

      socket.on('connect', () => updateStatus('connected'));
      socket.on('disconnect', () => updateStatus('disconnected'));
      socket.on('reconnect_attempt', () => updateStatus('connecting'));
      socket.on('reconnect', () => updateStatus('connected'));
      socket.on('reconnect_failed', () => updateStatus('disconnected'));

      socket.on('connect_error', () => {
        const freshToken = localStorage.getItem('accessToken');
        if (freshToken && freshToken !== (socket.auth as Record<string, string>)?.token) {
          (socket.auth as Record<string, string>).token = freshToken;
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
    });

    return () => {
      cancelled = true;
      if (tokenRefreshHandlerRef.current) {
        window.removeEventListener('tokenRefreshed', tokenRefreshHandlerRef.current);
        tokenRefreshHandlerRef.current = null;
      }
      if (socket) socket.disconnect();
      socketRef.current = null;
      updateStatus('disconnected');
    };
  }, [token, updateStatus]);

  return { socketRef, connectionStatus };
}
