import { Request, Response } from 'express';
import profileService from '../services/profile.service';
import unitAnnualAwardService from '../services/unitAnnualAward.service';
import personnelService from '../services/personnel.service';
import ResponseHelper from '../helpers/responseHelper';
import catchAsync from '../helpers/catchAsync';
import { ADHOC_TYPE } from '../constants/adhocType.constants';
import { getLoaiDeXuatName } from '../constants/danhHieu.constants';
import { PROPOSAL_TYPES } from '../constants/proposalTypes.constants';

const NIEN_HAN_LABEL = getLoaiDeXuatName(PROPOSAL_TYPES.NIEN_HAN);
const CONG_HIEN_LABEL = getLoaiDeXuatName(PROPOSAL_TYPES.CONG_HIEN);

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
    await personnelService.assertCanViewPersonnel(
      personnel_id,
      req.user?.role,
      req.user?.quan_nhan_id
    );
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
    await personnelService.assertCanViewPersonnel(
      personnel_id,
      req.user?.role,
      req.user?.quan_nhan_id
    );
    await profileService.recalculateTenureProfile(personnel_id);
    const result = await profileService.getTenureProfile(personnel_id);
    return ResponseHelper.success(res, {
      message: `Lấy hồ sơ ${NIEN_HAN_LABEL} thành công`,
      data: result,
    });
  });

  getContributionProfile = catchAsync(async (req: Request, res: Response) => {
    const params = req.params as PersonnelIdParams;
    const { personnel_id } = params;
    await personnelService.assertCanViewPersonnel(
      personnel_id,
      req.user?.role,
      req.user?.quan_nhan_id
    );
    await profileService.recalculateContributionProfile(personnel_id);
    const result = await profileService.getContributionProfile(personnel_id);
    return ResponseHelper.success(res, {
      message: `Lấy hồ sơ ${CONG_HIEN_LABEL} thành công`,
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
    const results = await Promise.all(
      items.map(async item => {
        if (item.type === 'DON_VI' && item.don_vi_id) {
          const result = await unitAnnualAwardService.checkUnitAwardEligibility(
            item.don_vi_id,
            item.nam,
            item.danh_hieu
          );
          return {
            don_vi_id: item.don_vi_id,
            nam: item.nam,
            danh_hieu: item.danh_hieu,
            type: 'DON_VI',
            ...result,
          };
        }
        const result = await profileService.checkAwardEligibility(
          item.personnel_id,
          item.nam,
          item.danh_hieu
        );
        return {
          personnel_id: item.personnel_id,
          nam: item.nam,
          danh_hieu: item.danh_hieu,
          type: ADHOC_TYPE.CA_NHAN,
          ...result,
        };
      })
    );
    return ResponseHelper.success(res, {
      message: 'Kiểm tra điều kiện khen thưởng thành công',
      data: results,
    });
  });

  getAllTenureProfiles = catchAsync(async (req: Request, res: Response) => {
    const result = await profileService.getAllTenureProfiles();
    return ResponseHelper.success(res, {
      message: `Lấy danh sách hồ sơ ${NIEN_HAN_LABEL} thành công`,
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
      message: `Cập nhật hồ sơ ${NIEN_HAN_LABEL} thành công`,
      data: result,
    });
  });
}

export default new ProfileController();
