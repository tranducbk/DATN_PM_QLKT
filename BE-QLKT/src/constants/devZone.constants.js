/**
 * Constants cho Dev Zone — cấu hình hệ thống
 */

// Giá trị mặc định seed vào bảng system_settings khi DB mới tạo
const SETTING_DEFAULTS = {
  cron_enabled: 'true',
  cron_schedule: '0 1 1 * *', // Ngày 1 hàng tháng lúc 01:00
  allow_annual: 'false', // Cá nhân hằng năm (import + file mẫu)
  allow_unit: 'false', // Đơn vị hằng năm
  allow_hccsvv: 'false', // HC Chiến sĩ Vẻ vang
  allow_contribution: 'false', // HC Bảo vệ Tổ quốc
  allow_commemoration: 'false', // Kỷ niệm chương
  allow_militaryFlag: 'false', // HC Quân kỳ Quyết thắng
  allow_scientific: 'false', // Thành tích khoa học
  allow_delete_logs: 'false', // Cho phép xoá nhật ký hệ thống (ADMIN+)
};

// Danh sách các loại khen thưởng hỗ trợ toggle import
const AWARD_TYPES = [
  'annual',
  'unit',
  'hccsvv',
  'contribution',
  'commemoration',
  'militaryFlag',
  'scientific',
];

// Tính năng hệ thống (không phải award type)
const SYSTEM_FEATURES = ['delete_logs'];

module.exports = { SETTING_DEFAULTS, AWARD_TYPES, SYSTEM_FEATURES };
