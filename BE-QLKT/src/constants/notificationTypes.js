/**
 * Notification Types Constants
 * Định nghĩa tất cả các loại thông báo trong hệ thống
 */

const NOTIFICATION_TYPES = {
  // Đề xuất khen thưởng
  PROPOSAL_SUBMITTED: 'PROPOSAL_SUBMITTED', // Manager gửi đề xuất
  PROPOSAL_APPROVED: 'PROPOSAL_APPROVED', // Admin phê duyệt đề xuất
  PROPOSAL_REJECTED: 'PROPOSAL_REJECTED', // Admin từ chối đề xuất
  PROPOSAL_PENDING: 'PROPOSAL_PENDING', // Đề xuất đang chờ phê duyệt

  // Quân nhân
  PERSONNEL_ADDED: 'PERSONNEL_ADDED', // Thêm quân nhân mới
  PERSONNEL_UPDATED: 'PERSONNEL_UPDATED', // Cập nhật thông tin quân nhân
  PERSONNEL_DELETED: 'PERSONNEL_DELETED', // Xóa quân nhân
  NEW_PERSONNEL: 'NEW_PERSONNEL', // Quân nhân mới (alias cho PERSONNEL_ADDED)
  PERSONNEL_TRANSFERRED: 'PERSONNEL_TRANSFERRED', // Quân nhân chuyển đơn vị

  // Thành tích khoa học
  ACHIEVEMENT_SUBMITTED: 'ACHIEVEMENT_SUBMITTED', // Nộp thành tích khoa học
  ACHIEVEMENT_APPROVED: 'ACHIEVEMENT_APPROVED', // Phê duyệt thành tích khoa học
  ACHIEVEMENT_REJECTED: 'ACHIEVEMENT_REJECTED', // Từ chối thành tích khoa học
  ACHIEVEMENT_PENDING: 'ACHIEVEMENT_PENDING', // Thành tích đang chờ phê duyệt

  // Khen thưởng
  AWARD_ADDED: 'AWARD_ADDED', // Thêm khen thưởng mới
  AWARD_UPDATED: 'AWARD_UPDATED', // Cập nhật khen thưởng
  AWARD_DELETED: 'AWARD_DELETED', // Xóa khen thưởng

  // Hệ thống
  SYSTEM_NOTIFICATION: 'SYSTEM_NOTIFICATION', // Thông báo hệ thống chung
  APPROVAL_PENDING: 'APPROVAL_PENDING', // Chờ phê duyệt (chung)
};

/**
 * Resource Types Constants
 * Định nghĩa các loại tài nguyên trong hệ thống
 */
const RESOURCE_TYPES = {
  PERSONNEL: 'personnel',
  PROPOSALS: 'proposals',
  ACHIEVEMENTS: 'achievements',
  AWARDS: 'awards',
  ACCOUNTS: 'accounts',
  POSITIONS: 'positions',
  UNITS: 'units',
  SYSTEM: 'system',
};

module.exports = {
  NOTIFICATION_TYPES,
  RESOURCE_TYPES,
};
