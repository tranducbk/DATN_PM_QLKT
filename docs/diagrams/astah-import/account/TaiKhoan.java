package vn.qlkt.account;

import java.util.Date;
import vn.qlkt.personnel.QuanNhan;

public class TaiKhoan {
    private String id;
    private String quan_nhan_id;
    private QuanNhan quanNhan;
    private String username;
    private String password_hash;
    private VaiTro role;
    private String refreshToken;
    private Date createdAt;
    private Date updatedAt;
}
