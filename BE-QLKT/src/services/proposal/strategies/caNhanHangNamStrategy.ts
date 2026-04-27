import { prisma } from '../../../models';
import { PROPOSAL_TYPES } from '../../../constants/proposalTypes.constants';
import {
  DANH_HIEU_CA_NHAN_HANG_NAM,
  DANH_HIEU_CA_NHAN_CO_BAN,
  DANH_HIEU_CA_NHAN_BANG_KHEN,
} from '../../../constants/danhHieu.constants';
import profileService from '../../profile.service';
import { collectPersonnelDuplicateErrors } from '../../eligibility/personnelDuplicateCheck';
import {
  collectDuplicateCaNhanPayload,
  findInvalidDanhHieu,
  DUPLICATE_IN_PAYLOAD_ERROR,
  INVALID_DANH_HIEU_ERROR,
  MIXED_CA_NHAN_HANG_NAM_ERROR,
} from '../validation';
import type { EditedProposalData, ProposalDanhHieuItem } from '../../../types/proposal';
import type {
  ProposalStrategy,
  ProposalSubmitContext,
  ProposalApproveContext,
  ImportAccumulator,
  PrismaTx,
  SubmitValidationResult,
} from './proposalStrategy';

interface CaNhanInputItem {
  personnel_id?: string;
  danh_hieu?: string;
  cap_bac?: string | null;
  chuc_vu?: string | null;
}

