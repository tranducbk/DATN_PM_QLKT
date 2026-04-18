import fs from 'fs';
import path from 'path';
import { prisma } from '../models';
import { writeSystemLog } from '../helpers/systemLogHelper';
import { AUDIT_ACTIONS } from '../constants/auditActions.constants';
import { getSetting, setSetting } from '../helpers/settingsHelper';

interface BackupResult {
  filename: string;
  totalRecords: number;
  sizeKB: number;
  createdAt: string;
}

interface BackupFileInfo {
  filename: string;
  sizeKB: number;
  createdAt: string;
  type: 'manual' | 'scheduled';
}

interface BackupOptions {
  triggeredBy: string;
  userId: string;
  type: 'manual' | 'scheduled';
}

interface CleanupResult {
  deleted: number;
  files: string[];
}

const BACKUP_DIR = path.join(process.cwd(), 'backups');
const FILENAME_PATTERN = /^backup_\d{8}_\d{6}_(manual|scheduled)\.sql$/;
const DEFAULT_RETENTION_DAYS = 15;

const TRUNCATE_ORDER = [
  'file_quyet_dinh',
  'bang_de_xuat',
  'ho_so_don_vi_hang_nam',
  'danh_hieu_don_vi_hang_nam',
  'ho_so_hang_nam',
  'ho_so_cong_hien',
  'ho_so_nien_han',
  'ky_niem_chuong_vsnxd_qdndvn',
  'huan_chuong_quan_ky_quyet_thang',
  'khen_thuong_dot_xuat',
  'khen_thuong_hccsvv',
  'khen_thuong_cong_hien',
  'danh_hieu_hang_nam',
  'thanh_tich_khoa_hoc',
  'lich_su_chuc_vu',
  'tai_khoan',
  'quan_nhan',
  'chuc_vu',
  'don_vi_truc_thuoc',
  'co_quan_don_vi',
  'system_settings',
];

const validFilename = (filename: string): boolean => FILENAME_PATTERN.test(filename);

const quoteCol = (col: string): string => (/[A-Z]/.test(col) ? `"${col}"` : col);

const formatValue = (value: unknown): string => {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
  if (typeof value === 'number') return String(value);
  if (value instanceof Date) return `'${value.toISOString()}'`;
  if (typeof value === 'object' && value !== null) {
    const str = (value as { toString?: () => string }).toString?.() ?? '';
    if (str !== '[object Object]' && !isNaN(Number(str))) return str;
    return `'${JSON.stringify(value).replace(/'/g, "''")}'`;
  }
  return `'${String(value).replace(/'/g, "''")}'`;
};

const buildInsertBlock = (table: string, records: Record<string, unknown>[]): string => {
  if (records.length === 0) return `-- ${table}: 0 records\n`;
  const cols = Object.keys(records[0]);
  const quotedCols = cols.map(quoteCol).join(', ');
  const valueRows = records.map(r => `  (${cols.map(c => formatValue(r[c])).join(', ')})`);
  return `-- ${table} (${records.length} records)\nINSERT INTO ${table} (${quotedCols}) VALUES\n${valueRows.join(',\n')};\n`;
};

const buildTimestamp = (date: Date): string =>
  date.toISOString().replace(/[-:]/g, '').replace('T', '_').slice(0, 15);

