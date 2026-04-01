import multer, { FileFilterCallback } from 'multer';
import { Request } from 'express';
import path from 'path';
import fs from 'fs';

/** Creates a reusable fileFilter that checks against a list of allowed MIME types. */
function createFileFilter(allowedMimes: string[], errorMessage: string) {
  return (req: Request, file: Express.Multer.File, cb: FileFilterCallback): void => {
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(errorMessage));
    }
  };
}

/** Creates a reusable diskStorage destination callback for a fixed directory. */
function createDestination(dir: string) {
  return (
    req: Request,
    file: Express.Multer.File,
    cb: (error: Error | null, destination: string) => void
  ): void => {
    cb(null, dir);
  };
}

const MB = 1024 * 1024;

const MIME = {
  XLSX: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  XLS: 'application/vnd.ms-excel',
  PDF: 'application/pdf',
  DOC: 'application/msword',
  DOCX: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  JPEG: 'image/jpeg',
  JPG: 'image/jpg',
  PNG: 'image/png',
} as const;

const decisionUploadDir = path.join(__dirname, '..', '..', 'uploads', 'decisions');
if (!fs.existsSync(decisionUploadDir)) {
  fs.mkdirSync(decisionUploadDir, { recursive: true });
}

/**
 * Shared multer configuration for Excel-only file uploads.
 * Used by import routes: awards, commemorativeMedal, contributionAward, hccsvv, militaryFlag.
 */
export const excelUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * MB },
  fileFilter: createFileFilter(
    [MIME.XLSX, MIME.XLS],
    'Chi chap nhan file Excel (.xlsx, .xls)'
  ),
});

/**
 * Shared multer configuration for PDF/Excel/Word file uploads.
 * Used by proposal routes and other routes that accept documents.
 */
export const documentUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * MB },
  fileFilter: createFileFilter(
    [MIME.XLSX, MIME.XLS, MIME.PDF, MIME.DOC, MIME.DOCX],
    'Chi chap nhan file Excel (.xlsx, .xls), PDF (.pdf), hoac Word (.doc, .docx)'
  ),
});

/**
 * Decision upload — diskStorage variant for decision routes.
 * Saves files to uploads/decisions with deduplication logic for filenames.
 */
export const decisionUpload = multer({
  storage: multer.diskStorage({
    destination: createDestination(decisionUploadDir),
    filename: (req, file, cb) => {
      const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');
      const ext = path.extname(originalName);
      const baseName = path.basename(originalName, ext);

      let filename = originalName;
      let counter = 1;

      while (fs.existsSync(path.join(decisionUploadDir, filename))) {
        filename = `${baseName}(${counter})${ext}`;
        counter++;
      }

      cb(null, filename);
    },
  }),
  limits: { fileSize: 10 * MB },
  fileFilter: createFileFilter(
    [MIME.PDF, MIME.DOC, MIME.DOCX],
    'Chi chap nhan file PDF, DOC, DOCX'
  ),
});

/**
 * PDF-only upload — diskStorage variant for annual reward / unit annual award decision files.
 * Saves files to uploads/decisions with timestamp-prefixed filenames.
 */
export const pdfDecisionUpload = multer({
  storage: multer.diskStorage({
    destination: createDestination(decisionUploadDir),
    filename: (req, file, cb) => {
      const uniqueName = `${Date.now()}-${file.originalname}`;
      cb(null, uniqueName);
    },
  }),
  limits: { fileSize: 10 * MB },
  fileFilter: createFileFilter([MIME.PDF], 'Chi chap nhan file PDF'),
});

/**
 * Ad-hoc award upload — memoryStorage for ad-hoc awards with images + documents.
 * Accepts PDF, images (JPEG, PNG), Word, and Excel files.
 */
export const adhocAwardUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * MB },
  fileFilter: createFileFilter(
    [MIME.PDF, MIME.JPEG, MIME.PNG, MIME.JPG, MIME.DOC, MIME.DOCX, MIME.XLS, MIME.XLSX],
    'File type not allowed. Only PDF, images (JPEG, PNG), Word, and Excel files are accepted.'
  ),
});

/**
 * Bulk upload — memoryStorage with no file filter (for generic bulk operations with attachments).
 */
export const bulkUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * MB },
});

/** The shared upload directory for decision files */
export { decisionUploadDir };
