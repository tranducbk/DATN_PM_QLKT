import { prisma } from '../../../models';
import { PROPOSAL_TYPES } from '../../../constants/proposalTypes.constants';
import { PROPOSAL_STATUS } from '../../../constants/proposalStatus.constants';
import { resolveNckhCode } from '../../../constants/danhHieu.constants';
import type { EditedProposalData } from '../../../types/proposal';
import type {
  ProposalStrategy,
  ProposalSubmitContext,
  ProposalApproveContext,
  ImportAccumulator,
  PrismaTx,
  SubmitValidationResult,
} from './proposalStrategy';

interface NckhInputItem {
  personnel_id?: string;
  loai?: string;
  mo_ta?: string;
  status?: string;
  so_quyet_dinh?: string | null;
  file_quyet_dinh?: string | null;
  cap_bac?: string | null;
  chuc_vu?: string | null;
}

interface NckhPersonnelRow {
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

async function loadPersonnelMap(personnelIds: string[]): Promise<Map<string, NckhPersonnelRow>> {
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
  return new Map(rows.map(r => [r.id, r as NckhPersonnelRow]));
}

class NckhStrategy implements ProposalStrategy {
  readonly type = PROPOSAL_TYPES.NCKH;

  async buildSubmitPayload(
    titleData: unknown[],
    ctx: ProposalSubmitContext
  ): Promise<SubmitValidationResult> {
    const items = (titleData ?? []) as NckhInputItem[];
    const personnelIds = items
      .map(i => i.personnel_id)
      .filter((id): id is string => Boolean(id));
    const personnelMap = await loadPersonnelMap(personnelIds);

    const dataThanhTich = items.map(item => {
      const personnel = item.personnel_id ? personnelMap.get(item.personnel_id) : undefined;
      return {
        personnel_id: item.personnel_id,
        ho_ten: personnel?.ho_ten || '',
        nam: ctx.nam,
        loai: item.loai,
        mo_ta: item.mo_ta,
        status: item.status || PROPOSAL_STATUS.PENDING,
        so_quyet_dinh: item.so_quyet_dinh || null,
        file_quyet_dinh: item.file_quyet_dinh || null,
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
    });

    return { errors: [], payload: { data_thanh_tich: dataThanhTich } };
  }

  async validateApprove(
    editedData: EditedProposalData,
    ctx: ProposalApproveContext
  ): Promise<string[]> {
    const thanhTichData = (editedData.data_thanh_tich ?? []) as Array<{
      personnel_id?: string;
      nam?: number;
      mo_ta?: string;
    }>;
    const validItems = thanhTichData.filter(i => i.personnel_id && i.nam && i.mo_ta);
    if (validItems.length === 0) return [];

    const personnelIds = [...new Set(validItems.map(i => i.personnel_id as string))];
    const existing = await prisma.thanhTichKhoaHoc.findMany({
      where: { quan_nhan_id: { in: personnelIds } },
      select: { quan_nhan_id: true, nam: true, mo_ta: true },
    });
    const existingKeys = new Set(existing.map(r => `${r.quan_nhan_id}_${r.nam}_${r.mo_ta}`));

    const errors: string[] = [];
    for (const item of validItems) {
      const key = `${item.personnel_id}_${item.nam}_${item.mo_ta}`;
      if (existingKeys.has(key)) {
        const hoTen = ctx.personnelHoTenMap.get(item.personnel_id as string) || item.personnel_id;
        errors.push(`${hoTen}: Thành tích "${item.mo_ta}" năm ${item.nam} đã tồn tại`);
      }
    }
    return errors;
  }

  async importInTransaction(
    editedData: EditedProposalData,
    _ctx: ProposalApproveContext,
    _decisions: Record<string, string | null | undefined>,
    _pdfPaths: Record<string, string | null | undefined>,
    acc: ImportAccumulator,
    prismaTx: PrismaTx
  ): Promise<void> {
    const items = (editedData.data_thanh_tich ?? []) as Array<{
      personnel_id?: string;
      nam?: number | string;
      loai?: string;
      mo_ta?: string;
      chuc_vu?: string | null;
      cap_bac?: string | null;
      ghi_chu?: string | null;
      so_quyet_dinh?: string | null;
    }>;

    for (const item of items) {
      try {
        if (!item.personnel_id) {
          acc.errors.push('Thiếu thông tin quân nhân khi lưu thành tích khoa học.');
          continue;
        }
        const quanNhan = await prismaTx.quanNhan.findUnique({ where: { id: item.personnel_id } });
        if (!quanNhan) {
          acc.errors.push(
            'Không tìm thấy thông tin quân nhân khi lưu thành tích khoa học. ' +
              'Quân nhân có thể đã bị xoá khỏi hệ thống — vui lòng tải lại đề xuất.'
          );
          continue;
        }
        const hoTen = quanNhan.ho_ten || 'một quân nhân';
        if (!item.nam) {
          acc.errors.push(`Thành tích của ${hoTen} thiếu năm.`);
          continue;
        }
        const loaiCode = resolveNckhCode(item.loai);
        if (!item.loai || !loaiCode) {
          acc.errors.push(`Thành tích của ${hoTen} có loại không hợp lệ: ${item.loai}.`);
          continue;
        }
        if (!item.mo_ta || item.mo_ta.trim() === '') {
          acc.errors.push(`Thành tích của ${hoTen} thiếu mô tả.`);
          continue;
        }
        await prismaTx.thanhTichKhoaHoc.create({
          data: {
            quan_nhan_id: quanNhan.id,
            nam: parseInt(String(item.nam), 10),
            loai: loaiCode,
            mo_ta: item.mo_ta.trim(),
            chuc_vu: item.chuc_vu || null,
            cap_bac: item.cap_bac || null,
            ghi_chu: item.ghi_chu || null,
            so_quyet_dinh: item.so_quyet_dinh || null,
          },
        });
        acc.importedThanhTich++;
        acc.affectedPersonnelIds.add(quanNhan.id);
      } catch (error) {
        console.error('[approveProposal] NCKH error:', {
          personnel_id: item.personnel_id,
          error,
        });
        acc.errors.push('Có lỗi xảy ra khi lưu thành tích khoa học, vui lòng thử lại.');
      }
    }
  }

  buildSuccessMessage(acc: ImportAccumulator): string {
    return `Đã nhập ${acc.importedThanhTich} thành tích khoa học${
      acc.errors.length > 0 ? ` (${acc.errors.length} lỗi)` : ''
    }`;
  }
}

export const nckhStrategy = new NckhStrategy();
