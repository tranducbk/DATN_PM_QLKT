package vn.qlkt.personnel;

import java.util.Date;
import java.util.Map;
import vn.qlkt.unit.CoQuanDonVi;
import vn.qlkt.unit.DonViTrucThuoc;
import vn.qlkt.unit.ChucVu;

public class QuanNhan {
    private String id;
    private String cccd;
    private String ho_ten;
    private GioiTinh gioi_tinh;
    private Date ngay_sinh;
    private String que_quan_2_cap;
    private String que_quan_3_cap;
    private String tru_quan;
    private String cho_o_hien_nay;
    private Map co_quan_don_vi;
    private Date ngay_nhap_ngu;
    private Date ngay_xuat_ngu;
    private Date ngay_vao_dang;
    private Date ngay_vao_dang_chinh_thuc;
    private String so_the_dang_vien;
    private String so_dien_thoai;
    private CapBac cap_bac;
    private String co_quan_don_vi_id;
    private CoQuanDonVi coQuanDonVi;
    private String don_vi_truc_thuoc_id;
    private DonViTrucThuoc donViTrucThuoc;
    private String chuc_vu_id;
    private ChucVu chucVu;
    private Date createdAt;
    private Date updatedAt;
}
