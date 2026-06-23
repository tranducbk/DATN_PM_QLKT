import { prismaMock } from '../helpers/prismaMock';
import { makePersonnel, makeAnnualRecord, makeUnit } from '../helpers/fixtures';
import { expectError } from '../helpers/errorAssert';
import { missingDecisionNumberMessage } from '../helpers/errorMessages';
import annualRewardService from '../../src/services/annualReward.service';
import profileService from '../../src/services/profile.service';
import { NotFoundError, ValidationError } from '../../src/middlewares/errorHandler';
import {
  DANH_HIEU_CA_NHAN_HANG_NAM,
  getDanhHieuName,
} from '../../src/constants/danhHieu.constants';

afterEach(() => {
  jest.restoreAllMocks();
});

describe('Trao khen thưởng hằng năm: tạo (hoặc cập nhật) bản ghi khen thưởng cá nhân', () => {
  it('Trao khen thưởng hằng năm: CSTDCS năm 2024 cho quân nhân ở CQDV, chưa có bản ghi → tạo mới với đúng số quyết định', async () => {
    // Cho: personnel CQDV chưa có record annual cho năm đó
    const cqdv = makeUnit({ kind: 'CQDV', id: 'cqdv-1' });
    const personnel = makePersonnel({ unit: cqdv, id: 'qn-1', ho_ten: 'Nguyễn Văn A' });
    prismaMock.quanNhan.findUnique.mockResolvedValueOnce(personnel);
    prismaMock.danhHieuHangNam.findFirst.mockResolvedValueOnce(null);
    const created = makeAnnualRecord({
      personnelId: personnel.id,
      nam: 2024,
      danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.CSTDCS,
      so_quyet_dinh: 'QD-001',
    });
    prismaMock.danhHieuHangNam.create.mockResolvedValueOnce(created);

    // Khi: tạo annual reward
    const result = await annualRewardService.createAnnualReward({
      personnel_id: personnel.id,
      nam: 2024,
      danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.CSTDCS,
      so_quyet_dinh: 'QD-001',
    });

    // Thì: tạo row mới với các field đã cấp
    expect(result).toEqual(created);
    expect(prismaMock.danhHieuHangNam.create).toHaveBeenCalledTimes(1);
    const createArgs = prismaMock.danhHieuHangNam.create.mock.calls[0][0];
    expect(createArgs.data).toMatchObject({
      quan_nhan_id: personnel.id,
      nam: 2024,
      danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.CSTDCS,
      so_quyet_dinh: 'QD-001',
      nhan_bkbqp: false,
      nhan_cstdtq: false,
      nhan_bkttcp: false,
    });
  });

  it('Trao khen thưởng hằng năm: CSTT năm 2024 cho quân nhân ở ĐVTT, chưa có bản ghi → tạo mới giống đường CQDV', async () => {
    // Cho: personnel DVTT chưa có record
    const dvtt = makeUnit({ kind: 'DVTT', id: 'dvtt-1', parentId: 'cqdv-parent' });
    const personnel = makePersonnel({ unit: dvtt, id: 'qn-2' });
    prismaMock.quanNhan.findUnique.mockResolvedValueOnce(personnel);
    prismaMock.danhHieuHangNam.findFirst.mockResolvedValueOnce(null);
    const created = makeAnnualRecord({
      personnelId: personnel.id,
      nam: 2024,
      danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.CSTT,
      so_quyet_dinh: 'QD-CSTT-1',
    });
    prismaMock.danhHieuHangNam.create.mockResolvedValueOnce(created);

    // Khi
    await annualRewardService.createAnnualReward({
      personnel_id: personnel.id,
      nam: 2024,
      danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.CSTT,
      so_quyet_dinh: 'QD-CSTT-1',
    });

    // Thì: persistence không phụ thuộc kind đơn vị — DVTT path resolve giống hệt
    expect(prismaMock.danhHieuHangNam.create).toHaveBeenCalledTimes(1);
    const createArgs = prismaMock.danhHieuHangNam.create.mock.calls[0][0];
    expect(createArgs.data.quan_nhan_id).toBe(personnel.id);
    expect(createArgs.data.danh_hieu).toBe(DANH_HIEU_CA_NHAN_HANG_NAM.CSTT);
  });

  it('Trao khen thưởng hằng năm: đã có CSTDCS năm 2024, thêm BKBQP → cập nhật bản ghi cũ, lưu riêng số quyết định và ghi chú BKBQP', async () => {
    // Cho: đã có row CSTDCS năm đó, request thêm cờ BKBQP
    const personnel = makePersonnel({ id: 'qn-3' });
    const existing = makeAnnualRecord({
      personnelId: personnel.id,
      nam: 2024,
      danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.CSTDCS,
      so_quyet_dinh: 'QD-CSTDCS-2024',
    });
    prismaMock.quanNhan.findUnique.mockResolvedValueOnce(personnel);
    prismaMock.danhHieuHangNam.findFirst.mockResolvedValueOnce(existing);
    prismaMock.danhHieuHangNam.update.mockResolvedValueOnce({
      ...existing,
      nhan_bkbqp: true,
      so_quyet_dinh_bkbqp: 'QD-BKBQP-1',
    });

    // Khi
    await annualRewardService.createAnnualReward({
      personnel_id: personnel.id,
      nam: 2024,
      nhan_bkbqp: true,
      so_quyet_dinh_bkbqp: 'QD-BKBQP-1',
      ghi_chu: 'note-bkbqp',
    });

    // Thì: update bật nhan_bkbqp + set quyết định và ghi chú riêng cho BKBQP
    expect(prismaMock.danhHieuHangNam.update).toHaveBeenCalledTimes(1);
    const updateArgs = prismaMock.danhHieuHangNam.update.mock.calls[0][0];
    expect(updateArgs.where).toEqual({ id: existing.id });
    expect(updateArgs.data).toMatchObject({
      nhan_bkbqp: true,
      so_quyet_dinh_bkbqp: 'QD-BKBQP-1',
      ghi_chu_bkbqp: 'note-bkbqp',
    });
    expect(updateArgs.data.danh_hieu).toBeUndefined();
  });

  it('Trao khen thưởng hằng năm: thêm CSTDTQ vào bản ghi có sẵn → cập nhật cờ và số quyết định CSTDTQ', async () => {
    const personnel = makePersonnel({ id: 'qn-4' });
    const existing = makeAnnualRecord({
      personnelId: personnel.id,
      nam: 2024,
      danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.CSTDCS,
      so_quyet_dinh: 'QD-CSTDCS-2024',
      nhan_bkbqp: true,
      so_quyet_dinh_bkbqp: 'QDBK-2024',
    });
    prismaMock.quanNhan.findUnique.mockResolvedValueOnce(personnel);
    prismaMock.danhHieuHangNam.findFirst.mockResolvedValueOnce(existing);
    prismaMock.danhHieuHangNam.update.mockResolvedValueOnce({ ...existing, nhan_cstdtq: true });

    await annualRewardService.createAnnualReward({
      personnel_id: personnel.id,
      nam: 2024,
      nhan_cstdtq: true,
      so_quyet_dinh_cstdtq: 'QD-CSTDTQ-1',
    });

    const updateArgs = prismaMock.danhHieuHangNam.update.mock.calls[0][0];
    expect(updateArgs.data).toMatchObject({
      nhan_cstdtq: true,
      so_quyet_dinh_cstdtq: 'QD-CSTDTQ-1',
    });
  });

  it('Trao khen thưởng hằng năm: thêm BKTTCP vào bản ghi có sẵn → cập nhật cờ và số quyết định BKTTCP', async () => {
    const personnel = makePersonnel({ id: 'qn-5' });
    const existing = makeAnnualRecord({
      personnelId: personnel.id,
      nam: 2024,
      danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.CSTDCS,
      so_quyet_dinh: 'QD-CSTDCS-2024',
    });
    prismaMock.quanNhan.findUnique.mockResolvedValueOnce(personnel);
    prismaMock.danhHieuHangNam.findFirst.mockResolvedValueOnce(existing);
    prismaMock.danhHieuHangNam.update.mockResolvedValueOnce({ ...existing, nhan_bkttcp: true, so_quyet_dinh_bkttcp: 'QD-BKTTCP-1' });

    await annualRewardService.createAnnualReward({
      personnel_id: personnel.id,
      nam: 2024,
      nhan_bkttcp: true,
      so_quyet_dinh_bkttcp: 'QD-BKTTCP-1',
    });

    const updateArgs = prismaMock.danhHieuHangNam.update.mock.calls[0][0];
    expect(updateArgs.data).toMatchObject({
      nhan_bkttcp: true,
      so_quyet_dinh_bkttcp: 'QD-BKTTCP-1',
    });
  });

  it('Trao khen thưởng hằng năm: năm 2024 đã có BKBQP, trao BKBQP lần 2 → từ chối "đã có BKBQP", không ghi DB', async () => {
    // Cho: record đã bật cờ BKBQP
    const personnel = makePersonnel({ id: 'qn-6' });
    const existing = makeAnnualRecord({
      personnelId: personnel.id,
      nam: 2024,
      nhan_bkbqp: true,
      so_quyet_dinh_bkbqp: 'QDBK-2024',
    });
    prismaMock.quanNhan.findUnique.mockResolvedValueOnce(personnel);
    prismaMock.danhHieuHangNam.findFirst.mockResolvedValueOnce(existing);

    // Khi + Thì: cờ BKBQP lần 2 phải bị reject
    await expectError(
      annualRewardService.createAnnualReward({
        personnel_id: personnel.id,
        nam: 2024,
        nhan_bkbqp: true,
      }),
      ValidationError,
      'Năm 2024 đã có Bằng khen của Bộ trưởng Bộ Quốc phòng.'
    );
    expect(prismaMock.danhHieuHangNam.update).not.toHaveBeenCalled();
    expect(prismaMock.danhHieuHangNam.create).not.toHaveBeenCalled();
  });

  it('Trao khen thưởng hằng năm: năm 2024 đã có CSTDCS, trao thêm CSTT → từ chối vì đã có danh hiệu năm đó', async () => {
    const personnel = makePersonnel({ id: 'qn-7' });
    const existing = makeAnnualRecord({
      personnelId: personnel.id,
      nam: 2024,
      danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.CSTDCS,
      so_quyet_dinh: 'QD-CSTDCS-2024',
    });
    prismaMock.quanNhan.findUnique.mockResolvedValueOnce(personnel);
    prismaMock.danhHieuHangNam.findFirst.mockResolvedValueOnce(existing);

    await expectError(
      annualRewardService.createAnnualReward({
        personnel_id: personnel.id,
        nam: 2024,
        danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.CSTT,
      }),
      ValidationError,
      'Năm 2024 đã có Chiến sĩ thi đua cơ sở.'
    );
  });

  it('Trao khen thưởng hằng năm: danh hiệu cơ bản chỉ nhận CSTDCS/CSTT, gửi BKBQP → từ chối "danh hiệu không hợp lệ"', async () => {
    const personnel = makePersonnel({ id: 'qn-8' });
    prismaMock.quanNhan.findUnique.mockResolvedValueOnce(personnel);

    await expectError(
      annualRewardService.createAnnualReward({
        personnel_id: personnel.id,
        nam: 2024,
        danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.BKBQP,
      }),
      ValidationError,
      'Danh hiệu không hợp lệ. Chỉ được chọn: Chiến sĩ thi đua cơ sở, Chiến sĩ tiên tiến. Để trống nghĩa là không đạt danh hiệu.'
    );
    expect(prismaMock.danhHieuHangNam.findFirst).not.toHaveBeenCalled();
  });

  it('Trao khen thưởng hằng năm: trao cho quân nhân không tồn tại → báo "Quân nhân không tồn tại"', async () => {
    prismaMock.quanNhan.findUnique.mockResolvedValueOnce(null);

    await expectError(
      annualRewardService.createAnnualReward({
        personnel_id: 'missing',
        nam: 2024,
        danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.CSTDCS,
      }),
      NotFoundError,
      'Quân nhân không tồn tại'
    );
  });

  it('Trao khen thưởng hằng năm: trao riêng BKBQP cho quân nhân chưa có CSTDCS → tạo bản ghi chỉ bật cờ BKBQP, danh hiệu cơ bản để trống', async () => {
    const personnel = makePersonnel({ id: 'qn-9' });
    prismaMock.quanNhan.findUnique.mockResolvedValueOnce(personnel);
    prismaMock.danhHieuHangNam.findFirst.mockResolvedValueOnce(null);
    const created = makeAnnualRecord({
      personnelId: personnel.id,
      nam: 2024,
      nhan_bkbqp: true,
      so_quyet_dinh_bkbqp: 'QD-BK-1',
    });
    prismaMock.danhHieuHangNam.create.mockResolvedValueOnce(created);

    await annualRewardService.createAnnualReward({
      personnel_id: personnel.id,
      nam: 2024,
      nhan_bkbqp: true,
      so_quyet_dinh_bkbqp: 'QD-BK-1',
    });

    const createArgs = prismaMock.danhHieuHangNam.create.mock.calls[0][0];
    expect(createArgs.data.danh_hieu).toBeUndefined();
    expect(createArgs.data.nhan_bkbqp).toBe(true);
    expect(createArgs.data.so_quyet_dinh_bkbqp).toBe('QD-BK-1');
  });

  it('Trao khen thưởng hằng năm: ghi chú khi thêm BKBQP chỉ lưu vào ghi chú riêng của BKBQP, không lẫn sang CSTDCS/CSTDTQ/BKTTCP', async () => {
    // Cho: record không cờ, request thêm BKBQP kèm ghi chú
    const personnel = makePersonnel({ id: 'qn-10' });
    const existing = makeAnnualRecord({
      personnelId: personnel.id,
      nam: 2024,
      danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.CSTDCS,
      so_quyet_dinh: 'QD-CSTDCS-2024',
    });
    prismaMock.quanNhan.findUnique.mockResolvedValueOnce(personnel);
    prismaMock.danhHieuHangNam.findFirst.mockResolvedValueOnce(existing);
    prismaMock.danhHieuHangNam.update.mockResolvedValueOnce({ ...existing });

    await annualRewardService.createAnnualReward({
      personnel_id: personnel.id,
      nam: 2024,
      nhan_bkbqp: true,
      so_quyet_dinh_bkbqp: 'QD-BK',
      ghi_chu: 'BKBQP-note',
    });

    const data = prismaMock.danhHieuHangNam.update.mock.calls[0][0].data;
    expect(data.ghi_chu_bkbqp).toBe('BKBQP-note');
    expect(data.ghi_chu).toBeUndefined();
    expect(data.ghi_chu_cstdtq).toBeUndefined();
    expect(data.ghi_chu_bkttcp).toBeUndefined();
  });

  it('Trao khen thưởng hằng năm: trao riêng CSTDTQ → chỉ lưu đúng số quyết định CSTDTQ, các số quyết định khác để trống', async () => {
    // Cho: personnel mới, request tạo record chỉ với cờ CSTDTQ
    const personnel = makePersonnel({ id: 'qn-11' });
    prismaMock.quanNhan.findUnique.mockResolvedValueOnce(personnel);
    prismaMock.danhHieuHangNam.findFirst.mockResolvedValueOnce(null);
    prismaMock.danhHieuHangNam.create.mockResolvedValueOnce(
      makeAnnualRecord({
        personnelId: personnel.id,
        nam: 2024,
        nhan_cstdtq: true,
        so_quyet_dinh_cstdtq: 'QD-CSTDTQ',
      })
    );

    await annualRewardService.createAnnualReward({
      personnel_id: personnel.id,
      nam: 2024,
      nhan_cstdtq: true,
      so_quyet_dinh_cstdtq: 'QD-CSTDTQ',
    });

    const data = prismaMock.danhHieuHangNam.create.mock.calls[0][0].data;
    expect(data.so_quyet_dinh_cstdtq).toBe('QD-CSTDTQ');
    expect(data.so_quyet_dinh_bkbqp).toBeNull();
    expect(data.so_quyet_dinh_bkttcp).toBeNull();
    expect(data.so_quyet_dinh).toBeNull();
  });
});

