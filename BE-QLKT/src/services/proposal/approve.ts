import { proposalRepository } from '../../repositories/proposal.repository';
import { quanNhanRepository } from '../../repositories/quanNhan.repository';
import {
  PROPOSAL_TYPES,
  requiresProposalMonth,
  type ProposalType,
} from '../../constants/proposalTypes.constants';
import profileService from '../profile.service';
import unitAnnualAwardService from '../unitAnnualAward.service';
import { NotFoundError, ValidationError } from '../../middlewares/errorHandler';
import { buildApproveSummaryMessage } from '../../helpers/award/awardSummaryMessage';
import { PROPOSAL_STATUS } from '../../constants/proposalStatus.constants';
import { writeSystemLog } from '../../helpers/systemLogHelper';
import type {
  ProposalDanhHieuItem,
  ProposalThanhTichItem,
  ProposalNienHanItem,
  ProposalCongHienItem,
} from '../../types/proposal';
import {
  runDuplicateChecks,
  runEligibilityChecks,
  runDecisionNumberChecks,
} from './approve/validation';
import { buildDecisionMappings, persistDecisionPdfs } from './approve/decisionMappings';
import { runImportTransaction } from './approve/import';
import { persistProposalAttachments, type AttachedFileInput } from './attachedFiles';
import type { Prisma } from '../../generated/prisma';
import type {
  AdminAccountId,
  DecisionInputMap,
  DecisionMappings,
  ImportAccumulator,
  LoadedProposal,
  ProposalContext,
  ProposalId,
  UploadedDecisionFile,
} from './approve/types';

/** Converts optional proposal JSON fields to an object array. */
function asJsonObjectArray<T = Record<string, unknown>>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

/**
 * Edited payload mapped to BangDeXuat JSON columns.
 * Elements are business JSON objects and are not strictly typed at DB level.
 */
export type EditedProposalPayload = {
  data_danh_hieu?: ProposalDanhHieuItem[] | null;
  data_thanh_tich?: ProposalThanhTichItem[] | null;
  data_nien_han?: ProposalNienHanItem[] | null;
  data_cong_hien?: ProposalCongHienItem[] | null;
};

/** Loads the proposal with all relations required by the approve pipeline. */
async function loadApproveProposal(proposalId: ProposalId) {
  return proposalRepository.findUniqueRaw({
    where: { id: proposalId },
    include: {
      CoQuanDonVi: true,
      DonViTrucThuoc: { include: { CoQuanDonVi: true } },
      NguoiDeXuat: {
        select: { id: true, username: true, role: true, QuanNhan: { select: { id: true, ho_ten: true } } },
      },
      NguoiDuyet: {
        select: { id: true, username: true, role: true, QuanNhan: { select: { id: true, ho_ten: true } } },
      },
    },
  });
}

/** Throws if the proposal is already approved. */
function validateApproveStatus(proposal: LoadedProposal): void {
  if (proposal.status === PROPOSAL_STATUS.APPROVED) {
    throw new ValidationError('Đề xuất này đã được phê duyệt trước đó');
  }
}

/** Throws if proposal type requires a month and the stored month is missing/invalid. */
function validateApproveMonth(proposal: LoadedProposal): void {
  if (
    requiresProposalMonth(proposal.loai_de_xuat as ProposalType) &&
    (proposal.thang == null || proposal.thang < 1 || proposal.thang > 12)
  ) {
    throw new ValidationError(
      'Đề xuất thiếu tháng. HCCSVV/HCQKQT/KNC bắt buộc có tháng (1-12) trước khi phê duyệt.'
    );
  }
}

/** Builds a personnel id -> ho_ten map for items referenced in the proposal payload. */
async function buildPersonnelHoTenMap(
  danhHieuData: ProposalDanhHieuItem[],
  nienHanData: ProposalNienHanItem[],
  thanhTichData: ProposalThanhTichItem[]
): Promise<Map<string, string>> {
  const allItemPersonnelIds = [
    ...(danhHieuData ?? []).map((i: { personnel_id?: string }) => i.personnel_id),
    ...(nienHanData ?? []).map((i: { personnel_id?: string }) => i.personnel_id),
    ...(thanhTichData ?? []).map((i: { personnel_id?: string }) => i.personnel_id),
  ].filter((id): id is string => Boolean(id));

  const personnelHoTenList =
    allItemPersonnelIds.length > 0
      ? await quanNhanRepository.findManyRaw({
          where: { id: { in: allItemPersonnelIds } },
          select: { id: true, ho_ten: true },
        })
      : [];
  return new Map(personnelHoTenList.map(p => [p.id, p.ho_ten]));
}

