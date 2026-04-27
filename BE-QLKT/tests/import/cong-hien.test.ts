import ExcelJS from 'exceljs';
import { prismaMock, resetPrismaMock } from '../helpers/prismaMock';
import { makePersonnel } from '../helpers/fixtures';
import { expectError } from '../helpers/errorAssert';
import contributionMedalService from '../../src/services/contributionMedal.service';
import { ValidationError } from '../../src/middlewares/errorHandler';
import { DANH_HIEU_HCBVTQ } from '../../src/constants/danhHieu.constants';
import { HCBVTQ_HIGHEST_DOWNGRADE_FRAGMENT } from '../helpers/errorMessages';

interface CongHienExcelRow {
  id?: string;
  ho_va_ten?: string;
  nam?: number | string;
  thang?: number | string;
  danh_hieu?: string;
  cap_bac?: string;
  chuc_vu?: string;
  so_quyet_dinh?: string;
  ghi_chu?: string;
}

const HEADERS = [
  'id',
  'ho_va_ten',
  'nam',
  'thang',
  'danh_hieu',
  'cap_bac',
  'chuc_vu',
  'so_quyet_dinh',
  'ghi_chu',
] as const;

async function makeCongHienExcelBuffer(rows: CongHienExcelRow[]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('HCBVTQ');
  worksheet.addRow([...HEADERS]);
  for (const row of rows) {
    worksheet.addRow(HEADERS.map(h => row[h] ?? ''));
  }
  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer as ArrayBuffer);
}

interface PositionHistoryWithChucVu {
  quan_nhan_id: string;
  he_so_chuc_vu: number;
  so_thang: number | null;
  ngay_bat_dau: Date | null;
  ngay_ket_thuc: Date | null;
  ChucVu: { he_so_chuc_vu: number };
}

function eligibleHistory(personnelId: string, totalMonths = 130): PositionHistoryWithChucVu[] {
  return [
    {
      quan_nhan_id: personnelId,
      he_so_chuc_vu: 0.9,
      so_thang: totalMonths,
      ngay_bat_dau: new Date('2013-01-01'),
      ngay_ket_thuc: new Date('2024-01-01'),
      ChucVu: { he_so_chuc_vu: 0.9 },
    },
  ];
}

beforeEach(() => {
  resetPrismaMock();
});

