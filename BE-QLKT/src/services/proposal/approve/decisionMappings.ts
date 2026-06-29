import { decisionFileRepository } from '../../../repositories/decisionFile.repository';
import { accountRepository } from '../../../repositories/account.repository';
import { promises as fs } from 'fs';
import path from 'path';
import { PROPOSAL_TYPES, type ProposalType } from '../../../constants/proposalTypes.constants';
import {
  DANH_HIEU_CA_NHAN_HANG_NAM,
  DANH_HIEU_DAC_BIET,
  DANH_HIEU_DON_VI_HANG_NAM,
  DANH_HIEU_HCCSVV,
} from '../../../constants/danhHieu.constants';
import { RESOURCE_SLUGS } from '../../../constants/resourceSlugs.constants';
import { writeSystemLog } from '../../../helpers/systemLogHelper';
import { AUDIT_ACTIONS } from '../../../constants/auditActions.constants';
import { resolveDedupName } from '../../../helpers/file/fileNaming';
import { UPLOADS_DECISIONS_DIR, DECISIONS_REL, ensureDir } from '../../../configs/storagePaths';
import type { ProposalDanhHieuItem, ProposalThanhTichItem } from '../../../types/proposal';
import type {
  DecisionInfo,
  DecisionInputMap,
  PrismaTx,
  ProposalContext,
  UploadedDecisionFile,
} from './types';

/*
 * ════════════════════════════════════════════════════════════════════════════
 *  DECISION MAPPINGS — lưu PDF quyết định + đồng bộ vào registry khi duyệt
 * ════════════════════════════════════════════════════════════════════════════
 *
 *  3 BƯỚC khi Admin duyệt đề xuất có PDF quyết định:
 *
 *  ① persistDecisionPdfs: ghi PDF xuống uploads/decisions/.
 *     - REUSE: nếu số QĐ đã có file_path trong DB → dùng lại, KHÔNG ghi thêm
 *       bản sao (nhiều danh hiệu cùng 1 số QĐ chỉ cần 1 file).
 *     - Dedup tên trùng bằng counter "(1)(2)" + decode latin1→utf8.
 *
 *  ② buildDecisionMappings: map mỗi danh hiệu (CSTT, DVQT, HCCSVV, ...) →
 *     { so_quyet_dinh, file_pdf } để bước import ghi vào bảng khen thưởng.
 *     BKBQP/CSTDTQ/BKTTCP tách riêng (specialDecisionMapping) vì là flag phụ
 *     của danh hiệu hằng năm, không phải danh hiệu chính.
 *
 *  ③ syncDecisionFiles: gom mọi số QĐ đã dùng → upsert vào FileQuyetDinh
 *     (registry trung tâm). Dùng upsert ATOMIC (update là no-op) để tránh
 *     P2002 khi 2 admin duyệt 2 đề xuất chung 1 số QĐ đồng thời, đồng thời
 *     giữ nguyên ngay_ky/nguoi_ky của lần sync đầu.
 *
 *  ⚠️ Ghi file (bước ①) chạy TRƯỚC $transaction; còn syncDecisionFiles ghi
 *     DB trong transaction (nhận tx). File orphan nếu transaction rollback —
 *     xem trade-off ở attachedFiles.ts.
 * ════════════════════════════════════════════════════════════════════════════
 */

/**
 * Persists uploaded decision PDFs and returns a key -> file path map.
 * Re-uses existing file paths when a decision number already has a stored PDF.
 */
