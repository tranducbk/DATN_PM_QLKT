/*
 * ════════════════════════════════════════════════════════════════════════════
 *  NOTIFICATION BUILDER — THÊM KHEN THƯỞNG HÀNG LOẠT (bulk add)
 * ════════════════════════════════════════════════════════════════════════════
 *
 *  Khi Admin thêm trực tiếp khen thưởng cho NHIỀU quân nhân và/hoặc NHIỀU đơn
 *  vị cùng lúc (không qua quy trình đề xuất). File chỉ có 1 hàm public
 *  notifyOnBulkAwardAdded, xử lý 2 nhánh độc lập:
 *
 *  1) Nhánh CÁ NHÂN (personnelIds): với mỗi quân nhân →
 *     - báo chính họ (liệt kê tên các danh hiệu vừa nhận),
 *     - báo MANAGER quản lý đơn vị của họ (gộp 1 lần/đơn vị).
 *  2) Nhánh ĐƠN VỊ (unitIds, chỉ với DON_VI_HANG_NAM) → báo MANAGER của đơn vị.
 *
 *  TỐI ƯU HIỆU NĂNG (nhánh cá nhân): thay vì query MANAGER trong vòng lặp từng
 *  quân nhân (N+1), hàm gom toàn bộ đơn vị → query MANAGER MỘT lần → dựng Map
 *  donViId → managers để tra cứu trong loop. Đồng thời dedupe để mỗi MANAGER
 *  chỉ nhận 1 thông báo dù quản lý nhiều quân nhân được thêm.
 *
 *  titleData chứa chi tiết danh hiệu theo từng quân nhân/đơn vị; getDanhHieuName
 *  đổi mã danh hiệu sang tên tiếng Việt. Toàn bộ bọc try/catch trả 0 khi lỗi vì
 *  thông báo là tác vụ phụ, không được chặn thao tác thêm khen thưởng.
 * ════════════════════════════════════════════════════════════════════════════
 */

import {
  NOTIFICATION_TYPES,
  RESOURCE_TYPES,
  ROLES,
  emitNotificationToUser,
  getDanhHieuName,
  getDisplayName,
} from './helpers';
import { PROPOSAL_TYPES } from '../../constants/proposalTypes.constants';
import { getAwardLabelByProposalType } from '../../constants/awardResource.constants';
import { accountRepository } from '../../repositories/account.repository';
import { notificationRepository } from '../../repositories/notification.repository';
import { coQuanDonViRepository, donViTrucThuocRepository } from '../../repositories/unit.repository';

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

