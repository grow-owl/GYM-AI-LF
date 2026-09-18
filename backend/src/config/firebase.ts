import * as admin from 'firebase-admin';
import { env } from './env';
import { logger } from './logger';

let firebaseMessaging: admin.messaging.Messaging | null = null;

try {
  if (env.FIREBASE_PROJECT_ID && env.FIREBASE_CLIENT_EMAIL && env.FIREBASE_PRIVATE_KEY) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: env.FIREBASE_PROJECT_ID,
        clientEmail: env.FIREBASE_CLIENT_EMAIL,
        privateKey: env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      }),
    });
    firebaseMessaging = admin.messaging();
    logger.info('🔥 Firebase Admin SDK initialized successfully');
  } else {
    logger.info('ℹ️ Firebase Admin env variables missing — running in mock push notification mode');
  }
} catch (error) {
  logger.warn(`⚠️ Firebase Admin initialization warning: ${error}. Running in degraded mock push mode.`);
}

export { firebaseMessaging };