export async function persistDecisionPdfs(
  decisions: DecisionInputMap,
  pdfFiles: Record<string, UploadedDecisionFile | undefined>
): Promise<Record<string, string | undefined>> {
  ensureDir(UPLOADS_DECISIONS_DIR);
  const pdfPaths: Record<string, string | undefined> = {};

  const getFilePathFromDB = async (soQuyetDinh: string | null | undefined) => {
    if (!soQuyetDinh) return null;
    try {
      const decision = await decisionFileRepository.findUniqueRaw({
        where: { so_quyet_dinh: soQuyetDinh },
        select: { file_path: true },
      });
      return decision?.file_path || null;
    } catch (error) {
      console.error('ProposalApprove.getFilePathFromDB failed', { soQuyetDinh, error });
      return null;
    }
  };

  const pdfFileToDecisionMap: Record<string, string | null | undefined> = {
    file_pdf_ca_nhan_hang_nam: decisions.so_quyet_dinh_ca_nhan_hang_nam,
    file_pdf_don_vi_hang_nam: decisions.so_quyet_dinh_don_vi_hang_nam,
    file_pdf_nien_han: decisions.so_quyet_dinh_nien_han,
    file_pdf_cong_hien: decisions.so_quyet_dinh_cong_hien,
    file_pdf_dot_xuat: decisions.so_quyet_dinh_dot_xuat,
    file_pdf_nckh: decisions.so_quyet_dinh_nckh,
  };

  for (const [key, file] of Object.entries(pdfFiles)) {
    if (file && file.buffer) {
      const soQuyetDinh = pdfFileToDecisionMap[key];
      const existingFilePath = await getFilePathFromDB(soQuyetDinh);
      if (existingFilePath) {
        pdfPaths[key] = existingFilePath;
      } else {
        const filename = await resolveDedupName(UPLOADS_DECISIONS_DIR, file.originalname);
        const filepath = path.join(UPLOADS_DECISIONS_DIR, filename);
        await fs.writeFile(filepath, file.buffer);
        pdfPaths[key] = `${DECISIONS_REL}/${filename}`;
      }
    }
  }

  return pdfPaths;
}

/** Builds award/title -> decision metadata maps used during DB import. */
export function buildDecisionMappings(
  decisions: DecisionInputMap,
  pdfPaths: Record<string, string | undefined>
): {
  decisionMapping: Record<string, DecisionInfo>;
  specialDecisionMapping: Record<string, DecisionInfo>;
} {
  const decisionMapping: Record<string, DecisionInfo> = {
    [DANH_HIEU_CA_NHAN_HANG_NAM.CSTT]: {
      so_quyet_dinh: decisions.so_quyet_dinh_cstt,
      file_pdf: pdfPaths.file_pdf_ca_nhan_hang_nam,
    },
    [DANH_HIEU_CA_NHAN_HANG_NAM.CSTDCS]: {
      so_quyet_dinh: decisions.so_quyet_dinh_cstdcs,
      file_pdf: pdfPaths.file_pdf_ca_nhan_hang_nam,
    },
    [DANH_HIEU_DON_VI_HANG_NAM.DVQT]: {
      so_quyet_dinh: decisions.so_quyet_dinh_don_vi_hang_nam,
      file_pdf: pdfPaths.file_pdf_don_vi_hang_nam,
    },
    [DANH_HIEU_DON_VI_HANG_NAM.DVTT]: {
      so_quyet_dinh: decisions.so_quyet_dinh_don_vi_hang_nam,
      file_pdf: pdfPaths.file_pdf_don_vi_hang_nam,
    },
    [DANH_HIEU_HCCSVV.HANG_BA]: {
      so_quyet_dinh: decisions.so_quyet_dinh_nien_han,
      file_pdf: pdfPaths.file_pdf_nien_han,
    },
    [DANH_HIEU_HCCSVV.HANG_NHI]: {
      so_quyet_dinh: decisions.so_quyet_dinh_nien_han,
      file_pdf: pdfPaths.file_pdf_nien_han,
    },
    [DANH_HIEU_HCCSVV.HANG_NHAT]: {
      so_quyet_dinh: decisions.so_quyet_dinh_nien_han,
      file_pdf: pdfPaths.file_pdf_nien_han,
    },
    [DANH_HIEU_DAC_BIET.HC_QKQT]: {
      so_quyet_dinh: decisions.so_quyet_dinh_nien_han,
      file_pdf: pdfPaths.file_pdf_nien_han,
    },
    [DANH_HIEU_DAC_BIET.KNC_VSNXD_QDNDVN]: {
      so_quyet_dinh: decisions.so_quyet_dinh_nien_han,
      file_pdf: pdfPaths.file_pdf_nien_han,
    },
  };

  const specialDecisionMapping: Record<string, DecisionInfo> = {
    [DANH_HIEU_CA_NHAN_HANG_NAM.BKBQP]: {
      so_quyet_dinh: decisions.so_quyet_dinh_bkbqp,
      file_pdf: pdfPaths.file_pdf_ca_nhan_hang_nam,
    },
    [DANH_HIEU_CA_NHAN_HANG_NAM.CSTDTQ]: {
      so_quyet_dinh: decisions.so_quyet_dinh_cstdtq,
      file_pdf: pdfPaths.file_pdf_ca_nhan_hang_nam,
    },
    [DANH_HIEU_CA_NHAN_HANG_NAM.BKTTCP]: {
      so_quyet_dinh: decisions.so_quyet_dinh_bkttcp,
      file_pdf: pdfPaths.file_pdf_ca_nhan_hang_nam,
    },
  };

  return { decisionMapping, specialDecisionMapping };
}

