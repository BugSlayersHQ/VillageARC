import type { AppError } from '../types/error.types.js';

const PDF_MAGIC = Buffer.from('%PDF');

const JPEG_MAGIC = Buffer.from([0xff, 0xd8, 0xff]);

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

// WebP files use RIFF as the container format
// and WEBP at byte offset 8.
const WEBP_RIFF_MAGIC = Buffer.from('RIFF');
const WEBP_MAGIC = Buffer.from('WEBP');

// TIFF supports both little-endian and big-endian formats.
const TIFF_LE_MAGIC = Buffer.from([0x49, 0x49, 0x2a, 0x00]);
const TIFF_BE_MAGIC = Buffer.from([0x4d, 0x4d, 0x00, 0x2a]);

const ALLOWED_EXTENSIONS = new Set(['.pdf', '.jpg', '.jpeg', '.png', '.webp', '.tif', '.tiff']);

const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/tiff',
]);

const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024; // 20 MB

type DetectedFileType = 'pdf' | 'jpeg' | 'png' | 'webp' | 'tiff' | 'unknown';

const detectFileSignature = (buffer: Buffer): DetectedFileType => {
  if (buffer.subarray(0, PDF_MAGIC.length).equals(PDF_MAGIC)) {
    return 'pdf';
  }

  if (buffer.subarray(0, JPEG_MAGIC.length).equals(JPEG_MAGIC)) {
    return 'jpeg';
  }

  if (buffer.subarray(0, PNG_MAGIC.length).equals(PNG_MAGIC)) {
    return 'png';
  }

  // WebP:
  // Bytes 0-3  = RIFF
  // Bytes 8-11 = WEBP
  if (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).equals(WEBP_RIFF_MAGIC) &&
    buffer.subarray(8, 12).equals(WEBP_MAGIC)
  ) {
    return 'webp';
  }

  // TIFF little-endian
  if (buffer.subarray(0, TIFF_LE_MAGIC.length).equals(TIFF_LE_MAGIC)) {
    return 'tiff';
  }

  // TIFF big-endian
  if (buffer.subarray(0, TIFF_BE_MAGIC.length).equals(TIFF_BE_MAGIC)) {
    return 'tiff';
  }

  return 'unknown';
};

const getFileExtension = (fileName: string): string => {
  const lastDotIndex = fileName.lastIndexOf('.');

  if (lastDotIndex === -1) {
    return '';
  }

  return fileName.slice(lastDotIndex).toLowerCase();
};

const isSignatureMatchingExtension = (signature: DetectedFileType, extension: string): boolean => {
  switch (signature) {
    case 'pdf':
      return extension === '.pdf';

    case 'jpeg':
      return extension === '.jpg' || extension === '.jpeg';

    case 'png':
      return extension === '.png';

    case 'webp':
      return extension === '.webp';

    case 'tiff':
      return extension === '.tif' || extension === '.tiff';

    default:
      return false;
  }
};

const isSignatureMatchingMimeType = (signature: DetectedFileType, mimeType: string): boolean => {
  switch (signature) {
    case 'pdf':
      return mimeType === 'application/pdf';

    case 'jpeg':
      return mimeType === 'image/jpeg';

    case 'png':
      return mimeType === 'image/png';

    case 'webp':
      return mimeType === 'image/webp';

    case 'tiff':
      return mimeType === 'image/tiff';

    default:
      return false;
  }
};

export const validateUploadedFile = (file: Express.Multer.File): void => {
  // 1. Validate file extension
  const extension = getFileExtension(file.originalname);

  if (!ALLOWED_EXTENSIONS.has(extension)) {
    const error: AppError = new Error(`File extension ${extension || '(none)'} is not allowed`);
    error.statusCode = 400;
    throw error;
  }

  // 2. Validate MIME type
  if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
    const error: AppError = new Error(`File type ${file.mimetype} is not allowed`);
    error.statusCode = 400;
    throw error;
  }

  // 3. Validate file size
  if (file.size > MAX_FILE_SIZE_BYTES) {
    const error: AppError = new Error(
      `File exceeds the ${MAX_FILE_SIZE_BYTES / (1024 * 1024)}MB limit`,
    );
    error.statusCode = 400;
    throw error;
  }

  // 4. Validate actual file content
  const signature = detectFileSignature(file.buffer);

  if (signature === 'unknown') {
    const error: AppError = new Error(
      'File content does not match a supported file type (PDF, JPEG, PNG, WebP, or TIFF)',
    );
    error.statusCode = 400;
    throw error;
  }

  // 5. Make sure actual content matches the extension
  if (!isSignatureMatchingExtension(signature, extension)) {
    const error: AppError = new Error('File content does not match the file extension');
    error.statusCode = 400;
    throw error;
  }

  // 6. Make sure actual content matches the declared MIME type
  if (!isSignatureMatchingMimeType(signature, file.mimetype)) {
    const error: AppError = new Error('File content does not match the declared file type');
    error.statusCode = 400;
    throw error;
  }
};
