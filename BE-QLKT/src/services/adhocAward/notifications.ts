import { accountRepository } from '../../repositories/account.repository';
import { notificationRepository } from '../../repositories/notification.repository';
import { getDisplayName } from '../../helpers/notification/helpers';
import { NOTIFICATION_TYPES, RESOURCE_TYPES } from '../../constants/notificationTypes.constants';
import { ROLES } from '../../constants/roles.constants';
import {
  NOTIFICATION_TITLES,
  notificationMessages,
} from '../../constants/notificationMessages.constants';
import { ADHOC_TYPE } from '../../constants/adhocType.constants';
import { emitNotificationToUser } from '../../utils/socketService';

interface NotificationData {
  nguoi_nhan_id: string;
  recipient_role: string;
  type: string;
  title: string;
  message: string;
  resource: string;
  tai_nguyen_id: string;
  link: string;
}

async function fetchManagersByCoQuanId(coQuanId: string) {
  return accountRepository.findManyRaw({
    where: {
      role: ROLES.MANAGER,
      QuanNhan: { co_quan_don_vi_id: coQuanId },
    },
    select: { id: true, role: true },
  });
}

async function dispatchNotifications(notifications: NotificationData[]): Promise<number> {
  if (notifications.length === 0) return 0;
  await notificationRepository.createMany(notifications);
  notifications.forEach(n =>
    emitNotificationToUser(n.nguoi_nhan_id, n as unknown as Record<string, unknown>)
  );
  return notifications.length;
}

export async function notifyOnAdhocAwardCreated(
  adhocAward: Record<string, unknown>,
  adminUsername: string
): Promise<number> {
  const notifications: NotificationData[] = [];
  const adminDisplayName = await getDisplayName(adminUsername);

  if (adhocAward.doi_tuong === ADHOC_TYPE.CA_NHAN && adhocAward.QuanNhan) {
    const personnel = adhocAward.QuanNhan as Record<string, unknown>;
    const awardName = adhocAward.hinh_thuc_khen_thuong as string;
    const year = adhocAward.nam as number;

    const cqdvId = personnel.co_quan_don_vi_id as string | null;
    const dvtt = personnel.DonViTrucThuoc as Record<string, unknown> | null;
    const managerCqdvId = cqdvId || (dvtt?.co_quan_don_vi_id as string | null);

    if (managerCqdvId) {
      const managers = await fetchManagersByCoQuanId(managerCqdvId);

      managers.forEach(manager => {
        notifications.push({
          nguoi_nhan_id: manager.id,
          recipient_role: manager.role,
          type: NOTIFICATION_TYPES.AWARD_ADDED,
          title: NOTIFICATION_TITLES.AWARD_ADDED,
          message: notificationMessages.adhocAward(
            adminDisplayName,
            'thêm',
            awardName,
            year,
            `quân nhân ${personnel.ho_ten || 'một quân nhân'}`
          ),
          resource: RESOURCE_TYPES.AWARDS,
          tai_nguyen_id: adhocAward.id as string,
          link: `/manager/adhoc-awards`,
        });
      });
    }

    const personnelAccount = await accountRepository.findFirstRaw({
      where: { quan_nhan_id: personnel.id as string },
      select: { id: true, role: true },
    });

    if (personnelAccount) {
      notifications.push({
        nguoi_nhan_id: personnelAccount.id,
        recipient_role: personnelAccount.role,
        type: NOTIFICATION_TYPES.AWARD_ADDED,
        title: NOTIFICATION_TITLES.AWARD_RECEIVED,
        message: `Bạn được khen thưởng "${awardName}" năm ${year}`,
        resource: RESOURCE_TYPES.AWARDS,
        tai_nguyen_id: adhocAward.id as string,
        link: `/user/profile`,
      });
    }
  } else if (adhocAward.doi_tuong === ADHOC_TYPE.TAP_THE) {
    const awardName = adhocAward.hinh_thuc_khen_thuong as string;
    const year = adhocAward.nam as number;
    let unitName = '';

    if (adhocAward.CoQuanDonVi) {
      const coQuanDonVi = adhocAward.CoQuanDonVi as Record<string, unknown>;
      unitName = coQuanDonVi.ten_don_vi as string;
      const managers = await fetchManagersByCoQuanId(adhocAward.co_quan_don_vi_id as string);

      managers.forEach(manager => {
        notifications.push({
          nguoi_nhan_id: manager.id,
          recipient_role: manager.role,
          type: NOTIFICATION_TYPES.AWARD_ADDED,
          title: NOTIFICATION_TITLES.UNIT_AWARD_RECEIVED,
          message: notificationMessages.adhocAward(
            adminDisplayName,
            'thêm',
            awardName,
            year,
            `đơn vị ${unitName || 'một đơn vị'}`
          ),
          resource: RESOURCE_TYPES.AWARDS,
          tai_nguyen_id: adhocAward.id as string,
          link: `/manager/adhoc-awards`,
        });
      });
    } else if (adhocAward.DonViTrucThuoc) {
      const donViTrucThuoc = adhocAward.DonViTrucThuoc as Record<string, unknown>;
      unitName = donViTrucThuoc.ten_don_vi as string;
      const parentUnitName = (donViTrucThuoc.CoQuanDonVi as Record<string, unknown> | null)
        ?.ten_don_vi as string | undefined;

      if (donViTrucThuoc.co_quan_don_vi_id) {
        const parentManagers = await fetchManagersByCoQuanId(
          donViTrucThuoc.co_quan_don_vi_id as string
        );

        parentManagers.forEach(manager => {
          notifications.push({
            nguoi_nhan_id: manager.id,
            recipient_role: manager.role,
            type: NOTIFICATION_TYPES.AWARD_ADDED,
            title: NOTIFICATION_TITLES.SUBUNIT_AWARD_RECEIVED,
            message: notificationMessages.adhocAward(
              adminDisplayName,
              'thêm',
              awardName,
              year,
              `đơn vị ${unitName || 'một đơn vị'}${parentUnitName ? ` (thuộc ${parentUnitName})` : ''}`
            ),
            resource: RESOURCE_TYPES.AWARDS,
            tai_nguyen_id: adhocAward.id as string,
            link: `/manager/adhoc-awards`,
          });
        });
      }
    }
  }

  return dispatchNotifications(notifications);
}

