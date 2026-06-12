# Sơ đồ Tuần tự (Sequence Diagrams)

> Bám sát style **báo cáo mẫu HUST**: lifeline gồm Actor + Page + Controller + Entity (4–6 lifeline). Message dùng ngôn ngữ nghiệp vụ tiếng Việt (vd: "Nhập thông tin đăng nhập", "Kiểm tra mật khẩu", "Lấy thông tin quân nhân"), tránh từ khóa dev (`verifyToken`, `prisma.$transaction`, ...).
>
> **Quy ước arrow**:
> - `->>` (liền, đầu kín) — sync call, caller đợi reply
> - `-->>` (nét đứt) — reply / return value
> - `->>` không kèm reply ở sau — async push, fire-and-forget (vd: realtime notification)
> - `create participant X` — khởi tạo instance X tại thời điểm đó (vd: Modal mount, Socket connect)
> - `destroy X` — hủy instance X
>
> **Pattern `alt` + return (Astah convention)**:
> Toàn bộ sơ đồ áp dụng pattern: **logic phân nhánh nằm trong `alt`**, **return nằm ngoài `alt`** với message dạng *"Kết quả (X hoặc Y)"*. Điều này phản ánh thực tế REST: controller xử lý nhánh thành công/thất bại bên trong, rồi trả về **một response duy nhất** cho client với payload hoặc error code khác nhau.
> ```
> alt nhánh hợp lệ
>     Ctrl->>DB: thao tác ghi dữ liệu
>     DB-->>Ctrl: kết quả
> else nhánh lỗi
>     Ctrl->>Ctrl: chuẩn bị thông báo lỗi
> end
> Ctrl-->>Page: Kết quả (thành công hoặc lỗi)   ← return DUY NHẤT sau alt
> Page-->>User: Hiển thị thông báo tương ứng
> ```
> Notification fire-and-forget (`opt thành công` sau return) chạy **sau** khi đã trả response cho user — phản ánh `void safeNotify(...)` trong code: lỗi gửi notification không ảnh hưởng response chính.

---

## C4.1 — Tuần tự đăng nhập

```mermaid
sequenceDiagram
    actor User as Người dùng
    participant Page as TrangDangNhap [UI]
    participant Ctrl as AuthController
    participant Acc as TaiKhoan [DB]

    User->>Page: Nhập thông tin đăng nhập
    Page->>Page: validate dữ liệu nhập
    Page->>Ctrl: yêu cầu đăng nhập
    Ctrl->>Acc: Lấy thông tin tài khoản
    Acc-->>Ctrl: thông tin tài khoản

    alt mật khẩu đúng
        Ctrl->>Ctrl: tạo access token và refresh token
    else mật khẩu sai hoặc tài khoản không tồn tại
        Ctrl->>Ctrl: chuẩn bị thông báo lỗi
    end

    Ctrl-->>Page: Kết quả (token hoặc lỗi)
    Page-->>User: Điều hướng trang chính hoặc hiển thị lỗi
```

---

## C4.2 — Tuần tự tạo đề xuất khen thưởng

```mermaid
sequenceDiagram
    actor MGR as Chỉ huy đơn vị
    actor ADM as Phòng Chính trị
    participant Page as TrangDeXuat [UI]
    participant Ctrl as DeXuatController
    participant Svc as DeXuatService
    participant Strat as DeXuatStrategy
    participant DX as DeXuat [DB]
    participant TB as ThongBao [DB]

    MGR->>Page: Chọn loại đề xuất, năm và quân nhân
    Page->>Page: validate dữ liệu đầu vào
    Page->>Ctrl: yêu cầu tạo đề xuất
    Ctrl->>Svc: tạo đề xuất theo loại
    Svc->>Svc: kiểm tra năm tháng và quyền theo loại đề xuất

    alt dữ liệu hợp lệ
        Svc->>Strat: dựng dữ liệu đề xuất theo loại
        Strat-->>Svc: payload đề xuất
        Svc->>DX: Lưu đề xuất với trạng thái Chờ duyệt
        DX-->>Svc: thông tin đề xuất đã lưu
    else dữ liệu không hợp lệ
        Svc->>Svc: chuẩn bị thông báo lỗi kèm trường sai
    end

    Svc-->>Ctrl: Kết quả tạo đề xuất
    Ctrl-->>Page: Kết quả (đề xuất đã tạo hoặc lỗi)
    Page-->>MGR: Hiển thị thông báo thành công hoặc lỗi

    Note over Ctrl,TB: Notification fire-and-forget — chạy sau response, chỉ khi tạo thành công
    opt tạo thành công
        Ctrl->>TB: Tạo thông báo cho Phòng Chính trị
        TB-->>Ctrl: đã lưu
        TB->>ADM: Đẩy thông báo có đề xuất mới
    end
```

