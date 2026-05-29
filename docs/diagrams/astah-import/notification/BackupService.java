package vn.qlkt.notification;

import java.util.Date;
import java.util.List;

public class BackupService {
    public String createBackup() { return null; }
    public void scheduleAutoBackup(String cronExpression) {}
    public void stopAutoBackup() {}
    public Boolean isCronEnabled() { return null; }
    public Date getLastBackupTime() { return null; }
    public List<String> listBackupFiles() { return null; }
    public String downloadBackupFile(String filename) { return null; }
    public void deleteBackupFile(String filename) {}
    public void cleanupOldBackups(Integer retentionDays) {}
    public void writeBackupLog(String message, Boolean success) {}
}
