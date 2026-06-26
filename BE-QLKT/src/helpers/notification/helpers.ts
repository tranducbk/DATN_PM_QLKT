import { NOTIFICATION_TYPES, RESOURCE_TYPES } from '../../constants/notificationTypes.constants';
import { ROLES, ROLE_LABELS } from '../../constants/roles.constants';
import { emitNotificationToUser } from '../../utils/socketService';
import { accountRepository } from '../../repositories/account.repository';
import {
  DANH_HIEU_MAP,
  LOAI_DE_XUAT_MAP,
  getDanhHieuName,
} from '../../constants/danhHieu.constants';

/*
 * ════════════════════════════════════════════════════════════════════════════
 *  NOTIFICATION HELPERS — hàm tiện ích dùng chung cho mọi builder noti
 * ════════════════════════════════════════════════════════════════════════════
 *
 *  Đây là tầng tiện ích mà các builder theo domain (proposals/awards/personnel)
 *  import và gọi lại, tránh mỗi builder tự lặp logic format nhãn / lấy tên hiển thị.
 *
 *  HAI HÀM TIỆN ÍCH:
 *  - formatProposalType: đổi mã loại đề xuất sang nhãn tiếng Việt đẹp để ghép
 *    vào tiêu đề/nội dung noti (vd "Đề xuất khen thưởng cá nhân hàng năm").
 *  - getDisplayName: lấy tên hiển thị đẹp (ho_ten của quân nhân) từ username,
 *    fallback nhãn vai trò rồi cuối cùng là username thô → noti đọc dễ hiểu.
 *
 *  File cũng re-export các constant/map dùng chung (NOTIFICATION_TYPES,
 *  DANH_HIEU_MAP, ...) để builder import một chỗ thay vì rải import.
 * ════════════════════════════════════════════════════════════════════════════
 */

/**
 * Formats a human-readable proposal type label.
 * @param loaiDeXuat - Proposal type code
 * @returns Display label for notification content
 */
const formatProposalType = (loaiDeXuat: string): string => {
  const prefix = 'Đề xuất khen thưởng ';
  const typeName = LOAI_DE_XUAT_MAP[loaiDeXuat]; // tra nhãn tiếng Việt từ mã loại đề xuất
  // Tra được → "Đề xuất khen thưởng <nhãn viết thường>"; không tra được → tiêu đề chung.
  return typeName ? prefix + typeName.toLowerCase() : 'Đề xuất khen thưởng';
};

/**
 * Resolves display name from account username.
 * @param username - Account username
 * @returns Personnel full name when available, otherwise username
 */
async function getDisplayName(username: string): Promise<string> {
  try {
    // Tìm tài khoản theo username, kèm tên quân nhân (ho_ten) gắn với tài khoản đó.
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
      return ROLE_LABELS[account.role]; // tài khoản hệ thống (admin...) → hiện nhãn vai trò
    }

    return username; // không suy ra được tên đẹp → đành dùng username thô
  } catch (error) {
    // Tên hiển thị chỉ phục vụ nội dung noti → lỗi query không được làm hỏng
    // luồng gửi noti: log lại và fallback về username.
    console.error('NotificationHelper.getDisplayName failed', { username, error });
    return username;
  }
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
};
