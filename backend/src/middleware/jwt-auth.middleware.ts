import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/jwt.js';
import { AppError } from '../types/error.types.js';

export const jwtProtect = (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = req.cookies.accessToken;

    if (!token) {
      const error: AppError = new Error('Authentication required. No token provided.');
      error.statusCode = 401;
      return next(error);
    }

    try {
      const decoded = verifyToken(token);
      req.user = decoded;
      next();
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (_err) {
      const error: AppError = new Error('Invalid or expired token.');
      error.statusCode = 401;
      return next(error);
    }
  } catch (error) {
    next(error);
  }
};