interface CaNhanPersonnelRow {
  id: string;
  ho_ten: string | null;
  don_vi_truc_thuoc_id: string | null;
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

async function loadPersonnelMap(personnelIds: string[]): Promise<Map<string, CaNhanPersonnelRow>> {
  if (personnelIds.length === 0) return new Map();
  const rows = await prisma.quanNhan.findMany({
    where: { id: { in: personnelIds } },
    select: {
      id: true,
      ho_ten: true,
      don_vi_truc_thuoc_id: true,
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
  return new Map(rows.map(r => [r.id, r as CaNhanPersonnelRow]));
}

class CaNhanHangNamStrategy implements ProposalStrategy {
  readonly type = PROPOSAL_TYPES.CA_NHAN_HANG_NAM;

  async buildSubmitPayload(
    titleData: unknown[],
    ctx: ProposalSubmitContext
  ): Promise<SubmitValidationResult> {
    const items = (titleData ?? []) as CaNhanInputItem[];
    const personnelIds = items
      .map(i => i.personnel_id)
      .filter((id): id is string => Boolean(id));
    const personnelMap = await loadPersonnelMap(personnelIds);

    const dataDanhHieu = items.map(item => {
      const personnel = item.personnel_id ? personnelMap.get(item.personnel_id) : undefined;
      const personnelCoQuanDonVi = personnel?.CoQuanDonVi;
      const personnelDonViTrucThuoc = personnel?.DonViTrucThuoc;

      const coQuanDonVi = personnelCoQuanDonVi
        ? {
            id: personnelCoQuanDonVi.id,
            ten_co_quan_don_vi: personnelCoQuanDonVi.ten_don_vi,
            ma_co_quan_don_vi: personnelCoQuanDonVi.ma_don_vi,
          }
        : null;

      const donViTrucThuoc =
        personnel?.don_vi_truc_thuoc_id && personnelDonViTrucThuoc
          ? {
              id: personnelDonViTrucThuoc.id,
              ten_don_vi: personnelDonViTrucThuoc.ten_don_vi,
              ma_don_vi: personnelDonViTrucThuoc.ma_don_vi,
              co_quan_don_vi: personnelDonViTrucThuoc.CoQuanDonVi
                ? {
                    id: personnelDonViTrucThuoc.CoQuanDonVi.id,
                    ten_don_vi_truc: personnelDonViTrucThuoc.CoQuanDonVi.ten_don_vi,
                    ma_don_vi: personnelDonViTrucThuoc.CoQuanDonVi.ma_don_vi,
                  }
                : null,
            }
          : null;

      return {
        personnel_id: item.personnel_id,
        ho_ten: personnel?.ho_ten || '',
        nam: ctx.nam,
        danh_hieu: item.danh_hieu,
        cap_bac: item.cap_bac || null,
        chuc_vu: item.chuc_vu || null,
        co_quan_don_vi: coQuanDonVi,
        don_vi_truc_thuoc: donViTrucThuoc,
        nhan_bkbqp: item.danh_hieu === DANH_HIEU_CA_NHAN_HANG_NAM.BKBQP,
        nhan_cstdtq: item.danh_hieu === DANH_HIEU_CA_NHAN_HANG_NAM.CSTDTQ,
        nhan_bkttcp: item.danh_hieu === DANH_HIEU_CA_NHAN_HANG_NAM.BKTTCP,
      };
    });

    if (dataDanhHieu.length === 0) {
      return { errors: [], payload: { data_danh_hieu: dataDanhHieu } };
    }

    const errors: string[] = [];
    const selectedDanhHieu = dataDanhHieu.map(i => i.danh_hieu).filter(Boolean) as string[];
    const validCaNhanDanhHieu = new Set<string>(Object.values(DANH_HIEU_CA_NHAN_HANG_NAM));
    const invalidDanhHieu = findInvalidDanhHieu(selectedDanhHieu, validCaNhanDanhHieu);
    if (invalidDanhHieu.length > 0) {
      errors.push(`${INVALID_DANH_HIEU_ERROR}\n${invalidDanhHieu.join(', ')}`);
      return { errors, payload: { data_danh_hieu: dataDanhHieu } };
    }

    const duplicatePayloadItems = collectDuplicateCaNhanPayload(
      dataDanhHieu,
      personnelId => personnelMap.get(personnelId)?.ho_ten || personnelId
    );
    if (duplicatePayloadItems.length > 0) {
      errors.push(`${DUPLICATE_IN_PAYLOAD_ERROR}\n${duplicatePayloadItems.join('\n')}`);
      return { errors, payload: { data_danh_hieu: dataDanhHieu } };
    }

    const hasChinh = selectedDanhHieu.some(dh => DANH_HIEU_CA_NHAN_CO_BAN.has(dh));
    const hasNhomChuoi = selectedDanhHieu.some(dh =>
      (
        [
          DANH_HIEU_CA_NHAN_HANG_NAM.BKBQP,
          DANH_HIEU_CA_NHAN_HANG_NAM.CSTDTQ,
          DANH_HIEU_CA_NHAN_HANG_NAM.BKTTCP,
        ] as string[]
      ).includes(dh)
    );
    if (hasChinh && hasNhomChuoi) {
      errors.push(MIXED_CA_NHAN_HANG_NAM_ERROR);
      return { errors, payload: { data_danh_hieu: dataDanhHieu } };
    }

    const hoTenMap = new Map<string, string>(
      Array.from(personnelMap.entries()).map(([id, p]) => [id, p.ho_ten || id])
    );
    const duplicateErrors = await collectPersonnelDuplicateErrors(
      dataDanhHieu,
      ctx.nam,
      this.type,
      { hoTenMap }
    );
    if (duplicateErrors.length > 0) {
      errors.push(
        `Phát hiện đề xuất trùng (cùng năm và cùng danh hiệu):\n${duplicateErrors.join('\n')}`
      );
      return { errors, payload: { data_danh_hieu: dataDanhHieu } };
    }

    const eligibilityErrors: string[] = [];
    for (const item of dataDanhHieu) {
      if (!item.personnel_id || !item.danh_hieu) continue;
      if (!DANH_HIEU_CA_NHAN_BANG_KHEN.has(item.danh_hieu)) continue;
      const eligibility = await profileService.checkAwardEligibility(
        item.personnel_id,
        ctx.nam,
        item.danh_hieu
      );
      if (!eligibility.eligible) {
        const hoTen = personnelMap.get(item.personnel_id)?.ho_ten || item.personnel_id;
        eligibilityErrors.push(`${hoTen}: ${eligibility.reason}`);
      }
    }
    if (eligibilityErrors.length > 0) {
      errors.push(`Một số quân nhân chưa đủ điều kiện:\n${eligibilityErrors.join('\n')}`);
    }

    return { errors, payload: { data_danh_hieu: dataDanhHieu } };
  }

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
    const danhHieuData = (editedData.data_danh_hieu ?? []) as ProposalDanhHieuItem[];
    const decisionMapping = ctx.mappings?.decisionMapping ?? {};
    const specialDecisionMapping = ctx.mappings?.specialDecisionMapping ?? {};
    const proposalYear = ctx.proposalYear;
    const ghiChu = ctx.ghiChu;

    for (const item of danhHieuData) {
      try {
        if (!item.personnel_id) {
          acc.errors.push('Thiếu thông tin quân nhân khi lưu danh hiệu.');
          continue;
        }
        const quanNhan = await prismaTx.quanNhan.findUnique({
          where: { id: item.personnel_id },
        });
        if (!quanNhan) {
          acc.errors.push(
            'Không tìm thấy thông tin quân nhân khi lưu danh hiệu. ' +
              'Quân nhân có thể đã bị xoá khỏi hệ thống — vui lòng tải lại đề xuất.'
          );
          continue;
        }

        const namNhan = proposalYear;
        const danhHieuDecision = item.danh_hieu ? decisionMapping[item.danh_hieu] || {} : {};
        const soQuyetDinhDanhHieu = item.so_quyet_dinh || danhHieuDecision.so_quyet_dinh || null;

        const isBkbqp = item.danh_hieu === DANH_HIEU_CA_NHAN_HANG_NAM.BKBQP;
        const isCstdtq = item.danh_hieu === DANH_HIEU_CA_NHAN_HANG_NAM.CSTDTQ;
        const isBkttcp = item.danh_hieu === DANH_HIEU_CA_NHAN_HANG_NAM.BKTTCP;

        const resolveChain = (
          isMatch: boolean,
          flagKey: keyof ProposalDanhHieuItem,
          qdKey: keyof ProposalDanhHieuItem,
          fileKey: keyof ProposalDanhHieuItem,
          mappingKey: string
        ) => {
          let nhan = (item[flagKey] as boolean | null | undefined) || isMatch;
          let soQD =
            (item[qdKey] as string | null | undefined) ||
            (isMatch ? item.so_quyet_dinh : null);
          let filePdf =
            (item[fileKey] as string | null | undefined) ||
            (isMatch ? (item.file_quyet_dinh as string | null | undefined) : null);
          if (soQD || filePdf) nhan = true;
          const mapping = specialDecisionMapping[mappingKey] || {};
          if (nhan) {
            soQD = soQD || mapping.so_quyet_dinh;
            filePdf = filePdf || mapping.file_pdf;
          }
          return { nhan, soQD, filePdf };
        };

        const bkbqp = resolveChain(
          isBkbqp,
          'nhan_bkbqp',
          'so_quyet_dinh_bkbqp',
          'file_quyet_dinh_bkbqp',
          'BKBQP'
        );
        const cstdtq = resolveChain(
          isCstdtq,
          'nhan_cstdtq',
          'so_quyet_dinh_cstdtq',
          'file_quyet_dinh_cstdtq',
          'CSTDTQ'
        );
        const bkttcp = resolveChain(
          isBkttcp,
          'nhan_bkttcp',
          'so_quyet_dinh_bkttcp',
          'file_quyet_dinh_bkttcp',
          'BKTTCP'
        );

        const data: Record<string, unknown> = {};
        data.cap_bac = item.cap_bac || null;
        data.chuc_vu = item.chuc_vu || null;
        const note = item.ghi_chu || ghiChu;

        if (
          item.danh_hieu === DANH_HIEU_CA_NHAN_HANG_NAM.CSTT ||
          item.danh_hieu === DANH_HIEU_CA_NHAN_HANG_NAM.CSTDCS
        ) {
          data.danh_hieu = item.danh_hieu;
          data.so_quyet_dinh = soQuyetDinhDanhHieu;
          if (note) data.ghi_chu = note;
        }
        if (bkbqp.nhan) {
          data.nhan_bkbqp = true;
          data.so_quyet_dinh_bkbqp = bkbqp.soQD;
          if (note) data.ghi_chu_bkbqp = note;
        }
        if (cstdtq.nhan) {
          data.nhan_cstdtq = true;
          data.so_quyet_dinh_cstdtq = cstdtq.soQD;
          if (note) data.ghi_chu_cstdtq = note;
        }
        if (bkttcp.nhan) {
          data.nhan_bkttcp = true;
          data.so_quyet_dinh_bkttcp = bkttcp.soQD;
          if (note) data.ghi_chu_bkttcp = note;
        }

        await prismaTx.danhHieuHangNam.upsert({
          where: { quan_nhan_id_nam: { quan_nhan_id: quanNhan.id, nam: namNhan } },
          update: { ...data },
          create: { quan_nhan_id: quanNhan.id, nam: namNhan, ...data },
        });

        acc.importedDanhHieu++;
        acc.affectedPersonnelIds.add(quanNhan.id);
      } catch (error) {
        console.error('[approveProposal] danh hieu error:', {
          personnel_id: item.personnel_id,
          error,
        });
        acc.errors.push('Có lỗi xảy ra khi lưu danh hiệu, vui lòng thử lại.');
      }
    }
  }

  buildSuccessMessage(acc: ImportAccumulator): string {
    return `Đã phê duyệt danh hiệu cá nhân hằng năm cho ${acc.affectedPersonnelIds.size} quân nhân`;
  }
}

export const caNhanHangNamStrategy = new CaNhanHangNamStrategy();
