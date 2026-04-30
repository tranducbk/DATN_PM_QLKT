# Sơ đồ Use Case (Mermaid)

> **Render**: Copy block `mermaid` vào https://mermaid.live hoặc dùng VSCode Mermaid Preview extension. Để xuất PNG/SVG cho báo cáo, dùng `mermaid.live` → Export.
>
> **Lưu ý**: Mermaid không có syntax UML use case "thuần", nên ở đây dùng `flowchart LR` với:
> - Actor: hình `(((Tên Actor)))` (oval đôi)
> - Use case: hình `(Tên use case)` (oval)
> - Hệ thống: gói `subgraph`
> - `<<extend>>` / `<<include>>`: cạnh nét đứt `-.->`

---

## A1.1 — Use case tổng quát

```mermaid
flowchart LR
    SA(((Quản trị viên)))
    AD(((Phòng Chính trị)))
    MG(((Chỉ huy đơn vị)))
    US(((Người dùng)))

    subgraph SYS[Hệ thống Quản lý Khen thưởng]
        UC1(Đăng nhập)
        UC2(Quản lý tài khoản)
        UC3(Quản lý quân nhân)
        UC4(Quản lý đơn vị)
        UC5(Khen thưởng hằng năm)
        UC6(Khen thưởng niên hạn)
        UC7(Khen thưởng cống hiến)
        UC8(Khen thưởng thành tích khoa học)
        UC9(Khen thưởng đột xuất)
        UC10(Đề xuất khen thưởng)
        UC11(Kiểm tra điều kiện và gợi ý)
        UC12(Thông báo realtime)
        UC13(Xem nhật ký hệ thống)
        UC14(Sao lưu và khôi phục)
        UC15(Báo cáo và thống kê)
    end

    SA --- UC1
    AD --- UC1
    MG --- UC1
    US --- UC1

    SA --- UC2
    AD --- UC2
    SA --- UC13
    SA --- UC14

    AD --- UC3
    AD --- UC4
    AD --- UC5
    AD --- UC6
    AD --- UC7
    AD --- UC8
    AD --- UC9
    AD --- UC10
    AD --- UC13
    AD --- UC15

    MG --- UC3
    MG --- UC5
    MG --- UC6
    MG --- UC7
    MG --- UC8
    MG --- UC9
    MG --- UC10
    MG --- UC11
    MG --- UC13
    MG --- UC15

    US --- UC11
    US --- UC12
    SA --- UC12
    AD --- UC12
    MG --- UC12
```

**Mô tả**: 4 actor truy cập hệ thống qua 15 nhóm chức năng. SUPER_ADMIN có quyền cao nhất (backup, xem log resource = 'backup'). ADMIN cùng SUPER_ADMIN quản lý tài khoản (cùng dùng `requireAdmin`). MANAGER có thể xem nhật ký hệ thống (route dùng `requireManager`) nhưng bị filter bỏ log backup. USER chủ yếu xem hồ sơ cá nhân và nhận thông báo.

**Phân nhóm khen thưởng theo nghiệp vụ** (5 nhóm — mỗi nhóm có sơ đồ phân rã riêng):
- **UC5 Hằng năm** — danh hiệu theo từng năm. Phân rã thành **cá nhân hằng năm** (CSTDCS / CSTT / BKBQP / CSTDTQ / BKTTCP — xem A1.5) và **đơn vị hằng năm** (ĐVQT / ĐVTT / BKBQP đơn vị / BKTTCP đơn vị — xem A1.6).
- **UC6 Niên hạn** — xét theo **thời gian phục vụ**: HCCSVV (10/15/20 năm), HCQKQT (25 năm), KNC VSNXD QĐNDVN (25 nam / 20 nữ năm). Xem A1.7.
- **UC7 Cống hiến** — xét theo **120 tháng tích lũy hệ số chức vụ**: HCBVTQ (Huân chương Bảo vệ Tổ quốc). Xem A1.7.
- **UC8 Thành tích khoa học** — xét theo **kết quả nghiên cứu**: NCKH gồm đề tài (ĐTKH) và sáng kiến khoa học (SKKH). Khớp với `AWARD_LABELS[scientific-achievements] = "Thành tích khoa học"`. Xem A1.7.
- **UC9 Đột xuất** — khen thưởng theo **sự kiện / chiến công** không theo lịch định kỳ, đính kèm file quyết định. ADMIN tạo trực tiếp qua module riêng `adhoc-awards`, không qua flow đề xuất 3 cấp. Xem A1.9.

