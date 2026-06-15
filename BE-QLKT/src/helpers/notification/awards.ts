/*
 * ════════════════════════════════════════════════════════════════════════════
 *  NOTIFICATION BUILDER — KHEN THƯỞNG (awards)
 * ════════════════════════════════════════════════════════════════════════════
 *
 *  Đây là tầng builder: với mỗi sự kiện liên quan KHEN THƯỞNG, file này
 *  (1) tìm DANH SÁCH NGƯỜI NHẬN phù hợp, (2) dựng NỘI DUNG thông báo tiếng
 *  Việt, rồi (3) gọi repository lưu DB + emitNotificationToUser đẩy socket
 *  real-time ('new_notification'). Phần lưu + emit dùng lại đúng pattern của
 *  helpers.ts (createMany một lần cho cả lô, rồi emit lần lượt).
 *
 *  CÁC SỰ KIỆN ĐƯỢC PHỤC VỤ TRONG FILE NÀY:
 *  - notifyManagersOnAwardAdded     : thêm danh sách khen thưởng cho 1 đơn vị
 *  - notifyUserOnAchievementApproved: duyệt 1 thành tích NCKH của quân nhân
 *  - notifyOnAwardDeleted           : xóa 1 khen thưởng của quân nhân
 *  - notifyUsersOnAwardApproved     : duyệt đề xuất → ghi nhận khen thưởng
 *  - notifyAdminsOnBulkBypass       : SUPER_ADMIN sửa dữ liệu cũ (bỏ qua ĐK)
 *  - notifyOnImport                 : nhập dữ liệu khen thưởng bằng Excel
 *  (notifyOnBulkAwardAdded nằm ở file riêng awardsBulkAdded.ts, re-export cuối)
 *
 *  AI NHẬN THÔNG BÁO — nguyên tắc chung:
 *  - Quân nhân được/bị tác động (qua account gắn quan_nhan_id).
 *  - MANAGER quản lý đơn vị của quân nhân đó.
 *  - Phạm vi đơn vị ưu tiên CQDV (co_quan_don_vi_id) trước DVTT
 *    (don_vi_truc_thuoc_id), vì MANAGER quản ở cấp CQDV.
 *
 *  Mọi hàm trả về SỐ thông báo đã tạo; hầu hết bọc try/catch trả 0 khi lỗi vì
 *  thông báo là tác vụ phụ (caller gọi fire-and-forget) — không được làm hỏng
 *  thao tác nghiệp vụ chính.
 * ════════════════════════════════════════════════════════════════════════════
 */

import {
  NOTIFICATION_TYPES,
  RESOURCE_TYPES,
  ROLES,
  emitNotificationToUser,
  DANH_HIEU_MAP,
  LOAI_DE_XUAT_MAP,
  getDanhHieuName,
  getDisplayName,
} from './helpers';
import { PROPOSAL_TYPES } from '../../constants/proposalTypes.constants';
import { AWARD_SLUGS } from '../../constants/awardSlugs.constants';
import { AWARD_RESOURCE, getAwardLabelByProposalType } from '../../constants/awardResource.constants';
import { isFeatureEnabled } from '../settingsHelper';
import { accountRepository } from '../../repositories/account.repository';
import { notificationRepository } from '../../repositories/notification.repository';
import { quanNhanRepository } from '../../repositories/quanNhan.repository';

interface AchievementInfo {
  id: string;
  quan_nhan_id: string;
  loai: string;
  nam?: number | string | null;
}

interface AwardInfo {
  danh_hieu?: string | null;
  loai?: string | null;
  nam?: number | string | null;
}

interface PersonnelInfo {
  id: string;
  ho_ten?: string | null;
  co_quan_don_vi_id?: string | null;
  don_vi_truc_thuoc_id?: string | null;
}

interface ProposalAwardData {
  id: string;
  data_danh_hieu?: unknown;
  data_thanh_tich?: unknown;
  data_nien_han?: unknown;
  data_cong_hien?: unknown;
  [key: string]: unknown;
}

interface NotificationInput {
  nguoi_nhan_id: string;
  recipient_role: string;
  type: string;
  title: string;
  message: string;
  resource: string;
  tai_nguyen_id: string;
  link: string | null;
  [key: string]: unknown;
}

