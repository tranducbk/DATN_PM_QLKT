import { prisma } from '../../../models';
import { tenureMedalRepository } from '../../../repositories/tenureMedal.repository';
import { PROPOSAL_TYPES } from '../../../constants/proposalTypes.constants';
import { DANH_HIEU_HCCSVV } from '../../../constants/danhHieu.constants';
import { ELIGIBILITY_STATUS } from '../../../constants/eligibilityStatus.constants';
import { validateHCCSVVRankOrder } from '../../../helpers/awardValidation/tenureMedalRankOrder';
import { formatQuanNhanLabel } from './quanNhanLabel';
import {
  calculateServiceMonths,
  formatServiceDuration,
} from '../../../helpers/serviceYearsHelper';
import type { EditedProposalData, ProposalNienHanItem } from '../../../types/proposal';
import type {
  ProposalStrategy,
  ProposalSubmitContext,
  ProposalApproveContext,
  ImportAccumulator,
  PrismaTx,
  SubmitValidationResult,
} from './proposalStrategy';
import {
  loadNienHanPersonnelMap,
  buildNienHanPayloadItem,
  type NienHanInputItem,
} from './nienHanPayloadHelper';

class NienHanStrategy implements ProposalStrategy {
  readonly type = PROPOSAL_TYPES.NIEN_HAN;

  async buildSubmitPayload(
    titleData: unknown[],
    ctx: ProposalSubmitContext
  ): Promise<SubmitValidationResult> {
    const items = (titleData ?? []) as NienHanInputItem[];
    const personnelIds = items
      .map(i => i.personnel_id)
      .filter((id): id is string => Boolean(id));
    const personnelMap = await loadNienHanPersonnelMap(personnelIds);

    const dataNienHan = items.map(item =>
      buildNienHanPayloadItem(
        item,
        item.personnel_id ? personnelMap.get(item.personnel_id) : undefined,
        ctx.nam,
        ctx.thang
      )
    );

    const errors: string[] = [];
    const allowedDanhHieus = Object.values(DANH_HIEU_HCCSVV) as string[];
    const danhHieus = dataNienHan.map(i => i.danh_hieu).filter(Boolean) as string[];
    const invalidDanhHieus = danhHieus.filter(dh => !allowedDanhHieus.includes(dh));
    if (invalidDanhHieus.length > 0) {
      errors.push(
        `Loại đề xuất "Huy chương Chiến sĩ vẻ vang" chỉ cho phép các hạng HCCSVV. ` +
          `Các danh hiệu không hợp lệ: ${invalidDanhHieus.join(', ')}. ` +
          `Vui lòng sử dụng loại đề xuất riêng cho HC_QKQT hoặc KNC_VSNXD_QDNDVN.`
      );
    }

    if (errors.length === 0) {
      const evalIds = dataNienHan
        .map(i => i.personnel_id)
        .filter((id): id is string => Boolean(id));
      if (evalIds.length > 0) {
        const existingHCCSVV = await tenureMedalRepository.findManyRaw({
          where: { quan_nhan_id: { in: evalIds } },
          select: { quan_nhan_id: true, danh_hieu: true, nam: true },
        });
        const hccsvvByPersonnel = new Map<string, { danh_hieu: string; nam: number }[]>();
        for (const r of existingHCCSVV) {
          const list = hccsvvByPersonnel.get(r.quan_nhan_id) || [];
          list.push({ danh_hieu: r.danh_hieu, nam: r.nam });
          hccsvvByPersonnel.set(r.quan_nhan_id, list);
        }
        const rankOrderErrors: string[] = [];
        for (const item of dataNienHan) {
          if (!item.personnel_id || !item.danh_hieu) continue;
          const existing = hccsvvByPersonnel.get(item.personnel_id) || [];
          const orderError = validateHCCSVVRankOrder(item.danh_hieu, ctx.nam, existing);
          if (orderError) {
            const personnel = personnelMap.get(item.personnel_id);
            const hoTen = personnel?.ho_ten || item.personnel_id;
            rankOrderErrors.push(`${hoTen}: ${orderError}`);
          }
        }
        if (rankOrderErrors.length > 0) {
          errors.push(
            `Một số quân nhân chưa đủ điều kiện theo thứ tự hạng HCCSVV:\n${rankOrderErrors.join('\n')}`
          );
        }
      }
    }

    return { errors, payload: { data_nien_han: dataNienHan } };
  }

