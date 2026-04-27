import {
  CONG_HIEN_HE_SO_RANGES,
  type CongHienHeSoGroup,
} from '@/constants/danhHieu.constants';
import { PROPOSAL_TYPES } from '@/constants/proposal.constants';
import type {
  ApprovalImportSummary,
  DanhHieuItem,
  PositionHistoryEntry,
  ThanhTichItem,
  UnitInfoSource,
} from './types';

/**
 * Sums service months that fall into a specific he_so_chuc_vu group, then formats
 * the result as "X năm Y tháng" (or "—" when the group has no time).
 */
export function calculateTotalTimeByGroup(
  histories: PositionHistoryEntry[],
  group: CongHienHeSoGroup
): string {
  let totalMonths = 0;

  histories.forEach(history => {
    const heSo = Number(history.he_so_chuc_vu) || 0;
    const range = CONG_HIEN_HE_SO_RANGES[group];
    const belongsToGroup = range
      ? heSo >= range.min && (range.includeMax ? heSo <= range.max : heSo < range.max)
      : false;

    if (belongsToGroup && history.so_thang !== null && history.so_thang !== undefined) {
      totalMonths += history.so_thang;
    }
  });

  const years = Math.floor(totalMonths / 12);
  const remainingMonths = totalMonths % 12;

  if (totalMonths === 0) return '—';
  if (years > 0 && remainingMonths > 0) {
    return `${years} năm ${remainingMonths} tháng`;
  }
  if (years > 0) {
    return `${years} năm`;
  }
  return `${remainingMonths} tháng`;
}

/**
 * Reads a `display` string from a service-time JSON value (object or stringified).
 * Returns null when the value is missing, malformed, or empty.
 */
export function getDurationDisplay(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === 'object' && value !== null) {
    const display = (value as { display?: unknown }).display;
    return typeof display === 'string' && display.trim() ? display : null;
  }
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value) as { display?: unknown };
      return typeof parsed.display === 'string' && parsed.display.trim() ? parsed.display : null;
    } catch {
      return null;
    }
  }
  return null;
}

export function parseJsonArray<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];
  if (value && typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? (parsed as T[]) : [];
    } catch {
      return [];
    }
  }
  return [];
}

export function formatUnitInfo(record: UnitInfoSource): string | null {
  const coQuanDonVi = record.co_quan_don_vi?.ten_co_quan_don_vi;
  const donViTrucThuoc = record.don_vi_truc_thuoc?.ten_don_vi;
  const parts: string[] = [];
  if (donViTrucThuoc) parts.push(donViTrucThuoc);
  if (coQuanDonVi) parts.push(coQuanDonVi);
  return parts.length > 0 ? parts.join(', ') : null;
}

interface CollectMissingDecisionsInput {
  loaiDeXuat: string;
  editedDanhHieu: DanhHieuItem[];
  editedThanhTich: ThanhTichItem[];
  editedNienHan: DanhHieuItem[];
  editedCongHien: DanhHieuItem[];
}

export function collectMissingDecisions(input: CollectMissingDecisionsInput): string[] {
  const { loaiDeXuat, editedDanhHieu, editedThanhTich, editedNienHan, editedCongHien } = input;
  const missingDecisions: string[] = [];

  editedDanhHieu.forEach((item, index) => {
    const hasQD =
      item.so_quyet_dinh?.trim() ||
      item.so_quyet_dinh_bkbqp ||
      item.so_quyet_dinh_cstdtq ||
      item.so_quyet_dinh_bkttcp;
    if (!hasQD) {
      const label =
        loaiDeXuat === PROPOSAL_TYPES.DON_VI_HANG_NAM
          ? `Đơn vị ${index + 1}: ${item.ten_don_vi || 'N/A'}`
          : `Quân nhân ${index + 1}: ${item.ho_ten || 'N/A'}`;
      missingDecisions.push(label);
    }
  });

  editedThanhTich.forEach((item, index) => {
    if (!item.so_quyet_dinh || item.so_quyet_dinh.trim() === '') {
      missingDecisions.push(`Thành tích ${index + 1}: ${item.ho_ten || 'N/A'}`);
    }
  });

  editedNienHan.forEach((item, index) => {
    const label = `Huy chương Chiến sĩ vẻ vang ${index + 1}: ${item.ho_ten || 'N/A'}`;
    if (!item.so_quyet_dinh || item.so_quyet_dinh.trim() === '') {
      missingDecisions.push(label);
    } else if (!item.thang_nhan || !item.nam_nhan) {
      missingDecisions.push(`${label} (thiếu tháng nhận)`);
    }
  });

  editedCongHien.forEach((item, index) => {
    const label = `Huân chương Bảo vệ Tổ quốc ${index + 1}: ${item.ho_ten || 'N/A'}`;
    if (!item.so_quyet_dinh || item.so_quyet_dinh.trim() === '') {
      missingDecisions.push(label);
    } else if (!item.thang_nhan || !item.nam_nhan) {
      missingDecisions.push(`${label} (thiếu tháng nhận)`);
    }
  });

  return missingDecisions;
}

export function buildApprovalSuccessMessage(
  summary: ApprovalImportSummary,
  loaiDeXuat: string | undefined
): string {
  const importedDanhHieu = summary.imported_danh_hieu || 0;
  const totalDanhHieu = summary.total_danh_hieu || 0;
  const importedThanhTich = summary.imported_thanh_tich || 0;
  const totalThanhTich = summary.total_thanh_tich || 0;
  const importedNienHan = summary.imported_nien_han || 0;
  const totalNienHan = summary.total_nien_han || 0;

  const suffixMap: Record<string, string> = {
    [PROPOSAL_TYPES.NIEN_HAN]: `Đã thêm ${importedNienHan}/${totalNienHan} Huy chương Chiến sĩ vẻ vang thành công.`,
    [PROPOSAL_TYPES.HC_QKQT]: `Đã thêm ${importedNienHan}/${totalNienHan} Huy chương Quân kỳ quyết thắng thành công.`,
    [PROPOSAL_TYPES.KNC_VSNXD_QDNDVN]: `Đã thêm ${importedNienHan}/${totalNienHan} Kỷ niệm chương vì sự nghiệp xây dựng QĐNDVN thành công.`,
    [PROPOSAL_TYPES.CONG_HIEN]: `Đã thêm ${importedDanhHieu}/${totalDanhHieu} Huân chương Bảo vệ Tổ quốc thành công.`,
    [PROPOSAL_TYPES.NCKH]: `Đã thêm ${importedThanhTich}/${totalThanhTich} thành tích nghiên cứu khoa học thành công.`,
    [PROPOSAL_TYPES.DON_VI_HANG_NAM]: `Đã thêm ${importedDanhHieu}/${totalDanhHieu} khen thưởng đơn vị thành công.`,
  };

  const defaultSuffix =
    importedDanhHieu > 0 && importedThanhTich > 0
      ? `Đã thêm ${importedDanhHieu}/${totalDanhHieu} danh hiệu và ${importedThanhTich}/${totalThanhTich} thành tích nghiên cứu khoa học thành công.`
      : importedDanhHieu > 0
        ? `Đã thêm ${importedDanhHieu}/${totalDanhHieu} danh hiệu thành công.`
        : importedThanhTich > 0
          ? `Đã thêm ${importedThanhTich}/${totalThanhTich} thành tích nghiên cứu khoa học thành công.`
          : '';

  return `Đã phê duyệt đề xuất thành công. ${suffixMap[loaiDeXuat ?? ''] ?? defaultSuffix}`;
}