> Sơ đồ tổng quan **không** vẽ quan hệ `<<include>>` / `<<extend>>` giữa các use case (notify realtime, audit log, eligibility check là side-effect / orthogonal concerns). Các quan hệ chi tiết được mô tả trong từng sơ đồ phân rã A1.2 – A1.14.

---

## A1.2 — Use case phân rã: Quản lý tài khoản và phân quyền

```mermaid
flowchart LR
    SA(((Quản trị viên)))
    AD(((Phòng Chính trị)))

    subgraph SYS[Quản lý tài khoản]
        UC1(Tạo tài khoản mới)
        UC2(Cập nhật thông tin tài khoản)
        UC3(Khóa hoặc mở tài khoản)
        UC4(Đổi mật khẩu)
        UC5(Gán vai trò)
        UC6(Đặt lại mật khẩu)
        UC7(Xem danh sách tài khoản)
        UC8(Tìm kiếm và lọc tài khoản)
        UC9(Liên kết tài khoản với quân nhân)

        UC1 -.->|include| UC5
        UC1 -.->|include| UC9
        UC2 -.->|extend| UC5
        UC4 -.->|extend| UC6
    end

    SA --- UC1
    SA --- UC2
    SA --- UC3
    SA --- UC4
    SA --- UC5
    SA --- UC6
    SA --- UC7
    SA --- UC8
    SA --- UC9

    AD --- UC1
    AD --- UC2
    AD --- UC3
    AD --- UC4
    AD --- UC5
    AD --- UC6
    AD --- UC7
    AD --- UC8
    AD --- UC9
```

**Quyền**: route `/api/accounts` dùng middleware `requireAdmin` → cả SUPER_ADMIN (Quản trị viên) và ADMIN (Phòng Chính trị) đều có thể tạo / sửa / khóa / reset / xoá tài khoản.

---

## A1.3 — Use case phân rã: Quản lý quân nhân

```mermaid
flowchart LR
    SA(((Quản trị viên)))
    AD(((Phòng Chính trị)))
    MG(((Chỉ huy đơn vị)))

    subgraph SYS[Quản lý quân nhân]
        UC1(Thêm quân nhân mới qua form)
        UC2(Cập nhật thông tin quân nhân)
        UC3(Xóa quân nhân)
        UC4(Xem chi tiết hồ sơ quân nhân)
        UC5(Tìm kiếm và lọc theo đơn vị)
        UC6(Chuyển đơn vị qua update co_quan_don_vi_id và don_vi_truc_thuoc_id)
        UC7(Quản lý lịch sử chức vụ LichSuChucVu)
        UC8(Xuất danh sách ra Excel /api/personnel/export)
        UC9(Xem cây đơn vị và chọn quân nhân)
        UC10(Quản lý NCKH ThanhTichKhoaHoc của quân nhân)
        UC11(Kiểm tra điều kiện cống hiến /check-contribution-eligibility)

        UC1 -.->|include| UC7
        UC2 -.->|extend| UC6
        UC4 -.->|include| UC11
    end

    SA --- UC1
    SA --- UC2
    SA --- UC3
    SA --- UC4
    SA --- UC5
    SA --- UC6
    SA --- UC8
    SA --- UC9
    SA --- UC10
    SA --- UC11

    AD --- UC1
    AD --- UC2
    AD --- UC3
    AD --- UC4
    AD --- UC5
    AD --- UC6
    AD --- UC8
    AD --- UC9
    AD --- UC10
    AD --- UC11

    MG --- UC2
    MG --- UC4
    MG --- UC5
    MG --- UC6
    MG --- UC9
    MG --- UC10
    MG --- UC11
```

