import { Request, Response } from 'express';
import profileService from '../services/profile.service';
import unitAnnualAwardService from '../services/unitAnnualAward.service';
import ResponseHelper from '../helpers/responseHelper';
import catchAsync from '../helpers/catchAsync';
import { ADHOC_TYPE } from '../constants/adhocType.constants';

interface PersonnelIdParams {
  personnel_id?: string;
}

interface YearQuery {
  year?: string;
}

interface CheckEligibilityItem {
  type?: string;
  personnel_id?: string;
  don_vi_id?: string;
  nam: number;
  danh_hieu: string;
}

interface CheckEligibilityBody {
  items?: CheckEligibilityItem[];
}

interface UpdateTenureProfileBody {
  [key: string]: unknown;
}

class ProfileController {
  getAnnualProfile = catchAsync(async (req: Request, res: Response) => {
    const params = req.params as PersonnelIdParams;
    const query = req.query as YearQuery;
    const { personnel_id } = params;
    const { year } = query;
    const yearNumber = year ? parseInt(year, 10) : null;
    if (yearNumber) await profileService.recalculateAnnualProfile(personnel_id, yearNumber);
    const result = await profileService.getAnnualProfile(personnel_id);
    return ResponseHelper.success(res, {
      message: 'Lấy hồ sơ hằng năm thành công',
      data: result,
    });
  });

  getTenureProfile = catchAsync(async (req: Request, res: Response) => {
    const params = req.params as PersonnelIdParams;
    const { personnel_id } = params;
    await profileService.recalculateTenureProfile(personnel_id);
    const result = await profileService.getTenureProfile(personnel_id);
    return ResponseHelper.success(res, {
      message: 'Lấy hồ sơ Huy chương Chiến sĩ vẻ vang thành công',
      data: result,
    });
  });

  getContributionProfile = catchAsync(async (req: Request, res: Response) => {
    const params = req.params as PersonnelIdParams;
    const { personnel_id } = params;
    await profileService.recalculateContributionProfile(personnel_id);
    const result = await profileService.getContributionProfile(personnel_id);
    return ResponseHelper.success(res, {
      message: 'Lấy hồ sơ Huân chương Bảo vệ Tổ quốc thành công',
      data: result,
    });
  });

  recalculateProfile = catchAsync(async (req: Request, res: Response) => {
    const params = req.params as PersonnelIdParams;
    const query = req.query as YearQuery;
    const { personnel_id } = params;
    const { year } = query;
    const yearNumber = year ? parseInt(year, 10) : null;
    const result = await profileService.recalculateAnnualProfile(personnel_id, yearNumber);
    return ResponseHelper.success(res, { message: result.message });
  });

  recalculateAll = catchAsync(async (req: Request, res: Response) => {
    const result = await profileService.recalculateAll();
    return ResponseHelper.success(res, {
      message: result.message,
      data: { success: result.success, errors: result.errors },
    });
  });

  checkEligibility = catchAsync(async (req: Request, res: Response) => {
    const body = req.body as CheckEligibilityBody;
    const { items } = body;
    if (!items || !Array.isArray(items) || items.length === 0) {
      return ResponseHelper.badRequest(res, 'Thiếu danh sách cần kiểm tra');
    }
    const results = [];
    for (const item of items) {
      let result: { eligible: boolean; reason: string };
      if (item.type === 'DON_VI' && item.don_vi_id) {
        result = await unitAnnualAwardService.checkUnitAwardEligibility(
          item.don_vi_id,
          item.nam,
          item.danh_hieu
        );
        results.push({
          don_vi_id: item.don_vi_id,
          nam: item.nam,
          danh_hieu: item.danh_hieu,
          type: 'DON_VI',
          ...result,
        });
      } else {
        result = await profileService.checkAwardEligibility(
          item.personnel_id,
          item.nam,
          item.danh_hieu
        );
        results.push({
          personnel_id: item.personnel_id,
          nam: item.nam,
          danh_hieu: item.danh_hieu,
          type: ADHOC_TYPE.CA_NHAN,
          ...result,
        });
      }
    }
    return ResponseHelper.success(res, {
      message: 'Kiểm tra điều kiện khen thưởng thành công',
      data: results,
    });
  });

  getAllTenureProfiles = catchAsync(async (req: Request, res: Response) => {
    const result = await profileService.getAllTenureProfiles();
    return ResponseHelper.success(res, {
      message: 'Lấy danh sách hồ sơ Huy chương Chiến sĩ vẻ vang thành công',
      data: result,
    });
  });

  updateTenureProfile = catchAsync(async (req: Request, res: Response) => {
    const params = req.params as PersonnelIdParams;
    const body = req.body as UpdateTenureProfileBody;
    const { personnel_id } = params;
    const updates = body;
    const result = await profileService.updateTenureProfile(personnel_id, updates);
    return ResponseHelper.success(res, {
      message: 'Cập nhật hồ sơ Huy chương Chiến sĩ vẻ vang thành công',
      data: result,
    });
  });
}

export default new ProfileController();
