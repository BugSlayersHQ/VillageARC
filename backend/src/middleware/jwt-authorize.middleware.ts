import { Request, Response, NextFunction } from 'express';
import { Role } from '../types/auth.type.js';
import { AppError } from '../types/error.types.js';

export const jwtAuthorize = (...roles: Role[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      const error: AppError = new Error('Authentication required.');
      error.statusCode = 401;
      return next(error);
    }

    if (!roles.includes(req.user.role)) {
      const error: AppError = new Error('Forbidden. Insufficient permissions.');
      error.statusCode = 403;
      return next(error);
    }

    next();
  };
};
