import rateLimit, { RateLimitRequestHandler } from 'express-rate-limit';
import { env } from '../../config/env';
import { ApiResponse } from '../utils/ApiResponse';
import { ErrorCode } from '../constants/errorCodes.enum';

/**
 * Generic Rate Limiter Factory
 * @param windowMs Time window in milliseconds
 * @param max Maximum requests allowed per IP in the time window
 * @param customMessage Custom error message when limit is exceeded
 * @param skipInDev If true, bypasses rate limiting during local development (NODE_ENV=development)
 */
export const createRateLimiter = (
  windowMs: number,
  max: number,
  customMessage: string = 'Too many requests, please try again later.',
  skipInDev: boolean = true
): RateLimitRequestHandler => {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => {
      // If explicitly enabled for testing, enforce rate limits even in development
      if (env.ENABLE_RATE_LIMIT_IN_DEV) {
        return false;
      }
      // Avoid locking out developers during development / local testing
      if (skipInDev && env.NODE_ENV === 'development') {
        return true;
      }
      return false;
    },
    handler: (_req, res) => {
      return ApiResponse.error(res, ErrorCode.RATE_LIMITED, customMessage, 429);
    },
  });
};

/**
 * Global default API Rate Limiter
 * Allows up to 300 requests per 15 mins in production for authenticated APIs
 * so that SPA navigation and component refreshes never falsely lock out users.
 */
export const defaultRateLimiter = createRateLimiter(
  env.RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000,
  env.RATE_LIMIT_MAX || 300,
  'Too many requests from this IP, please try again later.',
  true
);

/**
 * Strict Rate Limiter for Authentication endpoints (login, register, forgot-password, reset-password)
 * Allows up to 15 authentication attempts per 15 minutes in production to prevent brute-force attacks.
 */
export const authLimiter = createRateLimiter(
  15 * 60 * 1000, // 15 minutes
  env.RATE_LIMIT_AUTH_MAX || 15,
  'Too many authentication requests, please try again after 15 minutes.',
  true
);

/**
 * Rate Limiter for Public endpoints (landing page inquiries, public leads)
 * Allows up to 30 requests per 15 minutes in production to prevent automated spam and scraping.
 */
export const publicLimiter = createRateLimiter(
  15 * 60 * 1000, // 15 minutes
  env.RATE_LIMIT_PUBLIC_MAX || 30,
  'Too many public requests from this IP, please try again later.',
  true
);

/**
 * Dedicated Rate Limiter for AI endpoints
 * Allows up to 60 AI requests per minute in production.
 */
export const aiLimiter = createRateLimiter(
  60 * 1000, // 1 minute
  60, // 60 requests per minute
  'AI quota rate limit reached, please slow down your requests.',
  true
);

