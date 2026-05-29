package vn.qlkt.notification;

import java.util.Date;
import vn.qlkt.account.TaiKhoan;

public class ThongBao {
    private String id;
    private String nguoi_nhan_id;
    private TaiKhoan nguoiNhan;
    private String recipient_role;
    private LoaiThongBao type;
    private String title;
    private String message;
    private String resource;
    private String tai_nguyen_id;
    private String link;
    private Boolean is_read;
    private String nhat_ky_he_thong_id;
    private SystemLog nhatKyHeThong;
    private Date createdAt;
    private Date readAt;
}
