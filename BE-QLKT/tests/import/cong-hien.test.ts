import ExcelJS from 'exceljs';
import { prismaMock } from '../helpers/prismaMock';
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

interface PreviewPersonnel {
  id: string;
  ho_ten: string;
  gioi_tinh?: string;
  cap_bac?: string;
  chuc_vu?: string;
}

/**
 * Arranges the DB lookups previewImport fans out to for CONG_HIEN.
 * Defaults: eligible position history per personnel, no existing medal, no pending proposal.
 * @param opts.personnel - One personnel or many (mix tests)
 * @param opts.existingMedals - Rows returned by khenThuongHCBVTQ.findMany (default none)
 * @param opts.history - Override position history (default eligibleHistory per personnel)
 * @param opts.decisionNumbers - Decision numbers present on the system (default none)
 */
function arrangeCongHienPreview(opts: {
  personnel: PreviewPersonnel | PreviewPersonnel[];
  existingMedals?: unknown[];
  history?: PositionHistoryWithChucVu[];
  decisionNumbers?: string[];
}): void {
  const people = Array.isArray(opts.personnel) ? opts.personnel : [opts.personnel];
  prismaMock.quanNhan.findMany.mockResolvedValueOnce(
    people.map(p => ({
      id: p.id,
      ho_ten: p.ho_ten,
      gioi_tinh: p.gioi_tinh ?? 'NAM',
      cap_bac: p.cap_bac ?? 'Đại uý',
      ChucVu: { ten_chuc_vu: p.chuc_vu ?? 'Trợ lý' },
    }))
  );
  prismaMock.khenThuongHCBVTQ.findMany.mockResolvedValueOnce(opts.existingMedals ?? []);
  prismaMock.lichSuChucVu.findMany.mockResolvedValueOnce(
    opts.history ?? people.flatMap(p => eligibleHistory(p.id))
  );
  prismaMock.fileQuyetDinh.findMany.mockResolvedValueOnce(
    (opts.decisionNumbers ?? []).map(so_quyet_dinh => ({ so_quyet_dinh }))
  );
  prismaMock.bangDeXuat.findMany.mockResolvedValueOnce([]);
}

