/*
 * ════════════════════════════════════════════════════════════════════════════
 *  NOTIFICATION CONSTANTS — danh mục loại thông báo + loại tài nguyên
 * ════════════════════════════════════════════════════════════════════════════
 *
 *  NOTIFICATION_TYPES: enum mã loại noti. Lưu vào cột `type` của ThongBao và
 *  gửi xuống FE để chọn icon + điều hướng phù hợp khi user click.
 *
 *  RESOURCE_TYPES: loại tài nguyên gốc mà noti trỏ tới (đề xuất, khen thưởng,
 *  quân nhân, ...). Kết hợp với `tai_nguyen_id` để FE dựng link đến đúng trang.
 *
 *  `as const` để giữ literal type → tránh hardcode chuỗi rải rác (xem AP-6).
 * ════════════════════════════════════════════════════════════════════════════
 */

export const NOTIFICATION_TYPES = {
  PROPOSAL_SUBMITTED: 'PROPOSAL_SUBMITTED',
  PROPOSAL_APPROVED: 'PROPOSAL_APPROVED',
  PROPOSAL_REJECTED: 'PROPOSAL_REJECTED',
  PROPOSAL_DELETED: 'PROPOSAL_DELETED',

  PERSONNEL_ADDED: 'PERSONNEL_ADDED',
  PERSONNEL_TRANSFERRED: 'PERSONNEL_TRANSFERRED',

  ACHIEVEMENT_APPROVED: 'ACHIEVEMENT_APPROVED',

  AWARD_ADDED: 'AWARD_ADDED',
  AWARD_UPDATED: 'AWARD_UPDATED',
  AWARD_DELETED: 'AWARD_DELETED',
} as const;

export const RESOURCE_TYPES = {
  PERSONNEL: 'personnel',
  PROPOSALS: 'proposals',
  ACHIEVEMENTS: 'achievements',
  AWARDS: 'awards',
} as const;
