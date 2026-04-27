import ExcelJS from 'exceljs';
import { prismaMock, resetPrismaMock } from '../helpers/prismaMock';
import { makePersonnel } from '../helpers/fixtures';
import scientificAchievementService from '../../src/services/scientificAchievement.service';
import {
  IMPORT_NCKH_DUPLICATE_DB,
  IMPORT_NCKH_MISSING_FIELDS,
} from '../helpers/errorMessages';

interface NckhRow {
  id?: string;
  ho_va_ten?: string;
  cap_bac?: string;
  chuc_vu?: string;
  nam?: number | string | null;
  loai?: string;
  mo_ta?: string;
  so_quyet_dinh?: string;
  ghi_chu?: string;
}

const HEADERS = [
  'id',
  'ho_va_ten',
  'cap_bac',
  'chuc_vu',
  'nam',
  'loai',
  'mo_ta',
  'so_quyet_dinh',
  'ghi_chu',
] as const;

async function makeNckhExcelBuffer(rows: NckhRow[]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('NCKH');
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

describe('scientificAchievement.service - previewImport', () => {
  it('Row DTKH/SKKH hợp lệ → vào valid', async () => {
    const p1 = makePersonnel({ id: 'qn-1', ho_ten: 'Nguyễn Văn A', cap_bac: 'Đại uý' });
    prismaMock.quanNhan.findMany.mockResolvedValueOnce([{ ...p1, ChucVu: { ten_chuc_vu: 'Trợ lý' } }]);
    prismaMock.thanhTichKhoaHoc.findMany.mockResolvedValueOnce([]);
    prismaMock.fileQuyetDinh.findMany.mockResolvedValueOnce([{ so_quyet_dinh: 'QD-001' }]);

    const buffer = await makeNckhExcelBuffer([
      {
        id: 'qn-1',
        ho_va_ten: 'Nguyễn Văn A',
        cap_bac: 'Đại uý',
        chuc_vu: 'Trợ lý',
        nam: 2024,
        loai: 'DTKH',
        mo_ta: 'Đề tài AI ứng dụng',
        so_quyet_dinh: 'QD-001',
      },
    ]);

    const result = await scientificAchievementService.previewImport(buffer);

    expect(result.valid).toHaveLength(1);
    expect(result.errors).toHaveLength(0);
    expect(result.valid[0]).toMatchObject({
      personnel_id: 'qn-1',
      nam: 2024,
      loai: 'DTKH',
      mo_ta: 'Đề tài AI ứng dụng',
      so_quyet_dinh: 'QD-001',
    });
  });

  it('Row trùng (cùng personnel_id + nam + loai + mo_ta) trong DB → errors "Thành tích khoa học đã tồn tại"', async () => {
    const p1 = makePersonnel({ id: 'qn-1', ho_ten: 'Nguyễn Văn A', cap_bac: 'Đại uý' });
    prismaMock.quanNhan.findMany.mockResolvedValueOnce([{ ...p1, ChucVu: { ten_chuc_vu: 'Trợ lý' } }]);
    prismaMock.thanhTichKhoaHoc.findMany.mockResolvedValueOnce([
      { quan_nhan_id: 'qn-1', nam: 2024, loai: 'SKKH', mo_ta: 'Sáng kiến X', so_quyet_dinh: 'QD-OLD' },
    ]);
    prismaMock.fileQuyetDinh.findMany.mockResolvedValueOnce([{ so_quyet_dinh: 'QD-001' }]);

    const buffer = await makeNckhExcelBuffer([
      {
        id: 'qn-1',
        ho_va_ten: 'Nguyễn Văn A',
        cap_bac: 'Đại uý',
        chuc_vu: 'Trợ lý',
        nam: 2024,
        loai: 'SKKH',
        mo_ta: 'Sáng kiến X',
        so_quyet_dinh: 'QD-001',
      },
    ]);

    const result = await scientificAchievementService.previewImport(buffer);

    expect(result.valid).toHaveLength(0);
    expect(result.errors[0].message).toBe(IMPORT_NCKH_DUPLICATE_DB);
  });

  it('Loại không hợp lệ (≠ DTKH/SKKH) → errors "không hợp lệ"', async () => {
    const p1 = makePersonnel({ id: 'qn-il', ho_ten: 'Nguyễn Văn Il', cap_bac: 'Đại uý' });
    prismaMock.quanNhan.findMany.mockResolvedValueOnce([{ ...p1, ChucVu: { ten_chuc_vu: 'Trợ lý' } }]);
    prismaMock.thanhTichKhoaHoc.findMany.mockResolvedValueOnce([]);
    prismaMock.fileQuyetDinh.findMany.mockResolvedValueOnce([{ so_quyet_dinh: 'QD-001' }]);

    const buffer = await makeNckhExcelBuffer([
      {
        id: 'qn-il',
        ho_va_ten: 'Nguyễn Văn Il',
        cap_bac: 'Đại uý',
        chuc_vu: 'Trợ lý',
        nam: 2024,
        loai: 'XXX',
        mo_ta: 'Foo',
        so_quyet_dinh: 'QD-001',
      },
    ]);
    const result = await scientificAchievementService.previewImport(buffer);
    expect(result.valid).toHaveLength(0);
    expect(result.errors[0].message).toContain('không hợp lệ');
  });

  it('Thiếu Năm → errors "Thiếu ... Năm"', async () => {
    const p1 = makePersonnel({ id: 'qn-mn', ho_ten: 'Nguyễn Văn Mn', cap_bac: 'Đại uý' });
    prismaMock.quanNhan.findMany.mockResolvedValueOnce([{ ...p1, ChucVu: { ten_chuc_vu: 'Trợ lý' } }]);
    prismaMock.thanhTichKhoaHoc.findMany.mockResolvedValueOnce([]);
    prismaMock.fileQuyetDinh.findMany.mockResolvedValueOnce([{ so_quyet_dinh: 'QD-001' }]);

    const buffer = await makeNckhExcelBuffer([
      {
        id: 'qn-mn',
        ho_va_ten: 'Nguyễn Văn Mn',
        cap_bac: 'Đại uý',
        chuc_vu: 'Trợ lý',
        nam: '',
        loai: 'DTKH',
        mo_ta: 'Foo',
        so_quyet_dinh: 'QD-001',
      },
    ]);
    const result = await scientificAchievementService.previewImport(buffer);
    expect(result.errors[0].message).toContain('Năm');
  });

  it('Năm vượt currentYear → errors "Năm ... không hợp lệ"', async () => {
    const p1 = makePersonnel({ id: 'qn-fy', ho_ten: 'Nguyễn Văn Fy', cap_bac: 'Đại uý' });
    prismaMock.quanNhan.findMany.mockResolvedValueOnce([{ ...p1, ChucVu: { ten_chuc_vu: 'Trợ lý' } }]);
    prismaMock.thanhTichKhoaHoc.findMany.mockResolvedValueOnce([]);
    prismaMock.fileQuyetDinh.findMany.mockResolvedValueOnce([{ so_quyet_dinh: 'QD-001' }]);

    const futureYear = new Date().getFullYear() + 5;
    const buffer = await makeNckhExcelBuffer([
      {
        id: 'qn-fy',
        ho_va_ten: 'Nguyễn Văn Fy',
        cap_bac: 'Đại uý',
        chuc_vu: 'Trợ lý',
        nam: futureYear,
        loai: 'DTKH',
        mo_ta: 'Foo',
        so_quyet_dinh: 'QD-001',
      },
    ]);
    const result = await scientificAchievementService.previewImport(buffer);
    expect(result.errors[0].message).toContain(`Năm ${futureYear} không hợp lệ`);
  });

  it('Duplicate cùng id+nam+loai+mo_ta trong file → row sau errors "Trùng lặp trong file"', async () => {
    const p1 = makePersonnel({ id: 'qn-df', ho_ten: 'Nguyễn Văn Df', cap_bac: 'Đại uý' });
    prismaMock.quanNhan.findMany.mockResolvedValueOnce([{ ...p1, ChucVu: { ten_chuc_vu: 'Trợ lý' } }]);
    prismaMock.thanhTichKhoaHoc.findMany.mockResolvedValueOnce([]);
    prismaMock.fileQuyetDinh.findMany.mockResolvedValueOnce([{ so_quyet_dinh: 'QD-001' }]);

    const buffer = await makeNckhExcelBuffer([
      {
        id: 'qn-df',
        ho_va_ten: 'Nguyễn Văn Df',
        cap_bac: 'Đại uý',
        chuc_vu: 'Trợ lý',
        nam: 2024,
        loai: 'DTKH',
        mo_ta: 'Đề tài Z',
        so_quyet_dinh: 'QD-001',
      },
      {
        id: 'qn-df',
        ho_va_ten: 'Nguyễn Văn Df',
        cap_bac: 'Đại uý',
        chuc_vu: 'Trợ lý',
        nam: 2024,
        loai: 'DTKH',
        mo_ta: 'Đề tài Z',
        so_quyet_dinh: 'QD-001',
      },
    ]);
    const result = await scientificAchievementService.previewImport(buffer);
    expect(result.valid).toHaveLength(1);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].message).toContain('Trùng lặp trong file');
  });

  it('Sai sheet name → throw ValidationError', async () => {
    const workbook = new ExcelJS.Workbook();
    workbook.addWorksheet('WrongSheet').addRow([...HEADERS]);
    const arrayBuffer = await workbook.xlsx.writeBuffer();
    const buffer = Buffer.from(arrayBuffer as ArrayBuffer);
    await expect(scientificAchievementService.previewImport(buffer)).rejects.toThrow(
      /Không tìm thấy sheet/
    );
  });

  it('Empty rows (id+nam+loai trống) → skip hoàn toàn', async () => {
    prismaMock.quanNhan.findMany.mockResolvedValueOnce([]);
    prismaMock.thanhTichKhoaHoc.findMany.mockResolvedValueOnce([]);
    prismaMock.fileQuyetDinh.findMany.mockResolvedValueOnce([]);

    const buffer = await makeNckhExcelBuffer([
      { id: '', ho_va_ten: '', nam: '', loai: '', mo_ta: '', so_quyet_dinh: '' },
    ]);
    const result = await scientificAchievementService.previewImport(buffer);
    expect(result.total).toBe(0);
    expect(result.valid).toHaveLength(0);
    expect(result.errors).toHaveLength(0);
  });

  it('Row thiếu Mô tả → errors "Thiếu Mô tả"', async () => {
    const p1 = makePersonnel({ id: 'qn-1', ho_ten: 'Nguyễn Văn A', cap_bac: 'Đại uý' });
    prismaMock.quanNhan.findMany.mockResolvedValueOnce([{ ...p1, ChucVu: { ten_chuc_vu: 'Trợ lý' } }]);
    prismaMock.thanhTichKhoaHoc.findMany.mockResolvedValueOnce([]);
    prismaMock.fileQuyetDinh.findMany.mockResolvedValueOnce([{ so_quyet_dinh: 'QD-001' }]);

    const buffer = await makeNckhExcelBuffer([
      {
        id: 'qn-1',
        ho_va_ten: 'Nguyễn Văn A',
        cap_bac: 'Đại uý',
        chuc_vu: 'Trợ lý',
        nam: 2024,
        loai: 'DTKH',
        so_quyet_dinh: 'QD-001',
      },
    ]);

    const result = await scientificAchievementService.previewImport(buffer);

    expect(result.valid).toHaveLength(0);
    expect(result.errors[0].message).toBe(IMPORT_NCKH_MISSING_FIELDS(['Mô tả']));
  });
});

describe('scientificAchievement.service - confirmImport', () => {
  it('Confirm valid → tạo ThanhTichKhoaHoc', async () => {
    prismaMock.thanhTichKhoaHoc.create.mockResolvedValueOnce({ id: 'ttkh-1' });

    const result = await scientificAchievementService.confirmImport(
      [
        {
          personnel_id: 'qn-1',
          nam: 2024,
          loai: 'DTKH',
          mo_ta: 'Đề tài AI ứng dụng',
          cap_bac: 'Đại uý',
          chuc_vu: 'Trợ lý',
          so_quyet_dinh: 'QD-001',
          ghi_chu: null,
        },
      ],
      'admin-1'
    );

    expect(result.imported).toBe(1);
    expect(prismaMock.thanhTichKhoaHoc.create).toHaveBeenCalledTimes(1);
    const call = prismaMock.thanhTichKhoaHoc.create.mock.calls[0][0];
    expect(call.data).toMatchObject({
      quan_nhan_id: 'qn-1',
      nam: 2024,
      loai: 'DTKH',
      mo_ta: 'Đề tài AI ứng dụng',
      so_quyet_dinh: 'QD-001',
    });
  });
});
