// Builder mô tả log audit cho thao tác thêm khen thưởng hàng loạt (bulk).
import { Request, Response } from 'express';
import { parseResponseData, asRecord } from '../constants';
import { getDanhHieuName } from '../../../constants/danhHieu.constants';
import { PROPOSAL_TYPES } from '../../../constants/proposalTypes.constants';
import { getAwardLabelByProposalType } from '../../../constants/awardResource.constants';

/**
 * Dựng mô tả chuẩn cho thao tác thêm khen thưởng hàng loạt.
 * @param req - Request chứa payload bulk (type, nam, danh sách quân nhân/đơn vị, title_data)
 * @param res - Response của thao tác bulk
 * @param responseData - Dữ liệu trả về của thao tác (số thêm thành công, số lỗi, ...)
 * @returns Câu mô tả tiếng Việt cho bản ghi log audit
 */
async function buildBulkDescription(
  req: Request,
  res: Response,
  responseData: unknown
): Promise<string> {
  try {
    const data = parseResponseData(responseData);
    const result = asRecord(data?.data) || {};

    const type = req.body?.type || '';
    const nam = req.body?.nam || '';
    const selectedPersonnel = req.body?.selected_personnel || [];
    const selectedUnits = req.body?.selected_units || [];
    const titleData = req.body?.title_data || [];

    let parsedSelectedPersonnel = selectedPersonnel;
    let parsedSelectedUnits = selectedUnits;
    let parsedTitleData = titleData;

    if (typeof selectedPersonnel === 'string') {
      try {
        parsedSelectedPersonnel = JSON.parse(selectedPersonnel);
      } catch (error) {
        console.error('Audit log helper fallback triggered (helpers/auditLog/awards.ts):', error);
        // best-effort: mô tả log không được phép throw
      }
    }

    if (typeof selectedUnits === 'string') {
      try {
        parsedSelectedUnits = JSON.parse(selectedUnits);
      } catch (error) {
        console.error('Audit log helper fallback triggered (helpers/auditLog/awards.ts):', error);
        // best-effort: mô tả log không được phép throw
      }
    }

    if (typeof titleData === 'string') {
      try {
        parsedTitleData = JSON.parse(titleData);
      } catch (error) {
        console.error('Audit log helper fallback triggered (helpers/auditLog/awards.ts):', error);
        // best-effort: mô tả log không được phép throw
      }
    }

    const typeName = getAwardLabelByProposalType(type) || 'Khen thưởng';

    const importedCount = (result?.importedCount as number) || 0;
    const errorCount = (result?.errorCount as number) || 0;
    const affectedPersonnelIds = (result?.affectedPersonnelIds as string[]) || [];

    let soLuong = 0;
    let donViText = '';
    let danhHieuText = '';

    if (type === PROPOSAL_TYPES.DON_VI_HANG_NAM) {
      soLuong = Array.isArray(parsedSelectedUnits) ? parsedSelectedUnits.length : 0;
      donViText = soLuong > 0 ? `${soLuong} đơn vị` : '';

      // Gom nhiều đơn vị trong 1 log: dồn các danh hiệu khác nhau, bỏ trùng
      if (Array.isArray(parsedTitleData) && parsedTitleData.length > 0) {
        const danhHieus = new Set<string>();
        parsedTitleData.forEach((item: Record<string, unknown>) => {
          if (item.danh_hieu) {
            danhHieus.add(getDanhHieuName(item.danh_hieu as string));
          }
        });
        if (danhHieus.size > 0) {
          danhHieuText = Array.from(danhHieus).join(', ');
        }
      }
    } else {
      soLuong = Array.isArray(parsedSelectedPersonnel)
        ? parsedSelectedPersonnel.length
        : Array.isArray(affectedPersonnelIds)
          ? affectedPersonnelIds.length
          : importedCount || 0;
      donViText = soLuong > 0 ? `${soLuong} quân nhân` : '';

      // Gom nhiều quân nhân trong 1 log: dồn các danh hiệu/loại, bỏ trùng
      if (Array.isArray(parsedTitleData) && parsedTitleData.length > 0) {
        if (type === PROPOSAL_TYPES.NCKH) {
          const loais = new Set<string>();
          parsedTitleData.forEach((item: Record<string, unknown>) => {
            if (item.loai) {
              loais.add(getDanhHieuName(item.loai as string));
            }
          });
          if (loais.size > 0) {
            danhHieuText = Array.from(loais).join(', ');
          }
        } else if (type === PROPOSAL_TYPES.HC_QKQT || type === PROPOSAL_TYPES.KNC_VSNXD_QDNDVN) {
          danhHieuText = '';
        } else {
          const danhHieus = new Set<string>();
          parsedTitleData.forEach((item: Record<string, unknown>) => {
            if (item.danh_hieu) {
              danhHieus.add(getDanhHieuName(item.danh_hieu as string));
            }
          });
          if (danhHieus.size > 0) {
            danhHieuText = Array.from(danhHieus).join(', ');
          }
        }
      }
    }

    let description = `Thêm khen thưởng đồng loạt: ${typeName}`;

    if (nam) {
      description += ` năm ${nam}`;
    }

    if (danhHieuText) {
      description += ` - ${danhHieuText}`;
    }

    if (donViText) {
      description += ` (${donViText})`;
    }

    if (importedCount > 0) {
      description += ` - Thành công: ${importedCount}`;
    }

    if (errorCount > 0) {
      description += `, Lỗi: ${errorCount}`;
    }

    return description;
  } catch (error) {
    console.error('Audit log helper fallback triggered (helpers/auditLog/awards.ts):', error);
    return 'Thêm khen thưởng đồng loạt';
  }
}

/**
 * Map builder mô tả log theo action thêm hàng loạt.
 * BULK là luồng admin thường; BULK_BYPASS là SUPER_ADMIN thêm dữ liệu cũ,
 * dùng lại mô tả BULK và gắn thêm tiền tố đánh dấu bỏ qua kiểm tra.
 */
export const awards: Record<
  string,
  (req: Request, res: Response, responseData: unknown) => Promise<string>
> = {
  BULK: buildBulkDescription,
  BULK_BYPASS: async (req: Request, res: Response, responseData: unknown): Promise<string> => {
    const base = await buildBulkDescription(req, res, responseData);
    return `Thêm dữ liệu cũ (bỏ qua kiểm tra): ${base}`;
  },
};