**Phân quyền route**:
- POST/DELETE/EXPORT (`/api/personnel`): `requireAdmin` → SUPER_ADMIN + ADMIN.
- PUT `/api/personnel/:id`: `requireManager` → SUPER_ADMIN + ADMIN + MANAGER (MANAGER chỉ sửa quân nhân thuộc đơn vị quản lý).
- GET list / detail: MANAGER xem được trong phạm vi đơn vị; USER chỉ xem hồ sơ của chính mình.

**Lưu ý**: Bảng `QuanNhan` hiện **không hỗ trợ Excel import** — chỉ thêm thủ công qua form (xem A3.2). Excel import chỉ áp dụng cho các loại khen thưởng (xem A1.7).

---

## A1.4 — Use case phân rã: Quản lý đơn vị (CQDV / DVTT)

```mermaid
flowchart LR
    SA(((Quản trị viên)))
    AD(((Phòng Chính trị)))

    subgraph SYS[Quản lý đơn vị]
        UC1(Thêm cơ quan đơn vị CQDV)
        UC2(Cập nhật cơ quan đơn vị)
        UC3(Xóa cơ quan đơn vị)
        UC4(Thêm đơn vị trực thuộc DVTT)
        UC5(Cập nhật đơn vị trực thuộc)
        UC6(Xóa đơn vị trực thuộc)
        UC7(Xem cây đơn vị)
        UC8(Đếm số quân nhân trong đơn vị)
        UC9(Quản lý chức vụ trong đơn vị)
        UC10(Chuyển quân nhân giữa các đơn vị)

        UC4 -.->|include| UC1
        UC1 -.->|include| UC9
        UC10 -.->|extend| UC8
    end

    SA --- UC1
    SA --- UC2
    SA --- UC3
    SA --- UC4
    SA --- UC5
    SA --- UC6
    SA --- UC7
    SA --- UC8
    SA --- UC9
    SA --- UC10

    AD --- UC4
    AD --- UC5
    AD --- UC7
    AD --- UC8
    AD --- UC9
    AD --- UC10
```

---

## A1.5 — Use case phân rã: Quản lý khen thưởng cá nhân hằng năm (chuỗi BKBQP / CSTDTQ / BKTTCP)

```mermaid
flowchart LR
    AD(((Phòng Chính trị)))
    MG(((Chỉ huy đơn vị)))
    US(((Người dùng)))

    subgraph SYS[Khen thưởng cá nhân hằng năm]
        UC1(Nhập danh hiệu CSTDCS hoặc CSTT theo năm)
        UC2(Đánh dấu đã nhận BKBQP)
        UC3(Đánh dấu đã nhận CSTDTQ)
        UC4(Đánh dấu đã nhận BKTTCP)
        UC5(Nhập số quyết định và ghi chú)
        UC6(Xem hồ sơ chuỗi của một quân nhân)
        UC7(Tính lại điều kiện chuỗi recalc)
        UC8(Xem gợi ý khen thưởng goi_y)
        UC9(Import bảng danh hiệu hằng năm từ Excel)
        UC10(Lifetime block sau khi nhận BKTTCP)

        UC2 -.->|include| UC5
        UC3 -.->|include| UC5
        UC4 -.->|include| UC5
        UC1 -.->|extend| UC7
        UC2 -.->|extend| UC7
        UC3 -.->|extend| UC7
        UC4 -.->|extend| UC7
        UC4 -.->|extend| UC10
    end

    AD --- UC1
    AD --- UC2
    AD --- UC3
    AD --- UC4
    AD --- UC5
    AD --- UC9

    MG --- UC1
    MG --- UC6
    MG --- UC7
    MG --- UC8

    US --- UC6
    US --- UC8
```

**Đặc thù**: UC10 (lifetime block) là điểm riêng — sau khi quân nhân đã nhận BKTTCP, hệ thống chặn không cho đề xuất các danh hiệu cùng cấp/cao hơn với message "Đã có BKTTCP. Phần mềm chưa hỗ trợ các danh hiệu cao hơn..."

---

## A1.6 — Use case phân rã: Quản lý khen thưởng đơn vị hằng năm

