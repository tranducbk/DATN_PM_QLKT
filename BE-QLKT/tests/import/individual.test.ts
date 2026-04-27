import ExcelJS from 'exceljs';
import { prismaMock, resetPrismaMock } from '../helpers/prismaMock';
import { makePersonnel } from '../helpers/fixtures';
import { expectError } from '../helpers/errorAssert';
import annualRewardService from '../../src/services/annualReward.service';
import { ValidationError } from '../../src/middlewares/errorHandler';
import {
  DANH_HIEU_CA_NHAN_HANG_NAM,
  getDanhHieuName,
} from '../../src/constants/danhHieu.constants';
import { missingDecisionNumberMessage } from '../helpers/errorMessages';

interface CaNhanRow {
  id?: string;
  ho_va_ten?: string;
  nam?: number | string | null;
  danh_hieu?: string;
  cap_bac?: string;
  chuc_vu?: string;
  ghi_chu?: string;
  so_quyet_dinh?: string;
  nhan_bkbqp?: string;
  nhan_cstdtq?: string;
  nhan_bkttcp?: string;
}

const HEADERS = [
  'id',
  'ho_va_ten',
  'nam',
  'danh_hieu',
  'cap_bac',
  'chuc_vu',
  'ghi_chu',
  'so_quyet_dinh',
  'nhan_bkbqp',
  'nhan_cstdtq',
  'nhan_bkttcp',
] as const;

async function makeCaNhanExcelBuffer(rows: CaNhanRow[]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Sheet1');
  worksheet.addRow([...HEADERS]);
  for (const row of rows) {
    worksheet.addRow(HEADERS.map(h => row[h] ?? ''));
  }
  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer as ArrayBuffer);
}

beforeEach(() => {
  resetPrismaMock();
});

