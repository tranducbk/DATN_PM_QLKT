import ExcelJS from 'exceljs';
import { prismaMock } from '../helpers/prismaMock';
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

describe('Nhập Excel NCKH: xem trước (preview)', () => {
  it('Nhập Excel NCKH: dòng đề tài/sáng kiến khoa học hợp lệ → ghi nhận vào danh sách hợp lệ', async () => {
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

  it('Nhập Excel NCKH: trùng thành tích đã có trên hệ thống (cùng quân nhân, năm, loại, mô tả) → báo lỗi "đã tồn tại"', async () => {
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

  it('Nhập Excel NCKH: loại không phải đề tài hay sáng kiến khoa học → báo lỗi không hợp lệ', async () => {
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

  it('Nhập Excel NCKH: dòng thiếu năm → báo lỗi thiếu năm', async () => {
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

  it('Nhập Excel NCKH: năm tương lai (vượt năm hiện tại) → báo lỗi "không hợp lệ"', async () => {
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

  it('Nhập Excel NCKH: cùng thành tích lặp lại trong file (cùng quân nhân, năm, loại, mô tả) → dòng sau báo "Trùng lặp trong file"', async () => {
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

  it('Nhập Excel NCKH: sai tên trang tính → từ chối với "Không tìm thấy sheet"', async () => {
    const workbook = new ExcelJS.Workbook();
    workbook.addWorksheet('WrongSheet').addRow([...HEADERS]);
    const arrayBuffer = await workbook.xlsx.writeBuffer();
    const buffer = Buffer.from(arrayBuffer as ArrayBuffer);
    await expect(scientificAchievementService.previewImport(buffer)).rejects.toThrow(
      /Không tìm thấy sheet/
    );
  });

  it('Nhập Excel NCKH: dòng trống → bỏ qua hoàn toàn, không tính vào tổng lẫn lỗi', async () => {
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

  it('Nhập Excel NCKH: dòng thiếu mô tả → báo lỗi "Thiếu Mô tả"', async () => {
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

describe('Nhập Excel NCKH: xác nhận (confirm)', () => {
  it('Nhập Excel NCKH: xác nhận dòng hợp lệ → tạo bản ghi thành tích khoa học', async () => {
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
