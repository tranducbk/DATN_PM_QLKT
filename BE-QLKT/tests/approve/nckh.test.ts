import { prismaMock, resetPrismaMock } from '../helpers/prismaMock';
import { makeProposal, makePersonnel, makeUnit } from '../helpers/fixtures';
import { expectError } from '../helpers/errorAssert';

import proposalService from '../../src/services/proposal';
import { ValidationError, NotFoundError } from '../../src/middlewares/errorHandler';
import { PROPOSAL_TYPES } from '../../src/constants/proposalTypes.constants';
import { PROPOSAL_STATUS } from '../../src/constants/proposalStatus.constants';
import { nckhDuplicateMessage } from '../helpers/errorMessages';

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
    nam: 2024,
    loai: 'DTKH',
    mo_ta: 'Đề tài AI',
    ...override,
  };
}

describe('approveProposal — NCKH', () => {
  it('duyệt thành công 1 item DTKH (CQDV)', async () => {
    const cqdv = makeUnit({ kind: 'CQDV', id: 'cqdv-1' });
    const personnel = makePersonnel({ unit: cqdv, id: 'qn-1', ho_ten: 'Nguyễn A' });
    const proposal = makeProposal({
      id: 'p-nckh-1',
      loai: PROPOSAL_TYPES.NCKH,
      nam: 2024,
      nguoi_de_xuat_id: ADMIN_ID,
      unit: cqdv,
      data_thanh_tich: [buildItem(personnel.id)],
    });

    prismaMock.bangDeXuat.findUnique.mockResolvedValueOnce(proposal);
    prismaMock.quanNhan.findMany.mockResolvedValueOnce([{ id: personnel.id, ho_ten: personnel.ho_ten }]);
    prismaMock.thanhTichKhoaHoc.findMany.mockResolvedValueOnce([]);
    prismaMock.taiKhoan.findUnique.mockResolvedValueOnce({
      id: ADMIN_ID,
      username: 'admin',
      QuanNhan: { ho_ten: 'Admin' },
    });
    prismaMock.quanNhan.findUnique.mockResolvedValueOnce(personnel);
    prismaMock.thanhTichKhoaHoc.create.mockResolvedValueOnce({});
    prismaMock.bangDeXuat.updateMany.mockResolvedValueOnce({ count: 1 });

    await proposalService.approveProposal(proposal.id, {}, ADMIN_ID, {}, {}, null);

    expect(prismaMock.thanhTichKhoaHoc.create).toHaveBeenCalledTimes(1);
    expect(prismaMock.bangDeXuat.updateMany.mock.calls[0][0].data.status).toBe(PROPOSAL_STATUS.APPROVED);
  });

  it('duyệt thành công với DVTT', async () => {
    const dvtt = makeUnit({ kind: 'DVTT', id: 'dvtt-1', parentId: 'cqdv-parent' });
    const personnel = makePersonnel({ unit: dvtt, id: 'qn-dvtt' });
    const proposal = makeProposal({
      id: 'p-nckh-dvtt',
      loai: PROPOSAL_TYPES.NCKH,
      nam: 2024,
      nguoi_de_xuat_id: ADMIN_ID,
      unit: dvtt,
      data_thanh_tich: [buildItem(personnel.id, { loai: 'SKKH', mo_ta: 'SKKH-1' })],
    });
    prismaMock.bangDeXuat.findUnique.mockResolvedValueOnce(proposal);
    prismaMock.quanNhan.findMany.mockResolvedValueOnce([{ id: personnel.id, ho_ten: personnel.ho_ten }]);
    prismaMock.thanhTichKhoaHoc.findMany.mockResolvedValueOnce([]);
    prismaMock.taiKhoan.findUnique.mockResolvedValueOnce({
      id: ADMIN_ID,
      username: 'admin',
      QuanNhan: { ho_ten: 'Admin' },
    });
    prismaMock.quanNhan.findUnique.mockResolvedValueOnce(personnel);
    prismaMock.thanhTichKhoaHoc.create.mockResolvedValueOnce({});
    prismaMock.bangDeXuat.updateMany.mockResolvedValueOnce({ count: 1 });

    await proposalService.approveProposal(proposal.id, {}, ADMIN_ID, {}, {}, null);
    expect(prismaMock.thanhTichKhoaHoc.create).toHaveBeenCalledTimes(1);
  });

  it('reject duplicate — cùng personnel + cùng nam + cùng mo_ta', async () => {
    const personnel = makePersonnel({ id: 'qn-dup', ho_ten: 'Trần B' });
    const proposal = makeProposal({
      id: 'p-nckh-dup',
      loai: PROPOSAL_TYPES.NCKH,
      nam: 2024,
      nguoi_de_xuat_id: ADMIN_ID,
      data_thanh_tich: [buildItem(personnel.id, { mo_ta: 'Đề tài cũ' })],
    });
    prismaMock.bangDeXuat.findUnique.mockResolvedValueOnce(proposal);
    prismaMock.quanNhan.findMany.mockResolvedValueOnce([{ id: personnel.id, ho_ten: personnel.ho_ten }]);
    prismaMock.thanhTichKhoaHoc.findMany.mockResolvedValueOnce([
      { quan_nhan_id: personnel.id, nam: 2024, mo_ta: 'Đề tài cũ' },
    ]);

    const err = await expectError(
      proposalService.approveProposal(proposal.id, {}, ADMIN_ID, {}, {}, null),
      ValidationError,
      { startsWith: 'Phát hiện đề xuất trùng' }
    );
    expect(err.message).toContain(nckhDuplicateMessage(personnel.ho_ten, 'Đề tài cũ', 2024));
  });

  it('cho phép cùng personnel + cùng năm nhưng mo_ta khác → không trùng', async () => {
    const personnel = makePersonnel({ id: 'qn-multi', ho_ten: 'C' });
    const proposal = makeProposal({
      id: 'p-nckh-multi',
      loai: PROPOSAL_TYPES.NCKH,
      nam: 2024,
      nguoi_de_xuat_id: ADMIN_ID,
      data_thanh_tich: [buildItem(personnel.id, { mo_ta: 'Đề tài MỚI' })],
    });
    prismaMock.bangDeXuat.findUnique.mockResolvedValueOnce(proposal);
    prismaMock.quanNhan.findMany.mockResolvedValueOnce([{ id: personnel.id, ho_ten: personnel.ho_ten }]);
    prismaMock.thanhTichKhoaHoc.findMany.mockResolvedValueOnce([
      { quan_nhan_id: personnel.id, nam: 2024, mo_ta: 'Đề tài CŨ KHÁC' },
    ]);
    prismaMock.taiKhoan.findUnique.mockResolvedValueOnce({
      id: ADMIN_ID,
      username: 'admin',
      QuanNhan: { ho_ten: 'Admin' },
    });
    prismaMock.quanNhan.findUnique.mockResolvedValueOnce(personnel);
    prismaMock.thanhTichKhoaHoc.create.mockResolvedValueOnce({});
    prismaMock.bangDeXuat.updateMany.mockResolvedValueOnce({ count: 1 });

    await proposalService.approveProposal(proposal.id, {}, ADMIN_ID, {}, {}, null);
    expect(prismaMock.thanhTichKhoaHoc.create).toHaveBeenCalledTimes(1);
  });

  it('throw NotFoundError khi proposalId không tồn tại', async () => {
    prismaMock.bangDeXuat.findUnique.mockResolvedValueOnce(null);

    await expectError(
      proposalService.approveProposal('missing', {}, ADMIN_ID, {}, {}, null),
      NotFoundError,
      'Đề xuất không tồn tại'
    );
  });

  it('approve transaction rollback: any per-row error throws ValidationError aggregating reasons', async () => {
    const personnel = makePersonnel({ id: 'qn-msg-nckh', ho_ten: 'QN MSG NCKH' });
    const proposal = makeProposal({
      id: 'p-nckh-msg',
      loai: PROPOSAL_TYPES.NCKH,
      nam: 2024,
      nguoi_de_xuat_id: ADMIN_ID,
      data_thanh_tich: [
        buildItem(personnel.id, { mo_ta: 'Đề tài hợp lệ' }),
        buildItem('qn-missing-nckh', { mo_ta: 'Đề tài lỗi' }),
      ],
    });

    prismaMock.bangDeXuat.findUnique.mockResolvedValueOnce(proposal);
    prismaMock.quanNhan.findMany.mockResolvedValueOnce([
      { id: personnel.id, ho_ten: personnel.ho_ten },
      { id: 'qn-missing-nckh', ho_ten: 'QN Missing NCKH' },
    ]);
    prismaMock.thanhTichKhoaHoc.findMany.mockResolvedValueOnce([]);
    prismaMock.taiKhoan.findUnique.mockResolvedValueOnce({
      id: ADMIN_ID,
      username: 'admin',
      QuanNhan: { ho_ten: 'Admin' },
    });
    prismaMock.quanNhan.findUnique
      .mockResolvedValueOnce(personnel)
      .mockResolvedValueOnce(null);
    prismaMock.thanhTichKhoaHoc.create.mockResolvedValueOnce({});
    prismaMock.bangDeXuat.updateMany.mockResolvedValueOnce({ count: 1 });

    const error = await expectError(
      proposalService.approveProposal(proposal.id, {}, ADMIN_ID, {}, {}, null),
      ValidationError,
      { startsWith: 'Không thể phê duyệt đề xuất do có 1 lỗi khi thêm khen thưởng:' }
    );
    expect(error.message).toContain('Không tìm thấy thông tin quân nhân');
  });
});
