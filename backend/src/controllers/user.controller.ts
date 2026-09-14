import { Request, Response, NextFunction } from 'express';
import { clerkClient } from '@clerk/express';
import { z } from 'zod';

import { prisma } from '../lib/prisma.js';
import { AppError } from '../types/error.types.js';

const createUserSchema = z.object({
  email: z
    .string({ error: 'Email is required' })
    .trim()
    .min(1, 'Email is required')
    .email('Invalid email address'),
  name: z.string().trim().optional(),
  phone: z.string().trim().optional(),
});

export const createUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parseResult = createUserSchema.safeParse(req.body);
    if (!parseResult.success) {
      const error: AppError = new Error(
        parseResult.error.issues[0]?.message || 'Invalid input parameters',
      );
      error.statusCode = 400;
      return next(error);
    }

    const { name, email, phone } = parseResult.data;

    const clerkAdminId = req.userId;

    if (!clerkAdminId) {
      const error: AppError = new Error('Unauthorized');
      error.statusCode = 401;
      return next(error);
    }

    const admin = await prisma.admin.findUnique({
      where: {
        clerkUserId: clerkAdminId,
      },
    });

    if (!admin) {
      const error: AppError = new Error('Admin not found');
      error.statusCode = 404;
      return next(error);
    }

    const existingUser = await prisma.user.findUnique({
      where: {
        email,
      },
    });

    if (existingUser) {
      const error: AppError = new Error('User already exists');
      error.statusCode = 409;
      return next(error);
    }

    const frontendUrl = process.env.FRONTEND_URL?.replace(/\/$/, '');

    if (!frontendUrl) {
      const error: AppError = new Error('FRONTEND_URL is not configured');
      error.statusCode = 500;
      return next(error);
    }

    const redirectUrl = `${frontendUrl}/login`;

    const invitation = await clerkClient.invitations.createInvitation({
      emailAddress: email,
      redirectUrl,
      publicMetadata: {
        role: 'USER',
        name: name || '',
        phone: phone || '',
        adminId: admin.id,
      },
      notify: true,
      ignoreExisting: false,
    });

    return res.status(201).json({
      success: true,
      message: 'Invitation sent successfully via Clerk email',
      data: {
        id: invitation.id,
        emailAddress: invitation.emailAddress,
        status: invitation.status,
      },
    });
  } catch (error: unknown) {
    console.error('Error creating user invitation:', error);

    let message = 'Failed to create user invitation';
    let statusCode = 500;

    if (typeof error === 'object' && error !== null) {
      const errObj = error as Record<string, unknown>;
      if (Array.isArray(errObj.errors) && errObj.errors.length > 0) {
        const firstError = errObj.errors[0] as Record<string, unknown> | undefined;
        if (typeof firstError?.longMessage === 'string') {
          message = firstError.longMessage;
        } else if (typeof firstError?.message === 'string') {
          message = firstError.message;
        }
      } else if (typeof errObj.message === 'string') {
        message = errObj.message;
      }

      if (typeof errObj.status === 'number') {
        statusCode = errObj.status;
      }
    }

    const appError: AppError = new Error(message);
    appError.statusCode = statusCode;

    return next(appError);
  }
};

export const getAllUsers = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.userId) {
      const error: AppError = new Error('Unauthorized');
      error.statusCode = 401;
      return next(error);
    }

    const admin = await prisma.admin.findUnique({
      where: {
        clerkUserId: req.userId,
      },
    });
    if (!admin) {
      const error: AppError = new Error('Admin not found');
      error.statusCode = 404;
      return next(error);
    }

    const users = await prisma.user.findMany({
      where: {
        adminId: admin.id,
      },
      select: {
        id: true,
        clerkUserId: true,
        name: true,
        email: true,
        phone: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return res.status(200).json({
      success: true,
      message: 'Users fetched successfully',
      data: users,
    });
  } catch (error) {
    console.error(error);
    return next(error);
  }
};
