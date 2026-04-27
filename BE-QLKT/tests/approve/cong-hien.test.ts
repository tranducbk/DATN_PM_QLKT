import { prismaMock, resetPrismaMock } from '../helpers/prismaMock';
import { makeProposal, makePersonnel, makeUnit } from '../helpers/fixtures';
import { expectError } from '../helpers/errorAssert';

import proposalService from '../../src/services/proposal';
import { ValidationError } from '../../src/middlewares/errorHandler';
import { PROPOSAL_TYPES } from '../../src/constants/proposalTypes.constants';
import { PROPOSAL_STATUS } from '../../src/constants/proposalStatus.constants';
import { DANH_HIEU_HCBVTQ } from '../../src/constants/danhHieu.constants';
import {
  APPROVE_MISSING_MONTH_ERROR,
  APPROVE_ELIGIBILITY_PREFIX,
  CONG_HIEN_APPROVE_INELIGIBLE_PREFIX,
  HCBVTQ_HIGHEST_DOWNGRADE_FRAGMENT,
} from '../helpers/errorMessages';

beforeEach(() => {
  resetPrismaMock();
});

afterEach(() => {
  jest.restoreAllMocks();
});

const ADMIN_ID = 'acc-admin-ch';

interface CongHienApproveItem {
  personnel_id: string;
  ho_ten?: string;
  danh_hieu: string;
  cap_bac?: string | null;
  chuc_vu?: string | null;
  nam_nhan: number;
  thang_nhan: number;
  so_quyet_dinh?: string | null;
  thoi_gian_nhom_0_7?: unknown;
  thoi_gian_nhom_0_8?: unknown;
  thoi_gian_nhom_0_9_1_0?: unknown;
}

function buildCongHienItem(
  personnelId: string,
  danhHieu: string,
  override: Partial<CongHienApproveItem> = {}
): CongHienApproveItem {
  return {
    personnel_id: personnelId,
    ho_ten: 'Nguyễn CH',
    danh_hieu: danhHieu,
    cap_bac: 'Đại uý',
    chuc_vu: 'Trợ lý',
    nam_nhan: 2024,
    thang_nhan: 6,
    so_quyet_dinh: 'QD-CH-1',
    thoi_gian_nhom_0_7: { total_months: 0, years: 0, months: 0, display: '-' },
    thoi_gian_nhom_0_8: { total_months: 60, years: 5, months: 0, display: '5 năm' },
    thoi_gian_nhom_0_9_1_0: { total_months: 60, years: 5, months: 0, display: '5 năm' },
    ...override,
  };
}

interface PositionHistoryRow {
  quan_nhan_id: string;
  he_so_chuc_vu: number;
  so_thang: number | null;
  ngay_bat_dau: Date | null;
  ngay_ket_thuc: Date | null;
}

function buildEligibleHistories(personnelId: string): PositionHistoryRow[] {
  return [
    {
      quan_nhan_id: personnelId,
      he_so_chuc_vu: 0.8,
      so_thang: 72,
      ngay_bat_dau: new Date('2012-01-01'),
      ngay_ket_thuc: new Date('2018-01-01'),
    },
    {
      quan_nhan_id: personnelId,
      he_so_chuc_vu: 0.9,
      so_thang: 72,
      ngay_bat_dau: new Date('2018-01-01'),
      ngay_ket_thuc: new Date('2024-01-01'),
    },
  ];
}

