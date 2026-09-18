import { Request, Response } from 'express';
import { MembershipReminderJob } from './membershipReminder.job';
import { sendSuccess } from '../common/utils/ApiResponse';
import { asyncHandler } from '../common/utils/asyncHandler';

export class JobController {
  public static runReminders = asyncHandler(async (req: Request, res: Response) => {
    const { gymId } = req.params;
    const result = await MembershipReminderJob.runReminders(gymId);
    return sendSuccess(res, result, 'Automated reminder job executed successfully');
  });
}
