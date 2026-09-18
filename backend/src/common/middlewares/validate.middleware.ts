import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { AppError } from '../utils/AppError';

export type ValidationSource = 'body' | 'query' | 'params';

/**
 * Middleware factory for Zod Schema Validation
 * Validates req[source] against schema, replacing req[source] with parsed result on success
 */
export const validate = (schema: ZodSchema, source: ValidationSource = 'body') => {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsedData = await schema.parseAsync(req[source]);
      req[source] = parsedData;
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const formattedErrors = error.errors.map((err) => ({
          field: err.path.join('.'),
          message: err.message,
        }));
        return next(AppError.badRequest('Validation failed', formattedErrors));
      }
      next(error);
    }
  };
};
