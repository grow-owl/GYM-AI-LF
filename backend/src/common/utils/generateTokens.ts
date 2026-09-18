import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { env } from '../../config/env';

export interface TokenPayload {
  id: string;
  role: string;
  gymId?: string;
  branchId?: string;
  [key: string]: unknown;
}

export interface GeneratedTokens {
  accessToken: string;
  refreshToken: string;
}

/**
 * Generate JWT Access Token
 */
export const generateAccessToken = (payload: TokenPayload): string => {
  return jwt.sign({ ...payload, jti: uuidv4() }, env.JWT_ACCESS_SECRET, {
    expiresIn: env.JWT_ACCESS_EXPIRY as jwt.SignOptions['expiresIn'],
  });
};

/**
 * Generate JWT Refresh Token
 */
export const generateRefreshToken = (payload: TokenPayload): string => {
  return jwt.sign({ ...payload, jti: uuidv4() }, env.JWT_REFRESH_SECRET, {
    expiresIn: env.JWT_REFRESH_EXPIRY as jwt.SignOptions['expiresIn'],
  });
};

/**
 * Generate both Access and Refresh tokens with unique jti claims
 */
export const generateTokens = (payload: TokenPayload): GeneratedTokens => {
  return {
    accessToken: generateAccessToken(payload),
    refreshToken: generateRefreshToken(payload),
  };
};

/**
 * Verify JWT Access Token
 */
export const verifyAccessToken = (token: string): TokenPayload => {
  return jwt.verify(token, env.JWT_ACCESS_SECRET) as TokenPayload;
};

/**
 * Verify JWT Refresh Token
 */
export const verifyRefreshToken = (token: string): TokenPayload => {
  return jwt.verify(token, env.JWT_REFRESH_SECRET) as TokenPayload;
};
