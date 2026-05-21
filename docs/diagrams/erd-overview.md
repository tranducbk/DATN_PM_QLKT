# ERD Tổng quan (Mermaid)

Sơ đồ chỉ thể hiện **tên bảng + quan hệ**, không có field — phù hợp cho slide bảo vệ hoặc chương kiến trúc tổng quan.

> Render: paste vào [mermaid.live](https://mermaid.live) hoặc xem trực tiếp trong VS Code (extension Markdown Preview Mermaid).

## Ký hiệu

| Ký hiệu | Ý nghĩa |
|---|---|
| `\|\|--\|\|` | 1-1 (cả hai bắt buộc) |
| `\|\|--o\|` | 1-1 (con tùy chọn) |
| `\|\|--o{` | 1-N (con có thể không có) |
| `\|\|--\|{` | 1-N (con bắt buộc ≥ 1) |
| Nhãn trên line | Mô tả quan hệ |

---

## C0 — ERD cực gọn (cho slide bảo vệ — 5 entity trung tâm)

```mermaid
erDiagram
    CoQuanDonVi ||--o{ QuanNhan : "quản lý"
    QuanNhan ||--o| TaiKhoan : "có"
    TaiKhoan ||--o{ BangDeXuat : "đề xuất"
    BangDeXuat ||--o| FileQuyetDinh : "ra QĐ"
    QuanNhan ||--o{ FileQuyetDinh : "được khen"
```

> Sơ đồ này chỉ giữ 5 entity quan trọng nhất, dùng cho slide giới thiệu ban đầu — diagram cụ thể xem C1-C6 bên dưới.

---

## C1 — ERD tổng thể (core, ~20 quan hệ)

> Đã bỏ 15 quan hệ noise `FileQuyetDinh → award tables` (xem C5 chi tiết).

```mermaid
erDiagram
    %% Tổ chức
    CoQuanDonVi ||--o{ DonViTrucThuoc : "có"
    CoQuanDonVi ||--o{ ChucVu : "có"
    CoQuanDonVi ||--o{ QuanNhan : "thuộc về"
    DonViTrucThuoc ||--o{ QuanNhan : "thuộc về"
    ChucVu ||--o{ QuanNhan : "giữ"

    %% Nhân sự
    QuanNhan ||--o| TaiKhoan : "có tài khoản"
    QuanNhan ||--o{ LichSuChucVu : "có lịch sử"

    %% Khen thưởng cá nhân (gộp 6 bảng)
    QuanNhan ||--o{ DanhHieuHangNam : "đạt danh hiệu"
    QuanNhan ||--o{ ThanhTichKhoaHoc : "có NCKH"
    QuanNhan ||--o{ KhenThuongHCCSVV : "nhận"
    QuanNhan ||--o| KhenThuongHCBVTQ : "nhận"
    QuanNhan ||--o| HuanChuongQuanKyQuyetThang : "nhận"
    QuanNhan ||--o| KyNiemChuongVSNXDQDNDVN : "nhận"

    %% Hồ sơ tổng hợp cá nhân
    QuanNhan ||--|| HoSoHangNam : "có"
    QuanNhan ||--|| HoSoNienHan : "có"
    QuanNhan ||--|| HoSoCongHien : "có"

    %% Khen thưởng đơn vị
    CoQuanDonVi ||--o{ DanhHieuDonViHangNam : "đạt"
    CoQuanDonVi ||--o{ HoSoDonViHangNam : "có"
    QuanNhan ||--o{ KhenThuongDotXuat : "nhận"

    %% Đề xuất + Hệ thống
    TaiKhoan ||--o{ BangDeXuat : "tạo/duyệt"
    TaiKhoan ||--o{ ThongBao : "nhận"
    TaiKhoan ||--o{ SystemLog : "ghi log"
```

---

## C2 — Module Nhân sự & Tổ chức

```mermaid
erDiagram
    CoQuanDonVi ||--o{ DonViTrucThuoc : "có"
    CoQuanDonVi ||--o{ ChucVu : "có"
    DonViTrucThuoc ||--o{ ChucVu : "có"
    CoQuanDonVi ||--o{ QuanNhan : "thuộc về"
    DonViTrucThuoc ||--o{ QuanNhan : "thuộc về"
    ChucVu ||--o{ QuanNhan : "giữ"
    QuanNhan ||--o| TaiKhoan : "có tài khoản"
    QuanNhan ||--o{ LichSuChucVu : "có lịch sử"
    ChucVu ||--o{ LichSuChucVu : "thuộc"
```

---

## C3 — Module Khen thưởng cá nhân

```mermaid
erDiagram
    QuanNhan ||--o{ ThanhTichKhoaHoc : "có NCKH"
    QuanNhan ||--o{ DanhHieuHangNam : "đạt danh hiệu"
    QuanNhan ||--o{ KhenThuongHCCSVV : "nhận HCCSVV"
    QuanNhan ||--o| KhenThuongHCBVTQ : "nhận HCBVTQ"
    QuanNhan ||--o| HuanChuongQuanKyQuyetThang : "nhận HCQKQT"
    QuanNhan ||--o| KyNiemChuongVSNXDQDNDVN : "nhận KNC"
    QuanNhan ||--|| HoSoHangNam : "có hồ sơ"
    QuanNhan ||--|| HoSoNienHan : "có hồ sơ"
    QuanNhan ||--|| HoSoCongHien : "có hồ sơ"
```

---

## C4 — Module Khen thưởng đơn vị + Đột xuất

```mermaid
erDiagram
    CoQuanDonVi ||--o{ HoSoDonViHangNam : "có hồ sơ"
    DonViTrucThuoc ||--o{ HoSoDonViHangNam : "có hồ sơ"
    CoQuanDonVi ||--o{ DanhHieuDonViHangNam : "đạt danh hiệu"
    DonViTrucThuoc ||--o{ DanhHieuDonViHangNam : "đạt danh hiệu"
    QuanNhan ||--o{ KhenThuongDotXuat : "nhận"
    CoQuanDonVi ||--o{ KhenThuongDotXuat : "nhận"
    DonViTrucThuoc ||--o{ KhenThuongDotXuat : "nhận"
```

---

## C5 — Module Đề xuất + Quyết định

```mermaid
erDiagram
    TaiKhoan ||--o{ BangDeXuat : "đề xuất"
    TaiKhoan ||--o{ BangDeXuat : "duyệt"
    CoQuanDonVi ||--o{ BangDeXuat : "thuộc"
    DonViTrucThuoc ||--o{ BangDeXuat : "thuộc"

    FileQuyetDinh ||--o{ ThanhTichKhoaHoc : "có QĐ"
    FileQuyetDinh ||--o{ DanhHieuHangNam : "có QĐ"
    FileQuyetDinh ||--o{ KhenThuongHCCSVV : "có QĐ"
    FileQuyetDinh ||--o{ KhenThuongHCBVTQ : "có QĐ"
    FileQuyetDinh ||--o{ HuanChuongQuanKyQuyetThang : "có QĐ"
    FileQuyetDinh ||--o{ KyNiemChuongVSNXDQDNDVN : "có QĐ"
    FileQuyetDinh ||--o{ KhenThuongDotXuat : "có QĐ"
    FileQuyetDinh ||--o{ DanhHieuDonViHangNam : "có QĐ"
```

---

## C6 — Module Hệ thống

```mermaid
erDiagram
    TaiKhoan ||--o{ SystemLog : "ghi log"
    TaiKhoan ||--o{ ThongBao : "nhận TB"
    SystemLog ||--o{ ThongBao : "sinh ra"
```

---

## Ghi chú

- **`QuanNhan`** là entity trung tâm của module cá nhân — 9 bảng khen thưởng/hồ sơ tỏa ra từ đây.
- **`CoQuanDonVi`** là entity gốc của tổ chức — `DonViTrucThuoc`, `ChucVu`, `QuanNhan` đều tham chiếu về.
- **`FileQuyetDinh`** là entity dùng chung cho 8 bảng khen thưởng — tham chiếu qua `so_quyet_dinh` (text field, không phải `id`).
- **`KhenThuongDotXuat`** là **polymorphic**: chỉ 1 trong 3 FK (`quan_nhan_id` / `co_quan_don_vi_id` / `don_vi_truc_thuoc_id`) có giá trị tùy `doi_tuong` (CA_NHAN / TAP_THE).
