import multer, { FileFilterCallback } from 'multer';
import { Request } from 'express';
import path from 'path';
import fs from 'fs';

/**
 * Shared multer configuration for Excel-only file uploads.
 * Used by import routes: awards, commemorativeMedal, contributionAward, hccsvv, militaryFlag.
 */
export const excelUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
  fileFilter: (_req: Request, file: Express.Multer.File, cb: FileFilterCallback): void => {
    const allowedMimeTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
      'application/vnd.ms-excel', // .xls
    ];

    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Chi chap nhan file Excel (.xlsx, .xls)'));
    }
  },
});

/**
 * Shared multer configuration for PDF/Excel/Word file uploads.
 * Used by proposal routes and other routes that accept documents.
 */
export const documentUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
  fileFilter: (_req: Request, file: Express.Multer.File, cb: FileFilterCallback): void => {
    const allowedMimeTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
      'application/vnd.ms-excel', // .xls
      'application/pdf', // .pdf
      'application/msword', // .doc
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
    ];

    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Chi chap nhan file Excel (.xlsx, .xls), PDF (.pdf), hoac Word (.doc, .docx)'));
    }
  },
});

/**
 * Decision upload — diskStorage variant for decision routes.
 * Saves files to uploads/decisions with deduplication logic for filenames.
 */
const decisionUploadDir = path.join(__dirname, '..', '..', 'uploads', 'decisions');
if (!fs.existsSync(decisionUploadDir)) {
  fs.mkdirSync(decisionUploadDir, { recursive: true });
}

export const decisionUpload = multer({
  storage: multer.diskStorage({
    destination: (
      _req: Request,
      _file: Express.Multer.File,
      cb: (error: Error | null, destination: string) => void
    ): void => {
      cb(null, decisionUploadDir);
    },
    filename: (
      _req: Request,
      file: Express.Multer.File,
      cb: (error: Error | null, filename: string) => void
    ): void => {
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
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (_req: Request, file: Express.Multer.File, cb: FileFilterCallback): void => {
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Chi chap nhan file PDF, DOC, DOCX'));
    }
  },
});

/**
 * PDF-only upload — diskStorage variant for annual reward / unit annual award decision files.
 * Saves files to uploads/decisions with timestamp-prefixed filenames.
 */
export const pdfDecisionUpload = multer({
  storage: multer.diskStorage({
    destination: (
      _req: Request,
      _file: Express.Multer.File,
      cb: (error: Error | null, destination: string) => void
    ): void => {
      cb(null, decisionUploadDir);
    },
    filename: (
      _req: Request,
      file: Express.Multer.File,
      cb: (error: Error | null, filename: string) => void
    ): void => {
      const uniqueName = `${Date.now()}-${file.originalname}`;
      cb(null, uniqueName);
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (_req: Request, file: Express.Multer.File, cb: FileFilterCallback): void => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Chi chap nhan file PDF'));
    }
  },
});

/**
 * Ad-hoc award upload — memoryStorage for ad-hoc awards with images + documents.
 * Accepts PDF, images (JPEG, PNG), Word, and Excel files.
 */
export const adhocAwardUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB per file
  },
  fileFilter: (_req: Request, file: Express.Multer.File, cb: FileFilterCallback): void => {
    const allowedMimes = [
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/jpg',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ];

    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(
        new Error(
          'File type not allowed. Only PDF, images (JPEG, PNG), Word, and Excel files are accepted.'
        )
      );
    }
  },
});

/**
 * Bulk upload — memoryStorage with no file filter (for generic bulk operations with attachments).
 */
export const bulkUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

/** The shared upload directory for decision files */
export { decisionUploadDir };
