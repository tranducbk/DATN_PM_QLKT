# Kế hoạch quay video demo PM QLKT

> File này hướng dẫn quay **15 video demo** chức năng, dùng cho:
> 1. **Phòng hờ khi demo live fail** trong buổi bảo vệ → chiếu video thay thế
> 2. **Gửi giảng viên hướng dẫn** xem trước để góp ý
> 3. **Đính kèm theo thesis** như phụ lục số hoá
> 4. **Highlight reel 3–5 phút** cắt ghép cho slide bảo vệ
>
> Tổng thời lượng đầy đủ: ~25 phút. Highlight cuối: ~5 phút.

---

# Phần 1 — Pre-production (chuẩn bị trước khi quay)

## 1.1 — Phần mềm quay màn hình

| Tool | Hệ điều hành | Ưu điểm | Khuyến nghị cho |
|---|---|---|---|
| **OBS Studio** | Win/Mac/Linux | Free, mạnh, custom scene | Người quay nhiều video, cần overlay webcam/mic indicator |
| **ScreenStudio** | macOS | Tự zoom theo cursor, polish UI/UX đẹp | Nếu em dùng Mac, đây là lựa chọn tốt nhất |
| **QuickTime** | macOS | Có sẵn, dễ dùng | Quay nhanh, không hiệu ứng |
| **Loom** | Web/Desktop | Cloud share link, có timestamp comment | Gửi cho GVHD review online |
| **Snagit / Camtasia** | Win/Mac (paid) | Edit tích hợp | Nếu cần caption, cut, transition |

**Khuyến nghị**: dùng **OBS Studio** (free, đa nền tảng) hoặc **ScreenStudio** (Mac).

## 1.2 — Cấu hình quay

| Tham số | Giá trị |
|---|---|
| Độ phân giải | **1920 × 1080** (Full HD) |
| FPS | **30** (đủ cho demo UI, tiết kiệm dung lượng) |
| Codec | **H.264 / MP4** |
| Bitrate | 6–8 Mbps |
| Audio | **44.1 kHz / 128 kbps mono** (giọng nói đủ chất) |
| Microphone | Lavalier USB hoặc tai nghe có mic (tránh mic laptop tích hợp) |

## 1.3 — Chuẩn bị môi trường demo

### a. Dữ liệu demo

Trước khi quay, chuẩn bị **dataset demo** với:
- **3 Cơ quan đơn vị** cấp trên: vd "Phòng A", "Phòng B", "Phòng C"
- **5 Đơn vị trực thuộc** dưới mỗi CQDV
- **30–50 quân nhân** rải đều các đơn vị, đa dạng cấp bậc
- **Lịch sử danh hiệu** ít nhất 5 năm gần nhất (2021–2025) với:
  - Một vài quân nhân đã đạt chuỗi BKBQP (đủ cho demo CSTDTQ)
  - Một quân nhân đã đạt chuỗi đầy đủ tiến tới BKTTCP
  - Một quân nhân đã có HCBVTQ Hạng Ba (cho demo rank upgrade)
- **Một vài quyết định** đã có trong `FileQuyetDinh` để demo autocomplete

→ Có thể viết **seed script** ở `BE-QLKT/src/scripts/seedDemoData.ts` chạy 1 lệnh là có data.

### b. 4 tài khoản demo

| Username | Role | Mô tả demo |
|---|---|---|
| `superadmin_demo` | SUPER_ADMIN | Backup, audit log toàn diện |
| `admin_demo` | ADMIN | Phê duyệt đề xuất, ký quyết định |
| `manager_demo` | MANAGER | Tạo đề xuất, scope theo Phòng A |
| `user_demo` | USER | Xem hồ sơ cá nhân, nhận thông báo |

→ Mật khẩu đặt đơn giản (`demo123!`) cho tiện quay. **Đổi mật khẩu sau khi quay xong** nếu deploy thật.

### c. Browser cleanup

- Dùng **Chrome Incognito** hoặc tạo profile riêng `Demo` — không có extension quảng cáo
- **Zoom 110–125%** để chữ to, dễ nhìn trên video
- **Tắt notification hệ thống** (Slack, mail, Telegram...) trước khi quay
- **Dọn taskbar** — chỉ chừa icon cần thiết
- **Đặt wallpaper trung tính** màu xám hoặc xanh nhạt

