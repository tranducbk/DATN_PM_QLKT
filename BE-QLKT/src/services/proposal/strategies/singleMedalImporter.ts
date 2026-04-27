import {
  calculateServiceMonths,
  formatServiceDuration,
} from '../../../helpers/serviceYearsHelper';
import type { ProposalNienHanItem } from '../../../types/proposal';
import type {
  ProposalApproveContext,
  ImportAccumulator,
  PrismaTx,
} from './proposalStrategy';
import { formatQuanNhanLabel } from './quanNhanLabel';

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
    quanNhanId: string,
    writeData: SingleMedalWriteData
  ) => Promise<void>;
}

export interface SingleMedalWriteData {
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
      const quanNhan = await prismaTx.quanNhan.findUnique({ where: { id: item.personnel_id } });
      if (!quanNhan) {
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
          `${formatQuanNhanLabel(quanNhan)} thiếu tháng/năm nhận ${cfg.medalLabel}`
        );
        continue;
      }
      if (
        namNhan < proposalYear ||
        (proposalMonth != null && namNhan === proposalYear && thangNhan < proposalMonth)
      ) {
        acc.errors.push(
          `${formatQuanNhanLabel(quanNhan)}: tháng/năm nhận (${thangNhan}/${namNhan}) không được trước tháng/năm đề xuất (${proposalMonth ?? '--'}/${proposalYear})`
        );
        continue;
      }
      if (item.nam_quyet_dinh && namNhan < item.nam_quyet_dinh) {
        acc.errors.push(
          `${formatQuanNhanLabel(quanNhan)}: năm nhận (${namNhan}) không được trước năm quyết định (${item.nam_quyet_dinh})`
        );
        continue;
      }

      let thoiGian: Record<string, unknown> | null = null;
      if (quanNhan.ngay_nhap_ngu) {
        const ngayKetThuc = quanNhan.ngay_xuat_ngu
          ? new Date(quanNhan.ngay_xuat_ngu)
          : new Date(namNhan, thangNhan, 0);
        const months = calculateServiceMonths(new Date(quanNhan.ngay_nhap_ngu), ngayKetThuc);
        thoiGian = {
          total_months: months,
          years: Math.floor(months / 12),
          months: months % 12,
          display: formatServiceDuration(months),
        };
      }

      await cfg.upsert(prismaTx, quanNhan.id, {
        nam: namNhan,
        thang: thangNhan,
        cap_bac: item.cap_bac || null,
        chuc_vu: item.chuc_vu || null,
        ghi_chu: item.ghi_chu || null,
        so_quyet_dinh: soQuyetDinh,
        thoi_gian: thoiGian,
      });

      acc.importedNienHan++;
      acc.affectedPersonnelIds.add(quanNhan.id);
    } catch (error) {
      console.error(`[approveProposal] ${cfg.logTag} error:`, {
        personnel_id: item.personnel_id,
        error,
      });
      acc.errors.push(`Có lỗi xảy ra khi lưu ${cfg.medalLabel}, vui lòng thử lại.`);
    }
  }
}
