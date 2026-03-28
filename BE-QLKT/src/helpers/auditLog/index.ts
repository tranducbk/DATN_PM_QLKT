import { Request, Response } from 'express';
import { auth } from './auth';
import { accounts } from './accounts';
import { personnel, positionHistory, scientificAchievements } from './personnel';
import { annualRewards, adhocAwards, awards } from './awards';
import { units, positions } from './units';
import { proposals } from './proposals';
import { decisions } from './decisions';

type LogDescriptionFn = (
  req: Request,
  res: Response,
  responseData: unknown
) => string | Promise<string>;

const createLogDescription: Record<string, Record<string, LogDescriptionFn>> = {
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

const ACTION_VI: Record<string, string> = {
  CREATE: 'Tạo',
  UPDATE: 'Cập nhật',
  DELETE: 'Xóa',
  IMPORT: 'Nhập dữ liệu',
  IMPORT_PREVIEW: 'Tải lên xem trước',
  EXPORT: 'Xuất',
  BULK_CREATE: 'Thêm đồng loạt',
  APPROVE: 'Phê duyệt',
  REJECT: 'Từ chối',
  RECALCULATE: 'Tính toán lại',
  LOGIN: 'Đăng nhập',
  LOGOUT: 'Đăng xuất',
  RESET_PASSWORD: 'Đặt lại mật khẩu',
  CHANGE_PASSWORD: 'Đổi mật khẩu',
};
const RESOURCE_VI: Record<string, string> = {
  accounts: 'tài khoản',
  personnel: 'quân nhân',
  units: 'đơn vị',
  positions: 'chức vụ',
  proposals: 'đề xuất',
  decisions: 'quyết định',
  profiles: 'hồ sơ',
  'annual-rewards': 'danh hiệu hằng năm',
  'unit-annual-awards': 'khen thưởng đơn vị hằng năm',
  'position-history': 'lịch sử chức vụ',
  'scientific-achievements': 'thành tích khoa học',
  'adhoc-awards': 'khen thưởng đột xuất',
  'commemorative-medals': 'kỷ niệm chương',
  'contribution-awards': 'huân chương bảo vệ tổ quốc',
  'military-flag': 'huân chương quân kỳ quyết thắng',
  hccsvv: 'huy chương chiến sĩ vẻ vang',
  awards: 'khen thưởng',
};

const fallbackDescription = (action: string, resource: string): string => {
  const actionText = ACTION_VI[action] || action;
  const resourceText = RESOURCE_VI[resource] || resource;
  return `${actionText} ${resourceText}`;
};

const getLogDescription = (resource: string, action: string): LogDescriptionFn => {
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

const getResourceId = {
  fromParams:
    (paramName: string = 'id') =>
    (req: Request): string | null => {
      return (req.params?.[paramName] as string) || null;
    },
  fromResponse:
    () =>
    (req: Request, res: Response, responseData: unknown): string | null => {
      try {
        const data = typeof responseData === 'string' ? JSON.parse(responseData) : responseData;
        if (data && typeof data === 'object') {
          const obj = data as Record<string, unknown>;
          const nested = obj.data as Record<string, unknown> | undefined;
          return (nested?.id as string) || (obj.id as string) || null;
        }
        return null;
      } catch {
        return null;
      }
    },
  fromBody:
    (fieldName: string = 'id') =>
    (req: Request): string | null => {
      return req.body?.[fieldName] || null;
    },
};

export { getLogDescription, getResourceId, createLogDescription };
