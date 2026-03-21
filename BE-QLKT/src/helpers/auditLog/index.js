/**
 * Audit log helper - modular re-export
 * Tổng hợp các module audit log theo domain
 *
 * New imports should use: require('./helpers/auditLog')
 */

const { auth } = require('./auth');
const { accounts } = require('./accounts');
const {
  personnel,
  'position-history': positionHistory,
  'scientific-achievements': scientificAchievements,
} = require('./personnel');
const {
  'annual-rewards': annualRewards,
  'adhoc-awards': adhocAwards,
  awards,
} = require('./awards');
const { units, positions } = require('./units');
const { proposals } = require('./proposals');
const { decisions } = require('./decisions');

// Assembled from all domain modules, matching the original object shape exactly

const createLogDescription = {
  proposals,
  'annual-rewards': annualRewards,
  'position-history': positionHistory,
  accounts,
  personnel,
  units,
  positions,
  decisions,
  'scientific-achievements': scientificAchievements,
  auth,
  'adhoc-awards': adhocAwards,
  awards,
};

/**
 * Get log description helper
 * @param {string} resource - Resource name (proposals, annual-rewards, etc.)
 * @param {string} action - Action name (CREATE, UPDATE, DELETE, etc.)
 * @returns {Function} Function to create description
 */
// Mapping tiếng Việt cho fallback
const ACTION_VI = {
  CREATE: 'Tạo', UPDATE: 'Cập nhật', DELETE: 'Xóa',
  IMPORT: 'Nhập dữ liệu', IMPORT_PREVIEW: 'Tải lên xem trước', EXPORT: 'Xuất', BULK_CREATE: 'Thêm đồng loạt',
  APPROVE: 'Phê duyệt', REJECT: 'Từ chối', RECALCULATE: 'Tính toán lại',
  LOGIN: 'Đăng nhập', LOGOUT: 'Đăng xuất',
  RESET_PASSWORD: 'Đặt lại mật khẩu', CHANGE_PASSWORD: 'Đổi mật khẩu',
};
const RESOURCE_VI = {
  accounts: 'tài khoản', personnel: 'quân nhân', units: 'đơn vị', positions: 'chức vụ',
  proposals: 'đề xuất', decisions: 'quyết định', profiles: 'hồ sơ',
  'annual-rewards': 'danh hiệu hằng năm', 'unit-annual-awards': 'khen thưởng đơn vị hằng năm',
  'position-history': 'lịch sử chức vụ', 'scientific-achievements': 'thành tích khoa học',
  'adhoc-awards': 'khen thưởng đột xuất', 'commemorative-medals': 'kỷ niệm chương',
  'contribution-awards': 'huân chương bảo vệ tổ quốc', 'military-flag': 'huân chương quân kỳ quyết thắng',
  hccsvv: 'huy chương chiến sĩ vẻ vang', awards: 'khen thưởng',
};

const fallbackDescription = (action, resource) => {
  const actionText = ACTION_VI[action] || action;
  const resourceText = RESOURCE_VI[resource] || resource;
  return `${actionText} ${resourceText}`;
};

const getLogDescription = (resource, action) => {
  const resourceHelper = createLogDescription[resource];
  if (!resourceHelper) {
    return () => fallbackDescription(action, resource);
  }

  const actionHelper = resourceHelper[action];
  if (!actionHelper) {
    return () => fallbackDescription(action, resource);
  }

  return actionHelper;
};

/**
 * Get resource ID from request
 */
const getResourceId = {
  fromParams:
    (paramName = 'id') =>
    req => {
      return req.params?.[paramName] || null;
    },
  fromResponse: () => (req, res, responseData) => {
    try {
      const data = typeof responseData === 'string' ? JSON.parse(responseData) : responseData;
      return data?.data?.id || data?.id || null;
    } catch {
      return null;
    }
  },
  fromBody:
    (fieldName = 'id') =>
    req => {
      return req.body?.[fieldName] || null;
    },
};

module.exports = {
  getLogDescription,
  getResourceId,
  createLogDescription,
};
