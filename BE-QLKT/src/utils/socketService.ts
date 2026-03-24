/**
 * Socket Service - Quản lý kết nối Socket.IO
 *
 * Mỗi user sau khi xác thực sẽ join vào room riêng theo user ID.
 * Khi có thông báo mới, BE emit vào đúng room để FE nhận ngay lập tức.
 */

import { Server, Socket } from 'socket.io';
import { Server as HttpServer } from 'http';
import jwt from 'jsonwebtoken';

interface DecodedToken {
  id: string;
  [key: string]: unknown;
}

let io: Server | null = null;

/**
 * Khởi tạo Socket.IO với HTTP server
 */
function initSocket(httpServer: HttpServer): Server {
  io = new Server(httpServer, {
    cors: {
      origin: ['http://localhost:3000', 'http://localhost:3001'],
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
      const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as DecodedToken;
      (socket as Socket & { user: DecodedToken }).user = decoded;
      next();
    } catch {
      next(new Error('Token không hợp lệ'));
    }
  });

  io.on('connection', (socket: Socket) => {
    const authenticatedSocket = socket as Socket & { user: DecodedToken };
    authenticatedSocket.join(`user_${authenticatedSocket.user.id}`);

    socket.on('disconnect', () => {});
  });

  return io;
}

/**
 * Gửi thông báo real-time đến một user cụ thể
 * @param userId - ID của người nhận
 * @param notification - Dữ liệu thông báo
 */
function emitNotificationToUser(userId: string, notification: Record<string, unknown>): void {
  if (!io) return;
  io.to(`user_${userId}`).emit('new_notification', notification);
}

/**
 * Gửi một event bất kỳ đến một user cụ thể
 */
function emitToUser(userId: string, event: string, data: unknown): void {
  if (!io) return;
  io.to(`user_${userId}`).emit(event, data);
}

export { initSocket, emitNotificationToUser, emitToUser };