describe('contributionMedal.service - previewImport (CONG_HIEN)', () => {
  it('Row đủ dữ liệu (đủ tháng phục vụ) → vào valid', async () => {
    // Given: existing personnel + sufficient position history + decision number on system
    const p1 = makePersonnel({ id: 'qn-ch-1', ho_ten: 'Nguyễn Văn A', gioi_tinh: 'NAM' });
    prismaMock.quanNhan.findMany.mockResolvedValueOnce([
      { id: p1.id, ho_ten: p1.ho_ten, gioi_tinh: 'NAM', cap_bac: 'Đại uý', ChucVu: { ten_chuc_vu: 'Trợ lý' } },
    ]);
    prismaMock.khenThuongHCBVTQ.findMany.mockResolvedValueOnce([]);
    prismaMock.lichSuChucVu.findMany.mockResolvedValueOnce(eligibleHistory(p1.id));
    prismaMock.fileQuyetDinh.findMany.mockResolvedValueOnce([{ so_quyet_dinh: 'QD-CH-001' }]);
    prismaMock.bangDeXuat.findMany.mockResolvedValueOnce([]);

    const buffer = await makeCongHienExcelBuffer([
      {
        id: 'qn-ch-1',
        ho_va_ten: 'Nguyễn Văn A',
        nam: 2024,
        thang: 6,
        danh_hieu: DANH_HIEU_HCBVTQ.HANG_NHAT,
        cap_bac: 'Đại uý',
        chuc_vu: 'Trợ lý',
        so_quyet_dinh: 'QD-CH-001',
      },
    ]);

    // When
    const result = await contributionMedalService.previewImport(buffer);

    // Then
    expect(result.total).toBe(1);
    expect(result.valid).toHaveLength(1);
    expect(result.errors).toHaveLength(0);
    expect(result.valid[0]).toMatchObject({
      personnel_id: 'qn-ch-1',
      nam: 2024,
      thang: 6,
      danh_hieu: DANH_HIEU_HCBVTQ.HANG_NHAT,
      so_quyet_dinh: 'QD-CH-001',
    });
  });

  it('Row thiếu so_quyet_dinh → vào errors "Thiếu số quyết định"', async () => {
    const p1 = makePersonnel({ id: 'qn-no-qd', ho_ten: 'No QD', gioi_tinh: 'NAM' });
    prismaMock.quanNhan.findMany.mockResolvedValueOnce([
      { id: p1.id, ho_ten: p1.ho_ten, gioi_tinh: 'NAM', cap_bac: 'Đại uý', ChucVu: { ten_chuc_vu: 'Trợ lý' } },
    ]);
    prismaMock.khenThuongHCBVTQ.findMany.mockResolvedValueOnce([]);
    prismaMock.lichSuChucVu.findMany.mockResolvedValueOnce(eligibleHistory(p1.id));
    prismaMock.fileQuyetDinh.findMany.mockResolvedValueOnce([]);
    prismaMock.bangDeXuat.findMany.mockResolvedValueOnce([]);

    const buffer = await makeCongHienExcelBuffer([
      {
        id: 'qn-no-qd',
        ho_va_ten: 'No QD',
        nam: 2024,
        thang: 6,
        danh_hieu: DANH_HIEU_HCBVTQ.HANG_BA,
      },
    ]);

    const result = await contributionMedalService.previewImport(buffer);

    expect(result.valid).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].message).toBe('Thiếu số quyết định');
  });

  it('Tên trong file không khớp tên trong DB → errors mismatch', async () => {
    const p1 = makePersonnel({ id: 'qn-name', ho_ten: 'Nguyễn Văn Đúng', gioi_tinh: 'NAM' });
    prismaMock.quanNhan.findMany.mockResolvedValueOnce([
      { id: p1.id, ho_ten: p1.ho_ten, gioi_tinh: 'NAM', cap_bac: 'Đại uý', ChucVu: { ten_chuc_vu: 'Trợ lý' } },
    ]);
    prismaMock.khenThuongHCBVTQ.findMany.mockResolvedValueOnce([]);
    prismaMock.lichSuChucVu.findMany.mockResolvedValueOnce(eligibleHistory(p1.id));
    prismaMock.fileQuyetDinh.findMany.mockResolvedValueOnce([{ so_quyet_dinh: 'QD-CH-001' }]);
    prismaMock.bangDeXuat.findMany.mockResolvedValueOnce([]);

    const buffer = await makeCongHienExcelBuffer([
      {
        id: 'qn-name',
        ho_va_ten: 'Tên Sai Khác',
        nam: 2024,
        thang: 6,
        danh_hieu: DANH_HIEU_HCBVTQ.HANG_BA,
        so_quyet_dinh: 'QD-CH-001',
      },
    ]);

    const result = await contributionMedalService.previewImport(buffer);

    expect(result.valid).toHaveLength(0);
    expect(result.errors[0].message).toContain('không khớp với tên trong hệ thống');
  });

  it('Quân nhân đã có HCBVTQ trên hệ thống → errors "Đã có"', async () => {
    const p1 = makePersonnel({ id: 'qn-existed', ho_ten: 'Đã Có', gioi_tinh: 'NAM' });
    prismaMock.quanNhan.findMany.mockResolvedValueOnce([
      { id: p1.id, ho_ten: p1.ho_ten, gioi_tinh: 'NAM', cap_bac: 'Đại uý', ChucVu: { ten_chuc_vu: 'Trợ lý' } },
    ]);
    prismaMock.khenThuongHCBVTQ.findMany.mockResolvedValueOnce([
      { quan_nhan_id: p1.id, danh_hieu: DANH_HIEU_HCBVTQ.HANG_BA, nam: 2022 },
    ]);
    prismaMock.lichSuChucVu.findMany.mockResolvedValueOnce(eligibleHistory(p1.id));
    prismaMock.fileQuyetDinh.findMany.mockResolvedValueOnce([{ so_quyet_dinh: 'QD-CH-001' }]);
    prismaMock.bangDeXuat.findMany.mockResolvedValueOnce([]);

    const buffer = await makeCongHienExcelBuffer([
      {
        id: 'qn-existed',
        ho_va_ten: 'Đã Có',
        nam: 2024,
        thang: 6,
        danh_hieu: DANH_HIEU_HCBVTQ.HANG_NHI,
        so_quyet_dinh: 'QD-CH-001',
      },
    ]);

    const result = await contributionMedalService.previewImport(buffer);

    expect(result.valid).toHaveLength(0);
    expect(result.errors[0].message).toContain('Đã có');
  });

  it('Mix valid + invalid → trả cả 2 phần đúng', async () => {
    const p1 = makePersonnel({ id: 'qn-mix-1', ho_ten: 'Hợp Lệ', gioi_tinh: 'NAM' });
    const p2 = makePersonnel({ id: 'qn-mix-2', ho_ten: 'Thiếu Tháng', gioi_tinh: 'NAM' });
    prismaMock.quanNhan.findMany.mockResolvedValueOnce([
      { id: p1.id, ho_ten: p1.ho_ten, gioi_tinh: 'NAM', cap_bac: 'Đại uý', ChucVu: { ten_chuc_vu: 'Trợ lý' } },
      { id: p2.id, ho_ten: p2.ho_ten, gioi_tinh: 'NAM', cap_bac: 'Đại uý', ChucVu: { ten_chuc_vu: 'Trợ lý' } },
    ]);
    prismaMock.khenThuongHCBVTQ.findMany.mockResolvedValueOnce([]);
    prismaMock.lichSuChucVu.findMany.mockResolvedValueOnce([
      ...eligibleHistory(p1.id),
      ...eligibleHistory(p2.id),
    ]);
    prismaMock.fileQuyetDinh.findMany.mockResolvedValueOnce([{ so_quyet_dinh: 'QD-CH-001' }]);
    prismaMock.bangDeXuat.findMany.mockResolvedValueOnce([]);

    const buffer = await makeCongHienExcelBuffer([
      {
        id: 'qn-mix-1',
        ho_va_ten: 'Hợp Lệ',
        nam: 2024,
        thang: 6,
        danh_hieu: DANH_HIEU_HCBVTQ.HANG_NHAT,
        so_quyet_dinh: 'QD-CH-001',
        cap_bac: 'Đại uý',
        chuc_vu: 'Trợ lý',
      },
      // Missing thang
      {
        id: 'qn-mix-2',
        ho_va_ten: 'Thiếu Tháng',
        nam: 2024,
        danh_hieu: DANH_HIEU_HCBVTQ.HANG_NHAT,
        so_quyet_dinh: 'QD-CH-001',
        cap_bac: 'Đại uý',
        chuc_vu: 'Trợ lý',
      },
    ]);

    const result = await contributionMedalService.previewImport(buffer);

    expect(result.valid).toHaveLength(1);
    expect(result.valid[0].personnel_id).toBe('qn-mix-1');
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].message).toContain('Tháng nhận không hợp lệ');
  });
});

