import mongoose from 'mongoose';
import { env } from './env';
import { logger } from './logger';

/**
 * Mongoose Database Connection Manager
 * Includes retry-with-backoff on initial connection and graceful shutdown handlers.
 */
export const connectDB = async (retryCount = 0): Promise<void> => {
  const maxRetries = 5;
  const backoffMs = Math.min(1000 * Math.pow(2, retryCount), 10000);

  try {
    mongoose.set('strictQuery', true);

    // Event Listeners
    mongoose.connection.on('connected', () => {
      logger.info('🍃 MongoDB connection established successfully');
    });

    mongoose.connection.on('error', (err) => {
      logger.error(`🍃 MongoDB Connection Error: ${err}`);
    });

    mongoose.connection.on('disconnected', () => {
      logger.warn('🍃 MongoDB connection lost/disconnected');
    });

    await mongoose.connect(env.MONGO_URI, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      autoIndex: env.NODE_ENV !== 'production',
    });

    logger.info(`🍃 MongoDB Connected: ${mongoose.connection.host}/${mongoose.connection.name}`);
  } catch (error) {
    logger.error(`Failed to connect to MongoDB (Attempt ${retryCount + 1}/${maxRetries}): ${error}`);

    if (retryCount < maxRetries - 1) {
      logger.info(`Retrying MongoDB connection in ${backoffMs / 1000}s...`);
      await new Promise((resolve) => setTimeout(resolve, backoffMs));
      return connectDB(retryCount + 1);
    }

    logger.error('❌ Maximum MongoDB connection retries reached. Failing boot process...');
    process.exit(1);
  }
};

/**
 * Gracefully close MongoDB Connection
 */
export const disconnectDB = async (): Promise<void> => {
  try {
    await mongoose.disconnect();
    logger.info('🍃 MongoDB connection closed cleanly');
  } catch (error) {
    logger.error(`Error disconnecting MongoDB: ${error}`);
  }
};
