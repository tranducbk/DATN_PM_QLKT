import { NOTIFICATION_TYPES, RESOURCE_TYPES } from '../../constants/notificationTypes.constants';
import { ROLES, ROLE_LABELS } from '../../constants/roles.constants';
import { emitNotificationToUser } from '../../utils/socketService';
import { accountRepository } from '../../repositories/account.repository';
import {
  DANH_HIEU_MAP,
  LOAI_DE_XUAT_MAP,
  getDanhHieuName,
} from '../../constants/danhHieu.constants';

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

    if (account?.QuanNhan?.ho_ten) {
      return account.QuanNhan.ho_ten;
    }

    if (account?.role && ROLE_LABELS[account.role]) {
      return ROLE_LABELS[account.role];
    }

    return username;
  } catch (error) {
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