export async function notifyOnBulkAwardAdded(
  personnelIds: string[],
  unitIds: string[],
  awardType: string,
  nam: number | string,
  titleData: TitleDataItem[],
  adminUsername: string
): Promise<number> {
  try {
    const notifications: NotificationInput[] = [];
    const adminDisplayName = await getDisplayName(adminUsername);

    const awardTypeName = getAwardLabelByProposalType(awardType);

    if (personnelIds && personnelIds.length > 0) {
      const accounts = await accountRepository.findManyRaw({
        where: {
          quan_nhan_id: {
            in: personnelIds,
          },
        },
        include: {
          QuanNhan: {
            select: {
              id: true,
              ho_ten: true,
              co_quan_don_vi_id: true,
              don_vi_truc_thuoc_id: true,
            },
          },
        },
      });

      // Collect all unit IDs to fetch managers in one batch query.
      const allDonViIds = new Set<string>();
      for (const account of accounts) {
        const personnel = account.QuanNhan;
        if (!personnel) continue;
        const donViId = personnel.co_quan_don_vi_id || personnel.don_vi_truc_thuoc_id;
        if (donViId) allDonViIds.add(donViId);
      }

      const allManagers =
        allDonViIds.size > 0
          ? await accountRepository.findManyRaw({
              where: {
                role: ROLES.MANAGER,
                QuanNhan: {
                  OR: [
                    { co_quan_don_vi_id: { in: [...allDonViIds] } },
                    { don_vi_truc_thuoc_id: { in: [...allDonViIds] } },
                  ],
                },
              },
              select: {
                id: true,
                role: true,
                QuanNhan: {
                  select: {
                    co_quan_don_vi_id: true,
                    don_vi_truc_thuoc_id: true,
                  },
                },
              },
            })
          : [];

      // Build map: donViId -> manager accounts that manage that unit.
      const managersByDonVi = new Map<string, typeof allManagers>();
      for (const manager of allManagers) {
        const ids = [
          manager.QuanNhan?.co_quan_don_vi_id,
          manager.QuanNhan?.don_vi_truc_thuoc_id,
        ].filter((id): id is string => Boolean(id));
        for (const id of ids) {
          if (!managersByDonVi.has(id)) managersByDonVi.set(id, []);
          managersByDonVi.get(id)!.push(manager);
        }
      }

      for (const account of accounts) {
        const personnel = account.QuanNhan;
        if (!personnel) continue;

        // Lọc các dòng titleData thuộc riêng quân nhân này rồi dựng tên hiển
        // thị của từng danh hiệu. Tên field nguồn khác nhau theo loại đề xuất:
        // NCKH lấy `loai`, các loại còn lại lấy `danh_hieu`; HC_QKQT/KNC tên
        // danh hiệu suy trực tiếp từ loại đề xuất.
        const userAwards: string[] = [];
        const userTitleData = titleData.filter(
          (item: TitleDataItem) => item.personnel_id === personnel.id
        );

        userTitleData.forEach((item: TitleDataItem) => {
          if (awardType === PROPOSAL_TYPES.CA_NHAN_HANG_NAM && item.danh_hieu) {
            userAwards.push(`${getDanhHieuName(item.danh_hieu)}${nam ? ` (năm ${nam})` : ''}`);
          } else if (awardType === PROPOSAL_TYPES.NCKH && item.loai) {
            userAwards.push(`${getDanhHieuName(item.loai)}${nam ? ` (năm ${nam})` : ''}`);
          } else if (awardType === PROPOSAL_TYPES.NIEN_HAN && item.danh_hieu) {
            userAwards.push(`${getDanhHieuName(item.danh_hieu)}${nam ? ` (năm ${nam})` : ''}`);
          } else if (awardType === PROPOSAL_TYPES.CONG_HIEN && item.danh_hieu) {
            userAwards.push(`${getDanhHieuName(item.danh_hieu)}${nam ? ` (năm ${nam})` : ''}`);
          } else if (awardType === PROPOSAL_TYPES.HC_QKQT) {
            userAwards.push(
              `${getDanhHieuName(PROPOSAL_TYPES.HC_QKQT)}${nam ? ` (năm ${nam})` : ''}`
            );
          } else if (awardType === PROPOSAL_TYPES.KNC_VSNXD_QDNDVN) {
            userAwards.push(
              `${getDanhHieuName(PROPOSAL_TYPES.KNC_VSNXD_QDNDVN)}${nam ? ` (năm ${nam})` : ''}`
            );
          }
        });

        let message = '';
        if (userAwards.length > 0) {
          message = `${adminDisplayName} đã thêm khen thưởng cho bạn: ${userAwards.join(', ')}.`;
        } else {
          message = `${adminDisplayName} đã thêm ${awardTypeName}${
            nam ? ` năm ${nam}` : ''
          } cho bạn.`;
        }

        notifications.push({
          nguoi_nhan_id: account.id,
          recipient_role: account.role,
          type: NOTIFICATION_TYPES.AWARD_ADDED,
          title: 'Bạn đã nhận khen thưởng',
          message: message,
          resource: RESOURCE_TYPES.AWARDS,
          tai_nguyen_id: personnel.id,
          link:
            account.role === ROLES.MANAGER
              ? `/manager/personnel/${personnel.id}`
              : `/user/dashboard`,
        });

        // Báo MANAGER của đơn vị (CQDV ưu tiên, DVTT dự phòng) qua Map đã dựng
        // sẵn. Dedupe: nếu MANAGER này đã có thông báo (do quản nhiều quân nhân
        // trong cùng lô) thì không thêm nữa.
        const donViId = personnel.co_quan_don_vi_id || personnel.don_vi_truc_thuoc_id;
        if (donViId) {
          const managers = managersByDonVi.get(donViId) ?? [];
          managers.forEach(manager => {
            const existingNotif = notifications.find(
              (n: NotificationInput) =>
                n.nguoi_nhan_id === manager.id && n.recipient_role === ROLES.MANAGER
            );
            if (!existingNotif) {
              notifications.push({
                nguoi_nhan_id: manager.id,
                recipient_role: manager.role,
                type: NOTIFICATION_TYPES.AWARD_ADDED,
                title: 'Khen thưởng mới đã được thêm',
                message: `${adminDisplayName} đã thêm ${awardTypeName}${
                  nam ? ` năm ${nam}` : ''
                } cho quân nhân trong đơn vị của bạn`,
                resource: RESOURCE_TYPES.AWARDS,
                tai_nguyen_id: donViId,
                link: `/manager/awards?nam=${nam}`,
              });
            }
          });
        }
      }
    }

    // Nhánh khen thưởng ĐƠN VỊ: chỉ áp dụng cho danh hiệu đơn vị hằng năm.
    if (unitIds && unitIds.length > 0 && awardType === PROPOSAL_TYPES.DON_VI_HANG_NAM) {
      for (const unitId of unitIds) {
        // unitId có thể là DVTT hoặc CQDV — tra song song cả hai bảng rồi lấy
        // bản tìm được (DVTT ưu tiên vì đó là đơn vị cụ thể hơn).
        const [donViTrucThuoc, coQuanDonVi] = await Promise.all([
          donViTrucThuocRepository.findUniqueRaw({
            where: { id: unitId },
            select: { id: true, ten_don_vi: true, co_quan_don_vi_id: true },
          }),
          coQuanDonViRepository.findUniqueRaw({
            where: { id: unitId },
            select: { id: true, ten_don_vi: true },
          }),
        ]);
        const donVi = donViTrucThuoc ?? coQuanDonVi;

        if (!donVi) continue;
        // Suy ra id CQDV để tìm MANAGER: nếu là DVTT lấy co_quan_don_vi_id cha;
        // nếu bản thân đã là CQDV thì dùng chính id của nó.
        const coQuanDonViId =
          'co_quan_don_vi_id' in donVi ? (donVi.co_quan_don_vi_id ?? donVi.id) : donVi.id;

        const managers = await accountRepository.findManyRaw({
          where: {
            role: ROLES.MANAGER,
            QuanNhan: {
              OR: [
                { co_quan_don_vi_id: coQuanDonViId },
                { don_vi_truc_thuoc_id: donVi.id },
              ].filter(Boolean),
            },
          },
          select: {
            id: true,
            role: true,
          },
        });

        // Tìm tên danh hiệu cụ thể của đơn vị này; nếu không có thì message bên
        // dưới fallback về nhãn loại khen thưởng chung (awardTypeName).
        const unitTitleData = titleData.find((item: TitleDataItem) => item.don_vi_id === unitId);
        const danhHieu = unitTitleData?.danh_hieu ? getDanhHieuName(unitTitleData.danh_hieu) : '';

        managers.forEach(manager => {
          notifications.push({
            nguoi_nhan_id: manager.id,
            recipient_role: manager.role,
            type: NOTIFICATION_TYPES.AWARD_ADDED,
            title: 'Đơn vị của bạn đã nhận khen thưởng',
            message: `${adminDisplayName} đã thêm ${danhHieu || awardTypeName}${
              nam ? ` năm ${nam}` : ''
            } cho đơn vị ${donVi.ten_don_vi}`,
            resource: RESOURCE_TYPES.AWARDS,
            tai_nguyen_id: unitId,
            link: `/manager/awards?don_vi_id=${unitId}&nam=${nam}`,
          });
        });
      }
    }

    if (notifications.length > 0) {
      await notificationRepository.createMany(notifications);
      notifications.forEach(n => emitNotificationToUser(n.nguoi_nhan_id, n));
    }

    return notifications.length;
  } catch (error) {
    console.error('NotificationAwards.notifyOnBulkAwardAdded failed', { error });
    return 0;
  }
}
