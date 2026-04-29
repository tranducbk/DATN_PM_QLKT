import { danhHieuDonViHangNamRepository } from '../../repositories/danhHieu.repository';
import { quanNhanRepository } from '../../repositories/quanNhan.repository';
import { proposalRepository } from '../../repositories/proposal.repository';
import { writeSystemLog } from '../../helpers/systemLogHelper';
import {
  getDanhHieuName,
  DANH_HIEU_CA_NHAN_HANG_NAM,
  DANH_HIEU_DON_VI_CO_BAN,
  DANH_HIEU_DON_VI_BANG_KHEN,
  LOAI_DE_XUAT_MAP,
} from '../../constants/danhHieu.constants';
import { PROPOSAL_TYPES, type ProposalType } from '../../constants/proposalTypes.constants';
import { PROPOSAL_STATUS } from '../../constants/proposalStatus.constants';
import { ValidationError } from '../../middlewares/errorHandler';
import {
  getProposalDataField,
  isOneTimeProposalType,
} from '../proposal/proposalTypeConfig';
import {
  AWARD_TABLE_QUERIES,
  DUPLICATE_STRATEGY,
  SERVICE_YEAR_CHECKS,
} from './dispatchTables';
import type { TitleDataItem } from './types';

function getAwardTableQuery(type: string, personnelIds: string[], nam: number) {
  const queryFn = AWARD_TABLE_QUERIES[type as ProposalType];
  return queryFn ? queryFn(personnelIds, nam) : Promise.resolve([]);
}

/**
 * Detects duplicate personnel awards across the existing award table and pending proposals.
 * @param type - Proposal type code
 * @param nam - Award year
 * @param titleData - Items being submitted
 * @returns Array of human-readable duplicate-error messages
 */
export async function checkDuplicateAwards(
  type: string,
  nam: number,
  titleData: TitleDataItem[]
): Promise<string[]> {
  const duplicateErrors: string[] = [];
  if (!titleData || titleData.length === 0) return duplicateErrors;

  const items = titleData.filter(item => item.personnel_id && item.danh_hieu);
  const personnelIds = [...new Set(items.map(item => item.personnel_id))];
  if (personnelIds.length === 0) return duplicateErrors;

  // Just query PENDING proposals — APPROVED awards are already in the award table
  const [personnelList, pendingProposals, existingAwardsRaw] = await Promise.all([
    quanNhanRepository.findManyRaw({
      where: { id: { in: personnelIds } },
      select: { id: true, ho_ten: true },
    }),
    proposalRepository.findManyRaw({
      where: { loai_de_xuat: type, nam, status: PROPOSAL_STATUS.PENDING },
    }),
    getAwardTableQuery(type, personnelIds, nam),
  ]);

  const personnelMap = new Map(personnelList.map(p => [p.id, p.ho_ten]));
  const existingAwards = existingAwardsRaw as Array<Record<string, unknown>>;
  const existingSet = new Set(existingAwards.map(a => `${a.quan_nhan_id}_${a.danh_hieu || ''}`));
  const existingByPersonnel = new Set(existingAwards.map(a => a.quan_nhan_id as string));

  const dataField = getProposalDataField(type);
  const pendingKeys = new Set<string>();
  const pendingByPersonnel = new Set<string>();
  for (const p of pendingProposals) {
    const data = ((p as Record<string, unknown>)[dataField] as Array<Record<string, unknown>>) || [];
    for (const d of data) {
      if (d.personnel_id) {
        pendingKeys.add(`${d.personnel_id}_${d.danh_hieu || ''}`);
        pendingByPersonnel.add(String(d.personnel_id));
      }
    }
  }

  const isOneTime = isOneTimeProposalType(type);
  const strategy = DUPLICATE_STRATEGY[type as ProposalType];

  for (const item of items) {
    const hoTen = personnelMap.get(item.personnel_id) || item.personnel_id;
    const key = `${item.personnel_id}_${item.danh_hieu}`;

    if (strategy) {
      const isDup =
        strategy.mode === 'pair'
          ? existingSet.has(key)
          : existingByPersonnel.has(item.personnel_id);
      if (isDup) {
        duplicateErrors.push(`${hoTen}: ${strategy.buildLabel(item.danh_hieu, nam)}`);
        continue;
      }
    }

    if (isOneTime ? pendingByPersonnel.has(item.personnel_id) : pendingKeys.has(key)) {
      duplicateErrors.push(`${hoTen}: đang có đề xuất chờ duyệt`);
    }
  }

  return duplicateErrors;
}

/**
 * Detects duplicate unit awards across the existing unit-award table and pending proposals.
 * @param nam - Award year
 * @param titleData - Items being submitted
 * @returns Array of human-readable duplicate-error messages
 */