// Direct-match types resolve their PDF by comparing one decision number to one pdfPaths key.
// NCKH is excluded — it also matches against per-achievement so_quyet_dinh (handled below).
const DECISION_FILE_KEY: Partial<
  Record<ProposalType, { decisionKey: keyof DecisionInputMap; pdfKey: string }>
> = {
  [PROPOSAL_TYPES.CA_NHAN_HANG_NAM]: {
    decisionKey: 'so_quyet_dinh_ca_nhan_hang_nam',
    pdfKey: 'file_pdf_ca_nhan_hang_nam',
  },
  [PROPOSAL_TYPES.DON_VI_HANG_NAM]: {
    decisionKey: 'so_quyet_dinh_don_vi_hang_nam',
    pdfKey: 'file_pdf_don_vi_hang_nam',
  },
  [PROPOSAL_TYPES.NIEN_HAN]: {
    decisionKey: 'so_quyet_dinh_nien_han',
    pdfKey: 'file_pdf_nien_han',
  },
  [PROPOSAL_TYPES.CONG_HIEN]: {
    decisionKey: 'so_quyet_dinh_cong_hien',
    pdfKey: 'file_pdf_cong_hien',
  },
  [PROPOSAL_TYPES.DOT_XUAT]: {
    decisionKey: 'so_quyet_dinh_dot_xuat',
    pdfKey: 'file_pdf_dot_xuat',
  },
};

/** Resolves which `pdfPaths` key matches a decision number for the current proposal type. */
function resolveDecisionFilePath(
  proposalType: ProposalType,
  soQuyetDinh: string,
  decisions: DecisionInputMap,
  pdfPaths: Record<string, string | undefined>,
  thanhTichData: ProposalThanhTichItem[]
): string | null | undefined {
  if (proposalType === PROPOSAL_TYPES.NCKH) {
    const matchingThanhTich = thanhTichData.find(t => t.so_quyet_dinh === soQuyetDinh);
    if (
      (matchingThanhTich || decisions.so_quyet_dinh_nckh === soQuyetDinh) &&
      pdfPaths.file_pdf_nckh
    ) {
      return pdfPaths.file_pdf_nckh;
    }
    return null;
  }

  const entry = DECISION_FILE_KEY[proposalType];
  if (entry && decisions[entry.decisionKey] === soQuyetDinh) {
    return pdfPaths[entry.pdfKey];
  }
  return null;
}

