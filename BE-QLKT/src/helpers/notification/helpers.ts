/*
 * ════════════════════════════════════════════════════════════════════════════
 *  NOTIFICATION HELPERS — hàm lõi dùng chung cho mọi builder noti
 * ════════════════════════════════════════════════════════════════════════════
 *
 *  Đây là tầng tiện ích mà các builder theo domain (proposals/awards/personnel)
 *  import và gọi lại. Tránh mỗi builder tự lặp logic "build danh sách người
 *  nhận → lưu DB → emit socket".
 *
 *  HAI HÀM LÕI:
 *  - getDisplayName: lấy tên hiển thị đẹp (ho_ten của quân nhân) từ username,
 *    fallback nhãn vai trò rồi cuối cùng là username thô → noti đọc dễ hiểu.
 *  - sendSystemNotification: nhận một DANH SÁCH người nhận và fan-out: lưu một
 *    lần qua createMany rồi emit lần lượt.
 *
 *  LƯU Ý KHÁC NotificationService.createNotification: hàm này nhắm tới gửi cho
 *  NHIỀU người nhận (admin/manager) trong một lần gọi, nên dùng trực tiếp
 *  repository thay vì gọi service.
 *
 *  File cũng re-export các constant/map dùng chung (NOTIFICATION_TYPES,
 *  DANH_HIEU_MAP, ...) để builder import một chỗ thay vì rải import.
 * ════════════════════════════════════════════════════════════════════════════
 */

import { NOTIFICATION_TYPES, RESOURCE_TYPES } from '../../constants/notificationTypes.constants';
import { ROLES, ROLE_LABELS } from '../../constants/roles.constants';
import { emitNotificationToUser } from '../../utils/socketService';
import { accountRepository } from '../../repositories/account.repository';
import { notificationRepository } from '../../repositories/notification.repository';
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
    const account = await accountRepository.findUniqueRaw({
      where: { username },
      include: {
        QuanNhan: {
          select: {
            ho_ten: true,
          },
        },
      },
    });

    // Ưu tiên tên thật của quân nhân; nếu account chưa gắn quân nhân thì
    // dùng nhãn vai trò (vd "Quản trị viên"); bí quá mới trả username thô.
    if (account?.QuanNhan?.ho_ten) {
      return account.QuanNhan.ho_ten;
    }

    if (account?.role && ROLE_LABELS[account.role]) {
      return ROLE_LABELS[account.role];
    }

    return username;
  } catch (error) {
    // Tên hiển thị chỉ phục vụ nội dung noti → lỗi query không được làm hỏng
    // luồng gửi noti: log lại và fallback về username.
    console.error('NotificationHelper.getDisplayName failed', { username, error });
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
  // Cùng nội dung (title/message/...) nhân bản cho từng người nhận → tạo mảng
  // payload, map field tiếng Anh sang tên cột DB tiếng Việt.
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
    // Lưu cả lô bằng MỘT query createMany (thay vì N lần create) cho hiệu năng;
    // sau đó emit lần lượt để ai đang online nhận noti real-time.
    await notificationRepository.createMany(notifications);
    notifications.forEach(n => emitNotificationToUser(n.nguoi_nhan_id, n));
  }

  return notifications.length;
}

export {
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