**Lưu ý**:
1. **Tầng phân lớp**: `DeXuatController` uỷ thác cho `DeXuatService.submitProposal`, service gọi `DeXuatStrategy.buildSubmitPayload` để **dựng payload theo từng loại đề xuất** rồi mới lưu. Map code: `submit.ts` → `getProposalStrategy(type).buildSubmitPayload` (`services/proposal/strategies/`).
2. Bước tạo đề xuất **không** chạy kiểm tra điều kiện chuỗi (BKBQP/CSTDTQ/BKTTCP) hay kiểm tra trùng lặp với khen thưởng đã có. Các kiểm tra đó chạy ở bước **phê duyệt** (xem C4.3) qua `runEligibilityChecks` + `runDuplicateChecks` để đảm bảo dữ liệu không bị "stale" giữa lúc Chỉ huy đơn vị tạo và Phòng Chính trị duyệt. Submit chỉ validate cấu trúc payload và năm/tháng hợp lệ.
3. Reply cho Chỉ huy đơn vị **trả về trước** khi notification chạy — vì notification là side-effect fire-and-forget (`void safeNotify` trong code), lỗi gửi thông báo không ảnh hưởng việc tạo đề xuất.

---

## C4.3 — Tuần tự phê duyệt đề xuất khen thưởng

```mermaid
sequenceDiagram
    actor ADM as Phòng Chính trị
    actor MGR as Chỉ huy đơn vị
    actor QN as Quân nhân
    participant Page as TrangChiTietDeXuat [UI]
    participant Ctrl as DeXuatController
    participant Svc as DeXuatService
    participant Strat as DeXuatStrategy
    participant DX as DeXuat [DB]
    participant KT as KhenThuong [DB]
    participant HS as HoSoHangNam / HoSoNienHan / HoSoCongHien [DB]
    participant TB as ThongBao [DB]

    ADM->>Page: Mở chi tiết đề xuất
    Page->>Ctrl: lấy đề xuất theo id
    Ctrl->>Svc: lấy chi tiết đề xuất
    Svc->>DX: tìm theo id
    DX-->>Svc: thông tin đề xuất
    Svc-->>Ctrl: chi tiết đề xuất
    Ctrl-->>Page: Chi tiết đề xuất
    Page-->>ADM: Hiển thị chi tiết

    ADM->>Page: Sửa số quyết định, đính kèm PDF rồi Phê duyệt
    Page->>Ctrl: yêu cầu phê duyệt
    Ctrl->>Svc: phê duyệt đề xuất theo id
    Svc->>Svc: kiểm tra trạng thái, trùng lặp, điều kiện, số quyết định

    alt validate pass
        rect rgb(234, 240, 252)
            Note over Svc,DX: Một giao dịch (transaction) — hoặc tất cả thành công, hoặc hoàn tác
            Svc->>Strat: ghi khen thưởng theo loại đề xuất
            Strat->>KT: Lưu khen thưởng
            KT-->>Strat: đã lưu
            Strat-->>Svc: hoàn tất ghi
            Svc->>DX: Cập nhật trạng thái Đã duyệt
            DX-->>Svc: đã cập nhật
        end
        Svc->>HS: Tính lại hồ sơ tương ứng (sau transaction)
        HS-->>Svc: hồ sơ mới
    else validate fail
        Svc->>Svc: chuẩn bị danh sách quân nhân không đủ điều kiện
    end

    Svc-->>Ctrl: Kết quả phê duyệt
    Ctrl-->>Page: Kết quả (thành công hoặc lỗi)
    Page-->>ADM: Hiển thị thông báo thành công hoặc lỗi

    Note over Ctrl,TB: Notification fire-and-forget — chỉ chạy khi phê duyệt thành công
    opt phê duyệt thành công
        Ctrl->>TB: Tạo thông báo cho Chỉ huy đơn vị
        TB-->>Ctrl: đã lưu
        TB->>MGR: Đẩy thông báo đề xuất đã được duyệt
        Ctrl->>TB: Tạo thông báo cho Quân nhân được nhận khen thưởng
        TB-->>Ctrl: đã lưu
        TB->>QN: Đẩy thông báo nhận khen thưởng
    end
```