interface TitleDataItem {
  personnel_id?: string;
  don_vi_id?: string;
  danh_hieu?: string;
  loai?: string;
  nam?: number | string;
}

// Báo cho MANAGER khi Admin thêm cả một danh sách khen thưởng cho 1 đơn vị.
// Người nhận: chỉ MANAGER có CQDV trùng donViId (đúng đơn vị được thêm).
async function notifyManagersOnAwardAdded(
  donViId: string,
  donViName: string,
  year: number | string,
  awardType: string,
  adminUsername: string
): Promise<number> {
  const managers = await accountRepository.findManyRaw({
    where: {
      role: ROLES.MANAGER,
      QuanNhan: {
        co_quan_don_vi_id: donViId,
      },
    },
    select: {
      id: true,
      role: true,
    },
  });

  if (managers.length === 0) {
    return 0;
  }

  // adminUsername là username thô — đổi sang tên hiển thị (ho_ten) cho dễ đọc.
  const adminDisplayName = await getDisplayName(adminUsername);

  const notifications = managers.map(manager => ({
    nguoi_nhan_id: manager.id,
    recipient_role: manager.role,
    type: NOTIFICATION_TYPES.AWARD_ADDED,
    title: 'Khen thưởng mới đã được thêm',
    message: `${adminDisplayName} đã thêm danh sách khen thưởng ${awardType} năm ${year} cho đơn vị ${donViName}`,
    resource: RESOURCE_TYPES.AWARDS,
    tai_nguyen_id: donViId,
    link: `/manager/awards?don_vi_id=${donViId}&nam=${year}`,
  }));

  await notificationRepository.createMany(notifications);
  notifications.forEach(n => emitNotificationToUser(n.nguoi_nhan_id, n));

  return notifications.length;
}

// Báo cho CHÍNH quân nhân khi thành tích NCKH của họ được duyệt.
// Chỉ gửi 1 người (chủ thành tích); không cần báo MANAGER ở case này.
async function notifyUserOnAchievementApproved(
  achievement: AchievementInfo,
  approverUsername: string
): Promise<{ nguoi_nhan_id: string | null } | null> {
  const account = await accountRepository.findFirstRaw({
    where: {
      quan_nhan_id: achievement.quan_nhan_id,
    },
    select: {
      id: true,
      role: true,
    },
  });

  // Quân nhân chưa có tài khoản đăng nhập → không có đích để gửi.
  if (!account) {
    return null;
  }

  const approverDisplayName = await getDisplayName(approverUsername);

  // achievement.loai là mã loại thành tích → đổi sang tên tiếng Việt hiển thị.
  const loaiName = getDanhHieuName(achievement.loai);

  const notification = await notificationRepository.create({
    nguoi_nhan_id: account.id,
    recipient_role: account.role,
    type: NOTIFICATION_TYPES.ACHIEVEMENT_APPROVED,
    title: 'Thành tích khoa học đã được phê duyệt',
    message: `${loaiName} năm ${achievement.nam || 'không xác định'} của bạn đã được ${approverDisplayName} phê duyệt`,
    resource: RESOURCE_TYPES.ACHIEVEMENTS,
    tai_nguyen_id: achievement.id,
    link: `/user/profile`,
  });

  if (notification.nguoi_nhan_id) {
    emitNotificationToUser(notification.nguoi_nhan_id, notification);
  }
  return notification;
}

