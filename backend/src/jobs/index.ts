import cron from 'node-cron';
import { MembershipReminderJob } from './membershipReminder.job';
import { BirthdayReminderJob } from './birthdayReminder.job';
import { ChurnPredictionService } from '../modules/aiCoach/churnPrediction.service';
import { Gym } from '../modules/gym/gym.model';
import { GymStatus } from '../modules/gym/gym.types';
import { GymService } from '../modules/gym/gym.service';
import { MemberService } from '../modules/member/member.service';
import { logger } from '../config/logger';

export function initCronJobs(): void {
  logger.info('⏰ Initializing automated cron job schedulers...');

  // 1. Membership & Renewal Reminders — Runs daily at 9:00 AM
  cron.schedule('0 9 * * *', async () => {
    logger.info('⏰ Executing daily automated membership reminder cron job...');
    try {
      await MembershipReminderJob.runReminders();
    } catch (error) {
      logger.error(`❌ Membership reminder cron job failed: ${error}`);
    }
  });

  // 2. Birthday Wishes — Runs daily at 9:15 AM
  cron.schedule('15 9 * * *', async () => {
    logger.info('🎉 Executing daily birthday wishes cron job...');
    try {
      await BirthdayReminderJob.runBirthdayWishes();
    } catch (error) {
      logger.error(`❌ Birthday wishes cron job failed: ${error}`);
    }
  });

  // 3. Member Churn Risk Assessment — Runs daily at 9:30 AM
  cron.schedule('30 9 * * *', async () => {
    logger.info('📊 Executing daily member churn risk assessment cron job...');
    try {
      const activeGyms = await Gym.find({ status: GymStatus.ACTIVE, isDeleted: false }).select('_id');
      for (const gym of activeGyms) {
        try {
          await ChurnPredictionService.assessAllActiveMembersChurnRisk(gym._id.toString());
        } catch (err) {
          logger.error(`❌ Churn risk assessment failed for gym [${gym._id}]: ${err}`);
        }
      }
      logger.info('✅ Member churn risk assessment cron job completed');
    } catch (error) {
      logger.error(`❌ Member churn risk assessment cron job failed: ${error}`);
    }
  });

  // 4. Gym SaaS Trial & Member Expiry Evaluation — Runs daily at midnight
  cron.schedule('0 0 * * *', async () => {
    logger.info('⏳ Executing daily trial and membership expiration sweep...');
    try {
      await GymService.checkAndUpdateExpiredGyms();
      await MemberService.checkAndExpireMemberships();
      logger.info('✅ Trial and membership expiration sweep completed');
    } catch (error) {
      logger.error(`❌ Trial/membership expiry sweep failed: ${error}`);
    }
  });

  logger.info('✅ Automated cron jobs scheduled successfully');
}
