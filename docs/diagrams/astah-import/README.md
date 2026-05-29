# Astah Java Import — Class Diagrams cho ĐATN PM QLKT

## Cách import vào Astah

1. Astah → menu **Tools → Java → Import Java...**
2. Chọn thư mục `astah-import/` (hoặc từng subfolder per module)
3. Astah parse Java files → tự sinh class diagram

## Cấu trúc thư mục

| Folder | Module | Class chính |
|---|---|---|
| `personnel/` | Quản lý quân nhân | QuanNhan, PersonnelController, PersonnelService + 2 enum |
| `unit/` | Đơn vị + chức vụ + lịch sử | CoQuanDonVi, DonViTrucThuoc, ChucVu, LichSuChucVu + UnitController/Service + PositionController/Service + PositionHistoryController/Service |
| `account/` | Tài khoản + xác thực | TaiKhoan, AccountController, AuthController, AccountService, AuthService + 1 enum |
| `proposal/` | Đề xuất khen thưởng + Strategy pattern | BangDeXuat, ProposalController, ProposalService + interface + 7 strategy + 2 enum |
| `award/` | Khen thưởng (8 loại) + quyết định + dashboard | AnnualReward, TenureMedal (HCCSVV), ContributionMedal (HCBVTQ), MilitaryFlag (HCQKQT), CommemorativeMedal (KNC), ScientificAchievement (NCKH), UnitAnnualAward, Adhoc + Decision + AwardBulk + Dashboard (mỗi loại có Controller + Service + Entity) + 5 enum (HangHCCSVV, HangHCBVTQ, DanhHieuCaNhan, DoiTuongKhenThuong, LoaiThanhTichKhoaHoc) |
| `profile/` | Hồ sơ điều kiện khen thưởng (cache OUTPUT) | HoSoHangNam, HoSoNienHan, HoSoCongHien, HoSoDonViHangNam + ProfileController/Service + TrangThaiHoSo enum |
| `notification/` | Thông báo + nhật ký + cấu hình + backup | ThongBao, SystemLog, SystemSetting + NotificationController/Service + SystemLogController/Service + BackupService + DevZoneController + 2 enum |

## Lưu ý

- Mỗi class trong 1 file riêng (Astah Java parser yêu cầu)
- Package = `vn.qlkt.<module>`
- Field tiếng Việt (`ho_ten`, `cap_bac`) giữ snake_case khớp DB
- Method name tiếng Anh khớp source code (`getPersonnel`, `submitProposal`)
- Type giản lược: `String`, `Date`, `Integer`, `Boolean`, `Map` (Json), `List`
- Quan hệ tự suy ra qua field type (vd: `private CapBac capBac` → Astah vẽ association)
- Interface implementation: `implements ProposalStrategy` → Astah vẽ realization

## Sau khi import

Trong Astah, vào **Project View** → tìm class trong package → drag vào diagram để vẽ. Hoặc Astah có thể tự sinh diagram qua menu **Diagram → Create Class Diagram from Project**.

## Mapping 10 class diagram → class cần kéo vào

Project có **10 class diagram** (xem `docs/diagrams/04-class.md`). Bảng dưới chỉ rõ class nào kéo vào sơ đồ nào.

### C3.1 — Quản lý quân nhân + đơn vị (15 class) — Landscape A4
**personnel/**: QuanNhan, CapBac, GioiTinh, PersonnelController, PersonnelService
**unit/**: CoQuanDonVi, DonViTrucThuoc, ChucVu, LichSuChucVu, UnitController, UnitService, PositionController, PositionService, PositionHistoryController, PositionHistoryService

### C3.2 — Tài khoản + xác thực (6 class) — Portrait A4
**account/**: TaiKhoan, VaiTro, AccountController, AccountService, AuthController, AuthService

### C3.3 — Đề xuất + Strategy pattern (15 class) — Landscape A4
**proposal/**: BangDeXuat, LoaiDeXuat, TrangThaiDeXuat, ProposalController, ProposalService, ProposalStrategy, ProposalStrategyRegistry, CaNhanHangNamStrategy, DonViHangNamStrategy, HccsvvStrategy, HcbvtqStrategy, HcqkqtStrategy, KncStrategy, NckhStrategy, SingleMedalImporter

### C3.4a — 4 loại huân/huy chương niên hạn (14 class) — Landscape A4
**award/**: KhenThuongHCCSVV, KhenThuongHCBVTQ, HuanChuongQuanKyQuyetThang, KyNiemChuongVSNXDQDNDVN, HangHCCSVV, HangHCBVTQ, TenureMedalController, TenureMedalService, ContributionMedalController, ContributionMedalService, MilitaryFlagController, MilitaryFlagService, CommemorativeMedalController, CommemorativeMedalService

### C3.4b — Danh hiệu hằng năm + NCKH + bulk (10 class) — Portrait A4
**award/**: DanhHieuHangNam, ThanhTichKhoaHoc, DanhHieuCaNhan, LoaiThanhTichKhoaHoc, AnnualRewardController, AnnualRewardService, ScientificAchievementController, ScientificAchievementService, AwardBulkController, AwardBulkService

### C3.5 — Khen thưởng đơn vị (4 class) — Portrait A4
**award/**: DanhHieuDonViHangNam, DanhHieuDonVi, UnitAnnualAwardController, UnitAnnualAwardService

### C3.6 — Khen thưởng đột xuất (4 class) — Portrait A4
**award/**: KhenThuongDotXuat, DoiTuongKhenThuong, AdhocAwardController, AdhocAwardService

### C3.7 — Quyết định + Dashboard (5 class) — Portrait A4
**award/**: FileQuyetDinh, DecisionController, DecisionService, DashboardController, DashboardService

### C3.8 — Hồ sơ điều kiện (Profile cache) (7 class) — Portrait A4
**profile/**: HoSoHangNam, HoSoNienHan, HoSoCongHien, HoSoDonViHangNam, TrangThaiHoSo, ProfileController, ProfileService

### C3.9 — Thông báo + nhật ký + backup (11 class) — Landscape A4
**notification/**: ThongBao, SystemLog, SystemSetting, LoaiThongBao, LoaiNhatKy, NotificationController, NotificationService, SystemLogsController, SystemLogsService, BackupService, DevZoneController

## Quy trình import + vẽ trong Astah

1. **Import 1 lần**: `Tools → Java → Import Java...` chọn cả thư mục `astah-import/`. Astah tạo 7 package (`vn.qlkt.personnel`, `vn.qlkt.unit`, `vn.qlkt.account`, `vn.qlkt.proposal`, `vn.qlkt.award`, `vn.qlkt.profile`, `vn.qlkt.notification`) với toàn bộ 90 class.
2. **Tạo 10 class diagram trống**: `Diagram → New Class Diagram` × 10, đặt tên C3.1 → C3.9 (C3.4a/b riêng).
3. **Drag class theo mapping trên**: với mỗi sơ đồ, mở Project View → chọn class theo danh sách → drag vào canvas.
4. **Astah tự suy ra liên kết**: association/dependency/realization được vẽ tự động từ field type + `implements`. Không cần vẽ tay mũi tên.
5. **Layout**: dùng `Alignment` tools để arrange. Class entity ở giữa, Controller bên trái, Service bên phải, Enum dưới cùng (gợi ý).
6. **Export PNG/SVG cho báo cáo**: `File → Export Image...` mỗi diagram → embed vào Word/LaTeX với caption "Hình C3.x — ...".
