import { promises as fs } from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { sanitizeFilename } from './helpers';

/*
 * ════════════════════════════════════════════════════════════════════════════
 *  PROPOSAL ATTACHMENTS — ghi file đính kèm xuống disk an toàn
 * ════════════════════════════════════════════════════════════════════════════
 *
 *  CHIẾN LƯỢC TRÁNH COLLISION (timestamp + uuid prefix):
 *
 *      <timestamp>_<uuid8>_<sanitized_original_name>.<ext>
 *      └─ now() ms┘└─8 char┘└─tên đã chuẩn hoá tiếng Việt─┘
 *
 *  Vì sao 2 lớp (timestamp + uuid):
 *    - timestamp: thuận tiện sort theo thời gian upload (debug + cleanup).
 *    - uuid8:    chống collision khi 2 upload xảy ra trong cùng 1 ms
 *                (server multi-core, 2 req parallel).
 *
 *  Vì sao KHÔNG check existsSync trước rồi mới write (như multer
 *  decisionUpload làm):
 *    - existsSync + writeFile KHÔNG atomic — race condition vẫn xảy ra.
 *    - timestamp+uuid là collision-free thật sự (xác suất trùng ≈ 0).
 *    - Tiết kiệm 1 syscall mỗi upload.
 *
 *  XỬ LÝ ENCODING tiếng Việt (decodedName):
 *    - Multer giao file.originalname dưới dạng Buffer hoặc string latin1.
 *    - Tên "Quyết định.pdf" trong UTF-8 = 16 bytes, browser POST gửi qua
 *      multipart đôi khi không khai báo charset → server hiểu theo latin1.
 *    - Phải re-decode latin1→utf8 để có lại chuỗi UTF-8 đúng.
 *    - Bug điển hình nếu skip: "Quyáº¿t" thay vì "Quyết".
 *
 *  SANITIZE FILENAME:
 *    - sanitizeFilename loại bỏ ký tự nguy hiểm (/, \, .., null byte) và
 *      ký tự đặc biệt OS không cho phép (vd: : * ? < > | trên Windows).
 *    - Sau sanitize mới ghép timestamp+uuid → đảm bảo savedFilename
 *      KHÔNG BAO GIỜ chứa path separator.
 *
 *  TRADE-OFF FILE ORPHAN (đã nói trong approve.ts):
 *    - Hàm này được gọi OUT-OF-TRANSACTION (trước khi $transaction).
 *    - Nếu transaction phía sau rollback → file đã ghi sẽ orphan.
 *    - CHẤP NHẬN vì: (a) orphan PDF không gây side-effect; (b) ghi file
 *      sau transaction nguy hiểm hơn (commit DB rồi mới ghi → fail ghi
 *      = DB nói "có file" nhưng disk không có); (c) cron job riêng có
 *      thể quét xoá file không liên kết với DB record.
 * ════════════════════════════════════════════════════════════════════════════
 */

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