class BackupService {
  /**
   * Creates a full SQL backup of all business data tables.
   * @param options - Backup metadata (type, triggeredBy, userId)
   * @returns Backup file info
   */
  async createBackup(options: BackupOptions): Promise<BackupResult> {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });

    const now = new Date();
    const filename = `backup_${buildTimestamp(now)}_${options.type}.sql`;
    const filePath = path.join(BACKUP_DIR, filename);

    const [
      coQuanDonVi,
      donViTrucThuoc,
      chucVu,
      quanNhan,
      taiKhoan,
      lichSuChucVu,
      thanhTichKhoaHoc,
      danhHieuHangNam,
      khenThuongCongHien,
      khenThuongHCCSVV,
      khenThuongDotXuat,
      huanChuongQuanKyQuyetThang,
      kyNiemChuong,
      hoSoNienHan,
      hoSoCongHien,
      hoSoHangNam,
      bangDeXuat,
      danhHieuDonViHangNam,
      hoSoDonViHangNam,
      fileQuyetDinh,
      systemSettings,
    ] = await Promise.all([
      prisma.coQuanDonVi.findMany(),
      prisma.donViTrucThuoc.findMany(),
      prisma.chucVu.findMany(),
      prisma.quanNhan.findMany(),
      // Exclude password_hash and refreshToken — reset passwords after restore
      prisma.taiKhoan.findMany({
        select: {
          id: true,
          quan_nhan_id: true,
          username: true,
          role: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      prisma.lichSuChucVu.findMany(),
      prisma.thanhTichKhoaHoc.findMany(),
      prisma.danhHieuHangNam.findMany(),
      prisma.khenThuongCongHien.findMany(),
      prisma.khenThuongHCCSVV.findMany(),
      prisma.khenThuongDotXuat.findMany(),
      prisma.huanChuongQuanKyQuyetThang.findMany(),
      prisma.kyNiemChuongVSNXDQDNDVN.findMany(),
      prisma.hoSoNienHan.findMany(),
      prisma.hoSoCongHien.findMany(),
      prisma.hoSoHangNam.findMany(),
      prisma.bangDeXuat.findMany(),
      prisma.danhHieuDonViHangNam.findMany(),
      prisma.hoSoDonViHangNam.findMany(),
      prisma.fileQuyetDinh.findMany(),
      prisma.systemSetting.findMany(),
    ]);

    const allSets = [
      coQuanDonVi,
      donViTrucThuoc,
      chucVu,
      quanNhan,
      taiKhoan,
      lichSuChucVu,
      thanhTichKhoaHoc,
      danhHieuHangNam,
      khenThuongCongHien,
      khenThuongHCCSVV,
      khenThuongDotXuat,
      huanChuongQuanKyQuyetThang,
      kyNiemChuong,
      hoSoNienHan,
      hoSoCongHien,
      hoSoHangNam,
      bangDeXuat,
      danhHieuDonViHangNam,
      hoSoDonViHangNam,
      fileQuyetDinh,
      systemSettings,
    ];
    const totalRecords = allSets.reduce((sum, arr) => sum + arr.length, 0);

    const lines = [
      `-- ============================================================`,
      `-- BACKUP: PM QLKT - Phần mềm Quản lý Khen thưởng`,
      `-- Created:    ${now.toISOString()}`,
      `-- Type:       ${options.type}`,
      `-- Triggered:  ${options.triggeredBy}`,
      `-- Records:    ${totalRecords}`,
      `-- NOTE: tai_khoan passwords excluded — reset passwords after restore`,
      `-- ============================================================`,
      ``,
      `BEGIN;`,
      ``,
      `TRUNCATE TABLE ${TRUNCATE_ORDER.join(', ')} CASCADE;`,
      ``,
      buildInsertBlock('co_quan_don_vi', coQuanDonVi as Record<string, unknown>[]),
      buildInsertBlock('don_vi_truc_thuoc', donViTrucThuoc as Record<string, unknown>[]),
      buildInsertBlock('chuc_vu', chucVu as Record<string, unknown>[]),
      buildInsertBlock('quan_nhan', quanNhan as Record<string, unknown>[]),
      buildInsertBlock('tai_khoan', taiKhoan as Record<string, unknown>[]),
      buildInsertBlock('lich_su_chuc_vu', lichSuChucVu as Record<string, unknown>[]),
      buildInsertBlock('thanh_tich_khoa_hoc', thanhTichKhoaHoc as Record<string, unknown>[]),
      buildInsertBlock('danh_hieu_hang_nam', danhHieuHangNam as Record<string, unknown>[]),
      buildInsertBlock('khen_thuong_cong_hien', khenThuongCongHien as Record<string, unknown>[]),
      buildInsertBlock('khen_thuong_hccsvv', khenThuongHCCSVV as Record<string, unknown>[]),
      buildInsertBlock('khen_thuong_dot_xuat', khenThuongDotXuat as Record<string, unknown>[]),
      buildInsertBlock(
        'huan_chuong_quan_ky_quyet_thang',
        huanChuongQuanKyQuyetThang as Record<string, unknown>[]
      ),
      buildInsertBlock('ky_niem_chuong_vsnxd_qdndvn', kyNiemChuong as Record<string, unknown>[]),
      buildInsertBlock('ho_so_nien_han', hoSoNienHan as Record<string, unknown>[]),
      buildInsertBlock('ho_so_cong_hien', hoSoCongHien as Record<string, unknown>[]),
      buildInsertBlock('ho_so_hang_nam', hoSoHangNam as Record<string, unknown>[]),
      buildInsertBlock('bang_de_xuat', bangDeXuat as Record<string, unknown>[]),
      buildInsertBlock(
        'danh_hieu_don_vi_hang_nam',
        danhHieuDonViHangNam as Record<string, unknown>[]
      ),
      buildInsertBlock('ho_so_don_vi_hang_nam', hoSoDonViHangNam as Record<string, unknown>[]),
      buildInsertBlock('file_quyet_dinh', fileQuyetDinh as Record<string, unknown>[]),
      buildInsertBlock('system_settings', systemSettings as Record<string, unknown>[]),
      `COMMIT;`,
    ];

    fs.writeFileSync(filePath, lines.join('\n'), 'utf8');

    const sizeKB = Math.round(fs.statSync(filePath).size / 1024);

    void writeSystemLog({
      userId: options.userId,
      userRole: 'SYSTEM',
      action: AUDIT_ACTIONS.BACKUP,
      resource: 'backup',
      description: `Backup dữ liệu: ${filename} (${totalRecords} bản ghi, ${sizeKB} KB)`,
      payload: { filename, type: options.type, totalRecords, sizeKB },
    });

    await setSetting('backup_last_run', now.toISOString());
    await this.cleanupOldBackups();

    return { filename, totalRecords, sizeKB, createdAt: now.toISOString() };
  }

  /**
   * Lists all backup files sorted by creation time descending.
   * @returns Array of backup file metadata
   */
  listBackups(): BackupFileInfo[] {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
    return fs
      .readdirSync(BACKUP_DIR)
      .filter(f => FILENAME_PATTERN.test(f))
      .map(filename => {
        const stats = fs.statSync(path.join(BACKUP_DIR, filename));
        const match = filename.match(/(manual|scheduled)/);
        return {
          filename,
          sizeKB: Math.round(stats.size / 1024),
          createdAt: stats.mtime.toISOString(),
          type: (match?.[1] ?? 'manual') as 'manual' | 'scheduled',
        };
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  /**
   * Returns the absolute file path for a given backup filename.
   * @param filename - Validated backup filename
   * @returns Absolute path to the backup file
   * @throws Error when filename is invalid or file does not exist
   */
  getBackupFilePath(filename: string): string {
    if (!validFilename(filename)) throw new Error('Tên file không hợp lệ');
    const filePath = path.join(BACKUP_DIR, filename);
    if (!fs.existsSync(filePath)) throw new Error('File backup không tồn tại');
    return filePath;
  }

  /**
   * Deletes a single backup file by filename.
   * @param filename - Validated backup filename
   */
  async deleteBackup(filename: string): Promise<void> {
    const filePath = this.getBackupFilePath(filename);
    fs.unlinkSync(filePath);
    void writeSystemLog({
      userId: 'SYSTEM',
      userRole: 'SYSTEM',
      action: AUDIT_ACTIONS.DELETE,
      resource: 'backup',
      description: `Xóa file backup: ${filename}`,
    });
  }

  /**
   * Deletes backup files older than backup_retention_days setting (default 15).
   * @returns Count and list of deleted files
   */
  async cleanupOldBackups(): Promise<CleanupResult> {
    const parsed = parseInt(await getSetting('backup_retention_days', String(DEFAULT_RETENTION_DAYS)), 10);
    const retentionDays = isNaN(parsed) || parsed <= 0 ? DEFAULT_RETENTION_DAYS : parsed;
    const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;

    fs.mkdirSync(BACKUP_DIR, { recursive: true });
    const deleted: string[] = [];

    for (const filename of fs.readdirSync(BACKUP_DIR)) {
      if (!FILENAME_PATTERN.test(filename)) continue;
      const filePath = path.join(BACKUP_DIR, filename);
      if (fs.statSync(filePath).mtimeMs < cutoff) {
        fs.unlinkSync(filePath);
        deleted.push(filename);
      }
    }

    return { deleted: deleted.length, files: deleted };
  }
}

export default new BackupService();
