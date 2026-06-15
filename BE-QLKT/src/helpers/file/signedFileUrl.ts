import crypto from 'crypto';
import path from 'path';
import { JWT_SECRET } from '../../configs';

/*
 * ════════════════════════════════════════════════════════════════════════════
 *  SIGNED FILE URL — phục vụ file nội bộ an toàn không cần token trong URL
 * ════════════════════════════════════════════════════════════════════════════
 *
 *  BÀI TOÁN:
 *  - Hệ thống KHÔNG dùng express.static → mọi file phải qua API có kiểm soát.
 *  - Nhưng để browser mở PDF/ảnh ở tab mới (native viewer) thì request đi
 *    thẳng từ <a>/window.open → KHÔNG gắn được header Authorization.
 *  - Nhúng JWT vào URL thì token sống lâu, dễ lộ qua history/log/referrer.
 *
 *  GIẢI PHÁP — signed URL ngắn hạn:
 *  - Chữ ký = HMAC-SHA256(JWT_SECRET, "path:exp:downloadName").
 *  - URL tự nó là credential, hết hạn sau 5 phút (SIGNED_URL_TTL_MS).
 *  - Sửa path/exp/name → chữ ký sai → 403. Không đoán được chữ ký vì không
 *    biết JWT_SECRET.
 *
 *  3 LỚP PHÒNG THỦ (verifySignedFileUrl + isAllowedFilePath):
 *  ① Hết hạn: now > exp → reject (link cũ vô dụng).
 *  ② Chữ ký: so khớp bằng crypto.timingSafeEqual → chống timing attack (so
 *     sánh byte thường rò rỉ thời gian → đoán dần chữ ký).
 *  ③ Whitelist thư mục: chỉ 3 folder hợp lệ + chặn ".." → path traversal
 *     không escape ra ngoài storage được (vd "../../.env").
 * ════════════════════════════════════════════════════════════════════════════
 */

const SIGNED_URL_TTL_MS = 5 * 60 * 1000;
const PROJECT_ROOT = path.join(__dirname, '..', '..', '..');

// Internal files may only be served from these project-root-relative directories.
const ALLOWED_PREFIXES = ['uploads/decisions/', 'uploads/adhoc-awards/', 'storage/proposals/'];

function normalize(relativePath: string): string {
  return (relativePath || '').replace(/\\/g, '/').replace(/^\/+/, '');
}

function computeSignature(relativePath: string, exp: number, downloadName: string): string {
  return crypto
    .createHmac('sha256', JWT_SECRET)
    .update(`${relativePath}:${exp}:${downloadName}`)
    .digest('hex');
}

/**
 * Checks a relative path stays within an allowed file directory (no traversal).
 * @param relativePath - Project-root-relative file path
 * @returns `true` when the path is inside an allowed directory
 */
export function isAllowedFilePath(relativePath: string): boolean {
  const normalized = normalize(relativePath);
  if (!normalized || normalized.includes('..')) return false;
  return ALLOWED_PREFIXES.some(prefix => normalized.startsWith(prefix));
}

/**
 * Builds a short-lived signed view URL for an internal file. The signature is the
 * access credential, so the URL works without a token until it expires.
 * @param relativePath - Project-root-relative file path (e.g. "uploads/decisions/QD.pdf")
 * @param downloadName - Optional display name for the viewer/download (defaults to the file's own name)
 * @returns Signed path under /api/files/view
 */
export function buildSignedFileUrl(relativePath: string, downloadName: string = ''): string {
  const normalized = normalize(relativePath);
  const exp = Date.now() + SIGNED_URL_TTL_MS;
  const sig = computeSignature(normalized, exp, downloadName);
  const namePart = downloadName ? `&n=${encodeURIComponent(downloadName)}` : '';
  return `/api/files/view?p=${encodeURIComponent(normalized)}&exp=${exp}&sig=${sig}${namePart}`;
}

/**
 * Verifies a signed file request: matching signature and not expired.
 * @param relativePath - Decoded relative path from the query
 * @param exp - Expiry epoch ms from the query
 * @param sig - Signature from the query
 * @param downloadName - Decoded display name from the query (empty when absent)
 * @returns `true` when the request is authentic and still valid
 */
export function verifySignedFileUrl(
  relativePath: string,
  exp: number,
  sig: string,
  downloadName: string = ''
): boolean {
  if (!relativePath || !exp || !sig || Number.isNaN(exp) || Date.now() > exp) return false;
  const expected = computeSignature(normalize(relativePath), exp, downloadName);
  const provided = Buffer.from(sig);
  const valid = Buffer.from(expected);
  return provided.length === valid.length && crypto.timingSafeEqual(provided, valid);
}

/**
 * Resolves a relative file path to its absolute location under the project root.
 * @param relativePath - Project-root-relative file path
 * @returns Absolute filesystem path
 */
export function resolveFileAbsolutePath(relativePath: string): string {
  return path.join(PROJECT_ROOT, normalize(relativePath));
}
