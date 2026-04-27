export interface UnitAnnualAwardDeps {
  recalculateAnnualUnit: (donViId: string, year?: number | null) => Promise<unknown>;
  checkUnitAwardEligibility: (
    donViId: string,
    year: number,
    danhHieu: string
  ) => Promise<{ eligible: boolean; reason: string }>;
  getSubUnits: (coQuanDonViId: string) => Promise<string[]>;
}

export interface UnitAnnualAwardValidItem {
  row: number;
  unit_id: string;
  is_co_quan_don_vi: boolean;
  ma_don_vi: string;
  ten_don_vi: string;
  nam: number;
  danh_hieu: string;
  so_quyet_dinh: string;
  ghi_chu: string | null;
  history: Array<{
    nam: number;
    danh_hieu: string;
    nhan_bkbqp: boolean;
    nhan_bkttcp: boolean;
    so_quyet_dinh: string | null;
  }>;
}
