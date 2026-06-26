import { PROPOSAL_TYPES } from '../../../constants/proposalTypes.constants';
import { DANH_HIEU_DAC_BIET, getDanhHieuName } from '../../../constants/danhHieu.constants';
import {
  batchEvaluateServiceYears,
  buildServiceYearsErrorMessage,
} from '../../eligibility/serviceYearsEligibility';
import { importSingleMedal } from './singleMedalImporter';
import { commemorativeMedalRepository } from '../../../repositories/commemorativeMedal.repository';
import type { Prisma } from '../../../generated/prisma';
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
  loadPersonnelWithUnitsMap,
  buildNienHanPayloadItem,
  type NienHanInputItem,
} from './nienHanPayloadHelper';

const KNC_LABEL = getDanhHieuName(PROPOSAL_TYPES.KNC_VSNXD_QDNDVN);

/*
 * ════════════════════════════════════════════════════════════════════════════
 *  KNC STRATEGY — Kỷ niệm chương Vì Sự nghiệp Xây dựng QĐNDVN
 * ════════════════════════════════════════════════════════════════════════════
 *
 *  ĐIỀU KIỆN nhận:
 *    - Nam: ≥ 25 năm phục vụ.
 *    - Nữ: ≥ 20 năm phục vụ.
 *  → Khác HC_QKQT ở 1 điểm DUY NHẤT: ưu đãi 5 năm cho nữ giới.
 *
 *  TÍNH CHẤT:
 *    - LIFETIME — quân nhân chỉ nhận 1 lần (bảng kyNiemChuongVSNXDQDNDVN
 *      có unique index trên quan_nhan_id).
 *    - Duplicate check ở approve sẽ block nếu đã có record.
 *
 *  FLOW:
 *    Submit:   batchEvaluateServiceYears → check 25/20 năm theo gender →
 *              build payload data_nien_han với so_thang_phuc_vu.
 *    Approve:  reuse `singleMedalImporter` (template method) với
 *              decisionKey='KNC_VSNXD_QDNDVN' và callback upsert vào bảng
 *              kyNiemChuongVSNXDQDNDVN.
 *
 *  VÌ SAO DÙNG `data_nien_han` (KHÔNG phải `data_danh_hieu`):
 *  KNC + HC_QKQT + HCCSVV chia sẻ field này vì cùng cấu trúc dữ liệu
 *  (1 row = 1 personnel + 1 huân chương + năm/tháng nhận). Tiết kiệm
 *  cột DB và logic shared (xem `nienHanPayloadHelper`).
 * ════════════════════════════════════════════════════════════════════════════
 */
class KncStrategy implements ProposalStrategy {
  // `type` = khóa định danh strategy; REGISTRY (index.ts) tra theo key này để dispatch.
  readonly type = PROPOSAL_TYPES.KNC_VSNXD_QDNDVN;

