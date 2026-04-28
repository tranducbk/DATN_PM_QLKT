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

describe('annualReward.service - createAnnualReward', () => {
  it('tạo mới khi chưa có record (CQDV)', async () => {
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

  it('tạo mới khi chưa có record (DVTT)', async () => {
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

  it('merge cờ BKBQP vào record CSTDCS đã có', async () => {
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

  it('merge cờ CSTDTQ vào record có sẵn', async () => {
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

  it('merge cờ BKTTCP vào record có sẵn', async () => {
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

  it('reject thêm cờ BKBQP lần 2', async () => {
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
      'Năm 2024 đã có Bằng khen Bộ Quốc phòng.'
    );
    expect(prismaMock.danhHieuHangNam.update).not.toHaveBeenCalled();
    expect(prismaMock.danhHieuHangNam.create).not.toHaveBeenCalled();
  });

  it('reject thêm danh_hieu khi đã có (CSTDCS rồi → CSTT)', async () => {
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

  it('reject `danh_hieu` ngoài DANH_HIEU_CA_NHAN_CO_BAN', async () => {
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

  it('throw NotFoundError khi personnel không tồn tại', async () => {
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

  it('tạo BKBQP-only record cho QN chưa có CSTDCS → `danh_hieu: null, nhan_bkbqp: true`', async () => {
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

  it('ghi_chu tách biệt per cờ (ghi_chu, ghi_chu_bkbqp, ghi_chu_cstdtq, ghi_chu_bkttcp)', async () => {
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

  it('so_quyet_dinh tách biệt đúng field per cờ', async () => {
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

describe('annualReward.service - bulkCreateAnnualRewards', () => {
  it('1 success + 1 đã có → trả `{success: 1, errors: 1, details}`', async () => {
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

  it('tất cả thành công → `success: N`', async () => {
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

  it('bulk BKBQP cho QN chưa có CSTDCS → record `danh_hieu: null`', async () => {
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

  it('reject `danh_hieu` ngoài allowedDanhHieu', async () => {
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

  it('reject khi quân nhân đang có pending proposal cùng danh hiệu', async () => {
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

  it('reject bulk BKBQP khi pending proposal có nhan_bkbqp=true dù danh_hieu khác', async () => {
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

  it('bulk BKBQP thiếu điều kiện NCKH -> reject theo eligibility reason', async () => {
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

  it('bulk CSTDTQ thiếu điều kiện NCKH -> reject theo eligibility reason', async () => {
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

  it('bulk BKTTCP thiếu điều kiện NCKH -> reject theo eligibility reason', async () => {
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

  it('bulk chain awards gọi eligibility theo từng quân nhân trước khi ghi DB', async () => {
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

describe('annualReward.service - decision-number validation', () => {
  it('createAnnualReward CSTDCS thiếu so_quyet_dinh → reject', async () => {
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

  it('createAnnualReward BKBQP-only thiếu so_quyet_dinh_bkbqp → reject', async () => {
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

  it('createAnnualReward CSTDTQ thiếu so_quyet_dinh_cstdtq → reject', async () => {
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

  it('createAnnualReward BKTTCP thiếu so_quyet_dinh_bkttcp → reject', async () => {
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

  it('createAnnualReward merge BKBQP vào record CSTDCS thiếu so_quyet_dinh_bkbqp → reject', async () => {
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

  it('createAnnualReward đầy đủ so_quyet_dinh → success', async () => {
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

  it('bulkCreateAnnualRewards 1 row đủ + 1 row thiếu so_quyet_dinh → success: 1, errors: 1', async () => {
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

describe('annualReward.service - deleteAnnualReward (granular)', () => {
  it('xóa CSTDCS khi record còn BKBQP → update danh_hieu/so_quyet_dinh/ghi_chu = null', async () => {
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

  it('xóa BKBQP khi record còn CSTDCS → clear flags BKBQP, giữ CSTDCS', async () => {
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

  it('xóa CSTDTQ khi còn BKBQP → clear cờ CSTDTQ', async () => {
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

  it('xóa BKTTCP khi còn BKBQP → clear cờ BKTTCP', async () => {
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

  it('xóa CSTDCS khi đó là danh hiệu duy nhất → xóa cả row', async () => {
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

  it('xóa BKBQP khi đó là danh hiệu duy nhất → xóa cả row', async () => {
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

  it('xóa CSTDCS khi record không có CSTDCS (chỉ có BKBQP) → ValidationError', async () => {
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

  it('xóa với awardType không hợp lệ → ValidationError', async () => {
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

  it('xóa record không tồn tại → NotFoundError', async () => {
    prismaMock.danhHieuHangNam.findUnique.mockResolvedValueOnce(null);

    await expectError(
      annualRewardService.deleteAnnualReward('not-exist', 'admin', DANH_HIEU_CA_NHAN_HANG_NAM.CSTDCS),
      NotFoundError
    );
  });

  it('xóa không truyền awardType → backward compat, xóa cả row', async () => {
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
    expect(result.message).toBe('Đã xóa danh hiệu hằng năm.');
  });

  it('gọi recalc profile sau khi xóa granular', async () => {
    const profileMock = require('../../src/helpers/profileRecalcHelper')
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
