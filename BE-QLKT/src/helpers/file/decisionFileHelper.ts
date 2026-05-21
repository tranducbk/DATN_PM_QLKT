/*
 * ════════════════════════════════════════════════════════════════════════════
 *  DECISION FILE HELPER — query file PDF của số quyết định
 * ════════════════════════════════════════════════════════════════════════════
 *
 *  WRAPPER quanh decisionFileRepository:
 *  - Lookup file_path từ so_quyet_dinh.
 *  - Trả null thay vì throw nếu không tìm thấy.
 *
 *  DÙNG TRONG:
 *  - Admin click "Xem QĐ" → resolve path → res.sendFile.
 *  - Export Excel có cột link QĐ.
 *
 *  PERFORMANCE: 1 query/decision. Cải thiện: batch findMany với {in:[]}.
 * ════════════════════════════════════════════════════════════════════════════
 */

import { FileQuyetDinh } from '../../generated/prisma';
import { decisionFileRepository } from '../../repositories/decisionFile.repository';

/**
 * Gets the stored file path for a decision number.
 * @param soQuyetDinh - Decision number
 * @returns File path when found, otherwise null
 */
async function getDecisionFilePath(soQuyetDinh: string | null | undefined): Promise<string | null> {
  if (!soQuyetDinh || soQuyetDinh.trim() === '') {
    return null;
  }

  try {
    const decision = await decisionFileRepository.findUniqueRaw({
      where: { so_quyet_dinh: soQuyetDinh.trim() },
      select: { file_path: true },
    });

    return decision?.file_path || null;
  } catch (error) {
    console.error('DecisionFileHelper.getDecisionFilePath failed', { soQuyetDinh, error });
    return null;
  }
}

/**
 * Gets decision metadata by decision number.
 * @param soQuyetDinh - Decision number
 * @returns Decision record when found, otherwise null
 */
async function getDecisionInfo(
  soQuyetDinh: string | null | undefined
): Promise<FileQuyetDinh | null> {
  if (!soQuyetDinh || soQuyetDinh.trim() === '') {
    return null;
  }

  try {
    const decision = await decisionFileRepository.findUniqueRaw({
      where: { so_quyet_dinh: soQuyetDinh.trim() },
    });

    return decision;
  } catch (error) {
    console.error('DecisionFileHelper.getDecisionInfo failed', { soQuyetDinh, error });
    return null;
  }
}

export { getDecisionFilePath, getDecisionInfo };