**Lưu ý** (bản chi tiết — vẽ rõ tầng Service/Strategy + transaction):
1. **Tầng phân lớp**: khác bản giản lược (Controller ghi thẳng Entity), bản này vẽ rõ **`DeXuatService`** điều phối và **`DeXuatStrategy`** ghi khen thưởng theo từng loại đề xuất — đúng kiến trúc Controller→Service→Strategy→Repository và mẫu Strategy mà báo cáo nhấn mạnh. Map code: `proposalService.approveProposal` (`services/proposal/approve.ts`) gọi `runImportTransaction` (`approve/import.ts`), dispatch `strategy.importInTransaction()` theo loại đề xuất (`services/proposal/strategies/`).
2. **Khung `rect` = ranh giới transaction**: phần "Lưu khen thưởng" + "Cập nhật trạng thái Đã duyệt" chạy trong **một `prisma.$transaction`** (`approve/import.ts:64`) — all-or-nothing; nếu một insert fail thì rollback toàn bộ, đề xuất giữ trạng thái PENDING. Bước **tính lại hồ sơ** đặt **ngoài** khung vì code recalc *sau* khi transaction commit.
3. Reply cho Phòng Chính trị **trả về trước** khi notification chạy — admin nhận response ngay (`void safeNotify` trong `proposal.controller.ts:171–195`).
4. **Tên model hồ sơ** tùy loại đề xuất: `HoSoHangNam` cho danh hiệu BKBQP/CSTDTQ/BKTTCP, `HoSoNienHan` cho HCCSVV, `HoSoCongHien` cho HCBVTQ — không gộp vào một bảng "HoSoQuanNhan".

---

## C4.4 — Tuần tự tính lại điều kiện khen thưởng

```mermaid
sequenceDiagram
    participant Sys as Hệ thống [SV]
    participant DH as DanhHieuHangNam [DB]
    participant NCKH as ThanhTichKhoaHoc [DB]
    participant HS as HoSoHangNam [DB]

    Sys->>DH: Lấy danh hiệu các năm của quân nhân
    DH-->>Sys: danh sách danh hiệu
    Sys->>NCKH: Lấy thành tích khoa học các năm
    NCKH-->>Sys: danh sách thành tích

    Sys->>Sys: Tính số năm liên tục cho từng cấp BKBQP / CSTDTQ / BKTTCP
    Sys->>Sys: Kiểm tra điều kiện lặp lại theo chu kỳ và giới hạn BKTTCP

    alt đã nhận BKTTCP (lifetime block)
        Sys->>Sys: Đặt gợi ý chưa hỗ trợ danh hiệu cao hơn
    else chưa đạt giới hạn lifetime
        Sys->>Sys: Sinh gợi ý theo điều kiện hiện tại
    end

    Sys->>HS: Cập nhật ba cờ điều kiện và gợi ý vào HoSoHangNam
    HS-->>Sys: hồ sơ đã cập nhật
```

---

## C4.5 — Tuần tự nhập danh sách khen thưởng từ Excel

