/**
 * Validation Messages Constants
 * Centralized validation messages for consistent error handling across the application
 */

export const VALIDATION_MESSAGES = {
  // Grade-related validation messages
  GRADE: {
    INVALID_RANGE: 'Điểm hệ 10 phải từ 0 đến 10',
    MISSING_DATA: 'Vui lòng nhập đầy đủ thông tin môn học và điểm',
    INVALID_FORMAT: 'Dữ liệu không hợp lệ',
    INVALID_SUBJECT_DATA: 'Vui lòng kiểm tra lại thông tin môn học',
    SELECT_SEMESTER: 'Vui lòng chọn học kỳ hợp lệ',
    DUPLICATE_SEMESTER: 'Kết quả học tập cho học kỳ này đã tồn tại',
  },

  // Timetable-related validation messages
  TIMETABLE: {
    INVALID_TIME: 'Thời gian bắt đầu phải nhỏ hơn thời gian kết thúc',
    MISSING_FIELDS: 'Vui lòng điền đầy đủ thông tin',
    INVALID_DAY: 'Vui lòng chọn thứ hợp lệ',
    INVALID_TIME_FORMAT: 'Định dạng thời gian không hợp lệ',
  },

  // Common validation messages
  COMMON: {
    MISSING_INFORMATION: 'Thiếu thông tin',
    INVALID_DATA: 'Dữ liệu không hợp lệ',
    SERVER_ERROR: 'Có lỗi xảy ra từ phía server',
    NETWORK_ERROR: 'Lỗi kết nối mạng',
  },

  // Success messages
  SUCCESS: {
    CREATED: 'Thêm mới thành công',
    UPDATED: 'Cập nhật thành công',
    DELETED: 'Xóa thành công',
    SAVED: 'Lưu thành công',
  },

  // Confirm messages
  CONFIRM: {
    DELETE: 'Bạn có chắc chắn muốn xóa?',
    UPDATE: 'Bạn có chắc chắn muốn cập nhật?',
    CANCEL: 'Bạn có chắc chắn muốn hủy?',
  },
};

// Export individual message groups for convenience
export const GRADE_MESSAGES = VALIDATION_MESSAGES.GRADE;
export const TIMETABLE_MESSAGES = VALIDATION_MESSAGES.TIMETABLE;
export const COMMON_MESSAGES = VALIDATION_MESSAGES.COMMON;
export const SUCCESS_MESSAGES = VALIDATION_MESSAGES.SUCCESS;
export const CONFIRM_MESSAGES = VALIDATION_MESSAGES.CONFIRM;
