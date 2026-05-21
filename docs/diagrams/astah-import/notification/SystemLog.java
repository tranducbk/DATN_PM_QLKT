package vn.qlkt.notification;

import java.util.Date;
import java.util.Map;
import vn.qlkt.account.TaiKhoan;

public class SystemLog {
    private String id;
    private String nguoi_thuc_hien_id;
    private TaiKhoan nguoiThucHien;
    private String actor_role;
    private LoaiNhatKy action;
    private String resource;
    private String tai_nguyen_id;
    private String description;
    private Map payload;
    private String ip_address;
    private String user_agent;
    private Date createdAt;
}
