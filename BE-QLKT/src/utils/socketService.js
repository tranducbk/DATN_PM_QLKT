/**
 * Socket Service - Quản lý kết nối Socket.IO
 *
 * Mỗi user sau khi xác thực sẽ join vào room riêng theo user ID.
 * Khi có thông báo mới, BE emit vào đúng room để FE nhận ngay lập tức.
 */

const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');

let io = null;

/**
 * Khởi tạo Socket.IO với HTTP server
 */
function initSocket(httpServer) {
  io = new Server(httpServer, {
    cors: {
      origin: ['http://localhost:3000', 'http://localhost:3001'],
      credentials: true,
    },
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  // Middleware xác thực JWT khi connect
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) {
      return next(new Error('Không tìm thấy token'));
    }
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.user = decoded;
      next();
    } catch {
      next(new Error('Token không hợp lệ'));
    }
  });

  io.on('connection', socket => {
    socket.join(`user_${socket.user.id}`);

    socket.on('disconnect', () => {});
  });

  return io;
}

/**
 * Gửi thông báo real-time đến một user cụ thể
 * @param {string} userId - ID của người nhận
 * @param {Object} notification - Dữ liệu thông báo
 */
function emitNotificationToUser(userId, notification) {
  if (!io) return;
  io.to(`user_${userId}`).emit('new_notification', notification);
}

/**
 * Gửi một event bất kỳ đến một user cụ thể
 */
function emitToUser(userId, event, data) {
  if (!io) return;
  io.to(`user_${userId}`).emit(event, data);
}

module.exports = { initSocket, emitNotificationToUser, emitToUser };
