import { ErrorCode } from '../constants/errorCodes.enum';

/**
 * Custom Operational Application Error Class
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly errorCode: string;
  public readonly isOperational: boolean;
  public readonly details?: unknown;

  constructor(
    message: string,
    statusCode: number = 500,
    errorCode: string = ErrorCode.INTERNAL_ERROR,
    isOperational: boolean = true,
    details?: unknown
  ) {
    super(message);
    Object.setPrototypeOf(this, new.target.prototype);

    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.isOperational = isOperational;
    this.details = details;

    Error.captureStackTrace(this, this.constructor);
  }

  public static badRequest(msg: string, details?: unknown): AppError {
    return new AppError(msg, 400, ErrorCode.VALIDATION_ERROR, true, details);
  }

  public static unauthorized(msg: string = 'Unauthorized access'): AppError {
    return new AppError(msg, 401, ErrorCode.AUTH_INVALID_CREDENTIALS, true);
  }

  public static forbidden(msg: string = 'Forbidden access'): AppError {
    return new AppError(msg, 403, ErrorCode.TENANT_MISMATCH, true);
  }

  public static notFound(msg: string = 'Resource not found'): AppError {
    return new AppError(msg, 404, ErrorCode.RESOURCE_NOT_FOUND, true);
  }

  public static conflict(msg: string, details?: unknown): AppError {
    return new AppError(msg, 409, ErrorCode.DUPLICATE_RESOURCE, true, details);
  }
}
