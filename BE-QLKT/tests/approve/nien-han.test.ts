import { prismaMock, resetPrismaMock } from '../helpers/prismaMock';
import { makeProposal, makePersonnel, makeUnit } from '../helpers/fixtures';
import { expectError } from '../helpers/errorAssert';

import proposalService from '../../src/services/proposal';
import { ValidationError, NotFoundError } from '../../src/middlewares/errorHandler';
import { PROPOSAL_TYPES } from '../../src/constants/proposalTypes.constants';
import { PROPOSAL_STATUS } from '../../src/constants/proposalStatus.constants';
import { DANH_HIEU_HCCSVV } from '../../src/constants/danhHieu.constants';
import { APPROVE_MISSING_MONTH_ERROR } from '../helpers/errorMessages';

beforeEach(() => {
  resetPrismaMock();
});

afterEach(() => {
  jest.restoreAllMocks();
});

const ADMIN_ID = 'acc-admin-1';

function buildItem(personnelId: string, danhHieu: string, override: Record<string, unknown> = {}) {
  return {
    personnel_id: personnelId,
    danh_hieu: danhHieu,
    nam_nhan: 2024,
    thang_nhan: 6,
    so_quyet_dinh: 'QD-NH-1',
    ...override,
  };
}

describe('approveProposal — NIEN_HAN (HCCSVV)', () => {
  it('duyệt thành công HCCSVV hạng ba (CQDV)', async () => {
    // Given: pending NIEN_HAN proposal with valid item
    const cqdv = makeUnit({ kind: 'CQDV', id: 'cqdv-1' });
    const personnel = makePersonnel({
      unit: cqdv,
      id: 'qn-1',
      ho_ten: 'Nguyễn A',
      ngay_nhap_ngu: new Date('2010-01-01'),
    });
    const proposal = makeProposal({
      id: 'p-nh-1',
      loai: PROPOSAL_TYPES.NIEN_HAN,
      nam: 2024,
      thang: 6,
      nguoi_de_xuat_id: ADMIN_ID,
      unit: cqdv,
      data_nien_han: [buildItem(personnel.id, DANH_HIEU_HCCSVV.HANG_BA)],
    });

    prismaMock.bangDeXuat.findUnique.mockResolvedValueOnce(proposal);
    prismaMock.quanNhan.findMany.mockResolvedValueOnce([{ id: personnel.id, ho_ten: personnel.ho_ten }]);
    prismaMock.danhHieuHangNam.findFirst.mockResolvedValueOnce(null);
    prismaMock.bangDeXuat.findMany.mockResolvedValueOnce([]);
    prismaMock.taiKhoan.findUnique.mockResolvedValueOnce({
      id: ADMIN_ID,
      username: 'admin',
      QuanNhan: { ho_ten: 'Admin' },
    });
    prismaMock.khenThuongHCCSVV.findMany.mockResolvedValueOnce([]);
    prismaMock.quanNhan.findUnique.mockResolvedValueOnce(personnel);
    prismaMock.khenThuongHCCSVV.upsert.mockResolvedValueOnce({});
    prismaMock.hoSoNienHan.upsert.mockResolvedValueOnce({});
    prismaMock.bangDeXuat.updateMany.mockResolvedValueOnce({ count: 1 });

    // When
    await proposalService.approveProposal(proposal.id, {}, ADMIN_ID, {}, {}, null);

    // Then
    expect(prismaMock.khenThuongHCCSVV.upsert).toHaveBeenCalledTimes(1);
    const upsertArgs = prismaMock.khenThuongHCCSVV.upsert.mock.calls[0][0];
    expect(upsertArgs.where.quan_nhan_id_danh_hieu).toEqual({
      quan_nhan_id: personnel.id,
      danh_hieu: DANH_HIEU_HCCSVV.HANG_BA,
    });
    expect(prismaMock.bangDeXuat.updateMany.mock.calls[0][0].data.status).toBe(
      PROPOSAL_STATUS.APPROVED
    );
  });

  it('reject khi proposal thiếu tháng', async () => {
    const proposal = makeProposal({
      id: 'p-nh-no-thang',
      loai: PROPOSAL_TYPES.NIEN_HAN,
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
    expect(prismaMock.khenThuongHCCSVV.upsert).not.toHaveBeenCalled();
  });

  it('throw NotFoundError khi proposalId không tồn tại', async () => {
    prismaMock.bangDeXuat.findUnique.mockResolvedValueOnce(null);

    await expectError(
      proposalService.approveProposal('missing', {}, ADMIN_ID, {}, {}, null),
      NotFoundError,
      'Đề xuất không tồn tại'
    );
  });

  it('reject khi proposal đã APPROVED', async () => {
    const proposal = makeProposal({
      id: 'p-nh-app',
      loai: PROPOSAL_TYPES.NIEN_HAN,
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

  it('reject HANG_NHI khi quân nhân chưa có HANG_BA', async () => {
    const cqdv = makeUnit({ kind: 'CQDV', id: 'cqdv-1' });
    const personnel = makePersonnel({
      unit: cqdv,
      id: 'qn-rk-1',
      ho_ten: 'Trần Rank A',
      ngay_nhap_ngu: new Date('2005-01-01'),
    });
    const proposal = makeProposal({
      id: 'p-rk-1',
      loai: PROPOSAL_TYPES.NIEN_HAN,
      nam: 2024,
      thang: 6,
      nguoi_de_xuat_id: ADMIN_ID,
      unit: cqdv,
      data_nien_han: [buildItem(personnel.id, DANH_HIEU_HCCSVV.HANG_NHI)],
    });

    prismaMock.bangDeXuat.findUnique.mockResolvedValueOnce(proposal);
    prismaMock.quanNhan.findMany.mockResolvedValueOnce([{ id: personnel.id, ho_ten: personnel.ho_ten }]);
    prismaMock.khenThuongHCCSVV.findFirst.mockResolvedValueOnce(null);
    prismaMock.bangDeXuat.findMany.mockResolvedValueOnce([]);
    prismaMock.taiKhoan.findUnique.mockResolvedValueOnce({
      id: ADMIN_ID,
      username: 'admin',
      QuanNhan: { ho_ten: 'Admin' },
    });
    prismaMock.khenThuongHCCSVV.findMany.mockResolvedValueOnce([]);
    prismaMock.quanNhan.findUnique.mockResolvedValueOnce(personnel);

    await expectError(
      proposalService.approveProposal(proposal.id, {}, ADMIN_ID, {}, {}, null),
      ValidationError,
      /Phải nhận Huy chương Chiến sĩ vẻ vang hạng Ba trước khi nhận Huy chương Chiến sĩ vẻ vang hạng Nhì/
    );
    expect(prismaMock.khenThuongHCCSVV.upsert).not.toHaveBeenCalled();
  });

  it('reject HANG_NHI khi HANG_BA cùng năm — phải sau năm', async () => {
    const cqdv = makeUnit({ kind: 'CQDV', id: 'cqdv-2' });
    const personnel = makePersonnel({
      unit: cqdv,
      id: 'qn-rk-2',
      ho_ten: 'Trần Rank B',
      ngay_nhap_ngu: new Date('2005-01-01'),
    });
    const proposal = makeProposal({
      id: 'p-rk-2',
      loai: PROPOSAL_TYPES.NIEN_HAN,
      nam: 2024,
      thang: 6,
      nguoi_de_xuat_id: ADMIN_ID,
      unit: cqdv,
      data_nien_han: [buildItem(personnel.id, DANH_HIEU_HCCSVV.HANG_NHI)],
    });

    prismaMock.bangDeXuat.findUnique.mockResolvedValueOnce(proposal);
    prismaMock.quanNhan.findMany.mockResolvedValueOnce([{ id: personnel.id, ho_ten: personnel.ho_ten }]);
    prismaMock.khenThuongHCCSVV.findFirst.mockResolvedValueOnce(null);
    prismaMock.bangDeXuat.findMany.mockResolvedValueOnce([]);
    prismaMock.taiKhoan.findUnique.mockResolvedValueOnce({
      id: ADMIN_ID,
      username: 'admin',
      QuanNhan: { ho_ten: 'Admin' },
    });
    prismaMock.khenThuongHCCSVV.findMany.mockResolvedValueOnce([
      { quan_nhan_id: personnel.id, danh_hieu: DANH_HIEU_HCCSVV.HANG_BA, nam: 2024 },
    ]);
    prismaMock.quanNhan.findUnique.mockResolvedValueOnce(personnel);

    await expectError(
      proposalService.approveProposal(proposal.id, {}, ADMIN_ID, {}, {}, null),
      ValidationError,
      /phải sau năm nhận Huy chương Chiến sĩ vẻ vang hạng Ba/
    );
    expect(prismaMock.khenThuongHCCSVV.upsert).not.toHaveBeenCalled();
  });

  it('duyệt thành công HANG_NHAT đầy đủ tuần tự', async () => {
    const cqdv = makeUnit({ kind: 'CQDV', id: 'cqdv-3' });
    const personnel = makePersonnel({
      unit: cqdv,
      id: 'qn-rk-3',
      ho_ten: 'Trần Rank C',
      ngay_nhap_ngu: new Date('1995-01-01'),
    });
    const proposal = makeProposal({
      id: 'p-rk-3',
      loai: PROPOSAL_TYPES.NIEN_HAN,
      nam: 2025,
      thang: 6,
      nguoi_de_xuat_id: ADMIN_ID,
      unit: cqdv,
      data_nien_han: [buildItem(personnel.id, DANH_HIEU_HCCSVV.HANG_NHAT, { nam_nhan: 2025 })],
    });

    prismaMock.bangDeXuat.findUnique.mockResolvedValueOnce(proposal);
    prismaMock.quanNhan.findMany.mockResolvedValueOnce([{ id: personnel.id, ho_ten: personnel.ho_ten }]);
    prismaMock.khenThuongHCCSVV.findFirst.mockResolvedValueOnce(null);
    prismaMock.bangDeXuat.findMany.mockResolvedValueOnce([]);
    prismaMock.taiKhoan.findUnique.mockResolvedValueOnce({
      id: ADMIN_ID,
      username: 'admin',
      QuanNhan: { ho_ten: 'Admin' },
    });
    prismaMock.khenThuongHCCSVV.findMany.mockResolvedValueOnce([
      { quan_nhan_id: personnel.id, danh_hieu: DANH_HIEU_HCCSVV.HANG_BA, nam: 2010 },
      { quan_nhan_id: personnel.id, danh_hieu: DANH_HIEU_HCCSVV.HANG_NHI, nam: 2018 },
    ]);
    prismaMock.quanNhan.findUnique.mockResolvedValueOnce(personnel);
    prismaMock.khenThuongHCCSVV.upsert.mockResolvedValueOnce({});
    prismaMock.hoSoNienHan.upsert.mockResolvedValueOnce({});
    prismaMock.bangDeXuat.updateMany.mockResolvedValueOnce({ count: 1 });

    await proposalService.approveProposal(proposal.id, {}, ADMIN_ID, {}, {}, null);

    expect(prismaMock.khenThuongHCCSVV.upsert).toHaveBeenCalledTimes(1);
  });

  it('reject duplicate — đã có HCCSVV cùng hạng', async () => {
    const personnel = makePersonnel({ id: 'qn-dup', ho_ten: 'Trần B' });
    const proposal = makeProposal({
      id: 'p-nh-dup',
      loai: PROPOSAL_TYPES.NIEN_HAN,
      nam: 2024,
      thang: 6,
      nguoi_de_xuat_id: ADMIN_ID,
      data_nien_han: [buildItem(personnel.id, DANH_HIEU_HCCSVV.HANG_BA)],
    });
    prismaMock.bangDeXuat.findUnique.mockResolvedValueOnce(proposal);
    prismaMock.quanNhan.findMany.mockResolvedValueOnce([{ id: personnel.id, ho_ten: personnel.ho_ten }]);
    prismaMock.khenThuongHCCSVV.findFirst.mockResolvedValueOnce({
      id: 'hccsvv-existing',
      quan_nhan_id: personnel.id,
      danh_hieu: DANH_HIEU_HCCSVV.HANG_BA,
    });
    prismaMock.bangDeXuat.findMany.mockResolvedValueOnce([]);

    await expectError(
      proposalService.approveProposal(proposal.id, {}, ADMIN_ID, {}, {}, null),
      ValidationError,
      { startsWith: 'Phát hiện đề xuất trùng' }
    );
  });

  it('approve transaction rollback: missing personnel_id aggregates into ValidationError', async () => {
    const personnel = makePersonnel({
      id: 'qn-msg-nh',
      ho_ten: 'QN MSG NIEN HAN',
      ngay_nhap_ngu: new Date('2008-01-01'),
    });
    const proposal = makeProposal({
      id: 'p-nh-msg',
      loai: PROPOSAL_TYPES.NIEN_HAN,
      nam: 2024,
      thang: 6,
      nguoi_de_xuat_id: ADMIN_ID,
      data_nien_han: [
        buildItem(personnel.id, DANH_HIEU_HCCSVV.HANG_BA, { so_quyet_dinh: 'QD-NH-MSG-OK' }),
        {
          danh_hieu: DANH_HIEU_HCCSVV.HANG_BA,
          nam_nhan: 2024,
          thang_nhan: 6,
          so_quyet_dinh: 'QD-NH-MSG-ERR',
        },
      ],
    });

    prismaMock.bangDeXuat.findUnique.mockResolvedValueOnce(proposal);
    prismaMock.quanNhan.findMany.mockResolvedValueOnce([{ id: personnel.id, ho_ten: personnel.ho_ten }]);
    prismaMock.danhHieuHangNam.findFirst.mockResolvedValueOnce(null);
    prismaMock.bangDeXuat.findMany.mockResolvedValueOnce([]);
    prismaMock.taiKhoan.findUnique.mockResolvedValueOnce({
      id: ADMIN_ID,
      username: 'admin',
      QuanNhan: { ho_ten: 'Admin' },
    });
    prismaMock.khenThuongHCCSVV.findMany.mockResolvedValueOnce([]);
    prismaMock.quanNhan.findUnique.mockResolvedValueOnce(personnel);
    prismaMock.khenThuongHCCSVV.upsert.mockResolvedValueOnce({});
    prismaMock.hoSoNienHan.upsert.mockResolvedValueOnce({});
    prismaMock.bangDeXuat.updateMany.mockResolvedValueOnce({ count: 1 });

    const error = await expectError(
      proposalService.approveProposal(
        proposal.id,
        {},
        ADMIN_ID,
        { so_quyet_dinh_nien_han: 'QD-NH-MSG-DEFAULT' },
        {},
        null
      ),
      ValidationError,
      { startsWith: 'Không thể phê duyệt đề xuất do có 1 lỗi khi thêm khen thưởng:' }
    );
    expect(error.message).toContain('Huy chương Chiến sĩ vẻ vang thiếu personnel_id');
  });
});
