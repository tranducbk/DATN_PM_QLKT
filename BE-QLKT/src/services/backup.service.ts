import fs from 'fs';
import path from 'path';
import { prisma } from '../models';
import { danhHieuHangNamRepository, danhHieuDonViHangNamRepository } from '../repositories/danhHieu.repository';
import { contributionMedalRepository } from '../repositories/contributionMedal.repository';
import { tenureMedalRepository } from '../repositories/tenureMedal.repository';
import { adhocAwardRepository } from '../repositories/adhocAward.repository';
import { militaryFlagRepository } from '../repositories/militaryFlag.repository';
import { commemorativeMedalRepository } from '../repositories/commemorativeMedal.repository';
import { scientificAchievementRepository } from '../repositories/scientificAchievement.repository';
import { quanNhanRepository } from '../repositories/quanNhan.repository';
import { coQuanDonViRepository, donViTrucThuocRepository } from '../repositories/unit.repository';
import { accountRepository } from '../repositories/account.repository';
import { proposalRepository } from '../repositories/proposal.repository';
import { decisionFileRepository } from '../repositories/decisionFile.repository';
import { positionRepository } from '../repositories/position.repository';
import { positionHistoryRepository } from '../repositories/positionHistory.repository';
import { tenureProfileRepository } from '../repositories/tenureProfile.repository';
import { contributionProfileRepository } from '../repositories/contributionProfile.repository';
import { annualProfileRepository } from '../repositories/annualProfile.repository';
import { unitAnnualProfileRepository } from '../repositories/unitAnnualProfile.repository';
import { systemSettingRepository } from '../repositories/systemSetting.repository';
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

const TABLES = {
  CoQuanDonVi: 'CoQuanDonVi',
  DonViTrucThuoc: 'DonViTrucThuoc',
  ChucVu: 'ChucVu',
  QuanNhan: 'QuanNhan',
  TaiKhoan: 'TaiKhoan',
  LichSuChucVu: 'LichSuChucVu',
  ThanhTichKhoaHoc: 'ThanhTichKhoaHoc',
  DanhHieuHangNam: 'DanhHieuHangNam',
  KhenThuongHCBVTQ: 'KhenThuongHCBVTQ',
  KhenThuongHCCSVV: 'KhenThuongHCCSVV',
  KhenThuongDotXuat: 'KhenThuongDotXuat',
  HuanChuongQuanKyQuyetThang: 'HuanChuongQuanKyQuyetThang',
  KyNiemChuongVSNXDQDNDVN: 'KyNiemChuongVSNXDQDNDVN',
  HoSoNienHan: 'HoSoNienHan',
  HoSoCongHien: 'HoSoCongHien',
  HoSoHangNam: 'HoSoHangNam',
  BangDeXuat: 'BangDeXuat',
  DanhHieuDonViHangNam: 'DanhHieuDonViHangNam',
  HoSoDonViHangNam: 'HoSoDonViHangNam',
  FileQuyetDinh: 'FileQuyetDinh',
  SystemSetting: 'SystemSetting',
} as const;

// PostgreSQL preserves identifier case only when quoted
const quoteTable = (name: string): string => `"${name}"`;

