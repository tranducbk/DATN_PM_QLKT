import { Request, Response, NextFunction } from 'express';

type AsyncHandler = (req: Request, res: Response, next: NextFunction) => Promise<Response | void>;

/** Bọc async controller method — lỗi tự động forward đến global errorHandler */
export default function catchAsync(fn: AsyncHandler): AsyncHandler {
  return (req, res, next) => fn(req, res, next).catch(next);
}
