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
  exportPersonnel: personnelApi.exportPersonnel,
  exportPersonnelSample: personnelApi.exportPersonnelSample,
  importPersonnel: personnelApi.importPersonnel,

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
  createAnnualReward: awardsApi.createAnnualReward,
  updateAnnualReward: awardsApi.updateAnnualReward,
  deleteAnnualReward: awardsApi.deleteAnnualReward,
  checkAnnualRewards: awardsApi.checkAnnualRewards,
  bulkCreateAnnualRewards: awardsApi.bulkCreateAnnualRewards,
  getPersonnelScientificAchievements: awardsApi.getPersonnelScientificAchievements,
  getScientificAchievements: awardsApi.getScientificAchievements,
  createScientificAchievement: awardsApi.createScientificAchievement,
  updateScientificAchievement: awardsApi.updateScientificAchievement,
  deleteScientificAchievement: awardsApi.deleteScientificAchievement,
  exportScientificAchievements: awardsApi.exportScientificAchievements,
  getScientificAchievementsTemplate: awardsApi.getScientificAchievementsTemplate,
  importScientificAchievements: awardsApi.importScientificAchievements,
  getAwards: awardsApi.getAwards,
  getAwardsTemplate: awardsApi.getAwardsTemplate,
  importAwards: awardsApi.importAwards,
  exportAwards: awardsApi.exportAwards,
  getHCCSVVTemplate: awardsApi.getHCCSVVTemplate,
  importHCCSVV: awardsApi.importHCCSVV,
  getHCCSVV: awardsApi.getHCCSVV,
  exportHCCSVV: awardsApi.exportHCCSVV,
  getHCCSVVStatistics: awardsApi.getHCCSVVStatistics,
  deleteHCCSVV: awardsApi.deleteHCCSVV,
  createHCCSVVDirect: awardsApi.createHCCSVVDirect,
  getContributionAwardsTemplate: awardsApi.getContributionAwardsTemplate,
  importContributionAwards: awardsApi.importContributionAwards,
  getContributionAwards: awardsApi.getContributionAwards,
  exportContributionAwards: awardsApi.exportContributionAwards,
  getContributionAwardsStatistics: awardsApi.getContributionAwardsStatistics,
  deleteContributionAward: awardsApi.deleteContributionAward,
  getCommemorationMedalsTemplate: awardsApi.getCommemorationMedalsTemplate,
  importCommemorationMedals: awardsApi.importCommemorationMedals,
  getCommemorationMedals: awardsApi.getCommemorationMedals,
  exportCommemorationMedals: awardsApi.exportCommemorationMedals,
  getCommemorationMedalsStatistics: awardsApi.getCommemorationMedalsStatistics,
  deleteCommemorationMedal: awardsApi.deleteCommemorationMedal,
  getMilitaryFlagTemplate: awardsApi.getMilitaryFlagTemplate,
  importMilitaryFlag: awardsApi.importMilitaryFlag,
  getMilitaryFlag: awardsApi.getMilitaryFlag,
  exportMilitaryFlag: awardsApi.exportMilitaryFlag,
  getMilitaryFlagStatistics: awardsApi.getMilitaryFlagStatistics,
  deleteMilitaryFlag: awardsApi.deleteMilitaryFlag,
  getMilitaryFlagByPersonnel: awardsApi.getMilitaryFlagByPersonnel,
  getCommemorationMedalsByPersonnel: awardsApi.getCommemorationMedalsByPersonnel,
  getUnitAnnualAwards: awardsApi.getUnitAnnualAwards,
  getUnitAnnualAwardsByUnit: awardsApi.getUnitAnnualAwardsByUnit,
  getUnitAnnualAwardsTemplate: awardsApi.getUnitAnnualAwardsTemplate,
  importUnitAnnualAwards: awardsApi.importUnitAnnualAwards,
  exportUnitAnnualAwards: awardsApi.exportUnitAnnualAwards,
  deleteUnitAnnualAward: awardsApi.deleteUnitAnnualAward,
  getUnitAnnualProfile: awardsApi.getUnitAnnualProfile,
  getAdhocAwards: awardsApi.getAdhocAwards,
  getAdhocAwardById: awardsApi.getAdhocAwardById,
  createAdhocAward: awardsApi.createAdhocAward,
  updateAdhocAward: awardsApi.updateAdhocAward,
  deleteAdhocAward: awardsApi.deleteAdhocAward,
  getAdhocAwardsByPersonnel: awardsApi.getAdhocAwardsByPersonnel,
  getAdhocAwardsByUnit: awardsApi.getAdhocAwardsByUnit,
  bulkCreateAwards: awardsApi.bulkCreateAwards,
  previewAnnualRewardsImport: awardsApi.previewAnnualRewardsImport,
  confirmAnnualRewardsImport: awardsApi.confirmAnnualRewardsImport,
  previewUnitAnnualAwardsImport: awardsApi.previewUnitAnnualAwardsImport,
  confirmUnitAnnualAwardsImport: awardsApi.confirmUnitAnnualAwardsImport,
  previewHCCSVVImport: awardsApi.previewHCCSVVImport,
  confirmHCCSVVImport: awardsApi.confirmHCCSVVImport,
  previewMilitaryFlagImport: awardsApi.previewMilitaryFlagImport,
  confirmMilitaryFlagImport: awardsApi.confirmMilitaryFlagImport,
  previewContributionAwardsImport: awardsApi.previewContributionAwardsImport,
  confirmContributionAwardsImport: awardsApi.confirmContributionAwardsImport,
  previewCommemorationMedalsImport: awardsApi.previewCommemorationMedalsImport,
  confirmCommemorationMedalsImport: awardsApi.confirmCommemorationMedalsImport,
  previewScientificAchievementsImport: awardsApi.previewScientificAchievementsImport,
  confirmScientificAchievementsImport: awardsApi.confirmScientificAchievementsImport,

  // Awards (checks)
  checkHCQKQT: awardsApi.checkHCQKQT,
  checkKNCVSNXDQDNDVN: awardsApi.checkKNCVSNXDQDNDVN,
  checkContributionEligibility: awardsApi.checkContributionEligibility,

  // Proposals
  getProposalTemplate: proposalsApi.getProposalTemplate,
  submitProposal: proposalsApi.submitProposal,
  getProposals: proposalsApi.getProposals,
  getProposalById: proposalsApi.getProposalById,
  approveProposal: proposalsApi.approveProposal,
  rejectProposal: proposalsApi.rejectProposal,
  downloadProposalExcel: proposalsApi.downloadProposalExcel,
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
  deleteNotification: notificationsApi.deleteNotification,
  deleteAllNotifications: notificationsApi.deleteAllNotifications,

  // Profiles
  getAnnualProfile: profilesApi.getAnnualProfile,
  getTenureProfile: profilesApi.getTenureProfile,
  getContributionProfile: profilesApi.getContributionProfile,
  getServiceProfile: profilesApi.getServiceProfile,
  recalculateProfile: profilesApi.recalculateProfile,
  recalculateAllProfiles: profilesApi.recalculateAllProfiles,
  getAllServiceProfiles: profilesApi.getAllServiceProfiles,
  updateServiceProfile: profilesApi.updateServiceProfile,

  // Dashboard
  getDashboardStatistics: dashboardApi.getDashboardStatistics,
  getAdminDashboardStatistics: dashboardApi.getAdminDashboardStatistics,
  getManagerDashboardStatistics: dashboardApi.getManagerDashboardStatistics,

  // Decisions
  getDecisions: decisionsApi.getDecisions,
  autocompleteDecisions: decisionsApi.autocompleteDecisions,
  getDecisionBySoQuyetDinh: decisionsApi.getDecisionBySoQuyetDinh,
  getDecisionById: decisionsApi.getDecisionById,
  createDecision: decisionsApi.createDecision,
  updateDecision: decisionsApi.updateDecision,
  deleteDecision: decisionsApi.deleteDecision,
  getDecisionFilePath: decisionsApi.getDecisionFilePath,
  downloadDecisionFile: decisionsApi.downloadDecisionFile,
  getDecisionFilePaths: decisionsApi.getDecisionFilePaths,

  // System Logs
  getSystemLogs: systemLogsApi.getSystemLogs,
  getSystemLogActions: systemLogsApi.getSystemLogActions,
  getSystemLogResources: systemLogsApi.getSystemLogResources,
  deleteSystemLogs: systemLogsApi.deleteSystemLogs,
  deleteAllSystemLogs: systemLogsApi.deleteAllSystemLogs,
};

export default apiClient;
