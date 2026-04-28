import fs from 'fs';
import path from 'path';

import { prismaMock } from '../helpers/prismaMock';
import { expectError } from '../helpers/errorAssert';

import backupService from '../../src/services/backup.service';

const BACKUP_DIR = path.join(process.cwd(), 'backups');

function makeStats(mtime: Date, size = 2048) {
  return {
    size,
    mtime,
    mtimeMs: mtime.getTime(),
    isFile: () => true,
    isDirectory: () => false,
  } as unknown as fs.Stats;
}

describe('backup.service - listBackups', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it('Cho danh sách file → Khi listBackups → Thì lọc file đúng pattern và sort desc', () => {
    const files = [
      'backup_20260101_120000_manual.sql',
      'random.txt',
      'backup_20260201_120000_scheduled.sql',
      'notes.md',
    ];
    jest.spyOn(fs, 'mkdirSync').mockReturnValue(undefined);
    (jest.spyOn(fs, 'readdirSync') as jest.Mock).mockReturnValue(files);
    jest.spyOn(fs, 'statSync').mockImplementation((p: fs.PathLike) => {
      const name = path.basename(String(p));
      if (name.includes('20260101')) return makeStats(new Date('2026-01-01T12:00:00Z'));
      if (name.includes('20260201')) return makeStats(new Date('2026-02-01T12:00:00Z'));
      return makeStats(new Date());
    });

    const result = backupService.listBackups();

    expect(result).toHaveLength(2);
    expect(result[0].filename).toBe('backup_20260201_120000_scheduled.sql');
    expect(result[0].type).toBe('scheduled');
    expect(result[1].filename).toBe('backup_20260101_120000_manual.sql');
    expect(result[1].type).toBe('manual');
  });

  it('Cho thư mục rỗng → Khi listBackups → Thì trả về mảng rỗng', () => {
    jest.spyOn(fs, 'mkdirSync').mockReturnValue(undefined);
    (jest.spyOn(fs, 'readdirSync') as jest.Mock).mockReturnValue([]);

    const result = backupService.listBackups();

    expect(result).toEqual([]);
  });
});

describe('backup.service - getBackupFilePath', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it('Cho filename hợp lệ và file tồn tại → Khi getBackupFilePath → Thì trả về absolute path', () => {
    const filename = 'backup_20260301_120000_manual.sql';
    jest.spyOn(fs, 'existsSync').mockReturnValue(true);

    const result = backupService.getBackupFilePath(filename);

    expect(result).toBe(path.join(BACKUP_DIR, filename));
  });

  it('Cho filename sai pattern → Khi getBackupFilePath → Thì throw "Tên file không hợp lệ"', () => {
    expect(() => backupService.getBackupFilePath('../etc/passwd')).toThrow(
      'Tên file không hợp lệ'
    );
  });

  it('Cho filename hợp lệ nhưng file không tồn tại → Khi getBackupFilePath → Thì throw', () => {
    jest.spyOn(fs, 'existsSync').mockReturnValue(false);

    expect(() =>
      backupService.getBackupFilePath('backup_20260301_120000_manual.sql')
    ).toThrow('File backup không tồn tại');
  });
});

describe('backup.service - deleteBackup', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it('Cho file backup hợp lệ → Khi deleteBackup → Thì gọi fs.unlinkSync với đúng path', async () => {
    const filename = 'backup_20260301_120000_scheduled.sql';
    jest.spyOn(fs, 'existsSync').mockReturnValue(true);
    const unlinkSpy = jest.spyOn(fs, 'unlinkSync').mockReturnValue(undefined);

    await backupService.deleteBackup(filename);

    expect(unlinkSpy).toHaveBeenCalledWith(path.join(BACKUP_DIR, filename));
  });

  it('Cho filename không hợp lệ → Khi deleteBackup → Thì throw trước khi unlink', async () => {
    const unlinkSpy = jest.spyOn(fs, 'unlinkSync').mockReturnValue(undefined);

    await expectError(backupService.deleteBackup('hax.sql'), Error, 'Tên file không hợp lệ');

    expect(unlinkSpy).not.toHaveBeenCalled();
  });
});

describe('backup.service - cleanupOldBackups', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it('Cho file cũ hơn retention → Khi cleanupOldBackups → Thì xoá và trả deleted count', async () => {
    prismaMock.systemSetting.findUnique.mockResolvedValue({ key: 'backup_retention_days', value: '15' });
    const oldDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const newDate = new Date();

    jest.spyOn(fs, 'mkdirSync').mockReturnValue(undefined);
    (jest.spyOn(fs, 'readdirSync') as jest.Mock).mockReturnValue([
      'backup_20250101_120000_manual.sql',
      'backup_20260401_120000_manual.sql',
    ]);
    jest.spyOn(fs, 'statSync').mockImplementation((p: fs.PathLike) => {
      const name = path.basename(String(p));
      return makeStats(name.includes('20250101') ? oldDate : newDate);
    });
    const unlinkSpy = jest.spyOn(fs, 'unlinkSync').mockReturnValue(undefined);

    const result = await backupService.cleanupOldBackups();

    expect(result.deleted).toBe(1);
    expect(result.files).toEqual(['backup_20250101_120000_manual.sql']);
    expect(unlinkSpy).toHaveBeenCalledTimes(1);
  });

  it('Cho retention setting invalid → Khi cleanupOldBackups → Thì fallback default 15 ngày', async () => {
    prismaMock.systemSetting.findUnique.mockResolvedValue({ key: 'backup_retention_days', value: 'abc' });
    jest.spyOn(fs, 'mkdirSync').mockReturnValue(undefined);
    (jest.spyOn(fs, 'readdirSync') as jest.Mock).mockReturnValue([]);

    const result = await backupService.cleanupOldBackups();

    expect(result.deleted).toBe(0);
    expect(result.files).toEqual([]);
  });
});

