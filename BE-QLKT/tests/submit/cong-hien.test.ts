import { prismaMock, resetPrismaMock } from '../helpers/prismaMock';
import { makePersonnel, makeUnit, makeAdmin } from '../helpers/fixtures';
import { expectError } from '../helpers/errorAssert';

import proposalService from '../../src/services/proposal';
import { ValidationError } from '../../src/middlewares/errorHandler';
import { PROPOSAL_TYPES } from '../../src/constants/proposalTypes.constants';
import { PROPOSAL_STATUS } from '../../src/constants/proposalStatus.constants';
import { DANH_HIEU_HCBVTQ } from '../../src/constants/danhHieu.constants';
import {
  SUBMIT_MISSING_MONTH_ERROR,
  DUPLICATE_PREFIX,
  CONG_HIEN_SUBMIT_DUPLICATE_ACTUAL,
  CONG_HIEN_SUBMIT_DUPLICATE_PENDING,
  HCBVTQ_HIGHEST_DOWNGRADE_FRAGMENT,
} from '../helpers/errorMessages';

beforeEach(() => {
  resetPrismaMock();
  // Default no-duplicate state — individual tests override to simulate conflicts.
  prismaMock.khenThuongHCBVTQ.findFirst.mockResolvedValue(null);
  prismaMock.bangDeXuat.findMany.mockResolvedValue([]);
});

afterEach(() => {
  jest.restoreAllMocks();
});

interface CongHienItem {
  personnel_id: string;
  danh_hieu: string;
  cap_bac?: string | null;
  chuc_vu?: string | null;
  so_quyet_dinh?: string | null;
}

interface CongHienHistoryRow {
  quan_nhan_id: string;
  he_so_chuc_vu: number;
  so_thang: number | null;
  ngay_bat_dau: Date | null;
  ngay_ket_thuc: Date | null;
}

const ADMIN_ID = 'acc-cong-hien-mgr';

