/*
 * ════════════════════════════════════════════════════════════════════════════
 *  SOCKET.IO SERVICE — real-time notification + force_logout
 * ════════════════════════════════════════════════════════════════════════════
 *
 *  KIẾN TRÚC ROOM-PER-USER:
 *
 *      ┌──────────────┐
 *      │  User A      │ ──── socket.io connection ──── joins "user_<A.id>"
 *      └──────────────┘
 *      ┌──────────────┐
 *      │  User B      │ ──── socket.io connection ──── joins "user_<B.id>"
 *      └──────────────┘
 *
 *  Service muốn gửi thông báo đến user X → io.to(`user_${X.id}`).emit(...)
 *  Socket.IO tự broadcast tới tất cả socket connection có join room đó
 *  (mỗi user có thể mở nhiều tab/device cùng lúc → nhiều socket cùng
 *  room → tất cả đều nhận).
 *
 *  AUTH FLOW (handshake middleware io.use):
 *  1. Client connect kèm token trong handshake.auth.token (KHÔNG dùng
 *     header Authorization vì Socket.IO không hỗ trợ chuẩn).
 *  2. Verify JWT với JWT_SECRET (giống REST auth middleware).
 *  3. Decoded payload attach vào socket.user → handler sau biết user nào.
 *  4. Verify FAIL → reject connection ngay (callback err).
 *  5. Trả mã 'TOKEN_EXPIRED' riêng → FE biết refresh token rồi reconnect
 *     (thay vì redirect login như case invalid).
 *
 *  CORS + KEEP-ALIVE:
 *  - cors.origin: dùng chung whitelist với REST API.
 *  - pingTimeout 60s + pingInterval 25s: heartbeat duy trì kết nối.
 *    Nếu client mất mạng > 60s → server coi như disconnect → cleanup room.
 *
 *  SINGLETON `io`:
 *  Module-level `let io` để các service khác (notification, auth) import
 *  `emitToUser` mà không cần inject. Init 1 lần ở entrypoint (index.ts).
 *
 *  EVENT QUAN TRỌNG:
 *  - 'new_notification': push thông báo đề xuất duyệt/từ chối, ...
 *  - 'force_logout': khi user login mới, đẩy tab cũ ra (single session).
 *  - 'recalc_done': khi BE recalc xong profile, refresh data trên FE.
 * ════════════════════════════════════════════════════════════════════════════
 */

import { Server, Socket } from 'socket.io';
import { Server as HttpServer } from 'http';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../configs';
import { allowCorsOrigin } from '../configs/cors';

interface DecodedToken {
  id: string;
  [key: string]: unknown;
}

let io: Server | null = null;

/**
 * Initialize Socket.IO with the HTTP server.
 * @param httpServer - Express HTTP server instance
 * @returns Configured Socket.IO server instance
 */
function initSocket(httpServer: HttpServer): Server {
  io = new Server(httpServer, {
    cors: {
      origin: allowCorsOrigin,
      credentials: true,
    },
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  io.use((socket: Socket, next: (err?: Error) => void) => {
    const token = socket.handshake.auth.token as string | undefined;
    if (!token) {
      return next(new Error('Không tìm thấy token'));
    }
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as DecodedToken;
      (socket as Socket & { user: DecodedToken }).user = decoded;
      next();
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        return next(new Error('TOKEN_EXPIRED'));
      }
      console.error('Socket auth failed while verifying JWT token:', error);
      next(new Error('Token không hợp lệ'));
    }
  });

  io.on('connection', (socket: Socket) => {
    const authenticatedSocket = socket as Socket & { user: DecodedToken };
    const userId = authenticatedSocket.user.id;
    authenticatedSocket.join(`user_${userId}`);

    socket.on('disconnect', () => {
      authenticatedSocket.leave(`user_${userId}`);
    });
  });

  return io;
}

/**
 * Emit a notification to a specific user room.
 * @param userId - Target user ID
 * @param notification - Notification payload
 * @returns No return value
 */
function emitNotificationToUser(userId: string, notification: Record<string, unknown>): void {
  if (!io) return;
  io.to(`user_${userId}`).emit('new_notification', notification);
}

/**
 * Emit any event to a specific user room.
 * @param userId - Target user ID
 * @param event - Socket.IO event name
 * @param data - Event payload
 * @returns No return value
 */
function emitToUser(userId: string, event: string, data: unknown): void {
  if (!io) return;
  io.to(`user_${userId}`).emit(event, data);
}

export { initSocket, emitNotificationToUser, emitToUser };
