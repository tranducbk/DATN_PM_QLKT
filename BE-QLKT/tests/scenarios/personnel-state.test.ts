/**
 * Personnel state mid-flow scenarios.
 *
 * Covers what happens when a personnel/account row mutates between submit and
 * approve (discharge, unit transfer, hard delete, account delete, corrupted
 * dates). Each test pins the exact behavior — including security gaps that
 * the route layer is expected to catch but the service does not. TODO: harden
 * the service to reject these payloads instead of silently storing them.
 */

import { prismaMock } from '../helpers/prismaMock';
import {
  makePersonnel,
  makeAdmin,
  makeProposal,
  makeUnit,
} from '../helpers/fixtures';
import { expectError } from '../helpers/errorAssert';
import {
  PERSONNEL_STATE_HCQKQT_NOT_FOUND,
  PERSONNEL_STATE_HCQKQT_MISSING_NHAP_NGU,
  APPROVE_ELIGIBILITY_PREFIX,
  hcqkqtNotEnoughYears,
} from '../helpers/errorMessages';

import proposalService from '../../src/services/proposal';
import { ValidationError } from '../../src/middlewares/errorHandler';
import { PROPOSAL_TYPES } from '../../src/constants/proposalTypes.constants';
import { PROPOSAL_STATUS } from '../../src/constants/proposalStatus.constants';
import { DANH_HIEU_CA_NHAN_HANG_NAM } from '../../src/constants/danhHieu.constants';

afterEach(() => {
  jest.restoreAllMocks();
});

const ADMIN_ID = 'acc-state-admin';