/**
 * Recalculates downstream profile state for personnel/units affected by approval.
 * @param proposal - Loaded proposal
 * @param acc - Import accumulator (read-only here)
 * @returns Recalculation success/failure counts
 */
async function recalculateAffectedProfiles(
  proposal: LoadedProposal,
  acc: ImportAccumulator
): Promise<{ success: number; errors: number }> {
  if (proposal.loai_de_xuat === PROPOSAL_TYPES.DON_VI_HANG_NAM) {
    const results = await Promise.allSettled(
      Array.from(acc.affectedUnitIds).map(donViId =>
        unitAnnualAwardService.recalculateAnnualUnit(donViId, proposal.nam)
      )
    );
    let success = 0;
    let errors = 0;
    results.forEach((r, idx) => {
      if (r.status === 'fulfilled') {
        success++;
      } else {
        errors++;
        const donViId = Array.from(acc.affectedUnitIds)[idx];
        console.error('ProposalApprove.recalculateAnnualUnit failed', { donViId, error: r.reason });
      }
    });
    return { success, errors };
  }

  const recalcOne = (personnelId: string): Promise<unknown> => {
    if (proposal.loai_de_xuat === PROPOSAL_TYPES.NIEN_HAN) {
      return profileService.recalculateTenureProfile(personnelId);
    }
    if (proposal.loai_de_xuat === PROPOSAL_TYPES.CONG_HIEN) {
      return profileService.recalculateContributionProfile(personnelId);
    }
    if (
      proposal.loai_de_xuat !== PROPOSAL_TYPES.HC_QKQT &&
      proposal.loai_de_xuat !== PROPOSAL_TYPES.KNC_VSNXD_QDNDVN
    ) {
      return profileService.recalculateAnnualProfile(personnelId);
    }
    return Promise.resolve();
  };

  const personnelIds = Array.from(acc.affectedPersonnelIds);
  const results = await Promise.allSettled(personnelIds.map(recalcOne));
  let success = 0;
  let errors = 0;
  results.forEach((r, idx) => {
    if (r.status === 'fulfilled') {
      success++;
    } else {
      errors++;
      console.error('ProposalApprove.recalculateProfile failed', {
        personnelId: personnelIds[idx],
        error: r.reason,
      });
    }
  });
  return { success, errors };
}

/** Logs aggregated import errors to the system log (best-effort, fire-and-forget). */
function logImportErrors(
  proposal: LoadedProposal,
  adminId: AdminAccountId,
  proposalId: ProposalId,
  errors: string[]
): void {
  if (errors.length === 0) return;
  void writeSystemLog({
    userId: adminId,
    action: 'ERROR',
    resource: 'proposals',
    resourceId: proposalId,
    description: `[Phê duyệt đề xuất] ${proposal.loai_de_xuat} năm ${proposal.nam}: ${errors.length} lỗi. Chi tiết: ${errors.join('; ')}`,
  });
}