function escapeRegExp(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildDuplicateRegex(suffix: string): RegExp {
  return new RegExp(`^${escapeRegExp(DUPLICATE_PREFIX)}\\n${escapeRegExp(suffix)}$`);
}

function arrangeCongHienManager(unitKind: 'CQDV' | 'DVTT' = 'CQDV') {
  const unit = makeUnit({
    kind: unitKind,
    id: unitKind === 'CQDV' ? 'cqdv-ch-mgr' : 'dvtt-ch-mgr',
  });
  const managerQn = makePersonnel({ unit, id: 'qn-ch-manager', ho_ten: 'Manager CH' });
  const account = makeAdmin({ id: ADMIN_ID, quanNhan: managerQn });
  prismaMock.taiKhoan.findUnique.mockResolvedValueOnce({
    ...account,
    QuanNhan: {
      ...managerQn,
      CoQuanDonVi: unit.kind === 'CQDV' ? unit.CoQuanDonVi : null,
      DonViTrucThuoc:
        unit.kind === 'DVTT'
          ? { ...unit.DonViTrucThuoc!, CoQuanDonVi: unit.DonViTrucThuoc!.CoQuanDonVi }
          : null,
    },
  });
  return { unit };
}

function callCongHienSubmit(
  items: CongHienItem[],
  thang: number | null = 6,
  nam = 2024
) {
  return proposalService.submitProposal(
    items,
    null,    ADMIN_ID,
    PROPOSAL_TYPES.CONG_HIEN,
    nam,
    null,
    thang
  );
}

function mockBangDeXuatCreated(id = 'p-ch-1') {
  prismaMock.bangDeXuat.create.mockResolvedValueOnce({
    id,
    loai_de_xuat: PROPOSAL_TYPES.CONG_HIEN,
    status: PROPOSAL_STATUS.PENDING,
    createdAt: new Date(),
    DonViTrucThuoc: null,
    CoQuanDonVi: { ten_don_vi: 'Đơn vị manager' },
    NguoiDeXuat: { id: ADMIN_ID, username: 'admin', QuanNhan: null },
  });
}

describe('proposal.submit - CONG_HIEN (HCBVTQ)', () => {
  it('gửi thành công với hệ số TB 0.85 (60 tháng 0.8 + 60 tháng 0.9) → proposal lưu data_cong_hien', async () => {
    // Given: a manager + 1 male personnel + 120 months across hệ số groups 0.8 and 0.9
    arrangeCongHienManager('CQDV');
    const target = makePersonnel({
      id: 'qn-ch-1',
      ho_ten: 'Quân nhân CH',
      gioi_tinh: 'NAM',
    });
    prismaMock.quanNhan.findMany.mockResolvedValue([target]);
    const histories: CongHienHistoryRow[] = [
      {
        quan_nhan_id: target.id,
        he_so_chuc_vu: 0.8,
        so_thang: 72,
        ngay_bat_dau: new Date('2012-01-01'),
        ngay_ket_thuc: new Date('2017-12-31'),
      },
      {
        quan_nhan_id: target.id,
        he_so_chuc_vu: 0.9,
        so_thang: 72,
        ngay_bat_dau: new Date('2018-01-01'),
        ngay_ket_thuc: new Date('2023-12-31'),
      },
    ];
    prismaMock.lichSuChucVu.findMany.mockResolvedValue(histories);
    mockBangDeXuatCreated('p-ch-1');

    // When
    await callCongHienSubmit([
      { personnel_id: target.id, danh_hieu: DANH_HIEU_HCBVTQ.HANG_NHI },
    ]);

    // Then
    expect(prismaMock.bangDeXuat.create).toHaveBeenCalledTimes(1);
    const data = prismaMock.bangDeXuat.create.mock.calls[0][0].data;
    expect(data.loai_de_xuat).toBe(PROPOSAL_TYPES.CONG_HIEN);
    expect(data.thang).toBe(6);
    expect(Array.isArray(data.data_cong_hien)).toBe(true);
    expect(data.data_cong_hien[0]).toMatchObject({
      personnel_id: target.id,
      danh_hieu: DANH_HIEU_HCBVTQ.HANG_NHI,
      nam: 2024,
      thang: 6,
    });
    expect(data.data_cong_hien[0].thoi_gian_nhom_0_8).toBeDefined();
    expect(data.data_cong_hien[0].thoi_gian_nhom_0_9_1_0).toBeDefined();
  });

  it('gửi thành công cho QN nữ — payload vẫn lưu đầy đủ', async () => {
    arrangeCongHienManager('CQDV');
    const target = makePersonnel({
      id: 'qn-ch-female',
      ho_ten: 'Nữ Quân nhân',
      gioi_tinh: 'NU',
    });
    prismaMock.quanNhan.findMany.mockResolvedValue([target]);
    prismaMock.lichSuChucVu.findMany.mockResolvedValue([
      {
        quan_nhan_id: target.id,
        he_so_chuc_vu: 0.7,
        so_thang: 84,
        ngay_bat_dau: new Date('2017-01-01'),
        ngay_ket_thuc: new Date('2023-12-31'),
      },
    ]);
    mockBangDeXuatCreated('p-ch-fem');

    await callCongHienSubmit([
      { personnel_id: target.id, danh_hieu: DANH_HIEU_HCBVTQ.HANG_BA },
    ]);

    const data = prismaMock.bangDeXuat.create.mock.calls[0][0].data;
    expect(data.data_cong_hien[0].personnel_id).toBe('qn-ch-female');
    expect(data.data_cong_hien[0].danh_hieu).toBe(DANH_HIEU_HCBVTQ.HANG_BA);
  });

  it('reject khi thiếu tháng (CONG_HIEN bắt buộc thang)', async () => {
    arrangeCongHienManager('CQDV');

    await expectError(
      callCongHienSubmit(
        [{ personnel_id: 'qn-ch-no-thang', danh_hieu: DANH_HIEU_HCBVTQ.HANG_BA }],
        null
      ),
      ValidationError,
      SUBMIT_MISSING_MONTH_ERROR
    );
    expect(prismaMock.bangDeXuat.create).not.toHaveBeenCalled();
  });

  it('reject khi titleData không phải mảng', async () => {
    arrangeCongHienManager('CQDV');

    await expectError(
      proposalService.submitProposal(
        null as never,
        null,        ADMIN_ID,
        PROPOSAL_TYPES.CONG_HIEN,
        2024,
        null,
        6
      ),
      ValidationError,
      'Dữ liệu đề xuất không hợp lệ'
    );
    expect(prismaMock.bangDeXuat.create).not.toHaveBeenCalled();
  });

  it('gửi thành công với DVTT — proposal lưu don_vi_truc_thuoc_id', async () => {
    arrangeCongHienManager('DVTT');
    const target = makePersonnel({
      id: 'qn-ch-dvtt',
      ho_ten: 'QN DVTT',
      gioi_tinh: 'NAM',
    });
    prismaMock.quanNhan.findMany.mockResolvedValue([target]);
    prismaMock.lichSuChucVu.findMany.mockResolvedValue([
      {
        quan_nhan_id: target.id,
        he_so_chuc_vu: 0.7,
        so_thang: 132,
        ngay_bat_dau: new Date('2012-01-01'),
        ngay_ket_thuc: new Date('2023-12-31'),
      },
    ]);
    mockBangDeXuatCreated('p-ch-dvtt');

    await callCongHienSubmit([
      { personnel_id: target.id, danh_hieu: DANH_HIEU_HCBVTQ.HANG_BA },
    ]);

    const data = prismaMock.bangDeXuat.create.mock.calls[0][0].data;
    expect(data.don_vi_truc_thuoc_id).toBe('dvtt-ch-mgr');
    expect(data.co_quan_don_vi_id).toBe(null);
  });

  it('reject khi quân nhân đã có HCBVTQ trên hệ thống — duplicate actual', async () => {
    arrangeCongHienManager('CQDV');
    const target = makePersonnel({
      id: 'qn-ch-dup-actual',
      ho_ten: 'QN Đã Có HCBVTQ',
      gioi_tinh: 'NAM',
    });
    prismaMock.quanNhan.findMany.mockResolvedValue([target]);
    prismaMock.lichSuChucVu.findMany.mockResolvedValue([
      {
        quan_nhan_id: target.id,
        he_so_chuc_vu: 0.9,
        so_thang: 132,
        ngay_bat_dau: new Date('2012-01-01'),
        ngay_ket_thuc: new Date('2023-12-31'),
      },
    ]);
    prismaMock.khenThuongHCBVTQ.findFirst.mockResolvedValue({
      id: 'kt-existing',
      quan_nhan_id: target.id,
      danh_hieu: DANH_HIEU_HCBVTQ.HANG_BA,
      nam: 2022,
    });

    await expectError(
      callCongHienSubmit([
        { personnel_id: target.id, danh_hieu: DANH_HIEU_HCBVTQ.HANG_NHI },
      ]),
      ValidationError,
      buildDuplicateRegex(`${target.ho_ten}: ${CONG_HIEN_SUBMIT_DUPLICATE_ACTUAL(
          'Huân chương Bảo vệ Tổ quốc hạng Ba',
          2022
        )}`
      )
    );
    expect(prismaMock.bangDeXuat.create).not.toHaveBeenCalled();
  });

  it('reject khi quân nhân đang có pending CONG_HIEN proposal — duplicate pending', async () => {
    arrangeCongHienManager('CQDV');
    const target = makePersonnel({
      id: 'qn-ch-dup-pending',
      ho_ten: 'QN Có Pending',
      gioi_tinh: 'NAM',
    });
    prismaMock.quanNhan.findMany.mockResolvedValue([target]);
    prismaMock.lichSuChucVu.findMany.mockResolvedValue([
      {
        quan_nhan_id: target.id,
        he_so_chuc_vu: 0.9,
        so_thang: 132,
        ngay_bat_dau: new Date('2012-01-01'),
        ngay_ket_thuc: new Date('2023-12-31'),
      },
    ]);
    prismaMock.bangDeXuat.findMany.mockResolvedValue([
      {
        id: 'p-pending-1',
        nam: 2024,
        data_cong_hien: [
          { personnel_id: target.id, danh_hieu: DANH_HIEU_HCBVTQ.HANG_NHI },
        ],
      },
    ]);

    await expectError(
      callCongHienSubmit([
        { personnel_id: target.id, danh_hieu: DANH_HIEU_HCBVTQ.HANG_NHI },
      ]),
      ValidationError,
      buildDuplicateRegex(`${target.ho_ten}: ${CONG_HIEN_SUBMIT_DUPLICATE_PENDING(
          'Huân chương Bảo vệ Tổ quốc hạng Nhì',
          2024
        )}`
      )
    );
    expect(prismaMock.bangDeXuat.create).not.toHaveBeenCalled();
  });

  it('gom errors theo từng QN khi 1 QN duplicate, 1 QN hợp lệ trong cùng payload', async () => {
    arrangeCongHienManager('CQDV');
    const valid = makePersonnel({
      id: 'qn-ch-valid',
      ho_ten: 'QN Hợp Lệ',
      gioi_tinh: 'NAM',
    });
    const dup = makePersonnel({
      id: 'qn-ch-dup',
      ho_ten: 'QN Trùng',
      gioi_tinh: 'NAM',
    });
    prismaMock.quanNhan.findMany.mockResolvedValue([valid, dup]);
    prismaMock.lichSuChucVu.findMany.mockResolvedValue([
      {
        quan_nhan_id: valid.id,
        he_so_chuc_vu: 0.9,
        so_thang: 132,
        ngay_bat_dau: new Date('2012-01-01'),
        ngay_ket_thuc: new Date('2023-12-31'),
      },
      {
        quan_nhan_id: dup.id,
        he_so_chuc_vu: 0.9,
        so_thang: 132,
        ngay_bat_dau: new Date('2012-01-01'),
        ngay_ket_thuc: new Date('2023-12-31'),
      },
    ]);
    // Only `dup` triggers duplicate; findFirst is called per personnel in the loop.
    prismaMock.khenThuongHCBVTQ.findFirst.mockImplementation(
      async (args: { where: { quan_nhan_id: string } }) => {
        if (args.where.quan_nhan_id === dup.id) {
          return {
            id: 'kt-existing-dup',
            quan_nhan_id: dup.id,
            danh_hieu: DANH_HIEU_HCBVTQ.HANG_BA,
            nam: 2021,
          };
        }
        return null;
      }
    );

    await expectError(
      callCongHienSubmit([
        { personnel_id: valid.id, danh_hieu: DANH_HIEU_HCBVTQ.HANG_NHI },
        { personnel_id: dup.id, danh_hieu: DANH_HIEU_HCBVTQ.HANG_NHI },
      ]),
      ValidationError,
      buildDuplicateRegex(`${dup.ho_ten}: ${CONG_HIEN_SUBMIT_DUPLICATE_ACTUAL(
          'Huân chương Bảo vệ Tổ quốc hạng Ba',
          2021
        )}`
      )
    );
    expect(prismaMock.bangDeXuat.create).not.toHaveBeenCalled();
  });

  it('reject khi quân nhân không có lịch sử chức vụ — không đủ điều kiện CONG_HIEN', async () => {
    arrangeCongHienManager('CQDV');
    const target = makePersonnel({ id: 'qn-ch-empty', gioi_tinh: 'NAM' });
    prismaMock.quanNhan.findMany.mockResolvedValue([target]);
    prismaMock.lichSuChucVu.findMany.mockResolvedValue([]);

    await expectError(
      callCongHienSubmit([
        { personnel_id: target.id, danh_hieu: DANH_HIEU_HCBVTQ.HANG_BA },
      ]),
      ValidationError,
      /không đủ điều kiện đề xuất Huân chương Bảo vệ Tổ quốc hạng Ba/
    );
    expect(prismaMock.bangDeXuat.create).not.toHaveBeenCalled();
  });

  it('HCBVTQ_HIGHEST: reject khi đề xuất HANG_BA nhưng QN đủ ĐK HANG_NHAT', async () => {
    arrangeCongHienManager('CQDV');
    const target = makePersonnel({
      id: 'qn-ch-highest-ba',
      ho_ten: 'QN HANG_NHAT eligible',
      gioi_tinh: 'NAM',
    });
    prismaMock.quanNhan.findMany.mockResolvedValue([target]);
    prismaMock.lichSuChucVu.findMany.mockResolvedValue([
      {
        quan_nhan_id: target.id,
        he_so_chuc_vu: 0.9,
        so_thang: 200,
        ngay_bat_dau: new Date('2007-01-01'),
        ngay_ket_thuc: new Date('2023-12-31'),
      },
    ]);

    const error = await expectError(
      callCongHienSubmit([
        { personnel_id: target.id, danh_hieu: DANH_HIEU_HCBVTQ.HANG_BA },
      ]),
      ValidationError,
      new RegExp(HCBVTQ_HIGHEST_DOWNGRADE_FRAGMENT)
    );
    expect(error.message).toContain('hạng Ba');
    expect(error.message).toContain('hạng Nhất');
    expect(prismaMock.bangDeXuat.create).not.toHaveBeenCalled();
  });

  it('HCBVTQ_HIGHEST: reject khi đề xuất HANG_NHI nhưng QN đủ ĐK HANG_NHAT', async () => {
    arrangeCongHienManager('CQDV');
    const target = makePersonnel({
      id: 'qn-ch-highest-nhi',
      ho_ten: 'QN HANG_NHAT eligible 2',
      gioi_tinh: 'NAM',
    });
    prismaMock.quanNhan.findMany.mockResolvedValue([target]);
    prismaMock.lichSuChucVu.findMany.mockResolvedValue([
      {
        quan_nhan_id: target.id,
        he_so_chuc_vu: 0.95,
        so_thang: 150,
        ngay_bat_dau: new Date('2011-01-01'),
        ngay_ket_thuc: new Date('2023-12-31'),
      },
    ]);

    const error = await expectError(
      callCongHienSubmit([
        { personnel_id: target.id, danh_hieu: DANH_HIEU_HCBVTQ.HANG_NHI },
      ]),
      ValidationError,
      new RegExp(HCBVTQ_HIGHEST_DOWNGRADE_FRAGMENT)
    );
    expect(error.message).toContain('hạng Nhì');
    expect(error.message).toContain('hạng Nhất');
    expect(prismaMock.bangDeXuat.create).not.toHaveBeenCalled();
  });

  it('HCBVTQ_HIGHEST: chấp nhận đề xuất HANG_NHAT khi QN đủ ĐK HANG_NHAT', async () => {
    arrangeCongHienManager('CQDV');
    const target = makePersonnel({
      id: 'qn-ch-highest-nhat-ok',
      ho_ten: 'QN HANG_NHAT eligible 3',
      gioi_tinh: 'NAM',
    });
    prismaMock.quanNhan.findMany.mockResolvedValue([target]);
    prismaMock.lichSuChucVu.findMany.mockResolvedValue([
      {
        quan_nhan_id: target.id,
        he_so_chuc_vu: 0.9,
        so_thang: 130,
        ngay_bat_dau: new Date('2013-01-01'),
        ngay_ket_thuc: new Date('2023-12-31'),
      },
    ]);
    mockBangDeXuatCreated('p-ch-nhat-ok');

    await callCongHienSubmit([
      { personnel_id: target.id, danh_hieu: DANH_HIEU_HCBVTQ.HANG_NHAT },
    ]);

    expect(prismaMock.bangDeXuat.create).toHaveBeenCalledTimes(1);
  });

  it('HCBVTQ_HIGHEST: chấp nhận đề xuất HANG_BA khi QN chỉ đủ ĐK HANG_BA', async () => {
    arrangeCongHienManager('CQDV');
    const target = makePersonnel({
      id: 'qn-ch-only-ba',
      ho_ten: 'QN chỉ HANG_BA',
      gioi_tinh: 'NAM',
    });
    prismaMock.quanNhan.findMany.mockResolvedValue([target]);
    prismaMock.lichSuChucVu.findMany.mockResolvedValue([
      {
        quan_nhan_id: target.id,
        he_so_chuc_vu: 0.7,
        so_thang: 130,
        ngay_bat_dau: new Date('2013-01-01'),
        ngay_ket_thuc: new Date('2023-12-31'),
      },
    ]);
    mockBangDeXuatCreated('p-ch-only-ba');

    await callCongHienSubmit([
      { personnel_id: target.id, danh_hieu: DANH_HIEU_HCBVTQ.HANG_BA },
    ]);

    expect(prismaMock.bangDeXuat.create).toHaveBeenCalledTimes(1);
  });
});
