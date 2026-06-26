import { promises as fs } from 'fs';
import path from 'path';
import { STORAGE_PROPOSALS_DIR, ensureDir } from '../../configs/storagePaths';
import { buildTimestampedName, decodeOriginalName } from '../../helpers/file/fileNaming';

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

/**
 * Persists uploaded attachments to disk and returns metadata for DB storage.
 * @param files - Multer file inputs
 * @returns Array of stored file metadata (filename uses timestamp+uuid prefix)
 */
export async function persistProposalAttachments(
  files: AttachedFileInput[] | null | undefined
): Promise<AttachedFileInfo[]> {
  if (!files || files.length === 0) return [];

  ensureDir(STORAGE_PROPOSALS_DIR);
  const result: AttachedFileInfo[] = [];

  for (const file of files) {
    if (!file?.buffer) continue;
    const originalName = decodeOriginalName(file.originalname);
    const savedFilename = buildTimestampedName(file.originalname);

    await fs.writeFile(path.join(STORAGE_PROPOSALS_DIR, savedFilename), file.buffer);

    result.push({
      filename: savedFilename,
      originalName,
      size: file.size,
      uploadedAt: new Date().toISOString(),
    });
  }

  return result;
}
