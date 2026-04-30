import { Request, Response } from 'express';

import { AWARD_SLUGS } from '../../constants/awardSlugs.constants';
import { AWARD_RESOURCE } from '../../constants/awardResource.constants';
import { auth } from './auth';
import { accounts } from './accounts';
import { personnel, positionHistory, scientificAchievements } from './personnel';
import {
  annualRewards,
  adhocAwards,
  awards,
  tenureMedals,
  commemorativeMedals,
  militaryFlag,
  contributionMedals,
  unitAnnualAwards,
} from './awards';
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
  [AWARD_SLUGS.ANNUAL_REWARDS]: annualRewards,
  'position-history': positionHistory,
  accounts,
  personnel,
  units,
  positions,
  decisions,
  [AWARD_SLUGS.SCIENTIFIC_ACHIEVEMENTS]: scientificAchievements,
  auth,
  [AWARD_SLUGS.ADHOC_AWARDS]: adhocAwards,
  awards,
  [AWARD_SLUGS.TENURE_MEDALS]: tenureMedals,
  [AWARD_SLUGS.COMMEMORATIVE_MEDALS]: commemorativeMedals,
  [AWARD_SLUGS.MILITARY_FLAG]: militaryFlag,
  [AWARD_SLUGS.CONTRIBUTION_MEDALS]: contributionMedals,
  [AWARD_SLUGS.UNIT_ANNUAL_AWARDS]: unitAnnualAwards,
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
  'position-history': 'lịch sử chức vụ',
  awards: 'khen thưởng',
  [AWARD_SLUGS.ANNUAL_REWARDS]: AWARD_RESOURCE[AWARD_SLUGS.ANNUAL_REWARDS].vi,
  [AWARD_SLUGS.UNIT_ANNUAL_AWARDS]: AWARD_RESOURCE[AWARD_SLUGS.UNIT_ANNUAL_AWARDS].vi,
  [AWARD_SLUGS.SCIENTIFIC_ACHIEVEMENTS]: AWARD_RESOURCE[AWARD_SLUGS.SCIENTIFIC_ACHIEVEMENTS].vi,
  [AWARD_SLUGS.ADHOC_AWARDS]: AWARD_RESOURCE[AWARD_SLUGS.ADHOC_AWARDS].vi,
  [AWARD_SLUGS.COMMEMORATIVE_MEDALS]: AWARD_RESOURCE[AWARD_SLUGS.COMMEMORATIVE_MEDALS].vi,
  [AWARD_SLUGS.CONTRIBUTION_MEDALS]: AWARD_RESOURCE[AWARD_SLUGS.CONTRIBUTION_MEDALS].vi,
  [AWARD_SLUGS.MILITARY_FLAG]: AWARD_RESOURCE[AWARD_SLUGS.MILITARY_FLAG].vi,
  [AWARD_SLUGS.TENURE_MEDALS]: AWARD_RESOURCE[AWARD_SLUGS.TENURE_MEDALS].vi,
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

export { getLogDescription, createLogDescription };