// Báo khi 1 khen thưởng của quân nhân bị Admin xóa.
// Hai nhóm người nhận: (1) MANAGER quản lý đơn vị quân nhân, (2) chính quân nhân.
async function notifyOnAwardDeleted(
  award: AwardInfo,
  personnel: PersonnelInfo,
  awardType: string,
  adminUsername: string
): Promise<number> {
  try {
    const notifications: NotificationInput[] = [];
    const adminDisplayName = await getDisplayName(adminUsername);

    // awardType là mã loại đề xuất → đổi sang nhãn tiếng Việt của khen thưởng.
    const awardTypeName = getAwardLabelByProposalType(awardType);

    const nam = award.nam || '';

    // Xác định đơn vị của quân nhân: CQDV trước, DVTT sau (CQDV là cấp cha).
    const donViId = personnel.co_quan_don_vi_id || personnel.don_vi_truc_thuoc_id;
    if (donViId) {
      // Bắt cả MANAGER ở cấp CQDV lẫn DVTT khớp donViId — để không sót ai quản lý.
      const managers = await accountRepository.findManyRaw({
        where: {
          role: ROLES.MANAGER,
          QuanNhan: {
            OR: [{ co_quan_don_vi_id: donViId }, { don_vi_truc_thuoc_id: donViId }],
          },
        },
        select: {
          id: true,
          role: true,
        },
      });

      managers.forEach(manager => {
        notifications.push({
          nguoi_nhan_id: manager.id,
          recipient_role: manager.role,
          type: NOTIFICATION_TYPES.AWARD_DELETED,
          title: 'Khen thưởng đã bị xóa',
          message: `${adminDisplayName} đã xóa ${awardTypeName}${
            nam ? ` năm ${nam}` : ''
          } của quân nhân ${personnel.ho_ten || 'Chưa xác định'}`,
          resource: RESOURCE_TYPES.AWARDS,
          tai_nguyen_id: personnel.id,
          link: `/manager/personnel/${personnel.id}`,
        });
      });
    }

    // Người nhận thứ hai: chính quân nhân (nếu có tài khoản) — báo bằng giọng
    // "của bạn", dẫn về trang hồ sơ cá nhân thay vì trang quản lý.
    const personnelAccount = await accountRepository.findFirstRaw({
      where: {
        quan_nhan_id: personnel.id,
      },
      select: {
        id: true,
        role: true,
      },
    });

    if (personnelAccount) {
      notifications.push({
        nguoi_nhan_id: personnelAccount.id,
        recipient_role: personnelAccount.role,
        type: NOTIFICATION_TYPES.AWARD_DELETED,
        title: 'Khen thưởng của bạn đã bị xóa',
        message: `${awardTypeName}${
          nam ? ` năm ${nam}` : ''
        } của bạn đã bị ${adminDisplayName} xóa khỏi hệ thống`,
        resource: RESOURCE_TYPES.AWARDS,
        tai_nguyen_id: personnel.id,
        link: `/user/profile`,
      });
    }

    if (notifications.length > 0) {
      await notificationRepository.createMany(notifications);
      notifications.forEach(n => emitNotificationToUser(n.nguoi_nhan_id, n));
    }

    return notifications.length;
  } catch (error) {
    console.error('NotificationAwards.notifyOnAwardDeleted failed', { error });
    return 0;
  }
}

