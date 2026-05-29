package vn.qlkt.profile;

import java.util.Date;
import vn.qlkt.personnel.QuanNhan;

public class HoSoCongHien {
    private String id;
    private String quan_nhan_id;
    private QuanNhan quanNhan;
    private Integer hcbvtq_total_months;
    private Integer months_07;
    private Integer months_08;
    private Integer months_0910;
    private TrangThaiHoSo hcbvtq_hang_ba_status;
    private Date hcbvtq_hang_ba_ngay;
    private TrangThaiHoSo hcbvtq_hang_nhi_status;
    private Date hcbvtq_hang_nhi_ngay;
    private TrangThaiHoSo hcbvtq_hang_nhat_status;
    private Date hcbvtq_hang_nhat_ngay;
    private String goi_y;
    private Date createdAt;
    private Date updatedAt;
}
