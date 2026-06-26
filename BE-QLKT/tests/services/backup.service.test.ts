import fs from 'fs';
import path from 'path';

import { prismaMock } from '../helpers/prismaMock';
import { expectError } from '../helpers/errorAssert';

import backupService from '../../src/services/backup.service';
import { writeSystemLog } from '../../src/helpers/systemLogHelper';
import { AUDIT_ACTIONS } from '../../src/constants/auditActions.constants';
import { RESOURCE_SLUGS } from '../../src/constants/resourceSlugs.constants';

const BACKUP_DIR = path.join(process.cwd(), 'backups');
const mockWriteSystemLog = writeSystemLog as jest.Mock;

function makeStats(mtime: Date, size = 2048) {
  return {
    size,
    mtime,
    mtimeMs: mtime.getTime(),
    isFile: () => true,
    isDirectory: () => false,
  } as unknown as fs.Stats;
}

describe('Sao lưu: liệt kê file sao lưu', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it('Sao lưu: thư mục có nhiều file → chỉ lấy file sao lưu đúng định dạng, sắp xếp mới nhất trước', () => {
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

  it('Sao lưu: thư mục rỗng → trả danh sách rỗng', () => {
    jest.spyOn(fs, 'mkdirSync').mockReturnValue(undefined);
    (jest.spyOn(fs, 'readdirSync') as jest.Mock).mockReturnValue([]);

    const result = backupService.listBackups();

    expect(result).toEqual([]);
  });
});

describe('Sao lưu: lấy đường dẫn file sao lưu', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it('Sao lưu: tên file hợp lệ và file tồn tại → trả đường dẫn tuyệt đối', () => {
    const filename = 'backup_20260301_120000_manual.sql';
    jest.spyOn(fs, 'existsSync').mockReturnValue(true);

    const result = backupService.getBackupFilePath(filename);

    expect(result).toBe(path.join(BACKUP_DIR, filename));
  });

  it('Sao lưu: tên file sai định dạng (chứa đường dẫn lạ) → báo "Tên file không hợp lệ"', () => {
    expect(() => backupService.getBackupFilePath('../etc/passwd')).toThrow(
      'Tên file không hợp lệ'
    );
  });

  it('Sao lưu: tên file hợp lệ nhưng file không tồn tại → báo file không tồn tại', () => {
    jest.spyOn(fs, 'existsSync').mockReturnValue(false);

    expect(() =>
      backupService.getBackupFilePath('backup_20260301_120000_manual.sql')
    ).toThrow('File backup không tồn tại');
  });
});

describe('Sao lưu: xóa file sao lưu', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it('Sao lưu: file hợp lệ → xóa đúng file tại đường dẫn tương ứng', async () => {
    const filename = 'backup_20260301_120000_scheduled.sql';
    jest.spyOn(fs, 'existsSync').mockReturnValue(true);
    const unlinkSpy = jest.spyOn(fs, 'unlinkSync').mockReturnValue(undefined);

    await backupService.deleteBackup(filename);

    expect(unlinkSpy).toHaveBeenCalledWith(path.join(BACKUP_DIR, filename));
  });

  it('Sao lưu: tên file không hợp lệ → báo lỗi trước khi xóa, không đụng tới file', async () => {
    const unlinkSpy = jest.spyOn(fs, 'unlinkSync').mockReturnValue(undefined);

    await expectError(backupService.deleteBackup('hax.sql'), Error, 'Tên file không hợp lệ');

    expect(unlinkSpy).not.toHaveBeenCalled();
  });

  it('Sao lưu: xóa file → ghi log hệ thống (DELETE / backup) kèm tên file', async () => {
    const filename = 'backup_20260301_120000_scheduled.sql';
    jest.spyOn(fs, 'existsSync').mockReturnValue(true);
    jest.spyOn(fs, 'unlinkSync').mockReturnValue(undefined);

    await backupService.deleteBackup(filename);

    expect(mockWriteSystemLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: AUDIT_ACTIONS.DELETE,
        resource: RESOURCE_SLUGS.BACKUP,
        description: expect.stringContaining(filename),
      })
    );
  });
});

