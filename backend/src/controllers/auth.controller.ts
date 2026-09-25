import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { AppError } from '../types/error.types.js';
import { hashPassword, comparePassword } from '../utils/password.js';
import { generateToken } from '../utils/jwt.js';
import { Role } from '../types/auth.type.js';

const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  name: z.string().min(1, 'Name is required').optional(),
  role: z.enum(['ADMIN', 'USER']).default('USER'),
  adminId: z.number().optional(), // Required if role is USER
});

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

const setTokenCookie = (res: Response, token: string) => {
  const isProd = process.env.NODE_ENV === 'production';
  res.cookie('accessToken', token, {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'none' : 'lax',
    maxAge: 24 * 60 * 60 * 1000, // 1 day
  });
};

export const register = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parseResult = registerSchema.safeParse(req.body);
    if (!parseResult.success) {
      const error: AppError = new Error(
        parseResult.error.issues[0]?.message || 'Invalid input parameters',
      );
      error.statusCode = 400;
      return next(error);
    }

    const { email, password, name, role, adminId } = parseResult.data;

    // Check existing email
    const existingAdmin = await prisma.admin.findUnique({ where: { email } });
    const existingUser = await prisma.user.findUnique({ where: { email } });

    if (existingAdmin || existingUser) {
      const error: AppError = new Error('Email is already registered');
      error.statusCode = 409;
      return next(error);
    }

    const hashedPwd = await hashPassword(password);

    let userId: number;

    if (role === 'ADMIN') {
      const admin = await prisma.admin.create({
        data: {
          email,
          name: name || null,
          passwordHash: hashedPwd,
        },
      });
      userId = admin.id;
    } else {
      if (!adminId) {
        const error: AppError = new Error('adminId is required when registering a USER');
        error.statusCode = 400;
        return next(error);
      }

      const admin = await prisma.admin.findUnique({ where: { id: adminId } });
      if (!admin) {
        const error: AppError = new Error('Admin not found for the provided adminId');
        error.statusCode = 404;
        return next(error);
      }

      const user = await prisma.user.create({
        data: {
          email,
          name: name || '',
          passwordHash: hashedPwd,
          adminId,
        },
      });
      userId = user.id;
    }

    const token = generateToken({ userId, role: role as Role });
    setTokenCookie(res, token);

    return res.status(201).json({
      success: true,
      message: 'Registration successful',
      data: {
        id: userId,
        email,
        role,
        name,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const login = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parseResult = loginSchema.safeParse(req.body);
    if (!parseResult.success) {
      const error: AppError = new Error(
        parseResult.error.issues[0]?.message || 'Invalid credentials',
      );
      error.statusCode = 400;
      return next(error);
    }

    const { email, password } = parseResult.data;

    let userId: number | null = null;
    let userRole: Role | null = null;
    let storedHash: string | null = null;

    const admin = await prisma.admin.findUnique({ where: { email } });
    if (admin && admin.passwordHash) {
      userId = admin.id;
      userRole = 'ADMIN';
      storedHash = admin.passwordHash;
    } else {
      const user = await prisma.user.findUnique({ where: { email } });
      if (user && user.passwordHash) {
        userId = user.id;
        userRole = 'USER';
        storedHash = user.passwordHash;
      }
    }

    if (!userId || !userRole || !storedHash) {
      const error: AppError = new Error('Invalid email or password');
      error.statusCode = 401;
      return next(error);
    }

    const isMatch = await comparePassword(password, storedHash);
    if (!isMatch) {
      const error: AppError = new Error('Invalid email or password');
      error.statusCode = 401;
      return next(error);
    }

    const token = generateToken({ userId, role: userRole });
    setTokenCookie(res, token);

    return res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        id: userId,
        email,
        role: userRole,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const logout = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const isProd = process.env.NODE_ENV === 'production';
    res.clearCookie('accessToken', {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? 'none' : 'lax',
    });

    return res.status(200).json({
      success: true,
      message: 'Logout successful',
    });
  } catch (error) {
    next(error);
  }
};

export const getMe = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userContext = req.user;
    if (!userContext) {
      const error: AppError = new Error('Unauthorized');
      error.statusCode = 401;
      return next(error);
    }

    if (userContext.role === 'ADMIN') {
      const admin = await prisma.admin.findUnique({
        where: { id: userContext.userId },
        select: { id: true, name: true, email: true, createdAt: true, updatedAt: true },
      });
      if (!admin) {
        const error: AppError = new Error('Admin not found');
        error.statusCode = 404;
        return next(error);
      }
      return res.status(200).json({
        success: true,
        data: { ...admin, role: 'ADMIN' },
      });
    } else {
      const user = await prisma.user.findUnique({
        where: { id: userContext.userId },
        select: {
          id: true,
          email: true,
          name: true,
          phone: true,
          adminId: true,
          createdAt: true,
          updatedAt: true,
        },
      });
      if (!user) {
        const error: AppError = new Error('User not found');
        error.statusCode = 404;
        return next(error);
      }
      return res.status(200).json({
        success: true,
        data: { ...user, role: 'USER' },
      });
    }
  } catch (error) {
    next(error);
  }
};
