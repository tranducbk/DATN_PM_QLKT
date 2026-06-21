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

// Spread every domain module so new endpoints need no manual registration here.
export const apiClient = {
  ...authApi,
  ...accountsApi,
  ...personnelApi,
  ...awardsApi,
  ...proposalsApi,
  ...unitsApi,
  ...notificationsApi,
  ...dashboardApi,
  ...profilesApi,
  ...decisionsApi,
  ...systemLogsApi,
};

export default apiClient;
