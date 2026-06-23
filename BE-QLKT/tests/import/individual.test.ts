import ExcelJS from 'exceljs';
import { prismaMock } from '../helpers/prismaMock';
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

describe('Nhập Excel danh hiệu cá nhân hằng năm: xem trước (preview)', () => {
  it('Nhập Excel cá nhân hằng năm: 3 dòng CSTDCS hợp lệ → cả 3 vào danh sách hợp lệ, không có lỗi', async () => {
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
      { id: 'qn-1', ho_va_ten: 'Nguyễn Văn A', nam: 2024, danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.CSTDCS, so_quyet_dinh: 'QD-001', cap_bac: 'Đại uý', chuc_vu: 'Trợ lý' },
      { id: 'qn-2', ho_va_ten: 'Nguyễn Văn B', nam: 2024, danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.CSTDCS, so_quyet_dinh: 'QD-002', cap_bac: 'Đại uý', chuc_vu: 'Trợ lý' },
      { id: 'qn-3', ho_va_ten: 'Nguyễn Văn C', nam: 2024, danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.CSTDCS, so_quyet_dinh: 'QD-003', cap_bac: 'Đại uý', chuc_vu: 'Trợ lý' },
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
      danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.CSTDCS,
      so_quyet_dinh: 'QD-001',
    });
  });

  it('Nhập Excel cá nhân hằng năm: dòng thiếu năm → báo lỗi "Thiếu năm"', async () => {
    const p1 = makePersonnel({ id: 'qn-1', ho_ten: 'Nguyễn Văn A' });
    prismaMock.quanNhan.findMany.mockResolvedValueOnce([p1]);
    prismaMock.danhHieuHangNam.findMany.mockResolvedValueOnce([]);
    prismaMock.bangDeXuat.findMany.mockResolvedValueOnce([]);
    prismaMock.fileQuyetDinh.findMany.mockResolvedValueOnce([{ so_quyet_dinh: 'QD-001' }]);

    const buffer = await makeCaNhanExcelBuffer([
      { id: 'qn-1', ho_va_ten: 'Nguyễn Văn A', danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.CSTDCS, so_quyet_dinh: 'QD-001' },
    ]);

    const result = await annualRewardService.previewImport(buffer);

    expect(result.valid).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].message).toBe('Thiếu năm');
  });

  it('Nhập Excel cá nhân hằng năm: dòng có mã quân nhân nhưng bỏ trống danh hiệu → báo "không có danh hiệu nào được điền"', async () => {
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

  it('Nhập Excel cá nhân hằng năm: mã quân nhân không có trong hệ thống → báo lỗi "Không tìm thấy quân nhân"', async () => {
    // Given: personnelMap is empty so any ID lookup fails
    prismaMock.quanNhan.findMany.mockResolvedValueOnce([]);
    prismaMock.danhHieuHangNam.findMany.mockResolvedValueOnce([]);
    prismaMock.bangDeXuat.findMany.mockResolvedValueOnce([]);
    prismaMock.fileQuyetDinh.findMany.mockResolvedValueOnce([{ so_quyet_dinh: 'QD-001' }]);

    const buffer = await makeCaNhanExcelBuffer([
      { id: 'qn-missing', ho_va_ten: 'Ai Đó', nam: 2024, danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.CSTDCS, so_quyet_dinh: 'QD-001' },
    ]);

    const result = await annualRewardService.previewImport(buffer);

    expect(result.valid).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].message).toContain('Không tìm thấy quân nhân');
  });

  it('Nhập Excel cá nhân hằng năm: tên trong file khác tên trong hệ thống → báo lỗi không khớp', async () => {
    const p1 = makePersonnel({ id: 'qn-1', ho_ten: 'Nguyễn Văn Đúng' });
    prismaMock.quanNhan.findMany.mockResolvedValueOnce([p1]);
    prismaMock.danhHieuHangNam.findMany.mockResolvedValueOnce([]);
    prismaMock.bangDeXuat.findMany.mockResolvedValueOnce([]);
    prismaMock.fileQuyetDinh.findMany.mockResolvedValueOnce([{ so_quyet_dinh: 'QD-001' }]);

    const buffer = await makeCaNhanExcelBuffer([
      { id: 'qn-1', ho_va_ten: 'Tên Sai Khác', nam: 2024, danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.CSTDCS, so_quyet_dinh: 'QD-001' },
    ]);

    const result = await annualRewardService.previewImport(buffer);

    expect(result.valid).toHaveLength(0);
    expect(result.errors[0].message).toContain('không khớp với tên trong hệ thống');
  });

  it('Nhập Excel cá nhân hằng năm: đã có cùng danh hiệu cùng năm trên hệ thống → báo lỗi "Đã có"', async () => {
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
      { id: 'qn-1', ho_va_ten: 'Nguyễn Văn A', nam: 2024, danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.CSTDCS, so_quyet_dinh: 'QD-001' },
    ]);

    const result = await annualRewardService.previewImport(buffer);

    expect(result.valid).toHaveLength(0);
    expect(result.errors[0].message).toBe('Đã có Chiến sĩ thi đua cơ sở cho năm 2024.');
  });

  it('Nhập Excel cá nhân hằng năm: khai BKBQP trong file → từ chối "không import qua Excel"', async () => {
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
        danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.CSTDCS,
        so_quyet_dinh: 'QD-001',
        nhan_bkbqp: 'có',
      },
    ]);

    const result = await annualRewardService.previewImport(buffer);

    expect(result.valid).toHaveLength(0);
    expect(result.errors[0].message).toContain('không import qua Excel');
  });

  it('Nhập Excel cá nhân hằng năm: đang có đề xuất chờ duyệt cùng năm → báo lỗi "đang có đề xuất"', async () => {
    const p1 = makePersonnel({ id: 'qn-1', ho_ten: 'Nguyễn Văn A' });
    prismaMock.quanNhan.findMany.mockResolvedValueOnce([p1]);
    prismaMock.danhHieuHangNam.findMany.mockResolvedValueOnce([]);
    prismaMock.bangDeXuat.findMany.mockResolvedValueOnce([
      {
        id: 'prop-1',
        nam: 2024,
        data_danh_hieu: [{ personnel_id: 'qn-1', danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.CSTDCS }],
      },
    ]);
    prismaMock.fileQuyetDinh.findMany.mockResolvedValueOnce([{ so_quyet_dinh: 'QD-001' }]);

    const buffer = await makeCaNhanExcelBuffer([
      { id: 'qn-1', ho_va_ten: 'Nguyễn Văn A', nam: 2024, danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.CSTDCS, so_quyet_dinh: 'QD-001' },
    ]);

    const result = await annualRewardService.previewImport(buffer);

    expect(result.valid).toHaveLength(0);
    expect(result.errors[0].message).toBe(
      'Quân nhân đang có đề xuất khen thưởng năm 2024 chờ duyệt'
    );
  });

  it('Nhập Excel cá nhân hằng năm: dòng trống hoàn toàn → bỏ qua, không tính vào tổng lẫn lỗi', async () => {
    // Empty rows with no id/nam/danh_hieu are skipped silently (continue)
    const p1 = makePersonnel({ id: 'qn-1', ho_ten: 'Nguyễn Văn A' });
    prismaMock.quanNhan.findMany.mockResolvedValueOnce([p1]);
    prismaMock.danhHieuHangNam.findMany.mockResolvedValueOnce([]);
    prismaMock.bangDeXuat.findMany.mockResolvedValueOnce([]);
    prismaMock.fileQuyetDinh.findMany.mockResolvedValueOnce([{ so_quyet_dinh: 'QD-001' }]);

    const buffer = await makeCaNhanExcelBuffer([
      { id: '', ho_va_ten: '', nam: '', danh_hieu: '', so_quyet_dinh: '' },
      { id: 'qn-1', ho_va_ten: 'Nguyễn Văn A', nam: 2024, danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.CSTDCS, so_quyet_dinh: 'QD-001', cap_bac: 'Đại uý', chuc_vu: 'Trợ lý' },
    ]);

    const result = await annualRewardService.previewImport(buffer);

    expect(result.total).toBe(1);
    expect(result.valid).toHaveLength(1);
    expect(result.errors).toHaveLength(0);
  });

  it('Nhập Excel cá nhân hằng năm: cùng quân nhân và năm lặp lại trong file → dòng sau báo "Trùng lặp trong file"', async () => {
    const p1 = makePersonnel({ id: 'qn-1', ho_ten: 'Nguyễn Văn A' });
    prismaMock.quanNhan.findMany.mockResolvedValueOnce([p1]);
    prismaMock.danhHieuHangNam.findMany.mockResolvedValueOnce([]);
    prismaMock.bangDeXuat.findMany.mockResolvedValueOnce([]);
    prismaMock.fileQuyetDinh.findMany.mockResolvedValueOnce([
      { so_quyet_dinh: 'QD-001' },
      { so_quyet_dinh: 'QD-002' },
    ]);

    const buffer = await makeCaNhanExcelBuffer([
      { id: 'qn-1', ho_va_ten: 'Nguyễn Văn A', nam: 2024, danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.CSTDCS, so_quyet_dinh: 'QD-001', cap_bac: 'Đại uý', chuc_vu: 'Trợ lý' },
      { id: 'qn-1', ho_va_ten: 'Nguyễn Văn A', nam: 2024, danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.CSTT, so_quyet_dinh: 'QD-002', cap_bac: 'Đại uý', chuc_vu: 'Trợ lý' },
    ]);

    const result = await annualRewardService.previewImport(buffer);

    expect(result.valid).toHaveLength(1);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].message).toContain('Trùng lặp trong file');
  });

  it('Nhập Excel cá nhân hằng năm: năm trước 1900 → báo lỗi không hợp lệ', async () => {
    const p1 = makePersonnel({ id: 'qn-1', ho_ten: 'Nguyễn Văn A' });
    prismaMock.quanNhan.findMany.mockResolvedValueOnce([p1]);
    prismaMock.danhHieuHangNam.findMany.mockResolvedValueOnce([]);
    prismaMock.bangDeXuat.findMany.mockResolvedValueOnce([]);
    prismaMock.fileQuyetDinh.findMany.mockResolvedValueOnce([{ so_quyet_dinh: 'QD-001' }]);

    const buffer = await makeCaNhanExcelBuffer([
      { id: 'qn-1', ho_va_ten: 'Nguyễn Văn A', nam: 1800, danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.CSTDCS, so_quyet_dinh: 'QD-001' },
    ]);

    const result = await annualRewardService.previewImport(buffer);

    expect(result.valid).toHaveLength(0);
    expect(result.errors[0].message).toContain('không hợp lệ');
  });

  it('Nhập Excel cá nhân hằng năm: năm tương lai (vượt năm hiện tại) → báo lỗi không hợp lệ', async () => {
    const futureYear = new Date().getFullYear() + 5;
    const p1 = makePersonnel({ id: 'qn-1', ho_ten: 'Nguyễn Văn A' });
    prismaMock.quanNhan.findMany.mockResolvedValueOnce([p1]);
    prismaMock.danhHieuHangNam.findMany.mockResolvedValueOnce([]);
    prismaMock.bangDeXuat.findMany.mockResolvedValueOnce([]);
    prismaMock.fileQuyetDinh.findMany.mockResolvedValueOnce([{ so_quyet_dinh: 'QD-001' }]);

    const buffer = await makeCaNhanExcelBuffer([
      { id: 'qn-1', ho_va_ten: 'Nguyễn Văn A', nam: futureYear, danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.CSTDCS, so_quyet_dinh: 'QD-001' },
    ]);

    const result = await annualRewardService.previewImport(buffer);

    expect(result.valid).toHaveLength(0);
    expect(result.errors[0].message).toContain('không hợp lệ');
  });

  it('Nhập Excel cá nhân hằng năm: danh hiệu không thuộc danh mục → báo lỗi "không đúng"', async () => {
    const p1 = makePersonnel({ id: 'qn-1', ho_ten: 'Nguyễn Văn A' });
    prismaMock.quanNhan.findMany.mockResolvedValueOnce([p1]);
    prismaMock.danhHieuHangNam.findMany.mockResolvedValueOnce([]);
    prismaMock.bangDeXuat.findMany.mockResolvedValueOnce([]);
    prismaMock.fileQuyetDinh.findMany.mockResolvedValueOnce([{ so_quyet_dinh: 'QD-001' }]);

    const buffer = await makeCaNhanExcelBuffer([
      { id: 'qn-1', ho_va_ten: 'Nguyễn Văn A', nam: 2024, danh_hieu: 'KHONG_TON_TAI', so_quyet_dinh: 'QD-001' },
    ]);

    const result = await annualRewardService.previewImport(buffer);

    expect(result.valid).toHaveLength(0);
    expect(result.errors[0].message).toContain('không đúng');
  });

  it('Nhập Excel cá nhân hằng năm: số quyết định chưa có trên hệ thống → báo lỗi "không tồn tại trên hệ thống"', async () => {
    const p1 = makePersonnel({ id: 'qn-1', ho_ten: 'Nguyễn Văn A' });
    prismaMock.quanNhan.findMany.mockResolvedValueOnce([p1]);
    prismaMock.danhHieuHangNam.findMany.mockResolvedValueOnce([]);
    prismaMock.bangDeXuat.findMany.mockResolvedValueOnce([]);
    // Empty decisions → any decision number is unknown
    prismaMock.fileQuyetDinh.findMany.mockResolvedValueOnce([]);

    const buffer = await makeCaNhanExcelBuffer([
      { id: 'qn-1', ho_va_ten: 'Nguyễn Văn A', nam: 2024, danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.CSTDCS, so_quyet_dinh: 'QD-INVALID' },
    ]);

    const result = await annualRewardService.previewImport(buffer);

    expect(result.valid).toHaveLength(0);
    expect(result.errors[0].message).toContain('không tồn tại trên hệ thống');
  });

  it('Nhập Excel cá nhân hằng năm: file vừa có dòng hợp lệ vừa có dòng lỗi → tách đúng hợp lệ và lỗi', async () => {
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
      { id: 'qn-1', ho_va_ten: 'Nguyễn Văn A', nam: 2024, danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.CSTDCS, so_quyet_dinh: 'QD-001', cap_bac: 'Đại uý', chuc_vu: 'Trợ lý' },
      // Invalid — missing year
      { id: 'qn-2', ho_va_ten: 'Nguyễn Văn B', danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.CSTT, so_quyet_dinh: 'QD-002', cap_bac: 'Đại uý', chuc_vu: 'Trợ lý' },
    ]);

    const result = await annualRewardService.previewImport(buffer);

    expect(result.valid).toHaveLength(1);
    expect(result.valid[0].personnel_id).toBe('qn-1');
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].message).toBe('Thiếu năm');
  });
});