describe('Trao khen thưởng hằng năm hàng loạt cho nhiều quân nhân', () => {
  it('Trao hàng loạt: 2 quân nhân, 1 người đã có danh hiệu năm 2024 → 1 trao được, 1 báo lỗi đã có', async () => {
    // Cho: 2 personnel, 1 đã có reward conflict với target
    const personnelA = makePersonnel({ id: 'qn-A' });
    const personnelB = makePersonnel({ id: 'qn-B' });
    const existingForB = makeAnnualRecord({
      personnelId: personnelB.id,
      nam: 2024,
      danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.CSTDCS,
      so_quyet_dinh: 'QD-CSTDCS-2024-B',
    });
    prismaMock.quanNhan.findMany.mockResolvedValueOnce([personnelA, personnelB]);
    prismaMock.danhHieuHangNam.findMany.mockResolvedValueOnce([existingForB]);
    prismaMock.bangDeXuat.findMany.mockResolvedValueOnce([]);
    const createdForA = makeAnnualRecord({
      personnelId: personnelA.id,
      nam: 2024,
      danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.CSTDCS,
      so_quyet_dinh: 'QD-BULK-1',
    });
    prismaMock.danhHieuHangNam.create.mockResolvedValueOnce(createdForA);

    // Khi
    const result = await annualRewardService.bulkCreateAnnualRewards({
      personnel_ids: [personnelA.id, personnelB.id],
      nam: 2024,
      danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.CSTDCS,
      so_quyet_dinh: 'QD-BULK-1',
    });

    // Thì: chỉ personnel A được tạo; B trả lỗi
    expect(result.success).toBe(1);
    expect(result.errors).toBe(1);
    expect(result.details.created).toHaveLength(1);
    expect(result.details.created[0].quan_nhan_id).toBe(personnelA.id);
    expect(result.details.errors[0]).toMatchObject({
      personnelId: personnelB.id,
    });
    expect(result.details.errors[0].error).toBe(
      'Quân nhân đã có danh hiệu Chiến sĩ thi đua cơ sở năm 2024 trên hệ thống'
    );
  });

  it('Trao hàng loạt: cả 2 quân nhân đều hợp lệ → trao thành công cho cả 2, không lỗi', async () => {
    const a = makePersonnel({ id: 'qn-S1' });
    const b = makePersonnel({ id: 'qn-S2' });
    prismaMock.quanNhan.findMany.mockResolvedValueOnce([a, b]);
    prismaMock.danhHieuHangNam.findMany.mockResolvedValueOnce([]);
    prismaMock.bangDeXuat.findMany.mockResolvedValueOnce([]);
    prismaMock.danhHieuHangNam.create
      .mockResolvedValueOnce(makeAnnualRecord({ personnelId: a.id, nam: 2024, danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.CSTDCS, so_quyet_dinh: 'QD-BULK-OK' }))
      .mockResolvedValueOnce(makeAnnualRecord({ personnelId: b.id, nam: 2024, danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.CSTDCS, so_quyet_dinh: 'QD-BULK-OK' }));

    const result = await annualRewardService.bulkCreateAnnualRewards({
      personnel_ids: [a.id, b.id],
      nam: 2024,
      danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.CSTDCS,
      so_quyet_dinh: 'QD-BULK-OK',
    });

    expect(result.success).toBe(2);
    expect(result.errors).toBe(0);
  });

  it('Trao hàng loạt: BKBQP cho quân nhân chưa có CSTDCS → tạo bản ghi chỉ bật cờ BKBQP, danh hiệu cơ bản để trống', async () => {
    // Cho: bulk BKBQP cho personnel chưa có record annual
    const a = makePersonnel({ id: 'qn-BK1' });
    prismaMock.quanNhan.findMany.mockResolvedValueOnce([a]);
    prismaMock.danhHieuHangNam.findMany.mockResolvedValueOnce([]);
    prismaMock.bangDeXuat.findMany.mockResolvedValueOnce([]);
    jest.spyOn(profileService, 'checkAwardEligibility').mockResolvedValueOnce({
      eligible: true,
      reason: 'Đủ điều kiện Bằng khen của Bộ trưởng Bộ Quốc phòng.',
    });
    prismaMock.danhHieuHangNam.create.mockResolvedValueOnce(
      makeAnnualRecord({ personnelId: a.id, nam: 2024, nhan_bkbqp: true, so_quyet_dinh_bkbqp: 'QD-BK' })
    );

    // Khi
    const result = await annualRewardService.bulkCreateAnnualRewards({
      personnel_ids: [a.id],
      nam: 2024,
      danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.BKBQP,
      so_quyet_dinh: 'QD-BK',
    });

    // Thì: row tạo ra chỉ bật cờ, danh_hieu vẫn null
    expect(result.success).toBe(1);
    const createArgs = prismaMock.danhHieuHangNam.create.mock.calls[0][0];
    expect(createArgs.data.danh_hieu).toBeNull();
    expect(createArgs.data.nhan_bkbqp).toBe(true);
    expect(createArgs.data.so_quyet_dinh_bkbqp).toBe('QD-BK');
  });

  it('Trao hàng loạt: gửi danh hiệu ngoài danh sách cho phép → từ chối "danh hiệu không hợp lệ"', async () => {
    await expectError(
      annualRewardService.bulkCreateAnnualRewards({
        personnel_ids: ['qn-x'],
        nam: 2024,
        danh_hieu: 'INVALID_CODE',
      }),
      ValidationError,
      'Danh hiệu không hợp lệ. Chỉ được chọn: Chiến sĩ thi đua cơ sở, Chiến sĩ tiên tiến, Bằng khen của Bộ trưởng Bộ Quốc phòng, Chiến sĩ thi đua toàn quân, Bằng khen của Thủ tướng Chính phủ.'
    );
  });

  it('Trao hàng loạt: quân nhân đang có đề xuất chờ duyệt cùng danh hiệu, cùng năm → chặn trao, báo đã có đề xuất', async () => {
    // Cho: personnel chưa có award nhưng có pending proposal cùng năm và danh_hieu
    const a = makePersonnel({ id: 'qn-P1' });
    prismaMock.quanNhan.findMany.mockResolvedValueOnce([a]);
    prismaMock.danhHieuHangNam.findMany.mockResolvedValueOnce([]);
    prismaMock.bangDeXuat.findMany.mockResolvedValueOnce([
      {
        id: 'pending-1',
        nam: 2024,
        status: 'PENDING',
        data_danh_hieu: [{ personnel_id: a.id, danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.CSTDCS }],
      },
    ]);

    // Khi
    const result = await annualRewardService.bulkCreateAnnualRewards({
      personnel_ids: [a.id],
      nam: 2024,
      danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.CSTDCS,
    });

    // Thì: pending proposal chặn tạo mới
    expect(result.success).toBe(0);
    expect(result.errors).toBe(1);
    expect(result.details.errors[0].error).toBe(
      'Quân nhân đã có đề xuất danh hiệu Chiến sĩ thi đua cơ sở cho năm 2024'
    );
    expect(prismaMock.danhHieuHangNam.create).not.toHaveBeenCalled();
  });

  it('Trao hàng loạt: trao BKBQP nhưng đề xuất chờ duyệt đã có cờ BKBQP (dù danh hiệu cơ bản khác) → chặn trao', async () => {
    const personnel = makePersonnel({ id: 'qn-P-bkbqp-flag' });
    prismaMock.quanNhan.findMany.mockResolvedValueOnce([personnel]);
    prismaMock.danhHieuHangNam.findMany.mockResolvedValueOnce([]);
    prismaMock.bangDeXuat.findMany.mockResolvedValueOnce([
      {
        id: 'pending-flag-bk',
        nam: 2024,
        status: 'PENDING',
        data_danh_hieu: [
          {
            personnel_id: personnel.id,
            danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.CSTDCS,
            nhan_bkbqp: true,
          },
        ],
      },
    ]);

    const result = await annualRewardService.bulkCreateAnnualRewards({
      personnel_ids: [personnel.id],
      nam: 2024,
      danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.BKBQP,
      so_quyet_dinh: 'QD-PENDING-BK',
    });

    expect(result.success).toBe(0);
    expect(result.errors).toBe(1);
    expect(result.details.errors[0].error).toBe(
      'Quân nhân đã có đề xuất danh hiệu Bằng khen của Bộ trưởng Bộ Quốc phòng cho năm 2024'
    );
    expect(prismaMock.danhHieuHangNam.create).not.toHaveBeenCalled();
  });

  it('Trao hàng loạt: BKBQP nhưng quân nhân thiếu NCKH → chặn trao theo lý do xét điều kiện', async () => {
    const personnel = makePersonnel({ id: 'qn-bulk-elig-bkbqp', ho_ten: 'QN Bulk BKBQP' });
    prismaMock.quanNhan.findMany.mockResolvedValueOnce([personnel]);
    prismaMock.danhHieuHangNam.findMany.mockResolvedValueOnce([]);
    prismaMock.bangDeXuat.findMany.mockResolvedValueOnce([]);
    jest.spyOn(profileService, 'checkAwardEligibility').mockResolvedValueOnce({
      eligible: false,
      reason: 'Chưa đủ điều kiện BKBQP do thiếu NCKH liên tục',
    });

    const result = await annualRewardService.bulkCreateAnnualRewards({
      personnel_ids: [personnel.id],
      nam: 2024,
      danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.BKBQP,
      so_quyet_dinh: 'QD-BULK-BKBQP',
    });

    expect(result.success).toBe(0);
    expect(result.errors).toBe(1);
    expect(result.details.errors[0]).toEqual({
      personnelId: personnel.id,
      error: 'Chưa đủ điều kiện BKBQP do thiếu NCKH liên tục',
    });
    expect(prismaMock.danhHieuHangNam.create).not.toHaveBeenCalled();
  });

  it('Trao hàng loạt: CSTDTQ nhưng quân nhân thiếu NCKH → chặn trao theo lý do xét điều kiện', async () => {
    const personnel = makePersonnel({ id: 'qn-bulk-elig-cstdtq', ho_ten: 'QN Bulk CSTDTQ' });
    prismaMock.quanNhan.findMany.mockResolvedValueOnce([personnel]);
    prismaMock.danhHieuHangNam.findMany.mockResolvedValueOnce([]);
    prismaMock.bangDeXuat.findMany.mockResolvedValueOnce([]);
    jest.spyOn(profileService, 'checkAwardEligibility').mockResolvedValueOnce({
      eligible: false,
      reason: 'Chưa đủ điều kiện CSTDTQ do thiếu NCKH liên tục',
    });

    const result = await annualRewardService.bulkCreateAnnualRewards({
      personnel_ids: [personnel.id],
      nam: 2024,
      danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.CSTDTQ,
      so_quyet_dinh: 'QD-BULK-CSTDTQ',
    });

    expect(result.success).toBe(0);
    expect(result.errors).toBe(1);
    expect(result.details.errors[0]).toEqual({
      personnelId: personnel.id,
      error: 'Chưa đủ điều kiện CSTDTQ do thiếu NCKH liên tục',
    });
    expect(prismaMock.danhHieuHangNam.create).not.toHaveBeenCalled();
  });

  it('Trao hàng loạt: BKTTCP nhưng quân nhân thiếu NCKH → chặn trao theo lý do xét điều kiện', async () => {
    const personnel = makePersonnel({ id: 'qn-bulk-elig-bkttcp', ho_ten: 'QN Bulk BKTTCP' });
    prismaMock.quanNhan.findMany.mockResolvedValueOnce([personnel]);
    prismaMock.danhHieuHangNam.findMany.mockResolvedValueOnce([]);
    prismaMock.bangDeXuat.findMany.mockResolvedValueOnce([]);
    jest.spyOn(profileService, 'checkAwardEligibility').mockResolvedValueOnce({
      eligible: false,
      reason: 'Chưa đủ điều kiện BKTTCP do thiếu NCKH liên tục',
    });

    const result = await annualRewardService.bulkCreateAnnualRewards({
      personnel_ids: [personnel.id],
      nam: 2024,
      danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.BKTTCP,
      so_quyet_dinh: 'QD-BULK-BKTTCP',
    });

    expect(result.success).toBe(0);
    expect(result.errors).toBe(1);
    expect(result.details.errors[0]).toEqual({
      personnelId: personnel.id,
      error: 'Chưa đủ điều kiện BKTTCP do thiếu NCKH liên tục',
    });
    expect(prismaMock.danhHieuHangNam.create).not.toHaveBeenCalled();
  });

  it('Trao hàng loạt: chuỗi danh hiệu được xét điều kiện riêng cho từng quân nhân trước khi ghi DB', async () => {
    const p1 = makePersonnel({ id: 'qn-elig-1', ho_ten: 'QN Elig 1' });
    const p2 = makePersonnel({ id: 'qn-elig-2', ho_ten: 'QN Elig 2' });
    prismaMock.quanNhan.findMany.mockResolvedValueOnce([p1, p2]);
    prismaMock.danhHieuHangNam.findMany.mockResolvedValueOnce([]);
    prismaMock.bangDeXuat.findMany.mockResolvedValueOnce([]);
    const eligibilitySpy = jest.spyOn(profileService, 'checkAwardEligibility');
    eligibilitySpy
      .mockResolvedValueOnce({ eligible: true, reason: '' })
      .mockResolvedValueOnce({ eligible: true, reason: '' });
    prismaMock.danhHieuHangNam.create
      .mockResolvedValueOnce(
        makeAnnualRecord({
          personnelId: p1.id,
          nam: 2024,
          nhan_bkbqp: true,
          so_quyet_dinh_bkbqp: 'QD-ELIG-BK',
        })
      )
      .mockResolvedValueOnce(
        makeAnnualRecord({
          personnelId: p2.id,
          nam: 2024,
          nhan_bkbqp: true,
          so_quyet_dinh_bkbqp: 'QD-ELIG-BK',
        })
      );

    const result = await annualRewardService.bulkCreateAnnualRewards({
      personnel_ids: [p1.id, p2.id],
      nam: 2024,
      danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.BKBQP,
      so_quyet_dinh: 'QD-ELIG-BK',
    });

    expect(result.success).toBe(2);
    expect(eligibilitySpy).toHaveBeenCalledTimes(2);
    expect(eligibilitySpy).toHaveBeenNthCalledWith(1, p1.id, 2024, DANH_HIEU_CA_NHAN_HANG_NAM.BKBQP);
    expect(eligibilitySpy).toHaveBeenNthCalledWith(2, p2.id, 2024, DANH_HIEU_CA_NHAN_HANG_NAM.BKBQP);
  });
});

