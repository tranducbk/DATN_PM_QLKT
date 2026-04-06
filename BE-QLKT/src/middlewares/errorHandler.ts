import { Request, Response, NextFunction } from 'express';

/**
 * Base application error with HTTP status support.
 */
class AppError extends Error {
  statusCode: number;
  isOperational: boolean;

  constructor(message: string, statusCode: number = 500) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Error thrown when a resource is not found.
 */
class NotFoundError extends AppError {
  constructor(resource: string = 'Tài nguyên') {
    super(`${resource} không tồn tại`, 404);
  }
}

/**
 * Error thrown for forbidden operations.
 */
class ForbiddenError extends AppError {
  constructor(message: string = 'Không có quyền thực hiện hành động này') {
    super(message, 403);
  }
}

/**
 * Error thrown for invalid input payloads.
 */
class ValidationError extends AppError {
  constructor(message: string = 'Dữ liệu không hợp lệ') {
    super(message, 400);
  }
}

interface ErrorWithExtras extends Error {
  statusCode?: number;
  code?: string;
  isOperational?: boolean;
}

/**
 * Global Express error handler.
 * @param err - Error object or error-like payload
 * @param req - Express request
 * @param res - Express response
 * @param next - Express next function
 * @returns Nothing
 */
const errorHandler = (
  err: ErrorWithExtras,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
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

  // Log errors only for server-side failures.
  if (statusCode >= 500) {
    // intentionally left for future logging
  }

  res.status(statusCode).json({
    success: false,
    message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};

const notFoundHandler = (req: Request, res: Response): void => {
  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.path} không tồn tại`,
  });
};

export { AppError, NotFoundError, ForbiddenError, ValidationError, errorHandler, notFoundHandler };
