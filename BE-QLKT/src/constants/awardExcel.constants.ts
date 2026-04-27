import type { TemplateColumn } from '../helpers/excel/excelTemplateHelper';
import { buildDanhHieuExcelOptions, DANH_HIEU_HCBVTQ, DANH_HIEU_HCCSVV, DANH_HIEU_NCKH } from './danhHieu.constants';

const MONTH_VALIDATION_FORMULA = '"1,2,3,4,5,6,7,8,9,10,11,12"';

export const AWARD_EXCEL_SHEETS = {
  ANNUAL_PERSONAL: 'Danh hiệu hằng năm',
  ANNUAL_UNIT: 'Khen thưởng đơn vị',
  HCCSVV: 'HCCSVV',
  HCBVTQ: 'HCBVTQ',
  KNC: 'KNC VSNXD QDNDVN',
  HC_QKQT: 'HC QKQT',
  NCKH: 'NCKH',
} as const;

export const HCCSVV_TEMPLATE_COLUMNS: TemplateColumn[] = [
  { header: 'STT', key: 'stt', width: 6 },
  { header: 'ID', key: 'id', width: 10 },
  { header: 'Họ và tên', key: 'ho_ten', width: 25 },
  { header: 'Ngày sinh', key: 'ngay_sinh', width: 14 },
  { header: 'Cơ quan đơn vị', key: 'co_quan_don_vi', width: 20 },
  { header: 'Đơn vị trực thuộc', key: 'don_vi_truc_thuoc', width: 20 },
  { header: 'Cấp bậc', key: 'cap_bac', width: 15 },
  { header: 'Chức vụ', key: 'chuc_vu', width: 20 },
  { header: 'Năm (*)', key: 'nam', width: 10 },
  {
    header: 'Tháng (*)',
    key: 'thang',
    width: 10,
    validationFormulae: MONTH_VALIDATION_FORMULA,
  },
  { header: 'Danh hiệu (*)', key: 'danh_hieu', width: 25 },
  { header: 'Số quyết định', key: 'so_quyet_dinh', width: 20 },
  { header: 'Ghi chú', key: 'ghi_chu', width: 25 },
];

export const HCBVTQ_TEMPLATE_COLUMNS: TemplateColumn[] = [
  { header: 'STT', key: 'stt', width: 6 },
  { header: 'ID', key: 'id', width: 10 },
  { header: 'Họ và tên', key: 'ho_ten', width: 25 },
  { header: 'Ngày sinh', key: 'ngay_sinh', width: 14 },
  { header: 'Cơ quan đơn vị', key: 'co_quan_don_vi', width: 20 },
  { header: 'Đơn vị trực thuộc', key: 'don_vi_truc_thuoc', width: 20 },
  { header: 'Cấp bậc', key: 'cap_bac', width: 15 },
  { header: 'Chức vụ', key: 'chuc_vu', width: 20 },
  { header: 'Năm (*)', key: 'nam', width: 10 },
  { header: 'Danh hiệu (*)', key: 'danh_hieu', width: 25 },
  { header: 'Số quyết định', key: 'so_quyet_dinh', width: 20 },
  { header: 'Ghi chú', key: 'ghi_chu', width: 25 },
];

export const KNC_TEMPLATE_COLUMNS: TemplateColumn[] = [
  { header: 'STT', key: 'stt', width: 6 },
  { header: 'ID', key: 'id', width: 10 },
  { header: 'Họ và tên', key: 'ho_ten', width: 25 },
  { header: 'Ngày sinh', key: 'ngay_sinh', width: 14 },
  { header: 'Cơ quan đơn vị', key: 'co_quan_don_vi', width: 20 },
  { header: 'Đơn vị trực thuộc', key: 'don_vi_truc_thuoc', width: 20 },
  { header: 'Cấp bậc', key: 'cap_bac', width: 15 },
  { header: 'Chức vụ', key: 'chuc_vu', width: 20 },
  { header: 'Năm (*)', key: 'nam', width: 10 },
  { header: 'Tháng (*)', key: 'thang', width: 10, validationFormulae: MONTH_VALIDATION_FORMULA },
  { header: 'Số quyết định', key: 'so_quyet_dinh', width: 20 },
  { header: 'Ghi chú', key: 'ghi_chu', width: 25 },
];

