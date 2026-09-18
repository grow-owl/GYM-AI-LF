import { Request, Response, NextFunction } from 'express';
import { DataPrivacyService } from './dataPrivacy.service';
import { sendSuccess } from '../../common/utils/ApiResponse';

export class DataPrivacyController {
  public static async exportData(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const gymId = req.tenant?.gymId;

      const exportData = await DataPrivacyService.exportUserData(userId, gymId);
      sendSuccess(res, exportData, 'Personal data export generated successfully', 200);
    } catch (error) {
      next(error);
    }
  }

  public static async requestDeletion(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;

      const result = await DataPrivacyService.requestAccountDeletion(userId);
      sendSuccess(
        res,
        result,
        'Account deletion requested. Your account has been disabled and will be permanently anonymized in 30 days.',
        200
      );
    } catch (error) {
      next(error);
    }
  }

  public static async cancelDeletion(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;

      await DataPrivacyService.cancelAccountDeletion(userId);
      sendSuccess(res, null, 'Account deletion request has been cancelled and account re-activated.', 200);
    } catch (error) {
      next(error);
    }
  }
}