describe('backup.service - createBackup → cleanup chain', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  function mockEmptyTables() {
    const models = [
      'coQuanDonVi', 'donViTrucThuoc', 'chucVu', 'quanNhan', 'taiKhoan',
      'lichSuChucVu', 'thanhTichKhoaHoc', 'danhHieuHangNam', 'khenThuongHCBVTQ',
      'khenThuongHCCSVV', 'khenThuongDotXuat', 'huanChuongQuanKyQuyetThang',
      'kyNiemChuongVSNXDQDNDVN', 'hoSoNienHan', 'hoSoCongHien', 'hoSoHangNam',
      'bangDeXuat', 'danhHieuDonViHangNam', 'hoSoDonViHangNam', 'fileQuyetDinh',
      'systemSetting',
    ] as const;
    for (const m of models) {
      (prismaMock[m] as { findMany: jest.Mock }).findMany.mockResolvedValue([]);
    }
  }

  function mockFsHappyPath() {
    jest.spyOn(fs, 'mkdirSync').mockReturnValue(undefined);
    jest.spyOn(fs, 'writeFileSync').mockReturnValue(undefined);
    jest.spyOn(fs, 'statSync').mockReturnValue(makeStats(new Date(), 1024));
    (jest.spyOn(fs, 'readdirSync') as jest.Mock).mockReturnValue([]);
  }

  it('Cho backup thành công → Thì cleanupOldBackups được gọi sau khi backup', async () => {
    mockEmptyTables();
    mockFsHappyPath();
    const cleanupSpy = jest.spyOn(backupService, 'cleanupOldBackups').mockResolvedValue({ deleted: 0, files: [] });

    await backupService.createBackup({ triggeredBy: 'admin', userId: 'u1', type: 'manual' });

    expect(cleanupSpy).toHaveBeenCalledTimes(1);
  });

  it('Cho backup fail (DB error) → Thì cleanupOldBackups KHÔNG được gọi', async () => {
    prismaMock.coQuanDonVi.findMany.mockRejectedValueOnce(new Error('DB connection lost'));
    mockFsHappyPath();
    const cleanupSpy = jest.spyOn(backupService, 'cleanupOldBackups').mockResolvedValue({ deleted: 0, files: [] });

    await expect(
      backupService.createBackup({ triggeredBy: 'admin', userId: 'u1', type: 'manual' })
    ).rejects.toThrow('DB connection lost');

    expect(cleanupSpy).not.toHaveBeenCalled();
  });

  it('Cho backup thành công → Thì backup_last_run setting được lưu', async () => {
    mockEmptyTables();
    mockFsHappyPath();
    jest.spyOn(backupService, 'cleanupOldBackups').mockResolvedValue({ deleted: 0, files: [] });
    prismaMock.systemSetting.upsert.mockResolvedValue({ key: 'backup_last_run', value: '' });

    await backupService.createBackup({ triggeredBy: 'admin', userId: 'u1', type: 'manual' });

    const upsertCalls = prismaMock.systemSetting.upsert.mock.calls;
    const lastRunCall = upsertCalls.find(c => (c[0] as { where: { key: string } }).where.key === 'backup_last_run');
    expect(lastRunCall).toBeDefined();
  });

  it('Cho 0 records → Thì vẫn ghi file SQL hợp lệ với BEGIN/COMMIT + 0 totalRecords', async () => {
    mockEmptyTables();
    mockFsHappyPath();
    jest.spyOn(backupService, 'cleanupOldBackups').mockResolvedValue({ deleted: 0, files: [] });
    const writeSpy = jest.spyOn(fs, 'writeFileSync');

    const result = await backupService.createBackup({ triggeredBy: 'admin', userId: 'u1', type: 'manual' });

    expect(result.totalRecords).toBe(0);
    const sqlContent = writeSpy.mock.calls[0][1] as string;
    expect(sqlContent).toContain('BEGIN;');
    expect(sqlContent).toContain('COMMIT;');
    expect(sqlContent).toContain('-- Records:    0');
  });

  it('Cho type=scheduled → Thì filename chứa "_scheduled"', async () => {
    mockEmptyTables();
    mockFsHappyPath();
    jest.spyOn(backupService, 'cleanupOldBackups').mockResolvedValue({ deleted: 0, files: [] });

    const result = await backupService.createBackup({ triggeredBy: 'SYSTEM', userId: 'SYSTEM', type: 'scheduled' });

    expect(result.filename).toMatch(/^backup_\d{8}_\d{6}_scheduled\.sql$/);
  });
});
