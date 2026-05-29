import { decisionFileRepository } from '../../../repositories/decisionFile.repository';
import { promises as fs } from 'fs';
import path from 'path';
import {
  PROPOSAL_TYPES,
  type ProposalType,
} from '../../../constants/proposalTypes.constants';
import {
  DANH_HIEU_CA_NHAN_HANG_NAM,
  DANH_HIEU_DAC_BIET,
  DANH_HIEU_DON_VI_HANG_NAM,
  DANH_HIEU_HCCSVV,
} from '../../../constants/danhHieu.constants';
import { writeSystemLog } from '../../../helpers/systemLogHelper';
import { sanitizeFilename } from '../helpers';
import type {
  ProposalDanhHieuItem,
  ProposalThanhTichItem,
} from '../../../types/proposal';
import type {
  DecisionInfo,
  DecisionInputMap,
  PrismaTx,
  ProposalContext,
  UploadedDecisionFile,
} from './types';

/**
 * Persists uploaded decision PDFs and returns a key -> file path map.
 * Re-uses existing file paths when a decision number already has a stored PDF.
 */
export async function persistDecisionPdfs(
  decisions: DecisionInputMap,
  pdfFiles: Record<string, UploadedDecisionFile | undefined>
): Promise<Record<string, string | undefined>> {
  const uploadsDir = path.join(__dirname, '..', '..', '..', '..', 'uploads', 'decisions');
  await fs.mkdir(uploadsDir, { recursive: true });
  const pdfPaths: Record<string, string | undefined> = {};

  const getUniqueFilename = async (originalName: string | Buffer | undefined) => {
    let processedName: string = (originalName as string) || 'file';
    try {
      if (Buffer.isBuffer(processedName)) {
        processedName = (processedName as Buffer).toString('utf8');
      } else if (typeof processedName === 'string') {
        processedName = Buffer.from(processedName, 'latin1').toString('utf8');
      }
    } catch {
      processedName = 'file';
    }
    const sanitized = sanitizeFilename(processedName);
    const ext = path.extname(sanitized);
    const baseName = path.basename(sanitized, ext);
    let filename = sanitized;
    let counter = 1;
    while (
      await fs
        .access(path.join(uploadsDir, filename))
        .then(() => true)
        .catch(() => false)
    ) {
      filename = `${baseName}(${counter})${ext}`;
      counter++;
    }
    return filename;
  };

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
        const filename = await getUniqueFilename(file.originalname);
        const filepath = path.join(uploadsDir, filename);
        await fs.writeFile(filepath, file.buffer);
        pdfPaths[key] = `uploads/decisions/${filename}`;
      }
    }
  }

  return pdfPaths;
}

/**
 * ╔══════════════════════════════════════════════════════════════════════╗
 * ║  DECISION MAPPING — gán so_quyet_dinh + file PDF cho từng danh hiệu  ║
 * ╠══════════════════════════════════════════════════════════════════════╣
 * ║  Trên UI duyệt, Admin chỉ nhập 1 số quyết định CHUNG cho mỗi loại    ║
 * ║  đề xuất (vd: `so_quyet_dinh_ca_nhan_hang_nam`). Nhưng khi import    ║
 * ║  vào DB, mỗi danh hiệu cần biết "QĐ của mình" để gán vào field      ║
 * ║  riêng. Hàm này build 2 map để strategy tra cứu:                     ║
 * ║                                                                       ║
 * ║  ① decisionMapping: cho danh hiệu CHÍNH (mỗi quân nhân 1 dòng       ║
 * ║     trong DanhHieuHangNam — vd CSTDCS, ĐVQT, HCCSVV...). Tất cả     ║
 * ║     dùng chung 1 file PDF.                                            ║
 * ║                                                                       ║
 * ║  ② specialDecisionMapping: cho 3 flag BKBQP/CSTDTQ/BKTTCP. Khác    ║
 * ║     biệt: flag này NẰM TRÊN CÙNG row với danh hiệu chính (vd: 1    ║
 * ║     row CSTDCS năm 2024 có thể có nhan_bkbqp=true). Vì vậy 3 flag  ║
 * ║     dùng MAP RIÊNG để strategy ghi vào field so_quyet_dinh_bkbqp,  ║
 * ║     so_quyet_dinh_cstdtq, so_quyet_dinh_bkttcp tương ứng.            ║
 * ╚══════════════════════════════════════════════════════════════════════╝
 */
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

