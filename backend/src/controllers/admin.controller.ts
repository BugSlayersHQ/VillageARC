import { Request, Response, NextFunction } from 'express';
import { clerkClient } from '@clerk/express';

import { prisma } from '../lib/prisma.js';
import { AppError } from '../types/error.types.js';

// GET /api/admin/admin — protect + authorize('ADMIN')
export const adminController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    return res.status(200).json({
      success: true,
      message: 'Admin access confirmed',
      data: { clerkUserId: req.userId },
    });
  } catch (error) {
    return next(error);
  }
};

// POST /api/admin/signup — protect only (no authorize — caller has no role yet)
//
// This is the ONLY place that grants the ADMIN role.
// The webhook never writes Clerk publicMetadata.role.
export const adminSignup = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const clerkUserId = req.userId;

    if (!clerkUserId) {
      const error: AppError = new Error('Unauthorized');
      error.statusCode = 401;
      return next(error);
    }

    const existingUserAccount = await prisma.user.findUnique({ where: { clerkUserId } });
    if (existingUserAccount) {
      const error: AppError = new Error(
        'This account is already registered as an invited User and cannot become an Admin',
      );
      error.statusCode = 409;
      return next(error);
    }

    const clerkUser = await clerkClient.users.getUser(clerkUserId);
    const currentRole = clerkUser.publicMetadata.role;

    if (currentRole === 'USER') {
      const error: AppError = new Error(
        'This account already has the USER role and cannot be promoted to Admin',
      );
      error.statusCode = 409;
      return next(error);
    }

    if (currentRole === 'ADMIN') {
      const admin = await prisma.admin.upsert({
        where: { clerkUserId },
        update: {},
        create: { clerkUserId },
      });

      return res.status(200).json({
        success: true,
        message: 'Already an admin',
        data: { id: admin.id, clerkUserId: admin.clerkUserId, role: 'ADMIN' },
      });
    }

    await clerkClient.users.updateUserMetadata(clerkUserId, {
      publicMetadata: {
        ...clerkUser.publicMetadata,
        role: 'ADMIN',
      },
    });

    const admin = await prisma.admin.upsert({
      where: { clerkUserId },
      update: {},
      create: { clerkUserId },
    });

    return res.status(201).json({
      success: true,
      message: 'Admin role granted successfully',
      data: { id: admin.id, clerkUserId: admin.clerkUserId, role: 'ADMIN' },
    });
  } catch (error) {
    console.error(error);
    return next(error);
  }
};
