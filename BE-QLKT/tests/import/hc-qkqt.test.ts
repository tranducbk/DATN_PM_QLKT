import ExcelJS from 'exceljs';
import { prismaMock } from '../helpers/prismaMock';
import { makePersonnel } from '../helpers/fixtures';
import militaryFlagService from '../../src/services/militaryFlag.service';
import {
  IMPORT_HCQKQT_ALREADY_AWARDED,
  IMPORT_HCQKQT_NOT_ENOUGH_YEARS_PREFIX,
  IMPORT_HCQKQT_PERSONNEL_NOT_FOUND,
} from '../helpers/errorMessages';

interface HcqkqtRow {
  id?: string;
  ho_va_ten?: string;
  cap_bac?: string;
  chuc_vu?: string;
  nam?: number | string | null;
  thang?: number | string | null;
  so_quyet_dinh?: string;
  ghi_chu?: string;
}

const HEADERS = [
  'id',
  'ho_va_ten',
  'cap_bac',
  'chuc_vu',
  'nam',
  'thang',
  'so_quyet_dinh',
  'ghi_chu',
] as const;

async function makeHcqkqtExcelBuffer(rows: HcqkqtRow[]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('HC QKQT');
  worksheet.addRow([...HEADERS]);
  for (const row of rows) {
    worksheet.addRow(HEADERS.map(h => row[h] ?? ''));
  }
  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer as ArrayBuffer);
}