export const HCQKQT_TEMPLATE_COLUMNS: TemplateColumn[] = [
  { header: 'STT', key: 'stt', width: 6 },
  { header: 'ID', key: 'id', width: 10 },
  { header: 'Họ và tên', key: 'ho_ten', width: 25 },
  { header: 'Ngày sinh', key: 'ngay_sinh', width: 14 },
  { header: 'Cơ quan đơn vị', key: 'co_quan_don_vi', width: 20 },
  { header: 'Đơn vị trực thuộc', key: 'don_vi_truc_thuoc', width: 20 },
  { header: 'Cấp bậc', key: 'cap_bac', width: 15 },
  { header: 'Chức vụ', key: 'chuc_vu', width: 20 },
  { header: 'Năm (*)', key: 'nam', width: 10 },
  { header: 'Tháng (*)', key: 'thang', width: 10, validationFormulae: MONTH_VALIDATION_FORMULA },
  { header: 'Số quyết định', key: 'so_quyet_dinh', width: 20 },
  { header: 'Ghi chú', key: 'ghi_chu', width: 25 },
];

export const NCKH_TEMPLATE_COLUMNS: TemplateColumn[] = [
  { header: 'STT', key: 'stt', width: 6 },
  { header: 'ID', key: 'id', width: 10 },
  { header: 'Họ và tên', key: 'ho_ten', width: 25 },
  { header: 'Ngày sinh', key: 'ngay_sinh', width: 14 },
  { header: 'Cơ quan đơn vị', key: 'co_quan_don_vi', width: 20 },
  { header: 'Đơn vị trực thuộc', key: 'don_vi_truc_thuoc', width: 20 },
  { header: 'Cấp bậc', key: 'cap_bac', width: 15 },
  { header: 'Chức vụ', key: 'chuc_vu', width: 20 },
  { header: 'Năm (*)', key: 'nam', width: 10 },
  {
    header: 'Loại (*)',
    key: 'loai',
    width: 20,
    validationFormulae: buildDanhHieuExcelOptions(Object.values(DANH_HIEU_NCKH)),
  },
  { header: 'Mô tả (*)', key: 'mo_ta', width: 40 },
  { header: 'Số quyết định', key: 'so_quyet_dinh', width: 20 },
  { header: 'Ghi chú', key: 'ghi_chu', width: 25 },
];

export const HCCSVV_TEMPLATE_OPTIONS = buildDanhHieuExcelOptions(Object.values(DANH_HIEU_HCCSVV));
export const HCBVTQ_TEMPLATE_OPTIONS = buildDanhHieuExcelOptions(Object.values(DANH_HIEU_HCBVTQ));

export const PERSONAL_ANNUAL_TEMPLATE_COLUMNS = [
  { header: 'STT', key: 'stt', width: 6 },
  { header: 'ID', key: 'id', width: 10 },
  { header: 'Họ và tên', key: 'ho_ten', width: 25 },
  { header: 'Ngày sinh', key: 'ngay_sinh', width: 14 },
  { header: 'Cơ quan đơn vị', key: 'co_quan_don_vi', width: 20 },
  { header: 'Đơn vị trực thuộc', key: 'don_vi_truc_thuoc', width: 20 },
  { header: 'Cấp bậc', key: 'cap_bac', width: 15 },
  { header: 'Chức vụ', key: 'chuc_vu', width: 20 },
  { header: 'Năm (*)', key: 'nam', width: 10 },
  { header: 'Danh hiệu (*)', key: 'danh_hieu', width: 20 },
  { header: 'Số quyết định', key: 'so_quyet_dinh', width: 20 },
  { header: 'Ghi chú', key: 'ghi_chu', width: 25 },
] as const;