  // buildSubmitPayload: chạy lúc Manager NỘP đề xuất — validate + dựng payload, CHƯA ghi DB.
  // Trả về { errors, payload }: errors rỗng nghĩa là đủ điều kiện cho phép nộp.
  async buildSubmitPayload(
    titleData: unknown[],
    ctx: ProposalSubmitContext
  ): Promise<SubmitValidationResult> {
    const items = (titleData ?? []) as NienHanInputItem[];
    const personnelIds = items.map(i => i.personnel_id).filter((id): id is string => Boolean(id));
    // Batch load quân nhân + đơn vị 1 lần (Map tra theo id) để tránh N+1 query trong vòng map.
    const personnelMap = await loadPersonnelWithUnitsMap(personnelIds);

    // Mỗi dòng input → 1 item payload: gắn snapshot cấp bậc/chức vụ + năm/tháng nhận.
    const dataNienHan = items.map(item =>
      buildNienHanPayloadItem(
        item,
        item.personnel_id ? personnelMap.get(item.personnel_id) : undefined,
        ctx.nam,
        ctx.thang
      )
    );

    const errors: string[] = [];
    // Loại đề xuất KNC chỉ nhận đúng danh hiệu KNC_VSNXD_QDNDVN — lọc ra dòng lẫn loại khác.
    const danhHieus = dataNienHan.map(i => i.danh_hieu).filter(Boolean) as string[];
    const invalidDanhHieus = danhHieus.filter(dh => dh !== PROPOSAL_TYPES.KNC_VSNXD_QDNDVN);
    if (invalidDanhHieus.length > 0) {
      errors.push(
        `Loại đề xuất "${KNC_LABEL}" chỉ cho phép danh hiệu KNC_VSNXD_QDNDVN. ` +
          `Các danh hiệu không hợp lệ: ${invalidDanhHieus.join(', ')}.`
      );
      return { errors, payload: { data_nien_han: dataNienHan } }; // dừng sớm khi sai danh hiệu
    }

    const evalIds = dataNienHan.map(i => i.personnel_id).filter((id): id is string => Boolean(id));
    if (evalIds.length > 0) {
      // Kiểm tra số năm phục vụ (nam >= 25 / nữ >= 20) theo lô; gom lỗi từng người thành 1 message.
      const results = await batchEvaluateServiceYears(
        evalIds,
        PROPOSAL_TYPES.KNC_VSNXD_QDNDVN,
        new Date()
      );
      const lines = results
        .map(r => buildServiceYearsErrorMessage(r, PROPOSAL_TYPES.KNC_VSNXD_QDNDVN))
        .filter((m): m is string => m !== null);
      if (lines.length > 0) {
        errors.push(
          `Một số quân nhân chưa đủ điều kiện để đề xuất ${KNC_LABEL}:\n${lines.join('\n')}`
        );
      }
    }

    return { errors, payload: { data_nien_han: dataNienHan } }; // errors rỗng = đủ điều kiện nộp
  }

  /** See HcQkqtStrategy — approve flow lives in approve.ts pipeline. */
  // importInTransaction: chạy lúc Admin DUYỆT — ghi danh hiệu vào DB (trong transaction của approve).
  // `acc` gom kết quả (số quân nhân ảnh hưởng) để approve.ts build message tổng.
  async importInTransaction(
    editedData: EditedProposalData,
    ctx: ProposalApproveContext,
    _decisions: Record<string, string | null | undefined>,
    _pdfPaths: Record<string, string | null | undefined>,
    acc: ImportAccumulator,
    prismaTx: PrismaTx
  ): Promise<void> {
    const nienHanData = (editedData.data_nien_han ?? []) as ProposalNienHanItem[];
    // Tái dùng importSingleMedal (template method): khung xử lý giống mọi huân chương đơn,
    // chỉ khác callback `upsert` ghi vào bảng KNC riêng.
    await importSingleMedal(nienHanData, ctx, acc, prismaTx, {
      medalLabel: KNC_LABEL,
      logTag: 'KNC',
      decisionKey: DANH_HIEU_DAC_BIET.KNC_VSNXD_QDNDVN,
      upsert: async (tx, personnelId, writeData) => {
        const data = writeData as unknown as Prisma.KyNiemChuongVSNXDQDNDVNUncheckedUpdateInput;
        // Lifetime award → đã có thì update, chưa có thì tạo mới (mỗi quân nhân tối đa 1 KNC).
        const existing = await commemorativeMedalRepository.findUniqueRaw(
          { where: { quan_nhan_id: personnelId } },
          tx
        );
        if (existing) {
          await commemorativeMedalRepository.update(existing.id, data, tx);
        } else {
          await commemorativeMedalRepository.create(
            {
              ...data,
              quan_nhan_id: personnelId,
            } as Prisma.KyNiemChuongVSNXDQDNDVNUncheckedCreateInput,
            tx
          );
        }
      },
    });
  }

}

export const kncStrategy = new KncStrategy();
