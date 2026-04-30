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
