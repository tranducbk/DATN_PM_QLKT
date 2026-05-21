package vn.qlkt.profile;

import java.util.Date;
import java.util.Map;
import vn.qlkt.unit.CoQuanDonVi;
import vn.qlkt.unit.DonViTrucThuoc;

public class HoSoDonViHangNam {
    private String id;
    private String co_quan_don_vi_id;
    private CoQuanDonVi coQuanDonVi;
    private String don_vi_truc_thuoc_id;
    private DonViTrucThuoc donViTrucThuoc;
    private Integer nam;
    private Integer tong_dvqt;
    private Map tong_dvqt_json;
    private Integer dvqt_lien_tuc;
    private Boolean du_dieu_kien_bk_tong_cuc;
    private Boolean du_dieu_kien_bk_thu_tuong;
    private String goi_y;
    private Date createdAt;
    private Date updatedAt;
}
