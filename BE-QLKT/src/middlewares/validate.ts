/*
 * ════════════════════════════════════════════════════════════════════════════
 *  VALIDATE MIDDLEWARE — wrap Zod schema thành Express middleware
 * ════════════════════════════════════════════════════════════════════════════
 *
 *  USAGE:
 *      router.post('/x', validate(xValidation.create), xController.create);
 *      router.get('/y', validate(ySchema, 'query'), yController.list);
 *
 *  3 SOURCE có thể validate:
 *  - 'body' (default): req.body (POST/PUT data).
 *  - 'query': req.query (GET filter params).
 *  - 'params': req.params (URL :id, :slug).
 *
 *  SUCCESS PATH: ghi đè req[source] = parsed data (đã strip unknown +
 *  coerce type). Controller dùng req.body với full type safety.
 *
 *  ERROR PATH: trả 400 + message + errors array. Tất cả issue được gộp
 *  để FE hiển thị nhiều lỗi cùng lúc (không fail-fast first error).
 *
 *  ATTT:
 *  - Zod stripUnknown mặc định → field không trong schema bị bỏ (chống
 *    mass assignment).
 *  - Type coercion an toàn: z.number() từ "123" string → 123 number.
 * ════════════════════════════════════════════════════════════════════════════
 */

import { Request, Response, NextFunction, RequestHandler } from 'express';
import { ZodType } from 'zod';

type ValidationSource = 'body' | 'query' | 'params';

/**
 * Creates Zod-based validation middleware for request payloads.
 * @param schema - Zod schema
 * @param source - Request source to validate (body, query, or params)
 * @returns Express request handler
 */
const validate = (schema: ZodType, source: ValidationSource = 'body'): RequestHandler => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req[source]);

    if (!result.success) {
      const messages = result.error.issues.map(issue => issue.message);
      res.status(400).json({
        success: false,
        message: 'Dữ liệu không hợp lệ',
        errors: messages,
      });
      return;
    }

    req[source] = result.data;
    next();
  };
};

export { validate };
