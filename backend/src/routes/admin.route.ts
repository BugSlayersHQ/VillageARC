import express from 'express';
import { protect, authorize } from '../middleware/auth.middleware.js';
import { adminController, adminSignup } from '../controllers/admin.controller.js';

const router = express.Router();

router.post('/signup', protect, adminSignup);

router.get('/admin', protect, authorize('ADMIN'), adminController);

export default router;
