/**
 * Socket service for Socket.IO connections.
 *
 * Each authenticated user joins a private room by user ID.
 * Backend emits events to that room for real-time updates.
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