describe('Sao lưu: dọn dẹp file sao lưu cũ', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it('Sao lưu: có file cũ hơn số ngày lưu giữ → xóa và trả về số file đã xóa', async () => {
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

  it('Sao lưu: cấu hình số ngày lưu giữ không hợp lệ → dùng mặc định 15 ngày', async () => {
    prismaMock.systemSetting.findUnique.mockResolvedValue({ key: 'backup_retention_days', value: 'abc' });
    jest.spyOn(fs, 'mkdirSync').mockReturnValue(undefined);
    (jest.spyOn(fs, 'readdirSync') as jest.Mock).mockReturnValue([]);

    const result = await backupService.cleanupOldBackups();

    expect(result.deleted).toBe(0);
    expect(result.files).toEqual([]);
  });

  it('Sao lưu: có file cũ bị xóa → ghi log hệ thống (DELETE / backup) kèm danh sách file', async () => {
    prismaMock.systemSetting.findUnique.mockResolvedValue({ key: 'backup_retention_days', value: '15' });
    const oldDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    jest.spyOn(fs, 'mkdirSync').mockReturnValue(undefined);
    (jest.spyOn(fs, 'readdirSync') as jest.Mock).mockReturnValue(['backup_20250101_120000_manual.sql']);
    jest.spyOn(fs, 'statSync').mockImplementation(() => makeStats(oldDate));
    jest.spyOn(fs, 'unlinkSync').mockReturnValue(undefined);

    await backupService.cleanupOldBackups();

    expect(mockWriteSystemLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: AUDIT_ACTIONS.DELETE,
        resource: RESOURCE_SLUGS.BACKUP,
        payload: expect.objectContaining({ files: ['backup_20250101_120000_manual.sql'] }),
      })
    );
  });
});

describe('Sao lưu: tạo bản sao lưu và tự động dọn dẹp file cũ', () => {
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
      'systemSetting', 'systemLog',
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

  it('Sao lưu: tạo bản sao lưu thành công → tự động dọn dẹp file cũ ngay sau đó', async () => {
    mockEmptyTables();
    mockFsHappyPath();
    const cleanupSpy = jest.spyOn(backupService, 'cleanupOldBackups').mockResolvedValue({ deleted: 0, files: [] });

    await backupService.createBackup({ triggeredBy: 'admin', userId: 'u1', type: 'manual' });

    expect(cleanupSpy).toHaveBeenCalledTimes(1);
  });

  it('Sao lưu: tạo bản sao lưu thất bại do lỗi CSDL → không chạy dọn dẹp file cũ', async () => {
    prismaMock.coQuanDonVi.findMany.mockRejectedValueOnce(new Error('DB connection lost'));
    mockFsHappyPath();
    const cleanupSpy = jest.spyOn(backupService, 'cleanupOldBackups').mockResolvedValue({ deleted: 0, files: [] });

    await expect(
      backupService.createBackup({ triggeredBy: 'admin', userId: 'u1', type: 'manual' })
    ).rejects.toThrow('DB connection lost');

    expect(cleanupSpy).not.toHaveBeenCalled();
  });

  it('Sao lưu: tạo bản sao lưu thành công → ghi lại thời điểm chạy sao lưu gần nhất', async () => {
    mockEmptyTables();
    mockFsHappyPath();
    jest.spyOn(backupService, 'cleanupOldBackups').mockResolvedValue({ deleted: 0, files: [] });
    prismaMock.systemSetting.upsert.mockResolvedValue({ key: 'backup_last_run', value: '' });

    await backupService.createBackup({ triggeredBy: 'admin', userId: 'u1', type: 'manual' });

    const upsertCalls = prismaMock.systemSetting.upsert.mock.calls;
    const lastRunCall = upsertCalls.find(c => (c[0] as { where: { key: string } }).where.key === 'backup_last_run');
    expect(lastRunCall).toBeDefined();
  });

  it('Sao lưu: không có bản ghi nào → vẫn ghi file SQL hợp lệ với BEGIN/COMMIT và 0 bản ghi', async () => {
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

  it('Sao lưu: bản sao lưu theo lịch → tên file có chứa "_scheduled"', async () => {
    mockEmptyTables();
    mockFsHappyPath();
    jest.spyOn(backupService, 'cleanupOldBackups').mockResolvedValue({ deleted: 0, files: [] });

    const result = await backupService.createBackup({ triggeredBy: 'SYSTEM', userId: 'SYSTEM', type: 'scheduled' });

    expect(result.filename).toMatch(/^backup_\d{8}_\d{6}_scheduled\.sql$/);
  });

  it('Sao lưu: tạo backup thành công → ghi log hệ thống (BACKUP / backup)', async () => {
    mockEmptyTables();
    mockFsHappyPath();
    jest.spyOn(backupService, 'cleanupOldBackups').mockResolvedValue({ deleted: 0, files: [] });

    await backupService.createBackup({ triggeredBy: 'admin', userId: 'u1', type: 'manual' });

    expect(mockWriteSystemLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: AUDIT_ACTIONS.BACKUP,
        resource: RESOURCE_SLUGS.BACKUP,
      })
    );
  });
});
