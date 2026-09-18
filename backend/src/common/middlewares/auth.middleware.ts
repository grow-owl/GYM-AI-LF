import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../utils/generateTokens';
import { AppError } from '../utils/AppError';
import { ErrorCode } from '../constants/errorCodes.enum';
import { Role } from '../constants/roles.enum';
import { User } from '../../modules/user/user.model';

export const authenticate = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(
      new AppError('Access token is missing', 401, ErrorCode.UNAUTHORIZED, true)
    );
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = verifyAccessToken(token);

    // Double-check active user in database (prevents deleted/locked users with valid unexpired JWTs from proceeding)
    let user = await User.findOne({
      _id: decoded.id,
      isDeleted: false,
    }).select('_id role gymId branchId isActive');

    if (!user) {
      throw AppError.unauthorized('User account not found or deactivated');
    }

    if (!user.isActive) {
      return next(AppError.forbidden('Account is deactivated'));
    }

    req.user = {
      id: user._id.toString(),
      role: user.role as Role,
      gymId: user.gymId?.toString(),
      branchId: user.branchId?.toString(),
    };

    next();
  } catch (error: unknown) {
    if (typeof error === 'object' && error !== null && (error as { name?: string }).name === 'TokenExpiredError') {
      return next(
        new AppError('Access token has expired', 401, ErrorCode.AUTH_TOKEN_EXPIRED, true)
      );
    }
    return next(
      new AppError('Invalid access token', 401, ErrorCode.AUTH_INVALID_CREDENTIALS, true)
    );
  }
};
