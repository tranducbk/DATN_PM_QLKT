import type { TemplateColumn } from '../helpers/excelTemplateHelper';
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
