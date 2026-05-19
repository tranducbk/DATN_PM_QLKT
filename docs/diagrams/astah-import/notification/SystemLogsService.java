package vn.qlkt.notification;

import java.util.List;

public class SystemLogsService {
    public List<SystemLog> getLogs(int page, int limit, String userRole) { return null; }
    public List<String> getActions() { return null; }
    public List<String> getResources(String userRole) { return null; }
    public void deleteLogs(List<String> ids) {}
    public void deleteAllLogs(String actorId, String actorRole) {}
}
