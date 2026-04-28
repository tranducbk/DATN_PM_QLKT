import { prismaMock, resetPrismaMock } from '../helpers/prismaMock';
import { makePersonnel, makeUnit, makeAdmin } from '../helpers/fixtures';
import { expectError } from '../helpers/errorAssert';

import proposalService from '../../src/services/proposal';
import unitAnnualAwardService from '../../src/services/unitAnnualAward.service';
import { ValidationError } from '../../src/middlewares/errorHandler';
import { PROPOSAL_TYPES } from '../../src/constants/proposalTypes.constants';
import { PROPOSAL_STATUS } from '../../src/constants/proposalStatus.constants';
import {
  DANH_HIEU_DON_VI_HANG_NAM,
  DANH_HIEU_CA_NHAN_HANG_NAM,
} from '../../src/constants/danhHieu.constants';
import { ROLES } from '../../src/constants/roles.constants';

beforeEach(() => {
  resetPrismaMock();
  // Stub mặc định check duplicate: DB rỗng và không có pending proposal.
  prismaMock.danhHieuDonViHangNam.findFirst.mockResolvedValue(null);
  prismaMock.bangDeXuat.findMany.mockResolvedValue([]);
  // Stub mặc định cho chain-eligibility — override theo từng test bypass.
  jest
    .spyOn(unitAnnualAwardService, 'checkUnitAwardEligibility')
    .mockResolvedValue({ eligible: true, reason: '' });
});

afterEach(() => {
  jest.restoreAllMocks();
});

interface DonViItem {
  personnel_id?: string;
  don_vi_id: string;
  don_vi_type: 'CO_QUAN_DON_VI' | 'DON_VI_TRUC_THUOC';
  danh_hieu: string;
  so_quyet_dinh?: string | null;
}

function arrangeManagerWithUnit(unitKind: 'CQDV' | 'DVTT' = 'CQDV') {
  const unit = makeUnit({ kind: unitKind, id: unitKind === 'CQDV' ? 'cqdv-mgr' : 'dvtt-mgr' });
  const managerQn = makePersonnel({ unit, id: 'qn-manager', ho_ten: 'Manager A' });
  const account = makeAdmin({ id: 'acc-mgr-1', quanNhan: managerQn });
  prismaMock.taiKhoan.findUnique.mockResolvedValueOnce({
    ...account,
    QuanNhan: {
      ...managerQn,
      CoQuanDonVi: unit.kind === 'CQDV' ? unit.CoQuanDonVi : null,
      DonViTrucThuoc: unit.kind === 'DVTT' ? unit.DonViTrucThuoc : null,
    },
  });
  return { unit, account };
}

function arrangeProposalCreate(id = 'p-1') {
  prismaMock.bangDeXuat.create.mockResolvedValueOnce({
    id,
    loai_de_xuat: PROPOSAL_TYPES.DON_VI_HANG_NAM,
    status: PROPOSAL_STATUS.PENDING,
    createdAt: new Date(),
    DonViTrucThuoc: null,
    CoQuanDonVi: null,
    NguoiDeXuat: { id: 'acc-mgr-1', username: 'admin', QuanNhan: null },
  });
}

function callSubmitDonVi(items: DonViItem[], userId = 'acc-mgr-1', nam = 2024) {
  return proposalService.submitProposal(
    items as unknown as Parameters<typeof proposalService.submitProposal>[0],
    null,    userId,
    PROPOSAL_TYPES.DON_VI_HANG_NAM,
    nam,
    null,
    null
  );
}

