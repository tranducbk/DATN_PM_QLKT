# Sơ đồ Hoạt động (Activity Diagrams)

> Bám sát style **báo cáo mẫu HUST**: 2 swimlane (Actor / Hệ thống), ngôn ngữ nghiệp vụ tiếng Việt, ít node (6–10 mỗi sơ đồ), diamond cho decision, vòng lại lane Actor khi không hợp lệ.
>
> Mermaid không có syntax UML Swimlane thuần — dùng `flowchart TD` + `subgraph` cho từng lane. Khi xuất sang báo cáo nên render lại trên **draw.io** (chọn UML Activity) để có swimlane chuẩn UML.

---

## A3.1 — Quy trình đăng nhập

```mermaid
flowchart TD
    Start([Bắt đầu])
    A1[Nhập tài khoản và mật khẩu]
    S1[Kiểm tra thông tin]
    D1{Hợp lệ?}
    S2[Hiển thị thông báo lỗi]
    S3[Điều hướng đến trang chính]
    End([Kết thúc])

    Start --> A1 --> S1 --> D1
    D1 -- Không --> S2 --> A1
    D1 -- Có --> S3 --> End

    classDef actor fill:#fff4e6,stroke:#cc6600
    classDef system fill:#e6f0ff,stroke:#0066cc
    class A1 actor
    class S1,S2,S3 system
```

**Lane**: hành động màu cam thuộc **Người dùng**, hành động màu xanh thuộc **Hệ thống**.

---

## A3.2 — Quy trình thêm mới quân nhân

```mermaid
flowchart TD
    Start([Bắt đầu])
    A1[Mở trang Quản lý quân nhân]
    A2[Chọn Thêm quân nhân]
    S1[Hiển thị form thêm quân nhân]
    A3[Nhập thông tin và chọn lưu]
    S2[Kiểm tra dữ liệu]
    D1{Hợp lệ?}
    S3[Thông báo thành công]
    End([Kết thúc])

    Start --> A1 --> A2 --> S1 --> A3 --> S2 --> D1
    D1 -- Không hợp lệ --> A3
    D1 -- Hợp lệ --> S3 --> End

    classDef actor fill:#fff4e6,stroke:#cc6600
    classDef system fill:#e6f0ff,stroke:#0066cc
    class A1,A2,A3 actor
    class S1,S2,S3 system
```

---

## A3.3 — Quy trình import danh sách khen thưởng từ Excel

```mermaid
flowchart TD
    Start([Bắt đầu])
    A1[Mở trang Import khen thưởng]
    A2[Chọn file Excel]
    S1[Đọc và kiểm tra cấu trúc file]
    S2[Tìm quân nhân theo CCCD và kiểm tra điều kiện từng dòng]
    S3[Hiển thị bảng xem trước với dòng OK và dòng lỗi]
    D1{Xác nhận import?}
    A3[Hủy import]
    S4[Lưu các dòng OK vào hệ thống]
    S5[Tính lại hồ sơ quân nhân liên quan]
    S6[Báo cáo số dòng thành công và thất bại]
    End([Kết thúc])

    Start --> A1 --> A2 --> S1 --> S2 --> S3 --> D1
    D1 -- Không --> A3 --> End
    D1 -- Có --> S4 --> S5 --> S6 --> End

    classDef actor fill:#fff4e6,stroke:#cc6600
    classDef system fill:#e6f0ff,stroke:#0066cc
    class A1,A2,A3 actor
    class S1,S2,S3,S4,S5,S6 system
```

---

## A3.4 — Quy trình tạo và phê duyệt đề xuất khen thưởng

