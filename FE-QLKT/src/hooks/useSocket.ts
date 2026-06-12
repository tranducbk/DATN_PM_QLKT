import { useEffect, useRef, useState, useCallback } from 'react';
import { io } from 'socket.io-client';
import type { Socket } from 'socket.io-client';
import axiosInstance from '@/lib/http/axiosInstance';

/*
 * ════════════════════════════════════════════════════════════════════════════
 *  useSocket HOOK — Socket.IO client với auto-reconnect + token refresh
 * ════════════════════════════════════════════════════════════════════════════
 *
 *  3 KỸ THUẬT QUAN TRỌNG:
 *
 *  ① CALLBACK REF (onNotificationRef.current = onNotification):
 *     Pattern này tránh socket bị disconnect+reconnect mỗi lần component
 *     re-render. Vì sao?
 *       - Nếu put onNotification vào useEffect deps → mỗi render component
 *         tạo callback mới → deps thay đổi → effect cleanup + re-run →
 *         disconnect socket → reconnect (rất tốn tài nguyên + miss event).
 *       - Dùng ref: gán callback mới vào ref.current mỗi render, nhưng
 *         socket handler chỉ tham chiếu `onNotificationRef.current(n)` →
 *         luôn gọi version mới nhất MÀ KHÔNG cần restart socket.
 *     Đây là kỹ thuật "stale closure escape" rất phổ biến trong React hooks.
 *
 *  ② AUTO RECONNECT (Socket.IO built-in):
 *     reconnectionAttempts: 10  → thử lại 10 lần
 *     reconnectionDelay: 1s     → khởi đầu 1 giây
 *     reconnectionDelayMax: 5s  → cap tối đa 5 giây (exponential backoff)
 *     Nếu sau 10 lần fail → status='disconnected' vĩnh viễn, user phải
 *     refresh trang. Không retry vô hạn → tránh DoS server.
 *
 *  ③ TOKEN REFRESH KHI SOCKET 'TOKEN_EXPIRED':
 *     Khi access token hết hạn giữa session, socket connect_error trả về
 *     code 'TOKEN_EXPIRED' (xem `socketService.ts` backend).
 *     Flow:
 *       a. Gọi /api/auth/refresh để lấy access mới.
 *       b. Update localStorage.
 *       c. Update socket.auth.token = newToken.
 *       d. Dispatch 'tokenRefreshed' event để AuthContext + axios cùng update.
 *       e. socket.connect() để retry kết nối với token mới.
 *
 *  ④ EVENT BUS 'tokenRefreshed':
 *     Listener: nếu axios interceptor refresh token TRƯỚC (vì có API call
 *     fail 401 sớm hơn) → emit event → socket update auth.token sẵn cho
 *     lần connect tiếp theo. Đồng bộ token giữa 2 channel (HTTP + WS).
 *
 *  TRANSPORTS ['websocket', 'polling']:
 *  Thử WebSocket trước (nhanh); fall back về long-polling nếu firewall
 *  chặn WS (vd: corporate proxy). Polling chậm hơn nhưng đảm bảo connect.
 *
 *  CLEANUP TRONG return của useEffect:
 *  - removeEventListener 'tokenRefreshed' để tránh leak.
 *  - socket.disconnect() để giải phóng connection slot.
 *  - Reset socketRef.current = null.
 *  → Khi component unmount (vd: user logout, đổi route), không để socket
 *    "zombie" tiêu thụ tài nguyên.
 * ════════════════════════════════════════════════════════════════════════════
 */

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
        try {
          // Refresh token lives in an httpOnly cookie sent automatically (withCredentials)
          const res = await axiosInstance.post('/api/auth/refresh');
          const newToken = res.data?.data?.accessToken;
          if (newToken) {
            localStorage.setItem('accessToken', newToken);
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
