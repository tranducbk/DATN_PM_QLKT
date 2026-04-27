import { prisma } from '../../../models';
import { PROPOSAL_TYPES } from '../../../constants/proposalTypes.constants';
import { CONG_HIEN_HE_SO_GROUPS } from '../../../constants/danhHieu.constants';
import { GENDER } from '../../../constants/gender.constants';
import { writeSystemLog } from '../../../helpers/systemLogHelper';
import {
  buildCutoffDate,
  formatServiceDuration,
} from '../../../helpers/serviceYearsHelper';
import { validateHCBVTQHighestRank } from '../../../helpers/hcbvtqHighestRankValidation';
import {
  aggregatePositionMonthsByGroup,
  type PositionMonthsByGroup,
} from '../../eligibility/congHienMonthsAggregator';
import {
  evaluateHCBVTQRank,
  getMonthsByGroup,
  loadHCBVTQEvaluationContext,
  requiredCongHienMonths,
} from '../../eligibility/hcbvtqEligibility';
import { collectPersonnelDuplicateErrors } from '../../eligibility/personnelDuplicateCheck';
import type { EditedProposalData } from '../../../types/proposal';
import type {
  ProposalStrategy,
  ProposalSubmitContext,
  ProposalApproveContext,
  ImportAccumulator,
  PrismaTx,
  SubmitValidationResult,
} from './proposalStrategy';

interface CongHienInputItem {
  personnel_id?: string;
  danh_hieu?: string;
  cap_bac?: string | null;
  chuc_vu?: string | null;
}

interface CongHienPersonnelRow {
  id: string;
  ho_ten: string | null;
  CoQuanDonVi: { id: string; ten_don_vi: string; ma_don_vi: string } | null;
  DonViTrucThuoc:
    | {
        id: string;
        ten_don_vi: string;
        ma_don_vi: string;
        CoQuanDonVi: { id: string; ten_don_vi: string; ma_don_vi: string } | null;
      }
    | null;
}

async function loadPersonnelMap(
  personnelIds: string[]
): Promise<Map<string, CongHienPersonnelRow>> {
  if (personnelIds.length === 0) return new Map();
  const rows = await prisma.quanNhan.findMany({
    where: { id: { in: personnelIds } },
    select: {
      id: true,
      ho_ten: true,
      CoQuanDonVi: { select: { id: true, ten_don_vi: true, ma_don_vi: true } },
      DonViTrucThuoc: {
        select: {
          id: true,
          ten_don_vi: true,
          ma_don_vi: true,
          CoQuanDonVi: { select: { id: true, ten_don_vi: true, ma_don_vi: true } },
        },
      },
    },
  });
  return new Map(rows.map(r => [r.id, r as CongHienPersonnelRow]));
}

function formatTime(totalMonths: number) {
  return {
    total_months: totalMonths,
    years: Math.floor(totalMonths / 12),
    months: totalMonths % 12,
    display: totalMonths === 0 ? '-' : formatServiceDuration(totalMonths),
  };
}

class CongHienStrategy implements ProposalStrategy {
  readonly type = PROPOSAL_TYPES.CONG_HIEN;