```mermaid
flowchart LR
    AD(((Phòng Chính trị)))
    MG(((Chỉ huy đơn vị)))

    subgraph SYS[Khen thưởng đơn vị hằng năm]
        UC1(Nhập danh hiệu ĐVQT theo năm cho đơn vị)
        UC2(Đánh dấu đơn vị nhận BKBQP)
        UC3(Đánh dấu đơn vị nhận BKTTCP đơn vị)
        UC4(Tính chuỗi ĐVQT liên tục)
        UC5(Tính điều kiện BK Tổng cục và BK Thủ tướng)
        UC6(Xem hồ sơ đơn vị hằng năm)
        UC7(Cycle repeat đơn vị non-lifetime)

        UC1 -.->|extend| UC4
        UC2 -.->|extend| UC5
        UC2 -.->|extend| UC7
        UC3 -.->|extend| UC7
    end

    AD --- UC1
    AD --- UC2
    AD --- UC3
    AD --- UC6
    MG --- UC1
    MG --- UC4
    MG --- UC5
    MG --- UC6
```

**Khác personal**: BKTTCP đơn vị `isLifetime: false` — đơn vị có thể nhận BKTTCP lặp lại sau mỗi 7 năm (cycle repeat). Personal BKTTCP `isLifetime: true` chỉ nhận 1 lần.

---

## A1.7 — Use case phân rã: Niên hạn / Cống hiến / Thành tích khoa học

```mermaid
flowchart LR
    AD(((Phòng Chính trị)))
    MG(((Chỉ huy đơn vị)))
    US(((Người dùng)))

    subgraph SYS[Huân huy chương niên hạn cống hiến]
        UC1(Quản lý Huy chương Chiến sĩ Vẻ vang HCCSVV niên hạn)
        UC2(Quản lý Huân chương Bảo vệ Tổ quốc HCBVTQ cống hiến)
        UC3(Quản lý Huân chương Quân kỳ Quyết thắng)
        UC4(Quản lý Kỷ niệm chương VSNXD QĐNDVN)
        UC5(Quản lý Thành tích khoa học NCKH)
        UC6(Import Excel danh sách import preview và import confirm)
        UC7(Xuất Excel báo cáo)

        UC1 -.->|include| UC1A(Tính 10 15 20 năm phục vụ)
        UC2 -.->|include| UC2A(Tính 120 tháng cống hiến nhóm 0_7 0_8 0_9_1_0)
        UC3 -.->|include| UC3A(Tính từ ngày nhập ngũ)
        UC4 -.->|include| UC4A(Tính 20 năm nữ hoặc 25 năm nam đến ngày xuất ngũ)
        UC5 -.->|include| UC5A(Phân loại DTKH hoặc SKKH)
        UC6 -.->|extend| UC1
        UC6 -.->|extend| UC2
        UC6 -.->|extend| UC3
        UC6 -.->|extend| UC4
        UC6 -.->|extend| UC5
    end

    AD --- UC1
    AD --- UC2
    AD --- UC3
    AD --- UC4
    AD --- UC5
    AD --- UC6
    AD --- UC7

    MG --- UC1
    MG --- UC2
    MG --- UC3
    MG --- UC4
    MG --- UC5
    MG --- UC6
    MG --- UC7

    US --- UC1
    US --- UC2
    US --- UC3
    US --- UC4
```

**Endpoints thực tế** (trong code): `routes/{tenureMedal,contributionMedal,commemorativeMedal,militaryFlag,scientificAchievement}.route.ts` đều có `/import/preview` + `/import/confirm`.

**Lưu ý**: Khen thưởng đột xuất (DOT_XUAT) **không nằm trong sơ đồ này** vì có flow vận hành riêng — xem **A1.9** để biết chi tiết (ADMIN tạo trực tiếp, không qua duyệt 3 cấp, không có tính niên hạn).

---

## A1.8 — Use case phân rã: Đề xuất khen thưởng (Proposal)