### d. Khởi động sẵn

```bash
# Terminal 1 (BE)
cd BE-QLKT && npm run dev

# Terminal 2 (FE)
cd FE-QLKT && npm run dev

# Terminal 3 (logs realtime - optional)
cd BE-QLKT && tail -f logs/dev.log
```

→ Mở sẵn `localhost:3000` trong browser, đăng nhập tài khoản `manager_demo` ở tab thứ nhất, `admin_demo` ở tab thứ hai, `user_demo` ở tab thứ ba (cho demo notification real-time).

## 1.4 — Quy ước file output

| Quy ước | Ví dụ |
|---|---|
| Tên file | `V##-mo-ta-ngan.mp4` |
| Ví dụ | `V01-login-tong-quan.mp4` |
| Thư mục lưu | `slides/videos/` (gitignore) |
| Đặt thumbnail | screenshot frame đẹp ~10% từ đầu video |

---

# Phần 2 — Roadmap 15 video demo

> **Thứ tự quay quan trọng** — video sau dùng data đã setup từ video trước. Nếu reset data giữa chừng phải seed lại.

## V01 — Login + Tổng quan giao diện (90 giây)

**Mục tiêu**: cho hội đồng thấy hệ thống đăng nhập 4 vai trò + giao diện chính.

**Kịch bản**:
1. Mở `localhost:3000` → trang login. Show 1 lần CCCD + password sai để demo error message
2. Đăng nhập `admin_demo`
3. Tour nhanh sidebar: Dashboard → Quân nhân → Khen thưởng → Đề xuất → Hệ thống
4. Click vào Dashboard → show số liệu tổng quan
5. Logout, đăng nhập lại bằng `manager_demo` để show **menu khác** (giới hạn theo MANAGER)

**Lưu ý quay**:
- Khi gõ password, đảm bảo che camera nhìn bàn phím (nếu có recording webcam)
- Nói rõ "Đây là tài khoản Phòng Chính trị / Chỉ huy đơn vị / ..." khi đăng nhập từng role

---

## V02 — Quản lý đơn vị + chức vụ (60 giây)

**Mục tiêu**: cấu trúc cây CQDV → DVTT, thêm chức vụ.

**Tài khoản**: `admin_demo`

**Kịch bản**:
1. Vào "Quản lý đơn vị" → show cây CQDV/DVTT đã có
2. Thêm 1 DVTT mới dưới Phòng A → show validation `ma_don_vi` unique
3. Thêm 1 chức vụ "Trưởng phòng" với hệ số 0.9 → show validation
4. Show số lượng quân nhân auto-update khi thêm DVTT

**Highlight**: cấu trúc 2 cấp + auto-count + validate composite unique.

---

## V03 — Quản lý quân nhân + lịch sử chức vụ (2 phút)

**Mục tiêu**: CRUD quân nhân, thêm lịch sử chức vụ phục vụ tính HCBVTQ.

**Tài khoản**: `admin_demo`

**Kịch bản**:
1. Vào "Quân nhân" → list, filter theo đơn vị
2. **Thêm mới**: nhập CCCD trùng → show error "CCCD đã tồn tại"
3. Thêm thành công 1 quân nhân mới
4. Mở detail quân nhân → tab "Lịch sử chức vụ" → thêm 2-3 record với hệ số khác nhau (0.7 / 0.8 / 0.9-1.0)
5. Tab "NCKH" → thêm 1 đề tài khoa học cho năm 2024
6. Show "Hồ sơ niên hạn" + "Hồ sơ cống hiến" tự tính số tháng

**Highlight**: form đầy đủ, validate, lịch sử chức vụ feed vào tính HCBVTQ.

---

## V04 — Import Excel danh hiệu hằng năm (2 phút)

**Mục tiêu**: 2-step pattern (Preview → Confirm) + handle error.

**Tài khoản**: `admin_demo`

**Kịch bản**:
1. Vào "Khen thưởng / Hằng năm cá nhân" → "Import Excel"
2. Click "Tải template" → show file Excel có dropdown data validation
3. Mở file Excel template, điền **5 dòng**: 3 dòng OK, 2 dòng sai (1 sai CCCD, 1 sai năm)
4. Upload → bước **Preview**: hệ thống show bảng có 3 dòng OK + 2 dòng lỗi với message cụ thể
5. Click "Xác nhận import" → 3 dòng OK được lưu; lỗi không lưu
6. Mở list danh hiệu → confirm 3 record mới