/** Synchronizes used decision numbers + paths into the FileQuyetDinh registry. */
export async function syncDecisionFiles(
  ctx: ProposalContext,
  danhHieuData: ProposalDanhHieuItem[],
  thanhTichData: ProposalThanhTichItem[],
  decisions: DecisionInputMap,
  pdfPaths: Record<string, string | undefined>,
  tx: PrismaTx
): Promise<void> {
  const { proposal, proposalId, adminId } = ctx;
  const decisionsToSync = new Set<string>();

  for (const item of danhHieuData) {
    if (item.so_quyet_dinh) decisionsToSync.add(item.so_quyet_dinh);
    if (item.so_quyet_dinh_bkbqp) decisionsToSync.add(item.so_quyet_dinh_bkbqp);
    if (item.so_quyet_dinh_cstdtq) decisionsToSync.add(item.so_quyet_dinh_cstdtq);
  }
  for (const item of thanhTichData) {
    if (item.so_quyet_dinh) decisionsToSync.add(item.so_quyet_dinh);
  }

  if (decisions.so_quyet_dinh_ca_nhan_hang_nam)
    decisionsToSync.add(decisions.so_quyet_dinh_ca_nhan_hang_nam);
  if (decisions.so_quyet_dinh_don_vi_hang_nam)
    decisionsToSync.add(decisions.so_quyet_dinh_don_vi_hang_nam);
  if (decisions.so_quyet_dinh_nien_han) decisionsToSync.add(decisions.so_quyet_dinh_nien_han);
  if (decisions.so_quyet_dinh_cong_hien) decisionsToSync.add(decisions.so_quyet_dinh_cong_hien);
  if (decisions.so_quyet_dinh_dot_xuat) decisionsToSync.add(decisions.so_quyet_dinh_dot_xuat);
  if (decisions.so_quyet_dinh_nckh) decisionsToSync.add(decisions.so_quyet_dinh_nckh);

  const adminInfo = await accountRepository.findUniqueRaw(
    {
      where: { id: adminId },
      include: { QuanNhan: { select: { ho_ten: true } } },
    },
    tx
  );
  const ngayKy = new Date();
  const nguoiKy =
    (adminInfo as { QuanNhan?: { ho_ten?: string | null }; username?: string })?.QuanNhan?.ho_ten ||
    adminInfo?.username ||
    'Chưa cập nhật';

  const proposalType = proposal.loai_de_xuat as ProposalType;

  for (const soQuyetDinh of decisionsToSync) {
    if (!soQuyetDinh) continue;
    try {
      let filePath: string | null | undefined = resolveDecisionFilePath(
        proposalType,
        soQuyetDinh,
        decisions,
        pdfPaths,
        thanhTichData
      );

      if (!filePath) {
        const matchingDanhHieu = danhHieuData.find(
          d =>
            d.so_quyet_dinh === soQuyetDinh ||
            d.so_quyet_dinh_bkbqp === soQuyetDinh ||
            d.so_quyet_dinh_cstdtq === soQuyetDinh ||
            d.so_quyet_dinh_bkttcp === soQuyetDinh
        );
        if (matchingDanhHieu) {
          filePath =
            matchingDanhHieu.file_quyet_dinh ||
            matchingDanhHieu.file_quyet_dinh_bkbqp ||
            matchingDanhHieu.file_quyet_dinh_cstdtq ||
            matchingDanhHieu.file_quyet_dinh_bkttcp ||
            null;
        }
        if (!filePath) {
          const matchingThanhTich = thanhTichData.find(t => t.so_quyet_dinh === soQuyetDinh);
          if (matchingThanhTich && matchingThanhTich.file_quyet_dinh) {
            filePath = matchingThanhTich.file_quyet_dinh;
          }
        }
      }

      const loaiKhenThuong = proposal.loai_de_xuat || PROPOSAL_TYPES.CA_NHAN_HANG_NAM;

      // Atomic upsert avoids P2002 race when two admins approve proposals that share
      // a so_quyet_dinh concurrently. update is intentionally a no-op so existing
      // ngay_ky / nguoi_ky / ghi_chu from the original sync are preserved.
      await decisionFileRepository.upsertRaw(
        {
          where: { so_quyet_dinh: soQuyetDinh },
          create: {
            so_quyet_dinh: soQuyetDinh,
            nam: proposal.nam,
            ngay_ky: ngayKy,
            nguoi_ky: nguoiKy,
            file_path: filePath,
            loai_khen_thuong: loaiKhenThuong,
            ghi_chu: `Tự động đồng bộ từ đề xuất ${proposalId}`,
          },
          update: {},
        },
        tx
      );

      // Backfill file_path only when the existing row left it null and we now have one
      if (filePath) {
        await decisionFileRepository.updateMany(
          { so_quyet_dinh: soQuyetDinh, file_path: null },
          { file_path: filePath },
          tx
        );
      }
    } catch (error) {
      void writeSystemLog({
        action: AUDIT_ACTIONS.ERROR,
        resource: RESOURCE_SLUGS.PROPOSALS,
        description: 'ProposalApprove.syncDecisionFiles failed',
        payload: { proposalId, soQuyetDinh, error },
      });
    }
  }
}