/** Builds the success response payload returned by approveProposal. */
function buildApproveResponse(
  proposal: LoadedProposal,
  danhHieuData: ProposalDanhHieuItem[],
  thanhTichData: ProposalThanhTichItem[],
  nienHanData: ProposalNienHanItem[],
  congHienData: ProposalCongHienItem[],
  acc: ImportAccumulator,
  recalc: { success: number; errors: number }
) {
  const affectedPersonnelCount = acc.affectedPersonnelIds.size;
  const affectedUnitCount =
    proposal.loai_de_xuat === PROPOSAL_TYPES.DON_VI_HANG_NAM ? acc.affectedUnitIds.size : 0;

  const successMessage = buildApproveSummaryMessage({
    proposalType: proposal.loai_de_xuat,
    importedDanhHieu: acc.importedDanhHieu,
    importedThanhTich: acc.importedThanhTich,
    importedNienHan: acc.importedNienHan,
    errorCount: acc.errors.length,
    affectedPersonnelCount,
    affectedUnitCount,
  });

  return {
    message: successMessage,
    proposal: proposal,
    affectedPersonnelIds: Array.from(acc.affectedPersonnelIds),
    result: {
      don_vi: (proposal.DonViTrucThuoc || proposal.CoQuanDonVi)?.ten_don_vi || '-',
      nguoi_de_xuat: proposal.NguoiDeXuat.QuanNhan?.ho_ten || proposal.NguoiDeXuat.username,
      imported_danh_hieu: acc.importedDanhHieu,
      imported_thanh_tich: acc.importedThanhTich,
      imported_nien_han: acc.importedNienHan,
      total_danh_hieu: danhHieuData.length,
      total_thanh_tich: thanhTichData.length,
      total_nien_han: nienHanData.length,
      data_danh_hieu: danhHieuData,
      data_thanh_tich: thanhTichData,
      data_nien_han: nienHanData,
      data_cong_hien: congHienData,
      errors: acc.errors.length > 0 ? acc.errors : null,
      recalculated_profiles: recalc.success,
      recalculate_errors: recalc.errors,
    },
  };
}

/**
 * Approves a proposal and imports its data into the main tables.
 * @param proposalId - Proposal ID
 * @param editedData - Edited JSON arrays for proposal data fields
 * @param adminId - Approver account ID
 */
