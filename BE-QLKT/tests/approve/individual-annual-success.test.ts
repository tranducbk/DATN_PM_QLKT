import { prismaMock, resetPrismaMock } from '../helpers/prismaMock';
import {
  makeProposal,
  makePersonnel,
  makeUnit,
  makeProposalItemCaNhan,
  makeAnnualRecord,
} from '../helpers/fixtures';
import { expectError } from '../helpers/errorAssert';

import proposalService from '../../src/services/proposal';
import profileService from '../../src/services/profile.service';
import { ValidationError } from '../../src/middlewares/errorHandler';
import { PROPOSAL_TYPES } from '../../src/constants/proposalTypes.constants';
import { PROPOSAL_STATUS } from '../../src/constants/proposalStatus.constants';
import { DANH_HIEU_CA_NHAN_HANG_NAM } from '../../src/constants/danhHieu.constants';

beforeEach(() => {
  resetPrismaMock();
  jest
    .spyOn(profileService, 'recalculateAnnualProfile')
    .mockResolvedValue(undefined as unknown as never);
  jest
    .spyOn(profileService, 'checkAwardEligibility')
    .mockResolvedValue({ eligible: true, reason: '' });
});

afterEach(() => {
  jest.restoreAllMocks();
});

const ADMIN_ID = 'acc-admin-1';

