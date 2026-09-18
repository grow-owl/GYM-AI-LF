import { Router } from 'express';
import { GamificationController } from './gamification.controller';
import { authenticate } from '../../common/middlewares/auth.middleware';
import { authorize } from '../../common/middlewares/authorize.middleware';
import { validate } from '../../common/middlewares/validate.middleware';
import { Role } from '../../common/constants/roles.enum';
import { createChallengeSchema, updateRestDaysSchema } from './gamification.validation';

const gamificationRouter = Router();
const gymChallengeRouter = Router({ mergeParams: true });

// Gamification Profile & Leaderboard (/api/v1/gamification/...)
gamificationRouter.use(authenticate);
gamificationRouter.get('/me', GamificationController.getMyProfile);
gamificationRouter.get('/leaderboard', GamificationController.getLeaderboard);

// Update rest days — MEMBER only
gamificationRouter.put(
  '/me/rest-days',
  authorize(Role.MEMBER),
  validate(updateRestDaysSchema, 'body'),
  GamificationController.updateRestDays
);

// Challenges Endpoints (/api/v1/gamification/challenges)
gamificationRouter.get('/challenges', GamificationController.listChallenges);
gamificationRouter.post(
  '/challenges/:challengeId/join',
  authorize(Role.MEMBER),
  GamificationController.joinChallenge
);

// Staff Challenge Authoring & Listing (/api/v1/gyms/:gymId/challenges)
gymChallengeRouter.use(authenticate);
gymChallengeRouter.get(
  '/:gymId/challenges',
  authorize(Role.MEMBER, Role.TRAINER, Role.GYM_OWNER, Role.BRANCH_MANAGER, Role.SUPER_ADMIN),
  GamificationController.listChallenges
);
gymChallengeRouter.get(
  '/',
  authorize(Role.MEMBER, Role.TRAINER, Role.GYM_OWNER, Role.BRANCH_MANAGER, Role.SUPER_ADMIN),
  GamificationController.listChallenges
);
gymChallengeRouter.post(
  '/:gymId/challenges',
  authorize(Role.GYM_OWNER, Role.BRANCH_MANAGER, Role.SUPER_ADMIN),
  validate(createChallengeSchema, 'body'),
  GamificationController.createChallenge
);

export { gamificationRouter, gymChallengeRouter };