describe('annualReward.service - previewImport', () => {
  it('Excel hợp lệ với 3 row CSTDCS → trả 3 valid items, no errors', async () => {
    // Given: three personnel rows, all referencing existing personnel and decisions
    const p1 = makePersonnel({ id: 'qn-1', ho_ten: 'Nguyễn Văn A' });
    const p2 = makePersonnel({ id: 'qn-2', ho_ten: 'Nguyễn Văn B' });
    const p3 = makePersonnel({ id: 'qn-3', ho_ten: 'Nguyễn Văn C' });
    prismaMock.quanNhan.findMany.mockResolvedValueOnce([p1, p2, p3]);
    prismaMock.danhHieuHangNam.findMany.mockResolvedValueOnce([]);
    prismaMock.bangDeXuat.findMany.mockResolvedValueOnce([]);
    prismaMock.fileQuyetDinh.findMany.mockResolvedValueOnce([
      { so_quyet_dinh: 'QD-001' },
      { so_quyet_dinh: 'QD-002' },
      { so_quyet_dinh: 'QD-003' },
    ]);

    const buffer = await makeCaNhanExcelBuffer([
      { id: 'qn-1', ho_va_ten: 'Nguyễn Văn A', nam: 2024, danh_hieu: 'CSTDCS', so_quyet_dinh: 'QD-001', cap_bac: 'Đại uý', chuc_vu: 'Trợ lý' },
      { id: 'qn-2', ho_va_ten: 'Nguyễn Văn B', nam: 2024, danh_hieu: 'CSTDCS', so_quyet_dinh: 'QD-002', cap_bac: 'Đại uý', chuc_vu: 'Trợ lý' },
      { id: 'qn-3', ho_va_ten: 'Nguyễn Văn C', nam: 2024, danh_hieu: 'CSTDCS', so_quyet_dinh: 'QD-003', cap_bac: 'Đại uý', chuc_vu: 'Trợ lý' },
    ]);

    // When
    const result = await annualRewardService.previewImport(buffer);

    // Then
    expect(result.total).toBe(3);
    expect(result.valid).toHaveLength(3);
    expect(result.errors).toHaveLength(0);
    expect(result.valid[0]).toMatchObject({
      personnel_id: 'qn-1',
      nam: 2024,
      danh_hieu: 'CSTDCS',
      so_quyet_dinh: 'QD-001',
    });
  });

  it('Row thiếu năm → vào errors với message "Thiếu năm"', async () => {
    const p1 = makePersonnel({ id: 'qn-1', ho_ten: 'Nguyễn Văn A' });
    prismaMock.quanNhan.findMany.mockResolvedValueOnce([p1]);
    prismaMock.danhHieuHangNam.findMany.mockResolvedValueOnce([]);
    prismaMock.bangDeXuat.findMany.mockResolvedValueOnce([]);
    prismaMock.fileQuyetDinh.findMany.mockResolvedValueOnce([{ so_quyet_dinh: 'QD-001' }]);

    const buffer = await makeCaNhanExcelBuffer([
      { id: 'qn-1', ho_va_ten: 'Nguyễn Văn A', danh_hieu: 'CSTDCS', so_quyet_dinh: 'QD-001' },
    ]);

    const result = await annualRewardService.previewImport(buffer);

    expect(result.valid).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].message).toBe('Thiếu năm');
  });

  it('Row thiếu danh_hieu (có id) → bỏ qua với message "không có danh hiệu nào được điền"', async () => {
    const p1 = makePersonnel({ id: 'qn-1', ho_ten: 'Nguyễn Văn A' });
    prismaMock.quanNhan.findMany.mockResolvedValueOnce([p1]);
    prismaMock.danhHieuHangNam.findMany.mockResolvedValueOnce([]);
    prismaMock.bangDeXuat.findMany.mockResolvedValueOnce([]);
    prismaMock.fileQuyetDinh.findMany.mockResolvedValueOnce([]);

    const buffer = await makeCaNhanExcelBuffer([
      { id: 'qn-1', ho_va_ten: 'Nguyễn Văn A', nam: 2024, so_quyet_dinh: 'QD-001' },
    ]);

    const result = await annualRewardService.previewImport(buffer);

    expect(result.valid).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].message).toContain('không có danh hiệu nào được điền');
  });

  it('Mã quân nhân không tồn tại trong DB → errors "Không tìm thấy quân nhân"', async () => {
    // Given: personnelMap is empty so any ID lookup fails
    prismaMock.quanNhan.findMany.mockResolvedValueOnce([]);
    prismaMock.danhHieuHangNam.findMany.mockResolvedValueOnce([]);
    prismaMock.bangDeXuat.findMany.mockResolvedValueOnce([]);
    prismaMock.fileQuyetDinh.findMany.mockResolvedValueOnce([{ so_quyet_dinh: 'QD-001' }]);

    const buffer = await makeCaNhanExcelBuffer([
      { id: 'qn-missing', ho_va_ten: 'Ai Đó', nam: 2024, danh_hieu: 'CSTDCS', so_quyet_dinh: 'QD-001' },
    ]);

    const result = await annualRewardService.previewImport(buffer);

    expect(result.valid).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].message).toContain('Không tìm thấy quân nhân');
  });

  it('Tên trong file không khớp tên trong DB → errors mismatch', async () => {
    const p1 = makePersonnel({ id: 'qn-1', ho_ten: 'Nguyễn Văn Đúng' });
    prismaMock.quanNhan.findMany.mockResolvedValueOnce([p1]);
    prismaMock.danhHieuHangNam.findMany.mockResolvedValueOnce([]);
    prismaMock.bangDeXuat.findMany.mockResolvedValueOnce([]);
    prismaMock.fileQuyetDinh.findMany.mockResolvedValueOnce([{ so_quyet_dinh: 'QD-001' }]);

    const buffer = await makeCaNhanExcelBuffer([
      { id: 'qn-1', ho_va_ten: 'Tên Sai Khác', nam: 2024, danh_hieu: 'CSTDCS', so_quyet_dinh: 'QD-001' },
    ]);

    const result = await annualRewardService.previewImport(buffer);

    expect(result.valid).toHaveLength(0);
    expect(result.errors[0].message).toContain('không khớp với tên trong hệ thống');
  });

  it('Trùng năm-danh hiệu trong DB → errors "Đã có"', async () => {
    const p1 = makePersonnel({ id: 'qn-1', ho_ten: 'Nguyễn Văn A' });
    prismaMock.quanNhan.findMany.mockResolvedValueOnce([p1]);
    // Existing record with same year + same danh_hieu
    prismaMock.danhHieuHangNam.findMany.mockResolvedValueOnce([
      {
        id: 'dh-1',
        quan_nhan_id: 'qn-1',
        nam: 2024,
        danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.CSTDCS,
        nhan_bkbqp: false,
        nhan_cstdtq: false,
        nhan_bkttcp: false,
        so_quyet_dinh: 'QD-OLD',
      },
    ]);
    prismaMock.bangDeXuat.findMany.mockResolvedValueOnce([]);
    prismaMock.fileQuyetDinh.findMany.mockResolvedValueOnce([{ so_quyet_dinh: 'QD-001' }]);

    const buffer = await makeCaNhanExcelBuffer([
      { id: 'qn-1', ho_va_ten: 'Nguyễn Văn A', nam: 2024, danh_hieu: 'CSTDCS', so_quyet_dinh: 'QD-001' },
    ]);

    const result = await annualRewardService.previewImport(buffer);

    expect(result.valid).toHaveLength(0);
    expect(result.errors[0].message).toBe('Đã có Chiến sĩ thi đua cơ sở cho năm 2024.');
  });

  it('BKBQP trong Excel → reject "không import qua Excel"', async () => {
    const p1 = makePersonnel({ id: 'qn-1', ho_ten: 'Nguyễn Văn A' });
    prismaMock.quanNhan.findMany.mockResolvedValueOnce([p1]);
    prismaMock.danhHieuHangNam.findMany.mockResolvedValueOnce([]);
    prismaMock.bangDeXuat.findMany.mockResolvedValueOnce([]);
    prismaMock.fileQuyetDinh.findMany.mockResolvedValueOnce([{ so_quyet_dinh: 'QD-001' }]);

    const buffer = await makeCaNhanExcelBuffer([
      {
        id: 'qn-1',
        ho_va_ten: 'Nguyễn Văn A',
        nam: 2024,
        danh_hieu: 'CSTDCS',
        so_quyet_dinh: 'QD-001',
        nhan_bkbqp: 'có',
      },
    ]);

    const result = await annualRewardService.previewImport(buffer);

    expect(result.valid).toHaveLength(0);
    expect(result.errors[0].message).toContain('không import qua Excel');
  });

  it('Pending proposal → errors "đang có đề xuất"', async () => {
    const p1 = makePersonnel({ id: 'qn-1', ho_ten: 'Nguyễn Văn A' });
    prismaMock.quanNhan.findMany.mockResolvedValueOnce([p1]);
    prismaMock.danhHieuHangNam.findMany.mockResolvedValueOnce([]);
    prismaMock.bangDeXuat.findMany.mockResolvedValueOnce([
      {
        id: 'prop-1',
        nam: 2024,
        data_danh_hieu: [{ personnel_id: 'qn-1', danh_hieu: 'CSTDCS' }],
      },
    ]);
    prismaMock.fileQuyetDinh.findMany.mockResolvedValueOnce([{ so_quyet_dinh: 'QD-001' }]);

    const buffer = await makeCaNhanExcelBuffer([
      { id: 'qn-1', ho_va_ten: 'Nguyễn Văn A', nam: 2024, danh_hieu: 'CSTDCS', so_quyet_dinh: 'QD-001' },
    ]);

    const result = await annualRewardService.previewImport(buffer);

    expect(result.valid).toHaveLength(0);
    expect(result.errors[0].message).toBe(
      'Quân nhân đang có đề xuất khen thưởng năm 2024 chờ duyệt'
    );
  });

  it('Mix valid + invalid → trả cả 2 phần đúng', async () => {
    const p1 = makePersonnel({ id: 'qn-1', ho_ten: 'Nguyễn Văn A' });
    const p2 = makePersonnel({ id: 'qn-2', ho_ten: 'Nguyễn Văn B' });
    prismaMock.quanNhan.findMany.mockResolvedValueOnce([p1, p2]);
    prismaMock.danhHieuHangNam.findMany.mockResolvedValueOnce([]);
    prismaMock.bangDeXuat.findMany.mockResolvedValueOnce([]);
    prismaMock.fileQuyetDinh.findMany.mockResolvedValueOnce([
      { so_quyet_dinh: 'QD-001' },
      { so_quyet_dinh: 'QD-002' },
    ]);

    const buffer = await makeCaNhanExcelBuffer([
      { id: 'qn-1', ho_va_ten: 'Nguyễn Văn A', nam: 2024, danh_hieu: 'CSTDCS', so_quyet_dinh: 'QD-001', cap_bac: 'Đại uý', chuc_vu: 'Trợ lý' },
      // Invalid — missing year
      { id: 'qn-2', ho_va_ten: 'Nguyễn Văn B', danh_hieu: 'CSTT', so_quyet_dinh: 'QD-002', cap_bac: 'Đại uý', chuc_vu: 'Trợ lý' },
    ]);

    const result = await annualRewardService.previewImport(buffer);

    expect(result.valid).toHaveLength(1);
    expect(result.valid[0].personnel_id).toBe('qn-1');
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].message).toBe('Thiếu năm');
  });
});

