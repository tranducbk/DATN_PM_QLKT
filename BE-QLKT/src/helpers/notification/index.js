const { getDisplayName, sendSystemNotification } = require('./helpers');
const {
  notifyAdminsOnProposalSubmission,
  notifyManagerOnProposalApproval,
  notifyManagerOnProposalRejection,
} = require('./proposals');
const {
  notifyManagersOnAwardAdded,
  notifyUserOnAchievementApproved,
  notifyOnAwardDeleted,
  notifyUsersOnAwardApproved,
  notifyOnBulkAwardAdded,
} = require('./awards');
const { notifyManagerOnPersonnelAdded, notifyOnPersonnelTransfer } = require('./personnel');

module.exports = {
  getDisplayName,
  sendSystemNotification,
  notifyAdminsOnProposalSubmission,
  notifyManagerOnProposalApproval,
  notifyManagerOnProposalRejection,
  notifyManagersOnAwardAdded,
  notifyUserOnAchievementApproved,
  notifyOnAwardDeleted,
  notifyUsersOnAwardApproved,
  notifyOnBulkAwardAdded,
  notifyManagerOnPersonnelAdded,
  notifyOnPersonnelTransfer,
};
