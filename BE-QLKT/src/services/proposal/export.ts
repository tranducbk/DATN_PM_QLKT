import { promises as fs } from 'fs';
import path from 'path';
import { NotFoundError } from '../../middlewares/errorHandler';

/*
 * ════════════════════════════════════════════════════════════════════════════
 *  GET PDF FILE — resolve file path từ 2 storage location
 * ════════════════════════════════════════════════════════════════════════════
 *
 *  2 NƠI LƯU FILE PDF (do lịch sử migration):
 *
 *  ① storage/proposals/        (current — file đính kèm Manager + Admin)
 *     - Quản lý qua attachedFiles.ts
 *     - Filename: <timestamp>_<uuid>_<name>.pdf
 *
 *  ② uploads/decisions/        (legacy — file PDF quyết định)
 *     - Quản lý qua decisionUpload multer + decisionMappings sync
 *     - Filename: dedup counter "(1)", "(2)"
 *
 *  FALLBACK STRATEGY:
 *  1. Thử primaryFilePath (storage/proposals) trước.
 *  2. Nếu không tồn tại → fallback uploads/decisions.
 *  3. Cả 2 đều không có → throw NotFoundError.
 *
 *  WHY fallback (không union 1 folder):
 *  - Legacy data đã ở uploads/decisions từ trước; migrate tốn effort.
 *  - 1 endpoint duy nhất phục vụ cả 2 → FE không cần biết file ở đâu.
 *  - Khi migrate xong → bỏ fallback path để code sạch.
 *
 *  ⚠️ SECURITY (path traversal đã chặn ở controller):
 *  - Filename đến đây ĐÃ qua check controller (xem proposal.controller.ts
 *    getPdfFile) — đảm bảo không chứa "../", "/", "\".
 *  - path.join với base storage path + filename → kết quả vẫn nằm trong
 *    storage folder.
 *  - fs.access throw NẾU file ngoài permission → safety net cuối.
 *
 *  PERFORMANCE:
 *  - fs.access là syscall rẻ (chỉ stat metadata).
 *  - Không read file vào buffer ở đây — chỉ resolve path, controller
 *    dùng res.sendFile để stream → memory-efficient với file lớn.
 * ════════════════════════════════════════════════════════════════════════════
 */

/**
 * Resolves proposal PDFs from current and legacy storage paths.
 * @param {string} filename - PDF filename
 * @returns {Promise<Object>} Absolute file path info
 */
async function getPdfFile(filename) {
  const storagePath = path.join(__dirname, '..', '..', '..', 'storage', 'proposals');
  const primaryFilePath = path.join(storagePath, filename);
  try {
    await fs.access(primaryFilePath);
    return {
      filePath: primaryFilePath,
      filename,
    };
  } catch (error) {
    console.error('Failed to access proposal file at primary location:', error);
  }

  const decisionsPath = path.join(__dirname, '..', '..', '..', 'uploads', 'decisions');
  const fallbackFilePath = path.join(decisionsPath, filename);
  try {
    await fs.access(fallbackFilePath);
    return {
      filePath: fallbackFilePath,
      filename,
    };
  } catch (error) {
    console.error('Failed to access proposal file at fallback location:', error);
    throw new NotFoundError('File PDF');
  }
}

export { getPdfFile };
