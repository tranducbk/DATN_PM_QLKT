import { prisma } from '../../../models';
import {
  calculateServiceMonths,
  formatServiceDuration,
} from '../../../helpers/serviceYearsHelper';

export interface NienHanInputItem {
  personnel_id?: string;
  danh_hieu?: string;
  so_quyet_dinh?: string | null;
  file_quyet_dinh?: string | null;
  cap_bac?: string | null;
  chuc_vu?: string | null;
}

interface NienHanPersonnelRow {
  id: string;
  ho_ten: string | null;
  ngay_nhap_ngu: Date | null;
  ngay_xuat_ngu: Date | null;
  CoQuanDonVi: { id: string; ten_don_vi: string; ma_don_vi: string } | null;
  DonViTrucThuoc:
    | {
        id: string;
        ten_don_vi: string;
        ma_don_vi: string;
        CoQuanDonVi: { id: string; ten_don_vi: string; ma_don_vi: string } | null;
      }
    | null;
}

/**
 * Loads personnel rows with unit relations + service dates required by tenure-style payloads.
 * @param personnelIds - QuanNhan ids referenced in the proposal items
 * @returns Map keyed by personnel id
 */
export async function loadNienHanPersonnelMap(
  personnelIds: string[]
): Promise<Map<string, NienHanPersonnelRow>> {
  if (personnelIds.length === 0) return new Map();
  const rows = await prisma.quanNhan.findMany({
    where: { id: { in: personnelIds } },
    select: {
      id: true,
      ho_ten: true,
      ngay_nhap_ngu: true,
      ngay_xuat_ngu: true,
      CoQuanDonVi: { select: { id: true, ten_don_vi: true, ma_don_vi: true } },
      DonViTrucThuoc: {
        select: {
          id: true,
          ten_don_vi: true,
          ma_don_vi: true,
          CoQuanDonVi: { select: { id: true, ten_don_vi: true, ma_don_vi: true } },
        },
      },
    },
  });
  return new Map(rows.map(r => [r.id, r as NienHanPersonnelRow]));
}

/**
 * Builds one NIEN_HAN-shape item enriched with service-time + unit info.
 * Shared by HC_QKQT / KNC / NIEN_HAN strategies (identical payload shape).
 * @param item - Raw input item from request
 * @param personnel - Loaded personnel row (or null)
 * @param nam - Proposal year
 * @param thang - Proposal month (1-12)
 * @returns Payload object ready for `data_nien_han` JSON column
 */
export function buildNienHanPayloadItem(
  item: NienHanInputItem,
  personnel: NienHanPersonnelRow | undefined,
  nam: number,
  thang: number | null
) {
  let thoiGian: {
    total_months: number;
    years: number;
    months: number;
    display: string;
  } | null = null;
  if (personnel?.ngay_nhap_ngu) {
    const ngayNhapNgu = new Date(personnel.ngay_nhap_ngu);
    const ngayKetThuc = personnel.ngay_xuat_ngu
      ? new Date(personnel.ngay_xuat_ngu)
      : new Date(nam, thang ?? 0, 0);
    const months = calculateServiceMonths(ngayNhapNgu, ngayKetThuc);
    thoiGian = {
      total_months: months,
      years: Math.floor(months / 12),
      months: months % 12,
      display: months === 0 ? '-' : formatServiceDuration(months),
    };
  }

  return {
    personnel_id: item.personnel_id,
    ho_ten: personnel?.ho_ten || '',
    nam,
    thang,
    danh_hieu: item.danh_hieu,
    so_quyet_dinh: item.so_quyet_dinh || null,
    file_quyet_dinh: item.file_quyet_dinh || null,
    thoi_gian: thoiGian,
    cap_bac: item.cap_bac || null,
    chuc_vu: item.chuc_vu || null,
    co_quan_don_vi: personnel?.CoQuanDonVi
      ? {
          id: personnel.CoQuanDonVi.id,
          ten_co_quan_don_vi: personnel.CoQuanDonVi.ten_don_vi,
          ma_co_quan_don_vi: personnel.CoQuanDonVi.ma_don_vi,
        }
      : null,
    don_vi_truc_thuoc: personnel?.DonViTrucThuoc
      ? {
          id: personnel.DonViTrucThuoc.id,
          ten_don_vi: personnel.DonViTrucThuoc.ten_don_vi,
          ma_don_vi: personnel.DonViTrucThuoc.ma_don_vi,
          co_quan_don_vi: personnel.DonViTrucThuoc.CoQuanDonVi
            ? {
                id: personnel.DonViTrucThuoc.CoQuanDonVi.id,
                ten_don_vi_truc: personnel.DonViTrucThuoc.CoQuanDonVi.ten_don_vi,
                ma_don_vi: personnel.DonViTrucThuoc.CoQuanDonVi.ma_don_vi,
              }
            : null,
        }
      : null,
  };
}
