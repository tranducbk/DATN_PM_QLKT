package vn.qlkt.award;

import java.util.Date;
import java.util.Map;
import vn.qlkt.personnel.QuanNhan;

public class HuanChuongQuanKyQuyetThang {
    private String id;
    private String quan_nhan_id;
    private QuanNhan quanNhan;
    private Integer nam;
    private Integer thang;
    private String cap_bac;
    private String chuc_vu;
    private String ghi_chu;
    private String so_quyet_dinh;
    private FileQuyetDinh fileQuyetDinh;
    private Map thoi_gian;
    private Date createdAt;
    private Date updatedAt;
}
