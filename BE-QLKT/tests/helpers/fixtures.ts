/**
 * Pure factory helpers used across tests.
 *
 * Every factory accepts `Partial<T>` overrides and returns shapes compatible with
 * the corresponding Prisma model. Nullable fields default to `null` (never `undefined`)
 * so the resulting object matches what `findUnique`/`findMany` would resolve in production.
 */

import { ROLES, type Role } from '../../src/constants/roles.constants';
import { PROPOSAL_STATUS, type ProposalStatus } from '../../src/constants/proposalStatus.constants';
import { PROPOSAL_TYPES, type ProposalType } from '../../src/constants/proposalTypes.constants';
import {
  DANH_HIEU_CA_NHAN_HANG_NAM,
  DANH_HIEU_DON_VI_HANG_NAM,
} from '../../src/constants/danhHieu.constants';

export type UnitKind = 'CQDV' | 'DVTT';

let idCounter = 0;
const nextId = (prefix: string) => `${prefix}-${++idCounter}`;

export interface CoQuanDonViShape {
  id: string;
  ten_don_vi: string;
  ma_don_vi: string;
}

export interface DonViTrucThuocShape {
  id: string;
  ten_don_vi: string;
  ma_don_vi: string;
  co_quan_don_vi_id: string;
  CoQuanDonVi?: CoQuanDonViShape | null;
}

export interface UnitFixture {
  kind: UnitKind;
  id: string;
  ten_don_vi: string;
  ma_don_vi: string;
  parentId: string | null;
  CoQuanDonVi: CoQuanDonViShape | null;
  DonViTrucThuoc: DonViTrucThuocShape | null;
}

/** Creates a unit fixture with both CQDV and DVTT shapes derivable. */
export function makeUnit(
  overrides: Partial<{
    kind: UnitKind;
    id: string;
    ten_don_vi: string;
    ma_don_vi: string;
    parentId: string;
  }> = {}
): UnitFixture {
  const kind: UnitKind = overrides.kind ?? 'CQDV';
  const id = overrides.id ?? nextId(kind === 'CQDV' ? 'cqdv' : 'dvtt');
  const ten_don_vi = overrides.ten_don_vi ?? `Đơn vị ${id}`;
  const ma_don_vi = overrides.ma_don_vi ?? id.toUpperCase();

  if (kind === 'CQDV') {
    const cqdv: CoQuanDonViShape = { id, ten_don_vi, ma_don_vi };
    return {
      kind,
      id,
      ten_don_vi,
      ma_don_vi,
      parentId: null,
      CoQuanDonVi: cqdv,
      DonViTrucThuoc: null,
    };
  }

  const parentId = overrides.parentId ?? nextId('cqdv');
  const parentCqdv: CoQuanDonViShape = {
    id: parentId,
    ten_don_vi: `CQDV cha của ${id}`,
    ma_don_vi: parentId.toUpperCase(),
  };
  const dvtt: DonViTrucThuocShape = {
    id,
    ten_don_vi,
    ma_don_vi,
    co_quan_don_vi_id: parentId,
    CoQuanDonVi: parentCqdv,
  };
  return {
    kind,
    id,
    ten_don_vi,
    ma_don_vi,
    parentId,
    CoQuanDonVi: null,
    DonViTrucThuoc: dvtt,
  };
}

export interface PersonnelShape {
  id: string;
  ho_ten: string;
  cccd: string;
  ngay_sinh: Date | null;
  gioi_tinh: 'NAM' | 'NU' | null;
  ngay_nhap_ngu: Date | null;
  ngay_xuat_ngu: Date | null;
  cap_bac: string | null;
  chuc_vu_id: string | null;
  co_quan_don_vi_id: string | null;
  don_vi_truc_thuoc_id: string | null;
  CoQuanDonVi: CoQuanDonViShape | null;
  DonViTrucThuoc: DonViTrucThuocShape | null;
  ChucVu: { id: string; ten_chuc_vu: string } | null;
}

interface MakePersonnelInput {
  unitKind?: UnitKind;
  unitId?: string;
  unit?: UnitFixture;
  id?: string;
  ho_ten?: string;
  cccd?: string;
  ngay_sinh?: Date | null;
  gioi_tinh?: 'NAM' | 'NU' | null;
  ngay_nhap_ngu?: Date | null;
  ngay_xuat_ngu?: Date | null;
  cap_bac?: string | null;
  chuc_vu?: { id: string; ten_chuc_vu: string } | null;
}

