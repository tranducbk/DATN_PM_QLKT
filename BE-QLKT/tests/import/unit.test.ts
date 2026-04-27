import ExcelJS from 'exceljs';
import { prismaMock, resetPrismaMock } from '../helpers/prismaMock';
import { makeUnit } from '../helpers/fixtures';
import { expectError } from '../helpers/errorAssert';
import unitAnnualAwardService from '../../src/services/unitAnnualAward.service';
import { ValidationError } from '../../src/middlewares/errorHandler';
import {
  DANH_HIEU_DON_VI_HANG_NAM,
  getDanhHieuName,
} from '../../src/constants/danhHieu.constants';
import { missingDecisionNumberMessage } from '../helpers/errorMessages';

interface DonViRow {
  id?: string;
  ma_don_vi?: string;
  ten_don_vi?: string;
  nam?: number | string | null;
  danh_hieu?: string;
  so_quyet_dinh?: string;
  ghi_chu?: string;
  nhan_bkbqp?: string;
  nhan_bkttcp?: string;
}

const HEADERS = [
  'id',
  'ma_don_vi',
  'ten_don_vi',
  'nam',
  'danh_hieu',
  'so_quyet_dinh',
  'ghi_chu',
  'nhan_bkbqp',
  'nhan_bkttcp',
] as const;

