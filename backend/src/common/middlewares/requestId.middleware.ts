import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

/**
 * Attaches a unique request ID (UUID) to every incoming HTTP request for log correlation
 * and echoes it back in the X-Request-Id header.
 */
export const requestId = (req: Request, res: Response, next: NextFunction): void => {
  const existingId = req.headers['x-request-id'] as string;
  const id = existingId || uuidv4();

  req.id = id;
  res.setHeader('X-Request-Id', id);

  next();
};