export async function notifyOnAdhocAwardUpdated(
  adhocAward: Record<string, unknown>,
  adminUsername: string
): Promise<number> {
  const notifications: NotificationData[] = [];
  const adminDisplayName = await getDisplayName(adminUsername);
  const awardName = adhocAward.hinh_thuc_khen_thuong as string;
  const year = adhocAward.nam as number;

  if (adhocAward.doi_tuong === ADHOC_TYPE.CA_NHAN && adhocAward.QuanNhan) {
    const personnel = adhocAward.QuanNhan as Record<string, unknown>;

    const cqdvId = personnel.co_quan_don_vi_id as string | null;
    const dvtt = personnel.DonViTrucThuoc as Record<string, unknown> | null;
    const managerCqdvId = cqdvId || (dvtt?.co_quan_don_vi_id as string | null);

    if (managerCqdvId) {
      const managers = await fetchManagersByCoQuanId(managerCqdvId);

      managers.forEach(manager => {
        notifications.push({
          nguoi_nhan_id: manager.id,
          recipient_role: manager.role,
          type: NOTIFICATION_TYPES.AWARD_UPDATED,
          title: NOTIFICATION_TITLES.AWARD_UPDATED,
          message: notificationMessages.adhocAward(
            adminDisplayName,
            'cập nhật',
            awardName,
            year,
            `quân nhân ${personnel.ho_ten || 'một quân nhân'}`
          ),
          resource: RESOURCE_TYPES.AWARDS,
          tai_nguyen_id: adhocAward.id as string,
          link: `/manager/adhoc-awards`,
        });
      });
    }

    const personnelAccount = await accountRepository.findFirstRaw({
      where: { quan_nhan_id: personnel.id as string },
      select: { id: true, role: true },
    });

    if (personnelAccount) {
      notifications.push({
        nguoi_nhan_id: personnelAccount.id,
        recipient_role: personnelAccount.role,
        type: NOTIFICATION_TYPES.AWARD_UPDATED,
        title: NOTIFICATION_TITLES.AWARD_UPDATED_RECIPIENT,
        message: `Khen thưởng đột xuất "${awardName}" năm ${year} của bạn đã được cập nhật`,
        resource: RESOURCE_TYPES.AWARDS,
        tai_nguyen_id: adhocAward.id as string,
        link: `/user/profile`,
      });
    }
  } else if (adhocAward.doi_tuong === ADHOC_TYPE.TAP_THE) {
    let unitName = '';

    if (adhocAward.CoQuanDonVi) {
      const coQuanDonVi = adhocAward.CoQuanDonVi as Record<string, unknown>;
      unitName = coQuanDonVi.ten_don_vi as string;
      const managers = await fetchManagersByCoQuanId(adhocAward.co_quan_don_vi_id as string);

      managers.forEach(manager => {
        notifications.push({
          nguoi_nhan_id: manager.id,
          recipient_role: manager.role,
          type: NOTIFICATION_TYPES.AWARD_UPDATED,
          title: NOTIFICATION_TITLES.AWARD_UPDATED,
          message: notificationMessages.adhocAward(
            adminDisplayName,
            'cập nhật',
            awardName,
            year,
            `đơn vị ${unitName || 'một đơn vị'}`
          ),
          resource: RESOURCE_TYPES.AWARDS,
          tai_nguyen_id: adhocAward.id as string,
          link: `/manager/adhoc-awards`,
        });
      });
    } else if (adhocAward.DonViTrucThuoc) {
      const donViTrucThuoc = adhocAward.DonViTrucThuoc as Record<string, unknown>;
      unitName = donViTrucThuoc.ten_don_vi as string;
      const parentUnitName = (donViTrucThuoc.CoQuanDonVi as Record<string, unknown> | null)
        ?.ten_don_vi as string | undefined;

      if (donViTrucThuoc.co_quan_don_vi_id) {
        const parentManagers = await fetchManagersByCoQuanId(
          donViTrucThuoc.co_quan_don_vi_id as string
        );

        parentManagers.forEach(manager => {
          notifications.push({
            nguoi_nhan_id: manager.id,
            recipient_role: manager.role,
            type: NOTIFICATION_TYPES.AWARD_UPDATED,
            title: NOTIFICATION_TITLES.AWARD_UPDATED,
            message: notificationMessages.adhocAward(
              adminDisplayName,
              'cập nhật',
              awardName,
              year,
              `đơn vị ${unitName || 'một đơn vị'}${parentUnitName ? ` (thuộc ${parentUnitName})` : ''}`
            ),
            resource: RESOURCE_TYPES.AWARDS,
            tai_nguyen_id: adhocAward.id as string,
            link: `/manager/adhoc-awards`,
          });
        });
      }
    }
  }

  return dispatchNotifications(notifications);
}

