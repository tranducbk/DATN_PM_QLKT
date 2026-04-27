import { prisma } from '../../models';
import { PROPOSAL_TYPES, type ProposalType } from '../../constants/proposalTypes.constants';
import { DANH_HIEU_MAP, getDanhHieuName } from '../../constants/danhHieu.constants';
import {
  batchEvaluateServiceYears,
  buildServiceYearsErrorMessage,
} from '../eligibility/serviceYearsEligibility';

type AwardTableQueryFn = (personnelIds: string[], nam: number) => Promise<Array<Record<string, unknown>>>;

/** Award table query per proposal type. Returns raw rows containing `quan_nhan_id` (and `danh_hieu` when relevant). */
export const AWARD_TABLE_QUERIES: Partial<Record<ProposalType, AwardTableQueryFn>> = {
  [PROPOSAL_TYPES.CA_NHAN_HANG_NAM]: (ids, nam) =>
    prisma.danhHieuHangNam.findMany({
      where: { quan_nhan_id: { in: ids }, nam },
      select: { quan_nhan_id: true, danh_hieu: true },
    }) as Promise<Array<Record<string, unknown>>>,
  [PROPOSAL_TYPES.NIEN_HAN]: ids =>
    prisma.khenThuongHCCSVV.findMany({
      where: { quan_nhan_id: { in: ids } },
      select: { quan_nhan_id: true, danh_hieu: true },
    }) as Promise<Array<Record<string, unknown>>>,
  [PROPOSAL_TYPES.HC_QKQT]: ids =>
    prisma.huanChuongQuanKyQuyetThang.findMany({
      where: { quan_nhan_id: { in: ids } },
      select: { quan_nhan_id: true },
    }) as Promise<Array<Record<string, unknown>>>,
  [PROPOSAL_TYPES.KNC_VSNXD_QDNDVN]: ids =>
    prisma.kyNiemChuongVSNXDQDNDVN.findMany({
      where: { quan_nhan_id: { in: ids } },
      select: { quan_nhan_id: true },
    }) as Promise<Array<Record<string, unknown>>>,
  [PROPOSAL_TYPES.CONG_HIEN]: ids =>
    prisma.khenThuongHCBVTQ.findMany({
      where: { quan_nhan_id: { in: ids } },
      select: { quan_nhan_id: true, danh_hieu: true },
    }) as Promise<Array<Record<string, unknown>>>,
};

/** Duplicate-check strategy per proposal type. */
export const DUPLICATE_STRATEGY: Partial<
  Record<
    ProposalType,
    {
      mode: 'pair' | 'personnel';
      buildLabel: (danhHieu: string, nam: number) => string;
    }
  >
> = {
  [PROPOSAL_TYPES.CA_NHAN_HANG_NAM]: {
    mode: 'pair',
    buildLabel: (danhHieu, nam) => `${getDanhHieuName(danhHieu)} năm ${nam} đã có trên hệ thống`,
  },
  [PROPOSAL_TYPES.NIEN_HAN]: {
    mode: 'pair',
    buildLabel: danhHieu => `đã có ${getDanhHieuName(danhHieu)} trên hệ thống`,
  },
  [PROPOSAL_TYPES.HC_QKQT]: {
    mode: 'personnel',
    buildLabel: () => `đã có ${DANH_HIEU_MAP.HC_QKQT} trên hệ thống`,
  },
  [PROPOSAL_TYPES.KNC_VSNXD_QDNDVN]: {
    mode: 'personnel',
    buildLabel: () => `đã có ${DANH_HIEU_MAP.KNC_VSNXD_QDNDVN} trên hệ thống`,
  },
  [PROPOSAL_TYPES.CONG_HIEN]: {
    mode: 'personnel',
    buildLabel: danhHieu => `đã có ${getDanhHieuName(danhHieu)} trên hệ thống`,
  },
};

type ServiceYearCheckFn = (personnelIds: string[]) => Promise<string[]>;

/** Personnel-condition checks keyed by proposal type. */
export const SERVICE_YEAR_CHECKS: Partial<Record<ProposalType, ServiceYearCheckFn>> = {
  [PROPOSAL_TYPES.HC_QKQT]: async personnelIds => {
    const results = await batchEvaluateServiceYears(personnelIds, 'HC_QKQT', new Date());
    return results
      .map(r => buildServiceYearsErrorMessage(r, 'HC_QKQT'))
      .filter((m): m is string => m !== null);
  },
  [PROPOSAL_TYPES.KNC_VSNXD_QDNDVN]: async personnelIds => {
    const results = await batchEvaluateServiceYears(personnelIds, 'KNC_VSNXD_QDNDVN', new Date());
    return results
      .map(r => buildServiceYearsErrorMessage(r, 'KNC_VSNXD_QDNDVN'))
      .filter((m): m is string => m !== null);
  },
  [PROPOSAL_TYPES.NIEN_HAN]: async personnelIds => {
    const errors: string[] = [];
    const personnelList = await prisma.quanNhan.findMany({
      where: { id: { in: personnelIds } },
      select: { id: true, ho_ten: true, ngay_nhap_ngu: true },
    });
    const map = new Map(personnelList.map(p => [p.id, p]));
    for (const id of personnelIds) {
      const qn = map.get(id);
      if (!qn) {
        errors.push(`${id}: Không tìm thấy quân nhân`);
        continue;
      }
      if (!qn.ngay_nhap_ngu) {
        errors.push(`${qn.ho_ten}: Chưa có thông tin ngày nhập ngũ`);
      }
    }
    return errors;
  },
};

/** Proposal types whose duplicate check operates on personnel (selectedPersonnel). */
export const TYPES_WITH_PERSONNEL_DUP: ProposalType[] = [
  PROPOSAL_TYPES.CA_NHAN_HANG_NAM,
  PROPOSAL_TYPES.NIEN_HAN,
  PROPOSAL_TYPES.HC_QKQT,
  PROPOSAL_TYPES.KNC_VSNXD_QDNDVN,
  PROPOSAL_TYPES.CONG_HIEN,
];