```mermaid
sequenceDiagram
    actor ADM as Phòng Chính trị
    participant Page as TrangImport [UI]
    participant Ctrl as KhenThuongController
    participant Excel as Bộ xử lý Excel [SV]
    participant QN as QuanNhan [DB]
    participant KT as KhenThuong [DB]
    participant HS as HoSoQuanNhan [DB]

    Note over ADM,Page: Giai đoạn 1 — Xem trước
    ADM->>Page: Chọn file Excel theo loại khen thưởng
    Page->>Ctrl: gửi file xem trước
    Ctrl->>Excel: Đọc và kiểm tra cấu trúc file
    Excel-->>Ctrl: dữ liệu từng dòng
    Ctrl->>QN: Tìm quân nhân theo CCCD
    QN-->>Ctrl: danh sách quân nhân khớp
    Ctrl->>Ctrl: validate điều kiện từng dòng (dòng OK / dòng lỗi)

    alt file hợp lệ (có ít nhất một dòng OK)
        Ctrl->>Ctrl: build bảng preview phân loại
    else file lỗi cấu trúc
        Ctrl->>Ctrl: chuẩn bị message lỗi cấu trúc
    end

    Ctrl-->>Page: Kết quả xem trước (bảng phân loại hoặc lỗi)
    Page-->>ADM: Hiển thị bảng preview hoặc lỗi

    Note over ADM,Page: Giai đoạn 2 — Xác nhận lưu
    ADM->>Page: Xác nhận nhập các dòng hợp lệ
    Page->>Ctrl: xác nhận nhập dữ liệu

    alt có dòng hợp lệ để lưu
        Ctrl->>KT: Lưu khen thưởng cho từng dòng (trong transaction)
        KT-->>Ctrl: đã lưu
        Ctrl->>HS: Tính lại hồ sơ quân nhân liên quan
        HS-->>Ctrl: hồ sơ mới
    else không có dòng hợp lệ
        Ctrl->>Ctrl: chuẩn bị message không có gì để lưu
    end

    Ctrl-->>Page: Kết quả (số dòng thành công / thất bại hoặc lỗi)
    Page-->>ADM: Hiển thị kết quả nhập dữ liệu
```

**Lưu ý**: hai giai đoạn Preview / Confirm là **2 endpoint REST riêng biệt** — `POST /import/preview` và `POST /import/confirm` (định nghĩa ở `routes/{tenureMedal,contributionMedal,commemorativeMedal,militaryFlag,annualReward,unitAnnualAward,scientificAchievement}.route.ts`). Preview chỉ validate + trả bảng phân loại, không ghi DB. Confirm ghi DB trong transaction sau khi ADM xác nhận. State giữa 2 lần gọi không lưu phía server — FE giữ file/data tạm và gửi lại ở Confirm.

---

## C4.6 — Tuần tự gửi thông báo realtime (Socket.IO)

```mermaid
sequenceDiagram
    actor User as Người dùng
    participant Page as TrangBatKy [UI]
    participant Server as SocketServer [SV]
    participant Sys as Nghiệp vụ phát thông báo [SV]
    participant TB as ThongBao [DB]

    Note over Page,Server: Giai đoạn 1 — Sau khi đăng nhập thành công
    create participant Sock as :SocketClient [UI]
    Page->>Sock: khởi tạo socket với token
    Sock->>Server: handshake với JWT

    alt token hợp lệ
        Server->>Server: join room user_{userId}
    else token hết hạn hoặc sai
        Server->>Server: chuẩn bị disconnect
    end

    Server-->>Sock: Kết quả handshake (connected hoặc disconnect)

    Note over Sys,Server: Giai đoạn 2 — Khi có sự kiện nghiệp vụ (vd: phê duyệt đề xuất)
    Sys->>TB: Tạo thông báo cho người nhận
    TB-->>Sys: đã lưu
    Sys->>Server: Phát sự kiện tới room user_{recipientId}
    Server->>Sock: Đẩy event realtime
    Sock->>Page: cập nhật badge và toast
    Page-->>User: Hiển thị thông báo

    Note over User,TB: Giai đoạn 3 — User đánh dấu đã đọc
    User->>Page: Click thông báo
    Page->>Server: Cập nhật trạng thái đã đọc
    Server->>TB: Update is_read = true
    TB-->>Server: đã cập nhật
    Server-->>Page: Kết quả cập nhật

    Note over Page,Sock: Giai đoạn 4 — Đăng xuất hoặc đóng tab
    Page->>Sock: yêu cầu ngắt kết nối
    Sock->>Server: ngắt kết nối
    destroy Sock
```

**Đặc điểm**: lifeline `SocketClient` **được khởi tạo** (`«create»`) ngay sau login và **bị hủy** (`destroy`) khi logout/đóng tab — phản ánh đúng vòng đời connection trong code (`hooks/useSocket.ts` gọi `io()` khi mount, `socket.disconnect()` khi unmount).

---

## C4.7 — Tuần tự xóa đề xuất khen thưởng

