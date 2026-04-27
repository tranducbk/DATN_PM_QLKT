import ExcelJS from 'exceljs';
import { prismaMock, resetPrismaMock } from '../helpers/prismaMock';
import { makePersonnel } from '../helpers/fixtures';
import commemorativeMedalService from '../../src/services/commemorativeMedal.service';
import { GENDER } from '../../src/constants/gender.constants';
import {
  IMPORT_KNC_MISSING_NHAP_NGU,
  IMPORT_KNC_NOT_ENOUGH_SERVICE_PREFIX,
} from '../helpers/errorMessages';

interface KncRow {
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

async function makeKncExcelBuffer(rows: KncRow[]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('KNC VSNXD QDNDVN');
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

describe('commemorativeMedal.service - previewImport (KNC VSNXD)', () => {
  it('Nam ≥ 25 năm phục vụ → vào valid', async () => {
    const p1 = makePersonnel({
      id: 'qn-1',
      ho_ten: 'Nguyễn Văn A',
      cap_bac: 'Thượng tá',
      gioi_tinh: GENDER.MALE,
      ngay_nhap_ngu: new Date('1995-01-01'),
    });
    prismaMock.quanNhan.findMany.mockResolvedValueOnce([{ ...p1, ChucVu: { ten_chuc_vu: 'Trợ lý' } }]);
    prismaMock.kyNiemChuongVSNXDQDNDVN.findMany.mockResolvedValueOnce([]);
    prismaMock.fileQuyetDinh.findMany.mockResolvedValueOnce([{ so_quyet_dinh: 'QD-001' }]);
    prismaMock.bangDeXuat.findMany.mockResolvedValueOnce([]);

    const buffer = await makeKncExcelBuffer([
      {
        id: 'qn-1',
        ho_va_ten: 'Nguyễn Văn A',
        cap_bac: 'Thượng tá',
        chuc_vu: 'Trợ lý',
        nam: 2024,
        thang: 12,
        so_quyet_dinh: 'QD-001',
      },
    ]);

    const result = await commemorativeMedalService.previewImport(buffer);

    expect(result.valid).toHaveLength(1);
    expect(result.errors).toHaveLength(0);
    expect(result.valid[0]).toMatchObject({
      personnel_id: 'qn-1',
      nam: 2024,
      thang: 12,
      gioi_tinh: GENDER.MALE,
    });
  });

  it('Nữ ≥ 20 năm phục vụ → vào valid', async () => {
    const p1 = makePersonnel({
      id: 'qn-2',
      ho_ten: 'Trần Thị B',
      cap_bac: 'Trung tá',
      gioi_tinh: GENDER.FEMALE,
      ngay_nhap_ngu: new Date('2000-01-01'),
    });
    prismaMock.quanNhan.findMany.mockResolvedValueOnce([{ ...p1, ChucVu: { ten_chuc_vu: 'Trợ lý' } }]);
    prismaMock.kyNiemChuongVSNXDQDNDVN.findMany.mockResolvedValueOnce([]);
    prismaMock.fileQuyetDinh.findMany.mockResolvedValueOnce([{ so_quyet_dinh: 'QD-002' }]);
    prismaMock.bangDeXuat.findMany.mockResolvedValueOnce([]);

    const buffer = await makeKncExcelBuffer([
      {
        id: 'qn-2',
        ho_va_ten: 'Trần Thị B',
        cap_bac: 'Trung tá',
        chuc_vu: 'Trợ lý',
        nam: 2024,
        thang: 12,
        so_quyet_dinh: 'QD-002',
      },
    ]);

    const result = await commemorativeMedalService.previewImport(buffer);

    expect(result.valid).toHaveLength(1);
    expect(result.errors).toHaveLength(0);
    expect(result.valid[0]).toMatchObject({
      personnel_id: 'qn-2',
      gioi_tinh: GENDER.FEMALE,
    });
  });

  it('Nam < 25 năm phục vụ → errors "Chưa đủ điều kiện: Nam cần >= 25 năm"', async () => {
    const p1 = makePersonnel({
      id: 'qn-1',
      ho_ten: 'Nguyễn Văn A',
      cap_bac: 'Đại uý',
      gioi_tinh: GENDER.MALE,
      ngay_nhap_ngu: new Date('2015-01-01'),
    });
    prismaMock.quanNhan.findMany.mockResolvedValueOnce([{ ...p1, ChucVu: { ten_chuc_vu: 'Trợ lý' } }]);
    prismaMock.kyNiemChuongVSNXDQDNDVN.findMany.mockResolvedValueOnce([]);
    prismaMock.fileQuyetDinh.findMany.mockResolvedValueOnce([{ so_quyet_dinh: 'QD-001' }]);
    prismaMock.bangDeXuat.findMany.mockResolvedValueOnce([]);

    const buffer = await makeKncExcelBuffer([
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

    const result = await commemorativeMedalService.previewImport(buffer);

    expect(result.valid).toHaveLength(0);
    expect(result.errors[0].message).toContain(IMPORT_KNC_NOT_ENOUGH_SERVICE_PREFIX('Nam', 25));
  });

  it('Nữ < 20 năm phục vụ → errors "Chưa đủ điều kiện: Nữ cần >= 20 năm"', async () => {
    const p1 = makePersonnel({
      id: 'qn-2',
      ho_ten: 'Trần Thị B',
      cap_bac: 'Đại uý',
      gioi_tinh: GENDER.FEMALE,
      ngay_nhap_ngu: new Date('2015-01-01'),
    });
    prismaMock.quanNhan.findMany.mockResolvedValueOnce([{ ...p1, ChucVu: { ten_chuc_vu: 'Trợ lý' } }]);
    prismaMock.kyNiemChuongVSNXDQDNDVN.findMany.mockResolvedValueOnce([]);
    prismaMock.fileQuyetDinh.findMany.mockResolvedValueOnce([{ so_quyet_dinh: 'QD-001' }]);
    prismaMock.bangDeXuat.findMany.mockResolvedValueOnce([]);

    const buffer = await makeKncExcelBuffer([
      {
        id: 'qn-2',
        ho_va_ten: 'Trần Thị B',
        cap_bac: 'Đại uý',
        chuc_vu: 'Trợ lý',
        nam: 2024,
        thang: 12,
        so_quyet_dinh: 'QD-001',
      },
    ]);

    const result = await commemorativeMedalService.previewImport(buffer);

    expect(result.valid).toHaveLength(0);
    expect(result.errors[0].message).toContain(IMPORT_KNC_NOT_ENOUGH_SERVICE_PREFIX('Nữ', 20));
  });

  it('QN thiếu ngày nhập ngũ → errors "Không có ngày nhập ngũ"', async () => {
    const p1 = makePersonnel({
      id: 'qn-1',
      ho_ten: 'Nguyễn Văn A',
      cap_bac: 'Đại uý',
      gioi_tinh: GENDER.MALE,
      ngay_nhap_ngu: null,
    });
    prismaMock.quanNhan.findMany.mockResolvedValueOnce([{ ...p1, ChucVu: { ten_chuc_vu: 'Trợ lý' } }]);
    prismaMock.kyNiemChuongVSNXDQDNDVN.findMany.mockResolvedValueOnce([]);
    prismaMock.fileQuyetDinh.findMany.mockResolvedValueOnce([{ so_quyet_dinh: 'QD-001' }]);
    prismaMock.bangDeXuat.findMany.mockResolvedValueOnce([]);

    const buffer = await makeKncExcelBuffer([
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

    const result = await commemorativeMedalService.previewImport(buffer);

    expect(result.valid).toHaveLength(0);
    expect(result.errors[0].message).toBe(IMPORT_KNC_MISSING_NHAP_NGU);
  });
});

describe('commemorativeMedal.service - confirmImport (KNC VSNXD)', () => {
  it('Confirm valid → upsert tạo KNC', async () => {
    prismaMock.bangDeXuat.findMany.mockResolvedValueOnce([]);
    prismaMock.kyNiemChuongVSNXDQDNDVN.findMany.mockResolvedValueOnce([]);
    prismaMock.kyNiemChuongVSNXDQDNDVN.upsert.mockResolvedValueOnce({ id: 'knc-1' });

    const result = await commemorativeMedalService.confirmImport(
      [
        {
          row: 2,
          personnel_id: 'qn-1',
          ho_ten: 'Nguyễn Văn A',
          cap_bac: 'Thượng tá',
          chuc_vu: 'Trợ lý',
          nam: 2024,
          thang: 12,
          so_quyet_dinh: 'QD-001',
          ghi_chu: null,
          service_years: 30,
          gioi_tinh: GENDER.MALE,
          history: [],
        },
      ],
      'admin-1'
    );

    expect(result.imported).toBe(1);
    expect(prismaMock.kyNiemChuongVSNXDQDNDVN.upsert).toHaveBeenCalledTimes(1);
    const call = prismaMock.kyNiemChuongVSNXDQDNDVN.upsert.mock.calls[0][0];
    expect(call.where).toEqual({ quan_nhan_id: 'qn-1' });
    expect(call.create).toMatchObject({
      quan_nhan_id: 'qn-1',
      nam: 2024,
      thang: 12,
      so_quyet_dinh: 'QD-001',
    });
  });
});