async function approveProposal(
  proposalId: ProposalId,
  editedData: EditedProposalPayload,
  adminId: AdminAccountId,
  decisions: DecisionInputMap = {},
  pdfFiles: Record<string, UploadedDecisionFile | undefined> = {},
  ghiChu: string | null = null,
  adminAttachedFiles: AttachedFileInput[] = []
) {
  // ═══════════════════════════════════════════════════════════════════════
  //  ORCHESTRATION 7 BƯỚC CỦA APPROVE FLOW
  // ═══════════════════════════════════════════════════════════════════════
  //  Đây là entry point chính khi Admin bấm "Phê duyệt". Hàm này KHÔNG
  //  chứa business logic — chỉ điều phối 7 bước theo thứ tự đảm bảo:
  //   ① Pre-flight checks fail SỚM (trước khi ghi DB).
  //   ② Persist files OUT-OF-TRANSACTION (vì write file không rollback).
  //   ③ Atomic transaction (import + update proposal status).
  //   ④ Recalc downstream profile (best-effort, không rollback nếu fail).
  //
  //  BƯỚC 1: Load proposal + validate status/month.
  //  BƯỚC 2: Parse editedData (Admin có thể sửa data trước khi duyệt).
  //  BƯỚC 3: 3 pre-flight checks — duplicate, eligibility, decision#.
  //  BƯỚC 4: Persist file (PDF quyết định + admin attachments).
  //  BƯỚC 5: Run transaction (import vào bảng đích + update bangDeXuat).
  //  BƯỚC 6: Recalc hồ sơ (Promise.allSettled — fail không ảnh hưởng).
  //  BƯỚC 7: Trả về response message + summary.
  // ═══════════════════════════════════════════════════════════════════════

  // BƯỚC 1: Load proposal kèm relations + validate.
  const proposal = await loadApproveProposal(proposalId);
  if (!proposal) throw new NotFoundError('Đề xuất');
  validateApproveStatus(proposal); // chặn re-approve
  validateApproveMonth(proposal);  // HCCSVV/HCQKQT/KNC bắt buộc có tháng

  // BƯỚC 2: Resolve data. Admin có thể edit data trên UI trước khi duyệt
  // (vd: sửa số quyết định, tháng nhận); những field undefined giữ nguyên
  // từ DB. Fallback `?? proposal.X` đảm bảo dùng version edit nếu có.
  const danhHieuData = asJsonObjectArray<ProposalDanhHieuItem>(
    editedData.data_danh_hieu ?? proposal.data_danh_hieu
  );
  const thanhTichData = asJsonObjectArray<ProposalThanhTichItem>(
    editedData.data_thanh_tich ?? proposal.data_thanh_tich
  );
  const nienHanData = asJsonObjectArray<ProposalNienHanItem>(
    editedData.data_nien_han ?? proposal.data_nien_han
  );
  const congHienData = asJsonObjectArray<ProposalCongHienItem>(
    editedData.data_cong_hien ?? proposal.data_cong_hien
  );

  // Batch query để build map { personnel_id → ho_ten } một lần — dùng cho
  // mọi error message bên dưới, tránh leak CUID cho user (xem AP-9).
  const personnelHoTenMap = await buildPersonnelHoTenMap(danhHieuData, nienHanData, thanhTichData);

  const ctx: ProposalContext = {
    proposal: proposal as LoadedProposal,
    proposalId,
    adminId,
    proposalYear: proposal.nam,
    proposalType: proposal.loai_de_xuat as ProposalType,
    refDate: new Date(proposal.nam, proposal.thang as number, 0),
    ghiChu,
    personnelHoTenMap,
  };

  // BƯỚC 3: 3 lớp validation, fail fast theo thứ tự:
  //   ① Duplicate — kiểm tra trùng đề xuất (đã có award/proposal cùng key).
  //      Throw `Phát hiện đề xuất trùng (...)`.
  //   ② Eligibility — kiểm tra đủ điều kiện business (chuỗi CSTDCS,
  //      thâm niên, NCKH, ...). Throw `Không đủ điều kiện (...)`.
  //   ③ Decision number — mỗi item phải có so_quyet_dinh hợp lệ.
  //      Throw `Thiếu số quyết định (...)`.
  //
  // Thứ tự quan trọng: duplicate trước vì rẻ nhất + UI fix dễ nhất; còn
  // eligibility cần query bảng phụ.
  await runDuplicateChecks(ctx, danhHieuData, nienHanData, thanhTichData);
  await runEligibilityChecks(ctx, danhHieuData, nienHanData, congHienData);
  runDecisionNumberChecks(ctx, danhHieuData, decisions);

  // BƯỚC 4: Persist file — OUT-OF-TRANSACTION!
  // Lý do: filesystem write KHÔNG được Prisma transaction rollback. Phải
  // chạy SAU validation (tránh ghi file rồi validate fail = orphan file)
  // nhưng TRƯỚC transaction (file path cần để build decision mapping).
  // Trade-off: nếu transaction bên dưới fail, file đã ghi sẽ orphan.
  // → CHẤP NHẬN vì orphan PDF không gây side-effect; cleanup job riêng.
  const pdfPaths = await persistDecisionPdfs(decisions, pdfFiles);
  const { decisionMapping, specialDecisionMapping } = buildDecisionMappings(decisions, pdfPaths);
  const mappings: DecisionMappings = { decisionMapping, specialDecisionMapping, pdfPaths };

  // File đính kèm của Admin (tùy chọn) — ghi xuống disk + metadata.
  const adminFilesInfo = await persistProposalAttachments(adminAttachedFiles);

  const updateData: Record<string, unknown> = {
    status: PROPOSAL_STATUS.APPROVED,
    nguoi_duyet_id: adminId,
    ngay_duyet: new Date(),
    data_danh_hieu: danhHieuData,
    data_thanh_tich: thanhTichData,
    data_nien_han: nienHanData,
    data_cong_hien: congHienData,
    ...(ghiChu ? { ghi_chu: ghiChu } : {}),
    ...(adminFilesInfo.length > 0
      ? { files_attached_admin: adminFilesInfo as unknown as Prisma.InputJsonValue }
      : {}),
  };

  // ACCUMULATOR — gom kết quả import từ transaction về 1 chỗ.
  // Pattern: thay vì return từng item, transaction mutate `acc` trong loop.
  // Sau transaction, ta đọc `acc.errors`, `acc.imported*`, `acc.affectedIds`
  // để build response + log + recalc downstream.
  //
  // Set<string> dùng cho affectedIds để dedupe — vì 1 item có thể trigger
  // recalc cho cùng 1 quân nhân nhiều lần (vd: cả CSTDCS + BKBQP flag).
  const acc: ImportAccumulator = {
    importedDanhHieu: 0,
    importedThanhTich: 0,
    importedNienHan: 0,
    errors: [],
    affectedPersonnelIds: new Set<string>(),
    affectedUnitIds: new Set<string>(),
  };

  // BƯỚC 5: Atomic import — Prisma transaction wrap toàn bộ insert + update.
  // Bên trong sẽ dispatch sang strategy của loại đề xuất tương ứng và gọi
  // strategy.importInTransaction(tx, ...). Nếu BẤT KỲ item nào lỗi nghiêm
  // trọng → throw ValidationError → rollback toàn bộ.
  await runImportTransaction(
    ctx,
    danhHieuData,
    thanhTichData,
    nienHanData,
    congHienData,
    decisions,
    mappings,
    pdfPaths,
    updateData,
    acc
  );

  // BƯỚC 6: Recalc hồ sơ cá nhân/đơn vị bị ảnh hưởng.
  // Promise.allSettled = best-effort: nếu recalc fail cho 1 personnel,
  // vẫn tiếp tục cho các personnel khác. Lý do: approve đã commit thành
  // công, recalc chỉ là cập nhật field derived (chuỗi liên tục, gợi ý).
  // Fail recalc không nên rollback approve — chỉ log để cron retry.
  const recalc = await recalculateAffectedProfiles(proposal as LoadedProposal, acc);

  // Log các lỗi non-fatal từ transaction (best-effort, không throw).
  logImportErrors(proposal as LoadedProposal, adminId, proposalId, acc.errors);
  return buildApproveResponse(
    proposal as LoadedProposal,
    danhHieuData,
    thanhTichData,
    nienHanData,
    congHienData,
    acc,
    recalc
  );
}

