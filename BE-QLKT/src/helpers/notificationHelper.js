const { prisma } = require('../models');
const { NOTIFICATION_TYPES, RESOURCE_TYPES } = require('../constants/notificationTypes');
const { ROLES } = require('../constants/roles');
const { emitNotificationToUser } = require('../utils/socketService');
const {
  DANH_HIEU_MAP,
  LOAI_DE_XUAT_MAP,
  getDanhHieuName,
} = require('../constants/danhHieu.constants');

// Helper function to format proposal type to Vietnamese
const formatProposalType = loaiDeXuat => {
  const prefix = 'Đề xuất khen thưởng ';
  const typeName = LOAI_DE_XUAT_MAP[loaiDeXuat];
  return typeName ? prefix + typeName.toLowerCase() : 'Đề xuất khen thưởng';
};

/**
 * Helper function để lấy tên hiển thị (ưu tiên ho_ten, nếu không có thì dùng username)
 * @param {string} username - Username của người dùng
 * @returns {Promise<string>} - Tên hiển thị (ho_ten hoặc username)
 */
async function getDisplayName(username) {
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
    console.error('Error getting display name:', error);
    return username;
  }
}

class NotificationHelper {
  /**
   * Gửi thông báo khi Manager gửi đề xuất khen thưởng
   * -> Tất cả ADMIN nhận thông báo
   */
  async notifyAdminsOnProposalSubmission(proposal, submitter) {
    try {
      // Lấy tất cả tài khoản ADMIN
      const admins = await prisma.taiKhoan.findMany({
        where: {
          role: 'ADMIN',
        },
        select: {
          id: true,
          role: true,
        },
      });

      const submitterDisplayName = await getDisplayName(submitter.username);

      // Tạo thông báo cho từng admin
      const proposalTypeName = formatProposalType(proposal.loai_de_xuat);
      const notifications = admins.map(admin => ({
        nguoi_nhan_id: admin.id,
        recipient_role: admin.role,
        type: NOTIFICATION_TYPES.PROPOSAL_SUBMITTED,
        title: 'Đề xuất khen thưởng mới',
        message: `${submitterDisplayName} đã gửi ${proposalTypeName.toLowerCase()}`,
        resource: RESOURCE_TYPES.PROPOSALS,
        tai_nguyen_id: proposal.id,
        link: `/admin/proposals/review/${proposal.id}`,
      }));

      if (notifications.length > 0) {
        await prisma.thongBao.createMany({
          data: notifications,
        });
        notifications.forEach(n => emitNotificationToUser(n.nguoi_nhan_id, n));
      }

      return notifications.length;
    } catch (error) {
      console.error('Error sending proposal submission notifications:', error);
      throw error;
    }
  }

  /**
   * Gửi thông báo khi Admin phê duyệt đề xuất
   * -> Chỉ người gửi đề xuất nhận thông báo
   */
  async notifyManagerOnProposalApproval(proposal, approver) {
    try {
      const proposalTypeName = formatProposalType(proposal.loai_de_xuat);
      const approverDisplayName = await getDisplayName(approver.username);
      const notification = await prisma.thongBao.create({
        data: {
          nguoi_nhan_id: proposal.nguoi_de_xuat_id,
          recipient_role: 'MANAGER',
          type: NOTIFICATION_TYPES.PROPOSAL_APPROVED,
          title: 'Đề xuất đã được phê duyệt',
          message: `${proposalTypeName} của bạn đã được ${approverDisplayName} phê duyệt`,
          resource: RESOURCE_TYPES.PROPOSALS,
          tai_nguyen_id: proposal.id,
          link: `/manager/proposals/${proposal.id}`,
        },
      });

      emitNotificationToUser(notification.nguoi_nhan_id, notification);
      return notification;
    } catch (error) {
      console.error('Error sending proposal approval notification:', error);
      throw error;
    }
  }

