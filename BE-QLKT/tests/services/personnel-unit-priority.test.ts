import { prismaMock } from '../helpers/prismaMock';
import personnelService from '../../src/services/personnel.service';
import { ROLES } from '../../src/constants/roles.constants';
import { GENDER } from '../../src/constants/gender.constants';
import { makeUnit, makePersonnel } from '../helpers/fixtures';
import { mockPersonnelCascadeDeletes } from '../helpers/prismaArrange';

const ADMIN_USERNAME = 'admin';
const ADMIN_QN_ID = 'qn-admin-1';

function getUpdateCallsFor(model: 'coQuanDonVi' | 'donViTrucThuoc') {
  return prismaMock[model].update.mock.calls.map(call => call[0]);
}

describe('Quân nhân: ưu tiên DVTT trước CQDV khi xác định đơn vị', () => {
  it('Quân nhân: có cả DVTT và CQDV, khi xoá → giảm đếm số lượng DVTT, CQDV giữ nguyên', async () => {
    const cqdv = makeUnit({ kind: 'CQDV', id: 'cqdv-A' });
    const dvtt = makeUnit({ kind: 'DVTT', id: 'dvtt-A1', parentId: cqdv.id });
    const personnel = makePersonnel({ id: 'qn-1', unit: dvtt });
    personnel.co_quan_don_vi_id = cqdv.id;
    personnel.don_vi_truc_thuoc_id = dvtt.id;

    prismaMock.quanNhan.findUnique.mockResolvedValueOnce({ ...personnel, TaiKhoan: null } as any);
    mockPersonnelCascadeDeletes();
    prismaMock.quanNhan.delete.mockResolvedValueOnce(personnel as any);
    prismaMock.donViTrucThuoc.update.mockResolvedValueOnce({} as any);

    await personnelService.deletePersonnel('qn-1', ROLES.ADMIN, ADMIN_QN_ID);

    expect(prismaMock.donViTrucThuoc.update).toHaveBeenCalledTimes(1);
    expect(getUpdateCallsFor('donViTrucThuoc')[0]).toEqual({
      where: { id: dvtt.id },
      data: { so_luong: { decrement: 1 } },
    });
    expect(prismaMock.coQuanDonVi.update).not.toHaveBeenCalled();
  });

  it('Quân nhân: chỉ thuộc CQDV (không có DVTT), khi xoá → giảm đếm số lượng CQDV', async () => {
    const cqdv = makeUnit({ kind: 'CQDV', id: 'cqdv-B' });
    const personnel = makePersonnel({ id: 'qn-2', unit: cqdv });

    prismaMock.quanNhan.findUnique.mockResolvedValueOnce({ ...personnel, TaiKhoan: null } as any);
    mockPersonnelCascadeDeletes();
    prismaMock.quanNhan.delete.mockResolvedValueOnce(personnel as any);
    prismaMock.coQuanDonVi.update.mockResolvedValueOnce({} as any);

    await personnelService.deletePersonnel('qn-2', ROLES.ADMIN, ADMIN_QN_ID);

    expect(prismaMock.coQuanDonVi.update).toHaveBeenCalledTimes(1);
    expect(getUpdateCallsFor('coQuanDonVi')[0]).toEqual({
      where: { id: cqdv.id },
      data: { so_luong: { decrement: 1 } },
    });
    expect(prismaMock.donViTrucThuoc.update).not.toHaveBeenCalled();
  });

  it('Quân nhân: chỉ thuộc DVTT (không có CQDV), khi xoá → giảm đếm số lượng DVTT', async () => {
    const dvtt = makeUnit({ kind: 'DVTT', id: 'dvtt-C1' });
    const personnel = makePersonnel({ id: 'qn-3', unit: dvtt });

    prismaMock.quanNhan.findUnique.mockResolvedValueOnce({ ...personnel, TaiKhoan: null } as any);
    mockPersonnelCascadeDeletes();
    prismaMock.quanNhan.delete.mockResolvedValueOnce(personnel as any);
    prismaMock.donViTrucThuoc.update.mockResolvedValueOnce({} as any);

    await personnelService.deletePersonnel('qn-3', ROLES.ADMIN, ADMIN_QN_ID);

    expect(prismaMock.donViTrucThuoc.update).toHaveBeenCalledTimes(1);
    expect(prismaMock.coQuanDonVi.update).not.toHaveBeenCalled();
  });
});

