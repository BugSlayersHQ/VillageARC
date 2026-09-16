import { Request, Response, NextFunction } from 'express';
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

import { prisma } from '../lib/prisma.js';
import { s3, storageBucket } from '../lib/storage.js';
import { AppError } from '../types/error.types.js';
import { validateUploadedFile } from '../utils/file-validation.js';

const isPrismaUniqueConstraintError = (error: unknown): boolean => {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002';
};

const requireUserId = (req: Request, next: NextFunction): string | null => {
  if (!req.userId) {
    const error: AppError = new Error('Unauthorized');
    error.statusCode = 401;
    next(error);
    return null;
  }

  return req.userId;
};

const parsePositiveInt = (value: string | string[] | undefined, label: string): number => {
  const raw = Array.isArray(value) ? value[0] : value;
  const parsed = Number(raw);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    const error: AppError = new Error(`Invalid ${label}`);
    error.statusCode = 400;
    throw error;
  }

  return parsed;
};

const getCurrentAdmin = async (clerkUserId: string) => {
  return prisma.admin.findUnique({
    where: { clerkUserId },
  });
};

const requireCurrentAdmin = async (clerkUserId: string) => {
  const admin = await getCurrentAdmin(clerkUserId);

  if (!admin) {
    const error: AppError = new Error('Admin not found');
    error.statusCode = 404;
    throw error;
  }

  return admin;
};

const requireOwnedFile = async (fileId: number, adminId: number) => {
  const file = await prisma.file.findUnique({
    where: { id: fileId },
  });

  if (!file || file.uploadedById !== adminId) {
    const error: AppError = new Error('File not found');
    error.statusCode = 404;
    throw error;
  }

  return file;
};

const parseCsvLine = (line: string): string[] => {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];

    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }

  result.push(current.trim());
  return result;
};

const FORBIDDEN_CSV_HEADERS = new Set([
  'uploadedbyid',
  'storagekey',
  'filename',
  'mimetype',
  'size',
  'assignedby',
  'userid',
  'adminid',
]);

export const uploadFile = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.file) {
      const error: AppError = new Error('File is required');
      error.statusCode = 400;
      return next(error);
    }

    validateUploadedFile(req.file);

    const clerkUserId = requireUserId(req, next);
    if (!clerkUserId) {
      return;
    }

    if (!storageBucket) {
      const error: AppError = new Error('Storage is not configured');
      error.statusCode = 500;
      return next(error);
    }

    const admin = await requireCurrentAdmin(clerkUserId);

    const uniqueFileName = `${Date.now()}-${Math.round(Math.random() * 1e9)}-${req.file.originalname}`;
    const storageKey = `land-records/${uniqueFileName}`;

    await s3.send(
      new PutObjectCommand({
        Bucket: storageBucket,
        Key: storageKey,
        Body: req.file.buffer,
        ContentType: req.file.mimetype,
      }),
    );

    try {
      const file = await prisma.file.create({
        data: {
          originalName: req.file.originalname,
          fileName: uniqueFileName,
          mimeType: req.file.mimetype,
          size: req.file.size,
          storageKey,
          uploadedById: admin.id,
        },
      });

      return res.status(201).json({
        success: true,
        message: 'File uploaded successfully',
        data: file,
      });
    } catch (error) {
      await s3
        .send(
          new DeleteObjectCommand({
            Bucket: storageBucket,
            Key: storageKey,
          }),
        )
        .catch((cleanupError) => {
          console.error('Failed to clean up storage object after database error:', cleanupError);
        });

      throw error;
    }
  } catch (error) {
    console.error(error);
    return next(error);
  }
};

