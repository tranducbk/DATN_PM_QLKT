import { Request, Response } from 'express';
import { parseResponseData, asRecord } from '../constants';
import { getDanhHieuName } from '../../../constants/danhHieu.constants';
import { PROPOSAL_TYPES } from '../../../constants/proposalTypes.constants';

/** Bulk create body `type` → wording in audit description. */
const BULK_AUDIT_TYPE: Record<string, string> = {
  CA_NHAN_HANG_NAM: 'Danh hiệu cá nhân hằng năm',
  DON_VI_HANG_NAM: 'Danh hiệu đơn vị hằng năm',
  NCKH: 'Thành tích Nghiên cứu khoa học',
  NIEN_HAN: 'Huy chương Chiến sĩ vẻ vang',
  HC_QKQT: 'Huy chương Quân kỳ quyết thắng',
  KNC_VSNXD_QDNDVN: 'Kỷ niệm chương vì sự nghiệp xây dựng QĐNDVN',
  CONG_HIEN: 'Huân chương Bảo vệ Tổ quốc',
};

export const awards: Record<
  string,
  (req: Request, res: Response, responseData: unknown) => Promise<string>
> = {
  BULK: async (req: Request, res: Response, responseData: unknown): Promise<string> => {
    try {
      const data = parseResponseData(responseData);
      const result = asRecord(data?.data) || data || {};

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
          // best-effort — audit description must not throw
        }
      }

      if (typeof selectedUnits === 'string') {
        try {
          parsedSelectedUnits = JSON.parse(selectedUnits);
        } catch (error) {
          console.error('Audit log helper fallback triggered (helpers/auditLog/awards.ts):', error);
          // best-effort — audit description must not throw
        }
      }

      if (typeof titleData === 'string') {
        try {
          parsedTitleData = JSON.parse(titleData);
        } catch (error) {
          console.error('Audit log helper fallback triggered (helpers/auditLog/awards.ts):', error);
          // best-effort — audit description must not throw
        }
      }

      const typeName = BULK_AUDIT_TYPE[type] || type || 'Khen thưởng';

      const importedCount = (result?.importedCount as number) || 0;
      const errorCount = (result?.errorCount as number) || 0;
      const affectedPersonnelIds = (result?.affectedPersonnelIds as string[]) || [];

      let soLuong = 0;
      let donViText = '';
      let danhHieuText = '';

      if (type === PROPOSAL_TYPES.DON_VI_HANG_NAM) {
        soLuong = Array.isArray(parsedSelectedUnits) ? parsedSelectedUnits.length : 0;
        donViText = soLuong > 0 ? `${soLuong} đơn vị` : '';

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
  },
};
