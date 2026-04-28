import { makePersonnel, makeAnnualRecord, makeThanhTichKhoaHoc } from './fixtures';
import { DANH_HIEU_CA_NHAN_HANG_NAM } from '../../src/constants/danhHieu.constants';

export interface AnnualRow {
  nam: number;
  danh_hieu: string | null;
  so_quyet_dinh?: string | null;
  nhan_bkbqp?: boolean;
  so_quyet_dinh_bkbqp?: string | null;
  nhan_cstdtq?: boolean;
  so_quyet_dinh_cstdtq?: string | null;
  nhan_bkttcp?: boolean;
  so_quyet_dinh_bkttcp?: string | null;
}

export interface ScienceRow {
  nam: number;
  loai?: 'DTKH' | 'SKKH';
  mo_ta?: string;
  so_quyet_dinh?: string | null;
}

/**
 * Builds a fixture-shaped result for `prisma.quanNhan.findUnique` with award + science includes.
 * @param personnelId - Personnel CUID used as foreign key on child rows
 * @param danhHieuRows - Annual award rows (DanhHieuHangNam)
 * @param thanhTichRows - Scientific achievement rows (ThanhTichKhoaHoc)
 * @returns Personnel object with `DanhHieuHangNam` + `ThanhTichKhoaHoc` arrays populated
 */
export function buildPersonnelWithHistory(
  personnelId: string,
  danhHieuRows: AnnualRow[],
  thanhTichRows: ScienceRow[]
) {
  const base = makePersonnel({ id: personnelId });
  return {
    ...base,
    DanhHieuHangNam: danhHieuRows.map(r =>
      makeAnnualRecord({
        personnelId,
        nam: r.nam,
        danh_hieu: r.danh_hieu,
        so_quyet_dinh: r.so_quyet_dinh,
        nhan_bkbqp: r.nhan_bkbqp,
        so_quyet_dinh_bkbqp: r.so_quyet_dinh_bkbqp,
        nhan_cstdtq: r.nhan_cstdtq,
        so_quyet_dinh_cstdtq: r.so_quyet_dinh_cstdtq,
        nhan_bkttcp: r.nhan_bkttcp,
        so_quyet_dinh_bkttcp: r.so_quyet_dinh_bkttcp,
      })
    ),
    ThanhTichKhoaHoc: thanhTichRows.map(r =>
      makeThanhTichKhoaHoc({
        personnelId,
        nam: r.nam,
        loai: r.loai,
        mo_ta: r.mo_ta,
        so_quyet_dinh: r.so_quyet_dinh,
      })
    ),
  };
}

/**
 * Builds a contiguous run of CSTDCS award rows (with matching NCKH science rows) between two years.
 * @param fromYear - Start year (inclusive)
 * @param toYear - End year (inclusive)
 * @param flags - Optional per-year overrides for `nhan_bkbqp` / `nhan_cstdtq` / `nhan_bkttcp`
 * @returns Object with `danhHieu` (annual rows) and `nckh` (science rows) arrays
 */
export function buildContiguousCSTDCS(
  fromYear: number,
  toYear: number,
  flags: Partial<Record<number, Pick<AnnualRow, 'nhan_bkbqp' | 'nhan_cstdtq' | 'nhan_bkttcp'>>> = {}
): { danhHieu: AnnualRow[]; nckh: ScienceRow[] } {
  const danhHieu: AnnualRow[] = [];
  const nckh: ScienceRow[] = [];
  for (let y = fromYear; y <= toYear; y++) {
    const yearFlags = flags[y] ?? {};
    const nhan_bkbqp = yearFlags.nhan_bkbqp ?? false;
    const nhan_cstdtq = yearFlags.nhan_cstdtq ?? false;
    const nhan_bkttcp = yearFlags.nhan_bkttcp ?? false;
    danhHieu.push({
      nam: y,
      danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.CSTDCS,
      so_quyet_dinh: `QD-CSTDCS-${y}`,
      nhan_bkbqp,
      so_quyet_dinh_bkbqp: nhan_bkbqp ? `QDBK-${y}` : null,
      nhan_cstdtq,
      so_quyet_dinh_cstdtq: nhan_cstdtq ? `QDTQ-${y}` : null,
      nhan_bkttcp,
      so_quyet_dinh_bkttcp: nhan_bkttcp ? `QDTT-${y}` : null,
    });
    nckh.push({ nam: y });
  }
  return { danhHieu, nckh };
}