export async function notifyOnAdhocAwardDeleted(
  adhocAward: Record<string, unknown>,
  adminUsername: string
): Promise<number> {
  const notifications: NotificationData[] = [];
  const adminDisplayName = await getDisplayName(adminUsername);
  const awardName = adhocAward.hinh_thuc_khen_thuong as string;
  const year = adhocAward.nam as number;

  if (adhocAward.doi_tuong === ADHOC_TYPE.CA_NHAN && adhocAward.QuanNhan) {
    const personnel = adhocAward.QuanNhan as Record<string, unknown>;

    const cqdvId = personnel.co_quan_don_vi_id as string | null;
    const dvtt = personnel.DonViTrucThuoc as Record<string, unknown> | null;
    const managerCqdvId = cqdvId || (dvtt?.co_quan_don_vi_id as string | null);

    if (managerCqdvId) {
      const managers = await fetchManagersByCoQuanId(managerCqdvId);

      managers.forEach(manager => {
        notifications.push({
          nguoi_nhan_id: manager.id,
          recipient_role: manager.role,
          type: NOTIFICATION_TYPES.AWARD_DELETED,
          title: NOTIFICATION_TITLES.AWARD_DELETED,
          message: notificationMessages.adhocAward(
            adminDisplayName,
            'xóa',
            awardName,
            year,
            `quân nhân ${personnel.ho_ten || 'một quân nhân'}`
          ),
          resource: RESOURCE_TYPES.AWARDS,
          tai_nguyen_id: personnel.id as string,
          link: `/manager/adhoc-awards`,
        });
      });
    }

    const personnelAccount = await accountRepository.findFirstRaw({
      where: { quan_nhan_id: personnel.id as string },
      select: { id: true, role: true },
    });

    if (personnelAccount) {
      notifications.push({
        nguoi_nhan_id: personnelAccount.id,
        recipient_role: personnelAccount.role,
        type: NOTIFICATION_TYPES.AWARD_DELETED,
        title: NOTIFICATION_TITLES.AWARD_DELETED_RECIPIENT,
        message: `Khen thưởng đột xuất "${awardName}" năm ${year} của bạn đã bị xóa khỏi hệ thống`,
        resource: RESOURCE_TYPES.AWARDS,
        tai_nguyen_id: personnel.id as string,
        link: `/user/profile`,
      });
    }
  } else if (adhocAward.doi_tuong === ADHOC_TYPE.TAP_THE) {
    let unitName = '';

    if (adhocAward.CoQuanDonVi) {
      const coQuanDonVi = adhocAward.CoQuanDonVi as Record<string, unknown>;
      unitName = coQuanDonVi.ten_don_vi as string;
      const managers = await fetchManagersByCoQuanId(adhocAward.co_quan_don_vi_id as string);

      managers.forEach(manager => {
        notifications.push({
          nguoi_nhan_id: manager.id,
          recipient_role: manager.role,
          type: NOTIFICATION_TYPES.AWARD_DELETED,
          title: NOTIFICATION_TITLES.AWARD_DELETED,
          message: notificationMessages.adhocAward(
            adminDisplayName,
            'xóa',
            awardName,
            year,
            `đơn vị ${unitName || 'một đơn vị'}`
          ),
          resource: RESOURCE_TYPES.AWARDS,
          tai_nguyen_id: adhocAward.co_quan_don_vi_id as string,
          link: `/manager/adhoc-awards`,
        });
      });
    } else if (adhocAward.DonViTrucThuoc) {
      const donViTrucThuoc = adhocAward.DonViTrucThuoc as Record<string, unknown>;
      unitName = donViTrucThuoc.ten_don_vi as string;
      const parentUnitName = (donViTrucThuoc.CoQuanDonVi as Record<string, unknown> | null)
        ?.ten_don_vi as string | undefined;

      if (donViTrucThuoc.co_quan_don_vi_id) {
        const parentManagers = await fetchManagersByCoQuanId(
          donViTrucThuoc.co_quan_don_vi_id as string
        );

        parentManagers.forEach(manager => {
          notifications.push({
            nguoi_nhan_id: manager.id,
            recipient_role: manager.role,
            type: NOTIFICATION_TYPES.AWARD_DELETED,
            title: NOTIFICATION_TITLES.AWARD_DELETED,
            message: notificationMessages.adhocAward(
              adminDisplayName,
              'xóa',
              awardName,
              year,
              `đơn vị ${unitName || 'một đơn vị'}${parentUnitName ? ` (thuộc ${parentUnitName})` : ''}`
            ),
            resource: RESOURCE_TYPES.AWARDS,
            tai_nguyen_id: adhocAward.don_vi_truc_thuoc_id as string,
            link: `/manager/adhoc-awards`,
          });
        });
      }
    }
  }

  return dispatchNotifications(notifications);
}
