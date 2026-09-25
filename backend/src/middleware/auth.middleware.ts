import { Request, Response, NextFunction } from 'express';
import { getAuth, clerkClient } from '@clerk/express';
import { AppError } from '../types/error.types.js';
import { Role } from '../types/auth.type.js';

export const protect = (req: Request, res: Response, next: NextFunction) => {
  try {
    const { isAuthenticated, userId } = getAuth(req);

    if (!isAuthenticated || !userId) {
      const error: AppError = new Error('Unauthorized');
      error.statusCode = 401;
      return next(error);
    }

    req.userId = userId;

    next();
  } catch (error) {
    console.error(error);
    next(error);
  }
};

export const authorize = (...allowedRoles: Role[]) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.userId) {
        const error: AppError = new Error('Unauthorized');
        error.statusCode = 401;
        return next(error);
      }

      const user = await clerkClient.users.getUser(req.userId);
      const role = user.publicMetadata.role as Role | undefined;

      if (!role || !allowedRoles.includes(role)) {
        const error: AppError = new Error('Forbidden');
        error.statusCode = 403;
        return next(error);
      }

      next();
    } catch (error) {
      console.error(error);
      next(error);
    }
  };
};
