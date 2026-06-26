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
 *  - notifyAdminsOnProposalSubmission: query tất cả ADMIN active → gửi từng người.
 *  - notifyUsersOnAwardApproved: 1 đề xuất có N quân nhân → N noti.
 *  → Lưu cả lô bằng MỘT query createMany (thay vì N lần create).
 *
 *  ALL FUNCTIONS LÀ FIRE-AND-FORGET:
 *  Caller (service) gọi qua wrapper safeNotify/safeNotifyImport → catch error +
 *  log, không throw. Lý do: noti là phụ trợ, fail không được rollback business
 *  operation.
 * ════════════════════════════════════════════════════════════════════════════
 */

import { getDisplayName } from './helpers';
// Domain ĐỀ XUẤT: Manager gửi, Admin duyệt/từ chối, xoá đề xuất.
import {
  notifyAdminsOnProposalSubmission,
  notifyManagerOnProposalApproval,
  notifyManagerOnProposalRejection,
  notifyOnProposalDeletion,
} from './proposals';
// Domain KHEN THƯỞNG: trao/xoá danh hiệu, thêm hàng loạt, vượt điều kiện, import Excel.
import {
  notifyOnAwardDeleted,
  notifyUsersOnAwardApproved,
  notifyOnBulkAwardAdded,
  notifyOnUnitAwardDeleted,
  notifyAdminsOnBulkBypass,
  notifyOnImport,
  safeNotifyImport,
} from './awards';
// Domain QUÂN NHÂN: chuyển đơn vị, xoá quân nhân, quân nhân tự cập nhật hồ sơ.
import {
  notifyOnPersonnelTransfer,
  notifyOnPersonnelDeleted,
  notifyOnSelfProfileUpdate,
} from './personnel';

export {
  getDisplayName,
  notifyAdminsOnProposalSubmission,
  notifyManagerOnProposalApproval,
  notifyManagerOnProposalRejection,
  notifyOnProposalDeletion,
  notifyOnAwardDeleted,
  notifyUsersOnAwardApproved,
  notifyOnBulkAwardAdded,
  notifyOnUnitAwardDeleted,
  notifyAdminsOnBulkBypass,
  notifyOnImport,
  safeNotifyImport,
  notifyOnPersonnelTransfer,
  notifyOnPersonnelDeleted,
  notifyOnSelfProfileUpdate,
};