```mermaid
flowchart TD
    Start([Bắt đầu])
    M1[Chỉ huy đơn vị chọn loại đề xuất và năm]
    M2[Chọn quân nhân và đính kèm hồ sơ]
    M3[Gửi đề xuất]
    S1[Kiểm tra dữ liệu đầu vào năm tháng và payload]
    D1{Hợp lệ?}
    S2[Lưu đề xuất trạng thái Chờ duyệt]
    S3[Gửi thông báo cho Phòng Chính trị]

    A1[Phòng Chính trị mở chi tiết đề xuất]
    A2[Chỉnh sửa dữ liệu và số quyết định nếu cần]
    A3[Đính kèm PDF quyết định nếu có]
    D2{Quyết định?}
    A4[Phê duyệt]
    A5[Từ chối với lý do]

    S4[Kiểm tra trạng thái đề xuất chưa duyệt]
    S5[Kiểm tra trùng lặp với khen thưởng đã có]
    S6[Kiểm tra điều kiện chuỗi và niên hạn cống hiến]
    S7[Kiểm tra hợp lệ số quyết định]
    D3{Vượt qua tất cả?}
    S8[Trả lỗi cho Phòng Chính trị xem]

    S9[Tạo và lưu file PDF quyết định]
    TX[/Bắt đầu giao dịch/]
    S10[Tạo bản ghi FileQuyetDinh]
    S11[Lưu khen thưởng vào hồ sơ quân nhân]
    S12[Cập nhật trạng thái Đã duyệt với khoá lạc quan]
    TXEND[/Kết thúc giao dịch/]
    S13[Tính lại hồ sơ quân nhân và đơn vị liên quan]
    S14[Ghi nhật ký nếu có dòng lỗi]
    S15[Gửi thông báo cho Chỉ huy đơn vị và Quân nhân]

    S16[Kiểm tra trạng thái chưa duyệt với khoá lạc quan]
    D4{Đề xuất còn ở Chờ duyệt?}
    S17[Cập nhật trạng thái Từ chối]
    S18[Báo lỗi đã được duyệt hoặc từ chối từ trước]

    End([Kết thúc])

    Start --> M1 --> M2 --> M3 --> S1 --> D1
    D1 -- Không --> M2
    D1 -- Có --> S2 --> S3 --> A1 --> A2 --> A3 --> D2
    D2 -- Phê duyệt --> A4 --> S4 --> S5 --> S6 --> S7 --> D3
    D3 -- Không --> S8 --> A2
    D3 -- Có --> S9 --> TX --> S10 --> S11 --> S12 --> TXEND --> S13 --> S14 --> S15 --> End
    D2 -- Từ chối --> A5 --> S16 --> D4
    D4 -- Có --> S17 --> S15
    D4 -- Không --> S18 --> End

    classDef mgr fill:#e6f7e6,stroke:#009900
    classDef adm fill:#fff4e6,stroke:#cc6600
    classDef system fill:#e6f0ff,stroke:#0066cc
    classDef tx fill:#fff0f5,stroke:#cc3366,stroke-dasharray: 5 5
    class M1,M2,M3 mgr
    class A1,A2,A3,A4,A5 adm
    class S1,S2,S3,S4,S5,S6,S7,S8,S9,S13,S14,S15,S16,S17,S18 system
    class TX,TXEND,S10,S11,S12 tx
```

**Ghi chú boundary giao dịch**: nhóm `S10 → S11 → S12` chạy trong cùng `prisma.$transaction()` — nếu bất kỳ bước nào fail, toàn bộ rollback (FileQuyetDinh không tạo, khen thưởng không lưu, status không đổi). Khoá lạc quan ở `S12` đảm bảo nếu ai đó duyệt/từ chối song song, chỉ 1 transaction commit thành công.

**Pre-check trước khi vào giao dịch** (`S4 → S7`): chạy đầy đủ 4 lớp validate — trạng thái đề xuất, trùng lặp khen thưởng, điều kiện chuỗi/niên hạn/cống hiến, hợp lệ số quyết định. Nếu có lỗi → quay về cho Phòng Chính trị sửa, không vào giao dịch (tránh rollback tốn tài nguyên).

**Ghi log** (`S14`): nhật ký lỗi import (nếu có dòng cá nhân lỗi trong khi tổng thể vẫn commit) ghi vào `SystemLog` resource = 'proposal' — fire-and-forget, không block flow.

---

## A3.5 — Quy trình tính lại điều kiện chuỗi

```mermaid
flowchart TD
    Start([Bắt đầu])
    S1[Lấy danh hiệu các năm của quân nhân]
    S2[Lấy thành tích khoa học các năm]
    S3[Tính chuỗi liên tục cho từng cấp]
    D1{Đã nhận BKTTCP?}
    S4[Áp lifetime block, gợi ý chưa hỗ trợ cao hơn]
    S5[Sinh gợi ý theo điều kiện hiện tại]
    S6[Cập nhật ba cờ điều kiện và gợi ý vào hồ sơ]
    End([Kết thúc])

    Start --> S1 --> S2 --> S3 --> D1
    D1 -- Có --> S4 --> S6
    D1 -- Không --> S5 --> S6 --> End

    classDef system fill:#e6f0ff,stroke:#0066cc
    class S1,S2,S3,S4,S5,S6 system
```

**Lưu ý**: Quy trình này chỉ có lane Hệ thống (chạy nền tự động sau khi duyệt đề xuất hoặc sửa danh hiệu).

---

## A3.6 — Quy trình quản lý đơn vị

```mermaid
flowchart TD
    Start([Bắt đầu])
    A1[Phòng Chính trị mở trang Quản lý đơn vị]
    A2[Chọn thao tác: Thêm hoặc Sửa hoặc Xóa]
    A3[Nhập thông tin đơn vị]
    S1[Kiểm tra dữ liệu]
    D1{Hợp lệ?}
    S2[Lưu vào hệ thống và cập nhật cây đơn vị]
    S3[Cập nhật số lượng quân nhân của đơn vị]
    End([Kết thúc])

    Start --> A1 --> A2 --> A3 --> S1 --> D1
    D1 -- Không --> A3
    D1 -- Có --> S2 --> S3 --> End

    classDef actor fill:#fff4e6,stroke:#cc6600
    classDef system fill:#e6f0ff,stroke:#0066cc
    class A1,A2,A3 actor
    class S1,S2,S3 system
```

