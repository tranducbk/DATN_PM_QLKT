# Astah import — Java skeleton cho Class Diagram

Bộ Java skeleton để Astah **reverse-engineer** ra 3 sơ đồ lớp (khớp `docs/diagrams/04-class.md`, đúng tên field/method với code BE). Đây là skeleton thuần để vẽ diagram — không phải code chạy.

## Cách import vào Astah

1. Astah → `Tools` → `Java` → `Import Java...`
2. Chọn thư mục `astah-import/` (import cả 3 package).
3. Astah sinh model tree theo 3 package. Tạo 3 class diagram, kéo class của từng package vào:

| Package | Sơ đồ | Nội dung |
|---|---|---|
| `c3_1_tochuc` | **C3.1** | Tổ chức, Quân nhân & Tài khoản |
| `c3_2_dexuat` | **C3.2** | Đề xuất khen thưởng + Strategy pattern |
| `c3_3_khenthuong` | **C3.3** | Thực thể khen thưởng + Hồ sơ điều kiện + Quyết định |

> Mẹo: chuột phải package → `Create Class Diagram` rồi `Auto Layout` để Astah tự dàn trang.

## Astah sẽ vẽ được gì

Skeleton vẽ đủ 4 tầng **Controller → Service → Repository → Entity**.

Mọi quan hệ 4 tầng **Astah tự vẽ** vì đều khai báo dạng **field** (Astah chỉ sinh quan hệ từ FIELD kiểu class, không từ chữ ký method) — **không phải kéo tay gì cả**:

- `Controller → Service`: controller giữ field service, vd `PersonnelController` có `private PersonnelService personnelService`.
- `Service → Repository`: service giữ field repository, vd `PersonnelService` có `private QuanNhanRepository quanNhanRepository`.
- `Repository → Entity`: **mỗi repository giữ 1 field kiểu entity** nó quản, vd `AnnualProfileRepository` có `private HoSoHangNam hoSoHangNam` → Astah nối `AnnualProfileRepository → HoSoHangNam` (nhờ vậy các hồ sơ như `HoSoHangNam` không còn đứng rời).
- **Association giữa entity**: từ field kiểu class, vd `QuanNhan.chuc_vu : ChucVu`, `TaiKhoan.role : VaiTro`, `FileQuyetDinh` giữ 8 field award.
- **Realization** (đường đứt tam giác rỗng): 7 strategy `implements ProposalStrategy`.
- Một vài `..>` thuần khái niệm trong `04-class.md` (Registry *returns* Strategy, ProfileService đọc *input* DanhHieuHangNam) là dependency qua method — Astah không tự sinh, nhưng các class này đã nối qua đường khác nên **không class nào trôi**; có thể bỏ qua hoặc vẽ tay nếu muốn.
- **Enumeration**: `VaiTro`, `LoaiDeXuat`, `TrangThaiDeXuat`, `TrangThaiHoSo`.

## Lưu ý để đúng với code

- Class để **package-private** (gói gọn 1 file/package, Astah parse OK).
- Visibility: field để **`private`** (`-`, đóng gói chuẩn UML — Astah hiện `-`); method / API để **`public`** (`+`); thành viên interface `+`. (Field `private` không getter sẽ bị javac cảnh báo "unused" — vô hại, chỉ là skeleton vẽ diagram.)
- **Design-level**: sơ đồ lớp là mô hình **thiết kế**, nên `Repository` / `ProposalStrategyRegistry` / `SingleMedalImporter` mô hình hoá là **class** dù TS hiện thực bằng `const object` / `function` module — đó là chi tiết cài đặt, không đưa vào sơ đồ lớp. Không cần stereotype riêng cho chúng.
- Field giữ **snake_case** đúng tên cột `prisma/schema.prisma`; method giữ tên đúng service (`getPersonnelById`, `recalculateAnnualProfile`, `getDecisionFileForDownload`...).
- Kiểu dữ liệu: `Int`→`Integer`, `DateTime`→`Date`. Hai field `he_so_chuc_vu` (`ChucVu` + `LichSuChucVu`) đều là Prisma `Float` → giữ tên **`Float`** trong skeleton lẫn `04-class.md` cho khớp keyword của code (Prisma `Float` = PostgreSQL `double precision` = JS `number` = số thực 64-bit). Lưu ý Astah chỉ vẽ field **base type** (primitive + `java.lang.*`: String/Boolean/Integer/Float/Double/Date) trong ô thuộc tính; kiểu class khác (kể cả `java.math.BigDecimal`) bị biến thành **association** nên biến mất khỏi ô — vì vậy KHÔNG dùng `Decimal`/`BigDecimal`. Rule "1 chữ số thập phân" của hệ số chức vụ nằm ở validation (Zod BE + `step` FE), không ở tên kiểu.
- Field kiểu `String` đại diện cột JSON (`thoi_gian`, `data_danh_hieu`, `files_attached`...) và các cột enum-bằng-String (`cap_bac`, `gioi_tinh`) — Prisma **không dùng native enum**, chỉ ràng buộc bằng hằng số `src/constants/`.
- `ProposalStrategy.type : LoaiDeXuat` là **property** (code dùng `readonly type`, KHÔNG có `getType()`).
- 4 huân/huy chương cá nhân (`KhenThuongHCCSVV` / `KhenThuongHCBVTQ` / `HuanChuongQuanKyQuyetThang` / `KyNiemChuongVSNXDQDNDVN`) vẽ đủ và đều là FK của `FileQuyetDinh` → hub `FileQuyetDinh` nối đúng **8 bảng**.
- **FK = association (theo UML thiết kế)**: FK tới entity **có trong cùng sơ đồ** được thể hiện bằng **field kiểu-class** (vd `QuanNhan.co_quan_don_vi : CoQuanDonVi`) → Astah render thành **đường association**, KHÔNG hiện cột `*_id` trong ô attribute. (Mermaid `04-class.md` cũng đã bỏ cột `*_id` tương ứng, chỉ vẽ đường nối.) FK tới entity **ngoài sơ đồ** (vd `KhenThuongHCCSVV.quan_nhan_id` ở C3.3, `QuanNhan` nằm ở C3.1) thì giữ dạng `*_id : String` ở cả Java lẫn Mermaid.

## Sync

Khi sửa schema/service → cập nhật cả file Java ở đây **và** `docs/diagrams/04-class.md` cho khớp.