```mermaid
sequenceDiagram
    actor Actor as Người xóa
    actor MGR as Chỉ huy đơn vị
    actor ADM as Phòng Chính trị
    participant Page as TrangDeXuat [UI]
    participant Ctrl as DeXuatController
    participant DX as DeXuat [DB]
    participant TB as ThongBao [DB]

    Actor->>Page: Chọn xóa đề xuất
    Page->>Page: xác nhận thao tác
    Page->>Ctrl: yêu cầu xóa đề xuất
    Ctrl->>DX: tìm đề xuất theo id

    alt trạng thái PENDING (cho phép xóa)
        Ctrl->>DX: Xóa đề xuất
        DX-->>Ctrl: đã xóa
    else không tồn tại hoặc đã APPROVED / REJECTED
        Ctrl->>Ctrl: chuẩn bị message không thể xóa
    end

    Ctrl-->>Page: Kết quả (đã xóa hoặc lỗi)
    Page-->>Actor: Hiển thị thông báo thành công hoặc lỗi

    Note over Ctrl,TB: Notification fire-and-forget — chỉ chạy khi xóa thành công
    opt xóa thành công
        Ctrl->>TB: Tạo thông báo cho Phòng Chính trị (trừ người xóa)
        TB-->>Ctrl: đã lưu
        TB->>ADM: Đẩy thông báo đề xuất bị xóa

        opt Phòng Chính trị xóa đề xuất của Chỉ huy đơn vị
            Ctrl->>TB: Tạo thông báo cho Chỉ huy đơn vị đã đề xuất
            TB-->>Ctrl: đã lưu
            TB->>MGR: Đẩy thông báo đề xuất của bạn đã bị xóa
        end
    end
```

---

## C4.8 — Tuần tự sao lưu dữ liệu theo lịch

```mermaid
sequenceDiagram
    actor SA as Quản trị viên
    participant Page as TrangDevZone [UI]
    participant Ctrl as DevZoneController
    participant Backup as DichVuSaoLuu [SV]
    participant Setting as CauHinh [DB]
    participant Repos as Các bảng dữ liệu [DB]
    participant FS as Thư mục backups [FS]
    participant Log as NhatKyHeThong [DB]

    Note over SA,Ctrl: Giai đoạn 1 — Bật lịch sao lưu tự động
    SA->>Page: Bật "Sao lưu tự động"
    Page->>Ctrl: yêu cầu bật lịch
    Ctrl->>Setting: Lưu cron_enabled = true
    create participant Cron as :ScheduledTask [Cron]
    Ctrl->>Cron: lên lịch theo biểu thức cron
    Cron-->>Ctrl: task active
    Ctrl-->>Page: đã bật
    Page-->>SA: Hiển thị trạng thái đã bật

    Note over Cron,Backup: Giai đoạn 2 — Khi đến mốc cron (vd: 01h ngày 1 hằng tháng)
    loop Mỗi chu kỳ cron
        Cron->>Backup: Yêu cầu sao lưu định kỳ
        Backup->>Setting: Kiểm tra cấu hình bật sao lưu
        Setting-->>Backup: trạng thái cron_enabled

        alt sao lưu đang bật
            Backup->>Repos: Đọc toàn bộ dữ liệu các bảng nghiệp vụ
            Repos-->>Backup: dữ liệu
            Backup->>Backup: Tạo nội dung file SQL
            Backup->>FS: Ghi file backup
            FS-->>Backup: đã ghi
            Backup->>Setting: Cập nhật thời điểm sao lưu gần nhất
            Backup->>Log: Ghi nhật ký sao lưu thành công
            Backup->>FS: Xóa file cũ vượt thời hạn lưu trữ
        else sao lưu bị tắt
            Backup->>Backup: chuẩn bị message bỏ qua
        end

        Backup-->>Cron: Kết quả chu kỳ (đã sao lưu hoặc bỏ qua)
    end

    Note over SA,Cron: Giai đoạn 3 — Tắt lịch
    SA->>Page: Tắt "Sao lưu tự động"
    Page->>Ctrl: yêu cầu tắt lịch
    Ctrl->>Cron: dừng task
    destroy Cron
    Ctrl->>Setting: Lưu cron_enabled = false
    Ctrl-->>Page: đã tắt
    Page-->>SA: Hiển thị trạng thái đã tắt

    Note over SA,Log: Giai đoạn 4 — Xem nhật ký
    SA->>Log: Xem nhật ký sao lưu
    Log-->>SA: Danh sách lần sao lưu
```

