import { prismaMock, resetPrismaMock } from '../helpers/prismaMock';
import { makeProposal, makePersonnel, makeUnit } from '../helpers/fixtures';
import { expectError } from '../helpers/errorAssert';

import proposalService from '../../src/services/proposal';
import { ValidationError } from '../../src/middlewares/errorHandler';
import { PROPOSAL_TYPES } from '../../src/constants/proposalTypes.constants';
import { PROPOSAL_STATUS } from '../../src/constants/proposalStatus.constants';
import {
  APPROVE_MISSING_MONTH_ERROR,
  hcqkqtNotEnoughYears,
  HCQKQT_MISSING_NHAP_NGU,
} from '../helpers/errorMessages';

beforeEach(() => {
  resetPrismaMock();
});

afterEach(() => {
  jest.restoreAllMocks();
});

const ADMIN_ID = 'acc-admin-1';

function buildItem(personnelId: string, override: Record<string, unknown> = {}) {
  return {
    personnel_id: personnelId,
    danh_hieu: 'HC_QKQT',
    nam_nhan: 2024,
    thang_nhan: 6,
    so_quyet_dinh: 'QD-HCQKQT-1',
    ...override,
  };
}

describe('approveProposal — HC_QKQT', () => {
  it('duyệt thành công khi đủ 25 năm', async () => {
    const cqdv = makeUnit({ kind: 'CQDV', id: 'cqdv-1' });
    const personnel = makePersonnel({
      unit: cqdv,
      id: 'qn-1',
      ho_ten: 'Nguyễn A',
      ngay_nhap_ngu: new Date('1994-01-01'),
    });
    const proposal = makeProposal({
      id: 'p-hcqkqt-1',
      loai: PROPOSAL_TYPES.HC_QKQT,
      nam: 2024,
      thang: 6,
      nguoi_de_xuat_id: ADMIN_ID,
      unit: cqdv,
      data_nien_han: [buildItem(personnel.id)],
    });

    prismaMock.bangDeXuat.findUnique.mockResolvedValueOnce(proposal);
    prismaMock.quanNhan.findMany.mockResolvedValueOnce([{ id: personnel.id, ho_ten: personnel.ho_ten }]);
    prismaMock.huanChuongQuanKyQuyetThang.findFirst.mockResolvedValueOnce(null);
    prismaMock.bangDeXuat.findMany.mockResolvedValueOnce([]);
    prismaMock.quanNhan.findMany.mockResolvedValueOnce([personnel]);
    prismaMock.taiKhoan.findUnique.mockResolvedValueOnce({
      id: ADMIN_ID,
      username: 'admin',
      QuanNhan: { ho_ten: 'Admin' },
    });
    prismaMock.quanNhan.findUnique.mockResolvedValueOnce(personnel);
    prismaMock.huanChuongQuanKyQuyetThang.findUnique.mockResolvedValueOnce(null);
    prismaMock.huanChuongQuanKyQuyetThang.create.mockResolvedValueOnce({});
    prismaMock.bangDeXuat.updateMany.mockResolvedValueOnce({ count: 1 });

    await proposalService.approveProposal(proposal.id, {}, ADMIN_ID, {}, {}, null);

    expect(prismaMock.huanChuongQuanKyQuyetThang.create).toHaveBeenCalledTimes(1);
    expect(prismaMock.bangDeXuat.updateMany.mock.calls[0][0].data.status).toBe(PROPOSAL_STATUS.APPROVED);
  });

  it('reject khi chưa đủ 25 năm', async () => {
    const personnel = makePersonnel({
      id: 'qn-short',
      ho_ten: 'Trần B',
      ngay_nhap_ngu: new Date('2010-01-01'),
    });
    const proposal = makeProposal({
      id: 'p-hcqkqt-short',
      loai: PROPOSAL_TYPES.HC_QKQT,
      nam: 2024,
      thang: 6,
      nguoi_de_xuat_id: ADMIN_ID,
      data_nien_han: [buildItem(personnel.id)],
    });
    prismaMock.bangDeXuat.findUnique.mockResolvedValueOnce(proposal);
    prismaMock.quanNhan.findMany.mockResolvedValueOnce([{ id: personnel.id, ho_ten: personnel.ho_ten }]);
    prismaMock.huanChuongQuanKyQuyetThang.findFirst.mockResolvedValueOnce(null);
    prismaMock.bangDeXuat.findMany.mockResolvedValueOnce([]);
    prismaMock.quanNhan.findMany.mockResolvedValueOnce([personnel]);

    const err = await expectError(
      proposalService.approveProposal(proposal.id, {}, ADMIN_ID, {}, {}, null),
      ValidationError,
      { startsWith: 'Kiểm tra lại điều kiện trước khi phê duyệt thất bại:\n' }
    );
    // The reason text uses formatServiceDuration — check the message contains the personnel name
    expect(err.message).toContain(personnel.ho_ten);
    expect(err.message).toContain('HC QKQT');
    expect(prismaMock.huanChuongQuanKyQuyetThang.create).not.toHaveBeenCalled();
  });

  it('reject khi thiếu ngay_nhap_ngu', async () => {
    const personnel = makePersonnel({
      id: 'qn-no-nn',
      ho_ten: 'Lê C',
      ngay_nhap_ngu: null,
    });
    const proposal = makeProposal({
      id: 'p-hcqkqt-no-nn',
      loai: PROPOSAL_TYPES.HC_QKQT,
      nam: 2024,
      thang: 6,
      nguoi_de_xuat_id: ADMIN_ID,
      data_nien_han: [buildItem(personnel.id)],
    });
    prismaMock.bangDeXuat.findUnique.mockResolvedValueOnce(proposal);
    prismaMock.quanNhan.findMany.mockResolvedValueOnce([{ id: personnel.id, ho_ten: personnel.ho_ten }]);
    prismaMock.huanChuongQuanKyQuyetThang.findFirst.mockResolvedValueOnce(null);
    prismaMock.bangDeXuat.findMany.mockResolvedValueOnce([]);
    prismaMock.quanNhan.findMany.mockResolvedValueOnce([personnel]);

    const err = await expectError(
      proposalService.approveProposal(proposal.id, {}, ADMIN_ID, {}, {}, null),
      ValidationError,
      { startsWith: 'Kiểm tra lại điều kiện trước khi phê duyệt thất bại:\n' }
    );
    expect(err.message).toContain(HCQKQT_MISSING_NHAP_NGU(personnel.ho_ten));
  });

  it('reject khi proposal thiếu tháng', async () => {
    const proposal = makeProposal({
      id: 'p-hcqkqt-no-thang',
      loai: PROPOSAL_TYPES.HC_QKQT,
      nam: 2024,
      thang: null,
      nguoi_de_xuat_id: ADMIN_ID,
      data_nien_han: [],
    });
    prismaMock.bangDeXuat.findUnique.mockResolvedValueOnce(proposal);

    await expectError(
      proposalService.approveProposal(proposal.id, {}, ADMIN_ID, {}, {}, null),
      ValidationError,
      APPROVE_MISSING_MONTH_ERROR
    );
  });

  it('reject duplicate — quân nhân đã có HC_QKQT', async () => {
    const personnel = makePersonnel({
      id: 'qn-dup',
      ho_ten: 'Phạm D',
      ngay_nhap_ngu: new Date('1990-01-01'),
    });
    const proposal = makeProposal({
      id: 'p-hcqkqt-dup',
      loai: PROPOSAL_TYPES.HC_QKQT,
      nam: 2024,
      thang: 6,
      nguoi_de_xuat_id: ADMIN_ID,
      data_nien_han: [buildItem(personnel.id)],
    });
    prismaMock.bangDeXuat.findUnique.mockResolvedValueOnce(proposal);
    prismaMock.quanNhan.findMany.mockResolvedValueOnce([{ id: personnel.id, ho_ten: personnel.ho_ten }]);
    prismaMock.huanChuongQuanKyQuyetThang.findFirst.mockResolvedValueOnce({
      id: 'hcqkqt-existing',
      quan_nhan_id: personnel.id,
    });
    prismaMock.bangDeXuat.findMany.mockResolvedValueOnce([]);

    await expectError(
      proposalService.approveProposal(proposal.id, {}, ADMIN_ID, {}, {}, null),
      ValidationError,
      { startsWith: 'Phát hiện đề xuất trùng' }
    );
  });
});
