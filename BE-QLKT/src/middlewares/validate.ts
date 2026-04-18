import { Request, Response, NextFunction, RequestHandler } from 'express';
import Joi from 'joi';

type ValidationSource = 'body' | 'query' | 'params';

/**
 * Creates Joi-based validation middleware for request payloads.
 * @param schema - Joi object schema
 * @param source - Request source to validate (body, query, or params)
 * @returns Express request handler
 */
const validate = (schema: Joi.ObjectSchema, source: ValidationSource = 'body'): RequestHandler => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const { error, value } = schema.validate(req[source], {
      abortEarly: false,
      stripUnknown: true,
      convert: true,
    });

    if (error) {
      const messages = error.details.map(detail => detail.message);
      res.status(400).json({
        success: false,
        message: 'Dữ liệu không hợp lệ',
        errors: messages,
      });
      return;
    }

    req[source] = value;
    next();
  };
};

export { validate };