export const getAllFiles = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const clerkUserId = requireUserId(req, next);
    if (!clerkUserId) {
      return;
    }

    const admin = await requireCurrentAdmin(clerkUserId);

    const files = await prisma.file.findMany({
      where: {
        uploadedById: admin.id,
      },
      include: {
        uploadedBy: {
          select: {
            id: true,
            clerkUserId: true,
          },
        },
        assignments: {
          include: {
            user: {
              select: {
                id: true,
                clerkUserId: true,
                name: true,
                email: true,
              },
            },
            assigner: {
              select: {
                id: true,
                clerkUserId: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return res.status(200).json({
      success: true,
      message: 'Files fetched successfully',
      data: files,
    });
  } catch (error) {
    console.error(error);
    return next(error);
  }
};

export const getMyFiles = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const clerkUserId = requireUserId(req, next);
    if (!clerkUserId) {
      return;
    }

    const user = await prisma.user.findUnique({
      where: {
        clerkUserId,
      },
    });

    if (!user) {
      const error: AppError = new Error('Authenticated user not found');
      error.statusCode = 404;
      return next(error);
    }

    const assignments = await prisma.fileAssignment.findMany({
      where: {
        userId: user.id,
      },
      include: {
        file: {
          include: {
            uploadedBy: {
              select: {
                id: true,
                clerkUserId: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    const files = assignments.map((assignment) => ({
      ...assignment.file,
      assignedAt: assignment.createdAt,
    }));

    return res.status(200).json({
      success: true,
      message: 'User files fetched successfully',
      data: files,
    });
  } catch (error) {
    console.error(error);
    return next(error);
  }
};

export const getFileById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const fileId = parsePositiveInt(req.params.id, 'file ID');
    const clerkUserId = requireUserId(req, next);
    if (!clerkUserId) {
      return;
    }

    const file = await prisma.file.findUnique({
      where: { id: fileId },
      include: {
        uploadedBy: {
          select: {
            id: true,
            clerkUserId: true,
          },
        },
        assignments: {
          include: {
            user: {
              select: {
                id: true,
                clerkUserId: true,
                name: true,
                email: true,
              },
            },
            assigner: {
              select: {
                id: true,
                clerkUserId: true,
              },
            },
          },
        },
      },
    });

    if (!file) {
      const error: AppError = new Error('File not found');
      error.statusCode = 404;
      return next(error);
    }

    const admin = await getCurrentAdmin(clerkUserId);

    if (admin) {
      if (file.uploadedById !== admin.id) {
        const error: AppError = new Error('File not found');
        error.statusCode = 404;
        return next(error);
      }

      return res.status(200).json({
        success: true,
        message: 'File fetched successfully',
        data: file,
      });
    }

    const caller = await prisma.user.findUnique({
      where: { clerkUserId },
    });

    if (!caller) {
      const error: AppError = new Error('Authenticated user not found');
      error.statusCode = 404;
      return next(error);
    }

    const assignment = await prisma.fileAssignment.findUnique({
      where: {
        fileId_userId: {
          fileId,
          userId: caller.id,
        },
      },
    });

    if (!assignment) {
      const error: AppError = new Error('You are not allowed to access this file');
      error.statusCode = 403;
      return next(error);
    }

    return res.status(200).json({
      success: true,
      message: 'File fetched successfully',
      data: {
        ...file,
        assignments: file.assignments.filter((item) => item.userId === caller.id),
      },
    });
  } catch (error) {
    console.error(error);
    return next(error);
  }
};

export const updateFile = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const fileId = parsePositiveInt(req.params.id, 'file ID');
    const clerkUserId = requireUserId(req, next);
    if (!clerkUserId) {
      return;
    }

    const admin = await requireCurrentAdmin(clerkUserId);
    await requireOwnedFile(fileId, admin.id);

    const { originalName } = req.body as { originalName?: string };

    const file = await prisma.file.update({
      where: { id: fileId },
      data: {
        ...(typeof originalName === 'string' && originalName.trim()
          ? { originalName: originalName.trim() }
          : {}),
      },
    });

    return res.status(200).json({
      success: true,
      message: 'File updated successfully',
      data: file,
    });
  } catch (error) {
    console.error(error);
    return next(error);
  }
};

export const deleteFile = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const fileId = parsePositiveInt(req.params.id, 'file ID');
    const clerkUserId = requireUserId(req, next);
    if (!clerkUserId) {
      return;
    }

    if (!storageBucket) {
      const error: AppError = new Error('Storage is not configured');
      error.statusCode = 500;
      return next(error);
    }

    const admin = await requireCurrentAdmin(clerkUserId);
    const file = await requireOwnedFile(fileId, admin.id);

    await s3.send(
      new DeleteObjectCommand({
        Bucket: storageBucket,
        Key: file.storageKey,
      }),
    );

    await prisma.file.delete({
      where: { id: fileId },
    });

    return res.status(200).json({
      success: true,
      message: 'File deleted successfully',
    });
  } catch (error) {
    console.error(error);
    return next(error);
  }
};

export const assignFile = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const fileId = parsePositiveInt(req.params.id, 'file ID');
    const { userId } = req.body as { userId?: number | string };

    if (userId === undefined || userId === null || userId === '') {
      const error: AppError = new Error('User ID is required');
      error.statusCode = 400;
      return next(error);
    }

    const targetUserId = Number(userId);

    if (!Number.isInteger(targetUserId) || targetUserId <= 0) {
      const error: AppError = new Error('Invalid user ID');
      error.statusCode = 400;
      return next(error);
    }

    const clerkUserId = requireUserId(req, next);
    if (!clerkUserId) {
      return;
    }

    const assigner = await requireCurrentAdmin(clerkUserId);
    await requireOwnedFile(fileId, assigner.id);

    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserId },
    });

    if (!targetUser || targetUser.adminId !== assigner.id) {
      const error: AppError = new Error('User not found');
      error.statusCode = 404;
      return next(error);
    }

    const existingAssignment = await prisma.fileAssignment.findUnique({
      where: {
        fileId_userId: {
          fileId,
          userId: targetUserId,
        },
      },
    });

    if (existingAssignment) {
      const error: AppError = new Error('File already assigned to this user');
      error.statusCode = 409;
      return next(error);
    }

    try {
      const assignment = await prisma.fileAssignment.create({
        data: {
          fileId,
          userId: targetUserId,
          assignedBy: assigner.id,
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          assigner: {
            select: {
              id: true,
              clerkUserId: true,
            },
          },
        },
      });

      return res.status(201).json({
        success: true,
        message: 'File assigned successfully',
        data: assignment,
      });
    } catch (err) {
      if (isPrismaUniqueConstraintError(err)) {
        const error: AppError = new Error('File already assigned to this user');
        error.statusCode = 409;
        return next(error);
      }

      throw err;
    }
  } catch (error) {
    console.error(error);
    return next(error);
  }
};