describe('approveProposal — CONG_HIEN (HCBVTQ)', () => {
  it('duyệt thành công HCBVTQ hạng nhì cho QN nam đủ tháng', async () => {
    // Given: đề xuất CONG_HIEN PENDING + quân nhân đủ tháng giữ chức
    const cqdv = makeUnit({ kind: 'CQDV', id: 'cqdv-ch' });
    const personnel = makePersonnel({
      unit: cqdv,
      id: 'qn-ch-1',
      ho_ten: 'Nguyễn CH',
      gioi_tinh: 'NAM',
    });
    const proposal = makeProposal({
      id: 'p-ch-1',
      loai: PROPOSAL_TYPES.CONG_HIEN,
      nam: 2024,
      thang: 6,
      nguoi_de_xuat_id: ADMIN_ID,
      unit: cqdv,
      data_cong_hien: [
        buildCongHienItem(personnel.id, DANH_HIEU_HCBVTQ.HANG_NHI, { ho_ten: personnel.ho_ten }),
      ],
    });

    prismaMock.bangDeXuat.findUnique.mockResolvedValueOnce(proposal);
    prismaMock.quanNhan.findMany.mockResolvedValueOnce([
      { id: personnel.id, ho_ten: personnel.ho_ten, gioi_tinh: 'NAM' },
    ]);
    prismaMock.lichSuChucVu.findMany.mockResolvedValueOnce(buildEligibleHistories(personnel.id));
    prismaMock.quanNhan.findUnique.mockResolvedValueOnce(personnel);
    prismaMock.khenThuongHCBVTQ.findUnique.mockResolvedValueOnce(null);
    prismaMock.khenThuongHCBVTQ.create.mockResolvedValueOnce({
      id: 'kt-ch-1',
      quan_nhan_id: personnel.id,
      danh_hieu: DANH_HIEU_HCBVTQ.HANG_NHI,
    });
    prismaMock.hoSoCongHien.upsert.mockResolvedValueOnce({});
    prismaMock.bangDeXuat.updateMany.mockResolvedValueOnce({ count: 1 });

    // When: gọi duyệt
    const result = await proposalService.approveProposal(proposal.id, {}, ADMIN_ID, {}, {}, null);

    // Then: HCBVTQ được tạo và đề xuất chuyển APPROVED
    expect(prismaMock.khenThuongHCBVTQ.create).toHaveBeenCalledTimes(1);
    const createArgs = prismaMock.khenThuongHCBVTQ.create.mock.calls[0][0];
    expect(createArgs.data).toMatchObject({
      quan_nhan_id: personnel.id,
      danh_hieu: DANH_HIEU_HCBVTQ.HANG_NHI,
      nam: 2024,
      thang: 6,
      so_quyet_dinh: 'QD-CH-1',
    });
    expect(prismaMock.bangDeXuat.updateMany.mock.calls[0][0].data.status).toBe(
      PROPOSAL_STATUS.APPROVED
    );
    expect(result.message).toBe('Phê duyệt thành công, đã thêm 1 danh hiệu cho 1 quân nhân');
  });

  it('reject khi proposal thiếu tháng (CONG_HIEN bắt buộc thang)', async () => {
    const proposal = makeProposal({
      id: 'p-ch-no-thang',
      loai: PROPOSAL_TYPES.CONG_HIEN,
      nam: 2024,
      thang: null,
      nguoi_de_xuat_id: ADMIN_ID,
      data_cong_hien: [],
    });
    prismaMock.bangDeXuat.findUnique.mockResolvedValueOnce(proposal);

    await expectError(
      proposalService.approveProposal(proposal.id, {}, ADMIN_ID, {}, {}, null),
      ValidationError,
      APPROVE_MISSING_MONTH_ERROR
    );
    expect(prismaMock.khenThuongHCBVTQ.create).not.toHaveBeenCalled();
  });

  it('reject khi quân nhân không đủ tháng phục vụ (nam <120m)', async () => {
    const personnel = makePersonnel({ id: 'qn-short', ho_ten: 'QN Ngắn', gioi_tinh: 'NAM' });
    const proposal = makeProposal({
      id: 'p-ch-short',
      loai: PROPOSAL_TYPES.CONG_HIEN,
      nam: 2024,
      thang: 6,
      nguoi_de_xuat_id: ADMIN_ID,
      data_cong_hien: [buildCongHienItem(personnel.id, DANH_HIEU_HCBVTQ.HANG_NHI)],
    });
    prismaMock.bangDeXuat.findUnique.mockResolvedValueOnce(proposal);
    prismaMock.quanNhan.findMany.mockResolvedValueOnce([
      { id: personnel.id, ho_ten: personnel.ho_ten, gioi_tinh: 'NAM' },
    ]);
    prismaMock.lichSuChucVu.findMany.mockResolvedValueOnce([
      {
        quan_nhan_id: personnel.id,
        he_so_chuc_vu: 0.8,
        so_thang: 24,
        ngay_bat_dau: new Date('2022-01-01'),
        ngay_ket_thuc: new Date('2023-12-31'),
      },
    ]);

    await expectError(
      proposalService.approveProposal(proposal.id, {}, ADMIN_ID, {}, {}, null),
      ValidationError,
      { startsWith: APPROVE_ELIGIBILITY_PREFIX }
    );
    expect(prismaMock.khenThuongHCBVTQ.create).not.toHaveBeenCalled();
  });

  it('reject khi QN nữ không đủ tháng phục vụ (nữ cần 80m)', async () => {
    const personnel = makePersonnel({
      id: 'qn-fem-short',
      ho_ten: 'Nữ Ngắn',
      gioi_tinh: 'NU',
    });
    const proposal = makeProposal({
      id: 'p-ch-fem-short',
      loai: PROPOSAL_TYPES.CONG_HIEN,
      nam: 2024,
      thang: 6,
      nguoi_de_xuat_id: ADMIN_ID,
      data_cong_hien: [buildCongHienItem(personnel.id, DANH_HIEU_HCBVTQ.HANG_NHI)],
    });
    prismaMock.bangDeXuat.findUnique.mockResolvedValueOnce(proposal);
    prismaMock.quanNhan.findMany.mockResolvedValueOnce([
      { id: personnel.id, ho_ten: personnel.ho_ten, gioi_tinh: 'NU' },
    ]);
    prismaMock.lichSuChucVu.findMany.mockResolvedValueOnce([
      {
        quan_nhan_id: personnel.id,
        he_so_chuc_vu: 0.8,
        so_thang: 36,
        ngay_bat_dau: new Date('2021-01-01'),
        ngay_ket_thuc: new Date('2023-12-31'),
      },
    ]);

    const error = await expectError(
      proposalService.approveProposal(proposal.id, {}, ADMIN_ID, {}, {}, null),
      ValidationError,
      { startsWith: APPROVE_ELIGIBILITY_PREFIX }
    );
    expect(error.message).toContain(CONG_HIEN_APPROVE_INELIGIBLE_PREFIX);
  });

  it('reject khi QN đã có HCBVTQ rank thấp hơn (one-time award, cần upgrade)', async () => {
    const personnel = makePersonnel({ id: 'qn-existing', ho_ten: 'QN Đã có', gioi_tinh: 'NAM' });
    const proposal = makeProposal({
      id: 'p-ch-existing',
      loai: PROPOSAL_TYPES.CONG_HIEN,
      nam: 2024,
      thang: 6,
      nguoi_de_xuat_id: ADMIN_ID,
      data_cong_hien: [buildCongHienItem(personnel.id, DANH_HIEU_HCBVTQ.HANG_BA)],
    });

    prismaMock.bangDeXuat.findUnique.mockResolvedValueOnce(proposal);
    prismaMock.quanNhan.findMany.mockResolvedValueOnce([
      { id: personnel.id, ho_ten: personnel.ho_ten, gioi_tinh: 'NAM' },
    ]);
    prismaMock.lichSuChucVu.findMany.mockResolvedValueOnce([
      {
        quan_nhan_id: personnel.id,
        he_so_chuc_vu: 0.7,
        so_thang: 130,
        ngay_bat_dau: new Date('2013-01-01'),
        ngay_ket_thuc: new Date('2023-12-31'),
      },
    ]);
    prismaMock.quanNhan.findUnique.mockResolvedValueOnce(personnel);
    prismaMock.khenThuongHCBVTQ.findUnique.mockResolvedValueOnce({
      id: 'kt-existing',
      quan_nhan_id: personnel.id,
      danh_hieu: DANH_HIEU_HCBVTQ.HANG_NHI,
      nam: 2022,
    });
    prismaMock.bangDeXuat.updateMany.mockResolvedValueOnce({ count: 1 });

    await expectError(
      proposalService.approveProposal(proposal.id, {}, ADMIN_ID, {}, {}, null),
      ValidationError,
      { startsWith: 'Không thể phê duyệt đề xuất do có' }
    );
    expect(prismaMock.khenThuongHCBVTQ.create).not.toHaveBeenCalled();
    expect(prismaMock.khenThuongHCBVTQ.update).not.toHaveBeenCalled();
  });

  it('upgrade rank — QN đã có HCBVTQ hạng ba, đề xuất hạng nhì → update', async () => {
    const personnel = makePersonnel({ id: 'qn-up', ho_ten: 'QN Up', gioi_tinh: 'NAM' });
    const proposal = makeProposal({
      id: 'p-ch-up',
      loai: PROPOSAL_TYPES.CONG_HIEN,
      nam: 2024,
      thang: 6,
      nguoi_de_xuat_id: ADMIN_ID,
      data_cong_hien: [buildCongHienItem(personnel.id, DANH_HIEU_HCBVTQ.HANG_NHI)],
    });

    prismaMock.bangDeXuat.findUnique.mockResolvedValueOnce(proposal);
    prismaMock.quanNhan.findMany.mockResolvedValueOnce([
      { id: personnel.id, ho_ten: personnel.ho_ten, gioi_tinh: 'NAM' },
    ]);
    prismaMock.lichSuChucVu.findMany.mockResolvedValueOnce(buildEligibleHistories(personnel.id));
    prismaMock.quanNhan.findUnique.mockResolvedValueOnce(personnel);
    prismaMock.khenThuongHCBVTQ.findUnique.mockResolvedValueOnce({
      id: 'kt-old',
      quan_nhan_id: personnel.id,
      danh_hieu: DANH_HIEU_HCBVTQ.HANG_BA,
      nam: 2022,
    });
    prismaMock.khenThuongHCBVTQ.update.mockResolvedValueOnce({ id: 'kt-old' });
    prismaMock.hoSoCongHien.upsert.mockResolvedValueOnce({});
    prismaMock.bangDeXuat.updateMany.mockResolvedValueOnce({ count: 1 });

    await proposalService.approveProposal(proposal.id, {}, ADMIN_ID, {}, {}, null);

    expect(prismaMock.khenThuongHCBVTQ.update).toHaveBeenCalledTimes(1);
    expect(prismaMock.khenThuongHCBVTQ.create).not.toHaveBeenCalled();
    const updateArgs = prismaMock.khenThuongHCBVTQ.update.mock.calls[0][0];
    expect(updateArgs.where).toEqual({ id: 'kt-old' });
    expect(updateArgs.data.danh_hieu).toBe(DANH_HIEU_HCBVTQ.HANG_NHI);
  });

  it('HCBVTQ_HIGHEST: reject khi approve HANG_BA cho QN đủ ĐK HANG_NHAT', async () => {
    const personnel = makePersonnel({
      id: 'qn-app-highest-ba',
      ho_ten: 'QN approve HANG_NHAT',
      gioi_tinh: 'NAM',
    });
    const proposal = makeProposal({
      id: 'p-app-ch-highest-ba',
      loai: PROPOSAL_TYPES.CONG_HIEN,
      nam: 2024,
      thang: 6,
      nguoi_de_xuat_id: ADMIN_ID,
      data_cong_hien: [buildCongHienItem(personnel.id, DANH_HIEU_HCBVTQ.HANG_BA)],
    });
    prismaMock.bangDeXuat.findUnique.mockResolvedValueOnce(proposal);
    prismaMock.quanNhan.findMany.mockResolvedValueOnce([
      { id: personnel.id, ho_ten: personnel.ho_ten, gioi_tinh: 'NAM' },
    ]);
    prismaMock.lichSuChucVu.findMany.mockResolvedValueOnce([
      {
        quan_nhan_id: personnel.id,
        he_so_chuc_vu: 0.9,
        so_thang: 200,
        ngay_bat_dau: new Date('2007-01-01'),
        ngay_ket_thuc: new Date('2023-12-31'),
      },
    ]);

    const error = await expectError(
      proposalService.approveProposal(proposal.id, {}, ADMIN_ID, {}, {}, null),
      ValidationError,
      { startsWith: APPROVE_ELIGIBILITY_PREFIX }
    );
    expect(error.message).toContain(HCBVTQ_HIGHEST_DOWNGRADE_FRAGMENT);
    expect(error.message).toContain('hạng Ba');
    expect(error.message).toContain('hạng Nhất');
    expect(prismaMock.khenThuongHCBVTQ.create).not.toHaveBeenCalled();
  });

  it('HCBVTQ_HIGHEST: reject khi approve HANG_NHI cho QN đủ ĐK HANG_NHAT', async () => {
    const personnel = makePersonnel({
      id: 'qn-app-highest-nhi',
      ho_ten: 'QN approve HANG_NHAT 2',
      gioi_tinh: 'NAM',
    });
    const proposal = makeProposal({
      id: 'p-app-ch-highest-nhi',
      loai: PROPOSAL_TYPES.CONG_HIEN,
      nam: 2024,
      thang: 6,
      nguoi_de_xuat_id: ADMIN_ID,
      data_cong_hien: [buildCongHienItem(personnel.id, DANH_HIEU_HCBVTQ.HANG_NHI)],
    });
    prismaMock.bangDeXuat.findUnique.mockResolvedValueOnce(proposal);
    prismaMock.quanNhan.findMany.mockResolvedValueOnce([
      { id: personnel.id, ho_ten: personnel.ho_ten, gioi_tinh: 'NAM' },
    ]);
    prismaMock.lichSuChucVu.findMany.mockResolvedValueOnce([
      {
        quan_nhan_id: personnel.id,
        he_so_chuc_vu: 0.95,
        so_thang: 150,
        ngay_bat_dau: new Date('2011-01-01'),
        ngay_ket_thuc: new Date('2023-12-31'),
      },
    ]);

    const error = await expectError(
      proposalService.approveProposal(proposal.id, {}, ADMIN_ID, {}, {}, null),
      ValidationError,
      { startsWith: APPROVE_ELIGIBILITY_PREFIX }
    );
    expect(error.message).toContain(HCBVTQ_HIGHEST_DOWNGRADE_FRAGMENT);
    expect(error.message).toContain('hạng Nhì');
    expect(error.message).toContain('hạng Nhất');
    expect(prismaMock.khenThuongHCBVTQ.create).not.toHaveBeenCalled();
  });

  it('HCBVTQ_HIGHEST: approve thành công HANG_NHAT cho QN đủ ĐK HANG_NHAT', async () => {
    const personnel = makePersonnel({
      id: 'qn-app-highest-nhat-ok',
      ho_ten: 'QN approve HANG_NHAT OK',
      gioi_tinh: 'NAM',
    });
    const proposal = makeProposal({
      id: 'p-app-ch-highest-nhat-ok',
      loai: PROPOSAL_TYPES.CONG_HIEN,
      nam: 2024,
      thang: 6,
      nguoi_de_xuat_id: ADMIN_ID,
      data_cong_hien: [buildCongHienItem(personnel.id, DANH_HIEU_HCBVTQ.HANG_NHAT)],
    });
    prismaMock.bangDeXuat.findUnique.mockResolvedValueOnce(proposal);
    prismaMock.quanNhan.findMany.mockResolvedValueOnce([
      { id: personnel.id, ho_ten: personnel.ho_ten, gioi_tinh: 'NAM' },
    ]);
    prismaMock.lichSuChucVu.findMany.mockResolvedValueOnce([
      {
        quan_nhan_id: personnel.id,
        he_so_chuc_vu: 0.9,
        so_thang: 130,
        ngay_bat_dau: new Date('2013-01-01'),
        ngay_ket_thuc: new Date('2023-12-31'),
      },
    ]);
    prismaMock.quanNhan.findUnique.mockResolvedValueOnce(personnel);
    prismaMock.khenThuongHCBVTQ.findUnique.mockResolvedValueOnce(null);
    prismaMock.khenThuongHCBVTQ.create.mockResolvedValueOnce({
      id: 'kt-app-highest-nhat',
      quan_nhan_id: personnel.id,
      danh_hieu: DANH_HIEU_HCBVTQ.HANG_NHAT,
    });
    prismaMock.hoSoCongHien.upsert.mockResolvedValueOnce({});
    prismaMock.bangDeXuat.updateMany.mockResolvedValueOnce({ count: 1 });

    await proposalService.approveProposal(proposal.id, {}, ADMIN_ID, {}, {}, null);

    expect(prismaMock.khenThuongHCBVTQ.create).toHaveBeenCalledTimes(1);
    expect(prismaMock.khenThuongHCBVTQ.create.mock.calls[0][0].data.danh_hieu).toBe(
      DANH_HIEU_HCBVTQ.HANG_NHAT
    );
  });

  it('reject khi proposal đã APPROVED', async () => {
    const proposal = makeProposal({
      id: 'p-ch-app',
      loai: PROPOSAL_TYPES.CONG_HIEN,
      status: PROPOSAL_STATUS.APPROVED,
      nam: 2024,
      thang: 6,
      nguoi_de_xuat_id: ADMIN_ID,
    });
    prismaMock.bangDeXuat.findUnique.mockResolvedValueOnce(proposal);

    await expectError(
      proposalService.approveProposal(proposal.id, {}, ADMIN_ID, {}, {}, null),
      ValidationError,
      'Đề xuất này đã được phê duyệt trước đó'
    );
  });
});
