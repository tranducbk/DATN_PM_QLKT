# Sơ đồ Tuần tự (Sequence Diagrams)

> Bám sát style **báo cáo mẫu HUST**: lifeline gồm Actor + Page + Controller + Entity (4–6 lifeline). Message dùng ngôn ngữ nghiệp vụ tiếng Việt (vd: "Nhập thông tin đăng nhập", "Kiểm tra mật khẩu", "Lấy thông tin quân nhân"), tránh từ khóa dev (`verifyToken`, `prisma.$transaction`, ...).

---

## C4.1 — Tuần tự đăng nhập

```mermaid
sequenceDiagram
    actor User as Người dùng
    participant Page as TrangDangNhap
    participant Ctrl as TaiKhoanController
    participant Acc as TaiKhoan

    User->>Page: Nhập thông tin đăng nhập
    Page->>Page: validate
    Page->>Ctrl: yêu cầu đăng nhập
    Ctrl->>Acc: Lấy thông tin tài khoản
    Acc-->>Ctrl: thông tin
    Ctrl->>Ctrl: kiểm tra mật khẩu

    alt thành công
        Ctrl-->>Page: Thông tin tài khoản
        Page-->>User: Thông báo thành công và điều hướng đến trang chính
    else thất bại
        Ctrl-->>Page: Lỗi sai tài khoản hoặc mật khẩu
        Page-->>User: Hiển thị thông báo sai tài khoản hoặc mật khẩu
    end
```

---

## C4.2 — Tuần tự tạo đề xuất khen thưởng

```mermaid
sequenceDiagram
    actor MGR as Chỉ huy đơn vị
    actor ADM as Phòng Chính trị
    participant Page as TrangDeXuat
    participant Ctrl as DeXuatController
    participant DX as DeXuat
    participant TB as ThongBao

    MGR->>Page: Chọn loại đề xuất, năm và quân nhân
    Page->>Page: validate dữ liệu đầu vào
    Page->>Ctrl: yêu cầu tạo đề xuất
    Ctrl->>Ctrl: kiểm tra năm tháng và payload theo loại đề xuất

    alt dữ liệu không hợp lệ
        Ctrl-->>Page: Lỗi kèm chi tiết trường sai
        Page-->>MGR: Hiển thị thông báo lỗi
    else dữ liệu hợp lệ
        Ctrl->>DX: Lưu đề xuất với trạng thái Chờ duyệt
        DX-->>Ctrl: thông tin đề xuất
        Ctrl->>TB: Tạo thông báo cho Phòng Chính trị
        TB-->>ADM: Thông báo có đề xuất mới
        Ctrl-->>Page: Đã tạo đề xuất thành công
        Page-->>MGR: Hiển thị thông báo gửi đề xuất thành công
    end
```

**Lưu ý**: bước tạo đề xuất **không** chạy kiểm tra điều kiện chuỗi (BKBQP/CSTDTQ/BKTTCP) hay kiểm tra trùng lặp với khen thưởng đã có. Các kiểm tra đó chạy ở bước **phê duyệt** (xem C4.3) qua `runEligibilityChecks` + `runDuplicateChecks` để đảm bảo dữ liệu không bị "stale" giữa lúc Chỉ huy đơn vị tạo và Phòng Chính trị duyệt. Submit chỉ validate cấu trúc payload và năm/tháng hợp lệ.

---

## C4.3 — Tuần tự phê duyệt đề xuất khen thưởng

