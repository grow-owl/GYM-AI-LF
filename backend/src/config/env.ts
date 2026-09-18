import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().default('5000').transform((val) => parseInt(val, 10)),
  MONGO_URI: z.string().min(1, 'MONGO_URI is required'),

  JWT_ACCESS_SECRET: z.string().min(1, 'JWT_ACCESS_SECRET is required'),
  JWT_REFRESH_SECRET: z.string().min(1, 'JWT_REFRESH_SECRET is required'),
  JWT_QR_SECRET: z.string().default('gymai-qr-secret-key-38d7a12903'),
  JWT_ACCESS_EXPIRY: z.string().default('15m'),
  JWT_REFRESH_EXPIRY: z.string().default('7d'),

  SALT_ROUNDS: z.string().default('10').transform((val) => parseInt(val, 10)),
  RATE_LIMIT_WINDOW_MS: z.string().default('900000').transform((val) => parseInt(val, 10)),
  RATE_LIMIT_MAX: z.string().default('300').transform((val) => parseInt(val, 10)),
  RATE_LIMIT_AUTH_MAX: z.string().default('15').transform((val) => parseInt(val, 10)),
  RATE_LIMIT_PUBLIC_MAX: z.string().default('30').transform((val) => parseInt(val, 10)),
  ENABLE_RATE_LIMIT_IN_DEV: z.string().default('false').transform((val) => val === 'true'),

  CLOUDINARY_CLOUD_NAME: z.string().optional(),
  CLOUDINARY_API_KEY: z.string().optional(),
  CLOUDINARY_API_SECRET: z.string().optional(),

  FIREBASE_PROJECT_ID: z.string().optional(),
  FIREBASE_CLIENT_EMAIL: z.string().optional(),
  FIREBASE_PRIVATE_KEY: z.string().optional(),

  CLIENT_URL: z.string().optional(),

  // Secret code that must be supplied to self-register a GYM_OWNER account.
  // Only people who know this code (i.e. you) can create an owner account —
  // this is the real lock on "who can become an owner", not the URL itself.
  OWNER_INVITE_CODE: z.string().optional(),

  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().default('gpt-4o-mini'),
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_MODEL: z.string().default('gemini-3.5-flash-lite'),
  AI_DAILY_USER_MESSAGE_LIMIT: z.string().default('5').transform((val) => parseInt(val, 10)),
});

const _env = envSchema.safeParse(process.env);

if (!_env.success) {
  console.error('❌ Invalid Environment Variables:', _env.error.format());
  throw new Error('Invalid Environment Variables');
}

export const env = _env.data;
