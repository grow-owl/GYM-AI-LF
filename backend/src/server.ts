import { Server } from 'http';
import app from './app';
import { env } from './config/env';
import { connectDB, disconnectDB } from './config/database';
import { initCronJobs } from './jobs';
import { logger } from './config/logger';

let server: Server | undefined;

const startServer = async () => {
  try {
    // 1. Connect to Database with Retry Logic
    await connectDB();

    // 2. Initialize Cron Schedulers
    initCronJobs();

    // 3. Start Express HTTP Server (Tiered Rate Limiting active)
    server = app.listen(env.PORT, () => {
      logger.info(
        `🚀 Server running in [${env.NODE_ENV}] mode on http://localhost:${env.PORT}`
      );
    });
  } catch (error) {
    logger.error(`Fatal Startup Error: ${error}`);
    process.exit(1);
  }
};

// Global Handler: Uncaught Exception
process.on('uncaughtException', (err: Error) => {
  logger.error(`UNCAUGHT EXCEPTION! 💥 ${err.name}: ${err.message}`);
  logger.error(err.stack);
  process.exit(1);
});

// Global Handler: Unhandled Rejection
process.on('unhandledRejection', (reason: unknown) => {
  logger.error(`UNHANDLED REJECTION! 💥 Reason: ${reason}`);
  if (server) {
    server.close(() => {
      process.exit(1);
    });
  } else {
    process.exit(1);
  }
});

// Graceful Shutdown Signals
const handleShutdown = (signal: string) => {
  logger.info(`Received ${signal}. Closing server gracefully...`);
  if (server) {
    server.close(async () => {
      logger.info('HTTP server closed.');
      await disconnectDB();
      process.exit(0);
    });
  } else {
    process.exit(0);
  }
};

process.on('SIGTERM', () => handleShutdown('SIGTERM'));
process.on('SIGINT', () => handleShutdown('SIGINT'));

startServer();