  /**
   * Gửi thông báo khi Admin từ chối đề xuất
   * -> Chỉ người gửi đề xuất nhận thông báo
   */
  async notifyManagerOnProposalRejection(proposal, rejector, reason) {
    try {
      const proposalTypeName = formatProposalType(proposal.loai_de_xuat);
      const rejectorDisplayName = await getDisplayName(rejector.username);
      const notification = await prisma.thongBao.create({
        data: {
          nguoi_nhan_id: proposal.nguoi_de_xuat_id,
          recipient_role: 'MANAGER',
          type: NOTIFICATION_TYPES.PROPOSAL_REJECTED,
          title: 'Đề xuất bị từ chối',
          message: `${proposalTypeName} của bạn đã bị ${rejectorDisplayName} từ chối. Lý do: ${reason || 'Không có lý do cụ thể'}`,
          resource: RESOURCE_TYPES.PROPOSALS,
          tai_nguyen_id: proposal.id,
          link: `/manager/proposals/${proposal.id}`,
        },
      });

      emitNotificationToUser(notification.nguoi_nhan_id, notification);
      return notification;
    } catch (error) {
      console.error('Error sending proposal rejection notification:', error);
      throw error;
    }
  }

  /**
   * Gửi thông báo khi Admin thêm khen thưởng thành công
   * -> Tất cả MANAGER của đơn vị đó nhận thông báo
   */
  async notifyManagersOnAwardAdded(donViId, donViName, year, awardType, adminUsername) {
    try {
      // Lấy tất cả MANAGER của đơn vị
      const managers = await prisma.taiKhoan.findMany({
        where: {
          role: 'MANAGER',
          QuanNhan: {
            don_vi_id: donViId,
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

      // Tạo thông báo cho từng manager
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
    } catch (error) {
      console.error('Error sending award added notifications:', error);
      throw error;
    }
  }

  /**
   * Gửi thông báo khi có quân nhân mới được thêm vào
   * -> MANAGER của đơn vị nhận thông báo
   */
  async notifyManagerOnPersonnelAdded(personnel, adminUsername) {
    try {
      // Lấy tất cả MANAGER của đơn vị
      const managers = await prisma.taiKhoan.findMany({
        where: {
          role: 'MANAGER',
          QuanNhan: {
            don_vi_id: personnel.don_vi_id,
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

      // Tạo thông báo cho từng manager
      const notifications = managers.map(manager => ({
        nguoi_nhan_id: manager.id,
        recipient_role: manager.role,
        type: NOTIFICATION_TYPES.PERSONNEL_ADDED,
        title: 'Quân nhân mới được thêm',
        message: `${adminDisplayName} đã thêm quân nhân mới: ${personnel.ho_ten} (CCCD: ${personnel.cccd})`,
        resource: RESOURCE_TYPES.PERSONNEL,
        tai_nguyen_id: personnel.id,
        link: `/manager/personnel/${personnel.id}`,
      }));

      await prisma.thongBao.createMany({
        data: notifications,
      });
        notifications.forEach(n => emitNotificationToUser(n.nguoi_nhan_id, n));

      return notifications.length;
    } catch (error) {
      console.error('Error sending personnel added notifications:', error);
      throw error;
    }
  }

  /**
   * Gửi thông báo khi thành tích khoa học được phê duyệt
   * -> Quân nhân sở hữu thành tích nhận thông báo (nếu có tài khoản)
   */
  async notifyUserOnAchievementApproved(achievement, approverUsername) {
    try {
      // Lấy thông tin tài khoản của quân nhân
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
        return null; // Quân nhân chưa có tài khoản
      }

      const approverDisplayName = await getDisplayName(approverUsername);

      // Map loại thành tích sang tiếng Việt
      const loaiMap = {
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

      emitNotificationToUser(notification.nguoi_nhan_id, notification);
      return notification;
    } catch (error) {
      console.error('Error sending achievement approval notification:', error);
      throw error;
    }
  }

  /**
   * Gửi thông báo khi Admin xóa khen thưởng
   * -> Manager của đơn vị và quân nhân (nếu có tài khoản) nhận thông báo
   * @param {Object} award - Thông tin khen thưởng bị xóa
   * @param {Object} personnel - Thông tin quân nhân
   * @param {string} awardType - Loại khen thưởng (HCCSVV, HCBVTQ, KNC_VSNXD, HCQKQT, CA_NHAN_HANG_NAM, NCKH)
   * @param {string} adminUsername - Username của admin thực hiện xóa
   */
  async notifyOnAwardDeleted(award, personnel, awardType, adminUsername) {
    try {
      const notifications = [];
      const adminDisplayName = await getDisplayName(adminUsername);

      // Map loại khen thưởng sang tên tiếng Việt
      const awardTypeNameMap = {
        HCCSVV: 'Huy chương Chiến sĩ vẻ vang',
        HCBVTQ: 'Huân chương Bảo vệ Tổ quốc',
        KNC_VSNXD: 'Kỷ niệm chương VSNXD QĐNDVN',
        HCQKQT: 'Huy chương Quân kỳ Quyết thắng',
        CA_NHAN_HANG_NAM: 'Danh hiệu hằng năm',
        NCKH: 'Thành tích khoa học',
      };
      const awardTypeName = awardTypeNameMap[awardType] || awardType;

      // Lấy danh hiệu cụ thể và map sang tên tiếng Việt
      const rawDanhHieu = award.danh_hieu || award.loai || '';
      const danhHieu = getDanhHieuName(rawDanhHieu);
      const nam = award.nam || '';

      // 1. Thông báo cho Manager của đơn vị quân nhân
      const donViId = personnel.co_quan_don_vi_id || personnel.don_vi_truc_thuoc_id;
      if (donViId) {
        const managers = await prisma.taiKhoan.findMany({
          where: {
            role: 'MANAGER',
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

      // 2. Thông báo cho quân nhân (nếu có tài khoản)
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

      // Tạo thông báo
      if (notifications.length > 0) {
        await prisma.thongBao.createMany({
          data: notifications,
        });
        notifications.forEach(n => emitNotificationToUser(n.nguoi_nhan_id, n));
      }

      return notifications.length;
    } catch (error) {
      console.error('Error sending award deleted notifications:', error);
      // Không throw error để không ảnh hưởng đến việc xóa khen thưởng
      return 0;
    }
  }

  /**
   * Gửi thông báo cho user nhận khen thưởng khi đề xuất được duyệt
   * -> Quân nhân nhận khen thưởng (nếu có tài khoản) nhận thông báo
   * @param {Array} personnelIds - Danh sách ID quân nhân nhận khen thưởng
   * @param {Object} proposal - Thông tin đề xuất
   * @param {string} approverUsername - Username của admin duyệt
   */
  async notifyUsersOnAwardApproved(personnelIds, proposal, approverUsername) {
    try {
      if (!personnelIds || personnelIds.length === 0) {
        return 0;
      }

      const notifications = [];
      const approverDisplayName = await getDisplayName(approverUsername);

      // Lấy thông tin tài khoản của các quân nhân
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

      // Lấy dữ liệu khen thưởng từ proposal
      const danhHieuData = proposal.data_danh_hieu || [];
      const thanhTichData = proposal.data_thanh_tich || [];
      const nienHanData = proposal.data_nien_han || [];
      const congHienData = proposal.data_cong_hien || [];

      // Tạo thông báo cho từng user
      for (const account of accounts) {
        // Tìm các khen thưởng của quân nhân này
        const userAwards = [];

        // Danh hiệu hằng năm
        const userDanhHieu = danhHieuData.filter(
          item => item.personnel_id === account.quan_nhan_id
        );
        userDanhHieu.forEach(item => {
          if (item.danh_hieu && DANH_HIEU_MAP[item.danh_hieu]) {
            userAwards.push(
              `${DANH_HIEU_MAP[item.danh_hieu]}${item.nam ? ` (năm ${item.nam})` : ''}`
            );
          }
          if (item.nhan_bkbqp) {
            userAwards.push(`${DANH_HIEU_MAP['BKBQP']}${item.nam ? ` (năm ${item.nam})` : ''}`);
          }
          if (item.nhan_cstdtq) {
            userAwards.push(`${DANH_HIEU_MAP['CSTDTQ']}${item.nam ? ` (năm ${item.nam})` : ''}`);
          }
        });

        // Niên hạn
        const userNienHan = nienHanData.filter(item => item.personnel_id === account.quan_nhan_id);
        userNienHan.forEach(item => {
          if (item.danh_hieu && DANH_HIEU_MAP[item.danh_hieu]) {
            userAwards.push(
              `${DANH_HIEU_MAP[item.danh_hieu]}${item.nam ? ` (năm ${item.nam})` : ''}`
            );
          }
        });

        // Cống hiến
        const userCongHien = congHienData.filter(
          item => item.personnel_id === account.quan_nhan_id
        );
        userCongHien.forEach(item => {
          if (item.danh_hieu && DANH_HIEU_MAP[item.danh_hieu]) {
            userAwards.push(
              `${DANH_HIEU_MAP[item.danh_hieu]}${item.nam ? ` (năm ${item.nam})` : ''}`
            );
          }
        });

        // Thành tích khoa học
        const userThanhTich = thanhTichData.filter(
          item => item.personnel_id === account.quan_nhan_id
        );
        userThanhTich.forEach(item => {
          if (item.loai && DANH_HIEU_MAP[item.loai]) {
            userAwards.push(`${DANH_HIEU_MAP[item.loai]}${item.nam ? ` (năm ${item.nam})` : ''}`);
          }
        });

        // Tạo message
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

      // Tạo thông báo
      if (notifications.length > 0) {
        await prisma.thongBao.createMany({
          data: notifications,
        });
        notifications.forEach(n => emitNotificationToUser(n.nguoi_nhan_id, n));
      }

      return notifications.length;
    } catch (error) {
      console.error('Error sending award approval notifications to users:', error);
      // Không throw error để không ảnh hưởng đến quá trình approve
      return 0;
    }
  }

  /**
   * Gửi thông báo khi Admin thêm khen thưởng đồng loạt
   * -> Quân nhân nhận khen thưởng (nếu có tài khoản) và Manager của đơn vị nhận thông báo
   * @param {Array} personnelIds - Danh sách ID quân nhân nhận khen thưởng
   * @param {Array} unitIds - Danh sách ID đơn vị nhận khen thưởng (optional)
   * @param {string} awardType - Loại khen thưởng (CA_NHAN_HANG_NAM, DON_VI_HANG_NAM, NCKH, etc.)
   * @param {number} nam - Năm khen thưởng
   * @param {Array} titleData - Dữ liệu khen thưởng chi tiết
   * @param {string} adminUsername - Username của admin thêm khen thưởng
   */
  async notifyOnBulkAwardAdded(personnelIds, unitIds, awardType, nam, titleData, adminUsername) {
    try {
      const notifications = [];
      const adminDisplayName = await getDisplayName(adminUsername);

      // Map loại khen thưởng sang tên tiếng Việt
      const bulkAwardTypeMap = {
        CA_NHAN_HANG_NAM: 'Danh hiệu hằng năm',
        DON_VI_HANG_NAM: 'Danh hiệu đơn vị hằng năm',
        NCKH: 'Thành tích khoa học',
        NIEN_HAN: 'Huy chương Chiến sĩ vẻ vang',
        HC_QKQT: 'Huy chương Quân kỳ Quyết thắng',
        KNC_VSNXD_QDNDVN: 'Kỷ niệm chương VSNXD QĐNDVN',
        CONG_HIEN: 'Huân chương Bảo vệ Tổ quốc',
      };
      const awardTypeName = bulkAwardTypeMap[awardType] || awardType;

      // 1. Thông báo cho quân nhân nhận khen thưởng (nếu có tài khoản)
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

        for (const account of accounts) {
          const personnel = account.QuanNhan;
          if (!personnel) continue;

          // Tìm các khen thưởng của quân nhân này
          const userAwards = [];
          const userTitleData = titleData.filter(item => item.personnel_id === personnel.id);

          userTitleData.forEach(item => {
            if (awardType === 'CA_NHAN_HANG_NAM' && item.danh_hieu) {
              userAwards.push(`${getDanhHieuName(item.danh_hieu)}${nam ? ` (năm ${nam})` : ''}`);
            } else if (awardType === 'NCKH' && item.loai) {
              userAwards.push(`${getDanhHieuName(item.loai)}${nam ? ` (năm ${nam})` : ''}`);
            } else if (awardType === 'NIEN_HAN' && item.danh_hieu) {
              userAwards.push(`${getDanhHieuName(item.danh_hieu)}${nam ? ` (năm ${nam})` : ''}`);
            } else if (awardType === 'CONG_HIEN' && item.danh_hieu) {
              userAwards.push(`${getDanhHieuName(item.danh_hieu)}${nam ? ` (năm ${nam})` : ''}`);
            } else if (awardType === 'HC_QKQT') {
              userAwards.push(`${getDanhHieuName('HC_QKQT')}${nam ? ` (năm ${nam})` : ''}`);
            } else if (awardType === 'KNC_VSNXD_QDNDVN') {
              userAwards.push(
                `${getDanhHieuName('KNC_VSNXD_QDNDVN')}${nam ? ` (năm ${nam})` : ''}`
              );
            }
          });

          // Tạo message
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

          // 2. Thông báo cho Manager của đơn vị quân nhân
          const donViId = personnel.co_quan_don_vi_id || personnel.don_vi_truc_thuoc_id;
          if (donViId) {
            const managers = await prisma.taiKhoan.findMany({
              where: {
                role: 'MANAGER',
                QuanNhan: {
                  OR: [{ co_quan_don_vi_id: donViId }, { don_vi_truc_thuoc_id: donViId }].filter(
                    Boolean
                  ),
                },
              },
              select: {
                id: true,
                role: true,
              },
            });

            managers.forEach(manager => {
              // Kiểm tra xem đã có thông báo cho manager này chưa (tránh duplicate)
              const existingNotif = notifications.find(
                n => n.nguoi_nhan_id === manager.id && n.recipient_role === ROLES.MANAGER
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

      // 3. Thông báo cho Manager của đơn vị nhận khen thưởng (cho DON_VI_HANG_NAM)
      if (unitIds && unitIds.length > 0 && awardType === 'DON_VI_HANG_NAM') {
        for (const unitId of unitIds) {
          // Lấy thông tin đơn vị
          let donVi = await prisma.donViTrucThuoc.findUnique({
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

          // Lấy Manager của đơn vị
          const managers = await prisma.taiKhoan.findMany({
            where: {
              role: 'MANAGER',
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

          // Lấy danh hiệu của đơn vị
          const unitTitleData = titleData.find(item => item.don_vi_id === unitId);
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

      // Tạo thông báo
      if (notifications.length > 0) {
        await prisma.thongBao.createMany({
          data: notifications,
        });
        notifications.forEach(n => emitNotificationToUser(n.nguoi_nhan_id, n));
      }

      return notifications.length;
    } catch (error) {
      console.error('Error sending bulk award added notifications:', error);
      // Không throw error để không ảnh hưởng đến quá trình thêm khen thưởng
      return 0;
    }
  }

  /**
   * Gửi thông báo khi quân nhân chuyển đơn vị
   * -> Manager đơn vị mới nhận thông báo "Quân nhân [Tên] đã được chuyển đến đơn vị của bạn"
   * -> Manager đơn vị cũ nhận thông báo "Quân nhân [Tên] đã chuyển đi khỏi đơn vị"
   * -> Quân nhân (nếu có tài khoản) nhận thông báo "Bạn đã được chuyển sang đơn vị [Tên đơn vị]"
   * @param {Object} personnel - Thông tin quân nhân
   * @param {Object} oldUnit - Thông tin đơn vị cũ { id, ten_don_vi, isCoQuanDonVi }
   * @param {Object} newUnit - Thông tin đơn vị mới { id, ten_don_vi, isCoQuanDonVi }
   * @param {string} adminUsername - Username của admin thực hiện chuyển đơn vị
   */
  async notifyOnPersonnelTransfer(personnel, oldUnit, newUnit, adminUsername) {
    try {
      const notifications = [];
      const adminDisplayName = await getDisplayName(adminUsername);

      // Helper function để lấy co_quan_don_vi_id từ unit info
      const getCoQuanDonViId = async unitInfo => {
        if (!unitInfo || !unitInfo.id) return null;

        if (unitInfo.isCoQuanDonVi) {
          return unitInfo.id;
        }

        // Nếu là đơn vị trực thuộc, lấy co_quan_don_vi_id từ đơn vị cha
        const donViTrucThuoc = await prisma.donViTrucThuoc.findUnique({
          where: { id: unitInfo.id },
          select: { co_quan_don_vi_id: true },
        });
        return donViTrucThuoc?.co_quan_don_vi_id || null;
      };

      // Lấy co_quan_don_vi_id của cả 2 đơn vị
      const oldCoQuanDonViId = await getCoQuanDonViId(oldUnit);
      const newCoQuanDonViId = await getCoQuanDonViId(newUnit);

      // Kiểm tra xem có phải chuyển trong cùng cơ quan đơn vị không
      const isSameCoQuanDonVi =
        oldCoQuanDonViId && newCoQuanDonViId && oldCoQuanDonViId === newCoQuanDonViId;

      if (isSameCoQuanDonVi) {
        // Trường hợp: Chuyển giữa các đơn vị trực thuộc trong cùng cơ quan đơn vị
        // Chỉ gửi thông báo cho Manager của cơ quan đơn vị cha
        const managers = await prisma.taiKhoan.findMany({
          where: {
            role: 'MANAGER',
            QuanNhan: {
              co_quan_don_vi_id: oldCoQuanDonViId,
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
            type: NOTIFICATION_TYPES.PERSONNEL_TRANSFERRED,
            title: 'Quân nhân chuyển đơn vị trực thuộc',
            message: `${adminDisplayName} đã chuyển quân nhân ${personnel.ho_ten || 'Chưa xác định'} từ ${oldUnit?.ten_don_vi || 'đơn vị cũ'} sang ${newUnit?.ten_don_vi || 'đơn vị mới'}`,
            resource: RESOURCE_TYPES.PERSONNEL,
            tai_nguyen_id: personnel.id,
            link: `/manager/personnel/${personnel.id}`,
          });
        });
      } else {
        // Trường hợp: Chuyển giữa các cơ quan đơn vị khác nhau

        // 1. Thông báo cho Manager đơn vị MỚI
        if (newCoQuanDonViId) {
          const newUnitManagers = await prisma.taiKhoan.findMany({
            where: {
              role: 'MANAGER',
              QuanNhan: {
                co_quan_don_vi_id: newCoQuanDonViId,
              },
            },
            select: {
              id: true,
              role: true,
            },
          });

          newUnitManagers.forEach(manager => {
            notifications.push({
              nguoi_nhan_id: manager.id,
              recipient_role: manager.role,
              type: NOTIFICATION_TYPES.PERSONNEL_TRANSFERRED,
              title: 'Quân nhân mới chuyển đến',
              message: `${adminDisplayName} đã chuyển quân nhân ${personnel.ho_ten || 'Chưa xác định'} đến đơn vị của bạn${newUnit && !newUnit.isCoQuanDonVi ? ` (${newUnit.ten_don_vi})` : ''}`,
              resource: RESOURCE_TYPES.PERSONNEL,
              tai_nguyen_id: personnel.id,
              link: `/manager/personnel/${personnel.id}`,
            });
          });
        }

        // 2. Thông báo cho Manager đơn vị CŨ
        if (oldCoQuanDonViId) {
          const oldUnitManagers = await prisma.taiKhoan.findMany({
            where: {
              role: 'MANAGER',
              QuanNhan: {
                co_quan_don_vi_id: oldCoQuanDonViId,
              },
            },
            select: {
              id: true,
              role: true,
            },
          });

          oldUnitManagers.forEach(manager => {
            // Tránh trùng lặp nếu manager thuộc cả 2 đơn vị (trường hợp hiếm)
            const alreadyNotified = notifications.some(n => n.nguoi_nhan_id === manager.id);
            if (!alreadyNotified) {
              notifications.push({
                nguoi_nhan_id: manager.id,
                recipient_role: manager.role,
                type: NOTIFICATION_TYPES.PERSONNEL_TRANSFERRED,
                title: 'Quân nhân đã chuyển đi',
                message: `Quân nhân ${personnel.ho_ten || 'Chưa xác định'} đã được ${adminDisplayName} chuyển sang đơn vị khác`,
                resource: RESOURCE_TYPES.PERSONNEL,
                tai_nguyen_id: personnel.id,
                link: null, // Không có link vì quân nhân đã rời đơn vị
              });
            }
          });
        }
      }

      // 3. Thông báo cho chính quân nhân (nếu có tài khoản)
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
          type: NOTIFICATION_TYPES.PERSONNEL_TRANSFERRED,
          title: 'Bạn đã được chuyển đơn vị',
          message: `${adminDisplayName} đã chuyển bạn từ đơn vị ${oldUnit?.ten_don_vi || 'cũ'} sang đơn vị ${newUnit?.ten_don_vi || 'mới'}`,
          resource: RESOURCE_TYPES.PERSONNEL,
          tai_nguyen_id: personnel.id,
          link: personnelAccount.role === ROLES.MANAGER ? '/manager/dashboard' : '/user/dashboard',
        });
      }

      // Tạo thông báo
      if (notifications.length > 0) {
        await prisma.thongBao.createMany({
          data: notifications,
        });
        notifications.forEach(n => emitNotificationToUser(n.nguoi_nhan_id, n));
      }

      return notifications.length;
    } catch (error) {
      console.error('Error sending personnel transfer notifications:', error);
      // Không throw error để không ảnh hưởng đến quá trình chuyển đơn vị
      return 0;
    }
  }

  /**
   * Gửi thông báo hệ thống chung
   */
  async sendSystemNotification(
    recipients,
    type,
    title,
    message,
    resource = null,
    resourceId = null,
    link = null
  ) {
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
      console.error('Error sending system notifications:', error);
      throw error;
    }
  }
}

module.exports = new NotificationHelper();
