import { Request, Response } from 'express';
import { DashboardService } from './dashboard.service';
import { ReportService } from './report.service';
import { BranchAnalyticsService } from './branchAnalytics.service';
import { sendSuccess } from '../../common/utils/ApiResponse';
import { asyncHandler } from '../../common/utils/asyncHandler';
import { AppError } from '../../common/utils/AppError';
import { Role } from '../../common/constants/roles.enum';

export class ReportController {
  public static getOverview = asyncHandler(async (req: Request, res: Response) => {
    const gymId = req.params.gymId || req.user?.gymId;
    if (!gymId) throw AppError.badRequest('Gym ID is required');

    const branchId = (req.query.branchId as string) || (req.params.branchId as string);

    const overview = await DashboardService.getOwnerDashboardOverview(gymId.toString(), branchId);
    return sendSuccess(res, overview, 'Dashboard overview retrieved successfully');
  });

  public static requestReport = asyncHandler(async (req: Request, res: Response) => {
    const gymId = req.params.gymId || req.user?.gymId;
    if (!gymId) throw AppError.badRequest('Gym ID is required');

    const reportRequest = await ReportService.requestReport(
      {
        gymId: gymId.toString(),
        reportType: req.body.reportType,
        scope: req.body.scope,
        periodStart: new Date(req.body.periodStart),
        periodEnd: new Date(req.body.periodEnd),
        format: req.body.format,
      },
      {
        id: req.user!.id,
        role: req.user!.role as Role,
        branchId: req.user!.branchId,
      }
    );

    return sendSuccess(res, { reportRequest }, 'Report requested and generated successfully', 201);
  });

  public static getReportById = asyncHandler(async (req: Request, res: Response) => {
    const gymId = req.params.gymId || req.user?.gymId;
    const reportRequest = await ReportService.getReportRequestById(
      req.params.reportRequestId,
      gymId ? gymId.toString() : undefined
    );
    return sendSuccess(res, { reportRequest }, 'Report request details retrieved successfully');
  });

  public static listReports = asyncHandler(async (req: Request, res: Response) => {
    const gymId = req.params.gymId || req.user?.gymId;
    if (!gymId) throw AppError.badRequest('Gym ID is required');

    const reports = await ReportService.listReportRequests(gymId.toString());
    return sendSuccess(res, { reports }, 'Report history retrieved successfully');
  });

  public static getExpiringMemberships = asyncHandler(async (req: Request, res: Response) => {
    const gymId = req.params.gymId || req.user?.gymId;
    if (!gymId) throw AppError.badRequest('Gym ID is required');

    const branchId = (req.query.branchId as string) || (req.params.branchId as string);
    const days = req.query.days ? parseInt(req.query.days as string, 10) : 7;

    const expiringMemberships = await DashboardService.getExpiringMembershipsDetail(
      gymId.toString(),
      branchId,
      days
    );
    return sendSuccess(
      res,
      { expiringMemberships },
      'Expiring memberships detail view retrieved successfully'
    );
  });

  public static getBranchComparison = asyncHandler(async (req: Request, res: Response) => {
    const gymId = req.params.gymId || req.user?.gymId;
    if (!gymId) throw AppError.badRequest('Gym ID is required');

    const metric = (req.query.metric as string) || 'revenue';
    const period = (req.query.period as string) || '30d';

    const comparison = await BranchAnalyticsService.getBranchComparison(
      gymId.toString(),
      metric,
      period,
      req.user?.role,
      req.user?.branchId
    );

    return sendSuccess(res, comparison, 'Multi-branch comparison analytics generated successfully');
  });
}
