import winston from 'winston';
import { env } from './env';

const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

const level = () => {
  return env.NODE_ENV === 'development' ? 'debug' : 'info';
};

// Console format for development (pretty & colorized)
const devConsoleFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.colorize({ all: true }),
  winston.format.printf((info) => {
    const reqId = info.requestId ? ` [ReqID: ${info.requestId}]` : '';
    return `[${info.timestamp}] [${info.level}]${reqId}: ${info.message}`;
  })
);

// Production format (structured JSON)
const prodFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

const transports: winston.transport[] = [
  new winston.transports.Console({
    format: env.NODE_ENV === 'development' ? devConsoleFormat : prodFormat,
  }),
];

if (env.NODE_ENV === 'production') {
  transports.push(
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      format: prodFormat,
    }),
    new winston.transports.File({
      filename: 'logs/combined.log',
      format: prodFormat,
    })
  );
}

export const logger = winston.createLogger({
  level: level(),
  levels,
  transports,
});

/**
 * Helper to log with request context correlation ID
 */
export const logWithRequest = (
  reqId: string,
  logLevel: string,
  message: string,
  meta?: Record<string, unknown>
) => {
  logger.log(logLevel, message, { requestId: reqId, ...meta });
};
