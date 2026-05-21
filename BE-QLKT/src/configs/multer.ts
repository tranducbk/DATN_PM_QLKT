import multer, { FileFilterCallback } from 'multer';
import { Request } from 'express';
import path from 'path';
import fs from 'fs';

/*
 * ════════════════════════════════════════════════════════════════════════════
 *  MULTER CONFIG — upload file an toàn (MIME filter + size limit + storage)
 * ════════════════════════════════════════════════════════════════════════════
 *
 *  2 LOẠI STORAGE:
 *
 *  ① memoryStorage: file vào RAM (Buffer), KHÔNG ghi disk.
 *     - Dùng cho: Excel import (parse rồi vứt), proposal attachment
 *       (service tự quyết định lưu đâu).
 *     - Ưu: nhanh, không orphan file khi request fail.
 *     - Nhược: tốn RAM. Nếu user upload file 100MB × 10 request đồng thời
 *       = 1GB RAM. Vì vậy limit 10MB/file + rate limiter ở route.
 *
 *  ② diskStorage: file ghi thẳng vào disk khi receive.
 *     - Dùng cho: decision PDF (đã biết chắc cần lưu lâu dài).
 *     - Ưu: tiết kiệm RAM cho file lớn.
 *     - Nhược: nếu request fail giữa chừng → orphan file trên disk.
 *
 *  MIME FILTER (defence in depth):
 *  - Whitelist MIME → reject mọi loại không listed (vd: .exe, .sh, .html).
 *  - Tuy nhiên MIME có thể fake — không tin tưởng 100%. Lý do dùng filter
 *    vẫn là chặn 95% case + báo user sớm trước khi file vào RAM.
 *  - Bảo mật thật phải dựa thêm: (a) size limit, (b) không serve file
 *    inline cho domain chính (XSS risk), (c) sandbox antivirus nếu cần.
 *
 *  SIZE LIMIT (10MB / 50MB):
 *  - 10MB: đủ cho Excel báo cáo ~5000 dòng + PDF quyết định.
 *  - 50MB: adhoc award có ảnh resolution cao.
 *  - LƯU Ý: multer throw 'LIMIT_FILE_SIZE' nếu vượt → errorHandler
 *    bắt và trả 413 Payload Too Large.
 *
 *  ENCODING latin1 → utf8 (decisionUpload):
 *  - Browser POST multipart sometimes mã hoá filename theo latin1 (RFC
 *    2616 default). Tên file tiếng Việt "Quyết định.pdf" sẽ bị hỏng
 *    thành "Quyết định.pdf" nếu không re-decode.
 *  - Fix: Buffer.from(name, 'latin1').toString('utf8') khôi phục đúng.
 *
 *  FILENAME DEDUPLICATION (decisionUpload):
 *  - Race condition: 2 user upload cùng tên file đồng thời → file ghi đè.
 *  - Walk-counter "(1)", "(2)", ... append vào trước extension để dedupe.
 *  - LƯU Ý: chưa race-safe 100% (fs.existsSync + write không atomic).
 *    Production nên dùng UUID/timestamp prefix thay vì counter.
 * ════════════════════════════════════════════════════════════════════════════
 */

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
 * Bulk upload — memoryStorage for bulk operations with attachments (PDF, images, Word, Excel).
 */
export const bulkUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * MB },
  fileFilter: createFileFilter(
    [MIME.PDF, MIME.JPEG, MIME.JPG, MIME.PNG, MIME.DOC, MIME.DOCX, MIME.XLS, MIME.XLSX],
    'Chi chap nhan file PDF, anh (JPEG, PNG), Word, hoac Excel'
  ),
});

/** The shared upload directory for decision files */
export { decisionUploadDir };
