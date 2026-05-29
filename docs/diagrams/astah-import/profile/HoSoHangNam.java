package vn.qlkt.profile;

import java.util.Date;
import java.util.Map;
import vn.qlkt.personnel.QuanNhan;

public class HoSoHangNam {
    private String id;
    private String quan_nhan_id;
    private QuanNhan quanNhan;
    private Integer tong_cstdcs;
    private Integer tong_nckh;
    private Map tong_cstdcs_json;
    private Map tong_nckh_json;
    private Integer cstdcs_lien_tuc;
    private Integer nckh_lien_tuc;
    private Integer bkbqp_lien_tuc;
    private Integer cstdtq_lien_tuc;
    private Boolean du_dieu_kien_bkbqp;
    private Boolean du_dieu_kien_cstdtq;
    private Boolean du_dieu_kien_bkttcp;
    private String goi_y;
    private Date createdAt;
    private Date updatedAt;
}