describe('contributionMedal.service - confirmImport (CONG_HIEN)', () => {
  it('Confirm với 1 valid item → tạo HCBVTQ', async () => {
    prismaMock.bangDeXuat.findMany.mockResolvedValueOnce([]);
    prismaMock.khenThuongHCBVTQ.findMany.mockResolvedValueOnce([]);
    prismaMock.quanNhan.findMany.mockResolvedValueOnce([
      { id: 'qn-ch-imp-1', gioi_tinh: 'NAM' },
    ]);
    prismaMock.lichSuChucVu.findMany.mockResolvedValueOnce([
      {
        quan_nhan_id: 'qn-ch-imp-1',
        he_so_chuc_vu: 0.7,
        so_thang: 130,
        ngay_bat_dau: new Date('2010-01-01'),
        ngay_ket_thuc: new Date('2024-01-01'),
        ChucVu: { he_so_chuc_vu: 0.7 },
      },
    ]);
    prismaMock.khenThuongHCBVTQ.create.mockResolvedValueOnce({ id: 'kt-ch-imp-1' });

    const result = await contributionMedalService.confirmImport(
      [
        {
          row: 2,
          personnel_id: 'qn-ch-imp-1',
          ho_ten: 'Nguyễn Văn A',
          cap_bac: 'Đại uý',
          chuc_vu: 'Trợ lý',
          nam: 2024,
          thang: 6,
          danh_hieu: DANH_HIEU_HCBVTQ.HANG_BA,
          so_quyet_dinh: 'QD-CH-001',
          ghi_chu: null,
          history: [],
        },
      ],
      'admin-id'
    );

    expect(result.imported).toBe(1);
    expect(prismaMock.khenThuongHCBVTQ.create).toHaveBeenCalledTimes(1);
    expect(prismaMock.khenThuongHCBVTQ.create.mock.calls[0][0].data).toMatchObject({
      quan_nhan_id: 'qn-ch-imp-1',
      danh_hieu: DANH_HIEU_HCBVTQ.HANG_BA,
      nam: 2024,
      thang: 6,
      so_quyet_dinh: 'QD-CH-001',
    });
  });

  it('Confirm bị block bởi pending proposal → throw ValidationError', async () => {
    prismaMock.bangDeXuat.findMany.mockResolvedValueOnce([
      {
        id: 'prop-pending',
        nam: 2024,
        data_cong_hien: [{ personnel_id: 'qn-ch-pend' }],
      },
    ]);
    prismaMock.khenThuongHCBVTQ.findMany.mockResolvedValueOnce([]);

    await expectError(
      contributionMedalService.confirmImport(
        [
          {
            row: 2,
            personnel_id: 'qn-ch-pend',
            ho_ten: 'QN Pending',
            cap_bac: 'Đại uý',
            chuc_vu: 'Trợ lý',
            nam: 2024,
            thang: 6,
            danh_hieu: DANH_HIEU_HCBVTQ.HANG_BA,
            so_quyet_dinh: 'QD-CH-001',
            ghi_chu: null,
            history: [],
          },
        ],
        'admin-id'
      ),
      ValidationError,
      'QN Pending: đang có đề xuất HC Bảo vệ Tổ quốc chờ duyệt'
    );
    expect(prismaMock.khenThuongHCBVTQ.create).not.toHaveBeenCalled();
  });

  it('Confirm bị block bởi existing HCBVTQ → throw ValidationError "đã có ... trên hệ thống"', async () => {
    prismaMock.bangDeXuat.findMany.mockResolvedValueOnce([]);
    prismaMock.khenThuongHCBVTQ.findMany.mockResolvedValueOnce([
      { quan_nhan_id: 'qn-ch-existed', danh_hieu: DANH_HIEU_HCBVTQ.HANG_BA },
    ]);

    await expectError(
      contributionMedalService.confirmImport(
        [
          {
            row: 2,
            personnel_id: 'qn-ch-existed',
            ho_ten: 'QN Existed',
            cap_bac: 'Đại uý',
            chuc_vu: 'Trợ lý',
            nam: 2024,
            thang: 6,
            danh_hieu: DANH_HIEU_HCBVTQ.HANG_NHI,
            so_quyet_dinh: 'QD-CH-001',
            ghi_chu: null,
            history: [],
          },
        ],
        'admin-id'
      ),
      ValidationError,
      { startsWith: 'QN Existed: đã có' }
    );
    expect(prismaMock.khenThuongHCBVTQ.create).not.toHaveBeenCalled();
  });
});

