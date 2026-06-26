/**
 * Centralized notification titles and reusable message templates. Titles are
 * static and were previously re-typed (and drifting) at each call site; keep
 * them here as the single source of truth.
 */
export const NOTIFICATION_TITLES = {
  AWARD_RECEIVED: 'Bạn đã nhận khen thưởng',
  UNIT_AWARD_RECEIVED: 'Đơn vị của bạn đã nhận khen thưởng',
  SUBUNIT_AWARD_RECEIVED: 'Đơn vị trực thuộc đã nhận khen thưởng',
  AWARD_ADDED: 'Khen thưởng mới đã được thêm',
  AWARD_UPDATED: 'Khen thưởng đã được cập nhật',
  AWARD_UPDATED_RECIPIENT: 'Khen thưởng của bạn đã được cập nhật',
  AWARD_DELETED: 'Khen thưởng đã bị xóa',
  AWARD_DELETED_RECIPIENT: 'Khen thưởng của bạn đã bị xóa',
  UNIT_AWARD_DELETED: 'Khen thưởng đơn vị đã bị xóa',
  AWARD_DATA_CORRECTED: 'Quản trị viên đã sửa dữ liệu khen thưởng',
  ACHIEVEMENT_APPROVED: 'Thành tích khoa học đã được phê duyệt',
  PROPOSAL_NEW: 'Đề xuất khen thưởng mới',
  PROPOSAL_APPROVED: 'Đề xuất đã được phê duyệt',
  PROPOSAL_REJECTED: 'Đề xuất bị từ chối',
  PROPOSAL_DELETED: 'Đề xuất khen thưởng đã bị xóa',
  PROPOSAL_DELETED_RECIPIENT: 'Đề xuất của bạn đã bị xóa',
  PERSONNEL_ADDED: 'Quân nhân mới được thêm',
  PERSONNEL_TRANSFERRED_IN: 'Quân nhân mới chuyển đến',
  PERSONNEL_TRANSFERRED_OUT: 'Quân nhân đã chuyển đi',
  PERSONNEL_TRANSFERRED_SUBUNIT: 'Quân nhân chuyển đơn vị trực thuộc',
  PERSONNEL_SELF_TRANSFERRED: 'Bạn đã được chuyển đơn vị',
  PERSONNEL_DELETED: 'Quân nhân đã bị xóa',
  PERSONNEL_SELF_UPDATED: 'Quân nhân cập nhật thông tin',
} as const;

export const notificationMessages = {
  /**
   * Manager-facing message for ad-hoc award create/update/delete.
   * Uses "cho" for create and "của" for update/delete.
   */
  adhocAward: (
    actor: string,
    action: string,
    awardName: string,
    year: number | string,
    subject: string
  ): string => {
    const preposition = action === 'thêm' ? 'cho' : 'của';
    return `${actor} đã ${action} khen thưởng đột xuất "${awardName}" năm ${year} ${preposition} ${subject}`;
  },
};
