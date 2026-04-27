import type { DateInput } from '@/lib/types/common';
import type { UnitApiRow } from '@/lib/types/personnelList';
import type { TitleDataItem } from '@/lib/types/proposal';

export interface Personnel {
  id: string;
  ho_ten: string;
  cccd: string;
  ngay_nhap_ngu?: DateInput;
  ngay_xuat_ngu?: DateInput;
  ChucVu?: {
    id: string;
    ten_chuc_vu: string;
  };
  cap_bac?: string;
  CoQuanDonVi?: {
    ten_don_vi: string;
  };
  DonViTrucThuoc?: {
    ten_don_vi: string;
  };
}

export type ReviewRow = (Personnel | UnitApiRow) & Partial<TitleDataItem> & {
  id: string;
  co_quan_don_vi_id?: string | null;
};