**Đặc điểm**: lifeline `ScheduledTask` **được tạo** khi SA bật lịch và **bị hủy** khi tắt — phản ánh `node-cron.schedule()` / `task.stop()` trong `routes/devZone.route.ts`.

---

## C4.9 — Tuần tự thêm khen thưởng đột xuất

```mermaid
sequenceDiagram
    actor ADM as Phòng Chính trị
    actor MGR as Chỉ huy đơn vị
    actor QN as Quân nhân
    participant Page as TrangKhenThuongDotXuat [UI]
    participant Ctrl as KhenThuongDotXuatController
    participant Quan as QuanNhan [DB]
    participant DV as DonVi [DB]
    participant KT as KhenThuongDotXuat [DB]
    participant FS as Thư mục files [FS]
    participant TB as ThongBao [DB]

    ADM->>Page: Click "Thêm khen thưởng đột xuất"
    create participant Modal as :ModalThemKhenThuong [UI]
    Page->>Modal: mở modal
    Modal->>Ctrl: lấy danh sách quân nhân và đơn vị
    Ctrl->>Quan: Lấy danh sách quân nhân
    Quan-->>Ctrl: danh sách
    Ctrl->>DV: Lấy danh sách đơn vị
    DV-->>Ctrl: danh sách
    Ctrl-->>Modal: dữ liệu chọn
    Modal-->>ADM: Hiển thị form

    ADM->>Modal: Chọn loại đối tượng cá nhân hoặc tập thể, danh hiệu, lý do
    ADM->>Modal: Đính kèm file quyết định PDF
    ADM->>Modal: Submit
    Modal->>Modal: validate dữ liệu đầu vào
    Modal->>Ctrl: yêu cầu tạo khen thưởng đột xuất
    Ctrl->>Ctrl: kiểm tra cấu trúc dữ liệu và loại đối tượng

    alt validate pass
        Ctrl->>FS: Lưu file quyết định
        FS-->>Ctrl: đường dẫn file
        Ctrl->>KT: Lưu khen thưởng đột xuất
        KT-->>Ctrl: đã lưu
    else validate fail
        Ctrl->>Ctrl: chuẩn bị message lỗi kèm trường sai
    end

    Ctrl-->>Modal: Kết quả (tạo thành công hoặc lỗi)

    alt tạo thành công
        Modal->>Page: thông báo thành công
        Page->>Modal: đóng modal
        destroy Modal
        Page->>Page: refresh danh sách
        Page-->>ADM: Hiển thị "Đã thêm" và danh sách mới
    else lỗi
        Modal-->>ADM: Hiển thị lỗi để sửa lại
    end

    Note over Ctrl,TB: Notification fire-and-forget — chỉ chạy khi tạo thành công, branching theo doi_tuong trong notifications.ts
    opt tạo thành công
        alt khen thưởng cá nhân (doi_tuong = CA_NHAN)
            Ctrl->>TB: Tạo thông báo cho Quân nhân nhận khen thưởng
            TB-->>Ctrl: đã lưu
            TB->>QN: Đẩy thông báo nhận khen thưởng đột xuất
            Ctrl->>TB: Tạo thông báo cho Chỉ huy đơn vị của Quân nhân
            TB-->>Ctrl: đã lưu
            TB->>MGR: Đẩy thông báo quân nhân trong đơn vị được khen thưởng
        else khen thưởng tập thể (doi_tuong = TAP_THE)
            Ctrl->>TB: Tạo thông báo cho Chỉ huy đơn vị
            TB-->>Ctrl: đã lưu
            TB->>MGR: Đẩy thông báo đơn vị được khen thưởng đột xuất
        end
    end
```

**Đặc điểm**:
1. **Modal lifecycle với «create» / `destroy`**: `ModalThemKhenThuong` chỉ tồn tại từ khi ADM click "Thêm" đến khi Submit thành công hoặc Cancel — phản ánh React component mount/unmount động (`CreateAdhocAwardModal.tsx`).
2. **Khác đề xuất thông thường**: ADMIN tạo trực tiếp, không qua bước MANAGER đề xuất rồi ADMIN duyệt (3 cấp). Đây là khen thưởng theo sự kiện / chiến công cần ghi nhận tức thì.
3. **Không qua bảng `BangDeXuat`**: ghi thẳng vào `KhenThuongDotXuat` riêng — không có trạng thái PENDING/APPROVED.
4. **Phân nhánh recipient**: cá nhân → thông báo cho Quân nhân + Chỉ huy đơn vị; tập thể → chỉ thông báo Chỉ huy đơn vị.

