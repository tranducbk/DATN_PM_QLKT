import { Request, Response, NextFunction, RequestHandler } from 'express';
import Joi from 'joi';

type ValidationSource = 'body' | 'query' | 'params';

const validate = (schema: Joi.ObjectSchema, source: ValidationSource = 'body'): RequestHandler => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const { error, value } = schema.validate(req[source], {
      abortEarly: false,
      stripUnknown: true,
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
