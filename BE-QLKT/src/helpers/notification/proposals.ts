import {
  NOTIFICATION_TYPES,
  RESOURCE_TYPES,
  ROLES,
  emitNotificationToUser,
  formatProposalType,
  getDisplayName,
} from './helpers';
import { accountRepository } from '../../repositories/account.repository';
import { notificationRepository } from '../../repositories/notification.repository';

interface ProposalNotifyInfo {
  id: string;
  loai_de_xuat: string;
  nguoi_de_xuat_id?: string;
  [key: string]: unknown;
}

interface ProposalDeletionNotification {
  nguoi_nhan_id: string;
  recipient_role: string;
  type: string;
  title: string;
  message: string;
  resource: string;
  tai_nguyen_id: string;
  link: string;
  [key: string]: unknown;
}

interface ProposalDeletionActor {
  id: string;
  username: string;
  role: string;
}

async function notifyAdminsOnProposalSubmission(
  proposal: ProposalNotifyInfo,
  submitter: { username: string }
): Promise<number> {
  const admins = await accountRepository.findManyRaw({
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
    await notificationRepository.createMany(notifications);
    notifications.forEach(n => emitNotificationToUser(n.nguoi_nhan_id, n));
  }

  return notifications.length;
}

async function notifyManagerOnProposalApproval(
  proposal: ProposalNotifyInfo,
  approver: { username: string }
): Promise<{ nguoi_nhan_id: string | null } | null> {
  if (!proposal.nguoi_de_xuat_id) return null;
  const proposalTypeName = formatProposalType(proposal.loai_de_xuat);
  const approverDisplayName = await getDisplayName(approver.username);
  const notification = await notificationRepository.create({
    nguoi_nhan_id: proposal.nguoi_de_xuat_id,
    recipient_role: ROLES.MANAGER,
    type: NOTIFICATION_TYPES.PROPOSAL_APPROVED,
    title: 'Đề xuất đã được phê duyệt',
    message: `${proposalTypeName} của bạn đã được ${approverDisplayName} phê duyệt`,
    resource: RESOURCE_TYPES.PROPOSALS,
    tai_nguyen_id: proposal.id,
    link: `/manager/proposals/${proposal.id}`,
  });

  if (notification.nguoi_nhan_id) {
    emitNotificationToUser(notification.nguoi_nhan_id, notification);
  }
  return notification;
}

async function notifyManagerOnProposalRejection(
  proposal: ProposalNotifyInfo,
  rejector: { username: string },
  reason: string
): Promise<{ nguoi_nhan_id: string | null } | null> {
  if (!proposal.nguoi_de_xuat_id) return null;
  const proposalTypeName = formatProposalType(proposal.loai_de_xuat);
  const rejectorDisplayName = await getDisplayName(rejector.username);
  const notification = await notificationRepository.create({
    nguoi_nhan_id: proposal.nguoi_de_xuat_id,
    recipient_role: ROLES.MANAGER,
    type: NOTIFICATION_TYPES.PROPOSAL_REJECTED,
    title: 'Đề xuất bị từ chối',
    message: `${proposalTypeName} của bạn đã bị ${rejectorDisplayName} từ chối. Lý do: ${reason || 'Không có lý do cụ thể'}`,
    resource: RESOURCE_TYPES.PROPOSALS,
    tai_nguyen_id: proposal.id,
    link: `/manager/proposals/${proposal.id}`,
  });

  if (notification.nguoi_nhan_id) {
    emitNotificationToUser(notification.nguoi_nhan_id, notification);
  }
  return notification;
}

async function notifyOnProposalDeletion(
  proposal: ProposalNotifyInfo,
  actor: ProposalDeletionActor
): Promise<number> {
  const proposalTypeName = formatProposalType(proposal.loai_de_xuat);
  const actorDisplayName = await getDisplayName(actor.username);

  const admins = await accountRepository.findManyRaw({
    where: {
      role: ROLES.ADMIN,
      id: { not: actor.id },
    },
    select: { id: true, role: true },
  });

  const notifications: ProposalDeletionNotification[] = admins.map(admin => ({
    nguoi_nhan_id: admin.id,
    recipient_role: admin.role,
    type: NOTIFICATION_TYPES.PROPOSAL_DELETED,
    title: 'Đề xuất khen thưởng đã bị xóa',
    message: `${actorDisplayName} đã xóa ${proposalTypeName.toLowerCase()}`,
    resource: RESOURCE_TYPES.PROPOSALS,
    tai_nguyen_id: proposal.id,
    link: `/admin/proposals`,
  }));

  if (proposal.nguoi_de_xuat_id && proposal.nguoi_de_xuat_id !== actor.id) {
    const proposer = await accountRepository.findUniqueRaw({
      where: { id: proposal.nguoi_de_xuat_id },
      select: { id: true, role: true },
    });
    if (proposer) {
      notifications.push({
        nguoi_nhan_id: proposer.id,
        recipient_role: proposer.role,
        type: NOTIFICATION_TYPES.PROPOSAL_DELETED,
        title: 'Đề xuất của bạn đã bị xóa',
        message: `${proposalTypeName} của bạn đã bị ${actorDisplayName} xóa khỏi hệ thống`,
        resource: RESOURCE_TYPES.PROPOSALS,
        tai_nguyen_id: proposal.id,
        link: `/manager/proposals`,
      });
    }
  }

  if (notifications.length > 0) {
    await notificationRepository.createMany(notifications);
    notifications.forEach(n => emitNotificationToUser(n.nguoi_nhan_id, n));
  }

  return notifications.length;
}

export {
  notifyAdminsOnProposalSubmission,
  notifyManagerOnProposalApproval,
  notifyManagerOnProposalRejection,
  notifyOnProposalDeletion,
};
