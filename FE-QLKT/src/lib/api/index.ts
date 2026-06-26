/*
 * ════════════════════════════════════════════════════════════════════════════
 *  apiClient — FACADE cho tất cả API call (BARREL EXPORT)
 * ════════════════════════════════════════════════════════════════════════════
 *
 *  KIẾN TRÚC:
 *  Mỗi domain có 1 file API module (auth.ts, accounts.ts, ...). File này
 *  gộp tất cả thành 1 object `apiClient` để component dễ dùng:
 *
 *      import { apiClient } from '@/lib/api';
 *      const res = await apiClient.getPersonnel({ page: 1 });
 *
 *  WHY 1 apiClient OBJECT:
 *  - 1 import path duy nhất → ít boilerplate.
 *  - IDE autocomplete: apiClient. → liệt kê toàn bộ method.
 *  - Test/mock dễ: jest.mock('@/lib/api').
 *
 *  ALL METHOD DÙNG axiosInstance:
 *  → Auto attach Bearer token, auto refresh khi 401, auto handle 429.
 *  → Trả về { success, data, message, pagination? } chuẩn.
 *
 *  RULE (CLAUDE.md AP-FE-1):
 *  Component TUYỆT ĐỐI không fetch/axios trực tiếp — phải qua apiClient.
 *
 *  KHI THÊM ENDPOINT MỚI:
 *  1. Thêm function vào file domain (vd: lib/api/awards.ts).
 *  2. Re-export ở barrel này.
 *  3. Component dùng `apiClient.newFunction()` được ngay.
 * ════════════════════════════════════════════════════════════════════════════
 */

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
