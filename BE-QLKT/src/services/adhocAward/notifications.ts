/*
 * ════════════════════════════════════════════════════════════════════════════
 *  NOTIFICATION BUILDER — KHEN THƯỞNG ĐỘT XUẤT (adhoc award)
 * ════════════════════════════════════════════════════════════════════════════
 *
 *  Khen thưởng đột xuất là khen thưởng do Admin nhập tay (không qua quy trình
 *  đề xuất/duyệt), trao cho 1 quân nhân (CA_NHAN) hoặc 1 đơn vị (TAP_THE) tại
 *  một thời điểm bất kỳ. File này là tầng builder thông báo cho 3 sự kiện:
 *  thêm (Created), cập nhật (Updated), xóa (Deleted) khen thưởng đột xuất.
 *
 *  Với mỗi sự kiện, hàm builder: (1) tìm DANH SÁCH NGƯỜI NHẬN, (2) dựng NỘI
 *  DUNG tiếng Việt, rồi (3) gọi dispatchNotifications để lưu DB + đẩy socket
 *  real-time ('new_notification' qua emitNotificationToUser).
 *
 *  AI NHẬN THÔNG BÁO:
 *  - Khen thưởng CÁ NHÂN: chính quân nhân được khen (nếu có tài khoản) +
 *    MANAGER quản lý đơn vị của quân nhân đó.
 *  - Khen thưởng TẬP THỂ: MANAGER quản lý đơn vị được khen.
 *  Phạm vi MANAGER luôn lọc theo CQDV (co_quan_don_vi_id) — xem
 *  fetchManagersByCoQuanId. Với đơn vị trực thuộc (DVTT), thông báo gửi cho
 *  MANAGER của CQDV cha vì MANAGER quản ở cấp CQDV, không ở cấp DVTT.
 *
 *  Các hàm builder được caller gọi FIRE-AND-FORGET (.catch/void) để việc gửi
 *  thông báo không chặn hay làm hỏng thao tác nghiệp vụ chính (tạo/sửa/xóa
 *  khen thưởng). Mọi hàm trả về SỐ thông báo đã tạo.
 * ════════════════════════════════════════════════════════════════════════════
 */

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

// Lấy mọi MANAGER có CQDV trùng coQuanId. Lọc theo CQDV (không phải DVTT) vì
// trong hệ thống MANAGER được phân quyền quản lý ở cấp Cơ quan đơn vị; DVTT
// (đơn vị trực thuộc) không có MANAGER riêng nên phải truy lên CQDV cha.
async function fetchManagersByCoQuanId(coQuanId: string) {
  return accountRepository.findManyRaw({
    where: {
      role: ROLES.MANAGER,
      QuanNhan: { co_quan_don_vi_id: coQuanId },
    },
    select: { id: true, role: true },
  });
}

// Lưu cả lô thông báo bằng MỘT query createMany (thay vì N lần create) rồi emit
// lần lượt để ai đang online nhận noti real-time. Trả về số đã tạo, 0 nếu không
// có người nhận. Đây là điểm chung mà cả 3 hàm notify... gọi đến cuối cùng.
async function dispatchNotifications(notifications: NotificationData[]): Promise<number> {
  if (notifications.length === 0) return 0;
  await notificationRepository.createMany(notifications);
  notifications.forEach(n =>
    emitNotificationToUser(n.nguoi_nhan_id, n as unknown as Record<string, unknown>)
  );
  return notifications.length;
}

// Báo khi Admin THÊM một khen thưởng đột xuất.
// - Nhánh CA_NHAN: gửi cho MANAGER quản lý đơn vị quân nhân + chính quân nhân.
// - Nhánh TAP_THE: gửi cho MANAGER quản lý đơn vị (CQDV hoặc DVTT) được khen.
// adminUsername là username thô → đổi sang tên hiển thị (ho_ten) cho dễ đọc.
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

    // Tìm CQDV để xác định MANAGER cần báo: ưu tiên CQDV gắn trực tiếp lên quân
    // nhân; nếu quân nhân chỉ thuộc DVTT thì lấy CQDV cha của DVTT đó.
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

    // Người nhận thứ hai: chính quân nhân được khen (nếu đã có tài khoản đăng
    // nhập). Dùng giọng "Bạn được..." và dẫn về trang hồ sơ cá nhân.
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

    // Đơn vị được khen có thể là CQDV hoặc DVTT (hai quan hệ loại trừ nhau).
    // Nếu là CQDV: báo thẳng cho MANAGER của chính CQDV đó.
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
      // Nếu là DVTT: DVTT không có MANAGER riêng → báo cho MANAGER của CQDV cha.
      // Tên CQDV cha (parentUnitName) ghép vào message để rõ ngữ cảnh đơn vị.
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

// Báo khi Admin CẬP NHẬT một khen thưởng đột xuất. Cùng tập người nhận và cách
// chọn đơn vị như notifyOnAdhocAwardCreated, chỉ khác type AWARD_UPDATED và nội
// dung "đã cập nhật". tai_nguyen_id luôn là id của bản ghi khen thưởng.
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

    // CQDV trực tiếp của quân nhân, fallback CQDV cha của DVTT (xem hàm Created).
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

// Báo khi Admin XÓA một khen thưởng đột xuất. Cùng tập người nhận và cách chọn
// đơn vị như hai hàm trên, nhưng type là AWARD_DELETED và tai_nguyen_id KHÔNG
// trỏ tới bản ghi khen thưởng (đã bị xóa) mà trỏ tới đối tượng còn tồn tại:
// id quân nhân (cá nhân) hoặc id đơn vị CQDV/DVTT (tập thể) — để link còn dẫn
// được tới một tài nguyên hợp lệ.
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

    // CQDV trực tiếp của quân nhân, fallback CQDV cha của DVTT (xem hàm Created).
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
