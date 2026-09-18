import { Response } from 'express';

export interface PaginationMeta {
  page: number;
  limit: number;
  totalItems: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export interface ApiMeta {
  pagination?: PaginationMeta;
  [key: string]: unknown;
}

/**
 * Send success response with consistent envelope
 */
export const sendSuccess = <T>(
  res: Response,
  data: T,
  message?: string,
  statusCode: number = 200,
  meta?: ApiMeta
): Response => {
  return res.status(statusCode).json({
    success: true,
    data,
    ...(message && { message }),
    ...(meta && { meta }),
  });
};

/**
 * Helper class wrapper for API Responses
 */
export class ApiResponse {
  public static success = sendSuccess;

  public static error(
    res: Response,
    code: string,
    message: string,
    statusCode: number = 500,
    details?: unknown
  ): Response {
    return res.status(statusCode).json({
      success: false,
      error: {
        code,
        message,
        ...(details !== undefined && { details }),
      },
    });
  }
}