describe('militaryFlag.service - previewImport', () => {
  it('Row hợp lệ HC QKQT (>= 25 năm phục vụ) → vào valid', async () => {
    // Given: enlisted 1995-01-01, ref 2024-12 → ~30y >= 25y
    const p1 = makePersonnel({
      id: 'qn-1',
      ho_ten: 'Nguyễn Văn A',
      cap_bac: 'Trung tá',
      ngay_nhap_ngu: new Date('1995-01-01'),
    });
    prismaMock.quanNhan.findMany.mockResolvedValueOnce([{ ...p1, ChucVu: { ten_chuc_vu: 'Trợ lý' } }]);
    prismaMock.huanChuongQuanKyQuyetThang.findMany.mockResolvedValueOnce([]);
    prismaMock.fileQuyetDinh.findMany.mockResolvedValueOnce([{ so_quyet_dinh: 'QD-001' }]);
    prismaMock.bangDeXuat.findMany.mockResolvedValueOnce([]);

    const buffer = await makeHcqkqtExcelBuffer([
      {
        id: 'qn-1',
        ho_va_ten: 'Nguyễn Văn A',
        cap_bac: 'Trung tá',
        chuc_vu: 'Trợ lý',
        nam: 2024,
        thang: 12,
        so_quyet_dinh: 'QD-001',
      },
    ]);

    const result = await militaryFlagService.previewImport(buffer);

    expect(result.valid).toHaveLength(1);
    expect(result.errors).toHaveLength(0);
    expect(result.valid[0]).toMatchObject({
      personnel_id: 'qn-1',
      nam: 2024,
      thang: 12,
      so_quyet_dinh: 'QD-001',
    });
  });

  it('QN < 25 năm phục vụ → errors "Chưa đủ 25 năm phục vụ"', async () => {
    const p1 = makePersonnel({
      id: 'qn-1',
      ho_ten: 'Nguyễn Văn A',
      cap_bac: 'Đại uý',
      ngay_nhap_ngu: new Date('2015-01-01'),
    });
    prismaMock.quanNhan.findMany.mockResolvedValueOnce([{ ...p1, ChucVu: { ten_chuc_vu: 'Trợ lý' } }]);
    prismaMock.huanChuongQuanKyQuyetThang.findMany.mockResolvedValueOnce([]);
    prismaMock.fileQuyetDinh.findMany.mockResolvedValueOnce([{ so_quyet_dinh: 'QD-001' }]);
    prismaMock.bangDeXuat.findMany.mockResolvedValueOnce([]);

    const buffer = await makeHcqkqtExcelBuffer([
      {
        id: 'qn-1',
        ho_va_ten: 'Nguyễn Văn A',
        cap_bac: 'Đại uý',
        chuc_vu: 'Trợ lý',
        nam: 2024,
        thang: 12,
        so_quyet_dinh: 'QD-001',
      },
    ]);

    const result = await militaryFlagService.previewImport(buffer);

    expect(result.valid).toHaveLength(0);
    expect(result.errors[0].message).toContain(IMPORT_HCQKQT_NOT_ENOUGH_YEARS_PREFIX);
  });

  it('QN đã có HC QKQT trên hệ thống → errors "đã có HC QKQT"', async () => {
    const p1 = makePersonnel({
      id: 'qn-1',
      ho_ten: 'Nguyễn Văn A',
      cap_bac: 'Trung tá',
      ngay_nhap_ngu: new Date('1990-01-01'),
    });
    prismaMock.quanNhan.findMany.mockResolvedValueOnce([{ ...p1, ChucVu: { ten_chuc_vu: 'Trợ lý' } }]);
    prismaMock.huanChuongQuanKyQuyetThang.findMany.mockResolvedValueOnce([
      { quan_nhan_id: 'qn-1', nam: 2020, so_quyet_dinh: 'QD-OLD' },
    ]);
    prismaMock.fileQuyetDinh.findMany.mockResolvedValueOnce([{ so_quyet_dinh: 'QD-001' }]);
    prismaMock.bangDeXuat.findMany.mockResolvedValueOnce([]);

    const buffer = await makeHcqkqtExcelBuffer([
      {
        id: 'qn-1',
        ho_va_ten: 'Nguyễn Văn A',
        cap_bac: 'Trung tá',
        chuc_vu: 'Trợ lý',
        nam: 2024,
        thang: 12,
        so_quyet_dinh: 'QD-001',
      },
    ]);

    const result = await militaryFlagService.previewImport(buffer);

    expect(result.valid).toHaveLength(0);
    expect(result.errors[0].message).toBe(IMPORT_HCQKQT_ALREADY_AWARDED(2020));
  });

  it('Đúng 25 năm phục vụ (boundary) → vào valid', async () => {
    // enlist Dec 1999 + ref Dec 2024 → exactly 300 months — boundary inclusive
    const p1 = makePersonnel({
      id: 'qn-bdy',
      ho_ten: 'Nguyễn Văn Bdy',
      ngay_nhap_ngu: new Date('1999-12-15'),
    });
    prismaMock.quanNhan.findMany.mockResolvedValueOnce([{ ...p1, ChucVu: { ten_chuc_vu: 'Trợ lý' } }]);
    prismaMock.huanChuongQuanKyQuyetThang.findMany.mockResolvedValueOnce([]);
    prismaMock.fileQuyetDinh.findMany.mockResolvedValueOnce([{ so_quyet_dinh: 'QD-001' }]);
    prismaMock.bangDeXuat.findMany.mockResolvedValueOnce([]);

    const buffer = await makeHcqkqtExcelBuffer([
      { id: 'qn-bdy', ho_va_ten: 'Nguyễn Văn Bdy', nam: 2024, thang: 12, so_quyet_dinh: 'QD-001' },
    ]);
    const result = await militaryFlagService.previewImport(buffer);
    expect(result.valid).toHaveLength(1);
    expect(result.errors).toHaveLength(0);
  });

  it('Empty rows → skip, không tính vào total', async () => {
    prismaMock.quanNhan.findMany.mockResolvedValueOnce([]);
    prismaMock.huanChuongQuanKyQuyetThang.findMany.mockResolvedValueOnce([]);
    prismaMock.fileQuyetDinh.findMany.mockResolvedValueOnce([]);
    prismaMock.bangDeXuat.findMany.mockResolvedValueOnce([]);

    const buffer = await makeHcqkqtExcelBuffer([
      { id: '', ho_va_ten: '', nam: '', thang: '', so_quyet_dinh: '' },
    ]);
    const result = await militaryFlagService.previewImport(buffer);
    expect(result.total).toBe(0);
    expect(result.valid).toHaveLength(0);
    expect(result.errors).toHaveLength(0);
  });

  it('Duplicate cùng personnel_id trong file → row sau errors "Trùng lặp trong file"', async () => {
    const p1 = makePersonnel({
      id: 'qn-dup',
      ho_ten: 'Nguyễn Văn Dup',
      ngay_nhap_ngu: new Date('1990-01-01'),
    });
    prismaMock.quanNhan.findMany.mockResolvedValueOnce([{ ...p1, ChucVu: { ten_chuc_vu: 'Trợ lý' } }]);
    prismaMock.huanChuongQuanKyQuyetThang.findMany.mockResolvedValueOnce([]);
    prismaMock.fileQuyetDinh.findMany.mockResolvedValueOnce([{ so_quyet_dinh: 'QD-001' }]);
    prismaMock.bangDeXuat.findMany.mockResolvedValueOnce([]);

    const buffer = await makeHcqkqtExcelBuffer([
      { id: 'qn-dup', ho_va_ten: 'Nguyễn Văn Dup', nam: 2024, thang: 12, so_quyet_dinh: 'QD-001' },
      { id: 'qn-dup', ho_va_ten: 'Nguyễn Văn Dup', nam: 2024, thang: 12, so_quyet_dinh: 'QD-001' },
    ]);
    const result = await militaryFlagService.previewImport(buffer);
    expect(result.valid).toHaveLength(1);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].message).toContain('Trùng lặp trong file');
  });

  it('Thiếu Tháng → errors "Thiếu Tháng"', async () => {
    const p1 = makePersonnel({
      id: 'qn-mt',
      ho_ten: 'Nguyễn Văn Mt',
      ngay_nhap_ngu: new Date('1990-01-01'),
    });
    prismaMock.quanNhan.findMany.mockResolvedValueOnce([{ ...p1, ChucVu: { ten_chuc_vu: 'Trợ lý' } }]);
    prismaMock.huanChuongQuanKyQuyetThang.findMany.mockResolvedValueOnce([]);
    prismaMock.fileQuyetDinh.findMany.mockResolvedValueOnce([{ so_quyet_dinh: 'QD-001' }]);
    prismaMock.bangDeXuat.findMany.mockResolvedValueOnce([]);

    const buffer = await makeHcqkqtExcelBuffer([
      { id: 'qn-mt', ho_va_ten: 'Nguyễn Văn Mt', nam: 2024, thang: '', so_quyet_dinh: 'QD-001' },
    ]);
    const result = await militaryFlagService.previewImport(buffer);
    expect(result.errors[0].message).toContain('Thiếu Tháng');
  });

  it('Sai sheet name → throw ValidationError', async () => {
    const workbook = new ExcelJS.Workbook();
    workbook.addWorksheet('WrongSheet').addRow([...HEADERS]);
    const arrayBuffer = await workbook.xlsx.writeBuffer();
    const buffer = Buffer.from(arrayBuffer as ArrayBuffer);
    await expect(militaryFlagService.previewImport(buffer)).rejects.toThrow(/Không tìm thấy sheet/);
  });

  it('Số quyết định không có trên hệ thống → errors "Số quyết định ... không tồn tại"', async () => {
    const p1 = makePersonnel({
      id: 'qn-qd',
      ho_ten: 'Nguyễn Văn Qd',
      ngay_nhap_ngu: new Date('1990-01-01'),
    });
    prismaMock.quanNhan.findMany.mockResolvedValueOnce([{ ...p1, ChucVu: { ten_chuc_vu: 'Trợ lý' } }]);
    prismaMock.huanChuongQuanKyQuyetThang.findMany.mockResolvedValueOnce([]);
    prismaMock.fileQuyetDinh.findMany.mockResolvedValueOnce([]);
    prismaMock.bangDeXuat.findMany.mockResolvedValueOnce([]);

    const buffer = await makeHcqkqtExcelBuffer([
      { id: 'qn-qd', ho_va_ten: 'Nguyễn Văn Qd', nam: 2024, thang: 12, so_quyet_dinh: 'QD-NOPE' },
    ]);
    const result = await militaryFlagService.previewImport(buffer);
    expect(result.errors[0].message).toContain('không tồn tại trên hệ thống');
  });

  it('QN không tồn tại → errors "Không tìm thấy quân nhân"', async () => {
    prismaMock.quanNhan.findMany.mockResolvedValueOnce([]);
    prismaMock.huanChuongQuanKyQuyetThang.findMany.mockResolvedValueOnce([]);
    prismaMock.fileQuyetDinh.findMany.mockResolvedValueOnce([{ so_quyet_dinh: 'QD-001' }]);
    prismaMock.bangDeXuat.findMany.mockResolvedValueOnce([]);

    const buffer = await makeHcqkqtExcelBuffer([
      {
        id: 'qn-missing',
        ho_va_ten: 'Ai Đó',
        nam: 2024,
        thang: 12,
        so_quyet_dinh: 'QD-001',
      },
    ]);

    const result = await militaryFlagService.previewImport(buffer);

    expect(result.valid).toHaveLength(0);
    expect(result.errors[0].message).toBe(IMPORT_HCQKQT_PERSONNEL_NOT_FOUND('qn-missing'));
  });
});