  /** See HcQkqtStrategy — approve flow lives in approve.ts pipeline. */
  async validateApprove(
    _editedData: EditedProposalData,
    _ctx: ProposalApproveContext
  ): Promise<string[]> {
    return [];
  }

  async importInTransaction(
    editedData: EditedProposalData,
    ctx: ProposalApproveContext,
    _decisions: Record<string, string | null | undefined>,
    _pdfPaths: Record<string, string | null | undefined>,
    acc: ImportAccumulator,
    prismaTx: PrismaTx
  ): Promise<void> {
    const nienHanData = (editedData.data_nien_han ?? []) as ProposalNienHanItem[];
    const decisionMapping = ctx.mappings?.decisionMapping ?? {};
    const proposalYear = ctx.proposalYear;
    const proposalMonth = ctx.proposalMonth;

    const personnelIds = nienHanData.map(it => it.personnel_id).filter(Boolean) as string[];
    const existingForOrder = await prismaTx.khenThuongHCCSVV.findMany({
      where: { quan_nhan_id: { in: personnelIds } },
      select: { quan_nhan_id: true, danh_hieu: true, nam: true },
    });
    const existingByPersonnel = new Map<string, { danh_hieu: string; nam: number }[]>();
    for (const r of existingForOrder) {
      const list = existingByPersonnel.get(r.quan_nhan_id) || [];
      list.push({ danh_hieu: r.danh_hieu, nam: r.nam });
      existingByPersonnel.set(r.quan_nhan_id, list);
    }

    const allowedDanhHieus = Object.values(DANH_HIEU_HCCSVV) as string[];

    for (const item of nienHanData) {
      try {
        if (!item.personnel_id) {
          acc.errors.push('Thiếu thông tin quân nhân khi xử lý Huy chương Chiến sĩ vẻ vang.');
          continue;
        }
        const quanNhan = await prismaTx.quanNhan.findUnique({ where: { id: item.personnel_id } });
        if (!quanNhan) {
          acc.errors.push(
            'Không tìm thấy thông tin quân nhân khi xử lý Huy chương Chiến sĩ vẻ vang. ' +
              'Quân nhân có thể đã bị xoá khỏi hệ thống — vui lòng tải lại đề xuất.'
          );
          continue;
        }
        if (!item.danh_hieu) {
          acc.errors.push(
            `${formatQuanNhanLabel(quanNhan)} chưa chọn hạng Huy chương Chiến sĩ vẻ vang.`
          );
          continue;
        }
        if (!allowedDanhHieus.includes(item.danh_hieu)) continue;

        const danhHieuDecision = decisionMapping[item.danh_hieu] || {};
        const soQuyetDinh = item.so_quyet_dinh || danhHieuDecision.so_quyet_dinh || null;
        const namNhan = item.nam_nhan;
        const thangNhan = item.thang_nhan;
        if (!namNhan || !thangNhan || thangNhan < 1 || thangNhan > 12) {
          acc.errors.push(
            `${formatQuanNhanLabel(quanNhan)} thiếu tháng/năm nhận huy chương`
          );
          continue;
        }
        if (
          namNhan < proposalYear ||
          (proposalMonth != null && namNhan === proposalYear && thangNhan < proposalMonth)
        ) {
          acc.errors.push(
            `${formatQuanNhanLabel(quanNhan)}: tháng/năm nhận (${thangNhan}/${namNhan}) không được trước tháng/năm đề xuất (${proposalMonth ?? '--'}/${proposalYear})`
          );
          continue;
        }
        if (item.nam_quyet_dinh && namNhan < item.nam_quyet_dinh) {
          acc.errors.push(
            `${formatQuanNhanLabel(quanNhan)}: năm nhận (${namNhan}) không được trước năm quyết định (${item.nam_quyet_dinh})`
          );
          continue;
        }

        const orderError = validateHCCSVVRankOrder(
          item.danh_hieu,
          namNhan,
          existingByPersonnel.get(quanNhan.id) || []
        );
        if (orderError) {
          acc.errors.push(`${formatQuanNhanLabel(quanNhan)}: ${orderError}`);
          continue;
        }

        let thoiGian: {
          total_months: number;
          years: number;
          months: number;
          display: string;
        } | null = null;
        if (quanNhan.ngay_nhap_ngu) {
          const ngayKetThuc = quanNhan.ngay_xuat_ngu
            ? new Date(quanNhan.ngay_xuat_ngu)
            : new Date(namNhan, thangNhan, 0);
          const months = calculateServiceMonths(new Date(quanNhan.ngay_nhap_ngu), ngayKetThuc);
          thoiGian = {
            total_months: months,
            years: Math.floor(months / 12),
            months: months % 12,
            display: formatServiceDuration(months),
          };
        }

        const awardData = {
          nam: namNhan,
          thang: thangNhan,
          cap_bac: item.cap_bac || null,
          chuc_vu: item.chuc_vu || null,
          ghi_chu: item.ghi_chu || null,
          so_quyet_dinh: soQuyetDinh,
          thoi_gian: thoiGian,
        };

        await prismaTx.khenThuongHCCSVV.upsert({
          where: {
            quan_nhan_id_danh_hieu: { quan_nhan_id: quanNhan.id, danh_hieu: item.danh_hieu },
          },
          update: awardData,
          create: { quan_nhan_id: quanNhan.id, danh_hieu: item.danh_hieu, ...awardData },
        });

        const ngayNhan = new Date(Date.UTC(namNhan, thangNhan - 1, 1));
        const PROFILE_FIELDS: Record<string, { status: string; ngay: string }> = {
          [DANH_HIEU_HCCSVV.HANG_BA]: {
            status: 'hccsvv_hang_ba_status',
            ngay: 'hccsvv_hang_ba_ngay',
          },
          [DANH_HIEU_HCCSVV.HANG_NHI]: {
            status: 'hccsvv_hang_nhi_status',
            ngay: 'hccsvv_hang_nhi_ngay',
          },
          [DANH_HIEU_HCCSVV.HANG_NHAT]: {
            status: 'hccsvv_hang_nhat_status',
            ngay: 'hccsvv_hang_nhat_ngay',
          },
        };
        const fields = PROFILE_FIELDS[item.danh_hieu];
        const profileUpdate = {
          [fields.status]: ELIGIBILITY_STATUS.DA_NHAN,
          [fields.ngay]: ngayNhan,
        };
        await prismaTx.hoSoNienHan.upsert({
          where: { quan_nhan_id: quanNhan.id },
          update: profileUpdate,
          create: { quan_nhan_id: quanNhan.id, ...profileUpdate },
        });

        acc.importedNienHan++;
        acc.affectedPersonnelIds.add(quanNhan.id);
      } catch (error) {
        console.error('[approveProposal] HCCSVV error:', {
          personnel_id: item.personnel_id,
          error,
        });
        acc.errors.push('Có lỗi xảy ra khi lưu Huy chương Chiến sĩ vẻ vang, vui lòng thử lại.');
      }
    }
  }

  buildSuccessMessage(acc: ImportAccumulator): string {
    return `Đã phê duyệt Huy chương Chiến sĩ vẻ vang cho ${acc.affectedPersonnelIds.size} quân nhân`;
  }
}

export const nienHanStrategy = new NienHanStrategy();
