import { Router } from 'express';

import { protect, authorize } from '../middleware/auth.middleware.js';

import {
  uploadFile,
  getAllFiles,
  getFileById,
  updateFile,
  deleteFile,
  assignFile,
  removeFileAssignment,
  getFileAssignments,
  getMyFiles,
  downloadFile,
  updateFilesFromCsv,
} from '../controllers/file.controller.js';

import { upload, csvUpload } from '../middleware/upload.middleware.js';

const router = Router();

router.post('/create', protect, authorize('ADMIN'), upload.single('file'), uploadFile);

router.get('/', protect, authorize('ADMIN'), getAllFiles);

router.get('/my-files', protect, authorize('USER'), getMyFiles);

router.patch(
  '/update-csv',
  protect,
  authorize('ADMIN'),
  csvUpload.single('file'),
  updateFilesFromCsv,
);

router.get('/:id/download', protect, downloadFile);

router.get('/:id', protect, getFileById);

router.patch('/:id', protect, authorize('ADMIN'), updateFile);

router.delete('/:id', protect, authorize('ADMIN'), deleteFile);

router.post('/:id/assign', protect, authorize('ADMIN'), assignFile);

router.delete('/:id/assign/:userId', protect, authorize('ADMIN'), removeFileAssignment);

router.get('/:id/assignments', protect, getFileAssignments);

export default router;