describe('Trao khen thưởng hằng năm: bắt buộc có số quyết định', () => {
  it('Trao khen thưởng hằng năm: trao CSTDCS mà thiếu số quyết định → từ chối, không ghi DB', async () => {
    const personnel = makePersonnel({ id: 'qn-dec-1', ho_ten: 'Nguyễn Văn QĐ' });
    prismaMock.quanNhan.findUnique.mockResolvedValueOnce(personnel);
    prismaMock.danhHieuHangNam.findFirst.mockResolvedValueOnce(null);

    await expectError(
      annualRewardService.createAnnualReward({
        personnel_id: personnel.id,
        nam: 2024,
        danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.CSTDCS,
      }),
      ValidationError,
      missingDecisionNumberMessage(personnel.ho_ten, getDanhHieuName(DANH_HIEU_CA_NHAN_HANG_NAM.CSTDCS))
    );
    expect(prismaMock.danhHieuHangNam.create).not.toHaveBeenCalled();
  });

  it('Trao khen thưởng hằng năm: trao riêng BKBQP mà thiếu số quyết định BKBQP → từ chối, không ghi DB', async () => {
    const personnel = makePersonnel({ id: 'qn-dec-2', ho_ten: 'Trần Văn Bk' });
    prismaMock.quanNhan.findUnique.mockResolvedValueOnce(personnel);
    prismaMock.danhHieuHangNam.findFirst.mockResolvedValueOnce(null);

    await expectError(
      annualRewardService.createAnnualReward({
        personnel_id: personnel.id,
        nam: 2024,
        nhan_bkbqp: true,
      }),
      ValidationError,
      missingDecisionNumberMessage(personnel.ho_ten, getDanhHieuName(DANH_HIEU_CA_NHAN_HANG_NAM.BKBQP))
    );
    expect(prismaMock.danhHieuHangNam.create).not.toHaveBeenCalled();
  });

  it('Trao khen thưởng hằng năm: trao CSTDTQ mà thiếu số quyết định CSTDTQ → từ chối', async () => {
    const personnel = makePersonnel({ id: 'qn-dec-3', ho_ten: 'Lê Văn Tq' });
    prismaMock.quanNhan.findUnique.mockResolvedValueOnce(personnel);
    prismaMock.danhHieuHangNam.findFirst.mockResolvedValueOnce(null);

    await expectError(
      annualRewardService.createAnnualReward({
        personnel_id: personnel.id,
        nam: 2024,
        nhan_cstdtq: true,
      }),
      ValidationError,
      missingDecisionNumberMessage(personnel.ho_ten, getDanhHieuName(DANH_HIEU_CA_NHAN_HANG_NAM.CSTDTQ))
    );
  });

  it('Trao khen thưởng hằng năm: trao BKTTCP mà thiếu số quyết định BKTTCP → từ chối', async () => {
    const personnel = makePersonnel({ id: 'qn-dec-4', ho_ten: 'Phạm Văn Tt' });
    prismaMock.quanNhan.findUnique.mockResolvedValueOnce(personnel);
    prismaMock.danhHieuHangNam.findFirst.mockResolvedValueOnce(null);

    await expectError(
      annualRewardService.createAnnualReward({
        personnel_id: personnel.id,
        nam: 2024,
        nhan_bkttcp: true,
      }),
      ValidationError,
      missingDecisionNumberMessage(personnel.ho_ten, getDanhHieuName(DANH_HIEU_CA_NHAN_HANG_NAM.BKTTCP))
    );
  });

  it('Trao khen thưởng hằng năm: thêm BKBQP vào bản ghi CSTDCS có sẵn nhưng thiếu số quyết định BKBQP → từ chối, không cập nhật', async () => {
    const personnel = makePersonnel({ id: 'qn-dec-5', ho_ten: 'Hoàng Văn Merge' });
    const existing = makeAnnualRecord({
      personnelId: personnel.id,
      nam: 2024,
      danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.CSTDCS,
      so_quyet_dinh: 'QD-CSTDCS-2024',
    });
    prismaMock.quanNhan.findUnique.mockResolvedValueOnce(personnel);
    prismaMock.danhHieuHangNam.findFirst.mockResolvedValueOnce(existing);

    await expectError(
      annualRewardService.createAnnualReward({
        personnel_id: personnel.id,
        nam: 2024,
        nhan_bkbqp: true,
      }),
      ValidationError,
      missingDecisionNumberMessage(personnel.ho_ten, getDanhHieuName(DANH_HIEU_CA_NHAN_HANG_NAM.BKBQP))
    );
    expect(prismaMock.danhHieuHangNam.update).not.toHaveBeenCalled();
  });

  it('Trao khen thưởng hằng năm: trao CSTDCS có đủ số quyết định → tạo khen thưởng thành công', async () => {
    const personnel = makePersonnel({ id: 'qn-dec-ok' });
    prismaMock.quanNhan.findUnique.mockResolvedValueOnce(personnel);
    prismaMock.danhHieuHangNam.findFirst.mockResolvedValueOnce(null);
    const created = makeAnnualRecord({
      personnelId: personnel.id,
      nam: 2024,
      danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.CSTDCS,
      so_quyet_dinh: 'QD-OK-1',
    });
    prismaMock.danhHieuHangNam.create.mockResolvedValueOnce(created);

    const result = await annualRewardService.createAnnualReward({
      personnel_id: personnel.id,
      nam: 2024,
      danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.CSTDCS,
      so_quyet_dinh: 'QD-OK-1',
    });

    expect(result).toEqual(created);
  });

  it('Trao hàng loạt: 1 quân nhân đủ số quyết định + 1 quân nhân thiếu → 1 trao được, 1 báo lỗi thiếu số quyết định', async () => {
    const ok = makePersonnel({ id: 'qn-bulk-ok', ho_ten: 'QN Đủ' });
    const missing = makePersonnel({ id: 'qn-bulk-missing', ho_ten: 'QN Thiếu' });
    prismaMock.quanNhan.findMany.mockResolvedValueOnce([ok, missing]);
    prismaMock.danhHieuHangNam.findMany.mockResolvedValueOnce([]);
    prismaMock.bangDeXuat.findMany.mockResolvedValueOnce([]);
    prismaMock.danhHieuHangNam.create.mockResolvedValueOnce(
      makeAnnualRecord({
        personnelId: ok.id,
        nam: 2024,
        danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.CSTDCS,
        so_quyet_dinh: 'QD-PER',
      })
    );

    // Override per-row: ok có so_quyet_dinh, missing thì không.
    const result = await annualRewardService.bulkCreateAnnualRewards({
      personnel_ids: [ok.id, missing.id],
      personnel_rewards_data: [
        { personnel_id: ok.id, so_quyet_dinh: 'QD-PER' },
        { personnel_id: missing.id },
      ],
      nam: 2024,
      danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.CSTDCS,
    });

    expect(result.success).toBe(1);
    expect(result.errors).toBe(1);
    expect(result.details.errors[0]).toMatchObject({ personnelId: missing.id });
    expect(result.details.errors[0].error).toBe(
      missingDecisionNumberMessage(missing.ho_ten, getDanhHieuName(DANH_HIEU_CA_NHAN_HANG_NAM.CSTDCS))
    );
  });
});