// Báo cho từng quân nhân khi đề xuất khen thưởng của họ được Admin duyệt.
// Một đề xuất có thể chứa nhiều quân nhân + nhiều LOẠI dữ liệu khen thưởng
// (danh hiệu hằng năm, thành tích NCKH, niên hạn, cống hiến); hàm gom đúng
// phần của mỗi người để dựng câu liệt kê "đã nhận: A, B, C".
async function notifyUsersOnAwardApproved(
  personnelIds: string[],
  proposal: ProposalAwardData,
  approverUsername: string
): Promise<number> {
  try {
    if (!personnelIds || personnelIds.length === 0) {
      return 0;
    }

    const notifications: NotificationInput[] = [];
    const approverDisplayName = await getDisplayName(approverUsername);

    // Batch query toàn bộ account theo danh sách quan_nhan_id (tránh N+1).
    const accounts = await accountRepository.findManyRaw({
      where: {
        quan_nhan_id: {
          in: personnelIds,
        },
      },
      select: {
        id: true,
        role: true,
        quan_nhan_id: true,
      },
    });

    // 4 cột JSON trên đề xuất, mỗi cột là 1 loại khen thưởng. Cột nào không
    // dùng cho loại đề xuất này sẽ là null → toArray() trả mảng rỗng an toàn.
    const toArray = (v: unknown): Record<string, unknown>[] => (Array.isArray(v) ? v : []);
    const danhHieuData = toArray(proposal.data_danh_hieu);
    const thanhTichData = toArray(proposal.data_thanh_tich);
    const nienHanData = toArray(proposal.data_nien_han);
    const congHienData = toArray(proposal.data_cong_hien);

    for (const account of accounts) {
      // Gom các khen thưởng thuộc riêng quân nhân này từ cả 4 loại dữ liệu.
      // DANH_HIEU_MAP đổi mã danh hiệu (vd 'BKBQP') sang tên hiển thị tiếng Việt.
      const userAwards: string[] = [];

      const userDanhHieu = danhHieuData.filter(
        (item: Record<string, unknown>) => item.personnel_id === account.quan_nhan_id
      );
      userDanhHieu.forEach((item: Record<string, unknown>) => {
        const dh = item.danh_hieu as string | undefined;
        if (dh && DANH_HIEU_MAP[dh]) {
          userAwards.push(`${DANH_HIEU_MAP[dh]}${item.nam ? ` (năm ${item.nam})` : ''}`);
        }
      });

      const userNienHan = nienHanData.filter(
        (item: Record<string, unknown>) => item.personnel_id === account.quan_nhan_id
      );
      userNienHan.forEach((item: Record<string, unknown>) => {
        const dh = item.danh_hieu as string | undefined;
        if (dh && DANH_HIEU_MAP[dh]) {
          userAwards.push(`${DANH_HIEU_MAP[dh]}${item.nam ? ` (năm ${item.nam})` : ''}`);
        }
      });

      const userCongHien = congHienData.filter(
        (item: Record<string, unknown>) => item.personnel_id === account.quan_nhan_id
      );
      userCongHien.forEach((item: Record<string, unknown>) => {
        const dh = item.danh_hieu as string | undefined;
        if (dh && DANH_HIEU_MAP[dh]) {
          userAwards.push(`${DANH_HIEU_MAP[dh]}${item.nam ? ` (năm ${item.nam})` : ''}`);
        }
      });

      // Thành tích NCKH định danh loại qua field `loai` (khác 3 loại trên
      // dùng `danh_hieu`) — cấu trúc dữ liệu mỗi loại đề xuất khác nhau.
      const userThanhTich = thanhTichData.filter(
        (item: Record<string, unknown>) => item.personnel_id === account.quan_nhan_id
      );
      userThanhTich.forEach((item: Record<string, unknown>) => {
        const loai = item.loai as string | undefined;
        if (loai && DANH_HIEU_MAP[loai]) {
          userAwards.push(`${DANH_HIEU_MAP[loai]}${item.nam ? ` (năm ${item.nam})` : ''}`);
        }
      });

      // Liệt kê tên khen thưởng nếu gom được; nếu không khớp loại nào thì gửi
      // câu chung chung để vẫn báo cho quân nhân biết họ được ghi nhận.
      let message = '';
      if (userAwards.length > 0) {
        message = `Khen thưởng của bạn đã được ${approverDisplayName} thêm vào hệ thống: ${userAwards.join(
          ', '
        )}.`;
      } else {
        message = `Khen thưởng của bạn đã được ${approverDisplayName} thêm vào hệ thống.`;
      }

      notifications.push({
        nguoi_nhan_id: account.id,
        recipient_role: account.role,
        type: NOTIFICATION_TYPES.AWARD_ADDED,
        title: 'Bạn đã nhận khen thưởng',
        message: message,
        resource: RESOURCE_TYPES.PROPOSALS,
        tai_nguyen_id: proposal.id,
        // Quân nhân có quyền MANAGER vẫn được báo, nhưng dẫn về trang quản lý
        // hồ sơ; quân nhân thường dẫn về dashboard cá nhân.
        link:
          account.role === ROLES.MANAGER
            ? `/manager/personnel/${account.quan_nhan_id}`
            : `/user/dashboard`,
      });
    }

    if (notifications.length > 0) {
      await notificationRepository.createMany(notifications);
      notifications.forEach(n => emitNotificationToUser(n.nguoi_nhan_id, n));
    }

    return notifications.length;
  } catch (error) {
    console.error('NotificationAwards.notifyUsersOnAwardApproved failed', { error });
    return 0;
  }
}