**Highlight**: preview an toàn trước commit, error message tiếng Việt rõ ràng.

---

## V05 — Tạo đề xuất CA_NHAN_HANG_NAM (Manager) (2 phút)

**Mục tiêu**: tạo đề xuất từ vai trò Chỉ huy đơn vị.

**Tài khoản**: `manager_demo`

**Kịch bản**:
1. Vào "Đề xuất khen thưởng" → "Tạo mới" → chọn loại "Cá nhân hằng năm"
2. Chọn năm 2026 → list quân nhân thuộc đơn vị MANAGER quản lý
3. Show **gợi ý tự động**: bên cạnh quân nhân đủ điều kiện có nhãn xanh "Đủ ĐK BKBQP"
4. Tích chọn 3 quân nhân — 2 đủ ĐK, 1 chưa đủ
5. Bấm "Kiểm tra điều kiện" → quân nhân chưa đủ ĐK báo lỗi cụ thể (ví dụ: "Mới đạt CSTDCS 1 năm, cần 2 năm liên tục")
6. Bỏ quân nhân lỗi, đính kèm file → "Trình duyệt"
7. Show notification toast "Đã gửi đề xuất, chờ Phòng Chính trị duyệt"

**Highlight**: gợi ý chủ động, validate trước submit, scope theo đơn vị.

---

## V06 — Phê duyệt đề xuất + sinh PDF (Admin) (2.5 phút) ⭐

**Mục tiêu**: bước critical nhất — 4 lớp validate + transaction + audit log + notification.

**Tài khoản**: `admin_demo`

**Kịch bản**:
1. Vào "Đề xuất chờ duyệt" → mở đề xuất vừa tạo ở V05
2. Show form chi tiết với danh sách quân nhân + thông tin từng người
3. Nhập **số quyết định** mới → autocomplete tra `FileQuyetDinh` đã có
4. Đính kèm file PDF quyết định
5. Bấm "Phê duyệt" → hệ thống chạy 4 lớp validate (show loading)
6. Sau khi duyệt thành công, show:
   - Đề xuất chuyển status APPROVED
   - List khen thưởng đã được lưu
   - Notification toast bên `manager_demo` (mở browser tab khác show)
7. Mở "Audit log" → filter theo resource = "proposals" → show log mới nhất với payload before/after

**Highlight**: full-stack flow trong 1 bấm chuột — duyệt + sinh PDF + recalc + notification + audit.

---

## V07 — Từ chối đề xuất (60 giây)

**Mục tiêu**: reject path với lý do cụ thể.

**Tài khoản**: `admin_demo`

**Kịch bản**:
1. Tạo nhanh 1 đề xuất khác bằng `manager_demo` (hoặc dùng đề xuất pending có sẵn)
2. `admin_demo` mở đề xuất → bấm "Từ chối"
3. Modal nhập lý do — show validation "Lý do không được bỏ trống"
4. Nhập "Hồ sơ chưa đủ minh chứng" → confirm
5. Show đề xuất chuyển REJECTED, notification gửi về `manager_demo` với lý do

**Highlight**: optimistic-lock guard chống double-reject (nếu có 2 admin reject cùng lúc).

---

## V08 — Chuỗi danh hiệu BKBQP/CSTDTQ/BKTTCP (3 phút) ⭐⭐⭐

**Mục tiêu**: điểm cộng quan trọng nhất — logic core của đồ án.

**Tài khoản**: `admin_demo`

**Kịch bản**:
1. Mở hồ sơ 1 quân nhân đã có sẵn chuỗi gần đầy đủ
2. Tab "Hồ sơ chuỗi" → show timeline 7 năm với danh hiệu từng năm + flag BKBQP/CSTDTQ
3. Show ô "Gợi ý" — văn bản tự sinh: "Đủ điều kiện đề nghị Bằng khen Thủ tướng năm 2026"
4. **Demo cửa sổ trượt**: vào DanhHieuHangNam, sửa năm 2019 (BKBQP cũ) thành không có → recalc → show số "BKBQP trong 7y" giảm → gợi ý chuyển thành "Chưa đủ"
5. Khôi phục → recalc lại
6. **Demo lifetime**: tạo 1 đề xuất BKTTCP cho quân nhân đã có BKTTCP → show error "Đã có Bằng khen Thủ tướng. Phần mềm chưa hỗ trợ các danh hiệu cao hơn..."

