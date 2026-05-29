package vn.qlkt.award;

import java.util.Date;
import vn.qlkt.personnel.QuanNhan;

public class ThanhTichKhoaHoc {
    private String id;
    private String quan_nhan_id;
    private QuanNhan quanNhan;
    private Integer nam;
    private LoaiThanhTichKhoaHoc loai;
    private String mo_ta;
    private String cap_bac;
    private String chuc_vu;
    private String ghi_chu;
    private String so_quyet_dinh;
    private FileQuyetDinh fileQuyetDinh;
    private Date createdAt;
    private Date updatedAt;
}