/** Resolves which `pdfPaths` key matches a decision number for the current proposal type. */
function resolveDecisionFilePath(
  proposalType: ProposalType,
  soQuyetDinh: string,
  decisions: DecisionInputMap,
  pdfPaths: Record<string, string | undefined>,
  thanhTichData: ProposalThanhTichItem[]
): string | null | undefined {
  if (
    proposalType === PROPOSAL_TYPES.CA_NHAN_HANG_NAM &&
    decisions.so_quyet_dinh_ca_nhan_hang_nam === soQuyetDinh
  ) {
    return pdfPaths.file_pdf_ca_nhan_hang_nam;
  }
  if (
    proposalType === PROPOSAL_TYPES.DON_VI_HANG_NAM &&
    decisions.so_quyet_dinh_don_vi_hang_nam === soQuyetDinh
  ) {
    return pdfPaths.file_pdf_don_vi_hang_nam;
  }
  if (proposalType === PROPOSAL_TYPES.NIEN_HAN && decisions.so_quyet_dinh_nien_han === soQuyetDinh) {
    return pdfPaths.file_pdf_nien_han;
  }
  if (
    proposalType === PROPOSAL_TYPES.CONG_HIEN &&
    decisions.so_quyet_dinh_cong_hien === soQuyetDinh
  ) {
    return pdfPaths.file_pdf_cong_hien;
  }
  if (proposalType === PROPOSAL_TYPES.DOT_XUAT && decisions.so_quyet_dinh_dot_xuat === soQuyetDinh) {
    return pdfPaths.file_pdf_dot_xuat;
  }
  if (proposalType === PROPOSAL_TYPES.NCKH) {
    const matchingThanhTich = thanhTichData.find(t => t.so_quyet_dinh === soQuyetDinh);
    if (
      (matchingThanhTich || decisions.so_quyet_dinh_nckh === soQuyetDinh) &&
      pdfPaths.file_pdf_nckh
    ) {
      return pdfPaths.file_pdf_nckh;
    }
  }
  return null;
}

/**
 * SYNC FILE QUYẾT ĐỊNH — đồng bộ tất cả số QĐ được dùng trong đề xuất vào
 * bảng FileQuyetDinh (registry trung tâm).
 *
 *  TẠI SAO CẦN SYNC?
 *  Các bảng award (DanhHieuHangNam, KhenThuongHCCSVV, ...) có FK trỏ tới
 *  FileQuyetDinh.so_quyet_dinh. Nếu một số QĐ chưa từng tồn tại trong
 *  registry → INSERT award sẽ FK violation.
 *
 *  THUẬT TOÁN (chạy TRONG transaction, TRƯỚC khi import award):
 *  1. Gom tất cả số QĐ xuất hiện trong (item.so_quyet_dinh,
 *     item.so_quyet_dinh_bkbqp/cstdtq/bkttcp, decisions.so_quyet_dinh_*)
 *     vào 1 Set để dedupe.
 *  2. Với mỗi số QĐ:
 *     - upsert create-if-absent (kèm file_path nếu Admin đã upload PDF;
 *       nếu không thì null — file sẽ upload sau). upsert đảm bảo 2 đề
 *       xuất song song cùng tạo 1 số QĐ không đụng P2002 ở mức DB.
 *     - Nếu đã có nhưng file_path null + lần này có PDF → UPDATE để gắn
 *       file_path mới (lazy population, không ghi đè path đã có).
 *  3. Best-effort: nếu lỗi 1 số QĐ → log + skip, không throw rollback.
 *     Lý do: sync là idempotent — row đã tồn tại thì FK vẫn pass, lỗi
 *     transient không nên kéo cả approve transaction rollback.
 */
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

  const adminInfo = await tx.taiKhoan.findUnique({
    where: { id: adminId },
    include: { QuanNhan: { select: { ho_ten: true } } },
  });
  const ngayKy = new Date();
  const nguoiKy =
    (adminInfo as { QuanNhan?: { ho_ten?: string | null }; username?: string })?.QuanNhan?.ho_ten ||
    adminInfo?.username ||
    'Chưa cập nhật';

  const proposalType = proposal.loai_de_xuat as ProposalType;

  // RACE-AWARE: 2 đề xuất song song cùng dùng 1 số QĐ mới "123/QĐ-X" →
  // cả hai cùng định tạo. upsert (create-if-absent, update no-op) khiến
  // đề xuất sau không throw P2002 ở mức DB: nếu row đã được tạo, nhánh
  // update chạy thay cho insert → FK của insert award sau đó vẫn pass.
  // Backfill file_path qua updateMany WHERE file_path: null — atomic,
  // không read-then-write race, không ghi đè path đã có. try/catch giữ
  // lại như best-effort cho lỗi transient — không throw để khỏi rollback.
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
      await tx.fileQuyetDinh.upsert({
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
      });

      if (filePath) {
        await tx.fileQuyetDinh.updateMany({
          where: { so_quyet_dinh: soQuyetDinh, file_path: null },
          data: { file_path: filePath },
        });
      }
    } catch (error) {
      void writeSystemLog({
        action: 'ERROR',
        resource: 'proposals',
        description: 'ProposalApprove.syncDecisionFiles failed',
        payload: { proposalId, soQuyetDinh, error },
      });
    }
  }
}