describe('proposal.submit - DON_VI_HANG_NAM', () => {
  it('gửi thành công với ĐVQT (CQDV)', async () => {
    // Cho trước: manager submit đề xuất ĐVQT cho target CQDV
    arrangeManagerWithUnit('CQDV');
    const targetUnit = makeUnit({ kind: 'CQDV', id: 'cqdv-target' });
    prismaMock.coQuanDonVi.findUnique.mockResolvedValueOnce({
      id: targetUnit.id,
      ten_don_vi: targetUnit.ten_don_vi,
      ma_don_vi: targetUnit.ma_don_vi,
    });
    arrangeProposalCreate();

    // Khi
    await callSubmitDonVi([
      {
        don_vi_id: targetUnit.id,
        don_vi_type: 'CO_QUAN_DON_VI',
        danh_hieu: DANH_HIEU_DON_VI_HANG_NAM.DVQT,
      },
    ]);

    // Kết quả: payload mang DVQT, không có chain flag nào được set
    expect(prismaMock.bangDeXuat.create).toHaveBeenCalledTimes(1);
    const data = prismaMock.bangDeXuat.create.mock.calls[0][0].data;
    expect(data.loai_de_xuat).toBe(PROPOSAL_TYPES.DON_VI_HANG_NAM);
    expect(data.data_danh_hieu[0]).toMatchObject({
      don_vi_id: targetUnit.id,
      don_vi_type: 'CO_QUAN_DON_VI',
      ten_don_vi: targetUnit.ten_don_vi,
      ma_don_vi: targetUnit.ma_don_vi,
      danh_hieu: DANH_HIEU_DON_VI_HANG_NAM.DVQT,
      nhan_bkbqp: false,
      nhan_bkttcp: false,
    });
    expect(data.data_danh_hieu[0].co_quan_don_vi_cha).toBeNull();
  });

  it('gửi thành công với ĐVTT (CQDV)', async () => {
    arrangeManagerWithUnit('CQDV');
    const targetUnit = makeUnit({ kind: 'CQDV', id: 'cqdv-dvtt-target' });
    prismaMock.coQuanDonVi.findUnique.mockResolvedValueOnce({
      id: targetUnit.id,
      ten_don_vi: targetUnit.ten_don_vi,
      ma_don_vi: targetUnit.ma_don_vi,
    });
    arrangeProposalCreate();

    await callSubmitDonVi([
      {
        don_vi_id: targetUnit.id,
        don_vi_type: 'CO_QUAN_DON_VI',
        danh_hieu: DANH_HIEU_DON_VI_HANG_NAM.DVTT,
      },
    ]);

    const data = prismaMock.bangDeXuat.create.mock.calls[0][0].data;
    expect(data.data_danh_hieu[0]).toMatchObject({
      danh_hieu: DANH_HIEU_DON_VI_HANG_NAM.DVTT,
      nhan_bkbqp: false,
      nhan_bkttcp: false,
    });
  });

  it('gửi thành công BKBQP đơn vị → auto-set `nhan_bkbqp: true`', async () => {
    arrangeManagerWithUnit('CQDV');
    const targetUnit = makeUnit({ kind: 'CQDV', id: 'cqdv-bk' });
    prismaMock.coQuanDonVi.findUnique.mockResolvedValueOnce({
      id: targetUnit.id,
      ten_don_vi: targetUnit.ten_don_vi,
      ma_don_vi: targetUnit.ma_don_vi,
    });
    arrangeProposalCreate();

    await callSubmitDonVi([
      {
        don_vi_id: targetUnit.id,
        don_vi_type: 'CO_QUAN_DON_VI',
        danh_hieu: DANH_HIEU_DON_VI_HANG_NAM.BKBQP,
      },
    ]);

    const data = prismaMock.bangDeXuat.create.mock.calls[0][0].data;
    expect(data.data_danh_hieu[0]).toMatchObject({
      danh_hieu: DANH_HIEU_DON_VI_HANG_NAM.BKBQP,
      nhan_bkbqp: true,
      nhan_bkttcp: false,
    });
  });

  it('gửi thành công BKTTCP đơn vị → auto-set `nhan_bkttcp: true`', async () => {
    arrangeManagerWithUnit('CQDV');
    const targetUnit = makeUnit({ kind: 'CQDV', id: 'cqdv-bkttcp' });
    prismaMock.coQuanDonVi.findUnique.mockResolvedValueOnce({
      id: targetUnit.id,
      ten_don_vi: targetUnit.ten_don_vi,
      ma_don_vi: targetUnit.ma_don_vi,
    });
    arrangeProposalCreate();

    await callSubmitDonVi([
      {
        don_vi_id: targetUnit.id,
        don_vi_type: 'CO_QUAN_DON_VI',
        danh_hieu: DANH_HIEU_DON_VI_HANG_NAM.BKTTCP,
      },
    ]);

    const data = prismaMock.bangDeXuat.create.mock.calls[0][0].data;
    expect(data.data_danh_hieu[0]).toMatchObject({
      danh_hieu: DANH_HIEU_DON_VI_HANG_NAM.BKTTCP,
      nhan_bkbqp: false,
      nhan_bkttcp: true,
    });
  });

  it('bypass FE — reject mixed ĐVQT + BKBQP đơn vị trong cùng đề xuất', async () => {
    // Cho trước: manager + 2 lượt lookup CQDV target (1 lượt mỗi item)
    arrangeManagerWithUnit('CQDV');
    const targetA = makeUnit({ kind: 'CQDV', id: 'cqdv-A' });
    const targetB = makeUnit({ kind: 'CQDV', id: 'cqdv-B' });
    prismaMock.coQuanDonVi.findUnique
      .mockResolvedValueOnce({ id: targetA.id, ten_don_vi: targetA.ten_don_vi, ma_don_vi: targetA.ma_don_vi })
      .mockResolvedValueOnce({ id: targetB.id, ten_don_vi: targetB.ten_don_vi, ma_don_vi: targetB.ma_don_vi });

    // Khi + Kết quả
    await expectError(
      callSubmitDonVi([
        { don_vi_id: targetA.id, don_vi_type: 'CO_QUAN_DON_VI', danh_hieu: DANH_HIEU_DON_VI_HANG_NAM.DVQT },
        { don_vi_id: targetB.id, don_vi_type: 'CO_QUAN_DON_VI', danh_hieu: DANH_HIEU_DON_VI_HANG_NAM.BKBQP },
      ]),
      ValidationError,
      'Không thể đề xuất ĐVQT/ĐVTT cùng với BKBQP/BKTTCP trong một đề xuất. Vui lòng tách thành các đề xuất riêng: một đề xuất cho ĐVQT/ĐVTT, và một đề xuất riêng cho BKBQP/BKTTCP.'
    );
    expect(prismaMock.bangDeXuat.create).not.toHaveBeenCalled();
  });

  it('bypass FE — reject mixed ĐVTT + BKTTCP đơn vị', async () => {
    arrangeManagerWithUnit('CQDV');
    const targetA = makeUnit({ kind: 'CQDV', id: 'cqdv-X' });
    const targetB = makeUnit({ kind: 'CQDV', id: 'cqdv-Y' });
    prismaMock.coQuanDonVi.findUnique
      .mockResolvedValueOnce({ id: targetA.id, ten_don_vi: targetA.ten_don_vi, ma_don_vi: targetA.ma_don_vi })
      .mockResolvedValueOnce({ id: targetB.id, ten_don_vi: targetB.ten_don_vi, ma_don_vi: targetB.ma_don_vi });

    await expectError(
      callSubmitDonVi([
        { don_vi_id: targetA.id, don_vi_type: 'CO_QUAN_DON_VI', danh_hieu: DANH_HIEU_DON_VI_HANG_NAM.DVTT },
        { don_vi_id: targetB.id, don_vi_type: 'CO_QUAN_DON_VI', danh_hieu: DANH_HIEU_DON_VI_HANG_NAM.BKTTCP },
      ]),
      ValidationError,
      'Không thể đề xuất ĐVQT/ĐVTT cùng với BKBQP/BKTTCP trong một đề xuất. Vui lòng tách thành các đề xuất riêng: một đề xuất cho ĐVQT/ĐVTT, và một đề xuất riêng cho BKBQP/BKTTCP.'
    );
    expect(prismaMock.bangDeXuat.create).not.toHaveBeenCalled();
  });

  it('bypass FE — duplicate cùng don_vi + cùng danh_hieu trong payload DON_VI_HANG_NAM → reject', async () => {
    arrangeManagerWithUnit('CQDV');
    const targetUnit = makeUnit({ kind: 'CQDV', id: 'cqdv-dup-in-payload' });
    prismaMock.coQuanDonVi.findUnique
      .mockResolvedValueOnce({
        id: targetUnit.id,
        ten_don_vi: targetUnit.ten_don_vi,
        ma_don_vi: targetUnit.ma_don_vi,
      })
      .mockResolvedValueOnce({
        id: targetUnit.id,
        ten_don_vi: targetUnit.ten_don_vi,
        ma_don_vi: targetUnit.ma_don_vi,
      });
    await expectError(
      callSubmitDonVi([
        {
          don_vi_id: targetUnit.id,
          don_vi_type: 'CO_QUAN_DON_VI',
          danh_hieu: DANH_HIEU_DON_VI_HANG_NAM.DVQT,
        },
        {
          don_vi_id: targetUnit.id,
          don_vi_type: 'CO_QUAN_DON_VI',
          danh_hieu: DANH_HIEU_DON_VI_HANG_NAM.DVQT,
        },
      ]),
      ValidationError,
      { startsWith: 'Phát hiện dữ liệu bị lặp ngay trong payload đề xuất.\n' }
    );
    expect(prismaMock.bangDeXuat.create).not.toHaveBeenCalled();
  });

  it('CQDV variant — proposal lưu `co_quan_don_vi_id` của manager', async () => {
    // Cho trước: manager gắn với đơn vị CQDV
    const mgrUnit = makeUnit({ kind: 'CQDV', id: 'cqdv-MGR-77' });
    prismaMock.taiKhoan.findUnique.mockResolvedValueOnce({
      id: 'acc-cqdv',
      username: 'admin',
      role: ROLES.ADMIN,
      QuanNhan: {
        id: 'qn-mgr-cqdv',
        ho_ten: 'Mgr',
        co_quan_don_vi_id: mgrUnit.id,
        don_vi_truc_thuoc_id: null,
        CoQuanDonVi: mgrUnit.CoQuanDonVi,
        DonViTrucThuoc: null,
      },
    });
    const targetUnit = makeUnit({ kind: 'CQDV', id: 'cqdv-target-77' });
    prismaMock.coQuanDonVi.findUnique.mockResolvedValueOnce({
      id: targetUnit.id,
      ten_don_vi: targetUnit.ten_don_vi,
      ma_don_vi: targetUnit.ma_don_vi,
    });
    arrangeProposalCreate('p-cqdv');

    await callSubmitDonVi(
      [{ don_vi_id: targetUnit.id, don_vi_type: 'CO_QUAN_DON_VI', danh_hieu: DANH_HIEU_DON_VI_HANG_NAM.DVQT }],
      'acc-cqdv'
    );

    const data = prismaMock.bangDeXuat.create.mock.calls[0][0].data;
    expect(data.co_quan_don_vi_id).toBe(mgrUnit.id);
    expect(data.don_vi_truc_thuoc_id).toBeNull();
  });

  it('DVTT variant — co_quan_don_vi_cha set đúng từ DonViTrucThuoc target', async () => {
    // Cho trước: target là DVTT; service phải set co_quan_don_vi_cha từ CQDV cha
    const mgrUnit = makeUnit({ kind: 'DVTT', id: 'dvtt-mgr-99', parentId: 'cqdv-parent-99' });
    prismaMock.taiKhoan.findUnique.mockResolvedValueOnce({
      id: 'acc-dvtt',
      username: 'admin',
      role: ROLES.ADMIN,
      QuanNhan: {
        id: 'qn-mgr-dvtt',
        ho_ten: 'Mgr',
        co_quan_don_vi_id: null,
        don_vi_truc_thuoc_id: mgrUnit.id,
        CoQuanDonVi: null,
        DonViTrucThuoc: mgrUnit.DonViTrucThuoc,
      },
    });
    const parentCqdv = { id: 'cqdv-parent-T', ten_don_vi: 'CQDV cha', ma_don_vi: 'CQDV-T' };
    const targetDvtt = makeUnit({ kind: 'DVTT', id: 'dvtt-target-99', parentId: parentCqdv.id });
    prismaMock.donViTrucThuoc.findUnique.mockResolvedValueOnce({
      id: targetDvtt.id,
      ten_don_vi: targetDvtt.ten_don_vi,
      ma_don_vi: targetDvtt.ma_don_vi,
      co_quan_don_vi_id: parentCqdv.id,
      CoQuanDonVi: parentCqdv,
    });
    arrangeProposalCreate('p-dvtt');

    // Khi
    await callSubmitDonVi(
      [{ don_vi_id: targetDvtt.id, don_vi_type: 'DON_VI_TRUC_THUOC', danh_hieu: DANH_HIEU_DON_VI_HANG_NAM.DVQT }],
      'acc-dvtt'
    );

    // Kết quả
    const data = prismaMock.bangDeXuat.create.mock.calls[0][0].data;
    expect(data.don_vi_truc_thuoc_id).toBe(mgrUnit.id);
    expect(data.co_quan_don_vi_id).toBeNull();
    expect(data.data_danh_hieu[0]).toMatchObject({
      don_vi_id: targetDvtt.id,
      don_vi_type: 'DON_VI_TRUC_THUOC',
      ten_don_vi: targetDvtt.ten_don_vi,
      ma_don_vi: targetDvtt.ma_don_vi,
      danh_hieu: DANH_HIEU_DON_VI_HANG_NAM.DVQT,
    });
    expect(data.data_danh_hieu[0].co_quan_don_vi_cha).toEqual(parentCqdv);
  });

  it('bypass FE — reject duplicate khi đơn vị đã có record cùng năm trong DB', async () => {
    // Cho trước: đã có danh hiệu đơn vị (ĐVQT) cho cùng năm/đơn vị
    arrangeManagerWithUnit('CQDV');
    const targetUnit = makeUnit({ kind: 'CQDV', id: 'cqdv-dup' });
    prismaMock.coQuanDonVi.findUnique.mockResolvedValueOnce({
      id: targetUnit.id,
      ten_don_vi: targetUnit.ten_don_vi,
      ma_don_vi: targetUnit.ma_don_vi,
    });
    prismaMock.danhHieuDonViHangNam.findFirst.mockReset();
    prismaMock.danhHieuDonViHangNam.findFirst.mockResolvedValueOnce({
      id: 'existing-uv-1',
      co_quan_don_vi_id: targetUnit.id,
      don_vi_truc_thuoc_id: null,
      nam: 2024,
      danh_hieu: DANH_HIEU_DON_VI_HANG_NAM.DVQT,
      nhan_bkbqp: false,
      nhan_bkttcp: false,
    });

    // Khi + Kết quả
    const dupErr = await expectError(
      callSubmitDonVi([
        {
          don_vi_id: targetUnit.id,
          don_vi_type: 'CO_QUAN_DON_VI',
          danh_hieu: DANH_HIEU_DON_VI_HANG_NAM.DVQT,
        },
      ]),
      ValidationError,
      { startsWith: 'Phát hiện đề xuất trùng (cùng năm và cùng danh hiệu):\n' }
    );
    expect(dupErr.message).toBe(
      `Phát hiện đề xuất trùng (cùng năm và cùng danh hiệu):\n${targetUnit.ten_don_vi}: Đơn vị đã có danh hiệu Đơn vị quyết thắng năm 2024 trên hệ thống`
    );
    expect(prismaMock.bangDeXuat.create).not.toHaveBeenCalled();
  });

  it('bypass FE — reject pending conflict cùng đơn vị/danh hiệu/năm', async () => {
    // Cho trước: đã có proposal PENDING cho cùng đơn vị/năm/danh_hieu
    arrangeManagerWithUnit('CQDV');
    const targetUnit = makeUnit({ kind: 'CQDV', id: 'cqdv-pending' });
    prismaMock.coQuanDonVi.findUnique.mockResolvedValueOnce({
      id: targetUnit.id,
      ten_don_vi: targetUnit.ten_don_vi,
      ma_don_vi: targetUnit.ma_don_vi,
    });
    prismaMock.bangDeXuat.findMany.mockReset();
    prismaMock.bangDeXuat.findMany.mockResolvedValueOnce([
      {
        id: 'pending-uv-1',
        loai_de_xuat: PROPOSAL_TYPES.DON_VI_HANG_NAM,
        nam: 2024,
        status: PROPOSAL_STATUS.PENDING,
        data_danh_hieu: [
          {
            don_vi_id: targetUnit.id,
            don_vi_type: 'CO_QUAN_DON_VI',
            danh_hieu: DANH_HIEU_DON_VI_HANG_NAM.DVQT,
          },
        ],
      },
    ]);

    const pendingErr = await expectError(
      callSubmitDonVi([
        {
          don_vi_id: targetUnit.id,
          don_vi_type: 'CO_QUAN_DON_VI',
          danh_hieu: DANH_HIEU_DON_VI_HANG_NAM.DVQT,
        },
      ]),
      ValidationError,
      { startsWith: 'Phát hiện đề xuất trùng (cùng năm và cùng danh hiệu):\n' }
    );
    expect(pendingErr.message).toBe(
      `Phát hiện đề xuất trùng (cùng năm và cùng danh hiệu):\n${targetUnit.ten_don_vi}: Đơn vị đã có đề xuất danh hiệu Đơn vị quyết thắng cho năm 2024`
    );
    expect(prismaMock.bangDeXuat.create).not.toHaveBeenCalled();
  });

  it('bypass FE — reject khi đơn vị chưa đủ ĐK BKBQP đơn vị', async () => {
    arrangeManagerWithUnit('CQDV');
    const targetUnit = makeUnit({ kind: 'CQDV', id: 'cqdv-not-elig' });
    prismaMock.coQuanDonVi.findUnique.mockResolvedValueOnce({
      id: targetUnit.id,
      ten_don_vi: targetUnit.ten_don_vi,
      ma_don_vi: targetUnit.ma_don_vi,
    });
    (unitAnnualAwardService.checkUnitAwardEligibility as jest.Mock).mockReset();
    (unitAnnualAwardService.checkUnitAwardEligibility as jest.Mock).mockResolvedValueOnce({
      eligible: false,
      reason: 'Chưa đủ điều kiện BKBQP: cần 2 năm ĐVQT liên tục',
    });

    const eligErr = await expectError(
      callSubmitDonVi([
        {
          don_vi_id: targetUnit.id,
          don_vi_type: 'CO_QUAN_DON_VI',
          danh_hieu: DANH_HIEU_DON_VI_HANG_NAM.BKBQP,
        },
      ]),
      ValidationError,
      { startsWith: 'Một số đơn vị chưa đủ điều kiện:\n' }
    );
    expect(eligErr.message).toBe(
      `Một số đơn vị chưa đủ điều kiện:\n${targetUnit.ten_don_vi}: Chưa đủ điều kiện BKBQP: cần 2 năm ĐVQT liên tục`
    );
    expect(prismaMock.bangDeXuat.create).not.toHaveBeenCalled();
  });

  it('bypass FE — reject khi đơn vị chưa đủ ĐK BKTTCP đơn vị', async () => {
    arrangeManagerWithUnit('CQDV');
    const targetUnit = makeUnit({ kind: 'CQDV', id: 'cqdv-not-elig-bkttcp' });
    prismaMock.coQuanDonVi.findUnique.mockResolvedValueOnce({
      id: targetUnit.id,
      ten_don_vi: targetUnit.ten_don_vi,
      ma_don_vi: targetUnit.ma_don_vi,
    });
    (unitAnnualAwardService.checkUnitAwardEligibility as jest.Mock).mockReset();
    (unitAnnualAwardService.checkUnitAwardEligibility as jest.Mock).mockResolvedValueOnce({
      eligible: false,
      reason: 'Chưa đủ điều kiện BKTTCP: cần 7 năm ĐVQT + 3 BKBQP',
    });

    const eligBkttcpErr = await expectError(
      callSubmitDonVi([
        {
          don_vi_id: targetUnit.id,
          don_vi_type: 'CO_QUAN_DON_VI',
          danh_hieu: DANH_HIEU_DON_VI_HANG_NAM.BKTTCP,
        },
      ]),
      ValidationError,
      { startsWith: 'Một số đơn vị chưa đủ điều kiện:\n' }
    );
    expect(eligBkttcpErr.message).toBe(
      `Một số đơn vị chưa đủ điều kiện:\n${targetUnit.ten_don_vi}: Chưa đủ điều kiện BKTTCP: cần 7 năm ĐVQT + 3 BKBQP`
    );
    expect(prismaMock.bangDeXuat.create).not.toHaveBeenCalled();
  });
});
