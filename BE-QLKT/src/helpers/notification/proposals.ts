import {
  prisma,
  NOTIFICATION_TYPES,
  RESOURCE_TYPES,
  ROLES,
  emitNotificationToUser,
  formatProposalType,
  getDisplayName,
} from './helpers';

interface ProposalNotifyInfo {
  id: string;
  loai_de_xuat: string;
  nguoi_de_xuat_id?: string;
  [key: string]: unknown;
}

async function notifyAdminsOnProposalSubmission(
  proposal: ProposalNotifyInfo,
  submitter: { username: string }
): Promise<number> {
  try {
    const admins = await prisma.taiKhoan.findMany({
      where: {
        role: ROLES.ADMIN,
      },
      select: {
        id: true,
        role: true,
      },
    });

    const submitterDisplayName = await getDisplayName(submitter.username);

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

async function notifyManagerOnProposalApproval(
  proposal: ProposalNotifyInfo,
  approver: { username: string }
): Promise<{ nguoi_nhan_id: string | null } | null> {
  try {
    if (!proposal.nguoi_de_xuat_id) return null;
    const proposalTypeName = formatProposalType(proposal.loai_de_xuat);
    const approverDisplayName = await getDisplayName(approver.username);
    const notification = await prisma.thongBao.create({
      data: {
        nguoi_nhan_id: proposal.nguoi_de_xuat_id,
        recipient_role: ROLES.MANAGER,
        type: NOTIFICATION_TYPES.PROPOSAL_APPROVED,
        title: 'Đề xuất đã được phê duyệt',
        message: `${proposalTypeName} của bạn đã được ${approverDisplayName} phê duyệt`,
        resource: RESOURCE_TYPES.PROPOSALS,
        tai_nguyen_id: proposal.id,
        link: `/manager/proposals/${proposal.id}`,
      },
    });

    if (notification.nguoi_nhan_id) {
      emitNotificationToUser(notification.nguoi_nhan_id, notification);
    }
    return notification;
  } catch (error) {
    throw error;
  }
}

async function notifyManagerOnProposalRejection(
  proposal: ProposalNotifyInfo,
  rejector: { username: string },
  reason: string
): Promise<{ nguoi_nhan_id: string | null } | null> {
  try {
    if (!proposal.nguoi_de_xuat_id) return null;
    const proposalTypeName = formatProposalType(proposal.loai_de_xuat);
    const rejectorDisplayName = await getDisplayName(rejector.username);
    const notification = await prisma.thongBao.create({
      data: {
        nguoi_nhan_id: proposal.nguoi_de_xuat_id,
        recipient_role: ROLES.MANAGER,
        type: NOTIFICATION_TYPES.PROPOSAL_REJECTED,
        title: 'Đề xuất bị từ chối',
        message: `${proposalTypeName} của bạn đã bị ${rejectorDisplayName} từ chối. Lý do: ${reason || 'Không có lý do cụ thể'}`,
        resource: RESOURCE_TYPES.PROPOSALS,
        tai_nguyen_id: proposal.id,
        link: `/manager/proposals/${proposal.id}`,
      },
    });

    if (notification.nguoi_nhan_id) {
      emitNotificationToUser(notification.nguoi_nhan_id, notification);
    }
    return notification;
  } catch (error) {
    throw error;
  }
}

export {
  notifyAdminsOnProposalSubmission,
  notifyManagerOnProposalApproval,
  notifyManagerOnProposalRejection,
};