export const UNIT_ANNUAL_TEMPLATE_COLUMNS = [
  { header: 'STT', key: 'stt', width: 8 },
  { header: 'ID', key: 'id', width: 30 },
  { header: 'Mã đơn vị', key: 'ma_don_vi', width: 15 },
  { header: 'Tên đơn vị', key: 'ten_don_vi', width: 30 },
  { header: 'Năm (*)', key: 'nam', width: 10 },
  { header: 'Danh hiệu (*)', key: 'danh_hieu', width: 20 },
  { header: 'Số quyết định', key: 'so_quyet_dinh', width: 20 },
  { header: 'Ghi chú', key: 'ghi_chu', width: 30 },
] as const;

export const UNIT_ANNUAL_DANH_HIEU_VALIDATION_FORMULA = '"ĐVQT,ĐVTT"';

export const ANNUAL_PERSONAL_EXPORT_COLUMNS = [
  { header: 'STT', key: 'stt', width: 6 },
  { header: 'ID', key: 'id', width: 10 },
  { header: 'Họ và tên', key: 'ho_ten', width: 25 },
  { header: 'Cấp bậc', key: 'cap_bac', width: 15 },
  { header: 'Chức vụ', key: 'chuc_vu', width: 20 },
  { header: 'Năm', key: 'nam', width: 10 },
  { header: 'Danh hiệu', key: 'danh_hieu', width: 15 },
  { header: 'Số quyết định', key: 'so_quyet_dinh', width: 20 },
  { header: 'Ghi chú', key: 'ghi_chu', width: 25 },
  { header: 'BKBQP', key: 'nhan_bkbqp', width: 10 },
  { header: 'Số QĐ BKBQP', key: 'so_quyet_dinh_bkbqp', width: 20 },
  { header: 'CSTDTQ', key: 'nhan_cstdtq', width: 10 },
  { header: 'Số QĐ CSTDTQ', key: 'so_quyet_dinh_cstdtq', width: 20 },
  { header: 'BKTTCP', key: 'nhan_bkttcp', width: 10 },
  { header: 'Số QĐ BKTTCP', key: 'so_quyet_dinh_bkttcp', width: 20 },
];

export const UNIT_ANNUAL_EXPORT_COLUMNS = [
  { header: 'STT', key: 'stt', width: 8 },
  { header: 'Mã đơn vị', key: 'ma_don_vi', width: 15 },
  { header: 'Tên đơn vị', key: 'ten_don_vi', width: 30 },
  { header: 'Năm', key: 'nam', width: 10 },
  { header: 'Danh hiệu', key: 'danh_hieu', width: 20 },
  { header: 'Số QĐ danh hiệu', key: 'so_quyet_dinh', width: 20 },
  { header: 'BKBQP', key: 'nhan_bkbqp', width: 10 },
  { header: 'Số QĐ BKBQP', key: 'so_quyet_dinh_bkbqp', width: 20 },
  { header: 'BKTTCP', key: 'nhan_bkttcp', width: 10 },
  { header: 'Số QĐ BKTTCP', key: 'so_quyet_dinh_bkttcp', width: 20 },
  { header: 'Ghi chú', key: 'ghi_chu', width: 30 },
];

export const KNC_EXPORT_COLUMNS = [
  { header: 'STT', key: 'stt', width: 5 },
  { header: 'CCCD', key: 'cccd', width: 15 },
  { header: 'Họ tên', key: 'ho_ten', width: 25 },
  { header: 'Đơn vị', key: 'don_vi', width: 30 },
  { header: 'Năm', key: 'nam', width: 10 },
  { header: 'Cấp bậc', key: 'cap_bac', width: 15 },
  { header: 'Chức vụ', key: 'chuc_vu', width: 30 },
  { header: 'Thời gian (tháng)', key: 'thoi_gian', width: 18 },
  { header: 'Số quyết định', key: 'so_quyet_dinh', width: 20 },
  { header: 'Ghi chú', key: 'ghi_chu', width: 30 },
];

