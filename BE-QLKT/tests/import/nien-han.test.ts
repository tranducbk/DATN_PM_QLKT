import ExcelJS from 'exceljs';
import { prismaMock, resetPrismaMock } from '../helpers/prismaMock';
import { makePersonnel } from '../helpers/fixtures';
import { expectError } from '../helpers/errorAssert';
import tenureMedalService from '../../src/services/tenureMedal.service';
import { ValidationError } from '../../src/middlewares/errorHandler';
import { DANH_HIEU_HCCSVV } from '../../src/constants/danhHieu.constants';
import {
  IMPORT_NIEN_HAN_MISSING_DECISION,
  IMPORT_NIEN_HAN_MISSING_FIELDS,
  IMPORT_NIEN_HAN_PERSONNEL_NOT_FOUND,
} from '../helpers/errorMessages';

interface NienHanRow {
  id?: string;
  ho_va_ten?: string;
  cap_bac?: string;
  chuc_vu?: string;
  nam?: number | string | null;
  thang?: number | string | null;
  danh_hieu?: string;
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
  'danh_hieu',
  'so_quyet_dinh',
  'ghi_chu',
] as const;

async function makeNienHanExcelBuffer(rows: NienHanRow[]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('HCCSVV');
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

describe('tenureMedal.service - previewImport', () => {
  it('Row hợp lệ HCCSVV_HANG_BA → push vào valid, không có errors', async () => {
    // Given: personnel enlisted >= 10 years before reference month
    const p1 = makePersonnel({
      id: 'qn-1',
      ho_ten: 'Nguyễn Văn A',
      cap_bac: 'Đại uý',
      ngay_nhap_ngu: new Date('2010-01-01'),
    });
    prismaMock.fileQuyetDinh.findMany.mockResolvedValueOnce([{ so_quyet_dinh: 'QD-001' }]);
    prismaMock.quanNhan.findMany.mockResolvedValueOnce([{ ...p1, ChucVu: { ten_chuc_vu: 'Trợ lý' } }]);
    prismaMock.khenThuongHCCSVV.findMany.mockResolvedValueOnce([]);
    prismaMock.bangDeXuat.findMany.mockResolvedValueOnce([]);

    const buffer = await makeNienHanExcelBuffer([
      {
        id: 'qn-1',
        ho_va_ten: 'Nguyễn Văn A',
        cap_bac: 'Đại uý',
        chuc_vu: 'Trợ lý',
        nam: 2024,
        thang: 12,
        danh_hieu: 'HCCSVV_HANG_BA',
        so_quyet_dinh: 'QD-001',
      },
    ]);

    // When
    const result = await tenureMedalService.previewImport(buffer);

    // Then
    expect(result.total).toBe(1);
    expect(result.valid).toHaveLength(1);
    expect(result.errors).toHaveLength(0);
    expect(result.valid[0]).toMatchObject({
      personnel_id: 'qn-1',
      nam: 2024,
      thang: 12,
      danh_hieu: DANH_HIEU_HCCSVV.HANG_BA,
      so_quyet_dinh: 'QD-001',
    });
  });

  it('Row thiếu Tháng/Số quyết định → vào errors', async () => {
    const p1 = makePersonnel({ id: 'qn-1', ho_ten: 'Nguyễn Văn A', ngay_nhap_ngu: new Date('2010-01-01') });
    prismaMock.fileQuyetDinh.findMany.mockResolvedValueOnce([{ so_quyet_dinh: 'QD-001' }]);
    prismaMock.quanNhan.findMany.mockResolvedValueOnce([{ ...p1, ChucVu: { ten_chuc_vu: 'Trợ lý' } }]);
    prismaMock.khenThuongHCCSVV.findMany.mockResolvedValueOnce([]);
    prismaMock.bangDeXuat.findMany.mockResolvedValueOnce([]);

    const buffer = await makeNienHanExcelBuffer([
      { id: 'qn-1', ho_va_ten: 'Nguyễn Văn A', nam: 2024, danh_hieu: 'HCCSVV_HANG_BA' },
    ]);

    const result = await tenureMedalService.previewImport(buffer);

    expect(result.valid).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].message).toBe(IMPORT_NIEN_HAN_MISSING_FIELDS(['Tháng']));
  });

  it('QN không tồn tại trong DB → errors "Không tìm thấy quân nhân"', async () => {
    prismaMock.fileQuyetDinh.findMany.mockResolvedValueOnce([{ so_quyet_dinh: 'QD-001' }]);
    prismaMock.quanNhan.findMany.mockResolvedValueOnce([]);
    prismaMock.khenThuongHCCSVV.findMany.mockResolvedValueOnce([]);
    prismaMock.bangDeXuat.findMany.mockResolvedValueOnce([]);

    const buffer = await makeNienHanExcelBuffer([
      {
        id: 'qn-missing',
        ho_va_ten: 'Ai Đó',
        nam: 2024,
        thang: 12,
        danh_hieu: 'HCCSVV_HANG_BA',
        so_quyet_dinh: 'QD-001',
      },
    ]);

    const result = await tenureMedalService.previewImport(buffer);

    expect(result.valid).toHaveLength(0);
    expect(result.errors[0].message).toBe(IMPORT_NIEN_HAN_PERSONNEL_NOT_FOUND('qn-missing'));
  });

  it('QN chưa đủ 10 năm cho HCCSVV_HANG_BA → errors "Chưa đủ thời gian phục vụ"', async () => {
    const p1 = makePersonnel({
      id: 'qn-1',
      ho_ten: 'Nguyễn Văn A',
      cap_bac: 'Đại uý',
      ngay_nhap_ngu: new Date('2020-06-01'),
    });
    prismaMock.fileQuyetDinh.findMany.mockResolvedValueOnce([{ so_quyet_dinh: 'QD-001' }]);
    prismaMock.quanNhan.findMany.mockResolvedValueOnce([{ ...p1, ChucVu: { ten_chuc_vu: 'Trợ lý' } }]);
    prismaMock.khenThuongHCCSVV.findMany.mockResolvedValueOnce([]);
    prismaMock.bangDeXuat.findMany.mockResolvedValueOnce([]);

    const buffer = await makeNienHanExcelBuffer([
      {
        id: 'qn-1',
        ho_va_ten: 'Nguyễn Văn A',
        cap_bac: 'Đại uý',
        chuc_vu: 'Trợ lý',
        nam: 2024,
        thang: 12,
        danh_hieu: 'HCCSVV_HANG_BA',
        so_quyet_dinh: 'QD-001',
      },
    ]);

    const result = await tenureMedalService.previewImport(buffer);

    expect(result.valid).toHaveLength(0);
    expect(result.errors[0].message).toContain('Chưa đủ thời gian phục vụ');
  });

  it('Row HCCSVV_HANG_NHI không có HANG_BA tiền điều kiện → errors "Phải có Hạng Ba trước"', async () => {
    const p1 = makePersonnel({
      id: 'qn-1',
      ho_ten: 'Nguyễn Văn A',
      cap_bac: 'Đại uý',
      ngay_nhap_ngu: new Date('2005-01-01'),
    });
    prismaMock.fileQuyetDinh.findMany.mockResolvedValueOnce([{ so_quyet_dinh: 'QD-002' }]);
    prismaMock.quanNhan.findMany.mockResolvedValueOnce([{ ...p1, ChucVu: { ten_chuc_vu: 'Trợ lý' } }]);
    prismaMock.khenThuongHCCSVV.findMany.mockResolvedValueOnce([]);
    prismaMock.bangDeXuat.findMany.mockResolvedValueOnce([]);

    const buffer = await makeNienHanExcelBuffer([
      {
        id: 'qn-1',
        ho_va_ten: 'Nguyễn Văn A',
        cap_bac: 'Đại uý',
        chuc_vu: 'Trợ lý',
        nam: 2024,
        thang: 12,
        danh_hieu: 'HCCSVV_HANG_NHI',
        so_quyet_dinh: 'QD-002',
      },
    ]);

    const result = await tenureMedalService.previewImport(buffer);

    expect(result.valid).toHaveLength(0);
    expect(result.errors[0].message).toContain('Phải có hạng Ba trước');
  });

  it('Preview HCCSVV_HANG_NHI khi chưa có HANG_BA → vào errors (rank-order)', async () => {
    const p1 = makePersonnel({
      id: 'qn-rk',
      ho_ten: 'Người Rank',
      cap_bac: 'Đại uý',
      ngay_nhap_ngu: new Date('2000-01-01'),
    });
    prismaMock.fileQuyetDinh.findMany.mockResolvedValueOnce([{ so_quyet_dinh: 'QD-RK' }]);
    prismaMock.quanNhan.findMany.mockResolvedValueOnce([{ ...p1, ChucVu: { ten_chuc_vu: 'Trợ lý' } }]);
    prismaMock.khenThuongHCCSVV.findMany.mockResolvedValueOnce([]);
    prismaMock.bangDeXuat.findMany.mockResolvedValueOnce([]);

    const buffer = await makeNienHanExcelBuffer([
      {
        id: 'qn-rk',
        ho_va_ten: 'Người Rank',
        cap_bac: 'Đại uý',
        chuc_vu: 'Trợ lý',
        nam: 2024,
        thang: 12,
        danh_hieu: 'HCCSVV_HANG_NHI',
        so_quyet_dinh: 'QD-RK',
      },
    ]);

    const result = await tenureMedalService.previewImport(buffer);
    expect(result.valid).toHaveLength(0);
    expect(result.errors[0].message).toContain('Phải có hạng Ba trước');
  });

  it('Empty row giữa data rows → bị skip, không vào valid hay errors', async () => {
    const p1 = makePersonnel({
      id: 'qn-empty',
      ho_ten: 'Có Data',
      cap_bac: 'Đại uý',
      ngay_nhap_ngu: new Date('2010-01-01'),
    });
    prismaMock.fileQuyetDinh.findMany.mockResolvedValueOnce([{ so_quyet_dinh: 'QD-EMPTY' }]);
    prismaMock.quanNhan.findMany.mockResolvedValueOnce([{ ...p1, ChucVu: { ten_chuc_vu: 'Trợ lý' } }]);
    prismaMock.khenThuongHCCSVV.findMany.mockResolvedValueOnce([]);
    prismaMock.bangDeXuat.findMany.mockResolvedValueOnce([]);

    // Dòng đầu rỗng hoàn toàn (không có id, nam, danh_hieu) — bỏ qua im lặng
    const buffer = await makeNienHanExcelBuffer([
      {},
      {
        id: 'qn-empty',
        ho_va_ten: 'Có Data',
        cap_bac: 'Đại uý',
        chuc_vu: 'Trợ lý',
        nam: 2024,
        thang: 12,
        danh_hieu: 'HCCSVV_HANG_BA',
        so_quyet_dinh: 'QD-EMPTY',
      },
    ]);

    const result = await tenureMedalService.previewImport(buffer);
    expect(result.total).toBe(1);
    expect(result.valid).toHaveLength(1);
    expect(result.errors).toHaveLength(0);
  });

  it('Duplicate trong cùng file (cùng id + danh_hieu) → row thứ 2 vào errors', async () => {
    const p1 = makePersonnel({
      id: 'qn-dup',
      ho_ten: 'Trùng Lặp',
      cap_bac: 'Đại uý',
      ngay_nhap_ngu: new Date('2010-01-01'),
    });
    prismaMock.fileQuyetDinh.findMany.mockResolvedValueOnce([{ so_quyet_dinh: 'QD-DUP' }]);
    prismaMock.quanNhan.findMany.mockResolvedValueOnce([{ ...p1, ChucVu: { ten_chuc_vu: 'Trợ lý' } }]);
    prismaMock.khenThuongHCCSVV.findMany.mockResolvedValueOnce([]);
    prismaMock.bangDeXuat.findMany.mockResolvedValueOnce([]);

    const row = {
      id: 'qn-dup',
      ho_va_ten: 'Trùng Lặp',
      cap_bac: 'Đại uý',
      chuc_vu: 'Trợ lý',
      nam: 2024,
      thang: 12,
      danh_hieu: 'HCCSVV_HANG_BA',
      so_quyet_dinh: 'QD-DUP',
    };
    const buffer = await makeNienHanExcelBuffer([row, { ...row }]);

    const result = await tenureMedalService.previewImport(buffer);
    expect(result.valid).toHaveLength(1);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].message).toContain('Trùng lặp trong file');
  });

  it('Tháng = 0 → errors "không hợp lệ"', async () => {
    const p1 = makePersonnel({
      id: 'qn-th0',
      ho_ten: 'Tháng Zero',
      cap_bac: 'Đại uý',
      ngay_nhap_ngu: new Date('2010-01-01'),
    });
    prismaMock.fileQuyetDinh.findMany.mockResolvedValueOnce([{ so_quyet_dinh: 'QD-T0' }]);
    prismaMock.quanNhan.findMany.mockResolvedValueOnce([{ ...p1, ChucVu: { ten_chuc_vu: 'Trợ lý' } }]);
    prismaMock.khenThuongHCCSVV.findMany.mockResolvedValueOnce([]);
    prismaMock.bangDeXuat.findMany.mockResolvedValueOnce([]);

    // thang=0 fail ở missingFields trước vì "0" falsy bị coi là thiếu
    const buffer = await makeNienHanExcelBuffer([
      {
        id: 'qn-th0',
        ho_va_ten: 'Tháng Zero',
        cap_bac: 'Đại uý',
        chuc_vu: 'Trợ lý',
        nam: 2024,
        thang: 0,
        danh_hieu: 'HCCSVV_HANG_BA',
        so_quyet_dinh: 'QD-T0',
      },
    ]);

    const result = await tenureMedalService.previewImport(buffer);
    expect(result.valid).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
    // 0 rơi vào nhánh missingFields falsy ("Thiếu Tháng"); 13 được test riêng
    expect(result.errors[0].message).toBe(IMPORT_NIEN_HAN_MISSING_FIELDS(['Tháng']));
  });

  it('Tháng = 13 → errors "không hợp lệ. Chỉ được nhập 1-12"', async () => {
    const p1 = makePersonnel({
      id: 'qn-th13',
      ho_ten: 'Tháng OOR',
      cap_bac: 'Đại uý',
      ngay_nhap_ngu: new Date('2010-01-01'),
    });
    prismaMock.fileQuyetDinh.findMany.mockResolvedValueOnce([{ so_quyet_dinh: 'QD-T13' }]);
    prismaMock.quanNhan.findMany.mockResolvedValueOnce([{ ...p1, ChucVu: { ten_chuc_vu: 'Trợ lý' } }]);
    prismaMock.khenThuongHCCSVV.findMany.mockResolvedValueOnce([]);
    prismaMock.bangDeXuat.findMany.mockResolvedValueOnce([]);

    const buffer = await makeNienHanExcelBuffer([
      {
        id: 'qn-th13',
        ho_va_ten: 'Tháng OOR',
        cap_bac: 'Đại uý',
        chuc_vu: 'Trợ lý',
        nam: 2024,
        thang: 13,
        danh_hieu: 'HCCSVV_HANG_BA',
        so_quyet_dinh: 'QD-T13',
      },
    ]);

    const result = await tenureMedalService.previewImport(buffer);
    expect(result.valid).toHaveLength(0);
    expect(result.errors[0].message).toContain('Chỉ được nhập 1-12');
  });

  it('Năm < 1900 → errors "không hợp lệ"', async () => {
    const p1 = makePersonnel({
      id: 'qn-y',
      ho_ten: 'Năm Cũ',
      cap_bac: 'Đại uý',
      ngay_nhap_ngu: new Date('2010-01-01'),
    });
    prismaMock.fileQuyetDinh.findMany.mockResolvedValueOnce([{ so_quyet_dinh: 'QD-Y' }]);
    prismaMock.quanNhan.findMany.mockResolvedValueOnce([{ ...p1, ChucVu: { ten_chuc_vu: 'Trợ lý' } }]);
    prismaMock.khenThuongHCCSVV.findMany.mockResolvedValueOnce([]);
    prismaMock.bangDeXuat.findMany.mockResolvedValueOnce([]);

    const buffer = await makeNienHanExcelBuffer([
      {
        id: 'qn-y',
        ho_va_ten: 'Năm Cũ',
        cap_bac: 'Đại uý',
        chuc_vu: 'Trợ lý',
        nam: 1899,
        thang: 12,
        danh_hieu: 'HCCSVV_HANG_BA',
        so_quyet_dinh: 'QD-Y',
      },
    ]);

    const result = await tenureMedalService.previewImport(buffer);
    expect(result.valid).toHaveLength(0);
    expect(result.errors[0].message).toContain('không hợp lệ');
  });

  it('Danh hiệu enum không hợp lệ → errors "không tồn tại"', async () => {
    const p1 = makePersonnel({
      id: 'qn-dh',
      ho_ten: 'Sai Danh Hiệu',
      cap_bac: 'Đại uý',
      ngay_nhap_ngu: new Date('2010-01-01'),
    });
    prismaMock.fileQuyetDinh.findMany.mockResolvedValueOnce([{ so_quyet_dinh: 'QD-DH' }]);
    prismaMock.quanNhan.findMany.mockResolvedValueOnce([{ ...p1, ChucVu: { ten_chuc_vu: 'Trợ lý' } }]);
    prismaMock.khenThuongHCCSVV.findMany.mockResolvedValueOnce([]);
    prismaMock.bangDeXuat.findMany.mockResolvedValueOnce([]);

    const buffer = await makeNienHanExcelBuffer([
      {
        id: 'qn-dh',
        ho_va_ten: 'Sai Danh Hiệu',
        cap_bac: 'Đại uý',
        chuc_vu: 'Trợ lý',
        nam: 2024,
        thang: 12,
        danh_hieu: 'HCCSVV_HANG_BON',
        so_quyet_dinh: 'QD-DH',
      },
    ]);

    const result = await tenureMedalService.previewImport(buffer);
    expect(result.valid).toHaveLength(0);
    expect(result.errors[0].message).toContain('không tồn tại');
  });

  it('Sheet name là "Danh hiệu hằng năm" → throw ValidationError "không phải HCCSVV"', async () => {
    // Tự tạo buffer với tên sheet hằng năm cá nhân để kích hoạt guard riêng
    const workbook = new ExcelJS.Workbook();
    const ws = workbook.addWorksheet('Danh hiệu hằng năm');
    ws.addRow([...HEADERS]);
    ws.addRow(['qn-x', 'X', 'Đại uý', 'Trợ lý', 2024, 12, 'HCCSVV_HANG_BA', 'QD-X', '']);
    const arr = await workbook.xlsx.writeBuffer();
    const buffer = Buffer.from(arr as ArrayBuffer);

    await expectError(tenureMedalService.previewImport(buffer), ValidationError, /không phải HCCSVV/);
  });

  it('Đúng 10.0 năm phục vụ cho HANG_BA → vào valid (boundary)', async () => {
    // Mốc tháng 11/2024; ngay_nhap_ngu = 2014-12-01 → ~119+ tháng. Dùng đầu năm.
    // Service dùng calculateServiceMonths với (nam, thang, 0) là cuối tháng.
    // Chọn mốc đơn giản: nhập ngũ 2014-11-01, mốc 2024-11-30 → đúng 120 tháng.
    const p1 = makePersonnel({
      id: 'qn-bound',
      ho_ten: 'Đúng Mốc',
      cap_bac: 'Đại uý',
      ngay_nhap_ngu: new Date('2014-11-01'),
    });
    prismaMock.fileQuyetDinh.findMany.mockResolvedValueOnce([{ so_quyet_dinh: 'QD-BD' }]);
    prismaMock.quanNhan.findMany.mockResolvedValueOnce([{ ...p1, ChucVu: { ten_chuc_vu: 'Trợ lý' } }]);
    prismaMock.khenThuongHCCSVV.findMany.mockResolvedValueOnce([]);
    prismaMock.bangDeXuat.findMany.mockResolvedValueOnce([]);

    const buffer = await makeNienHanExcelBuffer([
      {
        id: 'qn-bound',
        ho_va_ten: 'Đúng Mốc',
        cap_bac: 'Đại uý',
        chuc_vu: 'Trợ lý',
        nam: 2024,
        thang: 11,
        danh_hieu: 'HCCSVV_HANG_BA',
        so_quyet_dinh: 'QD-BD',
      },
    ]);

    const result = await tenureMedalService.previewImport(buffer);
    expect(result.valid).toHaveLength(1);
    expect(result.errors).toHaveLength(0);
  });

  it('Preview HCCSVV_HANG_NHI khi HANG_BA cùng năm → errors "phải sau năm"', async () => {
    const p1 = makePersonnel({
      id: 'qn-rk',
      ho_ten: 'Người Rank',
      cap_bac: 'Đại uý',
      ngay_nhap_ngu: new Date('2000-01-01'),
    });
    prismaMock.fileQuyetDinh.findMany.mockResolvedValueOnce([{ so_quyet_dinh: 'QD-RK' }]);
    prismaMock.quanNhan.findMany.mockResolvedValueOnce([{ ...p1, ChucVu: { ten_chuc_vu: 'Trợ lý' } }]);
    prismaMock.khenThuongHCCSVV.findMany.mockResolvedValueOnce([
      { quan_nhan_id: 'qn-rk', danh_hieu: DANH_HIEU_HCCSVV.HANG_BA, nam: 2024, so_quyet_dinh: 'QD-OLD' },
    ]);
    prismaMock.bangDeXuat.findMany.mockResolvedValueOnce([]);

    const buffer = await makeNienHanExcelBuffer([
      {
        id: 'qn-rk',
        ho_va_ten: 'Người Rank',
        cap_bac: 'Đại uý',
        chuc_vu: 'Trợ lý',
        nam: 2024,
        thang: 12,
        danh_hieu: 'HCCSVV_HANG_NHI',
        so_quyet_dinh: 'QD-RK',
      },
    ]);

    const result = await tenureMedalService.previewImport(buffer);
    expect(result.valid).toHaveLength(0);
    expect(result.errors[0].message).toContain('phải sau năm nhận Huy chương Chiến sĩ vẻ vang hạng Ba');
  });
});

