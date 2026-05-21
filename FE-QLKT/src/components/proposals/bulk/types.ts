import type { DateInput } from '@/lib/types/common';

/*
 * ════════════════════════════════════════════════════════════════════════════
 *  BULK PROPOSAL WIZARD — 3-STEP PATTERN cho 7 loại đề xuất
 * ════════════════════════════════════════════════════════════════════════════
 *
 *  WIZARD FLOW (Manager nộp đề xuất hàng loạt):
 *
 *      ┌──── STEP 1 ────┐   ┌──── STEP 2 ────┐   ┌──── STEP 3 ────┐
 *      │ Chọn loại      │ → │ Chọn quân nhân │ → │ Gán danh hiệu  │
 *      │ + năm + tháng  │   │ (hoặc đơn vị)  │   │ + ghi chú      │
 *      └────────────────┘   └────────────────┘   └────────────────┘
 *                                                         │
 *                                                         ▼
 *                                                  ┌──── SUBMIT ────┐
 *                                                  │ POST /api/proposals
 *                                                  └────────────────┘
 *
 *  KIẾN TRÚC FILES (đã refactor để tách per-type):
 *
 *      Step2SelectPersonnel.tsx           ← base (CA_NHAN_HANG_NAM default)
 *      Step2SelectPersonnelCaNhanHangNam  ← override để show streak CSTDCS
 *      Step2SelectPersonnelCongHien       ← show số tháng giữ chức
 *      Step2SelectPersonnelHCQKQT         ← show ngày nhập ngũ + số năm
 *      Step2SelectPersonnelKNCVSNXDQDNDVN ← show giới + năm phục vụ
 *      Step2SelectPersonnelNCKH           ← show số NCKH đã có
 *      Step2SelectPersonnelNienHan        ← show 3 hạng HCCSVV đã nhận
 *      Step2SelectUnits                   ← cho DON_VI_HANG_NAM (đơn vị)
 *
 *      Step3SetTitles.tsx                 ← base (gán danh hiệu cá nhân)
 *      Step3SetTitles<Type>.tsx           ← override per-type với column riêng
 *
 *  WHY TÁCH 7 FILE thay vì 1 component có if/else:
 *  - Mỗi loại có cột bảng KHÁC NHAU (HCCSVV cần hiển thị 3 hạng đã có,
 *    KNC cần giới tính, ...). Inline switch case sẽ làm component phình
 *    to (1500+ dòng).
 *  - Test/develop song song: 7 dev có thể edit 7 file không conflict.
 *  - Future-proof: thêm loại mới chỉ tạo file mới + thêm route, không
 *    đụng các loại cũ.
 *
 *  SHARED via `types.ts` (file này) + `serviceDuration.ts`:
 *  - Step2Personnel interface chung (id, ho_ten, cccd, ...) → 7 file
 *    cùng dùng → đổi field 1 chỗ áp dụng cả 7.
 *  - serviceDuration helper tính số năm/tháng phục vụ → DRY.
 *
 *  HISTORY MODAL (re-usable):
 *  Khi user click 1 quân nhân ở Step2 → mở modal xem lịch sử:
 *  - PersonnelRewardHistoryModal: tất cả khen thưởng đã nhận.
 *  - PositionHistoryModal:        lịch sử chức vụ + nhóm hệ số.
 *  - ServiceHistoryModal:         lịch sử đơn vị (chuyển đơn vị qua đâu).
 *  - ScientificAchievementHistoryModal: lịch sử NCKH.
 *  - UnitAnnualAwardHistoryModal: với đơn vị (cho DON_VI_HANG_NAM).
 *  → Re-use cho cả Manager (xem trước khi đề xuất) lẫn Admin (xem trước
 *    khi duyệt).
 * ════════════════════════════════════════════════════════════════════════════
 */

/** Personnel record shape used by Step2 personnel-selection components. */
export interface Step2Personnel {
  id: string;
  ho_ten: string;
  cccd: string;
  cap_bac?: string;
  gioi_tinh?: string | null;
  ngay_sinh?: string | null;
  co_quan_don_vi_id: string;
  don_vi_truc_thuoc_id: string;
  chuc_vu_id: string;
  ngay_nhap_ngu?: DateInput;
  ngay_xuat_ngu?: DateInput;
  CoQuanDonVi?: {
    id: string;
    ten_don_vi: string;
    ma_don_vi: string;
  };
  DonViTrucThuoc?: {
    id: string;
    ten_don_vi: string;
    ma_don_vi: string;
    CoQuanDonVi?: {
      id: string;
      ten_don_vi: string;
      ma_don_vi: string;
    };
  };
  ChucVu?: {
    id: string;
    ten_chuc_vu: string;
  };
}


/** Generic shape returned by local Excel processing. */
export interface Step2LocalImportResult<TTitle> {
  imported: number;
  total: number;
  errors: string[];
  selectedPersonnelIds?: string[];
  selectedUnitIds?: string[];
  titleData: TTitle[];
}

/** Loose award/achievement payload returned by BE preview/import APIs. */
export interface Step2ImportedAward {
  quan_nhan_id?: string;
  personnel_id?: string;
  co_quan_don_vi_id?: string;
  don_vi_truc_thuoc_id?: string;
  danh_hieu?: string;
  loai?: string;
  mo_ta?: string;
  nam?: number;
  thang?: number;
  cap_bac?: string;
  chuc_vu?: string;
  ghi_chu?: string;
}

/** Result handed off to Step2 onImportSuccess handlers. */
export interface Step2ImportSuccessResult {
  selectedPersonnelIds?: string[];
  selectedUnitIds?: string[];
  titleData?: Step2ImportedAward[];
}

/** Single result item from `checkDuplicateBatch`/`checkDuplicateUnitBatch` BE responses. */
export interface DuplicateCheckResult {
  exists: boolean;
  message?: string;
  personnel_id?: string;
  don_vi_id?: string;
}

/** Raw row read from a sheet using `XLSX.utils.sheet_to_json({ header: 1 })`. */
export type ExcelRow = (string | number | null | undefined)[];