**Highlight**: 3 quy tắc đặc biệt cùng demo trong 1 video — core defendable.

---

## V09 — Niên hạn HCCSVV (đề xuất + duyệt) (2 phút)

**Mục tiêu**: nhóm UC6 — HCCSVV theo năm phục vụ.

**Tài khoản**: `manager_demo` → `admin_demo`

**Kịch bản**:
1. `manager_demo` tạo đề xuất loại "NIÊN HẠN" cho 1 quân nhân đã đủ 10 năm phục vụ
2. Show hệ thống tự tính `service_years` từ `ngay_nhap_ngu`
3. Đề xuất Hạng Ba (10 năm) — submit
4. `admin_demo` duyệt → sinh quyết định
5. Sau 5 năm (mock data), demo tiếp đề xuất Hạng Nhì → show validate "Phải đề nghị Hạng Nhất nếu đã đủ 20 năm"

**Highlight**: validate niên hạn + chống đề xuất hạng thấp khi đủ hạng cao.

---

## V10 — Cống hiến HCBVTQ + rank upgrade (2.5 phút) ⭐

**Mục tiêu**: nhóm UC7 — đặc thù rank-upgrade với 3 hạng.

**Tài khoản**: `admin_demo`

**Kịch bản**:
1. Mở hồ sơ quân nhân có lịch sử chức vụ đủ 120 tháng hệ số 0.7-1.0 → đủ Hạng Ba
2. Tạo đề xuất CONG_HIEN Hạng Ba → duyệt thành công
3. Tab "Hồ sơ cống hiến" — show `hcbvtq_hang_ba_status = DA_NHAN`
4. Sau vài năm thêm chức vụ hệ số 0.8-0.9 → đủ Hạng Nhì
5. **Demo chống tampering**: cố tạo đề xuất Hạng Ba cho quân nhân đó nữa → error "Hệ thống đã đề xuất Hạng Nhì là hạng cao nhất đủ điều kiện"
6. Tạo đề xuất Hạng Nhì → duyệt → show record cũ được **update danh hiệu**, không tạo record mới (vì 1-1 với QN)

**Highlight**: rank upgrade logic — quan trọng nhất trong UC7.

---

## V11 — Khen thưởng đột xuất (90 giây)

**Mục tiêu**: nhóm UC9 — flow riêng, không qua proposal.

**Tài khoản**: `admin_demo`

**Kịch bản**:
1. Vào "Khen thưởng đột xuất" → "Tạo mới"
2. Chọn đối tượng cá nhân/tập thể → form khác nhau
3. Nhập thông tin sự kiện, đính kèm quyết định
4. Save trực tiếp — không qua duyệt 3 cấp
5. Show list KT đột xuất + filter theo năm/đơn vị

**Highlight**: ADMIN tạo trực tiếp, ghi thẳng vào bảng riêng, không dùng Strategy.

---

## V12 — Quản lý quyết định + cascade rename (2 phút) ⭐

**Mục tiêu**: feature mới — natural-key FK + cascade.

**Tài khoản**: `admin_demo`

**Kịch bản**:
1. Vào "Quản lý quyết định" → list các `FileQuyetDinh`
2. Mở 1 quyết định đã được nhiều bảng tham chiếu (vd: `12/QĐ-BTL` được dùng trong 5 DanhHieuHangNam + 2 ThanhTichKhoaHoc)
3. Click "Đổi số quyết định" → nhập số mới `12-2025/QĐ-BTL`
4. Show modal warning: "Việc đổi số sẽ cascade qua 7 bản ghi tham chiếu"
5. Confirm → show success
6. Mở các bảng tham chiếu → confirm số mới đã được cập nhật
7. **Demo restrict**: cố xoá quyết định còn được dùng → error "Còn 7 bản ghi đang tham chiếu"

**Highlight**: hard FK natural-key + cascade rename + onDelete restrict — điểm thiết kế DB cao cấp.

