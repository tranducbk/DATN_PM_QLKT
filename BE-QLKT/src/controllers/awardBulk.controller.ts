import { Request, Response } from 'express';
import awardBulkService, { TitleDataItem } from '../services/awardBulk.service';
import { PROPOSAL_TYPES } from '../constants/proposalTypes.constants';
import ResponseHelper from '../helpers/responseHelper';
import catchAsync from '../helpers/catchAsync';

class AwardBulkController {
  bulkCreateAwards = catchAsync(async (req: Request, res: Response) => {
    const user = req.user!;
    const body = req.body as {
      type?: string;
      nam?: number;
      selected_personnel?: string[];
      selected_units?: string[];
      title_data?: TitleDataItem[];
      ghi_chu?: string;
    };
    const { type, nam, selected_personnel, selected_units, title_data, ghi_chu } = body;
    const adminId = user.id;

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
      selectedPersonnel: selected_personnel || [],
      selectedUnits: selected_units,
      titleData: title_data,
      ghiChu: ghi_chu || null,
      attachedFiles,
      adminId,
    });

    return ResponseHelper.success(res, { message: result.message, data: result.data });
  });
}

export default new AwardBulkController();