/** Builds a personnel row, attaching either CQDV or DVTT relations to match the unit kind. */
export function makePersonnel(input: MakePersonnelInput = {}): PersonnelShape {
  const unit = input.unit ?? makeUnit({ kind: input.unitKind ?? 'CQDV', id: input.unitId });
  const id = input.id ?? nextId('qn');

  const co_quan_don_vi_id = unit.kind === 'CQDV' ? unit.id : null;
  const don_vi_truc_thuoc_id = unit.kind === 'DVTT' ? unit.id : null;

  return {
    id,
    ho_ten: input.ho_ten ?? `Quân nhân ${id}`,
    cccd: input.cccd ?? `0010100${idCounter.toString().padStart(5, '0')}`,
    ngay_sinh: input.ngay_sinh ?? null,
    gioi_tinh: input.gioi_tinh ?? 'NAM',
    ngay_nhap_ngu: input.ngay_nhap_ngu ?? null,
    ngay_xuat_ngu: input.ngay_xuat_ngu ?? null,
    cap_bac: input.cap_bac ?? 'Đại uý',
    chuc_vu_id: input.chuc_vu?.id ?? null,
    co_quan_don_vi_id,
    don_vi_truc_thuoc_id,
    CoQuanDonVi: unit.CoQuanDonVi,
    DonViTrucThuoc: unit.DonViTrucThuoc,
    ChucVu: input.chuc_vu ?? null,
  };
}

export interface AnnualRecordShape {
  id: string;
  quan_nhan_id: string;
  nam: number;
  danh_hieu: string | null;
  so_quyet_dinh: string | null;
  cap_bac: string | null;
  chuc_vu: string | null;
  ghi_chu: string | null;
  nhan_bkbqp: boolean;
  so_quyet_dinh_bkbqp: string | null;
  ghi_chu_bkbqp: string | null;
  nhan_cstdtq: boolean;
  so_quyet_dinh_cstdtq: string | null;
  ghi_chu_cstdtq: string | null;
  nhan_bkttcp: boolean;
  so_quyet_dinh_bkttcp: string | null;
  ghi_chu_bkttcp: string | null;
}

export function makeAnnualRecord(
  input: Partial<AnnualRecordShape> & { personnelId: string; nam: number }
): AnnualRecordShape {
  const { personnelId, nam, ...rest } = input;
  return {
    id: rest.id ?? nextId('dhhn'),
    quan_nhan_id: personnelId,
    nam,
    danh_hieu: rest.danh_hieu ?? null,
    so_quyet_dinh: rest.so_quyet_dinh ?? null,
    cap_bac: rest.cap_bac ?? null,
    chuc_vu: rest.chuc_vu ?? null,
    ghi_chu: rest.ghi_chu ?? null,
    nhan_bkbqp: rest.nhan_bkbqp ?? false,
    so_quyet_dinh_bkbqp: rest.so_quyet_dinh_bkbqp ?? null,
    ghi_chu_bkbqp: rest.ghi_chu_bkbqp ?? null,
    nhan_cstdtq: rest.nhan_cstdtq ?? false,
    so_quyet_dinh_cstdtq: rest.so_quyet_dinh_cstdtq ?? null,
    ghi_chu_cstdtq: rest.ghi_chu_cstdtq ?? null,
    nhan_bkttcp: rest.nhan_bkttcp ?? false,
    so_quyet_dinh_bkttcp: rest.so_quyet_dinh_bkttcp ?? null,
    ghi_chu_bkttcp: rest.ghi_chu_bkttcp ?? null,
  };
}

export interface UnitAnnualRecordShape {
  id: string;
  co_quan_don_vi_id: string | null;
  don_vi_truc_thuoc_id: string | null;
  nam: number;
  danh_hieu: string | null;
  so_quyet_dinh: string | null;
  ghi_chu: string | null;
  nhan_bkbqp: boolean;
  so_quyet_dinh_bkbqp: string | null;
  ghi_chu_bkbqp: string | null;
  nhan_bkttcp: boolean;
  so_quyet_dinh_bkttcp: string | null;
  ghi_chu_bkttcp: string | null;
  status: ProposalStatus;
}