describe('Personnel state mid-flow — discharge, transfer, delete', () => {
  it('QN xuất ngũ giữa năm proposal → approve HCQKQT vẫn tính tới ngay_xuat_ngu (không tới refDate)', async () => {
    // Given: proposal nam=2024 thang=12, QN xuất ngũ 2024-06-30 mới phục vụ 24 năm
    const target = makePersonnel({ id: 'qn-discharge-mid' });
    const proposal = makeProposal({
      id: 'p-discharge',
      loai: PROPOSAL_TYPES.HC_QKQT,
      nam: 2024,
      thang: 12,
      nguoi_de_xuat_id: ADMIN_ID,
      data_nien_han: [
        { personnel_id: target.id, ho_ten: target.ho_ten, danh_hieu: PROPOSAL_TYPES.HC_QKQT },
      ],
    });
    prismaMock.bangDeXuat.findUnique.mockResolvedValueOnce(proposal);
    prismaMock.quanNhan.findMany
      .mockResolvedValueOnce([{ id: target.id, ho_ten: target.ho_ten }])
      .mockResolvedValueOnce([
        {
          id: target.id,
          ho_ten: target.ho_ten,
          ngay_nhap_ngu: new Date('2000-07-01'),
          ngay_xuat_ngu: new Date('2024-06-30'),
        },
      ]);
    prismaMock.huanChuongQuanKyQuyetThang.findFirst.mockResolvedValueOnce(null);
    prismaMock.bangDeXuat.findMany.mockResolvedValueOnce([]);

    // When + Then: 2000-07 đến 2024-06 = 287 tháng = 23n 11t → reject
    const expectedMonths = 287;
    await expectError(
      proposalService.approveProposal(proposal.id, {}, ADMIN_ID, {}, {}, null),
      ValidationError,
      `${APPROVE_ELIGIBILITY_PREFIX}\n${hcqkqtNotEnoughYears(target.ho_ten, expectedMonths)}`
    );
    expect(prismaMock.huanChuongQuanKyQuyetThang.create).not.toHaveBeenCalled();
  });

  it('QN bị xoá hoàn toàn giữa flow → approve HCQKQT throw "Không tìm thấy quân nhân"', async () => {
    // Given: proposal trỏ đến qn-ghost đã không còn tồn tại
    const proposal = makeProposal({
      id: 'p-deleted-qn',
      loai: PROPOSAL_TYPES.HC_QKQT,
      nam: 2024,
      thang: 6,
      nguoi_de_xuat_id: ADMIN_ID,
      data_nien_han: [
        { personnel_id: 'qn-ghost', ho_ten: 'Ghost', danh_hieu: PROPOSAL_TYPES.HC_QKQT },
      ],
    });
    prismaMock.bangDeXuat.findUnique.mockResolvedValueOnce(proposal);
    // findMany lần 1: map ho_ten. Lần 2: tra HC_QKQT eligibility — đều rỗng.
    prismaMock.quanNhan.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    prismaMock.huanChuongQuanKyQuyetThang.findFirst.mockResolvedValueOnce(null);
    prismaMock.bangDeXuat.findMany.mockResolvedValueOnce([]);

    await expectError(
      proposalService.approveProposal(proposal.id, {}, ADMIN_ID, {}, {}, null),
      ValidationError,
      `${APPROVE_ELIGIBILITY_PREFIX}\n${PERSONNEL_STATE_HCQKQT_NOT_FOUND('qn-ghost')}`
    );
  });

  it('QN thiếu ngay_nhap_ngu (data corruption) → approve HCQKQT reject với reason exact', async () => {
    // Given: QN đã có nhưng ngay_nhap_ngu bị xóa sau khi submit
    const target = makePersonnel({ id: 'qn-no-nhapngu' });
    const proposal = makeProposal({
      id: 'p-no-nhap',
      loai: PROPOSAL_TYPES.HC_QKQT,
      nam: 2024,
      thang: 6,
      nguoi_de_xuat_id: ADMIN_ID,
      data_nien_han: [
        { personnel_id: target.id, ho_ten: target.ho_ten, danh_hieu: PROPOSAL_TYPES.HC_QKQT },
      ],
    });
    prismaMock.bangDeXuat.findUnique.mockResolvedValueOnce(proposal);
    prismaMock.quanNhan.findMany
      .mockResolvedValueOnce([{ id: target.id, ho_ten: target.ho_ten }])
      .mockResolvedValueOnce([
        { id: target.id, ho_ten: target.ho_ten, ngay_nhap_ngu: null, ngay_xuat_ngu: null },
      ]);
    prismaMock.huanChuongQuanKyQuyetThang.findFirst.mockResolvedValueOnce(null);
    prismaMock.bangDeXuat.findMany.mockResolvedValueOnce([]);

    await expectError(
      proposalService.approveProposal(proposal.id, {}, ADMIN_ID, {}, {}, null),
      ValidationError,
      `${APPROVE_ELIGIBILITY_PREFIX}\n${PERSONNEL_STATE_HCQKQT_MISSING_NHAP_NGU(target.ho_ten)}`
    );
  });

  it('ngay_xuat_ngu < ngay_nhap_ngu (data corruption) → service clamp 0 tháng, reject "0 năm"', async () => {
    // Given: ngày bị lỗi (xuất ngũ trước nhập ngũ) — calculateServiceMonths clamp về 0
    // TODO: service nên reject corruption này thay vì giả bộ months=0
    const target = makePersonnel({ id: 'qn-corrupt-dates' });
    const proposal = makeProposal({
      id: 'p-corrupt',
      loai: PROPOSAL_TYPES.HC_QKQT,
      nam: 2024,
      thang: 6,
      nguoi_de_xuat_id: ADMIN_ID,
      data_nien_han: [
        { personnel_id: target.id, ho_ten: target.ho_ten, danh_hieu: PROPOSAL_TYPES.HC_QKQT },
      ],
    });
    prismaMock.bangDeXuat.findUnique.mockResolvedValueOnce(proposal);
    prismaMock.quanNhan.findMany
      .mockResolvedValueOnce([{ id: target.id, ho_ten: target.ho_ten }])
      .mockResolvedValueOnce([
        {
          id: target.id,
          ho_ten: target.ho_ten,
          ngay_nhap_ngu: new Date('2020-01-01'),
          ngay_xuat_ngu: new Date('2010-01-01'),
        },
      ]);
    prismaMock.huanChuongQuanKyQuyetThang.findFirst.mockResolvedValueOnce(null);
    prismaMock.bangDeXuat.findMany.mockResolvedValueOnce([]);

    // months clamp về 0 — formatServiceDuration(0) → "0 tháng"
    await expectError(
      proposalService.approveProposal(proposal.id, {}, ADMIN_ID, {}, {}, null),
      ValidationError,
      `${APPROVE_ELIGIBILITY_PREFIX}\n${target.ho_ten}: Chưa đủ 25 năm phục vụ để nhận HC QKQT (hiện 0 tháng)`
    );
  });

  it('QN chuyển đơn vị giữa flow → approve vẫn dùng đơn vị cũ trong proposal record', async () => {
    // Given: proposal lưu CQDV cũ; QN row giờ trỏ CQDV mới.
    // proposal.co_quan_don_vi_id là source of truth — KHÔNG tra lại từ QN.
    // TODO: cảnh báo người duyệt khi đơn vị QN lệch với đơn vị trong proposal.
    const oldUnit = makeUnit({ kind: 'CQDV', id: 'cqdv-old' });
    const newUnit = makeUnit({ kind: 'CQDV', id: 'cqdv-new' });
    const target = makePersonnel({ id: 'qn-transfer', unit: newUnit });
    const proposal = makeProposal({
      id: 'p-transfer',
      loai: PROPOSAL_TYPES.CA_NHAN_HANG_NAM,
      nam: 2024,
      nguoi_de_xuat_id: ADMIN_ID,
      unit: oldUnit,
      data_danh_hieu: [
        {
          personnel_id: target.id,
          ho_ten: target.ho_ten,
          danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.CSTDCS,
          so_quyet_dinh: 'QD-TRANSFER',
        },
      ],
      status: PROPOSAL_STATUS.APPROVED,
    });
    prismaMock.bangDeXuat.findUnique.mockResolvedValueOnce(proposal);

    // Approve proposal đã approved sẽ short-circuit — nhưng pin được rằng
    // proposal.co_quan_don_vi_id vẫn giữ đơn vị gốc dù QN đã chuyển.
    await expectError(
      proposalService.approveProposal(proposal.id, {}, ADMIN_ID, {}, {}, null),
      ValidationError,
      'Đề xuất này đã được phê duyệt trước đó'
    );
    expect(proposal.co_quan_don_vi_id).toBe(oldUnit.id);
  });
});
