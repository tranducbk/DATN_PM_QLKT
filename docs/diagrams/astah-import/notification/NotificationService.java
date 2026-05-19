package vn.qlkt.notification;

import java.util.List;

public class NotificationService {
    public ThongBao createNotification(String data) { return null; }
    public void createBulkNotifications(List<String> notifications) {}
    public List<ThongBao> getNotificationsByUserId(String userId) { return null; }
    public int getUnreadCount(String userId) { return 0; }
    public ThongBao markAsRead(String notificationId, String userId) { return null; }
    public void markAllAsRead(String userId) {}
    public void deleteNotification(String notificationId, String userId) {}
    public void deleteAllNotifications(String userId) {}
}
