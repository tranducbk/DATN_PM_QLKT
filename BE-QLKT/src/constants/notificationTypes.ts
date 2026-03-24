/**
 * Notification Types Constants
 * Định nghĩa tất cả các loại thông báo trong hệ thống
 */
export const NOTIFICATION_TYPES = {
  // Đề xuất khen thưởng
  PROPOSAL_SUBMITTED: 'PROPOSAL_SUBMITTED',
  PROPOSAL_APPROVED: 'PROPOSAL_APPROVED',
  PROPOSAL_REJECTED: 'PROPOSAL_REJECTED',
  PROPOSAL_PENDING: 'PROPOSAL_PENDING',

  // Quân nhân
  PERSONNEL_ADDED: 'PERSONNEL_ADDED',
  PERSONNEL_UPDATED: 'PERSONNEL_UPDATED',
  PERSONNEL_DELETED: 'PERSONNEL_DELETED',
  NEW_PERSONNEL: 'NEW_PERSONNEL',
  PERSONNEL_TRANSFERRED: 'PERSONNEL_TRANSFERRED',

  // Thành tích khoa học
  ACHIEVEMENT_SUBMITTED: 'ACHIEVEMENT_SUBMITTED',
  ACHIEVEMENT_APPROVED: 'ACHIEVEMENT_APPROVED',
  ACHIEVEMENT_REJECTED: 'ACHIEVEMENT_REJECTED',
  ACHIEVEMENT_PENDING: 'ACHIEVEMENT_PENDING',

  // Khen thưởng
  AWARD_ADDED: 'AWARD_ADDED',
  AWARD_UPDATED: 'AWARD_UPDATED',
  AWARD_DELETED: 'AWARD_DELETED',

  // Hệ thống
  SYSTEM_NOTIFICATION: 'SYSTEM_NOTIFICATION',
  APPROVAL_PENDING: 'APPROVAL_PENDING',
} as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[keyof typeof NOTIFICATION_TYPES];

/**
 * Resource Types Constants
 * Định nghĩa các loại tài nguyên trong hệ thống
 */
export const RESOURCE_TYPES = {
  PERSONNEL: 'personnel',
  PROPOSALS: 'proposals',
  ACHIEVEMENTS: 'achievements',
  AWARDS: 'awards',
  ACCOUNTS: 'accounts',
  POSITIONS: 'positions',
  UNITS: 'units',
  SYSTEM: 'system',
} as const;

export type ResourceType = (typeof RESOURCE_TYPES)[keyof typeof RESOURCE_TYPES];
