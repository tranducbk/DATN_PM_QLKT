// Domain-specific API modules
import * as authApi from './auth';
import * as accountsApi from './accounts';
import * as personnelApi from './personnel';
import * as awardsApi from './awards';
import * as proposalsApi from './proposals';
import * as unitsApi from './units';
import * as notificationsApi from './notifications';
import * as dashboardApi from './dashboard';
import * as profilesApi from './profiles';
import * as decisionsApi from './decisions';
import * as systemLogsApi from './systemLogs';

// Re-export individual modules for direct import
export {
  authApi,
  accountsApi,
  personnelApi,
  awardsApi,
  proposalsApi,
  unitsApi,
  notificationsApi,
  dashboardApi,
  profilesApi,
  decisionsApi,
  systemLogsApi,
};

// Unified apiClient object for backward compatibility
export const apiClient = {
  // Auth
  login: authApi.login,
  changePassword: authApi.changePassword,

  // Accounts
  getAccounts: accountsApi.getAccounts,
  getAccountById: accountsApi.getAccountById,
  updateAccount: accountsApi.updateAccount,
  createAccount: accountsApi.createAccount,
  deleteAccount: accountsApi.deleteAccount,
  resetAccountPassword: accountsApi.resetAccountPassword,

  // Personnel
  getPersonnel: personnelApi.getPersonnel,
  getPersonnelById: personnelApi.getPersonnelById,
  createPersonnel: personnelApi.createPersonnel,
  updatePersonnel: personnelApi.updatePersonnel,
  deletePersonnel: personnelApi.deletePersonnel,
  getPositionHistory: personnelApi.getPositionHistory,
  createPositionHistory: personnelApi.createPositionHistory,
  updatePositionHistory: personnelApi.updatePositionHistory,
  deletePositionHistory: personnelApi.deletePositionHistory,
  // Units & Positions
  getUnits: unitsApi.getUnits,
  getMyUnits: unitsApi.getMyUnits,
  getUnitById: unitsApi.getUnitById,
  createUnit: unitsApi.createUnit,
  updateUnit: unitsApi.updateUnit,
  deleteUnit: unitsApi.deleteUnit,
  getSubUnits: unitsApi.getSubUnits,
  getPositions: unitsApi.getPositions,
  createPosition: unitsApi.createPosition,
  updatePosition: unitsApi.updatePosition,
  deletePosition: unitsApi.deletePosition,

  // Awards
  getAnnualRewards: awardsApi.getAnnualRewards,
  getAnnualRewardsByPersonnel: awardsApi.getAnnualRewardsByPersonnel,
  getAnnualRewardsTemplate: awardsApi.getAnnualRewardsTemplate,
  importAnnualRewards: awardsApi.importAnnualRewards,
  exportAnnualRewards: awardsApi.exportAnnualRewards,
  deleteAnnualReward: awardsApi.deleteAnnualReward,
  checkAnnualRewards: awardsApi.checkAnnualRewards,
  bulkCreateAnnualRewards: awardsApi.bulkCreateAnnualRewards,
  getPersonnelScientificAchievements: awardsApi.getPersonnelScientificAchievements,
  getScientificAchievements: awardsApi.getScientificAchievements,
  deleteScientificAchievement: awardsApi.deleteScientificAchievement,
  exportScientificAchievements: awardsApi.exportScientificAchievements,
  getScientificAchievementsTemplate: awardsApi.getScientificAchievementsTemplate,
  importScientificAchievements: awardsApi.importScientificAchievements,
  exportAwards: awardsApi.exportAwards,
  getTenureMedalsTemplate: awardsApi.getTenureMedalsTemplate,
  importTenureMedals: awardsApi.importTenureMedals,
  getTenureMedals: awardsApi.getTenureMedals,
  exportTenureMedals: awardsApi.exportTenureMedals,
  deleteTenureMedal: awardsApi.deleteTenureMedal,
  getContributionMedalsTemplate: awardsApi.getContributionMedalsTemplate,
  importContributionMedals: awardsApi.importContributionMedals,
  getContributionMedals: awardsApi.getContributionMedals,
  exportContributionMedals: awardsApi.exportContributionMedals,
  deleteContributionMedal: awardsApi.deleteContributionMedal,
  getCommemorationMedalsTemplate: awardsApi.getCommemorationMedalsTemplate,
  importCommemorationMedals: awardsApi.importCommemorationMedals,
  getCommemorationMedals: awardsApi.getCommemorationMedals,
  exportCommemorationMedals: awardsApi.exportCommemorationMedals,
  deleteCommemorationMedal: awardsApi.deleteCommemorationMedal,
  getMilitaryFlagTemplate: awardsApi.getMilitaryFlagTemplate,
  getMilitaryFlag: awardsApi.getMilitaryFlag,
  exportMilitaryFlag: awardsApi.exportMilitaryFlag,
  deleteMilitaryFlag: awardsApi.deleteMilitaryFlag,
  getMilitaryFlagByPersonnel: awardsApi.getMilitaryFlagByPersonnel,
  getCommemorationMedalsByPersonnel: awardsApi.getCommemorationMedalsByPersonnel,
  getUnitAnnualAwards: awardsApi.getUnitAnnualAwards,
  getUnitAnnualAwardsTemplate: awardsApi.getUnitAnnualAwardsTemplate,
  exportUnitAnnualAwards: awardsApi.exportUnitAnnualAwards,
  deleteUnitAnnualAward: awardsApi.deleteUnitAnnualAward,
  getUnitAnnualProfile: awardsApi.getUnitAnnualProfile,
  getAdhocAwards: awardsApi.getAdhocAwards,
  createAdhocAward: awardsApi.createAdhocAward,
  updateAdhocAward: awardsApi.updateAdhocAward,
  deleteAdhocAward: awardsApi.deleteAdhocAward,
  getAdhocAwardsByPersonnel: awardsApi.getAdhocAwardsByPersonnel,
  bulkCreateAwards: awardsApi.bulkCreateAwards,
  bulkCreateAwardsBypass: awardsApi.bulkCreateAwardsBypass,
  previewAnnualRewardsImport: awardsApi.previewAnnualRewardsImport,
  confirmAnnualRewardsImport: awardsApi.confirmAnnualRewardsImport,
  previewUnitAnnualAwardsImport: awardsApi.previewUnitAnnualAwardsImport,
  confirmUnitAnnualAwardsImport: awardsApi.confirmUnitAnnualAwardsImport,
  previewTenureMedalsImport: awardsApi.previewTenureMedalsImport,
  confirmTenureMedalsImport: awardsApi.confirmTenureMedalsImport,
  previewMilitaryFlagImport: awardsApi.previewMilitaryFlagImport,
  confirmMilitaryFlagImport: awardsApi.confirmMilitaryFlagImport,
  previewContributionMedalsImport: awardsApi.previewContributionMedalsImport,
  confirmContributionMedalsImport: awardsApi.confirmContributionMedalsImport,
  previewCommemorationMedalsImport: awardsApi.previewCommemorationMedalsImport,
  confirmCommemorationMedalsImport: awardsApi.confirmCommemorationMedalsImport,
  previewScientificAchievementsImport: awardsApi.previewScientificAchievementsImport,
  confirmScientificAchievementsImport: awardsApi.confirmScientificAchievementsImport,

  // Awards (checks)
  checkHCQKQT: awardsApi.checkHCQKQT,
  checkKNCVSNXDQDNDVN: awardsApi.checkKNCVSNXDQDNDVN,
  checkContributionEligibility: awardsApi.checkContributionEligibility,

  // Proposals
  submitProposal: proposalsApi.submitProposal,
  getProposals: proposalsApi.getProposals,
  getProposalById: proposalsApi.getProposalById,
  approveProposal: proposalsApi.approveProposal,
  rejectProposal: proposalsApi.rejectProposal,
  deleteProposal: proposalsApi.deleteProposal,
  uploadDecision: proposalsApi.uploadDecision,
  checkDuplicate: proposalsApi.checkDuplicate,
  checkDuplicateUnit: proposalsApi.checkDuplicateUnit,
  checkDuplicateBatch: proposalsApi.checkDuplicateBatch,
  checkDuplicateUnitBatch: proposalsApi.checkDuplicateUnitBatch,

  // Notifications
  getNotifications: notificationsApi.getNotifications,
  getUnreadNotificationCount: notificationsApi.getUnreadNotificationCount,
  markNotificationAsRead: notificationsApi.markNotificationAsRead,
  markAllNotificationsAsRead: notificationsApi.markAllNotificationsAsRead,
  deleteAllNotifications: notificationsApi.deleteAllNotifications,

  // Profiles
  getAnnualProfile: profilesApi.getAnnualProfile,
  getTenureProfile: profilesApi.getTenureProfile,
  getContributionProfile: profilesApi.getContributionProfile,

  // Dashboard
  getDashboardStatistics: dashboardApi.getDashboardStatistics,
  getAdminDashboardStatistics: dashboardApi.getAdminDashboardStatistics,
  getManagerDashboardStatistics: dashboardApi.getManagerDashboardStatistics,

  // Decisions
  getDecisions: decisionsApi.getDecisions,
  autocompleteDecisions: decisionsApi.autocompleteDecisions,
  getDecisionBySoQuyetDinh: decisionsApi.getDecisionBySoQuyetDinh,
  createDecision: decisionsApi.createDecision,
  updateDecision: decisionsApi.updateDecision,
  deleteDecision: decisionsApi.deleteDecision,
  getDecisionFilePath: decisionsApi.getDecisionFilePath,

  // System Logs
  getSystemLogs: systemLogsApi.getSystemLogs,
  getSystemLogActions: systemLogsApi.getSystemLogActions,
  deleteSystemLogs: systemLogsApi.deleteSystemLogs,
};

export default apiClient;
