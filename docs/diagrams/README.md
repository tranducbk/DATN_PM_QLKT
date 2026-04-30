# Sơ đồ ĐATN — PM QLKT (Mermaid)

> Toàn bộ sơ đồ cần thiết cho báo cáo ĐATN "Phần mềm Quản lý Khen thưởng tại Học viện Khoa học Quân sự" — viết bằng **Mermaid** để dễ chỉnh sửa, render trong VSCode hoặc xuất PNG/SVG qua [mermaid.live](https://mermaid.live).
>
> Tham chiếu cấu trúc báo cáo mẫu `2025-06-28_16-04-25_datn_20242.pdf` nhưng **nội dung hoàn toàn khác** — xem `plagiarism-warnings.md` để tránh bẫy đạo văn.

---

## Danh sách file

| File | Nội dung | Số sơ đồ |
|---|---|---|
| [`plagiarism-warnings.md`](./plagiarism-warnings.md) | Cảnh báo trùng lặp với báo cáo mẫu + checklist trước nộp | — |
| [`01-use-case.md`](./01-use-case.md) | Sơ đồ Use Case (tổng quát + 13 phân rã) | 14 |
| [`02-activity.md`](./02-activity.md) | Sơ đồ hoạt động / quy trình nghiệp vụ (swimlane) | 9 |
| [`03-architecture.md`](./03-architecture.md) | Kiến trúc tổng thể, Layered architecture, Package diagram, Strategy pattern | 7 |
| [`04-class.md`](./04-class.md) | Class diagram cho 5 module chính | 5 |
| [`05-sequence.md`](./05-sequence.md) | Sequence diagram cho 7 luồng quan trọng | 7 |
| [`06-erd.md`](./06-erd.md) | ERD tổng thể + 5 ERD phân module + data dictionary | 6 |
| [`07-deployment.md`](./07-deployment.md) | Deployment diagram + Docker Compose + PM2 config | 4 |

**Tổng cộng**: ~52 sơ đồ Mermaid + cảnh báo plagiarism + 12 bảng data dictionary cần làm thêm.

---

## Cách render Mermaid

### Cách 1 — VSCode (khuyến nghị)
1. Cài extension **Markdown Preview Mermaid Support** (id: `bierner.markdown-mermaid`)
2. Mở file `.md` → `Cmd+Shift+V` để preview

### Cách 2 — mermaid.live (xuất PNG/SVG)
1. Truy cập https://mermaid.live
2. Copy block ` ```mermaid ... ``` ` (không bao gồm dòng ```mermaid và ``` đóng)
3. Paste vào ô soạn → **Actions → PNG / SVG**
4. Đặt tên file theo quy chuẩn: `Hinh-2-1-use-case-tong-quat.png`

### Cách 3 — mermaid-cli (batch export)
```bash
npm install -g @mermaid-js/mermaid-cli
mmdc -i 01-use-case.md -o use-case.png
```

---

## Mapping sơ đồ → Chương trong báo cáo

| Chương | Sơ đồ thuộc | File |
|---|---|---|
| Chương 2 — Khảo sát & Phân tích yêu cầu | A1.1 → A1.14 (use case), A3.1 → A3.9 (activity) | `01-use-case.md`, `02-activity.md` |
| Chương 3 — Công nghệ sử dụng | (chỉ có bảng so sánh, không sơ đồ Mermaid) | — |
| Chương 4 — Thiết kế, triển khai & đánh giá | C1.1 → C1.3 (kiến trúc), C2.1 → C2.4 (package), C3.1 → C3.5 (class), C4.1 → C4.7 (sequence), C5.1 → C5.6 (ERD), C8.1 (deployment) | `03-architecture.md`, `04-class.md`, `05-sequence.md`, `06-erd.md`, `07-deployment.md` |
| Chương 5 — Giải pháp & Đóng góp | (tham chiếu sơ đồ chương 4, không vẽ thêm) | — |
| Chương 6 — Kết luận & Hướng phát triển | (không có sơ đồ) | — |

---

## Quy ước đánh số

Khi đưa vào báo cáo Word/LaTeX, đánh số lại theo quy chuẩn HUST:

| Mã trong file | Caption trong báo cáo |
|---|---|
| A1.1 → A1.14 | Hình 2.1 → Hình 2.14 |
| A3.1 → A3.9 | Hình 2.15 → Hình 2.23 |
| C1.1 → C1.3 | Hình 4.1 → Hình 4.3 |
| C2.1 → C2.4 | Hình 4.4 → Hình 4.7 |
| C3.1 → C3.5 | Hình 4.8 → Hình 4.12 |
| C4.1 → C4.7 | Hình 4.13 → Hình 4.19 |
| C5.1 → C5.6 | Hình 4.20 → Hình 4.25 |
| C8.1 | Hình 4.26 |

→ Tổng ~26 hình ở Chương 4 (gấp đôi báo cáo mẫu HRM).

---

## Phần wireframe / ảnh giao diện (không có Mermaid)

Mermaid không hỗ trợ wireframe — bạn dùng các tool khác:

| Mục đích | Tool gợi ý |
|---|---|
| Wireframe tĩnh | [Excalidraw](https://excalidraw.com), [Figma](https://figma.com), [draw.io](https://app.diagrams.net) (template Mockup) |
| Ảnh giao diện thực tế | Chụp màn hình từ trình duyệt sau khi UI hoàn thiện (Cmd+Shift+5 trên macOS) |

Đặt ảnh tại `docs/diagrams/wireframes/` và `docs/diagrams/screenshots/` (tự tạo khi cần).

---

## Workflow khuyến nghị

1. **Tuần này**: Duyệt qua từng file Mermaid → đánh dấu sơ đồ nào giữ/sửa/bỏ
2. **Tuần sau**: Render PNG/SVG cho các sơ đồ đã duyệt → đặt vào thư mục `docs/diagrams/exported/`
3. **Khi viết báo cáo**: Insert PNG vào Word/LaTeX với caption đúng quy chuẩn HUST
4. **Sau khi UI hoàn thiện**: Chụp ảnh giao diện thực tế cho mục 4.3.3 "Minh họa các chức năng chính"
5. **Trước khi nộp**: Chạy plagiarism check, đối chiếu checklist `plagiarism-warnings.md` mục 5
