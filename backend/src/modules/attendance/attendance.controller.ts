import { Request, Response } from 'express';
import { AttendanceService } from './attendance.service';
import { sendSuccess } from '../../common/utils/ApiResponse';
import { asyncHandler } from '../../common/utils/asyncHandler';
import { AppError } from '../../common/utils/AppError';

export class AttendanceController {
  public static checkIn = asyncHandler(async (req: Request, res: Response) => {
    const memberId = req.user?.role === 'MEMBER' ? req.user.id : req.body.memberId;
    const attendance = await AttendanceService.checkIn({
      qrToken: req.body.qrToken || req.body.dynamicQrToken,
      qrPayload: req.body.qrPayload,
      memberId,
      branchId: req.body.branchId || req.user?.branchId,
      lat: req.body.lat,
      lng: req.body.lng,
    });
    return sendSuccess(res, { attendance }, 'Checked in successfully', 201);
  });

  public static checkOut = asyncHandler(async (req: Request, res: Response) => {
    const memberId = req.user?.role === 'MEMBER' ? req.user.id : req.body.memberId;
    const attendance = await AttendanceService.checkOut({
      qrPayload: req.body.qrPayload,
      attendanceId: req.body.attendanceId,
      memberId,
    });
    return sendSuccess(res, { attendance }, 'Checked out successfully', 200);
  });

  public static getCurrentSession = asyncHandler(async (req: Request, res: Response) => {
    const session = await AttendanceService.getCurrentSession(req.user!.id);
    return sendSuccess(res, { session }, 'Current active session retrieved successfully');
  });

  public static getMyHistory = asyncHandler(async (req: Request, res: Response) => {
    const { attendanceList, meta } = await AttendanceService.getAttendanceHistory(
      req.user!.id,
      req.query
    );
    return sendSuccess(res, { attendanceList }, 'Attendance history retrieved successfully', 200, {
      pagination: meta,
    });
  });

  public static getMyStats = asyncHandler(async (req: Request, res: Response) => {
    const stats = await AttendanceService.getAttendanceStats(req.user!.id);
    return sendSuccess(res, { stats }, 'Attendance analytics retrieved successfully');
  });

  public static manualCheckInOut = asyncHandler(async (req: Request, res: Response) => {
    const attendance = await AttendanceService.manualCheckInOut(req.body);
    return sendSuccess(res, { attendance }, 'Manual attendance entry recorded successfully', 201);
  });

  public static getBranchDailyAttendance = asyncHandler(async (req: Request, res: Response) => {
    const { branchId } = req.params;
    const gymId = (req.params.gymId || req.query.gymId || req.user?.gymId) as string | undefined;
    const dayKey = req.query.date as string | undefined;

    const attendanceList = await AttendanceService.getBranchDailyAttendance(branchId, dayKey, gymId);
    return sendSuccess(res, { attendanceList, dayKey }, 'Daily branch attendance log retrieved successfully');
  });

  public static getAttendanceHeatmap = asyncHandler(async (req: Request, res: Response) => {
    const gymId = req.params.gymId || req.user?.gymId;
    if (!gymId) {
      throw AppError.badRequest('Gym ID is required to fetch attendance heatmap');
    }
    const branchId = (req.query.branchId as string) || req.user?.branchId;
    const data = await AttendanceService.getAttendanceHeatmap(gymId, branchId);
    return sendSuccess(res, data, 'Attendance heatmap retrieved successfully');
  });

  public static generateDynamicQR = asyncHandler(async (req: Request, res: Response) => {
    const { gymId, branchId } = req.params;
    const ttlSeconds = req.query.ttlSeconds ? parseInt(req.query.ttlSeconds as string, 10) : 60;
    const qrData = await AttendanceService.generateDynamicQR(gymId, branchId, ttlSeconds);
    return sendSuccess(res, qrData, 'Dynamic QR code generated successfully', 200);
  });
}
