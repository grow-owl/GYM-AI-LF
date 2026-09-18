import { PaginationMeta } from './ApiResponse';

export interface PaginationOptions {
  page?: number | string;
  limit?: number | string;
  maxLimit?: number;
}

export interface ParsedPagination {
  page: number;
  limit: number;
  skip: number;
}

/**
 * Parse page and limit query parameters into Mongoose skip & limit values
 * Defaults: page=1, limit=20, maxLimit=100
 */
export const getPaginationParams = (options: PaginationOptions): ParsedPagination => {
  const maxLimit = options.maxLimit || 100;
  const rawPage = typeof options.page === 'string' ? parseInt(options.page, 10) : options.page;
  const rawLimit = typeof options.limit === 'string' ? parseInt(options.limit, 10) : options.limit;

  const page = Math.max(1, rawPage || 1);
  let limit = Math.max(1, rawLimit || 20);
  if (limit > maxLimit) {
    limit = maxLimit;
  }

  const skip = (page - 1) * limit;

  return { page, limit, skip };
};

/**
 * Construct PaginationMeta object for API Envelope
 */
export const buildPaginationMeta = (
  totalItems: number,
  page: number,
  limit: number
): PaginationMeta => {
  const totalPages = Math.ceil(totalItems / limit) || 1;
  const hasNextPage = page < totalPages;
  const hasPrevPage = page > 1;

  return {
    page,
    limit,
    totalItems,
    totalPages,
    hasNextPage,
    hasPrevPage,
  };
};