async function makeDonViExcelBuffer(rows: DonViRow[]): Promise<Buffer> {
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

describe('unitAnnualAward.service - previewImport', () => {
  it('Excel hợp lệ với 1 row ĐVQT (CQDV) → trả 1 valid item', async () => {
    const cqdv = makeUnit({ kind: 'CQDV', id: 'cqdv-1', ma_don_vi: 'CQDV01', ten_don_vi: 'Cơ quan A' });
    prismaMock.fileQuyetDinh.findMany.mockResolvedValueOnce([{ so_quyet_dinh: 'QD-001' }]);
    prismaMock.coQuanDonVi.findMany.mockResolvedValueOnce([
      { id: cqdv.id, ma_don_vi: cqdv.ma_don_vi, ten_don_vi: cqdv.ten_don_vi },
    ]);
    prismaMock.donViTrucThuoc.findMany.mockResolvedValueOnce([]);
    prismaMock.danhHieuDonViHangNam.findMany.mockResolvedValueOnce([]);

    const buffer = await makeDonViExcelBuffer([
      { ma_don_vi: 'CQDV01', ten_don_vi: 'Cơ quan A', nam: 2024, danh_hieu: 'ĐVQT', so_quyet_dinh: 'QD-001' },
    ]);

    const result = await unitAnnualAwardService.previewImport(buffer);

    expect(result.total).toBe(1);
    expect(result.valid).toHaveLength(1);
    expect(result.errors).toHaveLength(0);
    expect(result.valid[0]).toMatchObject({
      unit_id: 'cqdv-1',
      is_co_quan_don_vi: true,
      ma_don_vi: 'CQDV01',
      nam: 2024,
      danh_hieu: 'ĐVQT',
      so_quyet_dinh: 'QD-001',
    });
  });

  it('Excel hợp lệ với 1 row DVTT → set is_co_quan_don_vi=false', async () => {
    prismaMock.fileQuyetDinh.findMany.mockResolvedValueOnce([{ so_quyet_dinh: 'QD-002' }]);
    prismaMock.coQuanDonVi.findMany.mockResolvedValueOnce([]);
    prismaMock.donViTrucThuoc.findMany.mockResolvedValueOnce([
      { id: 'dvtt-1', ma_don_vi: 'DVTT01', ten_don_vi: 'Đơn vị trực thuộc B', co_quan_don_vi_id: 'cqdv-parent' },
    ]);
    prismaMock.danhHieuDonViHangNam.findMany.mockResolvedValueOnce([]);

    const buffer = await makeDonViExcelBuffer([
      { ma_don_vi: 'DVTT01', ten_don_vi: 'Đơn vị trực thuộc B', nam: 2024, danh_hieu: 'ĐVTT', so_quyet_dinh: 'QD-002' },
    ]);

    const result = await unitAnnualAwardService.previewImport(buffer);

    expect(result.valid).toHaveLength(1);
    expect(result.valid[0]).toMatchObject({
      unit_id: 'dvtt-1',
      is_co_quan_don_vi: false,
      ma_don_vi: 'DVTT01',
      danh_hieu: 'ĐVTT',
    });
  });

  it('Mã đơn vị không tồn tại → errors "Không tìm thấy đơn vị"', async () => {
    prismaMock.fileQuyetDinh.findMany.mockResolvedValueOnce([{ so_quyet_dinh: 'QD-001' }]);
    prismaMock.coQuanDonVi.findMany.mockResolvedValueOnce([]);
    prismaMock.donViTrucThuoc.findMany.mockResolvedValueOnce([]);
    prismaMock.danhHieuDonViHangNam.findMany.mockResolvedValueOnce([]);

    const buffer = await makeDonViExcelBuffer([
      { ma_don_vi: 'KHONG-CO', ten_don_vi: 'X', nam: 2024, danh_hieu: 'ĐVQT', so_quyet_dinh: 'QD-001' },
    ]);

    const result = await unitAnnualAwardService.previewImport(buffer);

    expect(result.valid).toHaveLength(0);
    expect(result.errors[0].message).toContain('Không tìm thấy đơn vị');
  });

  it('Thiếu năm → errors "Thiếu Năm"', async () => {
    prismaMock.fileQuyetDinh.findMany.mockResolvedValueOnce([{ so_quyet_dinh: 'QD-001' }]);
    prismaMock.coQuanDonVi.findMany.mockResolvedValueOnce([
      { id: 'cqdv-1', ma_don_vi: 'CQDV01', ten_don_vi: 'Cơ quan A' },
    ]);
    prismaMock.donViTrucThuoc.findMany.mockResolvedValueOnce([]);
    prismaMock.danhHieuDonViHangNam.findMany.mockResolvedValueOnce([]);

    const buffer = await makeDonViExcelBuffer([
      { ma_don_vi: 'CQDV01', ten_don_vi: 'Cơ quan A', danh_hieu: 'ĐVQT', so_quyet_dinh: 'QD-001' },
    ]);

    const result = await unitAnnualAwardService.previewImport(buffer);

    expect(result.valid).toHaveLength(0);
    expect(result.errors[0].message).toBe('Thiếu Năm');
  });

  it('Trùng năm-danh hiệu trong DB → errors "Đã có danh hiệu"', async () => {
    prismaMock.fileQuyetDinh.findMany.mockResolvedValueOnce([{ so_quyet_dinh: 'QD-001' }]);
    prismaMock.coQuanDonVi.findMany.mockResolvedValueOnce([
      { id: 'cqdv-1', ma_don_vi: 'CQDV01', ten_don_vi: 'Cơ quan A' },
    ]);
    prismaMock.donViTrucThuoc.findMany.mockResolvedValueOnce([]);
    prismaMock.danhHieuDonViHangNam.findMany.mockResolvedValueOnce([
      {
        co_quan_don_vi_id: 'cqdv-1',
        don_vi_truc_thuoc_id: null,
        nam: 2024,
        danh_hieu: DANH_HIEU_DON_VI_HANG_NAM.DVQT,
        nhan_bkbqp: false,
        nhan_bkttcp: false,
        so_quyet_dinh: 'QD-OLD',
      },
    ]);

    const buffer = await makeDonViExcelBuffer([
      { ma_don_vi: 'CQDV01', ten_don_vi: 'Cơ quan A', nam: 2024, danh_hieu: 'ĐVTT', so_quyet_dinh: 'QD-001' },
    ]);

    const result = await unitAnnualAwardService.previewImport(buffer);

    expect(result.valid).toHaveLength(0);
    expect(result.errors[0].message).toBe(
      `Đã có danh hiệu ${DANH_HIEU_DON_VI_HANG_NAM.DVQT} năm 2024 trên hệ thống`
    );
  });

  it('Row trống hoàn toàn → bỏ qua, không tính total/errors', async () => {
    prismaMock.fileQuyetDinh.findMany.mockResolvedValueOnce([{ so_quyet_dinh: 'QD-001' }]);
    prismaMock.coQuanDonVi.findMany.mockResolvedValueOnce([
      { id: 'cqdv-1', ma_don_vi: 'CQDV01', ten_don_vi: 'Cơ quan A' },
    ]);
    prismaMock.donViTrucThuoc.findMany.mockResolvedValueOnce([]);
    prismaMock.danhHieuDonViHangNam.findMany.mockResolvedValueOnce([]);

    const buffer = await makeDonViExcelBuffer([
      { ma_don_vi: '', ten_don_vi: '', nam: '', danh_hieu: '', so_quyet_dinh: '' },
      { ma_don_vi: 'CQDV01', ten_don_vi: 'Cơ quan A', nam: 2024, danh_hieu: 'ĐVQT', so_quyet_dinh: 'QD-001' },
    ]);

    const result = await unitAnnualAwardService.previewImport(buffer);

    expect(result.total).toBe(1);
    expect(result.valid).toHaveLength(1);
    expect(result.errors).toHaveLength(0);
  });

  it('Duplicate trong file (cùng đơn vị + năm) → row sau báo "Trùng lặp trong file"', async () => {
    prismaMock.fileQuyetDinh.findMany.mockResolvedValueOnce([
      { so_quyet_dinh: 'QD-001' },
      { so_quyet_dinh: 'QD-002' },
    ]);
    prismaMock.coQuanDonVi.findMany.mockResolvedValueOnce([
      { id: 'cqdv-1', ma_don_vi: 'CQDV01', ten_don_vi: 'Cơ quan A' },
    ]);
    prismaMock.donViTrucThuoc.findMany.mockResolvedValueOnce([]);
    prismaMock.danhHieuDonViHangNam.findMany.mockResolvedValueOnce([]);

    const buffer = await makeDonViExcelBuffer([
      { ma_don_vi: 'CQDV01', ten_don_vi: 'Cơ quan A', nam: 2024, danh_hieu: 'ĐVQT', so_quyet_dinh: 'QD-001' },
      { ma_don_vi: 'CQDV01', ten_don_vi: 'Cơ quan A', nam: 2024, danh_hieu: 'ĐVTT', so_quyet_dinh: 'QD-002' },
    ]);

    const result = await unitAnnualAwardService.previewImport(buffer);

    expect(result.valid).toHaveLength(1);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].message).toContain('Trùng lặp trong file');
  });

  it('Năm < 1900 → errors về boundary', async () => {
    prismaMock.fileQuyetDinh.findMany.mockResolvedValueOnce([{ so_quyet_dinh: 'QD-001' }]);
    prismaMock.coQuanDonVi.findMany.mockResolvedValueOnce([
      { id: 'cqdv-1', ma_don_vi: 'CQDV01', ten_don_vi: 'Cơ quan A' },
    ]);
    prismaMock.donViTrucThuoc.findMany.mockResolvedValueOnce([]);
    prismaMock.danhHieuDonViHangNam.findMany.mockResolvedValueOnce([]);

    const buffer = await makeDonViExcelBuffer([
      { ma_don_vi: 'CQDV01', ten_don_vi: 'Cơ quan A', nam: 1800, danh_hieu: 'ĐVQT', so_quyet_dinh: 'QD-001' },
    ]);

    const result = await unitAnnualAwardService.previewImport(buffer);

    expect(result.valid).toHaveLength(0);
    expect(result.errors[0].message).toContain('không hợp lệ');
  });

  it('Năm tương lai → errors về boundary', async () => {
    const futureYear = new Date().getFullYear() + 5;
    prismaMock.fileQuyetDinh.findMany.mockResolvedValueOnce([{ so_quyet_dinh: 'QD-001' }]);
    prismaMock.coQuanDonVi.findMany.mockResolvedValueOnce([
      { id: 'cqdv-1', ma_don_vi: 'CQDV01', ten_don_vi: 'Cơ quan A' },
    ]);
    prismaMock.donViTrucThuoc.findMany.mockResolvedValueOnce([]);
    prismaMock.danhHieuDonViHangNam.findMany.mockResolvedValueOnce([]);

    const buffer = await makeDonViExcelBuffer([
      { ma_don_vi: 'CQDV01', ten_don_vi: 'Cơ quan A', nam: futureYear, danh_hieu: 'ĐVQT', so_quyet_dinh: 'QD-001' },
    ]);

    const result = await unitAnnualAwardService.previewImport(buffer);

    expect(result.valid).toHaveLength(0);
    expect(result.errors[0].message).toContain('không hợp lệ');
  });

  it('Danh hiệu enum không hợp lệ → errors "không hợp lệ"', async () => {
    prismaMock.fileQuyetDinh.findMany.mockResolvedValueOnce([{ so_quyet_dinh: 'QD-001' }]);
    prismaMock.coQuanDonVi.findMany.mockResolvedValueOnce([
      { id: 'cqdv-1', ma_don_vi: 'CQDV01', ten_don_vi: 'Cơ quan A' },
    ]);
    prismaMock.donViTrucThuoc.findMany.mockResolvedValueOnce([]);
    prismaMock.danhHieuDonViHangNam.findMany.mockResolvedValueOnce([]);

    const buffer = await makeDonViExcelBuffer([
      { ma_don_vi: 'CQDV01', ten_don_vi: 'Cơ quan A', nam: 2024, danh_hieu: 'KHONG_TON_TAI', so_quyet_dinh: 'QD-001' },
    ]);

    const result = await unitAnnualAwardService.previewImport(buffer);

    expect(result.valid).toHaveLength(0);
    expect(result.errors[0].message).toContain('không hợp lệ');
  });

  it('Số quyết định không tồn tại trên hệ thống → errors', async () => {
    // Empty decisions → submitted decision number is unknown
    prismaMock.fileQuyetDinh.findMany.mockResolvedValueOnce([]);
    prismaMock.coQuanDonVi.findMany.mockResolvedValueOnce([
      { id: 'cqdv-1', ma_don_vi: 'CQDV01', ten_don_vi: 'Cơ quan A' },
    ]);
    prismaMock.donViTrucThuoc.findMany.mockResolvedValueOnce([]);
    prismaMock.danhHieuDonViHangNam.findMany.mockResolvedValueOnce([]);

    const buffer = await makeDonViExcelBuffer([
      { ma_don_vi: 'CQDV01', ten_don_vi: 'Cơ quan A', nam: 2024, danh_hieu: 'ĐVQT', so_quyet_dinh: 'QD-INVALID' },
    ]);

    const result = await unitAnnualAwardService.previewImport(buffer);

    expect(result.valid).toHaveLength(0);
    expect(result.errors[0].message).toContain('không tồn tại trên hệ thống');
  });

  it('BKBQP trong Excel → reject "không được nhập qua Excel"', async () => {
    prismaMock.fileQuyetDinh.findMany.mockResolvedValueOnce([{ so_quyet_dinh: 'QD-001' }]);
    prismaMock.coQuanDonVi.findMany.mockResolvedValueOnce([
      { id: 'cqdv-1', ma_don_vi: 'CQDV01', ten_don_vi: 'Cơ quan A' },
    ]);
    prismaMock.donViTrucThuoc.findMany.mockResolvedValueOnce([]);
    prismaMock.danhHieuDonViHangNam.findMany.mockResolvedValueOnce([]);

    const buffer = await makeDonViExcelBuffer([
      {
        ma_don_vi: 'CQDV01',
        ten_don_vi: 'Cơ quan A',
        nam: 2024,
        danh_hieu: 'ĐVQT',
        so_quyet_dinh: 'QD-001',
        nhan_bkbqp: 'có',
      },
    ]);

    const result = await unitAnnualAwardService.previewImport(buffer);

    expect(result.valid).toHaveLength(0);
    expect(result.errors[0].message).toBe(
      'BKBQP không được nhập qua Excel. Vui lòng chỉ thêm trên giao diện.'
    );
  });
});