/**
 * Notifies ALL admins about a SUPER_ADMIN bypass action (data correction).
 * Adds forensic transparency — admins see a notification flagging that historical
 * data was inserted bypassing eligibility checks. Personnel + managers are notified
 * separately via the standard `notifyOnBulkAwardAdded` flow.
 *
 * @param personnelIds - Affected personnel IDs (for count summary)
 * @param unitIds - Affected unit IDs (for unit-type bypass)
 * @param awardType - Proposal type (e.g. NIEN_HAN, HC_QKQT)
 * @param nam - Award year
 * @param saUsername - SUPER_ADMIN username triggering the bypass
 * @returns Number of notifications dispatched
 */
async function notifyAdminsOnBulkBypass(
  personnelIds: string[],
  unitIds: string[],
  awardType: string,
  nam: number | string,
  saUsername: string
): Promise<number> {
  try {
    const admins = await accountRepository.findManyRaw({
      where: { role: ROLES.ADMIN },
      select: { id: true, role: true },
    });
    if (admins.length === 0) return 0;

    const saDisplayName = await getDisplayName(saUsername);
    const awardTypeName = getAwardLabelByProposalType(awardType);
    const targetCount = personnelIds.length + unitIds.length;
    // Đề xuất đơn vị đếm theo số đơn vị; còn lại đếm theo số quân nhân.
    const targetText =
      awardType === PROPOSAL_TYPES.DON_VI_HANG_NAM
        ? `${unitIds.length} đơn vị`
        : `${personnelIds.length} quân nhân`;

    const message =
      `${saDisplayName} đã sửa dữ liệu cũ (bỏ qua kiểm tra điều kiện): ${awardTypeName}` +
      `${nam ? ` năm ${nam}` : ''} cho ${targetText}.`;

    const notifications: NotificationInput[] = admins.map(admin => ({
      nguoi_nhan_id: admin.id,
      recipient_role: admin.role,
      type: NOTIFICATION_TYPES.AWARD_ADDED,
      title: 'Quản trị viên đã sửa dữ liệu khen thưởng',
      message,
      resource: RESOURCE_TYPES.AWARDS,
      tai_nguyen_id: null,
      link: `/admin/awards?nam=${nam}`,
    }));

    if (targetCount === 0) return 0;
    await notificationRepository.createMany(notifications);
    notifications.forEach(n => emitNotificationToUser(n.nguoi_nhan_id, n));
    return notifications.length;
  } catch (error) {
    console.error('NotificationAwards.notifyAdminsOnBulkBypass failed', { error });
    return 0;
  }
}

/**
 * Notifies unit managers after award imports when the feature flag is enabled.
 * @param adminId - Admin account ID that triggered import
 * @param awardResource - Award slug from `AWARD_SLUGS` (e.g. `AWARD_SLUGS.ANNUAL_REWARDS`)
 * @param importedCount - Number of imported records
 * @param personnelIds - Imported personnel IDs for individual-award imports
 * @param unitIds - Imported unit IDs for unit-award imports
 */