describe('tenureMedal.service - confirmImport', () => {
  it('Confirm với 1 valid item → upsert đúng args', async () => {
    prismaMock.bangDeXuat.findMany.mockResolvedValueOnce([]);
    prismaMock.khenThuongHCCSVV.findMany.mockResolvedValueOnce([]);
    prismaMock.khenThuongHCCSVV.upsert.mockResolvedValueOnce({ id: 'hccsvv-1' });

    const result = await tenureMedalService.confirmImport(
      [
        {
          row: 2,
          personnel_id: 'qn-1',
          ho_ten: 'Nguyễn Văn A',
          cap_bac: 'Đại uý',
          chuc_vu: 'Trợ lý',
          nam: 2024,
          thang: 12,
          danh_hieu: DANH_HIEU_HCCSVV.HANG_BA,
          so_quyet_dinh: 'QD-001',
          ghi_chu: null,
          history: [],
        },
      ],
      'admin-1'
    );

    expect(result.imported).toBe(1);
    expect(prismaMock.khenThuongHCCSVV.upsert).toHaveBeenCalledTimes(1);
    const call = prismaMock.khenThuongHCCSVV.upsert.mock.calls[0][0];
    expect(call.where).toEqual({
      quan_nhan_id_danh_hieu: { quan_nhan_id: 'qn-1', danh_hieu: DANH_HIEU_HCCSVV.HANG_BA },
    });
    expect(call.create).toMatchObject({
      quan_nhan_id: 'qn-1',
      danh_hieu: DANH_HIEU_HCCSVV.HANG_BA,
      nam: 2024,
      thang: 12,
      so_quyet_dinh: 'QD-001',
    });
  });

  it('Confirm khi DB đã có hạng cao hơn → throw ValidationError "không thể import"', async () => {
    prismaMock.bangDeXuat.findMany.mockResolvedValueOnce([]);
    prismaMock.khenThuongHCCSVV.findMany.mockResolvedValueOnce([
      { quan_nhan_id: 'qn-1', danh_hieu: DANH_HIEU_HCCSVV.HANG_NHAT },
    ]);

    await expectError(
      tenureMedalService.confirmImport(
        [
          {
            row: 2,
            personnel_id: 'qn-1',
            ho_ten: 'Nguyễn Văn A',
            cap_bac: 'Đại uý',
            chuc_vu: 'Trợ lý',
            nam: 2024,
            thang: 12,
            danh_hieu: DANH_HIEU_HCCSVV.HANG_BA,
            so_quyet_dinh: 'QD-001',
            ghi_chu: null,
            history: [],
          },
        ],
        'admin-1'
      ),
      ValidationError,
      { startsWith: 'Nguyễn Văn A: đã có' }
    );
    expect(prismaMock.khenThuongHCCSVV.upsert).not.toHaveBeenCalled();
  });

  it('Confirm HCCSVV_HANG_NHAT đầy đủ tuần tự → success', async () => {
    prismaMock.bangDeXuat.findMany.mockResolvedValueOnce([]);
    prismaMock.khenThuongHCCSVV.findMany.mockResolvedValueOnce([
      { quan_nhan_id: 'qn-rk', danh_hieu: DANH_HIEU_HCCSVV.HANG_BA, nam: 2010 },
      { quan_nhan_id: 'qn-rk', danh_hieu: DANH_HIEU_HCCSVV.HANG_NHI, nam: 2018 },
    ]);
    prismaMock.khenThuongHCCSVV.upsert.mockResolvedValueOnce({ id: 'hccsvv-rk' });

    const result = await tenureMedalService.confirmImport(
      [
        {
          row: 2,
          personnel_id: 'qn-rk',
          ho_ten: 'Người Rank',
          cap_bac: 'Đại uý',
          chuc_vu: 'Trợ lý',
          nam: 2025,
          thang: 6,
          danh_hieu: DANH_HIEU_HCCSVV.HANG_NHAT,
          so_quyet_dinh: 'QD-RK',
          ghi_chu: null,
          history: [],
        },
      ],
      'admin-1'
    );

    expect(result.imported).toBe(1);
    expect(prismaMock.khenThuongHCCSVV.upsert).toHaveBeenCalledTimes(1);
  });

  it('Confirm HCCSVV_HANG_NHI khi HANG_BA cùng năm → reject "phải sau năm"', async () => {
    prismaMock.bangDeXuat.findMany.mockResolvedValueOnce([]);
    prismaMock.khenThuongHCCSVV.findMany.mockResolvedValueOnce([
      { quan_nhan_id: 'qn-rk', danh_hieu: DANH_HIEU_HCCSVV.HANG_BA, nam: 2024 },
    ]);

    await expectError(
      tenureMedalService.confirmImport(
        [
          {
            row: 2,
            personnel_id: 'qn-rk',
            ho_ten: 'Người Rank',
            cap_bac: 'Đại uý',
            chuc_vu: 'Trợ lý',
            nam: 2024,
            thang: 6,
            danh_hieu: DANH_HIEU_HCCSVV.HANG_NHI,
            so_quyet_dinh: 'QD-RK',
            ghi_chu: null,
            history: [],
          },
        ],
        'admin-1'
      ),
      ValidationError,
      /phải sau năm nhận Huy chương Chiến sĩ vẻ vang hạng Ba/
    );
    expect(prismaMock.khenThuongHCCSVV.upsert).not.toHaveBeenCalled();
  });
});