export function makeUnitAnnualRecord(
  input: Partial<UnitAnnualRecordShape> & { unitId: string; unitKind: UnitKind; nam: number }
): UnitAnnualRecordShape {
  const { unitId, unitKind, nam, ...rest } = input;
  const co_quan_don_vi_id = unitKind === 'CQDV' ? unitId : null;
  const don_vi_truc_thuoc_id = unitKind === 'DVTT' ? unitId : null;
  return {
    id: rest.id ?? nextId('dhdv'),
    co_quan_don_vi_id,
    don_vi_truc_thuoc_id,
    nam,
    danh_hieu: rest.danh_hieu ?? null,
    so_quyet_dinh: rest.so_quyet_dinh ?? null,
    ghi_chu: rest.ghi_chu ?? null,
    nhan_bkbqp: rest.nhan_bkbqp ?? false,
    so_quyet_dinh_bkbqp: rest.so_quyet_dinh_bkbqp ?? null,
    ghi_chu_bkbqp: rest.ghi_chu_bkbqp ?? null,
    nhan_bkttcp: rest.nhan_bkttcp ?? false,
    so_quyet_dinh_bkttcp: rest.so_quyet_dinh_bkttcp ?? null,
    ghi_chu_bkttcp: rest.ghi_chu_bkttcp ?? null,
    status: rest.status ?? PROPOSAL_STATUS.APPROVED,
  };
}

export interface ProposalShape {
  id: string;
  loai_de_xuat: ProposalType;
  status: ProposalStatus;
  nam: number;
  thang: number | null;
  data_danh_hieu: unknown[] | null;
  data_thanh_tich: unknown[] | null;
  data_nien_han: unknown[] | null;
  data_cong_hien: unknown[] | null;
  files_attached: unknown[] | null;
  ghi_chu: string | null;
  nguoi_de_xuat_id: string;
  nguoi_duyet_id: string | null;
  ngay_duyet: Date | null;
  co_quan_don_vi_id: string | null;
  don_vi_truc_thuoc_id: string | null;
  CoQuanDonVi: CoQuanDonViShape | null;
  DonViTrucThuoc: DonViTrucThuocShape | null;
  NguoiDeXuat?: { id: string; username: string; role: Role; QuanNhan: { id: string; ho_ten: string } | null };
  createdAt: Date;
}

interface MakeProposalInput {
  id?: string;
  loai: ProposalType;
  status?: ProposalStatus;
  nam: number;
  thang?: number | null;
  data_danh_hieu?: unknown[] | null;
  data_thanh_tich?: unknown[] | null;
  data_nien_han?: unknown[] | null;
  data_cong_hien?: unknown[] | null;
  unitKind?: UnitKind;
  unitId?: string;
  unit?: UnitFixture;
  nguoi_de_xuat_id: string;
  ghi_chu?: string | null;
}

export function makeProposal(input: MakeProposalInput): ProposalShape {
  const unit = input.unit ?? makeUnit({ kind: input.unitKind ?? 'CQDV', id: input.unitId });
  const id = input.id ?? nextId('prop');
  return {
    id,
    loai_de_xuat: input.loai,
    status: input.status ?? PROPOSAL_STATUS.PENDING,
    nam: input.nam,
    thang: input.thang ?? null,
    data_danh_hieu: input.data_danh_hieu ?? null,
    data_thanh_tich: input.data_thanh_tich ?? null,
    data_nien_han: input.data_nien_han ?? null,
    data_cong_hien: input.data_cong_hien ?? null,
    files_attached: null,
    ghi_chu: input.ghi_chu ?? null,
    nguoi_de_xuat_id: input.nguoi_de_xuat_id,
    nguoi_duyet_id: null,
    ngay_duyet: null,
    co_quan_don_vi_id: unit.kind === 'CQDV' ? unit.id : null,
    don_vi_truc_thuoc_id: unit.kind === 'DVTT' ? unit.id : null,
    CoQuanDonVi: unit.CoQuanDonVi,
    DonViTrucThuoc: unit.DonViTrucThuoc,
    NguoiDeXuat: {
      id: input.nguoi_de_xuat_id,
      username: 'admin',
      role: ROLES.ADMIN,
      QuanNhan: { id: nextId('qn-admin'), ho_ten: 'Admin Manager' },
    },
    createdAt: new Date('2024-06-01T00:00:00Z'),
  };
}

