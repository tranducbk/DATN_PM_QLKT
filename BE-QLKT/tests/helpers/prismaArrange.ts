import { prismaMock } from './prismaMock';

/**
 * Child tables that `personnelService.deletePersonnel` cascades into before
 * removing the QuanNhan row. Keep in sync with the service's delete fan-out.
 */
const PERSONNEL_CASCADE_MODELS = [
  'lichSuChucVu',
  'thanhTichKhoaHoc',
  'danhHieuHangNam',
  'khenThuongHCBVTQ',
  'huanChuongQuanKyQuyetThang',
  'kyNiemChuongVSNXDQDNDVN',
  'khenThuongHCCSVV',
  'khenThuongDotXuat',
  'hoSoNienHan',
  'hoSoCongHien',
  'hoSoHangNam',
] as const;

/**
 * Stubs every child-table `deleteMany` the personnel cascade delete fans out to.
 * @param count - BatchPayload count each deleteMany resolves with (default 0)
 */
export function mockPersonnelCascadeDeletes(count = 0): void {
  for (const model of PERSONNEL_CASCADE_MODELS) {
    prismaMock[model].deleteMany.mockResolvedValue({ count });
  }
}