export const removeFileAssignment = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const fileId = parsePositiveInt(req.params.id, 'file ID');
    const userId = parsePositiveInt(req.params.userId, 'user ID');
    const clerkUserId = requireUserId(req, next);
    if (!clerkUserId) {
      return;
    }

    const admin = await requireCurrentAdmin(clerkUserId);
    await requireOwnedFile(fileId, admin.id);

    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!targetUser || targetUser.adminId !== admin.id) {
      const error: AppError = new Error('User not found');
      error.statusCode = 404;
      return next(error);
    }

    const assignment = await prisma.fileAssignment.findUnique({
      where: {
        fileId_userId: {
          fileId,
          userId,
        },
      },
    });

    if (!assignment) {
      const error: AppError = new Error('File assignment not found');
      error.statusCode = 404;
      return next(error);
    }

    await prisma.fileAssignment.delete({
      where: {
        fileId_userId: {
          fileId,
          userId,
        },
      },
    });

    return res.status(200).json({
      success: true,
      message: 'File assignment removed successfully',
    });
  } catch (error) {
    console.error(error);
    return next(error);
  }
};

export const getFileAssignments = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const fileId = parsePositiveInt(req.params.id, 'file ID');
    const clerkUserId = requireUserId(req, next);
    if (!clerkUserId) {
      return;
    }

    const file = await prisma.file.findUnique({
      where: { id: fileId },
    });

    if (!file) {
      const error: AppError = new Error('File not found');
      error.statusCode = 404;
      return next(error);
    }

    const admin = await getCurrentAdmin(clerkUserId);

    if (admin) {
      if (file.uploadedById !== admin.id) {
        const error: AppError = new Error('File not found');
        error.statusCode = 404;
        return next(error);
      }

      const assignments = await prisma.fileAssignment.findMany({
        where: { fileId },
        include: {
          user: {
            select: {
              id: true,
              clerkUserId: true,
              name: true,
              email: true,
            },
          },
          assigner: {
            select: {
              id: true,
              clerkUserId: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      return res.status(200).json({
        success: true,
        message: 'File assignments fetched successfully',
        data: assignments,
      });
    }

    const caller = await prisma.user.findUnique({
      where: { clerkUserId },
    });

    if (!caller) {
      const error: AppError = new Error('Authenticated user not found');
      error.statusCode = 404;
      return next(error);
    }

    const assignments = await prisma.fileAssignment.findMany({
      where: {
        fileId,
        userId: caller.id,
      },
      include: {
        user: {
          select: {
            id: true,
            clerkUserId: true,
            name: true,
            email: true,
          },
        },
        assigner: {
          select: {
            id: true,
            clerkUserId: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (assignments.length === 0) {
      const error: AppError = new Error('You are not allowed to access this file');
      error.statusCode = 403;
      return next(error);
    }

    return res.status(200).json({
      success: true,
      message: 'File assignments fetched successfully',
      data: assignments,
    });
  } catch (error) {
    console.error(error);
    return next(error);
  }
};

export const downloadFile = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const fileId = parsePositiveInt(req.params.id, 'file ID');
    const clerkUserId = requireUserId(req, next);
    if (!clerkUserId) {
      return;
    }

    if (!storageBucket) {
      const error: AppError = new Error('Storage is not configured');
      error.statusCode = 500;
      return next(error);
    }

    const file = await prisma.file.findUnique({
      where: { id: fileId },
    });

    if (!file) {
      const error: AppError = new Error('File not found');
      error.statusCode = 404;
      return next(error);
    }

    const admin = await getCurrentAdmin(clerkUserId);

    if (admin) {
      if (file.uploadedById !== admin.id) {
        const error: AppError = new Error('File not found');
        error.statusCode = 404;
        return next(error);
      }
    } else {
      const caller = await prisma.user.findUnique({
        where: { clerkUserId },
      });

      if (!caller) {
        const error: AppError = new Error('Authenticated user not found');
        error.statusCode = 404;
        return next(error);
      }

      const assignment = await prisma.fileAssignment.findUnique({
        where: {
          fileId_userId: {
            fileId,
            userId: caller.id,
          },
        },
      });

      if (!assignment) {
        const error: AppError = new Error('You are not allowed to download this file');
        error.statusCode = 403;
        return next(error);
      }
    }

    const command = new GetObjectCommand({
      Bucket: storageBucket,
      Key: file.storageKey,
      ResponseContentDisposition: `attachment; filename="${file.originalName}"`,
      ResponseContentType: file.mimeType,
    });

    const url = await getSignedUrl(s3, command, {
      expiresIn: 300,
    });

    return res.status(200).json({
      success: true,
      message: 'Download URL generated successfully',
      data: {
        url,
        expiresIn: 300,
      },
    });
  } catch (error) {
    console.error(error);
    return next(error);
  }
};

export const updateFilesFromCsv = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.file) {
      const error: AppError = new Error('CSV file is required');
      error.statusCode = 400;
      return next(error);
    }

    const clerkUserId = requireUserId(req, next);
    if (!clerkUserId) {
      return;
    }

    const admin = await requireCurrentAdmin(clerkUserId);

    const csvContent = req.file.buffer
      .toString('utf8')
      .replace(/^\uFEFF/, '')
      .trim();

    if (!csvContent) {
      const error: AppError = new Error('CSV file is empty');
      error.statusCode = 400;
      return next(error);
    }

    const lines = csvContent.split(/\r?\n/).filter((line) => line.trim().length > 0);

    if (lines.length === 0) {
      const error: AppError = new Error('CSV file is empty');
      error.statusCode = 400;
      return next(error);
    }

    const headers = parseCsvLine(lines[0] ?? '').map((header) => header.trim());

    if (headers.length === 0 || headers.every((header) => header.length === 0)) {
      const error: AppError = new Error('CSV headers are missing');
      error.statusCode = 400;
      return next(error);
    }

    const normalizedHeaders = headers.map((header) => header.toLowerCase());

    const forbiddenHeader = normalizedHeaders.find((header) => FORBIDDEN_CSV_HEADERS.has(header));
    if (forbiddenHeader) {
      const error: AppError = new Error(
        `CSV contains a forbidden column: ${forbiddenHeader}. Ownership and storage fields cannot be changed.`,
      );
      error.statusCode = 400;
      return next(error);
    }

    const idIndex = normalizedHeaders.indexOf('id');
    const originalNameIndex = normalizedHeaders.indexOf('originalname');

    if (idIndex === -1 || originalNameIndex === -1) {
      const error: AppError = new Error('CSV must include headers: id, originalName');
      error.statusCode = 400;
      return next(error);
    }

    if (lines.length === 1) {
      const error: AppError = new Error('CSV has no data rows');
      error.statusCode = 400;
      return next(error);
    }

    const errors: Array<{ row: number; message: string }> = [];
    const seenIds = new Set<number>();
    const updates: Array<{ row: number; id: number; originalName: string }> = [];

    for (let i = 1; i < lines.length; i += 1) {
      const rowNumber = i + 1;
      const columns = parseCsvLine(lines[i] ?? '');
      const rawId = columns[idIndex];
      const rawOriginalName = columns[originalNameIndex];

      if (rawId === undefined || rawOriginalName === undefined) {
        errors.push({ row: rowNumber, message: 'Row is missing required columns' });
        continue;
      }

      const fileId = Number(rawId);
      if (!Number.isInteger(fileId) || fileId <= 0) {
        errors.push({ row: rowNumber, message: 'Invalid file ID' });
        continue;
      }

      const originalName = rawOriginalName.trim();
      if (!originalName) {
        errors.push({ row: rowNumber, message: 'originalName is required' });
        continue;
      }

      if (seenIds.has(fileId)) {
        errors.push({ row: rowNumber, message: `Duplicate file ID ${fileId}` });
        continue;
      }

      seenIds.add(fileId);
      updates.push({ row: rowNumber, id: fileId, originalName });
    }

    const validUpdates: Array<{ id: number; originalName: string }> = [];

    for (const update of updates) {
      const file = await prisma.file.findUnique({
        where: { id: update.id },
        select: { id: true, uploadedById: true },
      });

      if (!file || file.uploadedById !== admin.id) {
        errors.push({ row: update.row, message: `File ${update.id} was not found` });
        continue;
      }

      validUpdates.push({ id: update.id, originalName: update.originalName });
    }

    if (validUpdates.length > 0) {
      await prisma.$transaction(
        validUpdates.map((update) =>
          prisma.file.update({
            where: { id: update.id },
            data: { originalName: update.originalName },
          }),
        ),
      );
    }

    return res.status(200).json({
      success: true,
      message: 'Files updated successfully from CSV',
      data: {
        updated: validUpdates.length,
        failed: errors.length,
        errors,
      },
    });
  } catch (error) {
    console.error(error);
    return next(error);
  }
};
