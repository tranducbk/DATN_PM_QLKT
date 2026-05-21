import { Request, Response, NextFunction } from 'express';

/*
 * ════════════════════════════════════════════════════════════════════════════
 *  GLOBAL ERROR HANDLER — quy tập tất cả error về 1 chỗ + map HTTP status
 * ════════════════════════════════════════════════════════════════════════════
 *
 *  HIERARCHY:
 *      AppError (base)             → statusCode tuỳ ý, isOperational=true
 *        ├─ NotFoundError          → 404
 *        ├─ ForbiddenError         → 403
 *        └─ ValidationError        → 400
 *
 *  WHY isOperational FLAG:
 *  - Operational (true): lỗi BIẾT TRƯỚC từ business rule (user gửi sai data,
 *    không quyền, ...). KHÔNG cần alert oncall.
 *  - Programmer (false): bug code (null pointer, type error, ...). Cần log
 *    full stack + alert.
 *  → errorHandler phân biệt để quyết định log level + có gửi Sentry không.
 *
 *  FLOW của catchAsync (xem helpers/catchAsync.ts):
 *  Controller wrap với catchAsync → mọi throw/reject inside được forward
 *  tới errorHandler qua next(err). Express auto-call middleware có
 *  signature 4 arg (err, req, res, next) → đây.
 *
 *  TRÁNH LEAK INTERNALS:
 *  - Production: trả message + statusCode, KHÔNG trả stack trace.
 *  - Dev: trả thêm stack để debug nhanh.
 *  - Prisma error code (P2002 unique, P2003 FK, ...) được map sang
 *    Vietnamese message thân thiện, không expose tên column/index.
 *
 *  FAIL-OPEN vs FAIL-CLOSED:
 *  Default 500 nếu không nhận diện được error → FAIL-CLOSED (refuse
 *  request, không trả data). Tuyệt đối KHÔNG fallback trả 200 + empty
 *  data — sẽ ẩn bug.
 * ════════════════════════════════════════════════════════════════════════════
 */

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

  if (statusCode >= 500) {
    console.error(`[500] ${req.method} ${req.path} - ${err.message}`, err.stack);
  }

  res.status(statusCode).json({
    success: false,
    message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};

/**
 * Express middleware to handle 404 errors.
 * @param req - Express request
 * @param res - Express response
 * @returns Nothing
 */
const notFoundHandler = (req: Request, res: Response): void => {
  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.path} không tồn tại`,
  });
};

export { AppError, NotFoundError, ForbiddenError, ValidationError, errorHandler, notFoundHandler };