describe('contributionMedal.service - HCBVTQ highest qualifying rank guard', () => {
  function HCBVTQ_IMPORT_HIGHEST_eligibleHigh(personnelId: string): PositionHistoryWithChucVu[] {
    return [
      {
        quan_nhan_id: personnelId,
        he_so_chuc_vu: 1.0,
        so_thang: 200,
        ngay_bat_dau: new Date('2008-01-01'),
        ngay_ket_thuc: new Date('2024-01-01'),
        ChucVu: { he_so_chuc_vu: 1.0 },
      },
    ];
  }

  it('Preview HANG_BA cho QN đủ HANG_NHAT → push vào errors với message "thấp hơn"', async () => {
    const p1 = makePersonnel({ id: 'qn-highest-prev-1', ho_ten: 'Highest Preview', gioi_tinh: 'NAM' });
    prismaMock.quanNhan.findMany.mockResolvedValueOnce([
      { id: p1.id, ho_ten: p1.ho_ten, gioi_tinh: 'NAM', cap_bac: 'Đại uý', ChucVu: { ten_chuc_vu: 'Trợ lý' } },
    ]);
    prismaMock.khenThuongHCBVTQ.findMany.mockResolvedValueOnce([]);
    prismaMock.lichSuChucVu.findMany.mockResolvedValueOnce(HCBVTQ_IMPORT_HIGHEST_eligibleHigh(p1.id));
    prismaMock.fileQuyetDinh.findMany.mockResolvedValueOnce([{ so_quyet_dinh: 'QD-HIGHEST-1' }]);
    prismaMock.bangDeXuat.findMany.mockResolvedValueOnce([]);

    const buffer = await makeCongHienExcelBuffer([
      {
        id: p1.id,
        ho_va_ten: p1.ho_ten,
        nam: 2024,
        thang: 6,
        danh_hieu: DANH_HIEU_HCBVTQ.HANG_BA,
        so_quyet_dinh: 'QD-HIGHEST-1',
        cap_bac: 'Đại uý',
        chuc_vu: 'Trợ lý',
      },
    ]);

    const result = await contributionMedalService.previewImport(buffer);

    expect(result.valid).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].message).toContain(HCBVTQ_HIGHEST_DOWNGRADE_FRAGMENT);
  });

  it('Preview HANG_NHAT cho QN đủ HANG_NHAT → vào valid', async () => {
    const p1 = makePersonnel({ id: 'qn-highest-prev-2', ho_ten: 'Highest OK', gioi_tinh: 'NAM' });
    prismaMock.quanNhan.findMany.mockResolvedValueOnce([
      { id: p1.id, ho_ten: p1.ho_ten, gioi_tinh: 'NAM', cap_bac: 'Đại uý', ChucVu: { ten_chuc_vu: 'Trợ lý' } },
    ]);
    prismaMock.khenThuongHCBVTQ.findMany.mockResolvedValueOnce([]);
    prismaMock.lichSuChucVu.findMany.mockResolvedValueOnce(HCBVTQ_IMPORT_HIGHEST_eligibleHigh(p1.id));
    prismaMock.fileQuyetDinh.findMany.mockResolvedValueOnce([{ so_quyet_dinh: 'QD-HIGHEST-2' }]);
    prismaMock.bangDeXuat.findMany.mockResolvedValueOnce([]);

    const buffer = await makeCongHienExcelBuffer([
      {
        id: p1.id,
        ho_va_ten: p1.ho_ten,
        nam: 2024,
        thang: 6,
        danh_hieu: DANH_HIEU_HCBVTQ.HANG_NHAT,
        so_quyet_dinh: 'QD-HIGHEST-2',
        cap_bac: 'Đại uý',
        chuc_vu: 'Trợ lý',
      },
    ]);

    const result = await contributionMedalService.previewImport(buffer);

    expect(result.errors).toHaveLength(0);
    expect(result.valid).toHaveLength(1);
    expect(result.valid[0].danh_hieu).toBe(DANH_HIEU_HCBVTQ.HANG_NHAT);
  });

  it('Confirm HANG_BA cho QN đủ HANG_NHAT → ValidationError thrown', async () => {
    prismaMock.bangDeXuat.findMany.mockResolvedValueOnce([]);
    prismaMock.khenThuongHCBVTQ.findMany.mockResolvedValueOnce([]);
    prismaMock.quanNhan.findMany.mockResolvedValueOnce([
      { id: 'qn-highest-conf-1', gioi_tinh: 'NAM' },
    ]);
    prismaMock.lichSuChucVu.findMany.mockResolvedValueOnce([
      {
        quan_nhan_id: 'qn-highest-conf-1',
        he_so_chuc_vu: 1.0,
        so_thang: 200,
        ngay_bat_dau: new Date('2008-01-01'),
        ngay_ket_thuc: new Date('2024-01-01'),
        ChucVu: { he_so_chuc_vu: 1.0 },
      },
    ]);

    await expectError(
      contributionMedalService.confirmImport(
        [
          {
            row: 2,
            personnel_id: 'qn-highest-conf-1',
            ho_ten: 'Confirm Highest',
            cap_bac: 'Đại uý',
            chuc_vu: 'Trợ lý',
            nam: 2024,
            thang: 6,
            danh_hieu: DANH_HIEU_HCBVTQ.HANG_BA,
            so_quyet_dinh: 'QD-HIGHEST-3',
            ghi_chu: null,
            history: [],
          },
        ],
        'admin-id'
      ),
      ValidationError,
      new RegExp(HCBVTQ_HIGHEST_DOWNGRADE_FRAGMENT)
    );
    expect(prismaMock.khenThuongHCBVTQ.create).not.toHaveBeenCalled();
  });
});
