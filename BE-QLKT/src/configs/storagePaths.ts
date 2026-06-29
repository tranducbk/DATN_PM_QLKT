import path from 'path';
import fs from 'fs';

/**
 * Project root (BE-QLKT). Resolves to the same directory in dev (src/configs)
 * and prod (dist/configs) because both sit one level below the project root.
 */
export const PROJECT_ROOT = path.join(__dirname, '..', '..');

/** Decision files (quyết định) on disk. */
export const UPLOADS_DECISIONS_DIR = path.join(PROJECT_ROOT, 'uploads', 'decisions');
/** Proposal attachments (file đính kèm đề xuất) on disk. */
export const STORAGE_PROPOSALS_DIR = path.join(PROJECT_ROOT, 'storage', 'proposals');
/** SQL backups on disk. */
export const BACKUP_DIR = path.join(PROJECT_ROOT, 'backups');

/**
 * POSIX prefixes stored in DB `file_path`. Must stay byte-identical to the
 * allowlist in `helpers/file/signedFileUrl.ts`, otherwise serving is blocked.
 */
export const DECISIONS_REL = 'uploads/decisions';
export const PROPOSALS_REL = 'storage/proposals';

/**
 * Ensures a directory exists (recursive); no-op when already present.
 * @param dir - Absolute directory path
 */
export function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}