export async function checkDuplicateUnitAwards(
  nam: number,
  titleData: TitleDataItem[]
): Promise<string[]> {
  const duplicateErrors: string[] = [];
  if (!titleData || titleData.length === 0) return duplicateErrors;

  const items = titleData.filter(item => item.don_vi_id && item.danh_hieu);
  const unitIds = [...new Set(items.map(item => item.don_vi_id!))];
  if (unitIds.length === 0) return duplicateErrors;

  const [existingAwards, pendingProposals] = await Promise.all([
    danhHieuDonViHangNamRepository.findMany({
      where: {
        OR: [
          { co_quan_don_vi_id: { in: unitIds }, nam },
          { don_vi_truc_thuoc_id: { in: unitIds }, nam },
        ],
      },
      select: { co_quan_don_vi_id: true, don_vi_truc_thuoc_id: true, danh_hieu: true, nhan_bkbqp: true, nhan_bkttcp: true },
    }),
    proposalRepository.findManyRaw({
      where: { loai_de_xuat: PROPOSAL_TYPES.DON_VI_HANG_NAM, nam, status: PROPOSAL_STATUS.PENDING },
    }),
  ]);

  const awardMap = new Map<string, typeof existingAwards[number]>();
  for (const a of existingAwards) {
    if (a.co_quan_don_vi_id) awardMap.set(a.co_quan_don_vi_id, a);
    if (a.don_vi_truc_thuoc_id) awardMap.set(a.don_vi_truc_thuoc_id, a);
  }

  const pendingKeys = new Set<string>();
  for (const p of pendingProposals) {
    const data = ((p as Record<string, unknown>).data_danh_hieu as Array<Record<string, unknown>>) || [];
    for (const d of data) {
      if (d.don_vi_id && d.danh_hieu) pendingKeys.add(`${d.don_vi_id}_${d.danh_hieu}`);
    }
  }

  for (const item of items) {
    const donViId = item.don_vi_id!;
    const danhHieu = item.danh_hieu;

    if (pendingKeys.has(`${donViId}_${danhHieu}`)) {
      duplicateErrors.push(`Đơn vị đã có đề xuất ${getDanhHieuName(danhHieu)} cho năm ${nam}`);
      continue;
    }

    const existing = awardMap.get(donViId);
    if (existing) {
      const isDv = DANH_HIEU_DON_VI_CO_BAN.has(danhHieu);
      const isBk = DANH_HIEU_DON_VI_BANG_KHEN.has(danhHieu);

      if (isDv && existing.danh_hieu) {
        duplicateErrors.push(
          existing.danh_hieu === danhHieu
            ? `Đơn vị đã có danh hiệu ${getDanhHieuName(danhHieu)} năm ${nam}`
            : `Đơn vị đã có ${getDanhHieuName(existing.danh_hieu)} năm ${nam}, không thể thêm ${getDanhHieuName(danhHieu)}`
        );
        continue;
      }
      if (isBk) {
        if (danhHieu === DANH_HIEU_CA_NHAN_HANG_NAM.BKBQP && existing.nhan_bkbqp) {
          duplicateErrors.push(`Đơn vị đã có ${getDanhHieuName(danhHieu)} năm ${nam}`);
          continue;
        }
        if (danhHieu === DANH_HIEU_CA_NHAN_HANG_NAM.BKTTCP && existing.nhan_bkttcp) {
          duplicateErrors.push(`Đơn vị đã có ${getDanhHieuName(danhHieu)} năm ${nam}`);
          continue;
        }
      }
      if (isDv && (existing.nhan_bkbqp || existing.nhan_bkttcp)) {
        duplicateErrors.push(`Đơn vị đã có BK năm ${nam}, không thể thêm ${getDanhHieuName(danhHieu)}`);
        continue;
      }
      if (isBk && existing.danh_hieu && DANH_HIEU_DON_VI_CO_BAN.has(existing.danh_hieu)) {
        duplicateErrors.push(`Đơn vị đã có ${getDanhHieuName(existing.danh_hieu)} năm ${nam}, không thể thêm ${getDanhHieuName(danhHieu)}`);
        continue;
      }
    }
  }

  return duplicateErrors;
}

/**
 * Runs the personnel-condition (service-years) check registered for the given proposal type.
 * @param type - Proposal type code
 * @param selectedPersonnel - Personnel ids being submitted
 * @returns Array of validation-error messages (empty when no check is registered)
 */
export async function validatePersonnelConditions(
  type: string,
  selectedPersonnel: string[]
): Promise<string[]> {
  if (!selectedPersonnel || selectedPersonnel.length === 0) return [];
  const checkFn = SERVICE_YEAR_CHECKS[type as ProposalType];
  return checkFn ? checkFn(selectedPersonnel) : [];
}

/**
 * Logs a bulk-award validation failure and throws a ValidationError carrying the messages.
 * @param errors - Validation messages collected so far
 * @param type - Proposal type code
 * @param nam - Award year
 * @param adminId - Admin user id (for the system log entry)
 * @throws ValidationError - Always throws; never returns
 */
export function throwValidationErrors(
  errors: string[],
  type: string,
  nam: number,
  adminId?: string
): never {
  void writeSystemLog({
    userId: adminId,
    action: 'ERROR',
    resource: 'awards',
    description: `[Thêm khen thưởng đồng loạt] ${LOAI_DE_XUAT_MAP[type as keyof typeof LOAI_DE_XUAT_MAP] || type} năm ${nam} — Validation thất bại: ${errors.join('; ')}`,
  });
  throw new ValidationError(`Phát hiện lỗi validation:\n${errors.join('\n')}`);
}
