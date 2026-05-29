package vn.qlkt.award;

import java.util.Date;
import vn.qlkt.unit.CoQuanDonVi;
import vn.qlkt.unit.DonViTrucThuoc;
import vn.qlkt.proposal.TrangThaiDeXuat;

public class DanhHieuDonViHangNam {
    private String id;
    private String co_quan_don_vi_id;
    private CoQuanDonVi coQuanDonVi;
    private String don_vi_truc_thuoc_id;
    private DonViTrucThuoc donViTrucThuoc;
    private Integer nam;
    private DanhHieuDonVi danh_hieu;
    private String so_quyet_dinh;
    private FileQuyetDinh fileQuyetDinhMain;
    private Boolean nhan_bkbqp;
    private String so_quyet_dinh_bkbqp;
    private FileQuyetDinh fileQuyetDinhBkbqp;
    private String ghi_chu_bkbqp;
    private Boolean nhan_bkttcp;
    private String so_quyet_dinh_bkttcp;
    private FileQuyetDinh fileQuyetDinhBkttcp;
    private String ghi_chu_bkttcp;
    private TrangThaiDeXuat status;
    private String nguoi_tao_id;
    private String nguoi_duyet_id;
    private Date ngay_duyet;
    private String ghi_chu;
    private Date createdAt;
    private Date updatedAt;
}