---

## Tổng kết

| # | Sequence | Lifeline | Đặc điểm |
|---|---|---|---|
| C4.1 | Đăng nhập | 4 (Người dùng + TrangDangNhap + AuthController + TaiKhoan) | alt logic + return ngoài alt |
| C4.2 | Tạo đề xuất | 8 | **bản chi tiết**: thêm tầng Service + Strategy (buildSubmitPayload theo loại); alt validate + opt notification |
| C4.3 | Phê duyệt | 11 | **bản chi tiết**: thêm tầng Service + Strategy + khung `rect` transaction; recalc ngoài transaction; opt notification 2 nhánh |
| C4.4 | Recalc chuỗi | 4 | Background process, alt lifetime block + return cập nhật hồ sơ |
| C4.5 | Import Excel | 6 | **2 endpoint REST riêng** Preview / Confirm — mỗi giai đoạn có alt + return |
| C4.6 | Thông báo realtime | 6 | **`«create»/destroy` SocketClient** + 4 giai đoạn handshake/push/read/disconnect |
| C4.7 | Xóa đề xuất | 7 | 3 actor + alt PENDING-only + opt notification phân nhánh role |
| C4.8 | Sao lưu dữ liệu | 9 | **`«create»/destroy` ScheduledTask** + loop cron với alt enable/disable |
| C4.9 | Thêm khen thưởng đột xuất | 9 | **`«create»/destroy` Modal** + alt validate + opt notification phân nhánh CA_NHAN/TAP_THE |

**Style nguyên tắc** (theo báo cáo mẫu):
- Actor: tên Tiếng Việt nghiệp vụ ("Chỉ huy đơn vị", "Phòng Chính trị", "Quân nhân", "Người dùng")
- Page: PascalCase tiếng Việt theo trang ("TrangDangNhap", "TrangDeXuat", "TrangChiTietDeXuat", "TrangKhenThuongDotXuat")
- Controller: PascalCase + suffix Controller ("AuthController", "DeXuatController", "KhenThuongController", "KhenThuongDotXuatController", "DevZoneController")
- Entity: tên model nghiệp vụ ("TaiKhoan", "DeXuat", "KhenThuong", "KhenThuongDotXuat", "HoSoHangNam", "HoSoNienHan", "HoSoCongHien", "ThongBao", "DanhHieuHangNam")
- Message: ngắn gọn nghiệp vụ tiếng Việt, không reveal implementation (không nói `prisma.$transaction`, `bcrypt.compare`, `Zod validate`...)
- `alt` cho nhánh thành công/thất bại, có nhãn rõ ràng
- `opt` cho điều kiện optional (vd: chỉ chạy khi điều kiện cụ thể)
- `loop` cho chu kỳ lặp (vd: cron tick, for each personnel)
- `Note over X,Y` cho ghi chú nội dung quan trọng (vd: transaction boundary, fire-and-forget)

**Khi nào dùng `«create»` / `destroy`**:
- Lifeline có **vòng đời rõ ràng** trong sequence (mount/unmount, connect/disconnect, schedule/stop)
- C4.6 — SocketClient (login → logout)
- C4.8 — ScheduledTask (enable cron → disable cron)
- C4.9 — Modal (open → close)
- **Không dùng** cho entity DB (Prisma model luôn tồn tại — chỉ insert row, không tạo object mới)

**Notification fire-and-forget pattern**:
Tất cả notification (`Ctrl → TB → User`) **chạy sau** khi đã trả response cho actor gốc (`Ctrl-->>Page-->>Actor`). Phản ánh `void safeNotify(...)` trong `proposal.controller.ts` và `void (async () => {...})()` trong `awardBulk.service.ts` — lỗi gửi thông báo **không ảnh hưởng** kết quả nghiệp vụ. Diagram đặt block notification ở **sau reply chain** + kèm `Note over` để diễn tả intent.