export const HCBVTQ_EXPORT_COLUMNS = [
  { header: 'STT', key: 'stt', width: 6 },
  { header: 'ID', key: 'id', width: 10 },
  { header: 'CCCD', key: 'cccd', width: 15 },
  { header: 'Họ và tên', key: 'ho_ten', width: 25 },
  { header: 'Cấp bậc', key: 'cap_bac', width: 15 },
  { header: 'Chức vụ', key: 'chuc_vu', width: 20 },
  { header: 'Đơn vị', key: 'don_vi', width: 30 },
  { header: 'Năm', key: 'nam', width: 10 },
  { header: 'Danh hiệu', key: 'danh_hieu', width: 25 },
  { header: 'TG nhóm 0.7 (tháng)', key: 'thoi_gian_nhom_0_7', width: 18 },
  { header: 'TG nhóm 0.8 (tháng)', key: 'thoi_gian_nhom_0_8', width: 18 },
  { header: 'TG nhóm 0.9-1.0 (tháng)', key: 'thoi_gian_nhom_0_9_1_0', width: 20 },
  { header: 'Số quyết định', key: 'so_quyet_dinh', width: 20 },
  { header: 'Ghi chú', key: 'ghi_chu', width: 30 },
];

export const NCKH_EXPORT_COLUMNS = [
  { header: 'STT', key: 'stt', width: 6 },
  { header: 'ID', key: 'id', width: 10 },
  { header: 'Họ và tên', key: 'ho_ten', width: 25 },
  { header: 'Cấp bậc', key: 'cap_bac', width: 15 },
  { header: 'Chức vụ', key: 'chuc_vu', width: 20 },
  { header: 'Đơn vị', key: 'don_vi', width: 30 },
  { header: 'Năm', key: 'nam', width: 10 },
  { header: 'Loại', key: 'loai', width: 15 },
  { header: 'Mô tả', key: 'mo_ta', width: 40 },
  { header: 'Số quyết định', key: 'so_quyet_dinh', width: 20 },
  { header: 'Ghi chú', key: 'ghi_chu', width: 30 },
];

export const HCCSVV_EXPORT_COLUMNS = [
  { header: 'STT', key: 'stt', width: 6 },
  { header: 'ID', key: 'id', width: 10 },
  { header: 'Họ và tên', key: 'ho_ten', width: 25 },
  { header: 'Cấp bậc', key: 'cap_bac', width: 15 },
  { header: 'Chức vụ', key: 'chuc_vu', width: 20 },
  { header: 'Năm (*)', key: 'nam', width: 10 },
  { header: 'Danh hiệu (*)', key: 'danh_hieu', width: 25 },
  { header: 'Số quyết định', key: 'so_quyet_dinh', width: 20 },
  { header: 'Ghi chú', key: 'ghi_chu', width: 25 },
];

export const MILITARY_FLAG_EXPORT_COLUMNS = [
  { header: 'STT', key: 'stt', width: 6 },
  { header: 'ID', key: 'id', width: 10 },
  { header: 'Họ và tên', key: 'ho_ten', width: 25 },
  { header: 'Cấp bậc', key: 'cap_bac', width: 15 },
  { header: 'Chức vụ', key: 'chuc_vu', width: 20 },
  { header: 'Năm', key: 'nam', width: 10 },
  { header: 'Số quyết định', key: 'so_quyet_dinh', width: 20 },
  { header: 'Ghi chú', key: 'ghi_chu', width: 25 },
  { header: 'Đơn vị', key: 'don_vi', width: 30 },
];

export const PERSONNEL_EXPORT_COLUMNS = [
  { header: 'CCCD', key: 'cccd', width: 18 },
  { header: 'Họ tên', key: 'ho_ten', width: 28 },
  { header: 'Ngày sinh (YYYY-MM-DD)', key: 'ngay_sinh', width: 20 },
  { header: 'Ngày nhập ngũ (YYYY-MM-DD)', key: 'ngay_nhap_ngu', width: 24 },
  { header: 'Mã đơn vị', key: 'ma_don_vi', width: 14 },
  { header: 'Tên đơn vị', key: 'ten_don_vi', width: 24 },
  { header: 'Tên chức vụ', key: 'ten_chuc_vu', width: 22 },
  { header: 'Là chỉ huy (is_manager)', key: 'is_manager', width: 16 },
  { header: 'Hệ số chức vụ', key: 'he_so_chuc_vu', width: 15 },
];