describe('annualReward.service - confirmImport', () => {
  it('Confirm với 2 valid rows → upsert 2 lần với args đúng', async () => {
    // Given: two valid items, no pending proposal, no existing records
    prismaMock.bangDeXuat.findMany.mockResolvedValueOnce([]);
    prismaMock.danhHieuHangNam.findMany.mockResolvedValueOnce([]);
    prismaMock.quanNhan.findMany.mockResolvedValueOnce([
      { id: 'qn-1', ho_ten: 'Nguyễn Văn A' },
      { id: 'qn-2', ho_ten: 'Nguyễn Văn B' },
    ]);
    prismaMock.danhHieuHangNam.upsert
      .mockResolvedValueOnce({ id: 'dh-1' })
      .mockResolvedValueOnce({ id: 'dh-2' });

    const result = await annualRewardService.confirmImport([
      {
        row: 2,
        personnel_id: 'qn-1',
        ho_ten: 'Nguyễn Văn A',
        cap_bac: 'Đại uý',
        chuc_vu: 'Trợ lý',
        nam: 2024,
        danh_hieu: 'CSTDCS',
        so_quyet_dinh: 'QD-001',
        ghi_chu: null,
      },
      {
        row: 3,
        personnel_id: 'qn-2',
        ho_ten: 'Nguyễn Văn B',
        cap_bac: 'Đại uý',
        chuc_vu: 'Trợ lý',
        nam: 2024,
        danh_hieu: 'CSTT',
        so_quyet_dinh: 'QD-002',
        ghi_chu: null,
      },
    ] as any);

    expect(result.imported).toBe(2);
    expect(prismaMock.danhHieuHangNam.upsert).toHaveBeenCalledTimes(2);
    const firstCall = prismaMock.danhHieuHangNam.upsert.mock.calls[0][0];
    expect(firstCall.where).toEqual({
      quan_nhan_id_nam: { quan_nhan_id: 'qn-1', nam: 2024 },
    });
    expect(firstCall.create).toMatchObject({
      quan_nhan_id: 'qn-1',
      nam: 2024,
      danh_hieu: 'CSTDCS',
      so_quyet_dinh: 'QD-001',
    });
  });

  it('Confirm với pending proposal conflict → throw ValidationError "đang có đề xuất chờ duyệt"', async () => {
    prismaMock.bangDeXuat.findMany.mockResolvedValueOnce([
      {
        id: 'prop-1',
        nam: 2024,
        data_danh_hieu: [{ personnel_id: 'qn-1', danh_hieu: 'CSTDCS' }],
      },
    ]);
    prismaMock.danhHieuHangNam.findMany.mockResolvedValueOnce([]);
    prismaMock.quanNhan.findMany.mockResolvedValueOnce([{ id: 'qn-1', ho_ten: 'Nguyễn Văn A' }]);

    await expectError(
      annualRewardService.confirmImport([
        {
          row: 2,
          personnel_id: 'qn-1',
          ho_ten: 'Nguyễn Văn A',
          cap_bac: 'Đại uý',
          chuc_vu: 'Trợ lý',
          nam: 2024,
          danh_hieu: 'CSTDCS',
          so_quyet_dinh: 'QD-001',
          ghi_chu: null,
        },
      ] as any),
      ValidationError,
      'Nguyễn Văn A năm 2024: đang có đề xuất chờ duyệt'
    );
    expect(prismaMock.danhHieuHangNam.upsert).not.toHaveBeenCalled();
  });

  it('Confirm khi DB đã có danh_hieu khác → throw ValidationError "không thể ghi đè"', async () => {
    // Given: existing CSTDCS for qn-1 in 2024, request tries to overwrite with CSTT
    prismaMock.bangDeXuat.findMany.mockResolvedValueOnce([]);
    prismaMock.danhHieuHangNam.findMany.mockResolvedValueOnce([
      {
        quan_nhan_id: 'qn-1',
        nam: 2024,
        danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.CSTDCS,
        nhan_bkbqp: false,
        nhan_cstdtq: false,
        nhan_bkttcp: false,
      },
    ]);
    prismaMock.quanNhan.findMany.mockResolvedValueOnce([{ id: 'qn-1', ho_ten: 'Nguyễn Văn A' }]);

    await expectError(
      annualRewardService.confirmImport([
        {
          row: 2,
          personnel_id: 'qn-1',
          ho_ten: 'Nguyễn Văn A',
          cap_bac: 'Đại uý',
          chuc_vu: 'Trợ lý',
          nam: 2024,
          danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.CSTT,
          so_quyet_dinh: 'QD-001',
          ghi_chu: null,
        },
      ] as any),
      ValidationError,
      'Nguyễn Văn A năm 2024: đã có Chiến sĩ thi đua cơ sở, không thể ghi đè bằng Chiến sĩ tiên tiến'
    );
    expect(prismaMock.danhHieuHangNam.upsert).not.toHaveBeenCalled();
  });

  it('Confirm row CSTDCS thiếu so_quyet_dinh → throw ValidationError missing decision', async () => {
    prismaMock.bangDeXuat.findMany.mockResolvedValueOnce([]);
    prismaMock.danhHieuHangNam.findMany.mockResolvedValueOnce([]);
    prismaMock.quanNhan.findMany.mockResolvedValueOnce([{ id: 'qn-1', ho_ten: 'Nguyễn Văn A' }]);

    await expectError(
      annualRewardService.confirmImport([
        {
          row: 2,
          personnel_id: 'qn-1',
          ho_ten: 'Nguyễn Văn A',
          cap_bac: 'Đại uý',
          chuc_vu: 'Trợ lý',
          nam: 2024,
          danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.CSTDCS,
          so_quyet_dinh: null,
          ghi_chu: null,
        },
      ] as any),
      ValidationError,
      missingDecisionNumberMessage('Nguyễn Văn A', getDanhHieuName(DANH_HIEU_CA_NHAN_HANG_NAM.CSTDCS))
    );
    expect(prismaMock.danhHieuHangNam.upsert).not.toHaveBeenCalled();
  });

  it('Preview: row thiếu so_quyet_dinh → vào errors', async () => {
    const p1 = makePersonnel({ id: 'qn-prev', ho_ten: 'QN Preview' });
    prismaMock.quanNhan.findMany.mockResolvedValueOnce([p1]);
    prismaMock.danhHieuHangNam.findMany.mockResolvedValueOnce([]);
    prismaMock.bangDeXuat.findMany.mockResolvedValueOnce([]);
    prismaMock.fileQuyetDinh.findMany.mockResolvedValueOnce([{ so_quyet_dinh: 'QD-XYZ' }]);

    const buffer = await makeCaNhanExcelBuffer([
      { id: 'qn-prev', ho_va_ten: 'QN Preview', nam: 2024, danh_hieu: 'CSTDCS' },
    ]);

    const result = await annualRewardService.previewImport(buffer);
    expect(result.valid).toHaveLength(0);
    expect(result.errors[0].message).toBe('Thiếu số quyết định');
  });

  it('Confirm rỗng → imported: 0', async () => {
    prismaMock.bangDeXuat.findMany.mockResolvedValueOnce([]);
    prismaMock.danhHieuHangNam.findMany.mockResolvedValueOnce([]);
    prismaMock.quanNhan.findMany.mockResolvedValueOnce([]);

    const result = await annualRewardService.confirmImport([]);

    expect(result.imported).toBe(0);
    expect(prismaMock.danhHieuHangNam.upsert).not.toHaveBeenCalled();
  });
});
