import { Request, Response } from 'express';
import { ProgressService } from './progress.service';
import { sendSuccess } from '../../common/utils/ApiResponse';
import { asyncHandler } from '../../common/utils/asyncHandler';
import { validateMemberAccess } from '../../common/utils/authorization';
import { Role } from '../../common/constants/roles.enum';

export class ProgressController {
  public static logWeight = asyncHandler(async (req: Request, res: Response) => {
    const requestedMemberId = req.body.memberId || (req.user!.role === Role.MEMBER ? req.user!.id : undefined);
    const validatedMember = await validateMemberAccess(req.user!, requestedMemberId);
    const date = req.body.date ? new Date(req.body.date) : new Date();
    const entry = await ProgressService.logWeight(
      validatedMember._id.toString(),
      req.body.weightKg,
      date,
      req.body.heightCm,
      req.body.targetWeightKg
    );
    return sendSuccess(res, { entry }, 'Body metrics and weight logged successfully', 201);
  });

  public static getWeightHistory = asyncHandler(async (req: Request, res: Response) => {
    const requestedMemberId = req.params.memberId || (req.user!.role === Role.MEMBER ? req.user!.id : undefined);
    const validatedMember = await validateMemberAccess(req.user!, requestedMemberId);
    const { history, meta } = await ProgressService.getWeightHistory(validatedMember._id.toString(), req.query);
    return sendSuccess(res, { history }, 'Weight history retrieved successfully', 200, {
      pagination: meta,
    });
  });

  public static uploadProgressPhoto = asyncHandler(async (req: Request, res: Response) => {
    const requestedMemberId = req.user!.id;
    const validatedMember = await validateMemberAccess(req.user!, requestedMemberId);
    const imageSource = req.body.image || req.body.imageUrl || req.body.photoUrl;
    const angle = req.body.angle || 'front';
    const notes = req.body.notes;
    const photo = await ProgressService.uploadProgressPhoto(
      validatedMember._id.toString(),
      imageSource,
      angle,
      notes
    );
    return sendSuccess(res, { photo }, 'Progress photo recorded successfully', 201);
  });

  public static deleteProgressPhoto = asyncHandler(async (req: Request, res: Response) => {
    const requestedMemberId = req.user!.role === Role.MEMBER ? req.user!.id : undefined;
    const validatedMember = await validateMemberAccess(req.user!, requestedMemberId);
    const { photoId } = req.params;
    await ProgressService.deleteProgressPhoto(validatedMember._id.toString(), photoId);
    return sendSuccess(res, null, 'Progress photo deleted successfully', 200);
  });

  public static getProgressPhotos = asyncHandler(async (req: Request, res: Response) => {
    const requestedMemberId = req.params.memberId || (req.user!.role === Role.MEMBER ? req.user!.id : undefined);
    const validatedMember = await validateMemberAccess(req.user!, requestedMemberId);
    const angle = req.query.angle as 'front' | 'side' | 'back' | undefined;
    const { photos, meta } = await ProgressService.getProgressPhotos(validatedMember._id.toString(), angle, req.query);
    return sendSuccess(res, { photos }, 'Progress photos retrieved successfully', 200, {
      pagination: meta,
    });
  });

  public static logWellness = asyncHandler(async (req: Request, res: Response) => {
    const requestedMemberId = req.user!.id;
    const validatedMember = await validateMemberAccess(req.user!, requestedMemberId);
    const wellness = await ProgressService.logWellness(validatedMember._id.toString(), req.body);
    return sendSuccess(res, { wellness }, 'Daily wellness logged successfully', 200);
  });

  public static getWellnessHistory = asyncHandler(async (req: Request, res: Response) => {
    const requestedMemberId = req.params.memberId || (req.user!.role === Role.MEMBER ? req.user!.id : undefined);
    const validatedMember = await validateMemberAccess(req.user!, requestedMemberId);
    const { history, meta } = await ProgressService.getWellnessHistory(validatedMember._id.toString(), req.query);
    return sendSuccess(res, { history }, 'Wellness history retrieved successfully', 200, {
      pagination: meta,
    });
  });

  public static getProgressSummary = asyncHandler(async (req: Request, res: Response) => {
    const requestedMemberId = req.params.memberId || (req.user!.role === Role.MEMBER ? req.user!.id : undefined);
    const validatedMember = await validateMemberAccess(req.user!, requestedMemberId);
    const summary = await ProgressService.getProgressSummary(validatedMember._id.toString());
    return sendSuccess(res, { summary }, 'Progress summary snapshot retrieved successfully');
  });

  public static logDietMeal = asyncHandler(async (req: Request, res: Response) => {
    const requestedMemberId = req.user!.id;
    const validatedMember = await validateMemberAccess(req.user!, requestedMemberId);
    const wellness = await ProgressService.logDietMeal(validatedMember._id.toString(), req.body);
    return sendSuccess(res, { wellness }, 'Diet meal logged successfully', 201);
  });

  public static getDietLogs = asyncHandler(async (req: Request, res: Response) => {
    const requestedMemberId = req.params.memberId || (req.user!.role === Role.MEMBER ? req.user!.id : undefined);
    const validatedMember = await validateMemberAccess(req.user!, requestedMemberId);
    const dietLogs = await ProgressService.getDietLogs(validatedMember._id.toString(), req.query);
    return sendSuccess(res, { dietLogs }, 'Diet logs retrieved successfully');
  });
}