```mermaid
sequenceDiagram
    actor ADM as Phòng Chính trị
    actor MGR as Chỉ huy đơn vị
    actor QN as Quân nhân
    participant Page as TrangChiTietDeXuat
    participant Ctrl as DeXuatController
    participant DX as DeXuat
    participant KT as KhenThuong
    participant HS as HoSoQuanNhan
    participant TB as ThongBao

    ADM->>Page: Mở chi tiết đề xuất
    Page->>Ctrl: lấy đề xuất theo id
    Ctrl->>DX: tìm theo id
    DX-->>Ctrl: thông tin đề xuất
    Ctrl-->>Page: Hiển thị đề xuất

    ADM->>Page: Sửa số quyết định và đính kèm file PDF
    ADM->>Page: Phê duyệt đề xuất
    Page->>Ctrl: yêu cầu phê duyệt
    Ctrl->>Ctrl: kiểm tra trạng thái chưa duyệt và đúng tháng
    Ctrl->>Ctrl: kiểm tra trùng lặp với khen thưởng đã có
    Ctrl->>Ctrl: kiểm tra điều kiện chuỗi và niên hạn cống hiến
    Ctrl->>Ctrl: kiểm tra hợp lệ số quyết định

    alt validate fail
        Ctrl-->>Page: Lỗi kèm danh sách quân nhân không đủ điều kiện
        Page-->>ADM: Hiển thị lỗi để sửa lại
    else hợp lệ
        Ctrl->>KT: Lưu khen thưởng theo loại
        KT-->>Ctrl: đã lưu
        Ctrl->>DX: Cập nhật trạng thái Đã duyệt
        Ctrl->>HS: Tính lại hồ sơ quân nhân liên quan
        HS-->>Ctrl: hồ sơ mới

        Ctrl->>TB: Tạo thông báo cho Chỉ huy đơn vị
        TB-->>MGR: Thông báo đề xuất đã được duyệt
        Ctrl->>TB: Tạo thông báo cho Quân nhân được nhận khen thưởng
        TB-->>QN: Thông báo nhận khen thưởng

        Ctrl-->>Page: Phê duyệt thành công
        Page-->>ADM: Hiển thị thông báo phê duyệt thành công
    end
```

---

## C4.4 — Tuần tự tính lại điều kiện chuỗi (recalc)

```mermaid
sequenceDiagram
    participant Sys as Hệ thống
    participant DH as DanhHieuHangNam
    participant NCKH as ThanhTichKhoaHoc
    participant HS as HoSoHangNam

    Sys->>DH: Lấy danh hiệu các năm của quân nhân
    DH-->>Sys: danh sách danh hiệu
    Sys->>NCKH: Lấy thành tích khoa học các năm
    NCKH-->>Sys: danh sách thành tích

    Sys->>Sys: Tính chuỗi liên tục cho từng cấp BKBQP CSTDTQ BKTTCP
    Sys->>Sys: Kiểm tra cycle và lifetime block

    alt đã nhận BKTTCP
        Sys->>Sys: Áp lifetime block, đặt gợi ý chưa hỗ trợ cao hơn
    else
        Sys->>Sys: Sinh gợi ý theo điều kiện hiện tại
    end

    Sys->>HS: Cập nhật ba cờ điều kiện và gợi ý
    HS-->>Sys: hồ sơ đã cập nhật
```

---

## C4.5 — Tuần tự import Excel danh sách khen thưởng

```mermaid
sequenceDiagram
    actor ADM as Phòng Chính trị
    participant Page as TrangImport
    participant Ctrl as KhenThuongController
    participant Excel as Bộ xử lý Excel
    participant QN as QuanNhan
    participant KT as KhenThuong
    participant HS as HoSoQuanNhan

    ADM->>Page: Chọn file Excel theo loại khen thưởng
    Page->>Ctrl: gửi file xem trước
    Ctrl->>Excel: Đọc và kiểm tra cấu trúc file
    Excel-->>Ctrl: dữ liệu từng dòng
    Ctrl->>QN: Tìm quân nhân theo CCCD
    QN-->>Ctrl: danh sách quân nhân khớp
    Ctrl->>Ctrl: Kiểm tra điều kiện cho từng dòng
    Ctrl-->>Page: Bảng xem trước với dòng OK và dòng lỗi
    Page-->>ADM: Hiển thị bảng xem trước

    ADM->>Page: Xác nhận import các dòng OK
    Page->>Ctrl: xác nhận import
    Ctrl->>KT: Lưu khen thưởng cho từng dòng
    KT-->>Ctrl: đã lưu
    Ctrl->>HS: Tính lại hồ sơ quân nhân liên quan
    HS-->>Ctrl: hồ sơ mới
    Ctrl-->>Page: Báo cáo số dòng thành công và thất bại
    Page-->>ADM: Hiển thị kết quả import
```

---

## C4.6 — Tuần tự gửi thông báo realtime

```mermaid
sequenceDiagram
    participant Sys as Hệ thống
    participant TB as ThongBao
    participant Sock as Kênh Socket
    actor User as Người nhận

    Sys->>TB: Tạo thông báo cho người nhận
    TB-->>Sys: đã lưu
    Sys->>Sock: Phát thông báo theo người nhận
    Sock-->>User: Nhận thông báo realtime
    User->>Sock: Đánh dấu đã đọc
    Sock->>TB: Cập nhật trạng thái đã đọc
```

---

## C4.7 — Tuần tự xóa đề xuất khen thưởng

