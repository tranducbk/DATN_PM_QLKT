/**
 * Global Error Handler Middleware
 * Pattern: Centralized error handling (Express Error Middleware)
 *
 * Tất cả lỗi không được catch trong controller sẽ được xử lý tại đây.
 * Đảm bảo response format nhất quán và không leak thông tin nhạy cảm.
 */

class AppError extends Error {
  constructor(message, statusCode = 500) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

class NotFoundError extends AppError {
  constructor(resource = 'Tài nguyên') {
    super(`${resource} không tồn tại`, 404);
  }
}

class ForbiddenError extends AppError {
  constructor(message = 'Không có quyền thực hiện hành động này') {
    super(message, 403);
  }
}

class ValidationError extends AppError {
  constructor(message = 'Dữ liệu không hợp lệ') {
    super(message, 400);
  }
}

/**
 * Express Error Handling Middleware
 * Phải có 4 parameters (err, req, res, next) để Express nhận diện là error handler
 */
// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  // Default values
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Lỗi hệ thống';

  // Prisma errors
  if (err.code === 'P2002') {
    statusCode = 409;
    message = 'Dữ liệu đã tồn tại (trùng lặp)';
  } else if (err.code === 'P2025') {
    statusCode = 404;
    message = 'Không tìm thấy bản ghi';
  } else if (err.code === 'P2003') {
    statusCode = 400;
    message = 'Dữ liệu tham chiếu không hợp lệ';
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Token không hợp lệ';
  } else if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Token đã hết hạn';
  }

  // Log error (chỉ log server errors, không log client errors)
  if (statusCode >= 500) {
  }

  return res.status(statusCode).json({
    success: false,
    message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};

/**
 * 404 Not Found Handler
 * Đặt sau tất cả routes để bắt request không match
 */
const notFoundHandler = (req, res) => {
  return res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.path} không tồn tại`,
  });
};

module.exports = {
  AppError,
  NotFoundError,
  ForbiddenError,
  ValidationError,
  errorHandler,
  notFoundHandler,
};
