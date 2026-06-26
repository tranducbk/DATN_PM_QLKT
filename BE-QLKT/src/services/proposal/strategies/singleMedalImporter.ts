import { calculateServiceMonths, formatServiceDuration } from '../../../helpers/serviceYearsHelper';
import type { ProposalNienHanItem } from '../../../types/proposal';
import type { ProposalApproveContext, ImportAccumulator, PrismaTx } from './proposalStrategy';
import { formatPersonnelLabel } from './personnelLabel';
import { quanNhanRepository } from '../../../repositories/quanNhan.repository';

/*
 * ════════════════════════════════════════════════════════════════════════════
 *  SINGLE MEDAL IMPORTER — TEMPLATE METHOD PATTERN cho HC_QKQT & KNC
 * ════════════════════════════════════════════════════════════════════════════
 *
 *  WHY EXTRACT THÀNH HELPER?
 *  HC_QKQT và KNC có 90% logic giống nhau:
 *    - "Một huân chương trên đời" (one record per personnel, lifetime).
 *    - Cần ngay_nhap_ngu để tính số tháng phục vụ.
 *    - Validate năm/tháng nhận >= năm/tháng đề xuất.
 *    - Validate năm nhận >= năm quyết định.
 *    - Lưu thoi_gian JSON snapshot tại thời điểm trao.
 *
 *  Chỉ khác:
 *    - HC_QKQT: ghi vào bảng huanChuongQuanKyQuyetThang.
 *    - KNC:     ghi vào bảng kyNiemChuongVSNXDQDNDVN.
 *
 *  TEMPLATE METHOD:
 *  - Phần KHUNG (validate + tính toán) ở helper này.
 *  - Phần KHÁC BIỆT (upsert vào bảng nào) inject qua callback `cfg.upsert`.
 *  → Strategy con (hcqkqtStrategy, kncStrategy) chỉ cần định nghĩa callback.
 *
 *  VALIDATION CHAIN (4 lớp, fail-fast vào acc.errors):
 *    ① personnel_id tồn tại
 *    ② personnel exist trong DB (chưa bị xoá)
 *    ③ nam_nhan + thang_nhan hợp lệ (1-12)
 *    ④ nam/thang_nhan >= nam/thang đề xuất (không cho nhận retro)
 *    ⑤ nam_nhan >= nam_quyet_dinh (nhận sau khi quyết định ký)
 *
 *  THOI_GIAN SNAPSHOT:
 *  Lưu JSON { total_months, years, months, display } TẠI THỜI ĐIỂM TRAO.
 *  Lý do snapshot thay vì compute on-the-fly:
 *    - Trao huân chương là sự kiện cố định trong quá khứ.
 *    - Quân nhân thăng chức/chuyển đơn vị về sau KHÔNG ảnh hưởng thông tin
 *      "lúc trao đã bao nhiêu năm phục vụ".
 *    - Tránh tính lại mỗi lần render → tiết kiệm.
 *
 *  EDGE CASE personnel chưa xuất ngũ:
 *  ngayKetThuc fallback = new Date(namNhan, thangNhan, 0) = ngày cuối
 *  tháng nhận. Vì sao day=0: trong JS Date, `new Date(year, month, 0)`
 *  trả về ngày cuối của THÁNG TRƯỚC (month là 0-indexed nhưng day=0
 *  rollback 1 ngày). Vd: new Date(2024, 6, 0) = 30/06/2024 (cuối tháng 6).
 * ════════════════════════════════════════════════════════════════════════════
 */

interface SingleMedalConfig {
  /** Logical medal name shown in error messages (e.g. "Huân chương Quân kỳ quyết thắng"). */
  medalLabel: string;
  /** Short tag for [approveProposal] log prefix (e.g. "HC_QKQT", "KNC"). */
  logTag: string;
  /** Decision-mapping key used to resolve so_quyet_dinh fallback. */
  decisionKey: string;
  /**
   * Per-record upsert against the medal table. Caller owns the model so this
   * helper stays decoupled from generated Prisma types.
   */
  upsert: (
    prismaTx: PrismaTx,
    personnelId: string,
    writeData: SingleMedalWriteData
  ) => Promise<void>;
}