---

## V13 — Notification real-time (60 giây)

**Mục tiêu**: Socket.IO push.

**Tài khoản**: `manager_demo` (browser 1) + `admin_demo` (browser 2)

**Kịch bản**:
1. Mở 2 browser cạnh nhau, đăng nhập 2 tài khoản
2. `manager_demo` tạo nhanh 1 đề xuất → submit
3. **Cùng frame**, `admin_demo` thấy notification badge tăng + toast "Có đề xuất mới"
4. `admin_demo` click notification → tự navigate đến đề xuất
5. Phê duyệt → `manager_demo` thấy notification ngay
6. Show bell icon đếm số chưa đọc

**Highlight**: WebSocket push không cần F5 reload.

---

## V14 — Audit log + filter (60 giây)

**Mục tiêu**: truy vết toàn diện.

**Tài khoản**: `admin_demo`

**Kịch bản**:
1. Vào "Nhật ký hệ thống"
2. Filter theo người thực hiện → chọn `manager_demo`
3. Filter theo resource → chọn "proposals"
4. Filter theo action → chọn "APPROVE"
5. Click 1 log → show modal với payload before/after dạng JSON diff
6. Đăng nhập `superadmin_demo` → show thêm log resource = "backup" (bị filter ẩn với admin)

**Highlight**: filter đa chiều + role-based visibility (backup chỉ SUPER_ADMIN).

---

## V15 — Backup + DevZone (90 giây)

**Mục tiêu**: vận hành hệ thống.

**Tài khoản**: `superadmin_demo`

**Kịch bản**:
1. Đăng nhập DevZone bằng password riêng (`/api/dev-zone/auth`)
2. Vào "Backup management"
3. Show schedule hiện tại (`0 1 1 * *` — 1AM ngày 1 mỗi tháng)
4. Đổi schedule thành "mỗi ngày 2AM" → save → show validate cron syntax
5. Click "Trigger thủ công" → show progress + thông báo "Backup thành công, file `backup_2026_05_01.sql` size 4.2 MB"
6. Mở terminal → `ls BE-QLKT/backups/` → show file mới
7. Show "Cleanup" button → xoá file > N ngày

**Highlight**: backup tự động + manual trigger + cleanup theo retention.

---

# Phần 3 — Highlight reel cho slide bảo vệ (5 phút)

> Cắt **đoạn ấn tượng nhất** từ 15 video trên ghép thành 1 highlight reel chiếu trong slide.

## Cấu trúc highlight reel

| Đoạn | Lấy từ video | Thời lượng | Nội dung |
|---|---|---|---|
| Intro 5s | (tự quay) | 5s | Logo HUST + tên đề tài + tên SV |
| Login + tour | V01 | 25s | Đăng nhập 4 role nhanh |
| Tạo đề xuất | V05 | 30s | Manager tạo, gợi ý đủ điều kiện |
| **Phê duyệt + PDF** | V06 | 50s | Đoạn duyệt + sinh PDF + notification |
| **Chuỗi danh hiệu** | V08 | 60s | Demo cửa sổ trượt + lifetime block |
| Rank upgrade | V10 | 30s | HCBVTQ Hạng Ba → Nhì |
| Cascade rename | V12 | 30s | Đổi số QĐ → cascade 7 bản ghi |
| Notification real-time | V13 | 25s | 2 browser side-by-side |
| Audit log | V14 | 20s | Filter + payload diff |
| Outro 5s | (tự quay) | 5s | "Thank you for watching" |
| **Tổng** | | **~5 phút** | |

→ Highlight reel chiếu trong **Slide 13** (Tự động xét điều kiện) hoặc **Slide 15** (Excel) hoặc làm slide riêng giữa Phần 3.

---

# Phần 4 — Recording tips

## 4.1 — Trước khi nhấn Record

- [ ] **Tắt notification** macOS/Windows (Do Not Disturb / Focus mode)
- [ ] **Đóng Slack, Telegram, Mail, Discord, Zalo** — hoặc chuyển sang status invisible
- [ ] **Đóng tab browser** không liên quan
- [ ] **Test mic** trước — quay 5 giây thử rồi nghe lại
- [ ] **Đặt cốc nước** sẵn cạnh để uống giữa các video
- [ ] **Bật chế độ "không ngủ"** (caffeine trên Mac, Energy Saver trên Windows)
- [ ] **Đeo tai nghe** để nghe playback echo nếu có