describe('Trao khen thưởng hằng năm: gỡ bỏ từng danh hiệu trên bản ghi', () => {
  it('Gỡ khen thưởng hằng năm: bản ghi có cả CSTDCS và BKBQP, gỡ CSTDCS → chỉ xóa CSTDCS, giữ lại BKBQP, không xóa cả bản ghi', async () => {
    // Cho: record giữ cả CSTDCS và BKBQP
    const personnel = makePersonnel({ id: 'qn-del-1' });
    const reward = makeAnnualRecord({
      id: 'dhhn-mix-1',
      personnelId: personnel.id,
      nam: 2024,
      danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.CSTDCS,
      so_quyet_dinh: 'QD-CSTDCS',
      ghi_chu: 'note CSTDCS',
      nhan_bkbqp: true,
      so_quyet_dinh_bkbqp: 'QD-BKBQP',
      ghi_chu_bkbqp: 'note BKBQP',
    });
    prismaMock.danhHieuHangNam.findUnique.mockResolvedValueOnce({ ...reward, QuanNhan: personnel });
    prismaMock.danhHieuHangNam.update.mockResolvedValueOnce({
      ...reward,
      danh_hieu: null,
      so_quyet_dinh: null,
      ghi_chu: null,
    });

    // Khi: chỉ xóa danh hiệu CSTDCS
    const result = await annualRewardService.deleteAnnualReward(reward.id, 'admin', DANH_HIEU_CA_NHAN_HANG_NAM.CSTDCS);

    // Thì: chỉ field danh hiệu chính bị clear, field BKBQP giữ nguyên, không delete row
    expect(prismaMock.danhHieuHangNam.update).toHaveBeenCalledTimes(1);
    expect(prismaMock.danhHieuHangNam.delete).not.toHaveBeenCalled();
    const updateArgs = prismaMock.danhHieuHangNam.update.mock.calls[0][0];
    expect(updateArgs.where).toEqual({ id: reward.id });
    expect(updateArgs.data).toEqual({
      danh_hieu: null,
      so_quyet_dinh: null,
      ghi_chu: null,
    });
    expect(result.message).toContain(getDanhHieuName(DANH_HIEU_CA_NHAN_HANG_NAM.CSTDCS));
  });

  it('Gỡ khen thưởng hằng năm: bản ghi còn CSTDCS, gỡ BKBQP → chỉ xóa BKBQP, giữ lại CSTDCS', async () => {
    const personnel = makePersonnel({ id: 'qn-del-2' });
    const reward = makeAnnualRecord({
      id: 'dhhn-mix-2',
      personnelId: personnel.id,
      nam: 2024,
      danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.CSTDCS,
      so_quyet_dinh: 'QD-CSTDCS',
      nhan_bkbqp: true,
      so_quyet_dinh_bkbqp: 'QD-BKBQP',
      ghi_chu_bkbqp: 'note',
    });
    prismaMock.danhHieuHangNam.findUnique.mockResolvedValueOnce({ ...reward, QuanNhan: personnel });
    prismaMock.danhHieuHangNam.update.mockResolvedValueOnce(reward);

    await annualRewardService.deleteAnnualReward(reward.id, 'admin', DANH_HIEU_CA_NHAN_HANG_NAM.BKBQP);

    expect(prismaMock.danhHieuHangNam.delete).not.toHaveBeenCalled();
    const updateArgs = prismaMock.danhHieuHangNam.update.mock.calls[0][0];
    expect(updateArgs.data).toEqual({
      nhan_bkbqp: false,
      so_quyet_dinh_bkbqp: null,
      ghi_chu_bkbqp: null,
    });
  });

  it('Gỡ khen thưởng hằng năm: bản ghi còn BKBQP, gỡ CSTDTQ → chỉ xóa CSTDTQ', async () => {
    const personnel = makePersonnel({ id: 'qn-del-3' });
    const reward = makeAnnualRecord({
      id: 'dhhn-mix-3',
      personnelId: personnel.id,
      nam: 2024,
      nhan_bkbqp: true,
      so_quyet_dinh_bkbqp: 'QD-BKBQP',
      nhan_cstdtq: true,
      so_quyet_dinh_cstdtq: 'QD-CSTDTQ',
      ghi_chu_cstdtq: 'note CSTDTQ',
    });
    prismaMock.danhHieuHangNam.findUnique.mockResolvedValueOnce({ ...reward, QuanNhan: personnel });
    prismaMock.danhHieuHangNam.update.mockResolvedValueOnce(reward);

    await annualRewardService.deleteAnnualReward(reward.id, 'admin', DANH_HIEU_CA_NHAN_HANG_NAM.CSTDTQ);

    expect(prismaMock.danhHieuHangNam.delete).not.toHaveBeenCalled();
    expect(prismaMock.danhHieuHangNam.update.mock.calls[0][0].data).toEqual({
      nhan_cstdtq: false,
      so_quyet_dinh_cstdtq: null,
      ghi_chu_cstdtq: null,
    });
  });

  it('Gỡ khen thưởng hằng năm: bản ghi còn BKBQP, gỡ BKTTCP → chỉ xóa BKTTCP', async () => {
    const personnel = makePersonnel({ id: 'qn-del-4' });
    const reward = makeAnnualRecord({
      id: 'dhhn-mix-4',
      personnelId: personnel.id,
      nam: 2024,
      nhan_bkbqp: true,
      so_quyet_dinh_bkbqp: 'QD-BKBQP',
      nhan_bkttcp: true,
      so_quyet_dinh_bkttcp: 'QD-BKTTCP',
      ghi_chu_bkttcp: 'note BKTTCP',
    });
    prismaMock.danhHieuHangNam.findUnique.mockResolvedValueOnce({ ...reward, QuanNhan: personnel });
    prismaMock.danhHieuHangNam.update.mockResolvedValueOnce(reward);

    await annualRewardService.deleteAnnualReward(reward.id, 'admin', DANH_HIEU_CA_NHAN_HANG_NAM.BKTTCP);

    expect(prismaMock.danhHieuHangNam.delete).not.toHaveBeenCalled();
    expect(prismaMock.danhHieuHangNam.update.mock.calls[0][0].data).toEqual({
      nhan_bkttcp: false,
      so_quyet_dinh_bkttcp: null,
      ghi_chu_bkttcp: null,
    });
  });

  it('Gỡ khen thưởng hằng năm: CSTDCS là danh hiệu duy nhất trên bản ghi, gỡ CSTDCS → xóa luôn cả bản ghi', async () => {
    const personnel = makePersonnel({ id: 'qn-del-5' });
    const reward = makeAnnualRecord({
      id: 'dhhn-only-cstdcs',
      personnelId: personnel.id,
      nam: 2024,
      danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.CSTDCS,
      so_quyet_dinh: 'QD-CSTDCS',
    });
    prismaMock.danhHieuHangNam.findUnique.mockResolvedValueOnce({ ...reward, QuanNhan: personnel });
    prismaMock.danhHieuHangNam.delete.mockResolvedValueOnce(reward);

    await annualRewardService.deleteAnnualReward(reward.id, 'admin', DANH_HIEU_CA_NHAN_HANG_NAM.CSTDCS);

    expect(prismaMock.danhHieuHangNam.delete).toHaveBeenCalledTimes(1);
    expect(prismaMock.danhHieuHangNam.update).not.toHaveBeenCalled();
  });

  it('Gỡ khen thưởng hằng năm: BKBQP là danh hiệu duy nhất trên bản ghi, gỡ BKBQP → xóa luôn cả bản ghi', async () => {
    const personnel = makePersonnel({ id: 'qn-del-6' });
    const reward = makeAnnualRecord({
      id: 'dhhn-only-bkbqp',
      personnelId: personnel.id,
      nam: 2024,
      nhan_bkbqp: true,
      so_quyet_dinh_bkbqp: 'QD-BKBQP',
    });
    prismaMock.danhHieuHangNam.findUnique.mockResolvedValueOnce({ ...reward, QuanNhan: personnel });
    prismaMock.danhHieuHangNam.delete.mockResolvedValueOnce(reward);

    await annualRewardService.deleteAnnualReward(reward.id, 'admin', DANH_HIEU_CA_NHAN_HANG_NAM.BKBQP);

    expect(prismaMock.danhHieuHangNam.delete).toHaveBeenCalledTimes(1);
    expect(prismaMock.danhHieuHangNam.update).not.toHaveBeenCalled();
  });

  it('Gỡ khen thưởng hằng năm: bản ghi chỉ có BKBQP, yêu cầu gỡ CSTDCS → từ chối vì bản ghi không có CSTDCS', async () => {
    const personnel = makePersonnel({ id: 'qn-del-7' });
    const reward = makeAnnualRecord({
      id: 'dhhn-no-cstdcs',
      personnelId: personnel.id,
      nam: 2024,
      nhan_bkbqp: true,
      so_quyet_dinh_bkbqp: 'QD-BKBQP',
    });
    prismaMock.danhHieuHangNam.findUnique.mockResolvedValueOnce({ ...reward, QuanNhan: personnel });

    await expectError(
      annualRewardService.deleteAnnualReward(reward.id, 'admin', DANH_HIEU_CA_NHAN_HANG_NAM.CSTDCS),
      ValidationError,
      `Bản ghi không có ${getDanhHieuName(DANH_HIEU_CA_NHAN_HANG_NAM.CSTDCS)}`
    );
    expect(prismaMock.danhHieuHangNam.delete).not.toHaveBeenCalled();
    expect(prismaMock.danhHieuHangNam.update).not.toHaveBeenCalled();
  });

  it('Gỡ khen thưởng hằng năm: loại danh hiệu cần gỡ không hợp lệ → từ chối "loại danh hiệu không hợp lệ"', async () => {
    const personnel = makePersonnel({ id: 'qn-del-8' });
    const reward = makeAnnualRecord({
      id: 'dhhn-bad-type',
      personnelId: personnel.id,
      nam: 2024,
      danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.CSTDCS,
      so_quyet_dinh: 'QD-CSTDCS',
    });
    prismaMock.danhHieuHangNam.findUnique.mockResolvedValueOnce({ ...reward, QuanNhan: personnel });

    await expectError(
      annualRewardService.deleteAnnualReward(reward.id, 'admin', 'INVALID_TYPE'),
      ValidationError,
      { startsWith: 'Loại danh hiệu không hợp lệ' }
    );
  });

  it('Gỡ khen thưởng hằng năm: bản ghi không tồn tại → báo không tìm thấy', async () => {
    prismaMock.danhHieuHangNam.findUnique.mockResolvedValueOnce(null);

    await expectError(
      annualRewardService.deleteAnnualReward('not-exist', 'admin', DANH_HIEU_CA_NHAN_HANG_NAM.CSTDCS),
      NotFoundError
    );
  });

  it('Gỡ khen thưởng hằng năm: không nêu loại danh hiệu cần gỡ → xóa luôn cả bản ghi (tương thích cũ)', async () => {
    const personnel = makePersonnel({ id: 'qn-del-9' });
    const reward = makeAnnualRecord({
      id: 'dhhn-legacy',
      personnelId: personnel.id,
      nam: 2024,
      danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.CSTDCS,
      so_quyet_dinh: 'QD-CSTDCS',
      nhan_bkbqp: true,
      so_quyet_dinh_bkbqp: 'QD-BKBQP',
    });
    prismaMock.danhHieuHangNam.findUnique.mockResolvedValueOnce({ ...reward, QuanNhan: personnel });
    prismaMock.danhHieuHangNam.delete.mockResolvedValueOnce(reward);

    const result = await annualRewardService.deleteAnnualReward(reward.id, 'admin');

    expect(prismaMock.danhHieuHangNam.delete).toHaveBeenCalledTimes(1);
    expect(prismaMock.danhHieuHangNam.update).not.toHaveBeenCalled();
    expect(result.message).toBe('Đã xóa Danh hiệu hằng năm.');
  });

  it('Gỡ khen thưởng hằng năm: sau khi gỡ một danh hiệu → tính lại hồ sơ của quân nhân đó', async () => {
    const profileMock = require('../../src/services/profile/annual')
      .safeRecalculateAnnualProfile as jest.Mock;
    profileMock.mockClear();
    const personnel = makePersonnel({ id: 'qn-del-10' });
    const reward = makeAnnualRecord({
      id: 'dhhn-recalc',
      personnelId: personnel.id,
      nam: 2024,
      danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.CSTDCS,
      so_quyet_dinh: 'QD-CSTDCS',
      nhan_bkbqp: true,
      so_quyet_dinh_bkbqp: 'QD-BKBQP',
    });
    prismaMock.danhHieuHangNam.findUnique.mockResolvedValueOnce({ ...reward, QuanNhan: personnel });
    prismaMock.danhHieuHangNam.update.mockResolvedValueOnce(reward);

    await annualRewardService.deleteAnnualReward(reward.id, 'admin', DANH_HIEU_CA_NHAN_HANG_NAM.CSTDCS);

    expect(profileMock).toHaveBeenCalledWith(personnel.id);
  });
});
