import { Request, Response } from 'express';
import awardBulkService from '../services/awardBulk.service';
import { writeSystemLog } from '../helpers/systemLogHelper';
import { getLoaiDeXuatName } from '../constants/danhHieu.constants';
import { PROPOSAL_TYPES } from '../constants/proposalTypes.constants';
import ResponseHelper from '../helpers/responseHelper';
import catchAsync from '../helpers/catchAsync';

class AwardBulkController {
  bulkCreateAwards = catchAsync(async (req: Request, res: Response) => {
    const { type, nam, selected_personnel, selected_units, title_data, ghi_chu } = req.body;
    const adminId = req.user!.id;

    let parsedSelectedPersonnel = selected_personnel;
    let parsedSelectedUnits = selected_units;
    let parsedTitleData = title_data;

    if (typeof selected_personnel === 'string') {
      try {
        parsedSelectedPersonnel = JSON.parse(selected_personnel);
      } catch (e) {
        return ResponseHelper.badRequest(
          res,
          'selected_personnel phải là mảng hoặc chuỗi JSON hợp lệ'
        );
      }
    }

    if (typeof selected_units === 'string') {
      try {
        parsedSelectedUnits = JSON.parse(selected_units);
      } catch (e) {
        return ResponseHelper.badRequest(res, 'selected_units phải là mảng hoặc chuỗi JSON hợp lệ');
      }
    }

    if (typeof title_data === 'string') {
      try {
        parsedTitleData = JSON.parse(title_data);
      } catch (e) {
        return ResponseHelper.badRequest(res, 'title_data phải là mảng hoặc chuỗi JSON hợp lệ');
      }
    }

    if (!type || !nam) {
      return ResponseHelper.badRequest(res, 'Vui lòng nhập đầy đủ: type, nam');
    }

    if (type === PROPOSAL_TYPES.DON_VI_HANG_NAM) {
      if (
        !parsedSelectedUnits ||
        !Array.isArray(parsedSelectedUnits) ||
        parsedSelectedUnits.length === 0
      ) {
        return ResponseHelper.badRequest(res, 'Vui lòng chọn ít nhất một đơn vị');
      }
    } else {
      if (
        !parsedSelectedPersonnel ||
        !Array.isArray(parsedSelectedPersonnel) ||
        parsedSelectedPersonnel.length === 0
      ) {
        return ResponseHelper.badRequest(res, 'Vui lòng chọn ít nhất một quân nhân');
      }
    }

    if (!parsedTitleData || !Array.isArray(parsedTitleData) || parsedTitleData.length === 0) {
      return ResponseHelper.badRequest(res, 'Vui lòng nhập đầy đủ thông tin danh hiệu');
    }

    const files = req.files as Record<string, Express.Multer.File[]> | undefined;
    const attachedFiles = files?.attached_files || [];

    const result = await awardBulkService.bulkCreateAwards({
      type,
      nam: parseInt(nam),
      selectedPersonnel: parsedSelectedPersonnel,
      selectedUnits: parsedSelectedUnits,
      titleData: parsedTitleData,
      ghiChu: ghi_chu || null,
      attachedFiles,
      adminId,
    });

    const typeName = getLoaiDeXuatName(type);
    await writeSystemLog({
      userId: req.user?.id,
      userRole: req.user?.role,
      action: 'BULK_CREATE',
      resource: 'awards',
      description: `Thêm đồng loạt ${typeName} năm ${nam}: ${result.data?.importedCount || 0} thành công, ${result.data?.errorCount || 0} lỗi`,
      payload: {
        type,
        nam: parseInt(nam),
        importedCount: result.data?.importedCount,
        errorCount: result.data?.errorCount,
      },
    });

    return ResponseHelper.success(res, { message: result.message, data: result.data });
  });
}

export default new AwardBulkController();