interface SingleMedalWriteData {
  nam: number;
  thang: number;
  cap_bac: string | null;
  chuc_vu: string | null;
  ghi_chu: string | null;
  so_quyet_dinh: string | null;
  // Loose shape — Prisma JSON columns accept arbitrary structured data.
  thoi_gian: Record<string, unknown> | null;
}

/**
 * Imports single-row "one per personnel" medals (HC_QKQT, KNC_VSNXD_QDNDVN).
 * Validates personnel + nam_nhan/thang_nhan ordering vs proposal + decision date,
 * computes service-time JSON, then delegates the table write to `cfg.upsert`.
 */
export async function importSingleMedal(
  items: ProposalNienHanItem[],
  ctx: ProposalApproveContext,
  acc: ImportAccumulator,
  prismaTx: PrismaTx,
  cfg: SingleMedalConfig
): Promise<void> {
  const decisionMapping = ctx.mappings?.decisionMapping ?? {};
  const proposalYear = ctx.proposalYear;
  const proposalMonth = ctx.proposalMonth;

  for (const item of items) {
    try {
      if (!item.personnel_id) {
        acc.errors.push(`Thiếu thông tin quân nhân khi xử lý ${cfg.medalLabel}.`);
        continue;
      }
      const personnel = await quanNhanRepository.findUniqueRaw(
        { where: { id: item.personnel_id } },
        prismaTx
      );
      if (!personnel) {
        acc.errors.push(
          `Không tìm thấy thông tin quân nhân khi xử lý ${cfg.medalLabel}. ` +
            `Quân nhân có thể đã bị xoá khỏi hệ thống — vui lòng tải lại đề xuất.`
        );
        continue;
      }

      const danhHieuDecision = decisionMapping[cfg.decisionKey] || {};
      const soQuyetDinh = item.so_quyet_dinh || danhHieuDecision.so_quyet_dinh || null;
      const namNhan = item.nam_nhan;
      const thangNhan = item.thang_nhan;

      if (!namNhan || !thangNhan || thangNhan < 1 || thangNhan > 12) {
        acc.errors.push(
          `${formatPersonnelLabel(personnel)} thiếu tháng/năm nhận ${cfg.medalLabel}`
        );
        continue;
      }
      if (
        namNhan < proposalYear ||
        (proposalMonth != null && namNhan === proposalYear && thangNhan < proposalMonth)
      ) {
        acc.errors.push(
          `${formatPersonnelLabel(personnel)}: tháng/năm nhận (${thangNhan}/${namNhan}) không được trước tháng/năm đề xuất (${proposalMonth ?? '--'}/${proposalYear})`
        );
        continue;
      }
      if (item.nam_quyet_dinh && namNhan < item.nam_quyet_dinh) {
        acc.errors.push(
          `${formatPersonnelLabel(personnel)}: năm nhận (${namNhan}) không được trước năm quyết định (${item.nam_quyet_dinh})`
        );
        continue;
      }

      let thoiGian: Record<string, unknown> | null = null;
      if (personnel.ngay_nhap_ngu) {
        const ngayKetThuc = personnel.ngay_xuat_ngu
          ? new Date(personnel.ngay_xuat_ngu)
          : new Date(namNhan, thangNhan, 0);
        const months = calculateServiceMonths(new Date(personnel.ngay_nhap_ngu), ngayKetThuc);
        thoiGian = {
          total_months: months,
          years: Math.floor(months / 12),
          months: months % 12,
          display: formatServiceDuration(months),
        };
      }

      await cfg.upsert(prismaTx, personnel.id, {
        nam: namNhan,
        thang: thangNhan,
        cap_bac: item.cap_bac || null,
        chuc_vu: item.chuc_vu || null,
        ghi_chu: item.ghi_chu || null,
        so_quyet_dinh: soQuyetDinh,
        thoi_gian: thoiGian,
      });

      acc.importedNienHan++;
      acc.affectedPersonnelIds.add(personnel.id);
    } catch (error) {
      console.error(`[approveProposal] ${cfg.logTag} error:`, {
        personnel_id: item.personnel_id,
        error,
      });
      acc.errors.push(`Có lỗi xảy ra khi lưu ${cfg.medalLabel}, vui lòng thử lại.`);
    }
  }
}
