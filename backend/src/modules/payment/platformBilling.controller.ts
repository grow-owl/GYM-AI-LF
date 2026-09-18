import { Request, Response } from 'express';
import { PlatformBillingService } from './platformBilling.service';
import { PlatformInvoice } from './platformInvoice.model';
import { sendSuccess } from '../../common/utils/ApiResponse';
import { asyncHandler } from '../../common/utils/asyncHandler';
import { AppError } from '../../common/utils/AppError';
import { assertTenantMatch } from '../../common/middlewares/tenant.middleware';

import mongoose from 'mongoose';
import { PlatformSettings } from './platformSettings.model';

export class PlatformBillingController {
  public static getInvoices = asyncHandler(async (req: Request, res: Response) => {
    const gymId = req.user!.gymId;
    if (!gymId) {
      throw AppError.badRequest('Gym ID is required');
    }

    const invoices = await PlatformInvoice.find({ gymId }).sort({ createdAt: -1 });
    return sendSuccess(res, { invoices }, 'Platform invoices retrieved successfully');
  });

  public static recordManualPlatformPayment = asyncHandler(async (req: Request, res: Response) => {
    const gymId = req.params.gymId;
    const recordedByUserId = req.user!.id;
    const invoice = await PlatformBillingService.recordManualPlatformPayment(gymId, recordedByUserId, req.body);
    return sendSuccess(res, { invoice }, 'Manual platform payment recorded successfully', 201);
  });

  public static getPlatformRevenueOverview = asyncHandler(async (_req: Request, res: Response) => {
    const overview = await PlatformBillingService.getPlatformRevenueOverview();
    return sendSuccess(res, overview, 'Platform revenue overview retrieved successfully');
  });

  public static getPlatformRevenueTrends = asyncHandler(async (req: Request, res: Response) => {
    const { startDate, endDate } = req.query;
    const trends = await PlatformBillingService.getPlatformRevenueTrends(
      startDate ? new Date(startDate as string) : undefined,
      endDate ? new Date(endDate as string) : undefined
    );
    return sendSuccess(res, { trends }, 'Platform revenue trends retrieved successfully');
  });

  public static createUpgradeRequest = asyncHandler(async (req: Request, res: Response) => {
    const gymId = req.params.gymId || req.user?.gymId;
    if (!gymId) {
      throw AppError.badRequest('Gym ID is required');
    }
    assertTenantMatch(gymId, req);

    const upgradeRequest = await PlatformBillingService.createUpgradeRequest(
      gymId.toString(),
      req.user!.id,
      req.body
    );

    return sendSuccess(res, { upgradeRequest }, 'Upgrade request submitted successfully', 201);
  });

  public static listUpgradeRequests = asyncHandler(async (_req: Request, res: Response) => {
    const upgradeRequests = await PlatformBillingService.listUpgradeRequests();
    return sendSuccess(res, { upgradeRequests }, 'Upgrade requests retrieved successfully');
  });

  public static cancelUpgradeRequest = asyncHandler(async (req: Request, res: Response) => {
    const gymId = req.params.gymId || req.user?.gymId;
    if (!gymId) {
      throw AppError.badRequest('Gym ID is required');
    }
    assertTenantMatch(gymId, req);

    const result = await PlatformBillingService.cancelUpgradeRequest(gymId.toString(), req.user!.id);
    return sendSuccess(res, result, 'Upgrade request cancelled successfully');
  });

  public static getPlatformSettings = asyncHandler(async (_req: Request, res: Response) => {
    let settings = await PlatformSettings.findOne();
    if (!settings) {
      settings = await PlatformSettings.create({
        supportEmail: 'support@gymai-saas.com',
        defaultTrialDays: 14,
        platformCurrency: 'INR',
        maintenanceMode: false,
      });
    }
    return sendSuccess(res, { settings }, 'Platform settings retrieved successfully');
  });

  public static updatePlatformSettings = asyncHandler(async (req: Request, res: Response) => {
    const { supportEmail, defaultTrialDays, platformCurrency, maintenanceMode } = req.body;
    let settings = await PlatformSettings.findOne();
    if (!settings) {
      settings = new PlatformSettings();
    }
    if (supportEmail !== undefined) settings.supportEmail = supportEmail;
    if (defaultTrialDays !== undefined) settings.defaultTrialDays = Number(defaultTrialDays);
    if (platformCurrency !== undefined) settings.platformCurrency = platformCurrency;
    if (maintenanceMode !== undefined) settings.maintenanceMode = Boolean(maintenanceMode);
    if (req.user?.id) settings.updatedBy = new mongoose.Types.ObjectId(req.user.id);

    await settings.save();
    return sendSuccess(res, { settings }, 'Platform settings updated successfully');
  });
}