```mermaid
sequenceDiagram
    actor Actor as Người xóa
    actor MGR as Chỉ huy đơn vị
    actor ADM as Phòng Chính trị
    participant Page as TrangDeXuat
    participant Ctrl as DeXuatController
    participant DX as DeXuat
    participant TB as ThongBao

    Actor->>Page: Chọn xóa đề xuất
    Page->>Page: xác nhận thao tác
    Page->>Ctrl: yêu cầu xóa đề xuất
    Ctrl->>DX: tìm đề xuất theo id

    alt không tồn tại hoặc đã duyệt
        Ctrl-->>Page: Lỗi không thể xóa
        Page-->>Actor: Hiển thị thông báo lỗi
    else hợp lệ
        Ctrl->>DX: Xóa đề xuất
        DX-->>Ctrl: đã xóa

        Ctrl->>TB: Tạo thông báo cho Phòng Chính trị (trừ người xóa)
        TB-->>ADM: Thông báo đề xuất bị xóa

        opt Phòng Chính trị xóa đề xuất của Chỉ huy đơn vị
            Ctrl->>TB: Tạo thông báo cho Chỉ huy đơn vị đã đề xuất
            TB-->>MGR: Thông báo đề xuất của bạn đã bị xóa
        end

        Ctrl-->>Page: Đã xóa thành công
        Page-->>Actor: Hiển thị thông báo xóa thành công
    end
```

---

## C4.8 — Tuần tự sao lưu dữ liệu theo lịch

```mermaid
sequenceDiagram
    participant Cron as Lịch chạy tự động
    participant Backup as DichVuSaoLuu
    participant Setting as CauHinh
    participant Repos as Các bảng dữ liệu
    participant FS as Thư mục backups
    participant Log as NhatKyHeThong
    actor SA as Quản trị viên

    Cron->>Backup: Yêu cầu sao lưu định kỳ
    Backup->>Setting: Kiểm tra cấu hình bật sao lưu

    alt sao lưu bị tắt
        Setting-->>Backup: tắt
        Backup-->>Cron: Bỏ qua
    else bật
        Backup->>Repos: Đọc toàn bộ dữ liệu các bảng nghiệp vụ
        Repos-->>Backup: dữ liệu

        Backup->>Backup: Tạo nội dung file SQL từ dữ liệu
        Backup->>FS: Ghi file backup
        FS-->>Backup: đã ghi

        Backup->>Setting: Cập nhật thời điểm sao lưu gần nhất
        Backup->>Log: Ghi nhật ký sao lưu thành công
        Backup->>FS: Xóa file cũ vượt thời hạn lưu trữ
    end

    SA->>Log: Xem nhật ký sao lưu
    Log-->>SA: Danh sách lần sao lưu
```

---

## Tổng kết

| # | Sequence | Lifeline | Đặc điểm |
|---|---|---|---|
| C4.1 | Đăng nhập | 4 (Người dùng + TrangDangNhap + TaiKhoanController + TaiKhoan) | Có self-call validate + alt thành công thất bại |
| C4.2 | Tạo đề xuất | 5 | Có alt eligibility + thông báo cho Phòng Chính trị |
| C4.3 | Phê duyệt | 7 | 2 actor + alt validate + 2 thông báo (Chỉ huy đơn vị + Quân nhân) |
| C4.4 | Recalc chuỗi | 4 | Background process, có alt lifetime block |
| C4.5 | Import Excel | 6 | 2 bước Preview/Confirm |
| C4.6 | Thông báo realtime | 4 | Pub-sub qua kênh Socket |
| C4.7 | Xóa đề xuất | 7 | 3 actor + alt validate + opt thông báo cho người đề xuất |
| C4.8 | Sao lưu dữ liệu | 7 | Cron + alt bật/tắt |

**Style nguyên tắc** (theo báo cáo mẫu):
- Actor: tên Tiếng Việt nghiệp vụ ("Chỉ huy đơn vị", "Phòng Chính trị", "Quân nhân", "Người dùng")
- Page: PascalCase tiếng Việt theo trang ("TrangDangNhap", "TrangDeXuat", "TrangChiTietDeXuat")
- Controller: PascalCase + suffix Controller ("TaiKhoanController", "DeXuatController", "KhenThuongController")
- Entity: tên model nghiệp vụ ("TaiKhoan", "DeXuat", "KhenThuong", "HoSoQuanNhan", "ThongBao", "DanhHieuHangNam")
- Message: ngắn gọn nghiệp vụ tiếng Việt, không reveal implementation (không nói `prisma.$transaction`, `bcrypt.compare`, `Joi validate`...)
- `alt` cho nhánh thành công/thất bại, có nhãn rõ ràng
