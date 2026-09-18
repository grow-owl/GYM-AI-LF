import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/AppError';
import { Role } from '../constants/roles.enum';

export const authorize = (...allowedRoles: Role[]) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(AppError.unauthorized('User identity not verified'));
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(
        AppError.forbidden(
          `User with role '${req.user.role}' is not authorized to access this resource`
        )
      );
    }

    next();
  };
};
