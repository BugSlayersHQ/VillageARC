import cors from 'cors';
import express from 'express';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import { errorMiddleware } from './middleware/error.middleware.js';

import healthRouter from './routes/health.route.js';
import userRouter from './routes/user.route.js';
import fileRoutes from './routes/file.routes.js';

import authRoutes from './routes/auth.routes.js';

export const app = express();

// Middleware
app.use(
  cors({
    origin: process.env.CORS_ORIGIN,
    credentials: true, // Needed for cookies
  }),
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(morgan('dev'));

// Routes
app.use('/api', healthRouter);
app.use('/api/auth', authRoutes);
app.use('/api/user', userRouter);
app.use('/api/users', userRouter);
app.use('/api/files', fileRoutes);

// Error handling middleware
app.use(errorMiddleware);
