import { Request, Response } from 'express';
import awardBulkService, { TitleDataItem } from '../services/awardBulk.service';
import { PROPOSAL_TYPES } from '../constants/proposalTypes.constants';
import ResponseHelper from '../helpers/responseHelper';
import catchAsync from '../helpers/catchAsync';

interface BulkAwardBody {
  type?: string;
  nam?: number;
  thang?: number | null;
  selected_personnel?: string[];
  selected_units?: string[];
  title_data?: TitleDataItem[];
  ghi_chu?: string;
}

const dispatchBulk = async (
  req: Request,
  res: Response,
  bypassEligibility: boolean
) => {
  const user = req.user!;
  const body = req.body as BulkAwardBody;
  const { type, nam, thang, selected_personnel, selected_units, title_data, ghi_chu } = body;

  if (type === PROPOSAL_TYPES.DON_VI_HANG_NAM) {
    if (
      !selected_units ||
      !Array.isArray(selected_units) ||
      selected_units.length === 0
    ) {
      return ResponseHelper.badRequest(res, 'Vui lòng chọn ít nhất một đơn vị');
    }
  } else {
    if (
      !selected_personnel ||
      !Array.isArray(selected_personnel) ||
      selected_personnel.length === 0
    ) {
      return ResponseHelper.badRequest(res, 'Vui lòng chọn ít nhất một quân nhân');
    }
  }

  if (!title_data || !Array.isArray(title_data) || title_data.length === 0) {
    return ResponseHelper.badRequest(res, 'Vui lòng nhập đầy đủ thông tin danh hiệu');
  }

  const files = req.files as Record<string, Express.Multer.File[]> | undefined;
  const attachedFiles = files?.attached_files || [];

  const result = await awardBulkService.bulkCreateAwards({
    type,
    nam,
    thang: thang ?? null,
    selectedPersonnel: selected_personnel || [],
    selectedUnits: selected_units,
    titleData: title_data,
    ghiChu: ghi_chu || null,
    attachedFiles,
    adminId: user.id,
    bypassEligibility,
  });

  if (result.data.errorCount > 0 && result.data.importedCount === 0) {
    return ResponseHelper.error(res, {
      message: result.message,
      statusCode: 400,
      details: result.data,
    });
  }

  return ResponseHelper.success(res, { message: result.message, data: result.data });
};

class AwardBulkController {
  bulkCreateAwards = catchAsync(async (req: Request, res: Response) => {
    return dispatchBulk(req, res, false);
  });

  bulkCreateAwardsBypass = catchAsync(async (req: Request, res: Response) => {
    return dispatchBulk(req, res, true);
  });
}

export default new AwardBulkController();