export interface AccountShape {
  id: string;
  username: string;
  role: Role;
  quan_nhan_id: string | null;
  QuanNhan: PersonnelShape | null;
}

export function makeAdmin(
  overrides: Partial<{ id: string; role: Role; username: string; quanNhan: PersonnelShape | null }> = {}
): AccountShape {
  const id = overrides.id ?? nextId('acc-admin');
  return {
    id,
    username: overrides.username ?? `admin_${id}`,
    role: overrides.role ?? ROLES.ADMIN,
    quan_nhan_id: overrides.quanNhan?.id ?? null,
    QuanNhan: overrides.quanNhan ?? null,
  };
}

export interface ProposalItemCaNhanInput {
  personnel_id: string;
  ho_ten?: string;
  danh_hieu: string;
  so_quyet_dinh?: string | null;
  cap_bac?: string | null;
  chuc_vu?: string | null;
}

/** Builds one item in a `data_danh_hieu` JSON array for `CA_NHAN_HANG_NAM` proposals. */
export function makeProposalItemCaNhan(input: ProposalItemCaNhanInput) {
  const isBkbqp = input.danh_hieu === DANH_HIEU_CA_NHAN_HANG_NAM.BKBQP;
  const isCstdtq = input.danh_hieu === DANH_HIEU_CA_NHAN_HANG_NAM.CSTDTQ;
  const isBkttcp = input.danh_hieu === DANH_HIEU_CA_NHAN_HANG_NAM.BKTTCP;
  return {
    personnel_id: input.personnel_id,
    ho_ten: input.ho_ten ?? `QN ${input.personnel_id}`,
    danh_hieu: input.danh_hieu,
    so_quyet_dinh: input.so_quyet_dinh ?? null,
    cap_bac: input.cap_bac ?? null,
    chuc_vu: input.chuc_vu ?? null,
    nhan_bkbqp: isBkbqp,
    nhan_cstdtq: isCstdtq,
    nhan_bkttcp: isBkttcp,
  };
}

export interface ProposalItemDonViInput {
  unitKind: UnitKind;
  unitId: string;
  ten_don_vi?: string;
  danh_hieu: string;
  so_quyet_dinh?: string | null;
}

/** Builds one item in a `data_danh_hieu` JSON array for `DON_VI_HANG_NAM` proposals. */
export function makeProposalItemDonVi(input: ProposalItemDonViInput) {
  const isBkbqp = input.danh_hieu === DANH_HIEU_DON_VI_HANG_NAM.BKBQP;
  const isBkttcp = input.danh_hieu === DANH_HIEU_DON_VI_HANG_NAM.BKTTCP;
  return {
    don_vi_id: input.unitId,
    don_vi_type: input.unitKind === 'CQDV' ? 'CO_QUAN_DON_VI' : 'DON_VI_TRUC_THUOC',
    ten_don_vi: input.ten_don_vi ?? `Đơn vị ${input.unitId}`,
    danh_hieu: input.danh_hieu,
    so_quyet_dinh: input.so_quyet_dinh ?? null,
    co_quan_don_vi_id: input.unitKind === 'CQDV' ? input.unitId : null,
    don_vi_truc_thuoc_id: input.unitKind === 'DVTT' ? input.unitId : null,
    nhan_bkbqp: isBkbqp,
    nhan_bkttcp: isBkttcp,
  };
}

export interface ThanhTichKhoaHocShape {
  id: string;
  quan_nhan_id: string;
  nam: number;
  loai: 'DTKH' | 'SKKH';
  mo_ta: string;
  so_quyet_dinh: string | null;
}

export function makeThanhTichKhoaHoc(
  input: Partial<ThanhTichKhoaHocShape> & { personnelId: string; nam: number }
): ThanhTichKhoaHocShape {
  const { personnelId, nam, ...rest } = input;
  return {
    id: rest.id ?? nextId('ttkh'),
    quan_nhan_id: personnelId,
    nam,
    loai: rest.loai ?? 'SKKH',
    mo_ta: rest.mo_ta ?? `Sáng kiến ${personnelId} năm ${nam}`,
    so_quyet_dinh: rest.so_quyet_dinh ?? null,
  };
}

export const _proposalTypes = PROPOSAL_TYPES;
