import path from 'path';
import type { Response } from 'express';

/**
 * Resolves MIME type based on filename extension.
 * @param filename - Original file name
 * @returns MIME type used for response headers
 */
export function contentTypeFromFilename(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  if (ext === '.pdf') return 'application/pdf';
  if (ext === '.doc') return 'application/msword';
  if (ext === '.docx')
    return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  return 'application/octet-stream';
}

/**
 * Sets response headers before sending file content.
 * @param res - Express response instance
 * @param filename - Original file name
 * @param disposition - Content disposition mode
 * @returns Nothing
 */
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
