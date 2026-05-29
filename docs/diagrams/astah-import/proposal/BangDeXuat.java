package vn.qlkt.proposal;

import java.util.Date;
import java.util.Map;
import vn.qlkt.account.TaiKhoan;
import vn.qlkt.unit.CoQuanDonVi;
import vn.qlkt.unit.DonViTrucThuoc;

public class BangDeXuat {
    private String id;
    private String co_quan_don_vi_id;
    private CoQuanDonVi coQuanDonVi;
    private String don_vi_truc_thuoc_id;
    private DonViTrucThuoc donViTrucThuoc;
    private String nguoi_de_xuat_id;
    private TaiKhoan nguoiDeXuat;
    private LoaiDeXuat loai_de_xuat;
    private Integer nam;
    private Integer thang;
    private TrangThaiDeXuat status;
    private Map data_danh_hieu;
    private Map data_thanh_tich;
    private Map data_nien_han;
    private Map data_cong_hien;
    private Map files_attached;
    private Map files_attached_admin;
    private String ghi_chu;
    private String rejection_reason;
    private String nguoi_duyet_id;
    private TaiKhoan nguoiDuyet;
    private Date ngay_duyet;
    private Date createdAt;
    private Date updatedAt;
}
