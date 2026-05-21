import { Request, Response, NextFunction } from 'express';

/*
 * ════════════════════════════════════════════════════════════════════════════
 *  catchAsync — wrapper forward async error đến Express errorHandler
 * ════════════════════════════════════════════════════════════════════════════
 *
 *  VẤN ĐỀ:
 *  Express 4.x KHÔNG tự catch promise rejection trong route handler:
 *      router.get('/', async (req, res) => {
 *        throw new Error('boom');  // ← unhandled rejection, server hang
 *      });
 *
 *  GIẢI PHÁP:
 *  Wrap mỗi handler bằng catchAsync → reject sẽ forward qua next(err)
 *  → trigger global errorHandler middleware:
 *      router.get('/', catchAsync(async (req, res) => {
 *        throw new Error('boom');  // ← bắt được, trả 500 JSON đúng format
 *      }));
 *
 *  EQUIVALENT VANILLA:
 *      try { await fn(req, res, next); } catch (err) { next(err); }
 *  → catchAsync rút gọn về 1 line, áp dụng cho mọi controller.
 *
 *  EXPRESS 5 PROMISE:
 *  Express 5 (đang ở alpha) sẽ tự handle promise → helper này thành
 *  redundant. Hiện tại Express 4 → vẫn cần.
 *
 *  WHY KHÔNG dùng express-async-errors lib:
 *  - Lib patch global Express → khó debug.
 *  - 1 file 5 dòng quá đơn giản, không cần dependency.
 *
 *  PATTERN ÁP DỤNG TOÀN APP:
 *  Mỗi method trong controller đều wrap:
 *      method = catchAsync(async (req, res) => { ... });
 *  → Đảm bảo nhất quán + không quên try/catch.
 * ════════════════════════════════════════════════════════════════════════════
 */

type AsyncHandler = (req: Request, res: Response, next: NextFunction) => Promise<Response | void>;

export default function catchAsync(fn: AsyncHandler): AsyncHandler {
  return (req, res, next) => fn(req, res, next).catch(next);
}
