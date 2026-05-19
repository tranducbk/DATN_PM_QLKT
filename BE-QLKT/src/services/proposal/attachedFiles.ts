import { promises as fs } from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { sanitizeFilename } from './helpers';

export interface AttachedFileInput {
  originalname: string;
  buffer: Buffer;
  size: number;
}

export interface AttachedFileInfo {
  filename: string;
  originalName: string;
  size: number;
  uploadedAt: string;
}

const STORAGE_PATH = path.join(__dirname, '..', '..', '..', 'storage', 'proposals');

/**
 * Persists uploaded attachments to disk and returns metadata for DB storage.
 * @param files - Multer file inputs
 * @returns Array of stored file metadata (filename uses timestamp+uuid prefix)
 */
export async function persistProposalAttachments(
  files: AttachedFileInput[] | null | undefined
): Promise<AttachedFileInfo[]> {
  if (!files || files.length === 0) return [];

  await fs.mkdir(STORAGE_PATH, { recursive: true });
  const result: AttachedFileInfo[] = [];

  for (const file of files) {
    if (!file?.buffer) continue;
    const rawName = file.originalname || 'file';
    const decodedName = Buffer.isBuffer(rawName)
      ? rawName.toString('utf8')
      : Buffer.from(rawName, 'latin1').toString('utf8');
    const sanitized = sanitizeFilename(decodedName);

    const timestamp = Date.now();
    const uniqueId = uuidv4().slice(0, 8);
    const ext = path.extname(sanitized);
    const base = path.basename(sanitized, ext);
    const savedFilename = `${timestamp}_${uniqueId}_${base}${ext}`;

    await fs.writeFile(path.join(STORAGE_PATH, savedFilename), file.buffer);

    result.push({
      filename: savedFilename,
      originalName: decodedName,
      size: file.size,
      uploadedAt: new Date().toISOString(),
    });
  }

  return result;
}