## 4.2 — Khi quay

1. **Cursor di chuyển chậm** — tốc độ vừa phải, không zigzag
2. **Click rõ ràng** — đợi UI phản hồi xong rồi mới nói tiếp
3. **Highlight cursor** nếu tool hỗ trợ (ScreenStudio tự làm, OBS cần plugin)
4. **Nói chậm + rõ** — chậm hơn nói chuyện thường ngày 20%
5. **Im lặng giữa các bước** — đừng "ờm... ờm... à..." — thà im 1 giây còn hơn
6. **Nếu vấp**: dừng 3 giây, **không cần quay lại từ đầu** — sau cut bỏ phần lỗi

## 4.3 — Khi gặp lỗi giữa video

- **Đoạn ngắn (< 30s)**: quay lại từ đầu video
- **Đoạn dài**: stop record, đánh dấu timestamp, quay tiếp từ điểm lỗi → ghép trong post-production
- **Lỗi UI/data demo**: ghi lại để fix sau, **không debug live trong khi đang quay**

---

# Phần 5 — Post-production

## 5.1 — Edit (cắt + ghép)

| Tool | Phù hợp |
|---|---|
| **DaVinci Resolve** | Free, mạnh, hơi khó học |
| **iMovie** (Mac) | Sẵn có, dễ dùng |
| **CapCut Desktop** | Free, intuitive, có template |
| **Adobe Premiere** | Pro, tốn phí |

→ Khuyến nghị **DaVinci Resolve** (free) hoặc **CapCut Desktop** (đơn giản).

## 5.2 — Quy trình edit

1. **Trim đầu/cuối** — cắt khoảng silence > 2 giây
2. **Cut dead time** — đoạn loading > 3 giây tăng tốc 2x hoặc fade
3. **Highlight click** — thêm hiệu ứng "ripple" khi nhấp chuột (DaVinci có sẵn)
4. **Caption** (optional) — nếu phụ đề tiếng Việt sẽ dễ tiếp thu hơn cho hội đồng lớn tuổi
5. **Outro card** — 2 giây cuối hiện tên video + logo

## 5.3 — Export

| Đầu ra | Format | Bitrate | Dung lượng dự kiến |
|---|---|---|---|
| **Master copy** | MP4 H.264 1080p30 | 8 Mbps | ~50 MB / phút |
| **Web copy** (gửi GVHD) | MP4 H.264 720p30 | 4 Mbps | ~25 MB / phút |
| **Backup phòng demo fail** | MP4 trên USB | 8 Mbps | giữ cùng laptop |

## 5.4 — Đặt tên + organize

```
slides/videos/
├── master/                  # 1080p full quality
│   ├── V01-login-tong-quan.mp4
│   ├── V02-don-vi.mp4
│   └── ...
├── web/                     # 720p compressed
│   └── ...
├── highlight/
│   └── highlight-reel-5min.mp4
└── thumbnails/
    └── V01-thumb.png
```

→ Thêm vào `.gitignore`: `slides/videos/` (file lớn, không push lên git).

---

# Phần 6 — Checklist deliverables

Trước buổi bảo vệ, đảm bảo có:

- [ ] **15 video master** 1080p, đặt tên theo quy ước
- [ ] **Highlight reel 5 phút** đã edit, có intro + outro
- [ ] **USB backup** chứa highlight reel + 5 video quan trọng nhất (V06, V08, V10, V12, V13)
- [ ] **Slide PDF** có embed hoặc link đến video
- [ ] **Demo data seed script** (`seedDemoData.ts`) đã commit + test
- [ ] **4 tài khoản demo** đã tạo, password đơn giản
- [ ] **Source code** đã commit hết, không có file bí mật (`.env`, password)
- [ ] **Browser profile demo** đã setup, lưu password để click 1 lần là vào
- [ ] **OBS scene** đã save preset, mở lên là quay được ngay
- [ ] **Mic test** ngày trước bảo vệ, đảm bảo không có echo/noise

---

# Phần 7 — Lịch quay đề xuất

Giả sử em có 3 ngày trước bảo vệ:

| Ngày | Việc | Thời lượng |
|---|---|---|
| **D-3 sáng** | Setup data demo + 4 tài khoản + browser profile + test OBS | 2-3 giờ |
| **D-3 chiều** | Quay V01-V05 (5 video đơn giản) | 2 giờ (bao gồm retake) |
| **D-3 tối** | Edit + export V01-V05 | 1.5 giờ |
| **D-2 sáng** | Quay V06-V10 (5 video core) | 2.5 giờ |
| **D-2 chiều** | Quay V11-V15 (5 video còn lại) | 2 giờ |
| **D-2 tối** | Edit V06-V15 | 2 giờ |
| **D-1 sáng** | Cắt highlight reel 5 phút | 1.5 giờ |
| **D-1 chiều** | Watch-through tất cả 1 lượt + fix lỗi nhỏ | 1 giờ |
| **D-1 tối** | Backup USB + upload Drive (cho GVHD) | 30 phút |
| **Buổi bảo vệ** | Mang USB + laptop + slide có embed video | — |

**Tổng**: ~15 giờ làm việc rải 3 ngày.

→ Nếu gấp hơn (1-2 ngày), bỏ V02, V07, V11 và rút highlight reel xuống 3 phút.

---

# Phần 8 — Câu hỏi thường gặp khi quay

**Q: Quay tiếng Việt hay tiếng Anh?**
> Tiếng Việt — vì hội đồng và GVHD đều dùng tiếng Việt. Có thể thêm caption tiếng Anh nếu thesis nộp song ngữ.

**Q: Có cần webcam khuôn mặt em góc không?**
> Không bắt buộc. Nếu có, đặt góc nhỏ phía trên-phải với background blur. Nếu không, chỉ giọng nói cũng đủ.

**Q: Nếu hội đồng yêu cầu demo live mà em đã có video?**
> Vẫn nên demo live song song. Video chỉ là backup khi mạng/máy chiếu lỗi. **Không từ chối demo live** vì sẽ bị nghi ngờ video là cherry-pick.

**Q: Nên gửi video cho GVHD trước bao lâu?**
> Ít nhất **3 ngày trước** bảo vệ — để GVHD có thời gian xem và yêu cầu chỉnh sửa.

**Q: Video quá nặng không gửi được qua email?**
> Upload Google Drive / OneDrive, gửi link kèm permission "anyone with link can view". Tránh upload YouTube public — có thể leak nội dung quân sự.

**Q: Cần tạo subtitle file riêng không?**
> Không bắt buộc. Nhưng nếu làm thì xuất `.srt` từ DaVinci/CapCut, gửi kèm video master để hội đồng có thể bật/tắt.

---

# Phụ lục — Script kịch bản nói trong video (template)

> Mỗi video nên có script ngắn gọn 100-200 từ. Mẫu cho video V06:

## V06 — Phê duyệt đề xuất + sinh PDF (script narration)

> "Trong video này, em demo bước critical nhất của hệ thống — phê duyệt đề xuất khen thưởng. Em đăng nhập tài khoản Phòng Chính trị, mở danh sách đề xuất chờ duyệt vừa được tạo từ video trước.
>
> Em nhập số quyết định mới — autocomplete tự tra `FileQuyetDinh` đã có. Em đính kèm file PDF quyết định, rồi bấm "Phê duyệt".
>
> Hệ thống chạy bốn lớp validate: kiểm tra trạng thái, trùng lặp, điều kiện chuỗi, và hợp lệ số quyết định. Nếu pass tất cả, hệ thống thực hiện một transaction bao gồm: tạo bản ghi FileQuyetDinh, lưu khen thưởng vào hồ sơ, cập nhật trạng thái đề xuất.
>
> Sau khi commit, em có thể thấy đồng thời: đề xuất chuyển trạng thái APPROVED, danh sách khen thưởng đã được lưu, và một notification toast hiện ra ở browser tài khoản Chỉ huy đơn vị bên cạnh — đây là Socket.IO push real-time.
>
> Cuối cùng, em mở Audit log để xem bản ghi mới nhất với payload before/after được lưu đầy đủ phục vụ truy vết."

→ **Đọc thử bấm giờ** trước khi quay — đảm bảo khớp 2.5 phút video.