/**
 * Rejects a proposal with a reason.
 * @param proposalId - `bang_de_xuat.id`
 * @param lyDo - Rejection reason
 * @param adminId - Admin account id (`tai_khoan.id`)
 */
async function rejectProposal(proposalId: ProposalId, lyDo: string, adminId: AdminAccountId) {
  const proposal = await proposalRepository.findUniqueRaw({
    where: { id: proposalId },
    include: {
      CoQuanDonVi: true,
      DonViTrucThuoc: { include: { CoQuanDonVi: true } },
      NguoiDeXuat: {
        select: { id: true, username: true, role: true, QuanNhan: { select: { id: true, ho_ten: true } } },
      },
    },
  });

  if (!proposal) throw new NotFoundError('Đề xuất');
  if (proposal.status === PROPOSAL_STATUS.APPROVED) {
    throw new ValidationError('Không thể từ chối đề xuất đã được phê duyệt');
  }
  if (proposal.status === PROPOSAL_STATUS.REJECTED) {
    throw new ValidationError('Đề xuất này đã bị từ chối trước đó');
  }

  // ─── RACE-AWARE: optimistic locking khi REJECT ───────────────────
  // Tương tự approve flow — dùng updateMany với compound where
  // (id + status=PENDING) thay vì update({where:{id}}). Lý do:
  //   - 2 admin cùng bấm Approve + Reject 1 proposal đồng thời:
  //       Admin A: SELECT status=PENDING → APPROVE thành công.
  //       Admin B: SELECT status=PENDING → REJECT chạy đây.
  //       Sau approve, status=APPROVED → updateMany count=0 → reject này
  //       throw "đã bị thay đổi", không ghi đè trạng thái APPROVED.
  //   - Đảm bảo BC business: 1 proposal chỉ có 1 trạng thái cuối cùng,
  //     không bị "vừa duyệt vừa từ chối".
  const updateResult = await proposalRepository.updateMany(
    { id: proposalId, status: PROPOSAL_STATUS.PENDING },
    {
      status: PROPOSAL_STATUS.REJECTED,
      nguoi_duyet_id: adminId,
      ngay_duyet: new Date(),
      rejection_reason: lyDo,
    }
  );

  if (updateResult.count === 0) {
    throw new ValidationError(
      'Đề xuất đã bị thay đổi bởi người khác. Vui lòng tải lại trang và thử lại.'
    );
  }

  return {
    message: 'Từ chối đề xuất thành công',
    proposal: proposal,
    result: {
      don_vi: (proposal.DonViTrucThuoc || proposal.CoQuanDonVi)?.ten_don_vi || '-',
      nguoi_de_xuat: proposal.NguoiDeXuat.QuanNhan?.ho_ten || proposal.NguoiDeXuat.username,
      ly_do: lyDo,
    },
  };
}

export { approveProposal, rejectProposal };
