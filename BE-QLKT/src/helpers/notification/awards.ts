import {
  prisma,
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
import { isFeatureEnabled } from '../settingsHelper';

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

async function notifyManagersOnAwardAdded(
  donViId: string,
  donViName: string,
  year: number | string,
  awardType: string,
  adminUsername: string
): Promise<number> {
  const managers = await prisma.taiKhoan.findMany({
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

  await prisma.thongBao.createMany({
    data: notifications,
  });
  notifications.forEach(n => emitNotificationToUser(n.nguoi_nhan_id, n));

  return notifications.length;
}

async function notifyUserOnAchievementApproved(
  achievement: AchievementInfo,
  approverUsername: string
): Promise<{ nguoi_nhan_id: string | null } | null> {
  const account = await prisma.taiKhoan.findFirst({
    where: {
      quan_nhan_id: achievement.quan_nhan_id,
    },
    select: {
      id: true,
      role: true,
    },
  });

  if (!account) {
    return null;
  }

  const approverDisplayName = await getDisplayName(approverUsername);

  const loaiMap: Record<string, string> = {
    DTKH: 'Đề tài khoa học',
    SKKH: 'Sáng kiến khoa học',
    NCKH: 'Nghiên cứu khoa học',
  };
  const loaiName = loaiMap[achievement.loai] || achievement.loai || 'Thành tích khoa học';

  const notification = await prisma.thongBao.create({
    data: {
      nguoi_nhan_id: account.id,
      recipient_role: account.role,
      type: NOTIFICATION_TYPES.ACHIEVEMENT_APPROVED,
      title: 'Thành tích khoa học đã được phê duyệt',
      message: `${loaiName} năm ${achievement.nam || 'không xác định'} của bạn đã được ${approverDisplayName} phê duyệt`,
      resource: RESOURCE_TYPES.ACHIEVEMENTS,
      tai_nguyen_id: achievement.id,
      link: `/user/profile`,
    },
  });

  if (notification.nguoi_nhan_id) {
    emitNotificationToUser(notification.nguoi_nhan_id, notification);
  }
  return notification;
}

async function notifyOnAwardDeleted(
  award: AwardInfo,
  personnel: PersonnelInfo,
  awardType: string,
  adminUsername: string
): Promise<number> {
  try {
    const notifications: NotificationInput[] = [];
    const adminDisplayName = await getDisplayName(adminUsername);

    const awardTypeNameMap: Record<string, string> = {
      HCCSVV: 'Huy chương Chiến sĩ vẻ vang',
      HCBVTQ: 'Huân chương Bảo vệ Tổ quốc',
      KNC_VSNXD_QDNDVN: DANH_HIEU_MAP.KNC_VSNXD_QDNDVN,
      HCQKQT: 'Huy chương Quân kỳ quyết thắng',
      CA_NHAN_HANG_NAM: 'Danh hiệu hằng năm',
      NCKH: 'Thành tích khoa học',
    };
    const awardTypeName = awardTypeNameMap[awardType] || awardType;

    const rawDanhHieu = award.danh_hieu || award.loai || '';
    const danhHieu = getDanhHieuName(rawDanhHieu);
    const nam = award.nam || '';

    const donViId = personnel.co_quan_don_vi_id || personnel.don_vi_truc_thuoc_id;
    if (donViId) {
      const managers = await prisma.taiKhoan.findMany({
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
          message: `${adminDisplayName} đã xóa ${awardTypeName}${danhHieu ? ` (${danhHieu})` : ''}${
            nam ? ` năm ${nam}` : ''
          } của quân nhân ${personnel.ho_ten || 'Chưa xác định'}`,
          resource: RESOURCE_TYPES.AWARDS,
          tai_nguyen_id: personnel.id,
          link: `/manager/personnel/${personnel.id}`,
        });
      });
    }

    const personnelAccount = await prisma.taiKhoan.findFirst({
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
        message: `${awardTypeName}${danhHieu ? ` (${danhHieu})` : ''}${
          nam ? ` năm ${nam}` : ''
        } của bạn đã bị ${adminDisplayName} xóa khỏi hệ thống`,
        resource: RESOURCE_TYPES.AWARDS,
        tai_nguyen_id: personnel.id,
        link: `/user/profile`,
      });
    }

    if (notifications.length > 0) {
      await prisma.thongBao.createMany({
        data: notifications,
      });
      notifications.forEach(n => emitNotificationToUser(n.nguoi_nhan_id, n));
    }

    return notifications.length;
  } catch (error) {
    console.error('NotificationAwards.notifyOnAwardDeleted failed', { error });
    return 0;
  }
}

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

    const accounts = await prisma.taiKhoan.findMany({
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

    const toArray = (v: unknown): Record<string, unknown>[] => (Array.isArray(v) ? v : []);
    const danhHieuData = toArray(proposal.data_danh_hieu);
    const thanhTichData = toArray(proposal.data_thanh_tich);
    const nienHanData = toArray(proposal.data_nien_han);
    const congHienData = toArray(proposal.data_cong_hien);

    for (const account of accounts) {
      const userAwards: string[] = [];

      const userDanhHieu = danhHieuData.filter(
        (item: Record<string, unknown>) => item.personnel_id === account.quan_nhan_id
      );
      userDanhHieu.forEach((item: Record<string, unknown>) => {
        const dh = item.danh_hieu as string | undefined;
        if (dh && DANH_HIEU_MAP[dh]) {
          userAwards.push(`${DANH_HIEU_MAP[dh]}${item.nam ? ` (năm ${item.nam})` : ''}`);
        }
        if (item.nhan_bkbqp) {
          userAwards.push(`${DANH_HIEU_MAP.BKBQP}${item.nam ? ` (năm ${item.nam})` : ''}`);
        }
        if (item.nhan_cstdtq) {
          userAwards.push(`${DANH_HIEU_MAP.CSTDTQ}${item.nam ? ` (năm ${item.nam})` : ''}`);
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

      const userThanhTich = thanhTichData.filter(
        (item: Record<string, unknown>) => item.personnel_id === account.quan_nhan_id
      );
      userThanhTich.forEach((item: Record<string, unknown>) => {
        const loai = item.loai as string | undefined;
        if (loai && DANH_HIEU_MAP[loai]) {
          userAwards.push(`${DANH_HIEU_MAP[loai]}${item.nam ? ` (năm ${item.nam})` : ''}`);
        }
      });

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
        link: `/user/dashboard`,
      });
    }

    if (notifications.length > 0) {
      await prisma.thongBao.createMany({
        data: notifications,
      });
      notifications.forEach(n => emitNotificationToUser(n.nguoi_nhan_id, n));
    }

    return notifications.length;
  } catch (error) {
    console.error('NotificationAwards.notifyUsersOnAwardApproved failed', { error });
    return 0;
  }
}

async function notifyOnBulkAwardAdded(
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

    const bulkAwardTypeMap: Record<string, string> = {
      CA_NHAN_HANG_NAM: 'Danh hiệu hằng năm',
      DON_VI_HANG_NAM: 'Danh hiệu đơn vị hằng năm',
      NCKH: 'Thành tích khoa học',
      NIEN_HAN: 'Huy chương Chiến sĩ vẻ vang',
      HC_QKQT: 'Huy chương Quân kỳ quyết thắng',
      KNC_VSNXD_QDNDVN: DANH_HIEU_MAP.KNC_VSNXD_QDNDVN,
      CONG_HIEN: 'Huân chương Bảo vệ Tổ quốc',
    };
    const awardTypeName = bulkAwardTypeMap[awardType] || awardType;

    if (personnelIds && personnelIds.length > 0) {
      const accounts = await prisma.taiKhoan.findMany({
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
          ? await prisma.taiKhoan.findMany({
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
          link: `/user/dashboard`,
        });

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

    if (unitIds && unitIds.length > 0 && awardType === PROPOSAL_TYPES.DON_VI_HANG_NAM) {
      for (const unitId of unitIds) {
        let donVi: { id: string; ten_don_vi: string; co_quan_don_vi_id?: string | null } | null =
          await prisma.donViTrucThuoc.findUnique({
            where: { id: unitId },
            select: { id: true, ten_don_vi: true, co_quan_don_vi_id: true },
          });

        if (!donVi) {
          donVi = await prisma.coQuanDonVi.findUnique({
            where: { id: unitId },
            select: { id: true, ten_don_vi: true },
          });
        }

        if (!donVi) continue;

        const managers = await prisma.taiKhoan.findMany({
          where: {
            role: ROLES.MANAGER,
            QuanNhan: {
              OR: [
                { co_quan_don_vi_id: donVi.co_quan_don_vi_id || donVi.id },
                { don_vi_truc_thuoc_id: donVi.id },
              ].filter(Boolean),
            },
          },
          select: {
            id: true,
            role: true,
          },
        });

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
      await prisma.thongBao.createMany({
        data: notifications,
      });
      notifications.forEach(n => emitNotificationToUser(n.nguoi_nhan_id, n));
    }

    return notifications.length;
  } catch (error) {
    console.error('NotificationAwards.notifyOnBulkAwardAdded failed', { error });
    return 0;
  }
}

const RESOURCE_TO_PROPOSAL_TYPE: Record<string, string> = {
  'annual-rewards': PROPOSAL_TYPES.CA_NHAN_HANG_NAM,
  'unit-annual-awards': PROPOSAL_TYPES.DON_VI_HANG_NAM,
  'tenure-medals': PROPOSAL_TYPES.NIEN_HAN,
  'commemorative-medals': PROPOSAL_TYPES.KNC_VSNXD_QDNDVN,
  'contribution-medals': PROPOSAL_TYPES.CONG_HIEN,
  'military-flag': PROPOSAL_TYPES.HC_QKQT,
  'scientific-achievements': PROPOSAL_TYPES.NCKH,
};

/**
 * Notifies unit managers after award imports when the feature flag is enabled.
 * @param adminId - Admin account ID that triggered import
 * @param awardResource - Resource key (e.g. 'annual-rewards', 'hccsvv')
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
    const enabled = await isFeatureEnabled('allow_notify_import');
    if (!enabled) return 0;

    const admin = await prisma.taiKhoan.findUnique({
      where: { id: adminId },
      select: { username: true },
    });
    if (!admin) return 0;

    const adminDisplayName = await getDisplayName(admin.username);
    const proposalType = RESOURCE_TO_PROPOSAL_TYPE[awardResource];
    const awardLabel = proposalType ? LOAI_DE_XUAT_MAP[proposalType] : awardResource;

    // Collect affected unit IDs
    const affectedUnitIds = new Set<string>();

    if (personnelIds.length > 0) {
      const personnel = await prisma.quanNhan.findMany({
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

    // Find managers of affected units
    const managers = await prisma.taiKhoan.findMany({
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

    // Notify managers
    if (managers.length > 0) {
      const uniqueManagers = [...new Map(managers.map(m => [m.id, m])).values()];
      for (const manager of uniqueManagers) {
        notifications.push({
          nguoi_nhan_id: manager.id,
          recipient_role: manager.role,
          type: NOTIFICATION_TYPES.AWARD_ADDED,
          title: 'Khen thưởng mới được import',
          message: `${adminDisplayName} đã import ${importedCount} bản ghi ${awardLabel} cho đơn vị của bạn`,
          resource: RESOURCE_TYPES.AWARDS,
          tai_nguyen_id: null,
          link: `/manager/awards`,
        });
      }
    }

    // Notify personnel accounts for individual awards only.
    if (personnelIds.length > 0) {
      const personnelAccounts = await prisma.taiKhoan.findMany({
        where: { quan_nhan_id: { in: personnelIds } },
        select: { id: true, role: true },
      });

      for (const account of personnelAccounts) {
        notifications.push({
          nguoi_nhan_id: account.id,
          recipient_role: account.role,
          type: NOTIFICATION_TYPES.AWARD_ADDED,
          title: 'Bạn đã nhận khen thưởng',
          message: `${adminDisplayName} đã thêm ${awardLabel} cho bạn qua import dữ liệu`,
          resource: RESOURCE_TYPES.AWARDS,
          tai_nguyen_id: null,
          link: `/user/profile`,
        });
      }
    }

    if (notifications.length === 0) return 0;

    await prisma.thongBao.createMany({ data: notifications });
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
  notifyOnBulkAwardAdded,
  notifyOnImport,
};
