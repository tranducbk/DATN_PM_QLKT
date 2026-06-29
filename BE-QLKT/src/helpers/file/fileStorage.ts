import { promises as fs } from 'fs';
import path from 'path';
import { resolveFileAbsolutePath } from './signedFileUrl';
import { resolveDedupName } from './fileNaming';
import {
  PROPOSALS_REL,
  UPLOADS_DECISIONS_DIR,
  DECISIONS_REL,
  ensureDir,
} from '../../configs/storagePaths';

/**
 * Relative path of an attachment record: explicit `path`, else `PROPOSALS_REL/filename`.
 * @param meta - Attachment metadata
 * @returns Relative path, or null when neither field is present
 */
export function attachmentRelativePath(
  meta: { path?: string | null; filename?: string | null } | null | undefined
): string | null {
  if (!meta) return null;
  if (meta.path) return meta.path;
  if (meta.filename) return `${PROPOSALS_REL}/${meta.filename}`;
  return null;
}

/**
 * Best-effort delete of one stored file; never throws (missing file is silent,
 * other errors logged) so delete flows can finish removing DB rows.
 * @param relativePath - DB-stored path; falsy or containing ".." is a no-op
 * @returns true when a file was actually removed
 */
export async function deleteStoredFile(relativePath: string | null | undefined): Promise<boolean> {
  if (!relativePath || relativePath.includes('..')) return false;
  try {
    await fs.unlink(resolveFileAbsolutePath(relativePath));
    return true;
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    if (err.code !== 'ENOENT') {
      console.error('[deleteStoredFile] failed to remove file', { relativePath, code: err.code });
    }
    return false;
  }
}

/**
 * Best-effort delete of many stored files.
 * @param relativePaths - Project-root-relative paths (falsy entries skipped)
 * @returns Count of files actually removed
 */
export async function deleteStoredFiles(
  relativePaths: Array<string | null | undefined>
): Promise<number> {
  const results = await Promise.all(relativePaths.map(p => deleteStoredFile(p)));
  return results.filter(Boolean).length;
}

/**
 * Persists a decision PDF buffer to disk with a sanitized, deduped name.
 * @param file - Uploaded file (originalname + buffer)
 * @returns DB-relative path (e.g. "uploads/decisions/QD.pdf")
 */
export async function persistDecisionFile(file: {
  originalname: string | Buffer;
  buffer: Buffer;
}): Promise<string> {
  ensureDir(UPLOADS_DECISIONS_DIR);
  const filename = await resolveDedupName(UPLOADS_DECISIONS_DIR, file.originalname);
  await fs.writeFile(path.join(UPLOADS_DECISIONS_DIR, filename), file.buffer);
  return `${DECISIONS_REL}/${filename}`;
}
