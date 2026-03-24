import { Request, Response, NextFunction } from 'express';

/**
 * Bọc controller method để tự động bắt lỗi và trả về response chuẩn.
 * Loại bỏ try-catch duplicate trong mọi controller.
 *
 * Usage:
 *   router.get('/items', catchAsync(async (req, res) => {
 *     const items = await service.getAll();
 *     return ResponseHelper.success(res, { data: items });
 *   }));
 *
 *   // Hoặc trong class controller:
 *   class MyController {
 *     getAll = catchAsync(async (req, res) => { ... });
 *   }
 */
type AsyncHandler = (req: Request, res: Response, next: NextFunction) => Promise<Response | void>;

const catchAsync = (fn: AsyncHandler): AsyncHandler => {
  return (req, res, next) => {
    return fn(req, res, next).catch((error: unknown) => {
      const err = error as { statusCode?: number; message?: string };
      const statusCode = err.statusCode ?? 500;
      return res.status(statusCode).json({
        success: false,
        message: err.message ?? 'Lỗi hệ thống',
      });
    });
  };
};

export default catchAsync;
