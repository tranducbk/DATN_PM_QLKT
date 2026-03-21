const {
  prisma,
  NOTIFICATION_TYPES,
  RESOURCE_TYPES,
  emitNotificationToUser,
  formatProposalType,
  getDisplayName,
} = require('./helpers');

/**
 * Gửi thông báo khi Manager gửi đề xuất khen thưởng
 * -> Tất cả ADMIN nhận thông báo
 */
async function notifyAdminsOnProposalSubmission(proposal, submitter) {
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
    throw error;
  }
}

/**
 * Gửi thông báo khi Admin phê duyệt đề xuất
 * -> Chỉ người gửi đề xuất nhận thông báo
 */
async function notifyManagerOnProposalApproval(proposal, approver) {
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
    throw error;
  }
}

/**
 * Gửi thông báo khi Admin từ chối đề xuất
 * -> Chỉ người gửi đề xuất nhận thông báo
 */
async function notifyManagerOnProposalRejection(proposal, rejector, reason) {
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
    throw error;
  }
}

module.exports = {
  notifyAdminsOnProposalSubmission,
  notifyManagerOnProposalApproval,
  notifyManagerOnProposalRejection,
};
