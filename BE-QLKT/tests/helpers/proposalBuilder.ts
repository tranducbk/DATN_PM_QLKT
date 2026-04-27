/**
 * Fluent builder for `BangDeXuat` proposal fixtures.
 *
 * Use it to compose CA_NHAN_HANG_NAM / DON_VI_HANG_NAM proposals declaratively —
 * `.build()` returns the same shape `prisma.bangDeXuat.findUnique` would resolve.
 */

import { PROPOSAL_TYPES, type ProposalType } from '../../src/constants/proposalTypes.constants';
import { PROPOSAL_STATUS, type ProposalStatus } from '../../src/constants/proposalStatus.constants';
import {
  DANH_HIEU_CA_NHAN_HANG_NAM,
  DANH_HIEU_DON_VI_HANG_NAM,
} from '../../src/constants/danhHieu.constants';
import {
  makeProposal,
  makeUnit,
  makeProposalItemCaNhan,
  makeProposalItemDonVi,
  type ProposalShape,
  type UnitFixture,
  type UnitKind,
} from './fixtures';

interface CaNhanItemInput {
  personnelId: string;
  hoTen?: string;
  danhHieu: string;
  soQuyetDinh?: string | null;
}

interface DonViItemInput {
  unitKind: UnitKind;
  unitId: string;
  tenDonVi?: string;
  danhHieu: string;
  soQuyetDinh?: string | null;
}

interface FlagInput {
  personnelId: string;
  flag: 'BKBQP' | 'CSTDTQ' | 'BKTTCP';
  soQuyetDinh?: string | null;
}

class ProposalBuilder {
  private loai: ProposalType = PROPOSAL_TYPES.CA_NHAN_HANG_NAM;
  private nam: number = new Date().getFullYear();
  private thang: number | null = null;
  private status: ProposalStatus = PROPOSAL_STATUS.PENDING;
  private nguoiDeXuatId: string = 'admin-default';
  private unit: UnitFixture | null = null;
  private items: Array<Record<string, unknown>> = [];
  private id?: string;
  private ghiChu: string | null = null;

  caNhanHangNam(nam: number): this {
    this.loai = PROPOSAL_TYPES.CA_NHAN_HANG_NAM;
    this.nam = nam;
    return this;
  }

  donViHangNam(nam: number): this {
    this.loai = PROPOSAL_TYPES.DON_VI_HANG_NAM;
    this.nam = nam;
    return this;
  }

  loaiDeXuat(type: ProposalType): this {
    this.loai = type;
    return this;
  }

  nameYear(nam: number): this {
    this.nam = nam;
    return this;
  }

  thangDeXuat(thang: number | null): this {
    this.thang = thang;
    return this;
  }

  pending(): this {
    this.status = PROPOSAL_STATUS.PENDING;
    return this;
  }

  approved(): this {
    this.status = PROPOSAL_STATUS.APPROVED;
    return this;
  }

  rejected(): this {
    this.status = PROPOSAL_STATUS.REJECTED;
    return this;
  }

  withId(id: string): this {
    this.id = id;
    return this;
  }

  withGhiChu(ghiChu: string | null): this {
    this.ghiChu = ghiChu;
    return this;
  }

  nguoiDeXuat(accountId: string): this {
    this.nguoiDeXuatId = accountId;
    return this;
  }

  coQuanDonVi(unitId: string, tenDonVi?: string): this {
    this.unit = makeUnit({ kind: 'CQDV', id: unitId, ten_don_vi: tenDonVi });
    return this;
  }

  donViTrucThuoc(unitId: string, parentId?: string, tenDonVi?: string): this {
    this.unit = makeUnit({ kind: 'DVTT', id: unitId, parentId, ten_don_vi: tenDonVi });
    return this;
  }

  withItem(item: CaNhanItemInput): this {
    this.items.push(
      makeProposalItemCaNhan({
        personnel_id: item.personnelId,
        ho_ten: item.hoTen,
        danh_hieu: item.danhHieu,
        so_quyet_dinh: item.soQuyetDinh ?? null,
      })
    );
    return this;
  }

  withUnitItem(item: DonViItemInput): this {
    this.items.push(
      makeProposalItemDonVi({
        unitKind: item.unitKind,
        unitId: item.unitId,
        ten_don_vi: item.tenDonVi,
        danh_hieu: item.danhHieu,
        so_quyet_dinh: item.soQuyetDinh ?? null,
      })
    );
    return this;
  }

  withFlag(input: FlagInput): this {
    const code =
      input.flag === 'BKBQP'
        ? DANH_HIEU_CA_NHAN_HANG_NAM.BKBQP
        : input.flag === 'CSTDTQ'
          ? DANH_HIEU_CA_NHAN_HANG_NAM.CSTDTQ
          : DANH_HIEU_CA_NHAN_HANG_NAM.BKTTCP;
    this.items.push(
      makeProposalItemCaNhan({
        personnel_id: input.personnelId,
        danh_hieu: code,
        so_quyet_dinh: input.soQuyetDinh ?? null,
      })
    );
    return this;
  }

  build(): ProposalShape {
    return makeProposal({
      id: this.id,
      loai: this.loai,
      status: this.status,
      nam: this.nam,
      thang: this.thang,
      nguoi_de_xuat_id: this.nguoiDeXuatId,
      unit: this.unit ?? makeUnit({ kind: 'CQDV' }),
      data_danh_hieu: this.items.length > 0 ? this.items : null,
      ghi_chu: this.ghiChu,
    });
  }
}

export function proposalBuilder(): ProposalBuilder {
  return new ProposalBuilder();
}

/** Returns a CSTDCS + BKBQP item pair that triggers the CA_NHAN_HANG_NAM mixed-group rule. */
export function mixedCaNhanItems(personnelIdA: string, personnelIdB: string) {
  return [
    makeProposalItemCaNhan({ personnel_id: personnelIdA, danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.CSTDCS }),
    makeProposalItemCaNhan({ personnel_id: personnelIdB, danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.BKBQP }),
  ];
}

/** Returns a ĐVQT + BKBQP item pair that triggers the DON_VI_HANG_NAM mixed-group rule. */
export function mixedDonViItems(unitId: string, unitKind: UnitKind) {
  return [
    makeProposalItemDonVi({ unitKind, unitId, danh_hieu: DANH_HIEU_DON_VI_HANG_NAM.DVQT }),
    makeProposalItemDonVi({ unitKind, unitId, danh_hieu: DANH_HIEU_DON_VI_HANG_NAM.BKBQP }),
  ];
}
