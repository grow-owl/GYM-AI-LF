import { Router } from 'express';
import { AICoachController } from './aiCoach.controller';
import { authenticate } from '../../common/middlewares/auth.middleware';
import { authorize } from '../../common/middlewares/authorize.middleware';
import { validate } from '../../common/middlewares/validate.middleware';
import { aiLimiter } from '../../common/middlewares/rateLimiter.middleware';
import { Role } from '../../common/constants/roles.enum';
import {
  startConversationSchema,
  sendMessageSchema,
  generateReportQuerySchema,
  goalPredictionQuerySchema,
} from './aiCoach.validation';

const router = Router();

router.use(authenticate);
router.use(aiLimiter); // Protect AI routes from abuse

// Member Self & Staff Coaching Endpoints
router.get('/members/:memberId/suggestions', AICoachController.getSuggestions);
router.get('/members/:memberId/diet-recommendation', AICoachController.getDietRecommendation);
router.get(
  '/members/:memberId/reports',
  validate(generateReportQuerySchema, 'query'),
  AICoachController.getReports
);
router.post(
  '/members/:memberId/reports',
  authorize(Role.MEMBER, Role.TRAINER, Role.GYM_OWNER, Role.SUPER_ADMIN),
  validate(generateReportQuerySchema, 'query'),
  AICoachController.generateNewReport
);
router.get(
  '/members/:memberId/goal-prediction',
  validate(goalPredictionQuerySchema, 'query'),
  AICoachController.getGoalPrediction
);
router.get(
  '/members/:memberId/upsell-recommendation',
  authorize(Role.MEMBER, Role.TRAINER, Role.GYM_OWNER, Role.BRANCH_MANAGER, Role.SUPER_ADMIN),
  AICoachController.getUpsellRecommendation
);
router.get(
  '/members/:memberId/recovery-status',
  authorize(Role.MEMBER, Role.TRAINER, Role.GYM_OWNER, Role.BRANCH_MANAGER, Role.SUPER_ADMIN),
  AICoachController.getRecoveryStatus
);

// Chatbot Endpoints (/api/v1/ai/chat/conversations)
router.get(
  '/chat/daily-limit',
  authorize(Role.MEMBER, Role.TRAINER, Role.GYM_OWNER, Role.BRANCH_MANAGER, Role.SUPER_ADMIN),
  AICoachController.getChatDailyLimit
);
router.post(
  '/chat/conversations',
  authorize(Role.MEMBER, Role.TRAINER, Role.GYM_OWNER, Role.BRANCH_MANAGER, Role.SUPER_ADMIN),
  validate(startConversationSchema, 'body'),
  AICoachController.startConversation
);
router.get(
  '/chat/conversations',
  authorize(Role.MEMBER, Role.TRAINER, Role.GYM_OWNER, Role.BRANCH_MANAGER, Role.SUPER_ADMIN),
  AICoachController.listConversations
);
router.post(
  '/chat/conversations/:conversationId/messages',
  authorize(Role.MEMBER, Role.TRAINER, Role.GYM_OWNER, Role.BRANCH_MANAGER, Role.SUPER_ADMIN),
  validate(sendMessageSchema, 'body'),
  AICoachController.sendMessage
);
router.get(
  '/chat/conversations/:conversationId/messages',
  authorize(Role.MEMBER, Role.TRAINER, Role.GYM_OWNER, Role.BRANCH_MANAGER, Role.SUPER_ADMIN),
  AICoachController.getConversationHistory
);
router.patch(
  '/chat/conversations/:conversationId/archive',
  authorize(Role.MEMBER, Role.TRAINER, Role.GYM_OWNER, Role.BRANCH_MANAGER, Role.SUPER_ADMIN),
  AICoachController.archiveConversation
);

// Module 1: Member Churn Prediction
router.get(
  '/gyms/:gymId/at-risk-members',
  authorize(Role.GYM_OWNER, Role.BRANCH_MANAGER, Role.SUPER_ADMIN),
  AICoachController.getAtRiskMembers
);

// AI Owner Insights Extensions (GYM_OWNER / SUPER_ADMIN)
router.get(
  '/gyms/:gymId/insights/trainer-performance',
  authorize(Role.GYM_OWNER, Role.SUPER_ADMIN),
  AICoachController.getTrainerPerformance
);

router.get(
  '/gyms/:gymId/insights/peak-hours',
  authorize(Role.GYM_OWNER, Role.SUPER_ADMIN),
  AICoachController.getPeakHours
);

router.get(
  '/gyms/:gymId/insights/revenue-forecast',
  authorize(Role.GYM_OWNER, Role.SUPER_ADMIN),
  AICoachController.getRevenueForecast
);

router.get(
  '/gyms/:gymId/insights/plan-profitability',
  authorize(Role.GYM_OWNER, Role.SUPER_ADMIN),
  AICoachController.getPlanProfitability
);

router.get(
  '/gyms/:gymId/insights/weekly-digest',
  authorize(Role.GYM_OWNER, Role.SUPER_ADMIN),
  AICoachController.getWeeklyDigest
);

export default router;