```mermaid
flowchart LR
    MG(((Chỉ huy đơn vị)))
    AD(((Phòng Chính trị)))

    subgraph SYS[Đề xuất khen thưởng]
        UC1(Tạo đề xuất CA_NHAN_HANG_NAM)
        UC2(Tạo đề xuất DON_VI_HANG_NAM)
        UC3(Tạo đề xuất NIEN_HAN HCCSVV)
        UC4(Tạo đề xuất CONG_HIEN HCBVTQ)
        UC5(Tạo đề xuất HCQKQT)
        UC6(Tạo đề xuất KNC kỷ niệm chương)
        UC7(Tạo đề xuất NCKH)
        UC8(Đính kèm file)
        UC9(Trình duyệt)
        UC10(Phê duyệt đề xuất)
        UC11(Từ chối đề xuất với lý do)
        UC12(Chỉnh sửa dữ liệu khi duyệt)
        UC13(Sinh quyết định và file)
        UC14(Xem lịch sử đề xuất)

        UC1 -.->|include| UC8
        UC2 -.->|include| UC8
        UC3 -.->|include| UC8
        UC4 -.->|include| UC8
        UC5 -.->|include| UC8
        UC6 -.->|include| UC8
        UC7 -.->|include| UC8
        UC10 -.->|extend| UC12
        UC10 -.->|extend| UC13
    end

    MG --- UC1
    MG --- UC2
    MG --- UC3
    MG --- UC4
    MG --- UC5
    MG --- UC6
    MG --- UC7
    MG --- UC9
    MG --- UC14

    AD --- UC10
    AD --- UC11
    AD --- UC12
    AD --- UC13
    AD --- UC14
```

**Đặc thù**: Đây là use case **trung tâm** của hệ thống. **7 loại đề xuất qua Strategy pattern** ở backend. Khen thưởng đột xuất (DOT_XUAT) có flow riêng — ADMIN tạo trực tiếp qua module `adhoc-awards`, không đi qua bảng `BangDeXuat` (xem A1.9 bên dưới).

---

## A1.9 — Use case phân rã: Khen thưởng đột xuất (Adhoc Awards)

```mermaid
flowchart LR
    AD(((Phòng Chính trị)))
    MG(((Chỉ huy đơn vị)))
    US(((Người dùng)))

    subgraph SYS[Khen thưởng đột xuất]
        UC1(Tạo khen thưởng đột xuất cá nhân)
        UC2(Tạo khen thưởng đột xuất tập thể)
        UC3(Cập nhật khen thưởng đột xuất)
        UC4(Xoá khen thưởng đột xuất)
        UC5(Đính kèm file quyết định)
        UC6(Import Excel khen thưởng đột xuất)
        UC7(Xem danh sách theo phạm vi)
        UC8(Xem chi tiết một khen thưởng)
        UC9(Phát thông báo cho người liên quan)

        UC1 -.->|include| UC5
        UC2 -.->|include| UC5
        UC1 -.->|include| UC9
        UC2 -.->|include| UC9
        UC6 -.->|extend| UC1
        UC6 -.->|extend| UC2
    end

    AD --- UC1
    AD --- UC2
    AD --- UC3
    AD --- UC4
    AD --- UC6
    AD --- UC7
    AD --- UC8

    MG --- UC7
    MG --- UC8

    US --- UC8
```

**Đặc thù**: Khác biệt so với A1.8 (Đề xuất khen thưởng):
- **Không qua duyệt 3 cấp**: ADMIN tạo trực tiếp, không có bước MANAGER review hay phê duyệt.
- **Không qua bảng `BangDeXuat`**: ghi thẳng vào bảng riêng `KhenThuongDotXuat`.
- **Không dùng Strategy pattern**: có service riêng `adhocAward.service.ts` với logic tách biệt.
- **Lý do thiết kế**: khen thưởng đột xuất xảy ra theo sự kiện / chiến công cụ thể, cần ghi nhận tức thì, không phù hợp với quy trình duyệt nhiều bước.
- **Phân quyền**: ADMIN tạo / sửa / xoá. MANAGER + USER chỉ xem theo phạm vi (đơn vị / cá nhân).

---

## A1.10 — Use case phân rã: Kiểm tra điều kiện chuỗi (Eligibility)