describe('Quân nhân: đếm số lượng chỉ tăng/giảm đúng 1 đơn vị', () => {
  function mockCreatePersonnelDeps(unitKind: 'CQDV' | 'DVTT', unitId: string, positionId = 'cv-1') {
    prismaMock.quanNhan.findUnique.mockResolvedValueOnce(null);
    if (unitKind === 'CQDV') {
      prismaMock.coQuanDonVi.findUnique.mockResolvedValueOnce({ id: unitId } as any);
      prismaMock.donViTrucThuoc.findUnique.mockResolvedValueOnce(null);
    } else {
      prismaMock.coQuanDonVi.findUnique.mockResolvedValueOnce(null);
      prismaMock.donViTrucThuoc.findUnique.mockResolvedValueOnce({ id: unitId } as any);
    }
    prismaMock.chucVu.findUnique.mockResolvedValueOnce({ id: positionId } as any);
    prismaMock.taiKhoan.findUnique.mockResolvedValueOnce(null);
    prismaMock.quanNhan.create.mockResolvedValueOnce({
      id: 'qn-new',
      ho_ten: 'Test',
      cccd: '001100000001',
      co_quan_don_vi_id: unitKind === 'CQDV' ? unitId : null,
      don_vi_truc_thuoc_id: unitKind === 'DVTT' ? unitId : null,
      CoQuanDonVi: null,
      DonViTrucThuoc: null,
      ChucVu: null,
    } as any);
    prismaMock.chucVu.findUnique.mockResolvedValueOnce({ he_so_chuc_vu: 1.0 } as any);
    prismaMock.lichSuChucVu.create.mockResolvedValueOnce({} as any);
    prismaMock.taiKhoan.create.mockResolvedValueOnce({
      id: 'acc-1',
      username: '001100000001',
      role: ROLES.USER,
    } as any);
  }

  it('Quân nhân: tạo mới thuộc DVTT → đếm số lượng DVTT tăng 1, CQDV không đổi', async () => {
    const dvttId = 'dvtt-X';
    mockCreatePersonnelDeps('DVTT', dvttId);
    prismaMock.donViTrucThuoc.update.mockResolvedValueOnce({} as any);

    await personnelService.createPersonnel({
      cccd: '001100000001',
      unit_id: dvttId,
      position_id: 'cv-1',
    });

    expect(prismaMock.donViTrucThuoc.update).toHaveBeenCalledTimes(1);
    expect(getUpdateCallsFor('donViTrucThuoc')[0]).toEqual({
      where: { id: dvttId },
      data: { so_luong: { increment: 1 } },
    });
    expect(prismaMock.coQuanDonVi.update).not.toHaveBeenCalled();
  });

  it('Quân nhân: tạo mới chỉ thuộc CQDV → đếm số lượng CQDV tăng 1', async () => {
    const cqdvId = 'cqdv-Y';
    mockCreatePersonnelDeps('CQDV', cqdvId);
    prismaMock.coQuanDonVi.update.mockResolvedValueOnce({} as any);

    await personnelService.createPersonnel({
      cccd: '001100000001',
      unit_id: cqdvId,
      position_id: 'cv-1',
    });

    expect(prismaMock.coQuanDonVi.update).toHaveBeenCalledTimes(1);
    expect(getUpdateCallsFor('coQuanDonVi')[0]).toEqual({
      where: { id: cqdvId },
      data: { so_luong: { increment: 1 } },
    });
    expect(prismaMock.donViTrucThuoc.update).not.toHaveBeenCalled();
  });

  it('Quân nhân: chuyển từ DVTT-A sang DVTT-B → A giảm 1, B tăng 1, CQDV không đổi', async () => {
    const cqdvParent = makeUnit({ kind: 'CQDV', id: 'cqdv-parent' });
    const dvttA = makeUnit({ kind: 'DVTT', id: 'dvtt-A', parentId: cqdvParent.id });
    const dvttB = makeUnit({ kind: 'DVTT', id: 'dvtt-B', parentId: cqdvParent.id });
    const personnel = makePersonnel({ id: 'qn-update-1', unit: dvttA, gioi_tinh: GENDER.MALE });
    personnel.co_quan_don_vi_id = cqdvParent.id;
    personnel.don_vi_truc_thuoc_id = dvttA.id;

    prismaMock.quanNhan.findUnique.mockResolvedValueOnce({ ...personnel, TaiKhoan: null } as any);
    prismaMock.donViTrucThuoc.findUnique.mockResolvedValueOnce({
      id: dvttB.id,
      co_quan_don_vi_id: cqdvParent.id,
    } as any);
    prismaMock.quanNhan.update.mockResolvedValueOnce({
      ...personnel,
      co_quan_don_vi_id: cqdvParent.id,
      don_vi_truc_thuoc_id: dvttB.id,
    } as any);
    prismaMock.donViTrucThuoc.findUnique.mockResolvedValueOnce({
      id: dvttA.id,
      ten_don_vi: dvttA.ten_don_vi,
    } as any);
    prismaMock.donViTrucThuoc.update.mockResolvedValueOnce({} as any);
    prismaMock.donViTrucThuoc.findUnique.mockResolvedValueOnce({
      id: dvttB.id,
      ten_don_vi: dvttB.ten_don_vi,
    } as any);
    prismaMock.donViTrucThuoc.update.mockResolvedValueOnce({} as any);

    await personnelService.updatePersonnel(
      'qn-update-1',
      { don_vi_truc_thuoc_id: dvttB.id, gioi_tinh: GENDER.MALE },
      ROLES.ADMIN,
      ADMIN_QN_ID,
      ADMIN_USERNAME
    );

    const dvttCalls = getUpdateCallsFor('donViTrucThuoc');
    expect(dvttCalls).toHaveLength(2);
    expect(dvttCalls).toContainEqual({
      where: { id: dvttA.id },
      data: { so_luong: { decrement: 1 } },
    });
    expect(dvttCalls).toContainEqual({
      where: { id: dvttB.id },
      data: { so_luong: { increment: 1 } },
    });
    expect(prismaMock.coQuanDonVi.update).not.toHaveBeenCalled();
  });

  it('Quân nhân: chuyển từ DVTT-A sang CQDV-X → DVTT-A giảm 1, CQDV-X tăng 1', async () => {
    const cqdvParent = makeUnit({ kind: 'CQDV', id: 'cqdv-parent2' });
    const dvttA = makeUnit({ kind: 'DVTT', id: 'dvtt-A2', parentId: cqdvParent.id });
    const cqdvX = makeUnit({ kind: 'CQDV', id: 'cqdv-X' });
    const personnel = makePersonnel({ id: 'qn-update-2', unit: dvttA, gioi_tinh: GENDER.MALE });
    personnel.co_quan_don_vi_id = cqdvParent.id;
    personnel.don_vi_truc_thuoc_id = dvttA.id;

    prismaMock.quanNhan.findUnique.mockResolvedValueOnce({ ...personnel, TaiKhoan: null } as any);
    prismaMock.quanNhan.update.mockResolvedValueOnce({
      ...personnel,
      co_quan_don_vi_id: cqdvX.id,
      don_vi_truc_thuoc_id: null,
    } as any);
    prismaMock.donViTrucThuoc.findUnique.mockResolvedValueOnce({
      id: dvttA.id,
      ten_don_vi: dvttA.ten_don_vi,
    } as any);
    prismaMock.donViTrucThuoc.update.mockResolvedValueOnce({} as any);
    prismaMock.coQuanDonVi.findUnique.mockResolvedValueOnce({
      id: cqdvX.id,
      ten_don_vi: cqdvX.ten_don_vi,
    } as any);
    prismaMock.coQuanDonVi.update.mockResolvedValueOnce({} as any);

    await personnelService.updatePersonnel(
      'qn-update-2',
      { co_quan_don_vi_id: cqdvX.id, gioi_tinh: GENDER.MALE },
      ROLES.ADMIN,
      ADMIN_QN_ID,
      ADMIN_USERNAME
    );

    expect(getUpdateCallsFor('donViTrucThuoc')).toEqual([
      { where: { id: dvttA.id }, data: { so_luong: { decrement: 1 } } },
    ]);
    expect(getUpdateCallsFor('coQuanDonVi')).toEqual([
      { where: { id: cqdvX.id }, data: { so_luong: { increment: 1 } } },
    ]);
  });

  it('Quân nhân: xoá quân nhân chỉ thuộc CQDV → đếm số lượng CQDV giảm đúng 1', async () => {
    const cqdv = makeUnit({ kind: 'CQDV', id: 'cqdv-Z' });
    const personnel = makePersonnel({ id: 'qn-del-1', unit: cqdv });

    prismaMock.quanNhan.findUnique.mockResolvedValueOnce({ ...personnel, TaiKhoan: null } as any);
    mockPersonnelCascadeDeletes();
    prismaMock.quanNhan.delete.mockResolvedValueOnce(personnel as any);
    prismaMock.coQuanDonVi.update.mockResolvedValueOnce({} as any);

    await personnelService.deletePersonnel('qn-del-1', ROLES.ADMIN, ADMIN_QN_ID);

    expect(prismaMock.coQuanDonVi.update).toHaveBeenCalledTimes(1);
    expect(getUpdateCallsFor('coQuanDonVi')[0]).toEqual({
      where: { id: cqdv.id },
      data: { so_luong: { decrement: 1 } },
    });
    expect(prismaMock.donViTrucThuoc.update).not.toHaveBeenCalled();
  });
});
