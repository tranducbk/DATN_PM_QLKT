/*
 * ════════════════════════════════════════════════════════════════════════════
 *  NOTIFICATION BUILDERS — barrel export theo domain
 * ════════════════════════════════════════════════════════════════════════════
 *
 *  TÁCH FILE THEO DOMAIN (proposals/awards/personnel):
 *  Mỗi file = 1 nhóm event nghiệp vụ. Lợi ích:
 *  - Mỗi function build 1 noti với title/message/link/recipient cụ thể.
 *  - Test dễ (1 file 1 test suite).
 *  - Khi đổi message → tìm đúng file domain, không scan toàn bộ.
 *
 *  NAMING CONVENTION:
 *      notify<Recipient>On<Event>...
 *      vd: notifyAdminsOnProposalSubmission — gửi cho admin khi
 *          Manager submit đề xuất.
 *          notifyManagerOnProposalApproval — gửi cho Manager khi Admin
 *          duyệt đề xuất của Manager.
 *          notifyUsersOnAwardApproved      — gửi cho quân nhân khi được
 *          khen thưởng.
 *
 *  FAN-OUT to MULTIPLE recipients:
 *  - notifyAdminsOnProposalSubmission: query tất cả ADMIN active → loop.
 *  - notifyUsersOnAwardApproved: 1 đề xuất có N quân nhân → N noti.
 *  → Dùng createBulkNotifications (1 query createMany thay vì N).
 *
 *  ALL FUNCTIONS LÀ FIRE-AND-FORGET:
 *  Caller (service) gọi qua `safeNotify(ctx, () => notifyX(...))` →
 *  catch error + log, không throw. Lý do: noti là phụ trợ, fail không
 *  được rollback business operation.
 * ════════════════════════════════════════════════════════════════════════════
 */

import { getDisplayName, sendSystemNotification } from './helpers';
import {
  notifyAdminsOnProposalSubmission,
  notifyManagerOnProposalApproval,
  notifyManagerOnProposalRejection,
  notifyOnProposalDeletion,
} from './proposals';
import {
  notifyManagersOnAwardAdded,
  notifyUserOnAchievementApproved,
  notifyOnAwardDeleted,
  notifyUsersOnAwardApproved,
  notifyOnBulkAwardAdded,
  notifyAdminsOnBulkBypass,
  notifyOnImport,
} from './awards';
import { notifyManagerOnPersonnelAdded, notifyOnPersonnelTransfer } from './personnel';

export {
  getDisplayName,
  sendSystemNotification,
  notifyAdminsOnProposalSubmission,
  notifyManagerOnProposalApproval,
  notifyManagerOnProposalRejection,
  notifyOnProposalDeletion,
  notifyManagersOnAwardAdded,
  notifyUserOnAchievementApproved,
  notifyOnAwardDeleted,
  notifyUsersOnAwardApproved,
  notifyOnBulkAwardAdded,
  notifyAdminsOnBulkBypass,
  notifyOnImport,
  notifyManagerOnPersonnelAdded,
  notifyOnPersonnelTransfer,
};
