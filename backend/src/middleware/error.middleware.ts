import { Request, Response, NextFunction } from 'express';
import { AppError } from '../types/error.types.js';

const MULTER_ERROR_MESSAGES: Record<string, string> = {
  LIMIT_FILE_SIZE: 'File exceeds the 20 MB size limit',
  LIMIT_UNEXPECTED_FILE: 'Unexpected file field',
};

const isMulterError = (err: unknown): err is { name: string; code: string; message: string } => {
  return (
    typeof err === 'object' &&
    err !== null &&
    'name' in err &&
    (err as { name?: string }).name === 'MulterError' &&
    'code' in err
  );
};

export const errorMiddleware = (
  err: AppError,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction,
) => {
  if (isMulterError(err)) {
    return res.status(400).json({
      message: MULTER_ERROR_MESSAGES[err.code] ?? err.message,
    });
  }

  const statusCode = err.statusCode || 500;
  const message = statusCode < 500 ? err.message || 'Client Error' : 'Internal Server Error';

  if (statusCode >= 500) {
    console.error('Unhandled Server Error:', err);
  }

  res.status(statusCode).json({
    message,
  });
};