```mermaid
flowchart LR
    SYSTEM(((Hệ thống auto)))
    MG(((Chỉ huy đơn vị)))
    US(((Người dùng)))

    subgraph SYS[Eligibility engine]
        UC1(Tính chuỗi cá nhân BKBQP CSTDTQ BKTTCP)
        UC2(Tính chuỗi đơn vị BKBQP BKTTCP đơn vị)
        UC3(Kiểm tra cycle repeat)
        UC4(Áp dụng lifetime block cho BKTTCP cá nhân)
        UC5(Kiểm tra 120 tháng cống hiến HCBVTQ)
        UC6(Kiểm tra 10 15 20 năm phục vụ HCCSVV)
        UC7(Kiểm tra điều kiện NCKH mỗi năm)
        UC8(Sinh gợi ý goi_y dạng văn bản)
        UC9(Tính lại hồ sơ batch)

        UC1 -.->|include| UC3
        UC1 -.->|extend| UC4
        UC1 -.->|include| UC7
        UC2 -.->|include| UC3
        UC9 -.->|include| UC1
        UC9 -.->|include| UC2
        UC9 -.->|include| UC5
        UC9 -.->|include| UC6
        UC9 -.->|include| UC8
    end

    SYSTEM --- UC9
    MG --- UC1
    MG --- UC2
    MG --- UC8
    US --- UC8
```

---

## A1.11 — Use case phân rã: Thông báo realtime (Socket.IO)

```mermaid
flowchart LR
    SA(((Quản trị viên)))
    AD(((Phòng Chính trị)))
    MG(((Chỉ huy đơn vị)))
    US(((Người dùng)))

    subgraph SYS[Notification]
        UC1(Nhận thông báo realtime qua WebSocket)
        UC2(Xem danh sách thông báo)
        UC3(Đánh dấu đã đọc)
        UC4(Lọc thông báo theo loại)
        UC5(Click vào thông báo để mở chi tiết liên quan)
        UC6(Đếm số thông báo chưa đọc)

        UC1 -.->|include| UC6
        UC2 -.->|extend| UC3
        UC2 -.->|extend| UC5
    end

    SA --- UC1
    SA --- UC2
    AD --- UC1
    AD --- UC2
    AD --- UC3
    AD --- UC4
    AD --- UC5
    AD --- UC6
    MG --- UC1
    MG --- UC2
    MG --- UC3
    MG --- UC5
    US --- UC1
    US --- UC2
    US --- UC3
```

---

## A1.12 — Use case phân rã: Nhật ký hệ thống (Audit log)

```mermaid
flowchart LR
    SA(((Quản trị viên)))
    AD(((Phòng Chính trị)))
    MG(((Chỉ huy đơn vị)))

    subgraph SYS[System log]
        UC1(Ghi log tự động khi có hành động)
        UC2(Xem danh sách log)
        UC3(Lọc theo người thực hiện)
        UC4(Lọc theo resource)
        UC5(Lọc theo action CREATE UPDATE DELETE)
        UC6(Lọc theo khoảng thời gian)
        UC7(Xem chi tiết payload before và after)
        UC8(Xuất log ra Excel)
        UC9(Xem log của resource backup chỉ SUPER_ADMIN)

        UC2 -.->|extend| UC3
        UC2 -.->|extend| UC4
        UC2 -.->|extend| UC5
        UC2 -.->|extend| UC6
        UC2 -.->|extend| UC7
    end

    SA --- UC2
    SA --- UC3
    SA --- UC4
    SA --- UC5
    SA --- UC6
    SA --- UC7
    SA --- UC8
    SA --- UC9

    AD --- UC2
    AD --- UC3
    AD --- UC4
    AD --- UC5
    AD --- UC6
    AD --- UC7

    MG --- UC2
    MG --- UC3
    MG --- UC4
    MG --- UC5
    MG --- UC6
    MG --- UC7
```

**Phân quyền**: route `/api/system-logs` dùng `requireManager` → cả SUPER_ADMIN, ADMIN và MANAGER đều được xem nhật ký. Tuy nhiên service `systemLogs.service.ts` áp filter:
- **UC9** — log có `resource: 'backup'` chỉ SUPER_ADMIN xem được; ADMIN và MANAGER bị filter loại bỏ hoàn toàn.
- MANAGER còn bị giới hạn theo phạm vi đơn vị: chỉ thấy log do tài khoản trong các đơn vị mình quản lý thực hiện (qua `getManagerAccountIds`).

---

## A1.13 — Use case phân rã: Sao lưu và khôi phục (Backup)

