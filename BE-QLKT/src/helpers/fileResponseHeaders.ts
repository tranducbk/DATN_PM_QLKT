import path from 'path';
import type { Response } from 'express';

/** MIME cho file đính kèm quyết định / đề xuất (PDF, Word). */
export function contentTypeFromFilename(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  if (ext === '.pdf') return 'application/pdf';
  if (ext === '.doc') return 'application/msword';
  if (ext === '.docx')
    return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  return 'application/octet-stream';
}

/** Gắn header trước `res.sendFile`. */
export function setFileSendHeaders(
  res: Response,
  filename: string,
  disposition: 'inline' | 'attachment'
): void {
  res.setHeader('Content-Type', contentTypeFromFilename(filename));
  res.setHeader(
    'Content-Disposition',
    `${disposition}; filename="${encodeURIComponent(filename)}"`
  );
}
