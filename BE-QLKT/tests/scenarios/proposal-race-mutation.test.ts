import { prismaMock, resetPrismaMock } from '../helpers/prismaMock';
import { makePersonnel, makeProposal, makeProposalItemDonVi, makeUnit } from '../helpers/fixtures';

import proposalService from '../../src/services/proposal';
import profileService from '../../src/services/profile.service';
import unitAnnualAwardService from '../../src/services/unitAnnualAward.service';
import { ValidationError } from '../../src/middlewares/errorHandler';
import { PROPOSAL_TYPES } from '../../src/constants/proposalTypes.constants';
import { PROPOSAL_STATUS } from '../../src/constants/proposalStatus.constants';
import { ROLES } from '../../src/constants/roles.constants';
import {
  DANH_HIEU_CA_NHAN_HANG_NAM,
  DANH_HIEU_HCBVTQ,
  DANH_HIEU_HCCSVV,
  DANH_HIEU_DON_VI_HANG_NAM,
} from '../../src/constants/danhHieu.constants';

const ADMIN_ID = 'acc-admin-race';
const MANAGER_ID = 'acc-manager-race';

beforeEach(() => {
  resetPrismaMock();
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
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

describe('Tranh chấp đồng thời: Admin sửa/xóa dữ liệu nền trong khi đề xuất đang chờ duyệt', () => {
  it('Tranh chấp đồng thời: Admin xóa một CSTDCS đúng lúc Manager gửi đề xuất BKBQP → từ chối vì chỉ còn 1 năm CSTDCS', async () => {
    // Race: manager fetch profile thấy 2 năm CSTDCS (đủ BKBQP),
    // admin xóa 1 CSTDCS, manager bấm submit. Submit tính lại eligibility.
    const unit = makeUnit({ kind: 'CQDV', id: 'cqdv-race-delete' });
    const target = makePersonnel({ id: 'qn-race-delete', ho_ten: 'QN Bị Xóa', unit });
    const managerQn = makePersonnel({ id: 'qn-mgr-delete', ho_ten: 'Manager', unit });

    prismaMock.taiKhoan.findUnique.mockResolvedValueOnce({
      id: MANAGER_ID,
      username: 'manager',
      role: ROLES.MANAGER,
      QuanNhan: {
        ...managerQn,
        CoQuanDonVi: unit.CoQuanDonVi,
        DonViTrucThuoc: null,
      },
    });
    prismaMock.quanNhan.findMany.mockResolvedValue([target]);
    prismaMock.danhHieuHangNam.findFirst.mockResolvedValue(null);
    prismaMock.bangDeXuat.findMany.mockResolvedValue([]);

    // Override mock eligibility mặc định với reason fail mà profileService
    // sẽ trả về sau khi xóa: BKBQP cần 2 năm CSTDCS nhưng chỉ còn 1.
    (profileService.checkAwardEligibility as jest.Mock).mockResolvedValue({
      eligible: false,
      reason:
        'Chưa đủ điều kiện Bằng khen của Bộ trưởng Bộ Quốc phòng.\n' +
        'Yêu cầu: 2 năm CSTDCS liên tục, NCKH mỗi năm.\n' +
        'Hiện có: 1 năm CSTDCS, 2 năm NCKH.',
    });

    await expect(
      proposalService.submitProposal(
        [{ personnel_id: target.id, danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.BKBQP }],
        null,        MANAGER_ID,
        PROPOSAL_TYPES.CA_NHAN_HANG_NAM,
        2024,
        null,
        null
      )
    ).rejects.toThrow(ValidationError);

    expect(prismaMock.bangDeXuat.create).not.toHaveBeenCalled();
  });

  it('Tranh chấp đồng thời: Admin xóa một CSTDCS trong khi đề xuất BKBQP đang chờ → phê duyệt thất bại do kiểm tra lại điều kiện', async () => {
    // Race: proposal PENDING có BKBQP item, admin xóa CSTDCS,
    // rồi admin approve. approveProposal tính lại eligibility theo state mới.
    const unit = makeUnit({ kind: 'CQDV', id: 'cqdv-race-approve-delete' });
    const target = makePersonnel({ id: 'qn-race-approve-delete', ho_ten: 'QN Pending', unit });
    const proposal = makeProposal({
      id: 'prop-race-delete-approve',
      loai: PROPOSAL_TYPES.CA_NHAN_HANG_NAM,
      status: PROPOSAL_STATUS.PENDING,
      nam: 2024,
      nguoi_de_xuat_id: MANAGER_ID,
      unit,
      data_danh_hieu: [
        { personnel_id: target.id, danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.BKBQP },
      ],
    });

    prismaMock.bangDeXuat.findUnique.mockResolvedValue(proposal);
    prismaMock.quanNhan.findMany.mockResolvedValue([{ id: target.id, ho_ten: target.ho_ten }]);
    prismaMock.danhHieuHangNam.findMany.mockResolvedValue([]);
    prismaMock.bangDeXuat.findMany.mockResolvedValue([]);

    (profileService.checkAwardEligibility as jest.Mock).mockResolvedValue({
      eligible: false,
      reason:
        'Chưa đủ điều kiện Bằng khen của Bộ trưởng Bộ Quốc phòng.\n' +
        'Yêu cầu: 2 năm CSTDCS liên tục, NCKH mỗi năm.\n' +
        'Hiện có: 1 năm CSTDCS, 2 năm NCKH.',
    });

    await expect(
      proposalService.approveProposal(proposal.id, {}, ADMIN_ID, {}, {}, null)
    ).rejects.toThrow(/Kiểm tra lại điều kiện trước khi phê duyệt thất bại/);

    expect(prismaMock.danhHieuHangNam.upsert).not.toHaveBeenCalled();
    expect(prismaMock.bangDeXuat.updateMany).not.toHaveBeenCalled();
  });

  describe('Tranh chấp đồng thời: Admin xóa khen thưởng nền trong khi đề xuất chờ → gửi/duyệt thất bại', () => {
    it('Tranh chấp đồng thời: Admin xóa ĐVQT năm trước đúng lúc Manager gửi BKBQP đơn vị → từ chối vì chưa đủ 2 năm ĐVQT liên tục', async () => {
      // Given: manager submit BKBQP đơn vị nhưng admin vừa xóa ĐVQT 2y trước
      const unit = makeUnit({ kind: 'CQDV', id: 'cqdv-g1-bkbqp-submit' });
      const managerQn = makePersonnel({ id: 'qn-mgr-g1-bkbqp', unit, ho_ten: 'Manager G1' });

      prismaMock.taiKhoan.findUnique.mockResolvedValueOnce({
        id: MANAGER_ID,
        username: 'manager',
        role: ROLES.MANAGER,
        QuanNhan: { ...managerQn, CoQuanDonVi: unit.CoQuanDonVi, DonViTrucThuoc: null },
      });
      prismaMock.coQuanDonVi.findUnique.mockResolvedValue({
        id: unit.id,
        ten_don_vi: unit.ten_don_vi,
        ma_don_vi: 'CQDV-001',
      });
      prismaMock.bangDeXuat.findMany.mockResolvedValue([]);
      prismaMock.danhHieuDonViHangNam.findFirst.mockResolvedValue(null);

      jest
        .spyOn(unitAnnualAwardService, 'checkUnitAwardEligibility')
        .mockResolvedValue({
          eligible: false,
          reason: 'Chưa đủ 2 năm ĐVQT liên tục để nhận BKBQP',
        });

      // When + Then
      await expect(
        proposalService.submitProposal(
          [
            {
              personnel_id: '',
              don_vi_id: unit.id,
              don_vi_type: 'CO_QUAN_DON_VI',
              danh_hieu: DANH_HIEU_DON_VI_HANG_NAM.BKBQP,
            },
          ],
          null,          MANAGER_ID,
          PROPOSAL_TYPES.DON_VI_HANG_NAM,
          2024,
          null,
          null
        )
      ).rejects.toThrow(/Chưa đủ 2 năm ĐVQT liên tục/);

      expect(prismaMock.bangDeXuat.create).not.toHaveBeenCalled();
    });

    it('Tranh chấp đồng thời: Admin xóa lịch sử ĐVQT trong khi đề xuất BKBQP đơn vị đang chờ → phê duyệt thất bại do kiểm tra lại điều kiện', async () => {
      // Given: BKBQP đơn vị pending, admin xóa ĐVQT history → approve recheck fails
      const unit = makeUnit({ kind: 'CQDV', id: 'cqdv-g1-bkbqp-approve' });
      const item = makeProposalItemDonVi({
        unitKind: 'CQDV',
        unitId: unit.id,
        ten_don_vi: unit.ten_don_vi,
        danh_hieu: DANH_HIEU_DON_VI_HANG_NAM.BKBQP,
        so_quyet_dinh: 'QD-BKBQP-G1',
      });
      const proposal = makeProposal({
        id: 'prop-g1-bkbqp-approve',
        loai: PROPOSAL_TYPES.DON_VI_HANG_NAM,
        status: PROPOSAL_STATUS.PENDING,
        nam: 2024,
        nguoi_de_xuat_id: MANAGER_ID,
        unit,
        data_danh_hieu: [item],
      });

      prismaMock.bangDeXuat.findUnique.mockResolvedValue(proposal);
      prismaMock.quanNhan.findMany.mockResolvedValue([]);
      prismaMock.bangDeXuat.findMany.mockResolvedValue([]);
      prismaMock.danhHieuDonViHangNam.findFirst.mockResolvedValue(null);

      jest
        .spyOn(unitAnnualAwardService, 'checkUnitAwardEligibility')
        .mockResolvedValue({
          eligible: false,
          reason: 'Chưa đủ 2 năm ĐVQT liên tục để nhận BKBQP',
        });

      // When + Then
      await expect(
        proposalService.approveProposal(proposal.id, {}, ADMIN_ID, {}, {}, null)
      ).rejects.toThrow(/Kiểm tra lại điều kiện trước khi phê duyệt thất bại/);

      expect(prismaMock.danhHieuDonViHangNam.create).not.toHaveBeenCalled();
      expect(prismaMock.bangDeXuat.updateMany).not.toHaveBeenCalled();
    });

    it('Tranh chấp đồng thời: Admin xóa một BKBQP cần thiết trong khi đề xuất CSTDTQ đang chờ → phê duyệt thất bại do kiểm tra lại điều kiện', async () => {
      // Given: CSTDTQ pending nhưng admin xóa 1 BKBQP cần thiết → recheck fail
      const unit = makeUnit({ kind: 'CQDV', id: 'cqdv-g1-cstdtq' });
      const target = makePersonnel({ id: 'qn-g1-cstdtq', ho_ten: 'QN CSTDTQ Race', unit });
      const proposal = makeProposal({
        id: 'prop-g1-cstdtq',
        loai: PROPOSAL_TYPES.CA_NHAN_HANG_NAM,
        status: PROPOSAL_STATUS.PENDING,
        nam: 2024,
        nguoi_de_xuat_id: MANAGER_ID,
        unit,
        data_danh_hieu: [
          { personnel_id: target.id, danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.CSTDTQ },
        ],
      });

      prismaMock.bangDeXuat.findUnique.mockResolvedValue(proposal);
      prismaMock.quanNhan.findMany.mockResolvedValue([{ id: target.id, ho_ten: target.ho_ten }]);
      prismaMock.danhHieuHangNam.findMany.mockResolvedValue([]);
      prismaMock.bangDeXuat.findMany.mockResolvedValue([]);

      (profileService.checkAwardEligibility as jest.Mock).mockResolvedValue({
        eligible: false,
        reason:
          'Chưa đủ điều kiện CSTDTQ. Yêu cầu: 3 năm CSTDCS + 1 BKBQP. Hiện có: 3 CSTDCS + 0 BKBQP.',
      });

      // When + Then
      await expect(
        proposalService.approveProposal(proposal.id, {}, ADMIN_ID, {}, {}, null)
      ).rejects.toThrow(/Kiểm tra lại điều kiện trước khi phê duyệt thất bại/);

      expect(prismaMock.danhHieuHangNam.upsert).not.toHaveBeenCalled();
    });

    it('Tranh chấp đồng thời: Admin xóa một CSTDTQ trong cửa sổ 7 năm trong khi đề xuất BKTTCP đang chờ → phê duyệt thất bại do kiểm tra lại điều kiện', async () => {
      // Given: BKTTCP yêu cầu 3 BKBQP + 2 CSTDTQ trong 7y, admin xóa 1 CSTDTQ
      const unit = makeUnit({ kind: 'CQDV', id: 'cqdv-g1-bkttcp' });
      const target = makePersonnel({ id: 'qn-g1-bkttcp', ho_ten: 'QN BKTTCP Race', unit });
      const proposal = makeProposal({
        id: 'prop-g1-bkttcp',
        loai: PROPOSAL_TYPES.CA_NHAN_HANG_NAM,
        status: PROPOSAL_STATUS.PENDING,
        nam: 2024,
        nguoi_de_xuat_id: MANAGER_ID,
        unit,
        data_danh_hieu: [
          { personnel_id: target.id, danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.BKTTCP },
        ],
      });

      prismaMock.bangDeXuat.findUnique.mockResolvedValue(proposal);
      prismaMock.quanNhan.findMany.mockResolvedValue([{ id: target.id, ho_ten: target.ho_ten }]);
      prismaMock.danhHieuHangNam.findMany.mockResolvedValue([]);
      prismaMock.bangDeXuat.findMany.mockResolvedValue([]);

      (profileService.checkAwardEligibility as jest.Mock).mockResolvedValue({
        eligible: false,
        reason:
          'Chưa đủ điều kiện BKTTCP. Yêu cầu: 7y + 3 BKBQP + 2 CSTDTQ. Hiện có: 3 BKBQP + 1 CSTDTQ.',
      });

      // When + Then
      await expect(
        proposalService.approveProposal(proposal.id, {}, ADMIN_ID, {}, {}, null)
      ).rejects.toThrow(/Kiểm tra lại điều kiện trước khi phê duyệt thất bại/);

      expect(prismaMock.danhHieuHangNam.upsert).not.toHaveBeenCalled();
    });
  });

  describe('Tranh chấp đồng thời: Admin xóa lịch sử chức vụ trong khi xử lý HCBVTQ', () => {
    it('Tranh chấp đồng thời: Admin xóa hết lịch sử chức vụ đúng lúc Manager gửi HCBVTQ hạng Nhì → từ chối vì không đủ điều kiện', async () => {
      // Given: manager submit HCBVTQ HANG_NHI nhưng admin vừa xóa hết lịch sử chức vụ
      const unit = makeUnit({ kind: 'CQDV', id: 'cqdv-g2-ch-submit' });
      const managerQn = makePersonnel({ id: 'qn-mgr-g2', unit, ho_ten: 'Manager G2' });
      const target = makePersonnel({
        id: 'qn-g2-ch-submit',
        ho_ten: 'QN CH Submit',
        unit,
        gioi_tinh: 'NAM',
      });

      prismaMock.taiKhoan.findUnique.mockResolvedValueOnce({
        id: MANAGER_ID,
        username: 'manager',
        role: ROLES.MANAGER,
        QuanNhan: { ...managerQn, CoQuanDonVi: unit.CoQuanDonVi, DonViTrucThuoc: null },
      });
      prismaMock.quanNhan.findMany.mockResolvedValue([
        {
          id: target.id,
          ho_ten: target.ho_ten,
          gioi_tinh: 'NAM',
          co_quan_don_vi_id: unit.id,
          CoQuanDonVi: null,
          DonViTrucThuoc: null,
        },
      ]);
      prismaMock.lichSuChucVu.findMany.mockResolvedValue([]);
      prismaMock.bangDeXuat.findMany.mockResolvedValue([]);

      // When + Then
      await expect(
        proposalService.submitProposal(
          [
            {
              personnel_id: target.id,
              danh_hieu: DANH_HIEU_HCBVTQ.HANG_NHI,
              cap_bac: 'Đại úy',
              chuc_vu: 'Trợ lý',
            },
          ],
          null,          MANAGER_ID,
          PROPOSAL_TYPES.CONG_HIEN,
          2024,
          null,
          6
        )
      ).rejects.toThrow(/không đủ điều kiện đề xuất Huân chương Bảo vệ Tổ quốc/);

      expect(prismaMock.bangDeXuat.create).not.toHaveBeenCalled();
    });

    it('Tranh chấp đồng thời: Admin xóa lịch sử chức vụ trong khi đề xuất HCBVTQ hạng Nhất đang chờ → phê duyệt thất bại do kiểm tra lại điều kiện', async () => {
      // Given: HANG_NHAT pending (cần >=120 tháng nhóm 0.9-1.0), admin xóa lịch sử
      const unit = makeUnit({ kind: 'CQDV', id: 'cqdv-g2-ch-approve' });
      const target = makePersonnel({ id: 'qn-g2-ch-approve', ho_ten: 'QN CH Approve', unit, gioi_tinh: 'NAM' });
      const proposal = makeProposal({
        id: 'prop-g2-ch-approve',
        loai: PROPOSAL_TYPES.CONG_HIEN,
        status: PROPOSAL_STATUS.PENDING,
        nam: 2024,
        thang: 6,
        nguoi_de_xuat_id: MANAGER_ID,
        unit,
        data_cong_hien: [
          {
            personnel_id: target.id,
            ho_ten: target.ho_ten,
            danh_hieu: DANH_HIEU_HCBVTQ.HANG_NHAT,
            cap_bac: 'Đại úy',
            chuc_vu: 'Trợ lý',
            nam_nhan: 2024,
            thang_nhan: 6,
            so_quyet_dinh: 'QD-CH-G2',
            thoi_gian_nhom_0_7: { total_months: 0, years: 0, months: 0, display: '-' },
            thoi_gian_nhom_0_8: { total_months: 0, years: 0, months: 0, display: '-' },
            thoi_gian_nhom_0_9_1_0: { total_months: 130, years: 10, months: 10, display: '10 năm 10 tháng' },
          },
        ],
      });

      prismaMock.bangDeXuat.findUnique.mockResolvedValue(proposal);
      prismaMock.quanNhan.findMany.mockResolvedValue([
        { id: target.id, ho_ten: target.ho_ten, gioi_tinh: 'NAM' },
      ]);
      prismaMock.lichSuChucVu.findMany.mockResolvedValue([]);
      prismaMock.bangDeXuat.findMany.mockResolvedValue([]);

      // When + Then
      await expect(
        proposalService.approveProposal(proposal.id, {}, ADMIN_ID, {}, {}, null)
      ).rejects.toThrow(/Kiểm tra lại điều kiện trước khi phê duyệt thất bại/);

      expect(prismaMock.khenThuongHCBVTQ.create).not.toHaveBeenCalled();
      expect(prismaMock.bangDeXuat.updateMany).not.toHaveBeenCalled();
    });
  });

  describe('Tranh chấp đồng thời: Admin sửa ngày nhập ngũ làm hỏng điều kiện HC QKQT/KNC', () => {
    it('Tranh chấp đồng thời: Admin sửa ngày nhập ngũ thành năm 2002 (chỉ 22 năm) đúng lúc Manager gửi HC QKQT → từ chối vì chưa đủ 25 năm phục vụ', async () => {
      // Given: HC_QKQT cần >=25y phục vụ
      const unit = makeUnit({ kind: 'CQDV', id: 'cqdv-g3-qkqt-submit' });
      const managerQn = makePersonnel({ id: 'qn-mgr-g3-qkqt', unit, ho_ten: 'Manager G3' });
      const target = makePersonnel({
        id: 'qn-g3-qkqt-submit',
        ho_ten: 'QN QKQT Submit',
        unit,
        ngay_nhap_ngu: new Date('2002-01-01'),
      });

      prismaMock.taiKhoan.findUnique.mockResolvedValueOnce({
        id: MANAGER_ID,
        username: 'manager',
        role: ROLES.MANAGER,
        QuanNhan: { ...managerQn, CoQuanDonVi: unit.CoQuanDonVi, DonViTrucThuoc: null },
      });
      prismaMock.quanNhan.findMany.mockResolvedValue([
        {
          id: target.id,
          ho_ten: target.ho_ten,
          gioi_tinh: 'NAM',
          co_quan_don_vi_id: unit.id,
          ngay_nhap_ngu: target.ngay_nhap_ngu,
          ngay_xuat_ngu: null,
          CoQuanDonVi: null,
          DonViTrucThuoc: null,
        },
      ]);

      // When + Then
      await expect(
        proposalService.submitProposal(
          [{ personnel_id: target.id, danh_hieu: PROPOSAL_TYPES.HC_QKQT }],
          null,          MANAGER_ID,
          PROPOSAL_TYPES.HC_QKQT,
          2024,
          null,
          6
        )
      ).rejects.toThrow(/Chưa đủ 25 năm phục vụ/);

      expect(prismaMock.bangDeXuat.create).not.toHaveBeenCalled();
    });

    it('Tranh chấp đồng thời: Admin sửa ngày nhập ngũ trong khi đề xuất HC QKQT đang chờ → phê duyệt thất bại vì chưa đủ 25 năm phục vụ', async () => {
      const unit = makeUnit({ kind: 'CQDV', id: 'cqdv-g3-qkqt-approve' });
      const target = makePersonnel({
        id: 'qn-g3-qkqt-approve',
        ho_ten: 'QN QKQT Approve',
        unit,
        ngay_nhap_ngu: new Date('2002-01-01'),
      });
      const proposal = makeProposal({
        id: 'prop-g3-qkqt-approve',
        loai: PROPOSAL_TYPES.HC_QKQT,
        status: PROPOSAL_STATUS.PENDING,
        nam: 2024,
        thang: 6,
        nguoi_de_xuat_id: MANAGER_ID,
        unit,
        data_nien_han: [
          {
            personnel_id: target.id,
            danh_hieu: PROPOSAL_TYPES.HC_QKQT,
            nam_nhan: 2024,
            thang_nhan: 6,
            so_quyet_dinh: 'QD-QKQT-G3',
          },
        ],
      });

      prismaMock.bangDeXuat.findUnique.mockResolvedValue(proposal);
      prismaMock.quanNhan.findMany.mockResolvedValue([
        {
          id: target.id,
          ho_ten: target.ho_ten,
          gioi_tinh: 'NAM',
          ngay_nhap_ngu: target.ngay_nhap_ngu,
          ngay_xuat_ngu: null,
        },
      ]);
      prismaMock.bangDeXuat.findMany.mockResolvedValue([]);
      prismaMock.huanChuongQuanKyQuyetThang.findFirst.mockResolvedValue(null);

      await expect(
        proposalService.approveProposal(proposal.id, {}, ADMIN_ID, {}, {}, null)
      ).rejects.toThrow(/Chưa đủ 25 năm phục vụ/);

      expect(prismaMock.huanChuongQuanKyQuyetThang.create).not.toHaveBeenCalled();
      expect(prismaMock.bangDeXuat.updateMany).not.toHaveBeenCalled();
    });

    it('Tranh chấp đồng thời: Admin sửa ngày nhập ngũ của quân nhân nữ thành năm 2005 (chỉ 19 năm) đúng lúc gửi KNC → từ chối vì chưa đủ 20 năm phục vụ', async () => {
      // Given: KNC nữ cần 20y, admin sửa ngày nhập ngũ thành 2005-06-01 → 19y < 20y
      const unit = makeUnit({ kind: 'CQDV', id: 'cqdv-g3-knc-submit' });
      const managerQn = makePersonnel({ id: 'qn-mgr-g3-knc', unit, ho_ten: 'Manager G3 KNC' });
      const target = makePersonnel({
        id: 'qn-g3-knc-submit',
        ho_ten: 'QN KNC Submit',
        unit,
        gioi_tinh: 'NU',
        ngay_nhap_ngu: new Date('2008-06-01'),
      });

      prismaMock.taiKhoan.findUnique.mockResolvedValueOnce({
        id: MANAGER_ID,
        username: 'manager',
        role: ROLES.MANAGER,
        QuanNhan: { ...managerQn, CoQuanDonVi: unit.CoQuanDonVi, DonViTrucThuoc: null },
      });
      prismaMock.quanNhan.findMany.mockResolvedValue([
        {
          id: target.id,
          ho_ten: target.ho_ten,
          gioi_tinh: 'NU',
          co_quan_don_vi_id: unit.id,
          ngay_nhap_ngu: target.ngay_nhap_ngu,
          ngay_xuat_ngu: null,
          CoQuanDonVi: null,
          DonViTrucThuoc: null,
        },
      ]);

      await expect(
        proposalService.submitProposal(
          [{ personnel_id: target.id, danh_hieu: PROPOSAL_TYPES.KNC_VSNXD_QDNDVN }],
          null,          MANAGER_ID,
          PROPOSAL_TYPES.KNC_VSNXD_QDNDVN,
          2024,
          null,
          6
        )
      ).rejects.toThrow(/Chưa đủ 20 năm phục vụ/);

      expect(prismaMock.bangDeXuat.create).not.toHaveBeenCalled();
    });

    it('Tranh chấp đồng thời: Admin sửa ngày nhập ngũ trong khi đề xuất KNC đang chờ → phê duyệt thất bại vì chưa đủ 25 năm phục vụ', async () => {
      const unit = makeUnit({ kind: 'CQDV', id: 'cqdv-g3-knc-approve' });
      const target = makePersonnel({
        id: 'qn-g3-knc-approve',
        ho_ten: 'QN KNC Approve',
        unit,
        gioi_tinh: 'NAM',
        ngay_nhap_ngu: new Date('2005-06-01'),
      });
      const proposal = makeProposal({
        id: 'prop-g3-knc-approve',
        loai: PROPOSAL_TYPES.KNC_VSNXD_QDNDVN,
        status: PROPOSAL_STATUS.PENDING,
        nam: 2024,
        thang: 6,
        nguoi_de_xuat_id: MANAGER_ID,
        unit,
        data_nien_han: [
          {
            personnel_id: target.id,
            danh_hieu: PROPOSAL_TYPES.KNC_VSNXD_QDNDVN,
            nam_nhan: 2024,
            thang_nhan: 6,
            so_quyet_dinh: 'QD-KNC-G3',
          },
        ],
      });

      prismaMock.bangDeXuat.findUnique.mockResolvedValue(proposal);
      prismaMock.quanNhan.findMany.mockResolvedValue([
        {
          id: target.id,
          ho_ten: target.ho_ten,
          gioi_tinh: 'NAM',
          ngay_nhap_ngu: target.ngay_nhap_ngu,
          ngay_xuat_ngu: null,
        },
      ]);
      prismaMock.bangDeXuat.findMany.mockResolvedValue([]);
      prismaMock.kyNiemChuongVSNXDQDNDVN.findFirst.mockResolvedValue(null);

      await expect(
        proposalService.approveProposal(proposal.id, {}, ADMIN_ID, {}, {}, null)
      ).rejects.toThrow(/Chưa đủ 25 năm phục vụ/);

      expect(prismaMock.kyNiemChuongVSNXDQDNDVN.create).not.toHaveBeenCalled();
      expect(prismaMock.bangDeXuat.updateMany).not.toHaveBeenCalled();
    });

    it('Tranh chấp đồng thời: Admin xóa giới tính của quân nhân trong khi đề xuất KNC đang chờ → phê duyệt từ chối "Chưa cập nhật thông tin giới tính"', async () => {
      const unit = makeUnit({ kind: 'CQDV', id: 'cqdv-g3-knc-gender' });
      const target = makePersonnel({
        id: 'qn-g3-knc-gender',
        ho_ten: 'QN KNC No Gender',
        unit,
        ngay_nhap_ngu: new Date('1990-01-01'),
      });
      const proposal = makeProposal({
        id: 'prop-g3-knc-gender',
        loai: PROPOSAL_TYPES.KNC_VSNXD_QDNDVN,
        status: PROPOSAL_STATUS.PENDING,
        nam: 2024,
        thang: 6,
        nguoi_de_xuat_id: MANAGER_ID,
        unit,
        data_nien_han: [
          {
            personnel_id: target.id,
            danh_hieu: PROPOSAL_TYPES.KNC_VSNXD_QDNDVN,
            nam_nhan: 2024,
            thang_nhan: 6,
            so_quyet_dinh: 'QD-KNC-GENDER',
          },
        ],
      });

      prismaMock.bangDeXuat.findUnique.mockResolvedValue(proposal);
      prismaMock.quanNhan.findMany.mockResolvedValue([
        {
          id: target.id,
          ho_ten: target.ho_ten,
          gioi_tinh: null,
          ngay_nhap_ngu: target.ngay_nhap_ngu,
          ngay_xuat_ngu: null,
        },
      ]);
      prismaMock.bangDeXuat.findMany.mockResolvedValue([]);

      await expect(
        proposalService.approveProposal(proposal.id, {}, ADMIN_ID, {}, {}, null)
      ).rejects.toThrow(/Chưa cập nhật thông tin giới tính/);

      expect(prismaMock.kyNiemChuongVSNXDQDNDVN.create).not.toHaveBeenCalled();
    });
  });

  describe('Tranh chấp đồng thời: Admin xóa HCCSVV hạng thấp làm sai thứ tự hạng', () => {
    it('Tranh chấp đồng thời: Admin xóa HCCSVV hạng Ba năm trước đúng lúc Manager gửi hạng Nhì → từ chối vì sai thứ tự hạng', async () => {
      // Given: HANG_NHI yêu cầu đã nhận HANG_BA, admin xóa HANG_BA → rank order check fail
      const unit = makeUnit({ kind: 'CQDV', id: 'cqdv-g4-nh-submit' });
      const managerQn = makePersonnel({ id: 'qn-mgr-g4', unit, ho_ten: 'Manager G4' });
      const target = makePersonnel({ id: 'qn-g4-nh-submit', ho_ten: 'QN NH Submit', unit });

      prismaMock.taiKhoan.findUnique.mockResolvedValueOnce({
        id: MANAGER_ID,
        username: 'manager',
        role: ROLES.MANAGER,
        QuanNhan: { ...managerQn, CoQuanDonVi: unit.CoQuanDonVi, DonViTrucThuoc: null },
      });
      prismaMock.quanNhan.findMany.mockResolvedValue([
        {
          id: target.id,
          ho_ten: target.ho_ten,
          co_quan_don_vi_id: unit.id,
          CoQuanDonVi: null,
          DonViTrucThuoc: null,
        },
      ]);
      prismaMock.khenThuongHCCSVV.findMany.mockResolvedValue([]);
      prismaMock.bangDeXuat.findMany.mockResolvedValue([]);

      await expect(
        proposalService.submitProposal(
          [
            {
              personnel_id: target.id,
              danh_hieu: DANH_HIEU_HCCSVV.HANG_NHI,
            },
          ],
          null,          MANAGER_ID,
          PROPOSAL_TYPES.NIEN_HAN,
          2024,
          null,
          6
        )
      ).rejects.toThrow(/HCCSVV/);

      expect(prismaMock.bangDeXuat.create).not.toHaveBeenCalled();
    });

    it('Tranh chấp đồng thời: Admin xóa HCCSVV hạng Ba trong khi đề xuất hạng Nhì đang chờ → phê duyệt thất bại do lỗi khi thêm khen thưởng', async () => {
      // Given: HANG_NHI pending, admin xóa HANG_BA → import loop ghi acc.errors → throw cuối tx
      const unit = makeUnit({ kind: 'CQDV', id: 'cqdv-g4-nh-approve' });
      const target = makePersonnel({
        id: 'qn-g4-nh-approve',
        ho_ten: 'QN NH Approve',
        unit,
        ngay_nhap_ngu: new Date('2010-01-01'),
      });
      const proposal = makeProposal({
        id: 'prop-g4-nh-approve',
        loai: PROPOSAL_TYPES.NIEN_HAN,
        status: PROPOSAL_STATUS.PENDING,
        nam: 2024,
        thang: 6,
        nguoi_de_xuat_id: MANAGER_ID,
        unit,
        data_nien_han: [
          {
            personnel_id: target.id,
            danh_hieu: DANH_HIEU_HCCSVV.HANG_NHI,
            nam_nhan: 2024,
            thang_nhan: 6,
            so_quyet_dinh: 'QD-NH-G4',
          },
        ],
      });

      prismaMock.bangDeXuat.findUnique.mockResolvedValue(proposal);
      prismaMock.quanNhan.findMany.mockResolvedValue([{ id: target.id, ho_ten: target.ho_ten }]);
      prismaMock.bangDeXuat.findMany.mockResolvedValue([]);
      prismaMock.khenThuongHCCSVV.findMany.mockResolvedValue([]);
      prismaMock.taiKhoan.findUnique.mockResolvedValue({
        id: ADMIN_ID,
        username: 'admin',
        QuanNhan: { ho_ten: 'Admin' },
      });
      prismaMock.quanNhan.findUnique.mockResolvedValue(target);

      await expect(
        proposalService.approveProposal(proposal.id, {}, ADMIN_ID, {}, {}, null)
      ).rejects.toThrow(/Không thể phê duyệt đề xuất do có/);

      expect(prismaMock.khenThuongHCCSVV.upsert).not.toHaveBeenCalled();
    });
  });
});