describe('Nhập Excel danh hiệu cá nhân hằng năm: xác nhận (confirm)', () => {
  it('Nhập Excel cá nhân hằng năm: xác nhận 2 dòng hợp lệ → tạo (hoặc cập nhật) 2 bản ghi đúng dữ liệu', async () => {
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
        danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.CSTDCS,
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
        danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.CSTT,
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
      danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.CSTDCS,
      so_quyet_dinh: 'QD-001',
    });
  });

  it('Nhập Excel cá nhân hằng năm: xác nhận khi đang có đề xuất chờ duyệt cùng năm → chặn và báo "đang có đề xuất chờ duyệt"', async () => {
    prismaMock.bangDeXuat.findMany.mockResolvedValueOnce([
      {
        id: 'prop-1',
        nam: 2024,
        data_danh_hieu: [{ personnel_id: 'qn-1', danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.CSTDCS }],
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
          danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.CSTDCS,
          so_quyet_dinh: 'QD-001',
          ghi_chu: null,
        },
      ] as any),
      ValidationError,
      'Nguyễn Văn A năm 2024: đang có đề xuất chờ duyệt'
    );
    expect(prismaMock.danhHieuHangNam.upsert).not.toHaveBeenCalled();
  });

  it('Nhập Excel cá nhân hằng năm: xác nhận khi hệ thống đã có danh hiệu khác cùng năm → chặn và báo "không thể ghi đè"', async () => {
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

  it('Nhập Excel cá nhân hằng năm: xác nhận dòng CSTDCS thiếu số quyết định → chặn và báo thiếu số quyết định', async () => {
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

  it('Nhập Excel cá nhân hằng năm (xem trước): dòng thiếu số quyết định → báo lỗi "Thiếu số quyết định"', async () => {
    const p1 = makePersonnel({ id: 'qn-prev', ho_ten: 'QN Preview' });
    prismaMock.quanNhan.findMany.mockResolvedValueOnce([p1]);
    prismaMock.danhHieuHangNam.findMany.mockResolvedValueOnce([]);
    prismaMock.bangDeXuat.findMany.mockResolvedValueOnce([]);
    prismaMock.fileQuyetDinh.findMany.mockResolvedValueOnce([{ so_quyet_dinh: 'QD-XYZ' }]);

    const buffer = await makeCaNhanExcelBuffer([
      { id: 'qn-prev', ho_va_ten: 'QN Preview', nam: 2024, danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.CSTDCS },
    ]);

    const result = await annualRewardService.previewImport(buffer);
    expect(result.valid).toHaveLength(0);
    expect(result.errors[0].message).toBe('Thiếu số quyết định');
  });

  it('Nhập Excel cá nhân hằng năm: xác nhận danh sách rỗng → không tạo bản ghi nào', async () => {
    prismaMock.bangDeXuat.findMany.mockResolvedValueOnce([]);
    prismaMock.danhHieuHangNam.findMany.mockResolvedValueOnce([]);
    prismaMock.quanNhan.findMany.mockResolvedValueOnce([]);

    const result = await annualRewardService.confirmImport([]);

    expect(result.imported).toBe(0);
    expect(prismaMock.danhHieuHangNam.upsert).not.toHaveBeenCalled();
  });
});