---

## A3.7 — Quy trình quản lý 5 loại huân huy chương riêng

```mermaid
flowchart TD
    Start([Bắt đầu])
    A1[Chỉ huy đơn vị chọn quân nhân và loại khen thưởng]
    S1[Kiểm tra điều kiện theo loại]
    D1{Đủ điều kiện?}
    A2[Báo chưa đủ điều kiện]
    A3[Nhập thông tin và đính kèm quyết định]
    S2[Lưu đề xuất chờ duyệt]
    A4[Phòng Chính trị duyệt]
    S3[Lưu khen thưởng và cập nhật hồ sơ]
    S4[Gửi thông báo]
    End([Kết thúc])

    Start --> A1 --> S1 --> D1
    D1 -- Không --> A2 --> End
    D1 -- Có --> A3 --> S2 --> A4 --> S3 --> S4 --> End

    classDef actor fill:#fff4e6,stroke:#cc6600
    classDef system fill:#e6f0ff,stroke:#0066cc
    class A1,A2,A3,A4 actor
    class S1,S2,S3,S4 system
```

**Áp dụng cho**: Huy chương Chiến sĩ Vẻ vang (HCCSVV niên hạn), Huân chương Bảo vệ Tổ quốc (HCBVTQ cống hiến), Huân chương Quân kỳ Quyết thắng, Kỷ niệm chương VSNXD QĐNDVN, Khen thưởng đột xuất, Thành tích NCKH.

---

## A3.8 — Quy trình sao lưu dữ liệu định kỳ

```mermaid
flowchart TD
    Start([Bắt đầu])
    S1[Lịch tự động khởi chạy]
    D1{Sao lưu có được bật?}
    S2[Bỏ qua]
    S3[Đọc toàn bộ dữ liệu nghiệp vụ]
    S4[Tạo nội dung file SQL]
    S5[Ghi file vào thư mục sao lưu]
    S6[Cập nhật thời điểm sao lưu gần nhất]
    S7[Ghi nhật ký sao lưu]
    S8[Xóa các file sao lưu cũ vượt thời hạn]
    End([Kết thúc])

    Start --> S1 --> D1
    D1 -- Không --> S2 --> End
    D1 -- Có --> S3 --> S4 --> S5 --> S6 --> S7 --> S8 --> End

    classDef system fill:#e6f0ff,stroke:#0066cc
    class S1,S2,S3,S4,S5,S6,S7,S8 system
```

**Lưu ý**: Quy trình hoàn toàn chạy nền (lane Hệ thống). Quản trị viên (SUPER_ADMIN) tải file backup qua trang riêng (use case khác — UC-08).

---

## Tổng kết

| # | Quy trình | Lane | Số node |
|---|---|---|---|
| A3.1 | Đăng nhập | Người dùng + Hệ thống | 6 |
| A3.2 | Thêm quân nhân | Phòng Chính trị + Hệ thống | 7 |
| A3.3 | Import Excel khen thưởng | Phòng Chính trị + Hệ thống | 9 |
| A3.4 | Tạo và duyệt đề xuất | 3 lane (Chỉ huy đơn vị + Phòng Chính trị + Hệ thống) + boundary giao dịch | 25 |
| A3.5 | Recalc điều kiện chuỗi | Hệ thống | 6 |
| A3.6 | Quản lý đơn vị | Phòng Chính trị + Hệ thống | 6 |
| A3.7 | 5 loại huân huy chương riêng | Chỉ huy đơn vị + Phòng Chính trị + Hệ thống | 9 |
| A3.8 | Sao lưu định kỳ | Hệ thống | 8 |

**Style nguyên tắc** (theo báo cáo mẫu):
- Tên hành động: **động từ tiếng Việt** ngắn gọn ("Nhập thông tin", "Kiểm tra dữ liệu", "Lưu vào hệ thống", "Thông báo thành công")
- Tránh từ dev: không "Joi validate", "INSERT", "Bulk insert", "Promise.all", "transaction" — thay bằng "Kiểm tra dữ liệu", "Lưu", "Lưu nhiều dòng", "Đọc dữ liệu"
- Decision: dạng câu hỏi ngắn ("Hợp lệ?", "Đủ điều kiện?", "Quyết định?")
- Loop back về lane Actor khi validate fail (giống mẫu — nhập lại dữ liệu)
- Mỗi sơ đồ tối đa ~10 node (trừ A3.4 phức tạp hơn vì có 2 actor)