```mermaid
flowchart LR
    SA(((Quản trị viên)))
    SYSTEM(((Cron auto)))

    subgraph SYS[Backup management]
        UC1(Cấu hình lịch backup tự động)
        UC2(Bật hoặc tắt schedule backup)
        UC3(Backup thủ công ngay)
        UC4(Tải file backup SQL)
        UC5(Xóa file backup)
        UC6(Xem danh sách file backup)
        UC7(Backup tự động hằng ngày)
        UC8(Khôi phục từ file backup)
        UC9(Xem log backup)

        UC7 -.->|extend| UC9
        UC3 -.->|extend| UC9
    end

    SA --- UC1
    SA --- UC2
    SA --- UC3
    SA --- UC4
    SA --- UC5
    SA --- UC6
    SA --- UC8
    SA --- UC9

    SYSTEM --- UC7
```

---

> **Ghi chú**: Phần "DevZone" (công cụ admin nâng cao truy cập bằng password riêng) **không** được vẽ thành use case nghiệp vụ — đây là internal tool, không phải tính năng cho actor sử dụng hằng ngày, không cần đưa vào báo cáo.

---

## A1.14 — Use case phân rã: Báo cáo và thống kê

```mermaid
flowchart LR
    AD(((Phòng Chính trị)))
    MG(((Chỉ huy đơn vị)))

    subgraph SYS[Báo cáo và thống kê]
        UC1(Thống kê theo loại khen thưởng)
        UC2(Thống kê theo năm)
        UC3(Thống kê theo đơn vị)
        UC4(Thống kê quân nhân đủ điều kiện chưa nhận)
        UC5(Biểu đồ tổng hợp dashboard)
        UC6(Xuất báo cáo Excel)
        UC7(Xuất báo cáo PDF)
        UC8(So sánh chuỗi giữa các quân nhân)

        UC5 -.->|include| UC1
        UC5 -.->|include| UC2
        UC5 -.->|include| UC3
        UC1 -.->|extend| UC6
        UC2 -.->|extend| UC6
        UC3 -.->|extend| UC6
    end

    AD --- UC1
    AD --- UC2
    AD --- UC3
    AD --- UC4
    AD --- UC5
    AD --- UC6
    AD --- UC7
    AD --- UC8

    MG --- UC1
    MG --- UC2
    MG --- UC3
    MG --- UC4
    MG --- UC5
    MG --- UC8
```

---

## Tổng kết

| # | Sơ đồ | Số use case | Actor |
|---|---|---|---|
| A1.1 | Use case tổng quát | 15 | 4 |
| A1.2 | Quản lý tài khoản | 9 | SUPER_ADMIN, ADMIN |
| A1.3 | Quản lý quân nhân | 11 | SUPER_ADMIN, ADMIN, MANAGER |
| A1.4 | Quản lý đơn vị | 10 | SUPER_ADMIN, ADMIN |
| A1.5 | Hằng năm cá nhân (thuộc UC5) | 10 | ADMIN, MANAGER, USER |
| A1.6 | Hằng năm đơn vị (thuộc UC5) | 7 | ADMIN, MANAGER |
| A1.7 | Niên hạn / Cống hiến / Thành tích khoa học (UC6-UC8) | 7 (+ 5 sub) | ADMIN, MANAGER, USER |
| A1.8 | Đề xuất khen thưởng (UC10) | 14 | MANAGER, ADMIN |
| A1.9 | Khen thưởng đột xuất (UC9 — flow riêng) | 9 | ADMIN, MANAGER, USER |
| A1.10 | Eligibility engine (UC11) | 9 | System, MANAGER, USER |
| A1.11 | Thông báo realtime (UC12) | 6 | 4 role |
| A1.12 | Nhật ký hệ thống (UC13) | 9 | SUPER_ADMIN, ADMIN, MANAGER |
| A1.13 | Backup (UC14) | 9 | SUPER_ADMIN, Cron |
| A1.14 | Báo cáo thống kê (UC15) | 8 | ADMIN, MANAGER |

**Tổng**: 1 sơ đồ tổng quát + 12 sơ đồ phân rã. DevZone không tính (internal tool).
