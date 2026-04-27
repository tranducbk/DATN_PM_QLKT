/**
 * Shared proposal payload types.
 * Mirrors business JSON shapes stored in BangDeXuat.data_* columns and used
 * across submit/approve flows. Properties are loose because edits from admin
 * may carry arbitrary chain-award flags (nhan_bkbqp, so_quyet_dinh_bkbqp, ...).
 */

export interface ProposalDanhHieuItem {
  // Either personnel_id (CA_NHAN) or don_vi_id (DON_VI) is present, depending on proposal type.
  personnel_id?: string;
  ho_ten?: string;
  don_vi_id?: string;
  don_vi_type?: string;
  ten_don_vi?: string;
  danh_hieu?: string | null;
  cap_bac?: string | null;
  chuc_vu?: string | null;
  so_quyet_dinh?: string | null;
  file_quyet_dinh?: string | null;
  ghi_chu?: string | null;
  nhan_bkbqp?: boolean | null;
  so_quyet_dinh_bkbqp?: string | null;
  file_quyet_dinh_bkbqp?: string | null;
  ghi_chu_bkbqp?: string | null;
  nhan_cstdtq?: boolean | null;
  so_quyet_dinh_cstdtq?: string | null;
  file_quyet_dinh_cstdtq?: string | null;
  ghi_chu_cstdtq?: string | null;
  nhan_bkttcp?: boolean | null;
  so_quyet_dinh_bkttcp?: string | null;
  file_quyet_dinh_bkttcp?: string | null;
  ghi_chu_bkttcp?: string | null;
  // HCBVTQ-specific date + group time fields (one-time medal flow).
  nam?: number;
  thang?: number;
  nam_nhan?: number;
  thang_nhan?: number;
  thoi_gian?: ServiceTimeJson | null;
  thoi_gian_nhom_0_7?: ContributionTimeAggregate | null;
  thoi_gian_nhom_0_8?: ContributionTimeAggregate | null;
  thoi_gian_nhom_0_9_1_0?: ContributionTimeAggregate | null;
  // Extra fields tolerated for forward compatibility (enriched personnel data, etc.)
  [key: string]: unknown;
}

export interface ProposalThanhTichItem {
  personnel_id?: string;
  ten_thanh_tich?: string | null;
  mo_ta?: string | null;
  nam?: number;
  loai?: string | null;
  cap_bac?: string | null;
  chuc_vu?: string | null;
  so_quyet_dinh?: string | null;
  file_quyet_dinh?: string | null;
  ghi_chu?: string | null;
  [key: string]: unknown;
}

export interface ProposalNienHanItem {
  personnel_id?: string;
  danh_hieu?: string | null;
  nam?: number;
  thang?: number;
  nam_nhan?: number;
  thang_nhan?: number;
  nam_quyet_dinh?: number;
  thang_quyet_dinh?: number;
  cap_bac?: string | null;
  chuc_vu?: string | null;
  so_quyet_dinh?: string | null;
  file_quyet_dinh?: string | null;
  thoi_gian?: ServiceTimeJson | null;
  ghi_chu?: string | null;
  [key: string]: unknown;
}

export interface ProposalCongHienItem {
  personnel_id?: string;
  danh_hieu?: string | null;
  nam?: number;
  thang?: number;
  nam_nhan?: number;
  thang_nhan?: number;
  nam_quyet_dinh?: number;
  thang_quyet_dinh?: number;
  cap_bac?: string | null;
  chuc_vu?: string | null;
  he_so_chuc_vu_group?: string | null;
  so_quyet_dinh?: string | null;
  file_quyet_dinh?: string | null;
  thoi_gian?: ContributionTimeAggregate | null;
  thoi_gian_nhom_0_7?: ContributionTimeAggregate | null;
  thoi_gian_nhom_0_8?: ContributionTimeAggregate | null;
  thoi_gian_nhom_0_9_1_0?: ContributionTimeAggregate | null;
  ghi_chu?: string | null;
  [key: string]: unknown;
}

/** Edited proposal payload submitted by approver — fields map 1:1 to BangDeXuat JSON columns. */
export interface EditedProposalData {
  data_danh_hieu?: ProposalDanhHieuItem[] | null;
  data_thanh_tich?: ProposalThanhTichItem[] | null;
  data_nien_han?: ProposalNienHanItem[] | null;
  data_cong_hien?: ProposalCongHienItem[] | null;
}

// Compatible with Prisma's InputJsonValue (recursive structural type).
type JsonScalar = string | number | boolean | null;
type JsonValueLoose = JsonScalar | JsonValueLoose[] | { [key: string]: JsonValueLoose };

/** Time-in-position aggregates persisted on KhenThuongHCBVTQ JSON columns. */
export type ContributionTimeAggregate = {
  total_months?: number;
  years?: number;
  months?: number;
  display?: string;
} & { [key: string]: JsonValueLoose | undefined };

/** Generic service-time descriptor stored on award rows (annual/medal). */
export type ServiceTimeJson = {
  total_months?: number;
  years?: number;
  months?: number;
  display?: string;
} & { [key: string]: JsonValueLoose | undefined };
