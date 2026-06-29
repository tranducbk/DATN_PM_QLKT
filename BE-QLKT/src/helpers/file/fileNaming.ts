import path from 'path';
import { promises as fs } from 'fs';
import { v4 as uuidv4 } from 'uuid';

const MAX_BASENAME_LENGTH = 200;
const UNIQUE_ID_LENGTH = 8;

/**
 * Decodes a multer `originalname` (usually latin1-encoded) into proper UTF-8.
 * @param raw - Raw original name from the upload (string or Buffer)
 * @returns UTF-8 decoded name, or 'file' when missing/undecodable
 */
export function decodeOriginalName(raw: string | Buffer | undefined | null): string {
  if (!raw) return 'file';
  if (Buffer.isBuffer(raw)) return raw.toString('utf8');
  try {
    return Buffer.from(raw, 'latin1').toString('utf8');
  } catch {
    return 'file';
  }
}

/**
 * Strips path/hostile characters and whitespace from a filename, keeping the extension.
 * @param filename - Client-provided filename
 * @returns Filesystem-safe `base.ext` (falls back to 'file')
 */
export function sanitizeFilename(filename: string): string {
  if (!filename || typeof filename !== 'string') {
    return 'file';
  }

  const ext = path.extname(filename);
  const baseName = path.basename(filename, ext);

  let sanitized = baseName
    .replace(/[/\\:*?"<>|]/g, '_')
    .replace(/\s+/g, '_')
    .replace(/_{2,}/g, '_')
    .replace(/^_+|_+$/g, '');

  if (!sanitized || sanitized.length === 0) {
    sanitized = 'file';
  }

  if (sanitized.length > MAX_BASENAME_LENGTH) {
    sanitized = sanitized.substring(0, MAX_BASENAME_LENGTH);
  }

  return sanitized + ext;
}

async function fileExists(filePath: string): Promise<boolean> {
  return fs
    .access(filePath)
    .then(() => true)
    .catch(() => false);
}

/**
 * Collision-proof stored name for attachments: `${timestamp}_${uuid8}_${base}${ext}`.
 * @param originalName - Raw upload name (decoded + sanitized internally)
 * @returns Unique filename safe to write without a disk existence check
 */
export function buildTimestampedName(originalName: string | Buffer | undefined | null): string {
  const sanitized = sanitizeFilename(decodeOriginalName(originalName));
  const ext = path.extname(sanitized);
  const base = path.basename(sanitized, ext);
  return `${Date.now()}_${uuidv4().slice(0, UNIQUE_ID_LENGTH)}_${base}${ext}`;
}

/**
 * Original-name-preserving stored name for decisions: appends `(n)` until the
 * name is free in `dir`. Decoded + sanitized first so the on-disk name is safe.
 * @param dir - Target directory (absolute)
 * @param originalName - Raw upload name
 * @returns A filename that does not yet exist in `dir`
 */
export async function resolveDedupName(
  dir: string,
  originalName: string | Buffer | undefined | null
): Promise<string> {
  const sanitized = sanitizeFilename(decodeOriginalName(originalName));
  const ext = path.extname(sanitized);
  const base = path.basename(sanitized, ext);

  let filename = sanitized;
  let counter = 1;
  while (await fileExists(path.join(dir, filename))) {
    filename = `${base}(${counter})${ext}`;
    counter++;
  }
  return filename;
}
