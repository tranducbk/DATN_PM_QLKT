package c3_1_tochuc;

import java.util.Date;

enum VaiTro {
    SUPER_ADMIN, ADMIN, MANAGER, USER
}

class CoQuanDonVi {
    private String id;
    private String ma_don_vi;
    private String ten_don_vi;
    private Integer so_luong;
}

class DonViTrucThuoc {
    private String id;
    private String ma_don_vi;
    private String ten_don_vi;
    private Integer so_luong;
    private CoQuanDonVi co_quan_don_vi;
}

class ChucVu {
    private String id;
    private String ten_chuc_vu;
    private Boolean is_manager;
    private Float he_so_chuc_vu;
    private CoQuanDonVi co_quan_don_vi;
    private DonViTrucThuoc don_vi_truc_thuoc;
}

class QuanNhan {
    private String id;
    private String cccd;
    private String ho_ten;
    private String gioi_tinh;
    private Date ngay_sinh;
    private Date ngay_nhap_ngu;
    private Date ngay_xuat_ngu;
    private String cap_bac;
    private CoQuanDonVi co_quan_don_vi;
    private DonViTrucThuoc don_vi_truc_thuoc;
    private ChucVu chuc_vu;
}

class LichSuChucVu {
    private String id;
    private Float he_so_chuc_vu;
    private Date ngay_bat_dau;
    private Date ngay_ket_thuc;
    private Integer so_thang;
    private QuanNhan quan_nhan;
    private ChucVu chuc_vu;
}

class TaiKhoan {
    private String id;
    private String username;
    private String password_hash;
    private String refreshToken;
    private VaiTro role;
    private QuanNhan quan_nhan;
}

class QuanNhanRepository {
    private QuanNhan quanNhan;
    public QuanNhan findById(String id) { return null; }
    public QuanNhan findMany(Object filter) { return null; }
    public QuanNhan create(Object data) { return null; }
    public QuanNhan update(String id, Object data) { return null; }
    public void delete(String id) { }
}

class CoQuanDonViRepository {
    private CoQuanDonVi coQuanDonVi;
    public CoQuanDonVi findById(String id) { return null; }
    public CoQuanDonVi findAllForRecalc() { return null; }
    public CoQuanDonVi create(Object data) { return null; }
    public CoQuanDonVi update(String id, Object data) { return null; }
    public void delete(String id) { }
}

class DonViTrucThuocRepository {
    private DonViTrucThuoc donViTrucThuoc;
    public DonViTrucThuoc findById(String id) { return null; }
    public DonViTrucThuoc findManySubUnits(String coQuanDonViId) { return null; }
    public DonViTrucThuoc create(Object data) { return null; }
    public DonViTrucThuoc update(String id, Object data) { return null; }
    public void delete(String id) { }
}

class PositionRepository {
    private ChucVu chucVu;
    public ChucVu findById(String id) { return null; }
    public ChucVu create(Object data) { return null; }
    public ChucVu update(String id, Object data) { return null; }
    public void delete(String id) { }
}

class PositionHistoryRepository {
    private LichSuChucVu lichSuChucVu;
    public LichSuChucVu findById(String id) { return null; }
    public LichSuChucVu create(Object data) { return null; }
    public LichSuChucVu update(String id, Object data) { return null; }
    public void delete(String id) { }
}

class AccountRepository {
    private TaiKhoan taiKhoan;
    public TaiKhoan findById(String id) { return null; }
    public TaiKhoan create(Object data) { return null; }
    public TaiKhoan update(String id, Object data) { return null; }
    public void delete(String id) { }
}

class PersonnelService {
    private QuanNhanRepository quanNhanRepository;
    public QuanNhan getPersonnel(Object filter, Integer page, Integer limit) { return null; }
    public QuanNhan getPersonnelById(String id) { return null; }
    public QuanNhan createPersonnel(Object data) { return null; }
    public QuanNhan updatePersonnel(String id, Object data) { return null; }
    public void deletePersonnel(String id) { }
    public Object checkContributionEligibility(String id) { return null; }
}

class UnitService {
    private CoQuanDonViRepository coQuanDonViRepository;
    private DonViTrucThuocRepository donViTrucThuocRepository;
    public CoQuanDonVi getAllUnits() { return null; }
    public DonViTrucThuoc getAllSubUnits(String coQuanDonViId) { return null; }
    public CoQuanDonVi getManagerUnits(String userId) { return null; }
    public CoQuanDonVi createUnit(Object data) { return null; }
    public CoQuanDonVi updateUnit(String id, Object data) { return null; }
    public void deleteUnit(String id) { }
    public void recalculatePersonnelCount() { }
}

class PositionService {
    private PositionRepository positionRepository;
    public ChucVu getPositions(String unitId) { return null; }
    public ChucVu createPosition(Object data) { return null; }
    public ChucVu updatePosition(String id, Object data) { return null; }
    public void deletePosition(String id) { }
}

class PositionHistoryService {
    private PositionHistoryRepository positionHistoryRepository;
    public LichSuChucVu getPositionHistory(String personnelId) { return null; }
    public LichSuChucVu createPositionHistory(Object data) { return null; }
    public LichSuChucVu updatePositionHistory(String id, Object data) { return null; }
    public void deletePositionHistory(String id) { }
}

class AccountService {
    private AccountRepository accountRepository;
    public TaiKhoan getAccounts(Integer page, Integer limit) { return null; }
    public TaiKhoan getAccountById(String id) { return null; }
    public TaiKhoan createAccount(Object data) { return null; }
    public TaiKhoan updateAccount(String id, Object data) { return null; }
    public void resetPassword(String id) { }
    public void deleteAccount(String id) { }
}

class AuthService {
    private AccountRepository accountRepository;
    public TaiKhoan login(String username, String password) { return null; }
    public String refreshAccessToken(String refreshToken) { return null; }
    public void logout(String userId) { }
    public void changePassword(String userId, String oldPassword, String newPassword) { }
    private String generateAccessToken(Object account) { return null; }
    private String generateRefreshToken(Object account) { return null; }
}

class PersonnelController {
    private PersonnelService personnelService;
    public void getPersonnel() { }
    public void getPersonnelById() { }
    public void createPersonnel() { }
    public void updatePersonnel() { }
    public void deletePersonnel() { }
    public void checkContributionEligibility() { }
}

class UnitController {
    private UnitService unitService;
    public void getAllUnits() { }
    public void getAllSubUnits() { }
    public void getUnitById() { }
    public void getMyUnits() { }
    public void createUnit() { }
    public void updateUnit() { }
    public void deleteUnit() { }
}

class PositionController {
    private PositionService positionService;
    public void getPositions() { }
    public void createPosition() { }
    public void updatePosition() { }
    public void deletePosition() { }
}

class PositionHistoryController {
    private PositionHistoryService positionHistoryService;
    public void getPositionHistory() { }
    public void createPositionHistory() { }
    public void updatePositionHistory() { }
    public void deletePositionHistory() { }
}

class AccountController {
    private AccountService accountService;
    public void getAccounts() { }
    public void getAccountById() { }
    public void createAccount() { }
    public void updateAccount() { }
    public void resetPassword() { }
    public void deleteAccount() { }
}

class AuthController {
    private AuthService authService;
    public void login() { }
    public void refresh() { }
    public void logout() { }
    public void changePassword() { }
}
