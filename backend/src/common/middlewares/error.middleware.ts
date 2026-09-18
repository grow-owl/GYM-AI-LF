import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/AppError';
import { ApiResponse } from '../utils/ApiResponse';
import { ErrorCode } from '../constants/errorCodes.enum';
import { logger } from '../../config/logger';
import { env } from '../../config/env';

export const errorHandler = (
  err: Error | AppError,
  req: Request,
  res: Response,
  _next: NextFunction
): Response => {
  let statusCode = 500;
  let errorCode: string = ErrorCode.INTERNAL_ERROR;
  let message = 'An unexpected error occurred';
  let details: unknown = undefined;

  if (err instanceof AppError) {
    statusCode = err.statusCode;
    errorCode = err.errorCode;
    message = err.message;
    details = err.details;
  } else if (err.name === 'ValidationError') {
    // Mongoose validation error
    statusCode = 400;
    errorCode = ErrorCode.VALIDATION_ERROR;
    message = err.message;
  } else if (err.name === 'CastError') {
    // Mongoose invalid ObjectId error
    statusCode = 400;
    errorCode = ErrorCode.BAD_REQUEST;
    message = 'Invalid ID format';
  } else if ((err as Error & { code?: number }).code === 11000) {
    // Mongoose duplicate key error
    statusCode = 409;
    errorCode = ErrorCode.DUPLICATE_RESOURCE;
    message = 'Duplicate field value entered';
  }

  // Log non-operational or internal server errors with request correlation ID
  const reqIdStr = req.id ? ` [ReqID: ${req.id}]` : '';
  if (statusCode >= 500) {
    logger.error(`[${req.method}] ${req.path}${reqIdStr} - Server Error: ${err.message}`, {
      stack: err.stack,
    });
  } else {
    logger.warn(`[${req.method}] ${req.path}${reqIdStr} - Client Error: ${message}`);
  }

  // Hide internal error details in production
  if (env.NODE_ENV === 'production' && statusCode === 500) {
    message = 'Internal server error';
    details = undefined;
  }

  return ApiResponse.error(res, errorCode, message, statusCode, details);
};
