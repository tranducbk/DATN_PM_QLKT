import { useEffect, useRef } from 'react';
import type { Socket } from 'socket.io-client';

const SOCKET_URL = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:4000';

/**
 * Hook kết nối Socket.IO với xác thực JWT.
 * Dùng dynamic import để tránh lỗi SSR với Next.js.
 */
export function useSocket(
  token: string | null,
  onNotification: (notification: unknown) => void
) {
  const socketRef = useRef<Socket | null>(null);
  const onNotificationRef = useRef(onNotification);
  onNotificationRef.current = onNotification;

  useEffect(() => {
    if (!token) return;

    let socket: Socket;
    let cancelled = false;

    import('socket.io-client').then(({ io }) => {
      if (cancelled) return;

      socket = io(SOCKET_URL, {
        auth: { token },
        transports: ['websocket', 'polling'],
      });

      socket.on('new_notification', notification => {
        onNotificationRef.current(notification);
      });

      socketRef.current = socket;
    });

    return () => {
      cancelled = true;
      if (socket) {
        socket.disconnect();
      }
      socketRef.current = null;
    };
  }, [token]);

  return socketRef;
}