  async buildSubmitPayload(
    titleData: unknown[],
    ctx: ProposalSubmitContext
  ): Promise<SubmitValidationResult> {
    const items = (titleData ?? []) as CongHienInputItem[];
    const personnelIds = items
      .map(i => i.personnel_id)
      .filter((id): id is string => Boolean(id));
    const personnelMap = await loadPersonnelMap(personnelIds);

    const cutoffDate = buildCutoffDate(ctx.nam, ctx.thang);

    const dataCongHien = await Promise.all(
      items.map(async item => {
        const personnel = item.personnel_id ? personnelMap.get(item.personnel_id) : undefined;
        const baseData = {
          personnel_id: item.personnel_id,
          ho_ten: personnel?.ho_ten || '',
          nam: ctx.nam,
          thang: ctx.thang,
          danh_hieu: item.danh_hieu,
          cap_bac: item.cap_bac || null,
          chuc_vu: item.chuc_vu || null,
          co_quan_don_vi: personnel?.CoQuanDonVi
            ? {
                id: personnel.CoQuanDonVi.id,
                ten_co_quan_don_vi: personnel.CoQuanDonVi.ten_don_vi,
                ma_co_quan_don_vi: personnel.CoQuanDonVi.ma_don_vi,
              }
            : null,
          don_vi_truc_thuoc: personnel?.DonViTrucThuoc
            ? {
                id: personnel.DonViTrucThuoc.id,
                ten_don_vi: personnel.DonViTrucThuoc.ten_don_vi,
                ma_don_vi: personnel.DonViTrucThuoc.ma_don_vi,
                co_quan_don_vi: personnel.DonViTrucThuoc.CoQuanDonVi
                  ? {
                      id: personnel.DonViTrucThuoc.CoQuanDonVi.id,
                      ten_don_vi_truc: personnel.DonViTrucThuoc.CoQuanDonVi.ten_don_vi,
                      ma_don_vi: personnel.DonViTrucThuoc.CoQuanDonVi.ma_don_vi,
                    }
                  : null,
              }
            : null,
        };

        if (!item.personnel_id) return baseData;
        try {
          const histories = await prisma.lichSuChucVu.findMany({
            where: { quan_nhan_id: item.personnel_id },
            select: {
              he_so_chuc_vu: true,
              so_thang: true,
              ngay_bat_dau: true,
              ngay_ket_thuc: true,
            },
          });
          const monthsByGroup = aggregatePositionMonthsByGroup(histories, cutoffDate);
          return {
            ...baseData,
            thoi_gian_nhom_0_7: formatTime(monthsByGroup[CONG_HIEN_HE_SO_GROUPS.LEVEL_07]),
            thoi_gian_nhom_0_8: formatTime(monthsByGroup[CONG_HIEN_HE_SO_GROUPS.LEVEL_08]),
            thoi_gian_nhom_0_9_1_0: formatTime(monthsByGroup[CONG_HIEN_HE_SO_GROUPS.LEVEL_09_10]),
          };
        } catch (error) {
          console.error('ProposalSubmit.fetchPositionHistory failed', {
            personnelId: item.personnel_id,
            error,
          });
          void writeSystemLog({
            action: 'ERROR',
            resource: 'proposals',
            description: `[Tạo đề xuất] Lỗi lấy lịch sử chức vụ quân nhân ${item.personnel_id}: ${(error as Error).message}`,
          });
          return baseData;
        }
      })
    );

    if (dataCongHien.length === 0) {
      return { errors: [], payload: { data_cong_hien: dataCongHien } };
    }

    const errors: string[] = [];
    const hoTenMap = new Map<string, string>(
      Array.from(personnelMap.entries()).map(([id, p]) => [id, p.ho_ten || id])
    );
    const duplicateErrors = await collectPersonnelDuplicateErrors(
      dataCongHien,
      ctx.nam,
      this.type,
      { hoTenMap }
    );
    if (duplicateErrors.length > 0) {
      errors.push(
        `Phát hiện đề xuất trùng (cùng năm và cùng danh hiệu):\n${duplicateErrors.join('\n')}`
      );
      return { errors, payload: { data_cong_hien: dataCongHien } };
    }

    const evalIds = dataCongHien
      .map(i => i.personnel_id)
      .filter((id): id is string => Boolean(id));
    if (evalIds.length === 0) {
      return { errors, payload: { data_cong_hien: dataCongHien } };
    }

    const evalCtx = await loadHCBVTQEvaluationContext(evalIds, cutoffDate);

    for (const item of dataCongHien) {
      if (!item.danh_hieu || !item.personnel_id) continue;

      const personnel = personnelMap.get(item.personnel_id);
      const hoTen =
        personnel?.ho_ten || evalCtx.hoTenByPersonnel.get(item.personnel_id) || item.personnel_id;
      const gioiTinh = evalCtx.genderByPersonnel.get(item.personnel_id) ?? null;
      const requiredMonths = requiredCongHienMonths(gioiTinh);
      const months: PositionMonthsByGroup = {
        [CONG_HIEN_HE_SO_GROUPS.LEVEL_07]: getMonthsByGroup(
          evalCtx,
          item.personnel_id,
          CONG_HIEN_HE_SO_GROUPS.LEVEL_07
        ),
        [CONG_HIEN_HE_SO_GROUPS.LEVEL_08]: getMonthsByGroup(
          evalCtx,
          item.personnel_id,
          CONG_HIEN_HE_SO_GROUPS.LEVEL_08
        ),
        [CONG_HIEN_HE_SO_GROUPS.LEVEL_09_10]: getMonthsByGroup(
          evalCtx,
          item.personnel_id,
          CONG_HIEN_HE_SO_GROUPS.LEVEL_09_10
        ),
      };

      const downgradeError = validateHCBVTQHighestRank(item.danh_hieu, months, requiredMonths);
      if (downgradeError) {
        errors.push(`Quân nhân "${hoTen}": ${downgradeError}`);
        return { errors, payload: { data_cong_hien: dataCongHien } };
      }

      const result = evaluateHCBVTQRank(item.danh_hieu, months, gioiTinh);
      if (!result.rank) continue;
      if (!result.eligible) {
        const totalYearsText = formatServiceDuration(result.totalMonths);
        const requiredYearsText = formatServiceDuration(result.requiredMonths);
        const genderText = gioiTinh === GENDER.FEMALE ? ' (Nữ giảm 1/3 thời gian)' : '';
        errors.push(
          `Quân nhân "${hoTen}" không đủ điều kiện đề xuất Huân chương Bảo vệ Tổ quốc ${result.rankName}. ` +
            `Yêu cầu: ít nhất ${requiredYearsText}${genderText}. Hiện tại: ${totalYearsText}. ` +
            `Vui lòng kiểm tra lại lịch sử chức vụ của quân nhân này.`
        );
        return { errors, payload: { data_cong_hien: dataCongHien } };
      }
    }

    return { errors, payload: { data_cong_hien: dataCongHien } };
  }

  async validateApprove(
    _editedData: EditedProposalData,
    _ctx: ProposalApproveContext
  ): Promise<string[]> {
    return [];
  }

  async importInTransaction(
    _editedData: EditedProposalData,
    _ctx: ProposalApproveContext,
    _decisions: Record<string, string | null | undefined>,
    _pdfPaths: Record<string, string | null | undefined>,
    _acc: ImportAccumulator,
    _prismaTx: PrismaTx
  ): Promise<void> {
    // No-op: legacy approve.ts owns import.
  }

  buildSuccessMessage(acc: ImportAccumulator): string {
    return `Đã phê duyệt Huân chương Bảo vệ Tổ quốc cho ${acc.affectedPersonnelIds.size} quân nhân`;
  }
}

export const congHienStrategy = new CongHienStrategy();