describe('contributionMedal.service - previewImport (CONG_HIEN)', () => {
  it('Row đủ dữ liệu (đủ tháng phục vụ) → vào valid', async () => {
    arrangeCongHienPreview({
      personnel: { id: 'qn-ch-1', ho_ten: 'Nguyễn Văn A' },
      decisionNumbers: ['QD-CH-001'],
    });

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
    arrangeCongHienPreview({ personnel: { id: 'qn-no-qd', ho_ten: 'No QD' } });

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
    arrangeCongHienPreview({
      personnel: { id: 'qn-name', ho_ten: 'Nguyễn Văn Đúng' },
      decisionNumbers: ['QD-CH-001'],
    });

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
    arrangeCongHienPreview({
      personnel: { id: 'qn-existed', ho_ten: 'Đã Có' },
      existingMedals: [{ quan_nhan_id: 'qn-existed', danh_hieu: DANH_HIEU_HCBVTQ.HANG_BA, nam: 2022 }],
      decisionNumbers: ['QD-CH-001'],
    });

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

  it('Empty row → bị skip silently, không vào valid hay errors', async () => {
    arrangeCongHienPreview({
      personnel: { id: 'qn-empty-ch', ho_ten: 'Có Data' },
      decisionNumbers: ['QD-EMPTY'],
    });

    const buffer = await makeCongHienExcelBuffer([
      {},
      {
        id: 'qn-empty-ch',
        ho_va_ten: 'Có Data',
        nam: 2024,
        thang: 6,
        danh_hieu: DANH_HIEU_HCBVTQ.HANG_NHAT,
        so_quyet_dinh: 'QD-EMPTY',
        cap_bac: 'Đại uý',
        chuc_vu: 'Trợ lý',
      },
    ]);

    const result = await contributionMedalService.previewImport(buffer);
    expect(result.total).toBe(1);
    expect(result.valid).toHaveLength(1);
    expect(result.errors).toHaveLength(0);
  });

  it('Duplicate trong cùng file (cùng personnel_id) → row thứ 2 vào errors', async () => {
    arrangeCongHienPreview({
      personnel: { id: 'qn-dup-ch', ho_ten: 'Trùng' },
      decisionNumbers: ['QD-DUP'],
    });

    const row = {
      id: 'qn-dup-ch',
      ho_va_ten: 'Trùng',
      nam: 2024,
      thang: 6,
      danh_hieu: DANH_HIEU_HCBVTQ.HANG_NHAT,
      so_quyet_dinh: 'QD-DUP',
      cap_bac: 'Đại uý',
      chuc_vu: 'Trợ lý',
    };
    const buffer = await makeCongHienExcelBuffer([row, { ...row }]);

    const result = await contributionMedalService.previewImport(buffer);
    expect(result.valid).toHaveLength(1);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].message).toContain('Trùng lặp trong file');
  });

  it('Tháng = 13 → errors "không hợp lệ"', async () => {
    arrangeCongHienPreview({
      personnel: { id: 'qn-th13-ch', ho_ten: 'OOR' },
      decisionNumbers: ['QD-T13'],
    });

    const buffer = await makeCongHienExcelBuffer([
      {
        id: 'qn-th13-ch',
        ho_va_ten: 'OOR',
        nam: 2024,
        thang: 13,
        danh_hieu: DANH_HIEU_HCBVTQ.HANG_NHAT,
        so_quyet_dinh: 'QD-T13',
        cap_bac: 'Đại uý',
        chuc_vu: 'Trợ lý',
      },
    ]);

    const result = await contributionMedalService.previewImport(buffer);
    expect(result.valid).toHaveLength(0);
    expect(result.errors[0].message).toContain('Tháng nhận không hợp lệ');
  });

  it('Năm < 1900 → errors "không hợp lệ"', async () => {
    arrangeCongHienPreview({
      personnel: { id: 'qn-y-ch', ho_ten: 'Năm Cũ' },
      decisionNumbers: ['QD-Y'],
    });

    const buffer = await makeCongHienExcelBuffer([
      {
        id: 'qn-y-ch',
        ho_va_ten: 'Năm Cũ',
        nam: 1899,
        thang: 6,
        danh_hieu: DANH_HIEU_HCBVTQ.HANG_NHAT,
        so_quyet_dinh: 'QD-Y',
        cap_bac: 'Đại uý',
        chuc_vu: 'Trợ lý',
      },
    ]);

    const result = await contributionMedalService.previewImport(buffer);
    expect(result.valid).toHaveLength(0);
    expect(result.errors[0].message).toContain('không hợp lệ');
  });

  it('Danh hiệu enum không hợp lệ → errors "không hợp lệ"', async () => {
    arrangeCongHienPreview({
      personnel: { id: 'qn-dh-ch', ho_ten: 'Sai DH' },
      decisionNumbers: ['QD-DH'],
    });

    const buffer = await makeCongHienExcelBuffer([
      {
        id: 'qn-dh-ch',
        ho_va_ten: 'Sai DH',
        nam: 2024,
        thang: 6,
        danh_hieu: 'HCBVTQ_HANG_BON',
        so_quyet_dinh: 'QD-DH',
        cap_bac: 'Đại uý',
        chuc_vu: 'Trợ lý',
      },
    ]);

    const result = await contributionMedalService.previewImport(buffer);
    expect(result.valid).toHaveLength(0);
    expect(result.errors[0].message).toContain('không hợp lệ');
  });

  it('Sheet name sai → throw ValidationError "Không tìm thấy sheet"', async () => {
    // contributionMedal khai báo sheetName: 'HCBVTQ' nên tên sai sẽ fail ngay
    const workbook = new ExcelJS.Workbook();
    const ws = workbook.addWorksheet('WrongSheet');
    ws.addRow([...HEADERS]);
    const arr = await workbook.xlsx.writeBuffer();
    const buffer = Buffer.from(arr as ArrayBuffer);

    await expectError(
      contributionMedalService.previewImport(buffer),
      ValidationError,
      /Không tìm thấy sheet "HCBVTQ"/
    );
  });

  it('Số quyết định không tồn tại trên hệ thống → errors "không tồn tại trên hệ thống"', async () => {
    // Hệ thống chỉ có QD-OTHER, file khai QD-NOT-EXISTS
    arrangeCongHienPreview({
      personnel: { id: 'qn-qd-bad', ho_ten: 'QD Sai' },
      decisionNumbers: ['QD-OTHER'],
    });

    const buffer = await makeCongHienExcelBuffer([
      {
        id: 'qn-qd-bad',
        ho_va_ten: 'QD Sai',
        nam: 2024,
        thang: 6,
        danh_hieu: DANH_HIEU_HCBVTQ.HANG_NHAT,
        so_quyet_dinh: 'QD-NOT-EXISTS',
        cap_bac: 'Đại uý',
        chuc_vu: 'Trợ lý',
      },
    ]);

    const result = await contributionMedalService.previewImport(buffer);
    expect(result.valid).toHaveLength(0);
    expect(result.errors[0].message).toContain('không tồn tại trên hệ thống');
  });

  it('Đúng 120 tháng nhóm 0.7 cho HANG_BA → vào valid (boundary)', async () => {
    // Đúng 120 tháng nhóm 0.7 — đạt HANG_BA, không bị downgrade từ nhóm cao hơn
    arrangeCongHienPreview({
      personnel: { id: 'qn-bd-ch', ho_ten: 'Boundary' },
      history: [
        {
          quan_nhan_id: 'qn-bd-ch',
          he_so_chuc_vu: 0.7,
          so_thang: 120,
          ngay_bat_dau: new Date('2014-01-01'),
          ngay_ket_thuc: new Date('2024-01-01'),
          ChucVu: { he_so_chuc_vu: 0.7 },
        },
      ],
      decisionNumbers: ['QD-BD'],
    });

    const buffer = await makeCongHienExcelBuffer([
      {
        id: 'qn-bd-ch',
        ho_va_ten: 'Boundary',
        nam: 2024,
        thang: 6,
        danh_hieu: DANH_HIEU_HCBVTQ.HANG_BA,
        so_quyet_dinh: 'QD-BD',
        cap_bac: 'Đại uý',
        chuc_vu: 'Trợ lý',
      },
    ]);

    const result = await contributionMedalService.previewImport(buffer);
    expect(result.errors).toHaveLength(0);
    expect(result.valid).toHaveLength(1);
  });

  it('Mix valid + invalid → trả cả 2 phần đúng', async () => {
    arrangeCongHienPreview({
      personnel: [
        { id: 'qn-mix-1', ho_ten: 'Hợp Lệ' },
        { id: 'qn-mix-2', ho_ten: 'Thiếu Tháng' },
      ],
      decisionNumbers: ['QD-CH-001'],
    });

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
    arrangeCongHienPreview({
      personnel: { id: p1.id, ho_ten: p1.ho_ten },
      history: HCBVTQ_IMPORT_HIGHEST_eligibleHigh(p1.id),
      decisionNumbers: ['QD-HIGHEST-1'],
    });

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
    arrangeCongHienPreview({
      personnel: { id: p1.id, ho_ten: p1.ho_ten },
      history: HCBVTQ_IMPORT_HIGHEST_eligibleHigh(p1.id),
      decisionNumbers: ['QD-HIGHEST-2'],
    });

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