describe('unitAnnualAward.service - confirmImport', () => {
  it('Confirm valid CQDV → upsert tạo record với co_quan_don_vi_id', async () => {
    prismaMock.danhHieuDonViHangNam.findMany.mockResolvedValueOnce([]);
    prismaMock.bangDeXuat.findMany.mockResolvedValueOnce([]);
    prismaMock.danhHieuDonViHangNam.upsert.mockResolvedValueOnce({ id: 'dhdv-1' });

    const result = await unitAnnualAwardService.confirmImport(
      [
        {
          row: 2,
          unit_id: 'cqdv-1',
          is_co_quan_don_vi: true,
          ma_don_vi: 'CQDV01',
          ten_don_vi: 'Cơ quan A',
          nam: 2024,
          danh_hieu: DANH_HIEU_DON_VI_HANG_NAM.DVQT,
          so_quyet_dinh: 'QD-001',
          ghi_chu: null,
          history: [],
        },
      ],
      'admin-1'
    );

    expect(result.imported).toBe(1);
    expect(prismaMock.danhHieuDonViHangNam.upsert).toHaveBeenCalledTimes(1);
    const call = prismaMock.danhHieuDonViHangNam.upsert.mock.calls[0][0];
    expect(call.where).toEqual({
      unique_co_quan_don_vi_nam_dh: { co_quan_don_vi_id: 'cqdv-1', nam: 2024 },
    });
    expect(call.create).toMatchObject({
      co_quan_don_vi_id: 'cqdv-1',
      nam: 2024,
      danh_hieu: DANH_HIEU_DON_VI_HANG_NAM.DVQT,
      so_quyet_dinh: 'QD-001',
      nguoi_tao_id: 'admin-1',
    });
    expect(call.create.don_vi_truc_thuoc_id).toBeUndefined();
  });

  it('Confirm valid DVTT → upsert với don_vi_truc_thuoc_id, không co_quan_don_vi_id', async () => {
    prismaMock.danhHieuDonViHangNam.findMany.mockResolvedValueOnce([]);
    prismaMock.bangDeXuat.findMany.mockResolvedValueOnce([]);
    prismaMock.danhHieuDonViHangNam.upsert.mockResolvedValueOnce({ id: 'dhdv-2' });

    await unitAnnualAwardService.confirmImport(
      [
        {
          row: 2,
          unit_id: 'dvtt-1',
          is_co_quan_don_vi: false,
          ma_don_vi: 'DVTT01',
          ten_don_vi: 'Đơn vị B',
          nam: 2024,
          danh_hieu: DANH_HIEU_DON_VI_HANG_NAM.DVTT,
          so_quyet_dinh: 'QD-002',
          ghi_chu: null,
          history: [],
        },
      ],
      'admin-1'
    );

    const call = prismaMock.danhHieuDonViHangNam.upsert.mock.calls[0][0];
    expect(call.where).toEqual({
      unique_don_vi_truc_thuoc_nam_dh: { don_vi_truc_thuoc_id: 'dvtt-1', nam: 2024 },
    });
    expect(call.create.don_vi_truc_thuoc_id).toBe('dvtt-1');
    expect(call.create.co_quan_don_vi_id).toBeUndefined();
  });

  it('Confirm với pending proposal conflict → throw ValidationError', async () => {
    prismaMock.danhHieuDonViHangNam.findMany.mockResolvedValueOnce([]);
    prismaMock.bangDeXuat.findMany.mockResolvedValueOnce([
      {
        id: 'prop-1',
        nam: 2024,
        data_danh_hieu: [{ don_vi_id: 'cqdv-1', danh_hieu: DANH_HIEU_DON_VI_HANG_NAM.DVQT }],
      },
    ]);

    await expectError(
      unitAnnualAwardService.confirmImport(
        [
          {
            row: 2,
            unit_id: 'cqdv-1',
            is_co_quan_don_vi: true,
            ma_don_vi: 'CQDV01',
            ten_don_vi: 'Cơ quan A',
            nam: 2024,
            danh_hieu: DANH_HIEU_DON_VI_HANG_NAM.DVQT,
            so_quyet_dinh: 'QD-001',
            ghi_chu: null,
            history: [],
          },
        ],
        'admin-1'
      ),
      ValidationError,
      'Đơn vị đã có đề xuất danh hiệu Đơn vị quyết thắng cho năm 2024'
    );
    expect(prismaMock.danhHieuDonViHangNam.upsert).not.toHaveBeenCalled();
  });

  it('Confirm với DB đã có danh hiệu khác → throw ValidationError "không thể thêm"', async () => {
    prismaMock.danhHieuDonViHangNam.findMany.mockResolvedValueOnce([
      {
        co_quan_don_vi_id: 'cqdv-1',
        don_vi_truc_thuoc_id: null,
        nam: 2024,
        danh_hieu: DANH_HIEU_DON_VI_HANG_NAM.DVQT,
        nhan_bkbqp: false,
        nhan_bkttcp: false,
      },
    ]);
    prismaMock.bangDeXuat.findMany.mockResolvedValueOnce([]);

    await expectError(
      unitAnnualAwardService.confirmImport(
        [
          {
            row: 2,
            unit_id: 'cqdv-1',
            is_co_quan_don_vi: true,
            ma_don_vi: 'CQDV01',
            ten_don_vi: 'Cơ quan A',
            nam: 2024,
            danh_hieu: DANH_HIEU_DON_VI_HANG_NAM.DVTT,
            so_quyet_dinh: 'QD-001',
            ghi_chu: null,
            history: [],
          },
        ],
        'admin-1'
      ),
      ValidationError,
      'Đơn vị đã có danh hiệu Đơn vị quyết thắng năm 2024, không thể thêm Đơn vị tiên tiến'
    );
  });

  it('Confirm row ĐVQT thiếu so_quyet_dinh → throw ValidationError missing decision', async () => {
    prismaMock.danhHieuDonViHangNam.findMany.mockResolvedValueOnce([]);
    prismaMock.bangDeXuat.findMany.mockResolvedValueOnce([]);

    await expectError(
      unitAnnualAwardService.confirmImport(
        [
          {
            row: 2,
            unit_id: 'cqdv-no-qd',
            is_co_quan_don_vi: true,
            ma_don_vi: 'CQDV01',
            ten_don_vi: 'Cơ quan A',
            nam: 2024,
            danh_hieu: DANH_HIEU_DON_VI_HANG_NAM.DVQT,
            so_quyet_dinh: null as any,
            ghi_chu: null,
            history: [],
          },
        ],
        'admin-1'
      ),
      ValidationError,
      missingDecisionNumberMessage('Cơ quan A', getDanhHieuName(DANH_HIEU_DON_VI_HANG_NAM.DVQT))
    );
    expect(prismaMock.danhHieuDonViHangNam.upsert).not.toHaveBeenCalled();
  });

  it('Confirm rỗng → imported: 0', async () => {
    prismaMock.danhHieuDonViHangNam.findMany.mockResolvedValueOnce([]);
    prismaMock.bangDeXuat.findMany.mockResolvedValueOnce([]);

    const result = await unitAnnualAwardService.confirmImport([], 'admin-1');

    expect(result.imported).toBe(0);
    expect(prismaMock.danhHieuDonViHangNam.upsert).not.toHaveBeenCalled();
  });
});
