import { prisma } from '../../models';
import { NOTIFICATION_TYPES, RESOURCE_TYPES } from '../../constants/notificationTypes.constants';
import { ROLES } from '../../constants/roles.constants';
import { emitNotificationToUser } from '../../utils/socketService';
import {
  DANH_HIEU_MAP,
  LOAI_DE_XUAT_MAP,
  getDanhHieuName,
} from '../../constants/danhHieu.constants';

interface Recipient {
  id: string;
  role: string;
}

/**
 * Formats a human-readable proposal type label.
 * @param loaiDeXuat - Proposal type code
 * @returns Display label for notification content
 */
const formatProposalType = (loaiDeXuat: string): string => {
  const prefix = 'Đề xuất khen thưởng ';
  const typeName = LOAI_DE_XUAT_MAP[loaiDeXuat];
  return typeName ? prefix + typeName.toLowerCase() : 'Đề xuất khen thưởng';
};

/**
 * Resolves display name from account username.
 * @param username - Account username
 * @returns Personnel full name when available, otherwise username
 */
async function getDisplayName(username: string): Promise<string> {
  try {
    const account = await prisma.taiKhoan.findUnique({
      where: { username },
      include: {
        QuanNhan: {
          select: {
            ho_ten: true,
          },
        },
      },
    });

    if (account?.QuanNhan?.ho_ten) {
      return account.QuanNhan.ho_ten;
    }

    return username;
  } catch (error) {
    console.error('[notification] getDisplayName error:', error);
    return username;
  }
}

/**
 * Persists and emits system notifications for a recipient list.
 * @param recipients - Target recipients
 * @param type - Notification type
 * @param title - Notification title
 * @param message - Notification message
 * @param resource - Optional resource type
 * @param resourceId - Optional resource ID
 * @param link - Optional navigation link
 * @returns Number of notifications created
 */
async function sendSystemNotification(
  recipients: Recipient[],
  type: string,
  title: string,
  message: string,
  resource: string | null = null,
  resourceId: string | null = null,
  link: string | null = null
): Promise<number> {
  try {
    const notifications = recipients.map(recipient => ({
      nguoi_nhan_id: recipient.id,
      recipient_role: recipient.role,
      type,
      title,
      message,
      resource,
      tai_nguyen_id: resourceId || null,
      link,
    }));

    if (notifications.length > 0) {
      await prisma.thongBao.createMany({
        data: notifications,
      });
      notifications.forEach(n => emitNotificationToUser(n.nguoi_nhan_id, n));
    }

    return notifications.length;
  } catch (error) {
    throw error;
  }
}

export {
  prisma,
  NOTIFICATION_TYPES,
  RESOURCE_TYPES,
  ROLES,
  emitNotificationToUser,
  DANH_HIEU_MAP,
  LOAI_DE_XUAT_MAP,
  getDanhHieuName,
  formatProposalType,
  getDisplayName,
  sendSystemNotification,
};
