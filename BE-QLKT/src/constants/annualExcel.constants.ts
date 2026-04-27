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
