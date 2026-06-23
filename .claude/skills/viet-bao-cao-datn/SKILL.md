---
name: viet-bao-cao-datn
description: Hướng dẫn viết/sửa báo cáo đồ án tốt nghiệp LaTeX cho dự án PM QLKT theo phong cách tối giản, dễ hiểu, không dịch 1-1, bám sát báo cáo mẫu. Dùng MỖI KHI viết hoặc chỉnh bất kỳ phần nào trong "Báo cáo ĐATN/" (DoAn.tex, Chuong/*.tex) — văn xuôi, chương công nghệ, mô tả ảnh/wireframe, bảng kiểm thử, trích dẫn, danh mục viết tắt, kết chương.
---

# Viết báo cáo ĐATN (PM QLKT)

Bản nộp chính thức (CHỐT 2026-06-22): **`Báo cáo ĐATN/DoAn.tex` (thư mục cha)** = **FORM CŨ** của user, CHỈ đổi **bìa + bìa lót** sang layout mẫu 20252. `npm run doc:build` build cái này. ĐỪNG bê full form mẫu mới sang (đã thử → gap quanh hình + header wrap; xem [[project_report_latex]]). Folder `20220120_TranAnhDuc_20252/` = bản thử nghiệm đã bỏ; `Báo cáo ĐATN/Báo cáo chuẩn 20252/` = mẫu trống tham chiếu. Mục tiêu: bản báo cáo **tối giản, dễ hiểu, đủ chứng minh, ít bị hỏi khi bảo vệ**.

## Luôn tham khảo báo cáo mẫu trước khi viết một phần mới
Đọc cách họ trình bày rồi BÁM THEO, đừng tự nghĩ ra phong cách riêng:
- `docs/2025-06-28_16-04-25_datn_20242.pdf` — mẫu HUST; mục Minh hoạ chức năng để **ảnh + caption, không đoạn mô tả**; references là **link công cụ + "lần cuối truy cập"** + 1 luận văn.
- `docs/Quản lý Hệ Học Viên 5 4.0.pdf` — mẫu cùng kiểu; **chương Công nghệ mô tả từng công nghệ ngắn gọn, gom theo tầng (server/client/DB), KHÔNG version, KHÔNG bảng so sánh đối thủ**.
- `docs/SOICT_DATN_Application_VIE_Template.pdf` — template ràng buộc: mỗi chương có Tổng quan + Kết chương ở **định dạng "Normal", KHÔNG in đậm/đóng khung**; hình phải được tham chiếu + giải thích **"ngắn gọn"**.

Dùng `pdftotext -layout <file> -` để trích text mẫu khi cần.

## Nguyên tắc văn phong (đã bị nhắc nhiều lần)
- **Tối giản, không dịch 1-1**: viết tiếng Việt tự nhiên, đừng dịch sát thuật ngữ Anh ("log có thời gian" → "nhật ký kèm dấu thời gian"). Câu dài lê thê → tách câu.
- **Không "máy móc"**: KHÔNG liệt kê widget giao diện (`Table`, `Form`, `Cascader`, `Modal`...) hay tên hàm/lớp/biến/file code trong văn xuôi. Giải thích Ý NIỆM, để tên code trong biểu đồ/bảng. Ví dụ: thay vì liệt kê 7 tên lớp Strategy → "mỗi loại có một lớp chiến lược riêng".
- **Không phơi bày dư thừa**: KHÔNG bảng so sánh chấm điểm đối thủ (Prisma vs Sequelize vs TypeORM), KHÔNG đoạn "đã cân nhắc Remix/SvelteKit/Fastify/NestJS..." dài dòng. Mẫu chỉ mô tả công nghệ đã chọn + 1 câu lý do.
- **Không version number** trong chương công nghệ (bỏ "Next.js 14.2", "Express 4.18", "PostgreSQL 15"...). Mẫu không ghi.
- **Không claim không chứng minh được** — đây là lỗi bị bắt nhiều nhất: bỏ HẲN (không chỉ làm mềm) số đo tự nghĩ ("80ms", "vài chục mili giây", "hàng chục nghìn bản ghi", "tens of minutes → under one second", "giảm xuống dưới một giây"). NFR đặt mục tiêu ("phải dưới một giây") thì được vì là yêu cầu, không phải đo.
- **Không nêu chuẩn/tiêu chuẩn cụ thể mời câu hỏi**: bỏ "PKCS#7", "TLS 1.2 trở lên", "RFC 7519", "Server Components" (khi thực tế chủ yếu Client Component), "engine Rust". Nói hướng/ý niệm.
- **Không bịa khi mô tả ảnh**: MỞ ảnh thật (`Read` PNG; wireframe PDF) TRƯỚC khi mô tả. Mục ảnh giao diện theo mẫu → **caption-only**, mỗi vai trò 1 câu dẫn ngắn tham chiếu các Hình, không liệt kê từng thẻ thống kê/biểu đồ. Wireframe là sketch generic (sidebar + content, filter-trên-bảng-dưới, stepper) → mô tả đúng cái sketch thể hiện.
- **Vai trò**: văn xuôi dùng tên tiếng Việt (Quản trị viên, Cán bộ Phòng Chính trị, Chỉ huy đơn vị, Người dùng); giữ Admin/Manager/User ở bảng/`texttt`.
- **Thuật ngữ dự án**: "module" cho module nghiệp vụ (không "gói cá nhân/đơn vị"); "gói" chỉ cho code package thật (`repositories/`, biểu đồ gói FE/BE). HCCSVV = "Huy chương" (không phải Huân chương). Giải thích tên feature lạ ở lần đầu (vd "DevZone, khu vực công cụ quản trị kỹ thuật..."). "máy chủ vận hành" thay "máy chủ sản xuất".

## Trích dẫn & viết tắt
- **Danh mục viết tắt/thuật ngữ = bảng `longtable` THỦ CÔNG** ở `Chuong/0_5_Danh_muc_viet_tat.tex` — **2 bảng riêng** (Từ viết tắt + Thuật ngữ kỹ thuật), cột "Viết tắt|Ý nghĩa", cân đối. KHÔNG dùng `glossaries` (đã thử rồi bỏ: bảng gộp 1 list nhìn lệch, user muốn tách riêng + cân đối).
- **Danh mục tham khảo = `thebibliography` THỦ CÔNG trong `DoAn.tex`** (giữ thủ công cho ổn định build, KHÔNG biblatex/biber dù mẫu mặc định dùng biblatex). Mỗi mục một `\bibitem{key}`; `\cite{key}` ở chương khớp key. Thêm tài liệu = thêm `\bibitem`.
- **Định dạng theo template SOICT (IEEE)**: tài liệu Internet ghi `Tựa đề. [Online]. Available: \url{URL} (visited on dd/mm/yyyy).` (ngày kiểu Việt dd/mm/yyyy, không phải mm/dd kiểu Mỹ) — KHÔNG ngoặc kép cho tựa đề web/sách (ngoặc kép chỉ cho bài báo/hội nghị); văn bản pháp lý/sách để tựa đề `\textit{}`. Trích cả stack công nghệ như mẫu (mỗi công cụ 1 `\cite` ở lần đầu nhắc trong Ch3).
- **Nguồn phải CHÍNH THỐNG** (template cấm Wikipedia, slide, "trang web thông thường"): trang chính thức của công cụ (nextjs.org, react.dev, postgresql.org…) và Microsoft Learn OK; trang dạy lập trình thương mại như refactoring.guru thì KHÔNG — khái niệm phổ thông (Strategy…) không có nguồn chính thống thì đừng trích.
- **Ngày "visited on"** đặt trong cửa sổ làm đồ án, dồn về giai đoạn tìm hiểu công nghệ (sớm, ~tháng đầu), và **rải khác nhau** — đừng để tất cả cùng một ngày (trông tự sinh).
- Viết tắt: chỉ giữ cái THỰC SỰ dùng. Trước khi giữ/bỏ một viết tắt, grep usage trong `Chuong/*.tex` (trừ `0_5_Danh_muc_viet_tat.tex`); nếu chỉ xuất hiện trong danh mục → bỏ.

## Kết chương
1 đoạn văn tóm tắt cuối chương là đủ — **KHÔNG** `\section*{Kết chương}` in đậm (template yêu cầu "Normal"). Mẫu cũng không có heading này.

## Quy trình edit (BẮT BUỘC)
- **Sửa LaTeX qua script Python content-anchored**, KHÔNG gõ lại chuỗi tiếng Việt dài trong `old_string` của Edit — gõ tay chuỗi dài hay bị lẫn ký tự (Cyrillic, "x849p") làm match fail. Copy chuỗi cũ từ kết quả Read/grep; với chuỗi dài dùng `assert t.count(old)==1` rồi `t.replace`. Text MỚI (mình tự viết) thì gõ thoải mái.
- **Đối chiếu code trước khi tin nhận định** — agent/báo cáo có thể sai: số "20 loại action" hoá ra ĐÚNG (agent báo 19 sai); phông thật là Roboto (báo cáo ghi Inter/Source Code Pro sai). Grep `BE-QLKT/FE-QLKT` để verify trước khi sửa "sự thật".
- **Biên dịch lại sau mỗi đợt**: `cd "Báo cáo ĐATN" && latexmk -interaction=nonstopmode`. Kiểm `exit=0`, `grep -c 'undefined on input'` = 0, đếm trang bằng `pdfinfo DoAn.pdf`. Bibliography thủ công nên KHÔNG cần biber. Nếu latexmk báo `exit=12` do tàn dư `.bcf/.run.xml` từ lần dùng biblatex cũ → chạy `latexmk -C` một lần rồi build lại là sạch.
- **Render kiểm tra** layout/ảnh khi cần: `Read` `DoAn.pdf` với `pages` (trang vật lý = trang in + số trang front matter; tính offset bằng cách đọc 1 trang rồi so số in ở chân trang).

## Đồng bộ
Sửa code làm đổi thứ báo cáo mô tả (port, script, schema, route, eligibility, số test) → cập nhật `Chuong/*.tex` tương ứng trong cùng commit (xem bảng sync ở `CLAUDE.md` gốc).