const TRUNCATE_ORDER = [
  TABLES.FileQuyetDinh,
  TABLES.BangDeXuat,
  TABLES.HoSoDonViHangNam,
  TABLES.DanhHieuDonViHangNam,
  TABLES.HoSoHangNam,
  TABLES.HoSoCongHien,
  TABLES.HoSoNienHan,
  TABLES.KyNiemChuongVSNXDQDNDVN,
  TABLES.HuanChuongQuanKyQuyetThang,
  TABLES.KhenThuongDotXuat,
  TABLES.KhenThuongHCCSVV,
  TABLES.KhenThuongHCBVTQ,
  TABLES.DanhHieuHangNam,
  TABLES.ThanhTichKhoaHoc,
  TABLES.LichSuChucVu,
  TABLES.TaiKhoan,
  TABLES.QuanNhan,
  TABLES.ChucVu,
  TABLES.DonViTrucThuoc,
  TABLES.CoQuanDonVi,
  TABLES.SystemSetting,
].map(quoteTable);

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
  const quotedTable = quoteTable(table);
  if (records.length === 0) return `-- ${quotedTable}: 0 records\n`;
  const cols = Object.keys(records[0]);
  const quotedCols = cols.map(quoteCol).join(', ');
  const valueRows = records.map(r => `  (${cols.map(c => formatValue(r[c])).join(', ')})`);
  return `-- ${quotedTable} (${records.length} records)\nINSERT INTO ${quotedTable} (${quotedCols}) VALUES\n${valueRows.join(',\n')};\n`;
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
      khenThuongHCBVTQ,
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
      coQuanDonViRepository.findManyRaw({}),
      donViTrucThuocRepository.findManyRaw({}),
      positionRepository.findManyRaw({}),
      quanNhanRepository.findManyRaw({}),
      // Exclude password_hash and refreshToken — reset passwords after restore
      accountRepository.findManyRaw({
        select: {
          id: true,
          quan_nhan_id: true,
          username: true,
          role: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      positionHistoryRepository.findManyRaw({}),
      scientificAchievementRepository.findManyRaw({}),
      danhHieuHangNamRepository.findMany({}),
      contributionMedalRepository.findManyRaw({}),
      tenureMedalRepository.findManyRaw({}),
      adhocAwardRepository.findManyRaw({}),
      militaryFlagRepository.findManyRaw({}),
      commemorativeMedalRepository.findManyRaw({}),
      tenureProfileRepository.findManyRaw({}),
      contributionProfileRepository.findManyRaw({}),
      annualProfileRepository.findManyRaw({}),
      proposalRepository.findManyRaw({}),
      danhHieuDonViHangNamRepository.findMany({}),
      unitAnnualProfileRepository.findManyRaw({}),
      decisionFileRepository.findManyRaw({}),
      systemSettingRepository.findManyRaw({}),
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
      khenThuongHCBVTQ,
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
      `-- NOTE: TaiKhoan passwords excluded — reset passwords after restore`,
      `-- ============================================================`,
      ``,
      `BEGIN;`,
      ``,
      `TRUNCATE TABLE ${TRUNCATE_ORDER.join(', ')} CASCADE;`,
      ``,
      buildInsertBlock(TABLES.CoQuanDonVi, coQuanDonVi as Record<string, unknown>[]),
      buildInsertBlock(TABLES.DonViTrucThuoc, donViTrucThuoc as Record<string, unknown>[]),
      buildInsertBlock(TABLES.ChucVu, chucVu as Record<string, unknown>[]),
      buildInsertBlock(TABLES.QuanNhan, quanNhan as Record<string, unknown>[]),
      buildInsertBlock(TABLES.TaiKhoan, taiKhoan as Record<string, unknown>[]),
      buildInsertBlock(TABLES.LichSuChucVu, lichSuChucVu as Record<string, unknown>[]),
      buildInsertBlock(TABLES.ThanhTichKhoaHoc, thanhTichKhoaHoc as Record<string, unknown>[]),
      buildInsertBlock(TABLES.DanhHieuHangNam, danhHieuHangNam as Record<string, unknown>[]),
      buildInsertBlock(TABLES.KhenThuongHCBVTQ, khenThuongHCBVTQ as Record<string, unknown>[]),
      buildInsertBlock(TABLES.KhenThuongHCCSVV, khenThuongHCCSVV as Record<string, unknown>[]),
      buildInsertBlock(TABLES.KhenThuongDotXuat, khenThuongDotXuat as Record<string, unknown>[]),
      buildInsertBlock(
        TABLES.HuanChuongQuanKyQuyetThang,
        huanChuongQuanKyQuyetThang as Record<string, unknown>[]
      ),
      buildInsertBlock(TABLES.KyNiemChuongVSNXDQDNDVN, kyNiemChuong as Record<string, unknown>[]),
      buildInsertBlock(TABLES.HoSoNienHan, hoSoNienHan as Record<string, unknown>[]),
      buildInsertBlock(TABLES.HoSoCongHien, hoSoCongHien as Record<string, unknown>[]),
      buildInsertBlock(TABLES.HoSoHangNam, hoSoHangNam as Record<string, unknown>[]),
      buildInsertBlock(TABLES.BangDeXuat, bangDeXuat as Record<string, unknown>[]),
      buildInsertBlock(
        TABLES.DanhHieuDonViHangNam,
        danhHieuDonViHangNam as Record<string, unknown>[]
      ),
      buildInsertBlock(TABLES.HoSoDonViHangNam, hoSoDonViHangNam as Record<string, unknown>[]),
      buildInsertBlock(TABLES.FileQuyetDinh, fileQuyetDinh as Record<string, unknown>[]),
      buildInsertBlock(TABLES.SystemSetting, systemSettings as Record<string, unknown>[]),
      `COMMIT;`,
    ];

    fs.writeFileSync(filePath, lines.join('\n'), 'utf8');

    const sizeKB = Math.round(fs.statSync(filePath).size / 1024);

    void writeSystemLog({
      userId: options.userId,
      userRole: 'SYSTEM',
      action: AUDIT_ACTIONS.BACKUP,
      resource: 'backup',
      description: `Sao lưu dữ liệu: ${filename} (${totalRecords} bản ghi, ${sizeKB} KB)`,
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
      description: `Xóa file sao lưu: ${filename}`,
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