describe('militaryFlag.service - confirmImport', () => {
  it('Confirm valid → upsert tạo HC QKQT', async () => {
    prismaMock.bangDeXuat.findMany.mockResolvedValueOnce([]);
    prismaMock.huanChuongQuanKyQuyetThang.findMany.mockResolvedValueOnce([]);
    prismaMock.huanChuongQuanKyQuyetThang.upsert.mockResolvedValueOnce({ id: 'hcqkqt-1' });

    const result = await militaryFlagService.confirmImport([
      {
        personnel_id: 'qn-1',
        ho_ten: 'Nguyễn Văn A',
        nam: 2024,
        thang: 12,
        cap_bac: 'Trung tá',
        chuc_vu: 'Trợ lý',
        so_quyet_dinh: 'QD-001',
        ghi_chu: null,
      },
    ]);

    expect(result.imported).toBe(1);
    expect(prismaMock.huanChuongQuanKyQuyetThang.upsert).toHaveBeenCalledTimes(1);
    const call = prismaMock.huanChuongQuanKyQuyetThang.upsert.mock.calls[0][0];
    expect(call.where).toEqual({ quan_nhan_id: 'qn-1' });
    expect(call.create).toMatchObject({
      quan_nhan_id: 'qn-1',
      nam: 2024,
      thang: 12,
      so_quyet_dinh: 'QD-001',
    });
  });
});