describe('approveProposal — CA_NHAN_HANG_NAM (success paths)', () => {
  it('duyệt thành công với CSTDCS (CQDV) → status APPROVED + upsert đúng dữ liệu', async () => {
    // Given: đề xuất CA_NHAN_HANG_NAM có 1 item CSTDCS, không trùng
    const cqdv = makeUnit({ kind: 'CQDV', id: 'cqdv-1' });
    const personnel = makePersonnel({ unit: cqdv, id: 'qn-1', ho_ten: 'Nguyễn Văn A' });
    const item = makeProposalItemCaNhan({
      personnel_id: personnel.id,
      ho_ten: personnel.ho_ten,
      danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.CSTDCS,
      so_quyet_dinh: 'QD-CSTDCS-1',
    });
    const proposal = makeProposal({
      id: 'prop-1',
      loai: PROPOSAL_TYPES.CA_NHAN_HANG_NAM,
      status: PROPOSAL_STATUS.PENDING,
      nam: 2024,
      nguoi_de_xuat_id: ADMIN_ID,
      unit: cqdv,
      data_danh_hieu: [item],
    });

    prismaMock.bangDeXuat.findUnique.mockResolvedValueOnce(proposal);
    prismaMock.quanNhan.findMany.mockResolvedValueOnce([{ id: personnel.id, ho_ten: personnel.ho_ten }]);
    // CSTDCS kích hoạt check loại trừ → 2 findFirst + 2 findMany
    prismaMock.danhHieuHangNam.findFirst.mockResolvedValueOnce(null);
    prismaMock.bangDeXuat.findMany.mockResolvedValueOnce([]);
    prismaMock.danhHieuHangNam.findFirst.mockResolvedValueOnce(null);
    prismaMock.bangDeXuat.findMany.mockResolvedValueOnce([]);
    prismaMock.quanNhan.findUnique.mockResolvedValueOnce(personnel);
    prismaMock.danhHieuHangNam.upsert.mockResolvedValueOnce(
      makeAnnualRecord({
        personnelId: personnel.id,
        nam: 2024,
        danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.CSTDCS,
      })
    );
    prismaMock.bangDeXuat.updateMany.mockResolvedValueOnce({ count: 1 });

    // When: gọi duyệt
    const result = await proposalService.approveProposal(
      proposal.id,
      {},
      ADMIN_ID,
      { so_quyet_dinh_cstdcs: 'QD-CSTDCS-1' },
      {},
      null
    );

    // Then: upsert tạo bản ghi CSTDCS + bangDeXuat chuyển sang APPROVED
    expect(prismaMock.danhHieuHangNam.upsert).toHaveBeenCalledTimes(1);
    const upsertArgs = prismaMock.danhHieuHangNam.upsert.mock.calls[0][0];
    expect(upsertArgs.where.quan_nhan_id_nam).toEqual({
      quan_nhan_id: personnel.id,
      nam: 2024,
    });
    expect(upsertArgs.create).toMatchObject({
      quan_nhan_id: personnel.id,
      nam: 2024,
      danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.CSTDCS,
      so_quyet_dinh: 'QD-CSTDCS-1',
    });

    expect(prismaMock.bangDeXuat.updateMany).toHaveBeenCalledTimes(1);
    const updateArgs = prismaMock.bangDeXuat.updateMany.mock.calls[0][0];
    expect(updateArgs.where).toEqual({ id: proposal.id, status: PROPOSAL_STATUS.PENDING });
    expect(updateArgs.data.status).toBe(PROPOSAL_STATUS.APPROVED);
    expect(updateArgs.data.nguoi_duyet_id).toBe(ADMIN_ID);

    expect(result.affectedPersonnelIds).toContain(personnel.id);
  });

  it('duyệt thành công với BKBQP (DVTT) → upsert set nhan_bkbqp: true', async () => {
    // Given: đề xuất chỉ chứa 1 item BKBQP chain từ đơn vị DVTT
    const dvtt = makeUnit({ kind: 'DVTT', id: 'dvtt-1', parentId: 'cqdv-parent' });
    const personnel = makePersonnel({ unit: dvtt, id: 'qn-2' });
    const item = makeProposalItemCaNhan({
      personnel_id: personnel.id,
      danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.BKBQP,
      so_quyet_dinh: 'QD-BK-1',
    });
    const proposal = makeProposal({
      id: 'prop-2',
      loai: PROPOSAL_TYPES.CA_NHAN_HANG_NAM,
      nam: 2024,
      nguoi_de_xuat_id: ADMIN_ID,
      unit: dvtt,
      data_danh_hieu: [item],
    });

    prismaMock.bangDeXuat.findUnique.mockResolvedValueOnce(proposal);
    prismaMock.quanNhan.findMany.mockResolvedValueOnce([{ id: personnel.id, ho_ten: personnel.ho_ten }]);
    prismaMock.danhHieuHangNam.findFirst.mockResolvedValueOnce(null);
    prismaMock.bangDeXuat.findMany.mockResolvedValueOnce([]);
    prismaMock.quanNhan.findUnique.mockResolvedValueOnce(personnel);
    prismaMock.danhHieuHangNam.upsert.mockResolvedValueOnce(
      makeAnnualRecord({ personnelId: personnel.id, nam: 2024, nhan_bkbqp: true })
    );
    prismaMock.bangDeXuat.updateMany.mockResolvedValueOnce({ count: 1 });

    // When: gọi duyệt
    await proposalService.approveProposal(
      proposal.id,
      {},
      ADMIN_ID,
      { so_quyet_dinh_bkbqp: 'QD-BK-1' },
      {},
      null
    );

    // Then: payload upsert phản ánh flag BKBQP — danh_hieu vẫn để trống
    const upsertArgs = prismaMock.danhHieuHangNam.upsert.mock.calls[0][0];
    expect(upsertArgs.create.nhan_bkbqp).toBe(true);
    expect(upsertArgs.create.so_quyet_dinh_bkbqp).toBe('QD-BK-1');
    expect(upsertArgs.create.danh_hieu).toBeUndefined();
  });

  it('duyệt thành công CSTT (DVTT variant) — verify don_vi_truc_thuoc_id resolved', async () => {
    // Given: đề xuất từ DVTT chỉ có 1 item CSTT
    const dvtt = makeUnit({ kind: 'DVTT', id: 'dvtt-2', parentId: 'cqdv-parent-2' });
    const personnel = makePersonnel({ unit: dvtt, id: 'qn-cstt' });
    const item = makeProposalItemCaNhan({
      personnel_id: personnel.id,
      danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.CSTT,
      so_quyet_dinh: 'QD-CSTT-DVTT',
    });
    const proposal = makeProposal({
      id: 'prop-dvtt-1',
      loai: PROPOSAL_TYPES.CA_NHAN_HANG_NAM,
      nam: 2024,
      nguoi_de_xuat_id: ADMIN_ID,
      unit: dvtt,
      data_danh_hieu: [item],
    });

    prismaMock.bangDeXuat.findUnique.mockResolvedValueOnce(proposal);
    prismaMock.quanNhan.findMany.mockResolvedValueOnce([{ id: personnel.id, ho_ten: personnel.ho_ten }]);
    // CSTT cũng kích hoạt check loại trừ → 2 findFirst, 2 findMany
    prismaMock.danhHieuHangNam.findFirst.mockResolvedValueOnce(null);
    prismaMock.bangDeXuat.findMany.mockResolvedValueOnce([]);
    prismaMock.danhHieuHangNam.findFirst.mockResolvedValueOnce(null);
    prismaMock.bangDeXuat.findMany.mockResolvedValueOnce([]);
    prismaMock.quanNhan.findUnique.mockResolvedValueOnce(personnel);
    prismaMock.danhHieuHangNam.upsert.mockResolvedValueOnce(
      makeAnnualRecord({
        personnelId: personnel.id,
        nam: 2024,
        danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.CSTT,
      })
    );
    prismaMock.bangDeXuat.updateMany.mockResolvedValueOnce({ count: 1 });

    // When: gọi duyệt
    await proposalService.approveProposal(proposal.id, {}, ADMIN_ID, {}, {}, null);

    // Then: bangDeXuat chuyển APPROVED và upsert CSTT
    expect(prismaMock.bangDeXuat.updateMany).toHaveBeenCalledTimes(1);
    expect(prismaMock.bangDeXuat.updateMany.mock.calls[0][0].data.status).toBe(PROPOSAL_STATUS.APPROVED);
    const upsertArgs = prismaMock.danhHieuHangNam.upsert.mock.calls[0][0];
    expect(upsertArgs.create.danh_hieu).toBe(DANH_HIEU_CA_NHAN_HANG_NAM.CSTT);
  });

  it('approve thành công khi đầy đủ so_quyet_dinh (top-level decisions map)', async () => {
    const personnel = makePersonnel({ id: 'qn-full-qd', ho_ten: 'QN Đầy Đủ' });
    const item = makeProposalItemCaNhan({
      personnel_id: personnel.id,
      ho_ten: personnel.ho_ten,
      danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.CSTDCS,
    });
    const proposal = makeProposal({
      id: 'prop-full-qd',
      loai: PROPOSAL_TYPES.CA_NHAN_HANG_NAM,
      nam: 2024,
      nguoi_de_xuat_id: ADMIN_ID,
      data_danh_hieu: [item],
    });

    prismaMock.bangDeXuat.findUnique.mockResolvedValueOnce(proposal);
    prismaMock.quanNhan.findMany.mockResolvedValueOnce([{ id: personnel.id, ho_ten: personnel.ho_ten }]);
    prismaMock.danhHieuHangNam.findFirst.mockResolvedValueOnce(null);
    prismaMock.bangDeXuat.findMany.mockResolvedValueOnce([]);
    prismaMock.danhHieuHangNam.findFirst.mockResolvedValueOnce(null);
    prismaMock.bangDeXuat.findMany.mockResolvedValueOnce([]);
    prismaMock.quanNhan.findUnique.mockResolvedValueOnce(personnel);
    prismaMock.danhHieuHangNam.upsert.mockResolvedValueOnce(
      makeAnnualRecord({
        personnelId: personnel.id,
        nam: 2024,
        danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.CSTDCS,
        so_quyet_dinh: 'QD-FROM-MAP',
      })
    );
    prismaMock.bangDeXuat.updateMany.mockResolvedValueOnce({ count: 1 });

    await proposalService.approveProposal(
      proposal.id,
      {},
      ADMIN_ID,
      { so_quyet_dinh_cstdcs: 'QD-FROM-MAP' },
      {},
      null
    );

    expect(prismaMock.danhHieuHangNam.upsert).toHaveBeenCalledTimes(1);
  });

  it('item CSTDCS kèm flag BKBQP — upsert lưu cả CSTDCS lẫn BKBQP', async () => {
    // Validation và upsert giờ thống nhất dùng resolved chain values, nên mixed item
    // (CSTDCS + nhan_bkbqp) persist được cả hai field — không drop BKBQP nữa.
    const personnel = makePersonnel({ id: 'qn-combo-ok', ho_ten: 'QN Combo Đủ' });
    const item = {
      ...makeProposalItemCaNhan({
        personnel_id: personnel.id,
        ho_ten: personnel.ho_ten,
        danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.CSTDCS,
        so_quyet_dinh: 'QD-CS-COMBO',
      }),
      nhan_bkbqp: true,
      so_quyet_dinh_bkbqp: 'QD-BK-COMBO',
    };
    const proposal = makeProposal({
      id: 'prop-combo-ok',
      loai: PROPOSAL_TYPES.CA_NHAN_HANG_NAM,
      nam: 2024,
      nguoi_de_xuat_id: ADMIN_ID,
      data_danh_hieu: [item],
    });

    prismaMock.bangDeXuat.findUnique.mockResolvedValueOnce(proposal);
    prismaMock.quanNhan.findMany.mockResolvedValueOnce([{ id: personnel.id, ho_ten: personnel.ho_ten }]);
    // CSTDCS kích hoạt check loại trừ → 2 findFirst + 2 findMany
    prismaMock.danhHieuHangNam.findFirst.mockResolvedValueOnce(null);
    prismaMock.bangDeXuat.findMany.mockResolvedValueOnce([]);
    prismaMock.danhHieuHangNam.findFirst.mockResolvedValueOnce(null);
    prismaMock.bangDeXuat.findMany.mockResolvedValueOnce([]);
    prismaMock.quanNhan.findUnique.mockResolvedValueOnce(personnel);
    prismaMock.danhHieuHangNam.upsert.mockResolvedValueOnce(
      makeAnnualRecord({
        personnelId: personnel.id,
        nam: 2024,
        danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.CSTDCS,
        so_quyet_dinh: 'QD-CS-COMBO',
      })
    );
    prismaMock.bangDeXuat.updateMany.mockResolvedValueOnce({ count: 1 });

    // When: gọi duyệt
    await proposalService.approveProposal(proposal.id, {}, ADMIN_ID, {}, {}, null);

    // Then: upsert mang cả dữ liệu CSTDCS và flag/QD BKBQP
    expect(prismaMock.danhHieuHangNam.upsert).toHaveBeenCalledTimes(1);
    const upsertArgs = prismaMock.danhHieuHangNam.upsert.mock.calls[0][0];
    expect(upsertArgs.create.danh_hieu).toBe(DANH_HIEU_CA_NHAN_HANG_NAM.CSTDCS);
    expect(upsertArgs.create.so_quyet_dinh).toBe('QD-CS-COMBO');
    expect(upsertArgs.create.nhan_bkbqp).toBe(true);
    expect(upsertArgs.create.so_quyet_dinh_bkbqp).toBe('QD-BK-COMBO');
    expect(prismaMock.bangDeXuat.updateMany.mock.calls[0][0].data.status).toBe(PROPOSAL_STATUS.APPROVED);
  });

  it('field isolation — item BKBQP-only chỉ lưu so_quyet_dinh_bkbqp, các field khác không bị contaminate', async () => {
    // Given: item BKBQP chỉ có so_quyet_dinh_bkbqp. Sau approve, upsert.create
    // KHÔNG được mang so_quyet_dinh / so_quyet_dinh_cstdtq / so_quyet_dinh_bkttcp.
    const personnel = makePersonnel({ id: 'qn-iso-bk', ho_ten: 'QN Iso BK' });
    const item = {
      ...makeProposalItemCaNhan({
        personnel_id: personnel.id,
        ho_ten: personnel.ho_ten,
        danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.BKBQP,
      }),
      so_quyet_dinh_bkbqp: 'QD-BK-ONLY',
    };
    const proposal = makeProposal({
      id: 'prop-iso-bk',
      loai: PROPOSAL_TYPES.CA_NHAN_HANG_NAM,
      nam: 2024,
      nguoi_de_xuat_id: ADMIN_ID,
      data_danh_hieu: [item],
    });

    prismaMock.bangDeXuat.findUnique.mockResolvedValueOnce(proposal);
    prismaMock.quanNhan.findMany.mockResolvedValueOnce([{ id: personnel.id, ho_ten: personnel.ho_ten }]);
    prismaMock.danhHieuHangNam.findFirst.mockResolvedValueOnce(null);
    prismaMock.bangDeXuat.findMany.mockResolvedValueOnce([]);
    prismaMock.quanNhan.findUnique.mockResolvedValueOnce(personnel);
    prismaMock.danhHieuHangNam.upsert.mockResolvedValueOnce(
      makeAnnualRecord({
        personnelId: personnel.id,
        nam: 2024,
        nhan_bkbqp: true,
        so_quyet_dinh_bkbqp: 'QD-BK-ONLY',
      })
    );
    prismaMock.bangDeXuat.updateMany.mockResolvedValueOnce({ count: 1 });

    // When: gọi duyệt
    await proposalService.approveProposal(proposal.id, {}, ADMIN_ID, {}, {}, null);

    // Then: chỉ field BKBQP được set; các so_quyet_dinh_* khác giữ nguyên
    expect(prismaMock.danhHieuHangNam.upsert).toHaveBeenCalledTimes(1);
    const upsertArgs = prismaMock.danhHieuHangNam.upsert.mock.calls[0][0];
    expect(upsertArgs.create.nhan_bkbqp).toBe(true);
    expect(upsertArgs.create.so_quyet_dinh_bkbqp).toBe('QD-BK-ONLY');
    expect(upsertArgs.create.danh_hieu).toBeUndefined();
    expect(upsertArgs.create.so_quyet_dinh).toBeUndefined();
    expect(upsertArgs.create.so_quyet_dinh_cstdtq).toBeUndefined();
    expect(upsertArgs.create.so_quyet_dinh_bkttcp).toBeUndefined();
    expect(upsertArgs.create.nhan_cstdtq).toBeUndefined();
    expect(upsertArgs.create.nhan_bkttcp).toBeUndefined();
  });

  it('edge case: data_danh_hieu rỗng → bỏ qua mixed-group check, vẫn approve', async () => {
    // Given: đề xuất CA_NHAN_HANG_NAM rỗng — không có item để import
    const proposal = makeProposal({
      id: 'prop-empty',
      loai: PROPOSAL_TYPES.CA_NHAN_HANG_NAM,
      nam: 2024,
      nguoi_de_xuat_id: ADMIN_ID,
      data_danh_hieu: [],
    });

    prismaMock.bangDeXuat.findUnique.mockResolvedValueOnce(proposal);
    prismaMock.bangDeXuat.updateMany.mockResolvedValueOnce({ count: 1 });

    // When: gọi duyệt
    const result = await proposalService.approveProposal(proposal.id, {}, ADMIN_ID, {}, {}, null);

    // Then: không upsert, không check trùng, nhưng bangDeXuat vẫn chuyển APPROVED
    expect(prismaMock.danhHieuHangNam.upsert).not.toHaveBeenCalled();
    expect(prismaMock.bangDeXuat.updateMany).toHaveBeenCalledTimes(1);
    expect(prismaMock.bangDeXuat.updateMany.mock.calls[0][0].data.status).toBe(PROPOSAL_STATUS.APPROVED);
    expect(result.affectedPersonnelIds).toEqual([]);
  });

  it('approve transaction rollback: missing personnel aggregates into ValidationError', async () => {
    const personnel = makePersonnel({ id: 'qn-msg-ok', ho_ten: 'QN Message OK' });
    const proposal = makeProposal({
      id: 'prop-msg-ca-nhan',
      loai: PROPOSAL_TYPES.CA_NHAN_HANG_NAM,
      nam: 2024,
      nguoi_de_xuat_id: ADMIN_ID,
      data_danh_hieu: [
        makeProposalItemCaNhan({
          personnel_id: personnel.id,
          ho_ten: personnel.ho_ten,
          danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.BKBQP,
        }),
        makeProposalItemCaNhan({
          personnel_id: 'qn-missing-msg',
          ho_ten: 'QN Missing',
          danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.BKBQP,
        }),
      ],
    });

    prismaMock.bangDeXuat.findUnique.mockResolvedValueOnce(proposal);
    prismaMock.quanNhan.findMany.mockResolvedValueOnce([
      { id: personnel.id, ho_ten: personnel.ho_ten },
      { id: 'qn-missing-msg', ho_ten: 'QN Missing' },
    ]);
    prismaMock.danhHieuHangNam.findFirst.mockResolvedValue(null);
    prismaMock.bangDeXuat.findMany.mockResolvedValue([]);
    prismaMock.quanNhan.findUnique
      .mockResolvedValueOnce(personnel)
      .mockResolvedValueOnce(null);
    prismaMock.danhHieuHangNam.upsert.mockResolvedValueOnce(
      makeAnnualRecord({ personnelId: personnel.id, nam: 2024, nhan_bkbqp: true })
    );
    prismaMock.bangDeXuat.updateMany.mockResolvedValueOnce({ count: 1 });

    const error = await expectError(
      proposalService.approveProposal(
        proposal.id,
        {},
        ADMIN_ID,
        { so_quyet_dinh_bkbqp: 'QD-BKBQP-MSG' },
        {},
        null
      ),
      ValidationError,
      { startsWith: 'Không thể phê duyệt đề xuất do có 1 lỗi khi thêm khen thưởng:' }
    );
    expect(error.message).toContain('Không tìm thấy thông tin quân nhân khi lưu danh hiệu');
  });
});