async function notifyOnImport(
  adminId: string,
  awardResource: string,
  importedCount: number,
  personnelIds: string[] = [],
  unitIds: string[] = []
): Promise<number> {
  try {
    // Báo cáo nhập dữ liệu là tùy chọn — admin có thể tắt qua feature flag
    // để tránh spam thông báo khi import số lượng lớn.
    const enabled = await isFeatureEnabled('allow_notify_import');
    if (!enabled) return 0;

    const admin = await accountRepository.findUniqueRaw({
      where: { id: adminId },
      select: { username: true },
    });
    if (!admin) return 0;

    const adminDisplayName = await getDisplayName(admin.username);
    // Suy ra nhãn khen thưởng từ slug: ưu tiên tên theo loại đề xuất, không có
    // thì lấy tên tiếng Việt của resource, cuối cùng mới dùng slug thô.
    const meta = AWARD_RESOURCE[awardResource as keyof typeof AWARD_RESOURCE];
    const proposalType = meta?.proposalType ?? null;
    const awardLabel = proposalType ? LOAI_DE_XUAT_MAP[proposalType] : (meta?.vi ?? awardResource);

    // Gom mọi đơn vị bị ảnh hưởng: cả CQDV lẫn DVTT của mỗi quân nhân (Set để
    // khử trùng) — sẽ dùng để tìm đúng MANAGER cần báo.
    const affectedUnitIds = new Set<string>();

    if (personnelIds.length > 0) {
      const personnel = await quanNhanRepository.findManyRaw({
        where: { id: { in: personnelIds } },
        select: { co_quan_don_vi_id: true, don_vi_truc_thuoc_id: true },
      });
      for (const p of personnel) {
        if (p.co_quan_don_vi_id) affectedUnitIds.add(p.co_quan_don_vi_id);
        if (p.don_vi_truc_thuoc_id) affectedUnitIds.add(p.don_vi_truc_thuoc_id);
      }
    }

    for (const uid of unitIds) {
      affectedUnitIds.add(uid);
    }

    if (affectedUnitIds.size === 0) return 0;

    const managers = await accountRepository.findManyRaw({
      where: {
        role: ROLES.MANAGER,
        QuanNhan: {
          OR: [
            { co_quan_don_vi_id: { in: [...affectedUnitIds] } },
            { don_vi_truc_thuoc_id: { in: [...affectedUnitIds] } },
          ],
        },
      },
      select: { id: true, role: true },
    });

    const notifications: {
      nguoi_nhan_id: string;
      recipient_role: string;
      type: string;
      title: string;
      message: string;
      resource: string;
      tai_nguyen_id: string | null;
      link: string | null;
    }[] = [];

    // Một MANAGER có thể khớp nhiều đơn vị trong affectedUnitIds → dedupe theo
    // id để mỗi người chỉ nhận 1 thông báo import.
    if (managers.length > 0) {
      const uniqueManagers = [...new Map(managers.map(m => [m.id, m])).values()];
      for (const manager of uniqueManagers) {
        notifications.push({
          nguoi_nhan_id: manager.id,
          recipient_role: manager.role,
          type: NOTIFICATION_TYPES.AWARD_ADDED,
          title: 'Khen thưởng mới được nhập dữ liệu',
          message: `${adminDisplayName} đã thêm ${importedCount} danh hiệu ${awardLabel} cho đơn vị của bạn`,
          resource: RESOURCE_TYPES.AWARDS,
          tai_nguyen_id: null,
          link: `/manager/awards`,
        });
      }
    }

    // Chỉ báo cho chính quân nhân với khen thưởng cá nhân; khen thưởng đơn vị
    // (unitIds) không gắn với cá nhân nào nên bỏ qua nhánh này.
    if (personnelIds.length > 0) {
      const personnelAccounts = await accountRepository.findManyRaw({
        where: { quan_nhan_id: { in: personnelIds } },
        select: { id: true, role: true },
      });

      for (const account of personnelAccounts) {
        notifications.push({
          nguoi_nhan_id: account.id,
          recipient_role: account.role,
          type: NOTIFICATION_TYPES.AWARD_ADDED,
          title: 'Bạn đã nhận khen thưởng',
          message: `${adminDisplayName} đã thêm ${awardLabel} cho bạn qua nhập dữ liệu`,
          resource: RESOURCE_TYPES.AWARDS,
          tai_nguyen_id: null,
          link: `/user/profile`,
        });
      }
    }

    if (notifications.length === 0) return 0;

    await notificationRepository.createMany(notifications);
    notifications.forEach(n => emitNotificationToUser(n.nguoi_nhan_id, n));

    return notifications.length;
  } catch (error) {
    console.error('Failed to create/send award notifications:', error);
    return 0;
  }
}

export {
  notifyManagersOnAwardAdded,
  notifyUserOnAchievementApproved,
  notifyOnAwardDeleted,
  notifyUsersOnAwardApproved,
  notifyAdminsOnBulkBypass,
  notifyOnImport,
};

// Builder thêm khen thưởng hàng loạt tách riêng (logic dài), re-export tại đây
// để caller chỉ cần import từ một module 'awards'.
export { notifyOnBulkAwardAdded } from './awardsBulkAdded';
