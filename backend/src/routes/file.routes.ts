import { Router } from 'express';

import { protect, authorize } from '../middleware/auth.middleware.js';

import {
  uploadFile,
  getAllFiles,
  getFileById,
  updateFile,
  archiveFile,
  restoreFile,
  assignFile,
  removeFileAssignment,
  getFileAssignments,
  getMyFiles,
  downloadFile,
  updateFilesFromCsv,
} from '../controllers/file.controller.js';

import { upload, csvUpload } from '../middleware/upload.middleware.js';

const router = Router();

// Create
router.post('/create', protect, authorize('ADMIN'), upload.single('file'), uploadFile);

// List active files
router.get('/', protect, authorize('ADMIN'), getAllFiles);

// User's assigned active files
router.get('/my-files', protect, authorize('USER'), getMyFiles);

// Bulk metadata update
router.patch(
  '/update-csv',
  protect,
  authorize('ADMIN'),
  csvUpload.single('file'),
  updateFilesFromCsv,
);

// File download
router.get('/:id/download', protect, downloadFile);

// Get single file
router.get('/:id', protect, getFileById);

// Update permitted metadata
router.patch('/:id', protect, authorize('ADMIN'), updateFile);

// Archive official record
router.patch('/:id/archive', protect, authorize('ADMIN'), archiveFile);

// Restore archived record
router.patch('/:id/restore', protect, authorize('ADMIN'), restoreFile);

// Assign file
router.post('/:id/assign', protect, authorize('ADMIN'), assignFile);

// Remove assignment
router.delete('/:id/assign/:userId', protect, authorize('ADMIN'), removeFileAssignment);

// Get assignments
router.get('/:id/assignments', protect, getFileAssignments);

export default router;
