import { quanNhanRepository } from '../../../repositories/quanNhan.repository';
import { scientificAchievementRepository } from '../../../repositories/scientificAchievement.repository';
import { PROPOSAL_TYPES } from '../../../constants/proposalTypes.constants';
import { PROPOSAL_STATUS } from '../../../constants/proposalStatus.constants';
import { resolveNckhCode } from '../../../constants/danhHieu.constants';

/*
 * ════════════════════════════════════════════════════════════════════════════
 *  NCKH STRATEGY — Nghiên cứu Khoa học (Thành tích khoa học hàng năm)
 * ════════════════════════════════════════════════════════════════════════════
 *
 *  KHÁC BIỆT BẢN CHẤT vs các loại khen thưởng khác:
 *  NCKH KHÔNG phải "khen thưởng" mà là "thành tích" được ghi nhận hàng
 *  năm để PHỤC VỤ điều kiện chuỗi danh hiệu (BKBQP/CSTDTQ/BKTTCP cá
 *  nhân cần "NCKH liên tục mỗi năm trong chuỗi CSTDCS").
 *
 *  KEY DUPLICATE UNIQUE TUPLE: (personnel_id, nam, mo_ta)
 *  - 1 quân nhân có thể có NHIỀU thành tích cùng năm (vd: 2 đề tài).
 *  - Nhưng 2 thành tích cùng nội dung mô tả thì coi là trùng → reject.
 *  - Vì vậy duplicate check ở approve dùng key composite này (xem
 *    `collectNckhDuplicates` trong approve/validation.ts).
 *
 *  STORAGE: bảng ThanhTichKhoaHoc (KHÔNG phải DanhHieuHangNam).
 *  - Mỗi record = 1 thành tích cụ thể (đề tài, sáng kiến, công bố).
 *  - `loai` = phân loại (vd: 'DE_TAI_CAP_BO', 'SANG_KIEN_DON_VI', ...).
 *  - `mo_ta` = nội dung tự do.
 *
 *  FE PAYLOAD: dùng `data_thanh_tich` (riêng, không chia sẻ).
 *
 *  TÍNH CHẤT KHÔNG CHUỖI:
 *  - Mỗi năm = 1 đề xuất NCKH riêng (không phải chuỗi).
 *  - KHÔNG có upgrade rule như HCCSVV, KHÔNG có lifetime như HCQKQT.
 *  - Có thể nhận lặp lại không giới hạn miễn không trùng mô tả/năm.
 *
 *  ALWAYS-RUN trong approve transaction:
 *  Khác các strategy khác (chỉ chạy khi loai_de_xuat match), NCKH
 *  importInTransaction CHẠY LUÔN nếu `data_thanh_tich` có data — kể cả
 *  proposal type chính là CA_NHAN_HANG_NAM (vì NCKH có thể đi kèm).
 *  Xem `runImportTransaction` line ~145.
 * ════════════════════════════════════════════════════════════════════════════
 */
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
  DonViTrucThuoc: {
    id: string;
    ten_don_vi: string;
    ma_don_vi: string;
    CoQuanDonVi: { id: string; ten_don_vi: string; ma_don_vi: string } | null;
  } | null;
}

async function loadPersonnelMap(personnelIds: string[]): Promise<Map<string, NckhPersonnelRow>> {
  if (personnelIds.length === 0) return new Map();
  const rows = await quanNhanRepository.findManyRaw({
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
    const personnelIds = items.map(i => i.personnel_id).filter((id): id is string => Boolean(id));
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
        const personnel = await quanNhanRepository.findUniqueRaw(
          { where: { id: item.personnel_id }, select: { id: true, ho_ten: true } },
          prismaTx
        );
        if (!personnel) {
          acc.errors.push(
            'Không tìm thấy thông tin quân nhân khi lưu thành tích khoa học. ' +
              'Quân nhân có thể đã bị xoá khỏi hệ thống — vui lòng tải lại đề xuất.'
          );
          continue;
        }
        const hoTen = personnel.ho_ten || 'một quân nhân';
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
        await scientificAchievementRepository.create(
          {
            quan_nhan_id: personnel.id,
            nam: parseInt(String(item.nam), 10),
            loai: loaiCode,
            mo_ta: item.mo_ta.trim(),
            chuc_vu: item.chuc_vu || null,
            cap_bac: item.cap_bac || null,
            ghi_chu: item.ghi_chu || null,
            so_quyet_dinh: item.so_quyet_dinh || null,
          },
          prismaTx
        );
        acc.importedThanhTich++;
        acc.affectedPersonnelIds.add(personnel.id);
      } catch (error) {
        console.error('[approveProposal] NCKH error:', {
          personnel_id: item.personnel_id,
          error,
        });
        acc.errors.push('Có lỗi xảy ra khi lưu thành tích khoa học, vui lòng thử lại.');
      }
    }
  }

}

export const nckhStrategy = new NckhStrategy();
