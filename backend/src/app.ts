import express, { Express, Request, Response } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import mongoSanitize from 'express-mongo-sanitize';
import { requestId } from './common/middlewares/requestId.middleware';
import { defaultRateLimiter, authLimiter, publicLimiter, aiLimiter } from './common/middlewares/rateLimiter.middleware';
import { errorHandler } from './common/middlewares/error.middleware';
import { sendSuccess } from './common/utils/ApiResponse';
import { AppError } from './common/utils/AppError';
import { logger } from './config/logger';
import { env } from './config/env';
import authRoutes from './modules/auth/auth.routes';
import gymRoutes from './modules/gym/gym.routes';
import { gymMemberRouter, selfMemberRouter } from './modules/member/member.routes';
import trainerRouter from './modules/trainer/trainer.routes';
import { attendanceRouter, branchAttendanceRouter } from './modules/attendance/attendance.routes';
import exerciseRouter from './modules/workout/exercise.routes';
import { memberPlanRouter, generalPlanRouter } from './modules/workout/workoutPlan.routes';
import { workoutLogRouter, memberLogRouter } from './modules/workout/workoutLog.routes';
import { memberDietRouter, dietPlanRouter } from './modules/dietPlan/dietPlan.routes';
import progressRouter from './modules/progress/progress.routes';
import { gamificationRouter, gymChallengeRouter } from './modules/gamification/gamification.routes';
import platformBillingRouter from './modules/payment/platformBilling.routes';
import { gymMemberPaymentRouter } from './modules/payment/memberPayment.routes';
import aiCoachRouter from './modules/aiCoach/aiCoach.routes';
import { notificationRouter, gymBroadcastRouter } from './modules/notification/notification.routes';
import reportRouter from './modules/report/report.routes';
import { memberFeedbackRouter, generalFeedbackRouter } from './modules/feedback/feedback.routes';
import equipmentRouter from './modules/equipment/equipment.routes';
import expenseRouter from './modules/expense/expense.routes';
import productRouter from './modules/product/product.routes';
import privacyRouter from './modules/user/privacy.routes';
import jobRoutes from './jobs/job.routes';
import { publicSaasInquiryRouter, adminSaasInquiryRouter } from './modules/saasInquiry/saasInquiry.routes';

const app: Express = express();

// Trust reverse proxy headers (e.g. Nginx, Cloudflare, Heroku, Vercel)
app.set('trust proxy', 1);

// 1. Request ID correlation middleware
app.use(requestId);

// 2. Security HTTP headers
app.use(helmet());

// 3. CORS configuration
// NOTE: with credentials:true, the browser REQUIRES a specific echoed origin —
// a literal '*' silently breaks cookies (refresh-token) on every cross-origin
// deployment. CLIENT_URL supports a comma-separated list for multiple environments.
const allowedOrigins = (env.CLIENT_URL || 'http://localhost:5173')
  .split(',')
  .map((o) => o.trim().replace(/\/+$/, ''))
  .filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      // No Origin header (server-to-server, curl, mobile apps) — allow.
      if (!origin) return callback(null, true);
      const normalizedOrigin = origin.trim().replace(/\/+$/, '');
      if (allowedOrigins.includes(normalizedOrigin)) return callback(null, true);
      logger.warn(`🚫 CORS blocked request from origin: ${origin}`);
      return callback(null, false);
    },
    credentials: true,
  })
);

// 4. Response Compression
app.use(compression());

// 5. Body Parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 6. Cookie Parser
app.use(cookieParser());

// 7. Data Sanitization against NoSQL injection
app.use(mongoSanitize());

// 8. HTTP Request Logging
if (env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(
    morgan('combined', {
      stream: {
        write: (message: string) => logger.info(message.trim()),
      },
    })
  );
}

app.get('/', (_req, res) => {
  res.status(200).json({ status: 'ok', message: 'GYM AI Backend is running' });
});

// 9. Tiered Rate Limiting for API routes
// - Auth routes: strict limit (15 req/15min) against brute-force attacks
// - Public landing/lead forms: anti-spam / anti-scraping limit (30 req/15min)
// - AI endpoints: quota protection (60 req/min)
// - Authenticated APIs: general rate limiter (300 req/15min)
app.use('/api/v1/auth', authLimiter);
app.use('/api/v1/public', publicLimiter);
app.use('/api/v1/ai', aiLimiter);
app.use('/api', defaultRateLimiter);

// Health Check Endpoint (Unauthenticated)
app.get('/health', (req: Request, res: Response) => {
  return sendSuccess(
    res,
    {
      status: 'ok',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      requestId: req.id,
    },
    'Gym SaaS Backend API is running cleanly'
  );
});

// 10. Module Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/public/saas-inquiry', publicSaasInquiryRouter);
app.use('/api/v1/admin/saas-inquiries', adminSaasInquiryRouter);
app.use('/api/v1/gyms', gymRoutes);
app.use('/api/v1/gyms', jobRoutes);
app.use('/api/v1/gyms', gymMemberRouter);
app.use('/api/v1/gyms', trainerRouter);
app.use('/api/v1/gyms', branchAttendanceRouter);
app.use('/api/v1/gyms', gymChallengeRouter);
app.use('/api/v1/gyms/:gymId/payments', gymMemberPaymentRouter);
app.use('/api/v1/gyms/:gymId/notifications', gymBroadcastRouter);
app.use('/api/v1/members', selfMemberRouter);
app.use('/api/v1/members/:memberId/workout-plans', memberPlanRouter);
app.use('/api/v1/members/:memberId/diet-plans', memberDietRouter);
app.use('/api/v1/members/:memberId', memberLogRouter);
app.use('/api/v1/attendance', attendanceRouter);
app.use('/api/v1/exercises', exerciseRouter);
app.use('/api/v1/workout-plans', generalPlanRouter);
app.use('/api/v1/workout-logs', workoutLogRouter);
app.use('/api/v1/diet-plans', dietPlanRouter);
app.use('/api/v1/progress', progressRouter);
app.use('/api/v1/gamification', gamificationRouter);
app.use('/api/v1/billing/platform', platformBillingRouter);
app.use('/api/v1/ai', aiCoachRouter);
app.use('/api/v1/notifications', notificationRouter);
app.use('/api/v1/gyms', reportRouter);
app.use('/api/v1/members/:memberId/feedback', memberFeedbackRouter);
app.use('/api/v1/feedback', generalFeedbackRouter);
app.use('/api/v1', equipmentRouter);
app.use('/api/v1', expenseRouter);
app.use('/api/v1', productRouter);
app.use('/api/v1/users', privacyRouter);

// Root API v1 Route Mount Placeholder
app.get('/api/v1', (req: Request, res: Response) => {
  return sendSuccess(res, { version: '1.0.0', requestId: req.id }, 'Welcome to AI Powered Gym SaaS API');
});

// Handle Unhandled Routes (404)
app.all('*', (req: Request, _res: Response, next) => {
  next(AppError.notFound(`Cannot find route ${req.originalUrl} on this server`));
});

// 11. Centralized Error Handling Middleware (MUST BE LAST)
app.use(errorHandler);

export default app;
