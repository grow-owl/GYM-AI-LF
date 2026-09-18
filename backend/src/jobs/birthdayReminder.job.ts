import mongoose from 'mongoose';
import { Gym } from '../modules/gym/gym.model';
import { Member } from '../modules/member/member.model';
import { User } from '../modules/user/user.model';
import { NotificationService } from '../modules/notification/notification.service';
import { NotificationType } from '../modules/notification/notification.types';
import { notificationTemplates } from '../modules/notification/notificationTemplates';
import { BirthdayReminderLog } from './birthdayReminderLog.model';
import { logger } from '../config/logger';

export class BirthdayReminderJob {
  public static async runBirthdayWishes(specificGymId?: string): Promise<{
    processedGyms: number;
    wishesSent: number;
    skippedDuplicates: number;
  }> {
    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth();
    const currentDate = today.getDate();

    const isNonLeapYear = new Date(currentYear, 1, 29).getMonth() !== 1;
    const isFeb28InNonLeap = isNonLeapYear && currentMonth === 1 && currentDate === 28;

    const gymFilter: any = { isDeleted: false };
    if (specificGymId) {
      gymFilter._id = new mongoose.Types.ObjectId(specificGymId);
    }

    const gyms = await Gym.find(gymFilter).select('_id name');
    let totalSent = 0;
    let totalSkipped = 0;

    for (const gym of gyms) {
      const gymId = gym._id.toString();

      const members = await Member.find({
        gymId: new mongoose.Types.ObjectId(gymId),
        isDeleted: false,
        dateOfBirth: { $exists: true, $ne: null },
      }).select('_id userId dateOfBirth');

      for (const m of members) {
        if (!m.dateOfBirth) continue;

        const dob = new Date(m.dateOfBirth);
        const isDirectMatch = dob.getMonth() === currentMonth && dob.getDate() === currentDate;
        const isFeb29NonLeapMatch = isFeb28InNonLeap && dob.getMonth() === 1 && dob.getDate() === 29;

        if (isDirectMatch || isFeb29NonLeapMatch) {
          try {
            await BirthdayReminderLog.create({
              memberId: m._id,
              gymId: gym._id,
              year: currentYear,
            });

            const user = await User.findById(m.userId).select('fullName');
            const memberName = user?.fullName || 'Valued Member';

            // Send In-App Notification
            const template = notificationTemplates[NotificationType.BIRTHDAY_WISH](memberName, gym.name);
            await NotificationService.sendToUser(
              m.userId.toString(),
              gymId,
              NotificationType.BIRTHDAY_WISH,
              template.title,
              template.body
            );

            totalSent++;
          } catch (err: any) {
            if (err?.code === 11000) {
              totalSkipped++;
            } else {
              logger.error(`Error sending birthday wish to member [${m._id}]: ${err}`);
            }
          }
        }
      }
    }

    logger.info(
      `🎉 Birthday Wishes Cron Job Completed: [Gyms: ${gyms.length}] [Sent: ${totalSent}] [Skipped: ${totalSkipped}]`
    );

    return {
      processedGyms: gyms.length,
      wishesSent: totalSent,
      skippedDuplicates: totalSkipped,
    };
  }
}
