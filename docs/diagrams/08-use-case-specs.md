# Đặc tả Use Case (Bảng đặc tả)

> Theo format chuẩn HUST: Tên ca sử dụng + ID / Tác nhân hệ thống / Tiền điều kiện / Luồng sự kiện chính / Luồng sự kiện thay thế / Hậu điều kiện. Mỗi luồng đánh số `1`, `1.1`, `1.2`, ... và luồng thay thế đánh số `1.4a`, `1.4b`, ...
>
> Mỗi bảng đối chiếu với route + service thực tế trong code (file BE-QLKT/src).
>
> **Tên actor lấy từ `FE-QLKT/src/constants/roles.constants.ts`** (`ROLE_LABELS`):
>
> | Role code | Display name (dùng trong báo cáo) |
> |---|---|
> | SUPER_ADMIN | Quản trị viên |
> | ADMIN | Phòng Chính trị |
> | MANAGER | Chỉ huy đơn vị |
> | USER | Người dùng |
> | SYSTEM | Hệ thống |
>
> **Quy ước**: trong các bảng đặc tả dưới đây, "Quản trị viên" luôn ám chỉ vai trò SUPER_ADMIN, "Phòng Chính trị" ám chỉ ADMIN, "Chỉ huy đơn vị" ám chỉ MANAGER. Khi nhiều role cùng truy cập một use case, liệt kê đầy đủ và kèm chú thích role code trong ngoặc.

---

## Bảng 2.1 — Đặc tả use case **Đăng nhập** (UC-01)

| Tên ca sử dụng: Đăng nhập | ID: UC-01 |
|---|---|
| **Tác nhân hệ thống** | Mọi tài khoản (Quản trị viên / Phòng Chính trị / Chỉ huy đơn vị / Người dùng) |
| **Tiền điều kiện** | Người dùng đã có tài khoản (`TaiKhoan`) trong hệ thống do SUPER_ADMIN cấp |
| **Luồng sự kiện chính** | |

| STT | Thực hiện | Hành động |
|---|---|---|
| 1 | Người dùng | Truy cập trang đăng nhập `/login` |
| 1.1 | Hệ thống | Hiển thị form đăng nhập với hai trường username và mật khẩu |
| 1.2 | Người dùng | Nhập thông tin đăng nhập và bấm "Đăng nhập" |
| 1.3 | Hệ thống | Validate dữ liệu form (Joi schema) |
| 1.4 | Hệ thống | Tìm tài khoản theo username trong bảng `TaiKhoan` |
| 1.5 | Hệ thống | So sánh password với `password_hash` bằng `bcrypt.compare()` |
| 1.6 | Hệ thống | Sinh `accessToken` (15 phút) và `refreshToken` (7 ngày) bằng JWT |
| 1.7 | Hệ thống | Lưu `refreshToken` vào DB (`TaiKhoan.refreshToken`) |
| 1.8 | Hệ thống | Ghi `SystemLog` action LOGIN qua middleware |
| 1.9 | Hệ thống | Trả về thông tin user + token, FE lưu token và điều hướng theo role |

| **Luồng sự kiện thay thế** | |
|---|---|

| STT | Thực hiện | Hành động |
|---|---|---|
| 1.3a | Hệ thống | Validate fail → Trả 400 Bad Request kèm message |
| 1.3b | Người dùng | Sửa lại dữ liệu, tiếp tục từ bước 1.2 |
| 1.4a | Hệ thống | Không tìm thấy tài khoản → Trả 401 "Sai tài khoản hoặc mật khẩu" |
| 1.5a | Hệ thống | Sai mật khẩu → Trả 401 "Sai tài khoản hoặc mật khẩu" |

| **Hậu điều kiện** | Người dùng được điều hướng đến dashboard tương ứng với role; `accessToken` được lưu cho các request tiếp theo |

---

## Bảng 2.2 — Đặc tả use case **Quản lý quân nhân** (UC-02)

| Tên ca sử dụng: Quản lý quân nhân | ID: UC-02 |
|---|---|
| **Tác nhân hệ thống** | Quản trị viên (SUPER_ADMIN — tạo/sửa/xoá/xuất Excel), Phòng Chính trị (ADMIN — tạo/sửa/xoá/xuất Excel), Chỉ huy đơn vị (MANAGER — chỉ xem + cập nhật quân nhân thuộc đơn vị mình), Người dùng (USER — chỉ xem hồ sơ cá nhân) |
| **Tiền điều kiện** | Đã đăng nhập. Tạo / xoá / xuất Excel yêu cầu role SUPER_ADMIN hoặc ADMIN (`requireAdmin`). Cập nhật yêu cầu role SUPER_ADMIN, ADMIN hoặc MANAGER (`requireManager`); MANAGER chỉ được sửa quân nhân thuộc đơn vị quản lý |
| **Luồng sự kiện chính** | |

| STT | Thực hiện | Hành động |
|---|---|---|
| 1 | Quản trị viên / Phòng Chính trị | Thêm mới quân nhân (POST `/api/personnel` — `requireAdmin`) |
| 1.1 | Quản trị viên / Phòng Chính trị | Chọn "Thêm quân nhân" |
| 1.2 | Hệ thống | Hiển thị form thêm quân nhân với các trường (CCCD, họ tên, giới tính, ngày sinh, đơn vị, chức vụ, cấp bậc, ngày nhập ngũ, ...) |
| 1.3 | Quản trị viên / Phòng Chính trị | Nhập thông tin và chọn lưu |
| 1.4 | Hệ thống | Validate Joi (CCCD đúng định dạng, đơn vị tồn tại, chức vụ tồn tại) |
| 1.5 | Hệ thống | Lưu `QuanNhan` + tạo bản ghi `LichSuChucVu` đầu tiên |
| 1.6 | Hệ thống | Tăng `so_luong` của CQDV/DVTT, tạo các hồ sơ rỗng (`HoSoNienHan`, `HoSoCongHien`, `HoSoHangNam`) |
| 1.7 | Hệ thống | Ghi SystemLog action CREATE và thông báo thành công |
| 2 | Quản trị viên / Phòng Chính trị / Chỉ huy đơn vị | Cập nhật thông tin quân nhân (PUT `/api/personnel/:id` — `requireManager`) |
| 2.1 | Quản trị viên / Phòng Chính trị / Chỉ huy đơn vị | Tìm kiếm quân nhân theo bộ lọc và từ khóa |
| 2.2 | Hệ thống | Hiển thị danh sách quân nhân tương ứng (MANAGER chỉ thấy đơn vị mình) |
| 2.3 | Quản trị viên / Phòng Chính trị / Chỉ huy đơn vị | Chọn quân nhân cần sửa, chọn "Chỉnh sửa" |
| 2.4 | Hệ thống | Hiển thị form với dữ liệu hiện tại |
| 2.5 | Quản trị viên / Phòng Chính trị / Chỉ huy đơn vị | Sửa thông tin và lưu |
| 2.6 | Hệ thống | Validate, cập nhật DB, điều chỉnh `so_luong` đơn vị nếu chuyển đơn vị, ghi log |
| 3 | Quản trị viên / Phòng Chính trị | Xóa quân nhân (DELETE `/api/personnel/:id` — `requireAdmin`) |
| 3.1 | Quản trị viên / Phòng Chính trị | Tìm quân nhân và chọn "Xóa" |
| 3.2 | Hệ thống | Hiển thị xác nhận |
| 3.3 | Quản trị viên / Phòng Chính trị | Xác nhận xóa |
| 3.4 | Hệ thống | Xóa `QuanNhan` (cascade các bảng liên quan), giảm `so_luong`, ghi log |

| **Luồng sự kiện thay thế** | |
|---|---|

| STT | Thực hiện | Hành động |
|---|---|---|
| 1.4a | Hệ thống | Validate fail (CCCD trùng / đơn vị không tồn tại) → Trả 400 với message tiếng Việt |
| 1.4b | Quản trị viên / Phòng Chính trị | Sửa lại dữ liệu, tiếp tục từ 1.3 |
| 2.6a | Hệ thống | Cập nhật fail → Trả 400 |
| 2.6b | Quản trị viên / Phòng Chính trị / Chỉ huy đơn vị | Sửa lại dữ liệu |
| 2.6c | Hệ thống | MANAGER cập nhật quân nhân ngoài phạm vi đơn vị quản lý → Trả 403 Forbidden |

| **Hậu điều kiện** | Bảng `QuanNhan` được cập nhật. `so_luong` của các đơn vị liên quan được điều chỉnh chính xác. Các hồ sơ con (`HoSoNienHan`, `HoSoCongHien`, `HoSoHangNam`) được khởi tạo cho quân nhân mới |

---

## Bảng 2.3 — Đặc tả use case **Tạo đề xuất khen thưởng cá nhân hằng năm** (UC-03)

| Tên ca sử dụng: Tạo đề xuất CA_NHAN_HANG_NAM | ID: UC-03 |
|---|---|
| **Tác nhân hệ thống** | Chỉ huy đơn vị (chính), Phòng Chính trị (cũng có quyền) |
| **Tiền điều kiện** | Đã đăng nhập, có quân nhân thuộc đơn vị quản lý đủ điều kiện chuỗi BKBQP/CSTDTQ/BKTTCP |
| **Luồng sự kiện chính** | |

| STT | Thực hiện | Hành động |
|---|---|---|
| 1 | Chỉ huy đơn vị | Chọn menu "Đề xuất khen thưởng" → "Tạo đề xuất mới" |
| 1.1 | Hệ thống | Hiển thị wizard Step 1: chọn loại đề xuất |
| 1.2 | Chỉ huy đơn vị | Chọn loại "Khen thưởng cá nhân hằng năm" + năm đề xuất |
| 1.3 | Hệ thống | Hiển thị Step 2: cây đơn vị + danh sách quân nhân đủ điều kiện (đã filter qua `checkChainEligibility`) |
| 1.4 | Chỉ huy đơn vị | Chọn các quân nhân cần đề xuất |
| 1.5 | Hệ thống | Hiển thị Step 3: nhập số quyết định, ghi chú, đính kèm file |
| 1.6 | Chỉ huy đơn vị | Nhập thông tin và bấm "Gửi đề xuất" |
| 1.7 | Hệ thống | Validate Joi schema, parse `title_data` JSON |
| 1.8 | Hệ thống | Lưu file đính kèm vào `storage/proposals/` |
| 1.9 | Hệ thống | Lấy strategy qua `getProposalStrategy('CA_NHAN_HANG_NAM')` |
| 1.10 | Hệ thống | Strategy gọi `checkChainEligibility` cho từng quân nhân |
| 1.11 | Hệ thống | Tạo bản ghi `BangDeXuat` với `status = PENDING` |
| 1.12 | Hệ thống | Controller gọi `notifyAdminsOnProposalSubmission` → INSERT `ThongBao` cho ADMIN + emit Socket.IO |
| 1.13 | Hệ thống | Trả 201 Created với thông tin đề xuất |
| 1.14 | Chỉ huy đơn vị | Hiển thị thông báo "Đã gửi đề xuất khen thưởng thành công" |

| **Luồng sự kiện thay thế** | |
|---|---|

| STT | Thực hiện | Hành động |
|---|---|---|
| 1.7a | Hệ thống | Validate fail → 400 Bad Request |
| 1.10a | Hệ thống | Một hoặc nhiều quân nhân không đủ điều kiện chuỗi (vd: chưa đủ streak, đã có BKTTCP) → Throw `ValidationError` với reason kèm gợi ý từng dòng |
| 1.10b | Chỉ huy đơn vị | Bỏ chọn các quân nhân không đủ điều kiện hoặc đợi đến năm sau |

| **Hậu điều kiện** | `BangDeXuat` được lưu với `status = PENDING`. ADMIN nhận thông báo realtime. Đề xuất chờ ADMIN duyệt |

---

## Bảng 2.4 — Đặc tả use case **Phê duyệt đề xuất khen thưởng** (UC-04)

| Tên ca sử dụng: Phê duyệt đề xuất | ID: UC-04 |
|---|---|
| **Tác nhân hệ thống** | Phòng Chính trị |
| **Tiền điều kiện** | Đã đăng nhập với vai trò Phòng Chính trị. Tồn tại đề xuất với `status = PENDING` |
| **Luồng sự kiện chính** | |

| STT | Thực hiện | Hành động |
|---|---|---|
| 1 | Phòng Chính trị | Mở danh sách đề xuất, chọn 1 đề xuất PENDING |
| 1.1 | Hệ thống | Hiển thị chi tiết đề xuất với danh sách quân nhân, file đính kèm, ghi chú |
| 1.2 | Phòng Chính trị | Sửa số quyết định, đính kèm PDF quyết định nếu cần |
| 1.3 | Phòng Chính trị | Bấm "Phê duyệt" |
| 1.4 | Hệ thống | Controller parse body qua `parseApproveBody`, gọi `proposalService.approveProposal()` |
| 1.5 | Hệ thống | `validateApproveContext` kiểm tra status, duplicate, decision number |
| 1.6 | Hệ thống | Lấy strategy qua `requireProposalStrategy(loai_de_xuat)`, gọi `strategy.validateApprove()` |
| 1.7 | Hệ thống | Build mappings cho số quyết định + PDF |
| 1.8 | Hệ thống | Mở `prisma.$transaction`, gọi `strategy.importInTransaction()` |
| 1.9 | Hệ thống | Strategy INSERT bản ghi vào bảng award tương ứng (`DanhHieuHangNam`, `KhenThuongHCBVTQ`, ...) và set flag `nhan_bkbqp / cstdtq / bkttcp` |
| 1.10 | Hệ thống | Strategy INSERT `FileQuyetDinh` nếu có PDF mới |
| 1.11 | Hệ thống | Cập nhật `BangDeXuat` status = APPROVED, `nguoi_duyet_id`, `ngay_duyet`, commit transaction |
| 1.12 | Hệ thống | Recalc `HoSoHangNam` / `HoSoNienHan` / `HoSoCongHien` cho các quân nhân bị ảnh hưởng |
| 1.13 | Hệ thống | Ghi `SystemLog` action APPROVE |
| 1.14 | Hệ thống | Controller gọi `notifyManagerOnProposalApproval` + (nếu có) `notifyUsersOnAwardApproved` qua Socket.IO |
| 1.15 | Hệ thống | Trả 200 với message thành công |
| 2 | Phòng Chính trị | Từ chối đề xuất (luồng song song) |
| 2.1 | Phòng Chính trị | Chọn "Từ chối", nhập lý do |
| 2.2 | Hệ thống | Cập nhật `status = REJECTED`, `rejection_reason`, ghi log, gọi `notifyManagerOnProposalRejection` |

| **Luồng sự kiện thay thế** | |
|---|---|

| STT | Thực hiện | Hành động |
|---|---|---|
| 1.5a | Hệ thống | Validation fail (đề xuất đã duyệt / số quyết định trùng) → 400 |
| 1.6a | Hệ thống | Strategy validate fail (eligibility lệch sau khi sửa data) → 400 |
| 1.8a | Hệ thống | Transaction fail giữa chừng → rollback toàn bộ, trả 500 |

| **Hậu điều kiện** | Bản ghi award được lưu vĩnh viễn. `BangDeXuat.status` chuyển sang APPROVED hoặc REJECTED. Hồ sơ quân nhân được cập nhật. MANAGER và USER liên quan nhận thông báo realtime |

---

## Bảng 2.5 — Đặc tả use case **Tính lại điều kiện chuỗi (Recalc Eligibility)** (UC-05)

| Tên ca sử dụng: Tính lại điều kiện chuỗi | ID: UC-05 |
|---|---|
| **Tác nhân hệ thống** | Hệ thống (auto sau khi duyệt đề xuất / import / sửa danh hiệu); Chỉ huy đơn vị có thể trigger thủ công |
| **Tiền điều kiện** | Quân nhân đã có ít nhất 1 bản ghi `DanhHieuHangNam` |
| **Luồng sự kiện chính** | |

| STT | Thực hiện | Hành động |
|---|---|---|
| 1 | Hệ thống | Gọi `recalculateAnnualProfile(quanNhanId)` từ profile/annual.ts |
| 1.1 | Hệ thống | Lấy toàn bộ `DanhHieuHangNam` của quân nhân (theo năm tăng dần) |
| 1.2 | Hệ thống | Lấy toàn bộ `ThanhTichKhoaHoc` của quân nhân |
| 1.3 | Hệ thống | Tính `lastFlagYearInChain(records, BKBQP/CSTDTQ/BKTTCP)` |
| 1.4 | Hệ thống | Loop từng năm trong chuỗi: `computeChainContext(records, year)` |
| 1.5 | Hệ thống | `computeEligibilityFlags(personnel, ctx, awards, nckh)` — gọi `checkChainEligibility` cho từng cấp BKBQP, CSTDTQ, BKTTCP |
| 1.6 | Hệ thống | Nếu đã có `nhan_bkttcp` → áp dụng lifetime block (clear flags + set goi_y "chưa hỗ trợ cao hơn") |
| 1.7 | Hệ thống | Sinh `goi_y` văn bản dựa trên context |
| 1.8 | Hệ thống | UPSERT `HoSoHangNam` với 3 cờ `du_dieu_kien_*` + `goi_y` |

| **Luồng sự kiện thay thế** | |
|---|---|

| STT | Thực hiện | Hành động |
|---|---|---|
| 1.1a | Hệ thống | Quân nhân không có danh hiệu → Skip recalc, lưu hồ sơ rỗng |
| 1.5a | Hệ thống | Streak chưa đủ cycleYears (2/3/7) → Set cờ `du_dieu_kien_*` = false |

| **Hậu điều kiện** | Bảng `HoSoHangNam` của quân nhân được cập nhật với 3 cờ điều kiện và `goi_y` mới nhất, dùng làm input cho UC-03 (tạo đề xuất) |

---

## Bảng 2.6 — Đặc tả use case **Import Excel danh sách khen thưởng** (UC-06)

| Tên ca sử dụng: Import Excel khen thưởng | ID: UC-06 |
|---|---|
| **Tác nhân hệ thống** | Phòng Chính trị |
| **Tiền điều kiện** | Đã có template Excel chuẩn (download từ /api/[loai]/template) và đã điền dữ liệu |
| **Luồng sự kiện chính** | |

| STT | Thực hiện | Hành động |
|---|---|---|
| 1 | Phòng Chính trị | Truy cập trang import của 1 trong các loại: HCCSVV, HCBVTQ, HCQKQT, KNC, NCKH, Khen thưởng đột xuất |
| 1.1 | Phòng Chính trị | Chọn file Excel và bấm "Preview" |
| 1.2 | Hệ thống | POST `/api/[loai]/import/preview` với multer parse file |
| 1.3 | Hệ thống | `loadWorkbook()` + `getAndValidateWorksheet()` |
| 1.4 | Hệ thống | Parse từng dòng thành object, validate Joi |
| 1.5 | Hệ thống | `quanNhanRepository.findManyByCccd(cccdList)` để link với quân nhân |
| 1.6 | Hệ thống | Kiểm tra điều kiện theo loại (`checkChainEligibility` / `checkServiceYears` / `checkContributionMonths`) |
| 1.7 | Hệ thống | Trả về bảng preview với dòng OK + dòng lỗi kèm reason |
| 2 | Phòng Chính trị | Xem preview, bấm "Xác nhận import" |
| 2.1 | Hệ thống | POST `/api/[loai]/import/confirm` với danh sách dòng OK |
| 2.2 | Hệ thống | Mở `prisma.$transaction`, bulk INSERT vào bảng award |
| 2.3 | Hệ thống | INSERT `FileQuyetDinh` cho các số quyết định mới |
| 2.4 | Hệ thống | Commit, trigger recalc các hồ sơ liên quan |
| 2.5 | Hệ thống | Ghi SystemLog action IMPORT, trả report số dòng thành công/thất bại |

| **Luồng sự kiện thay thế** | |
|---|---|

| STT | Thực hiện | Hành động |
|---|---|---|
| 1.3a | Hệ thống | File không đúng format (thiếu cột, sai header) → Trả 400 với message cụ thể |
| 1.5a | Hệ thống | CCCD không tìm thấy quân nhân → Đánh dấu dòng lỗi, vẫn cho ADMIN xem preview |
| 2.2a | Hệ thống | Transaction fail giữa chừng → Rollback toàn bộ, không insert dòng nào |

| **Hậu điều kiện** | Các bản ghi award được thêm vào DB. Hồ sơ quân nhân được recalc tự động |

---

## Bảng 2.7 — Đặc tả use case **Quản lý đơn vị (CQDV / DVTT)** (UC-07)

| Tên ca sử dụng: Quản lý đơn vị | ID: UC-07 |
|---|---|
| **Tác nhân hệ thống** | Quản trị viên, Phòng Chính trị |
| **Tiền điều kiện** | Đã đăng nhập với role có quyền |
| **Luồng sự kiện chính** | |

| STT | Thực hiện | Hành động |
|---|---|---|
| 1 | Phòng Chính trị | Thêm cơ quan đơn vị (CQDV) cấp trên |
| 1.1 | Phòng Chính trị | Chọn "Thêm CQDV", nhập `ma_don_vi`, `ten_don_vi` |
| 1.2 | Hệ thống | Validate `ma_don_vi` unique, lưu vào bảng `CoQuanDonVi` |
| 2 | Phòng Chính trị | Thêm đơn vị trực thuộc (DVTT) thuộc 1 CQDV |
| 2.1 | Phòng Chính trị | Chọn CQDV cha, nhập thông tin DVTT |
| 2.2 | Hệ thống | Lưu vào `DonViTrucThuoc` với FK `co_quan_don_vi_id` |
| 3 | Phòng Chính trị | Quản lý chức vụ (`ChucVu`) trong CQDV/DVTT |
| 3.1 | Phòng Chính trị | Thêm chức vụ với `ten_chuc_vu`, `is_manager`, `he_so_chuc_vu` |
| 3.2 | Hệ thống | Lưu, cập nhật unique constraint theo `(co_quan_don_vi_id, ten_chuc_vu)` hoặc `(don_vi_truc_thuoc_id, ten_chuc_vu)` |
| 4 | Phòng Chính trị | Xem cây đơn vị + đếm số quân nhân |
| 4.1 | Hệ thống | Trả về cấu trúc cây với `so_luong` đã được auto-update khi thêm/sửa/xóa quân nhân |

| **Luồng sự kiện thay thế** | |
|---|---|

| STT | Thực hiện | Hành động |
|---|---|---|
| 1.2a | Hệ thống | `ma_don_vi` đã tồn tại → 400 "Mã đơn vị đã tồn tại" |
| 2.1a | Hệ thống | CQDV cha không tồn tại → 404 |
| Xóa CQDV | Hệ thống | Cascade delete tất cả DVTT, ChucVu, QuanNhan thuộc CQDV (xem schema `onDelete: Cascade`) |

| **Hậu điều kiện** | Cấu trúc cây đơn vị được cập nhật. `so_luong` chính xác. Các quân nhân và chức vụ được liên kết đúng |

---

## Bảng 2.8 — Đặc tả use case **Sao lưu dữ liệu** (UC-08)

| Tên ca sử dụng: Sao lưu dữ liệu | ID: UC-08 |
|---|---|
| **Tác nhân hệ thống** | Quản trị viên (thao tác thủ công), Cron task (auto theo lịch) |
| **Tiền điều kiện** | Backup feature đã được bật trong `SystemSetting (cron_enabled = true)` |
| **Luồng sự kiện chính** | |

| STT | Thực hiện | Hành động |
|---|---|---|
| 1 | Hệ thống (Cron) | Khởi chạy theo `cron_schedule` (mặc định '0 1 1 * *' — 1:00 AM ngày 1 mỗi tháng) |
| 1.1 | Hệ thống | `backup.service.ts.createBackup({ type: 'scheduled' })` |
| 1.2 | Hệ thống | Đọc 21 bảng dữ liệu qua `Promise.all` các repository |
| 1.3 | Hệ thống | Build chuỗi SQL `INSERT INTO ... VALUES (...)` cho từng row, escape JSON / string qua helper `quoteValue()` |
| 1.4 | Hệ thống | `fs.writeFileSync(filePath, sqlLines.join('\n'))` vào thư mục `backups/` |
| 1.5 | Hệ thống | Cập nhật `SystemSetting.backup_last_run = now ISO` |
| 1.6 | Hệ thống | Ghi `SystemLog` resource = 'backup' (chỉ SUPER_ADMIN xem được) |
| 1.7 | Hệ thống | Xóa file backup cũ hơn `backup_retention_days` (mặc định 15) |
| 2 | Quản trị viên | Tải file backup |
| 2.1 | Quản trị viên | GET `/api/backups` — xem danh sách file |
| 2.2 | Quản trị viên | Click tải file → GET `/api/backups/:filename` |
| 2.3 | Hệ thống | Trả file `.sql` qua `res.download()` |

| **Luồng sự kiện thay thế** | |
|---|---|

| STT | Thực hiện | Hành động |
|---|---|---|
| 1a | Hệ thống | `cron_enabled = false` → Skip silently |
| 1.4a | Hệ thống | I/O fail → Ghi log `BACKUP_FAILED`, không trigger thông báo cho ADMIN khác (chỉ SUPER_ADMIN xem được) |

| **Hậu điều kiện** | File `.sql` mới được lưu trong `backups/`. Có thể restore thủ công bằng cách import file SQL vào PostgreSQL |

---

## Bảng 2.9 — Đặc tả use case **Quản lý tài khoản** (UC-09)

| Tên ca sử dụng: Quản lý tài khoản | ID: UC-09 |
|---|---|
| **Tác nhân hệ thống** | Quản trị viên (SUPER_ADMIN), Phòng Chính trị (ADMIN) |
| **Tiền điều kiện** | Đã đăng nhập với vai trò SUPER_ADMIN hoặc ADMIN (route `/api/accounts` dùng `requireAdmin`) |
| **Luồng sự kiện chính** | |

| STT | Thực hiện | Hành động |
|---|---|---|
| 1 | Quản trị viên / Phòng Chính trị | Tạo tài khoản mới |
| 1.1 | Quản trị viên / Phòng Chính trị | Chọn quân nhân cần cấp tài khoản, nhập username + role |
| 1.2 | Hệ thống | Sinh password mặc định, hash bằng bcrypt, lưu `TaiKhoan` với FK `quan_nhan_id` |
| 1.3 | Hệ thống | Trả password gốc 1 lần để người tạo gửi cho người dùng |
| 2 | Quản trị viên / Phòng Chính trị | Cập nhật role / khóa tài khoản |
| 2.1 | Quản trị viên / Phòng Chính trị | Sửa role hoặc bật/tắt active |
| 2.2 | Hệ thống | UPDATE `TaiKhoan`, ghi log |
| 3 | Quản trị viên / Phòng Chính trị | Reset password |
| 3.1 | Quản trị viên / Phòng Chính trị | Chọn "Reset mật khẩu" |
| 3.2 | Hệ thống | Sinh password mới, hash, lưu DB, trả lại 1 lần |
| 4 | Quản trị viên / Phòng Chính trị | Xóa tài khoản |
| 4.1 | Quản trị viên / Phòng Chính trị | Xác nhận xóa |
| 4.2 | Hệ thống | DELETE `TaiKhoan` (cascade các log liên quan giữ lại với SetNull) |

| **Luồng sự kiện thay thế** | |
|---|---|

| STT | Thực hiện | Hành động |
|---|---|---|
| 1.2a | Hệ thống | Username đã tồn tại → 400 "Username đã được sử dụng" |
| 1.2b | Hệ thống | Quân nhân đã có tài khoản (1-1 constraint) → 400 |

| **Hậu điều kiện** | Tài khoản được tạo/cập nhật/xóa trong DB. Người dùng có thể dùng tài khoản mới để đăng nhập |

---

## Bảng 2.10 — Đặc tả use case **Xem nhật ký hệ thống** (UC-10)

| Tên ca sử dụng: Xem nhật ký hệ thống | ID: UC-10 |
|---|---|
| **Tác nhân hệ thống** | Quản trị viên (SUPER_ADMIN), Phòng Chính trị (ADMIN), Chỉ huy đơn vị (MANAGER) |
| **Tiền điều kiện** | Đã đăng nhập với vai trò SUPER_ADMIN, ADMIN hoặc MANAGER (route `/api/system-logs` dùng `requireManager`). Log có `resource = 'backup'` chỉ SUPER_ADMIN xem được — ADMIN và MANAGER bị filter trong `systemLogs.service.ts` |
| **Luồng sự kiện chính** | |

| STT | Thực hiện | Hành động |
|---|---|---|
| 1 | Quản trị viên / Phòng Chính trị / Chỉ huy đơn vị | Truy cập trang "Nhật ký hệ thống" |
| 1.1 | Hệ thống | Hiển thị bảng log với cột: thời gian, người thực hiện, role, action, resource, mô tả |
| 1.2 | Quản trị viên / Phòng Chính trị / Chỉ huy đơn vị | Áp dụng bộ lọc (resource, action, người thực hiện, khoảng thời gian) |
| 1.3 | Hệ thống | `systemLogsService.getLogs(userRole, filters)` — **filter resource = 'backup' nếu role != SUPER_ADMIN**; MANAGER còn bị giới hạn theo phạm vi đơn vị qua `getManagerAccountIds` |
| 1.4 | Hệ thống | Trả về danh sách log (paginated) |
| 1.5 | Quản trị viên / Phòng Chính trị / Chỉ huy đơn vị | Click vào 1 log để xem chi tiết payload (before/after JSON) |
| 1.6 | Hệ thống | Hiển thị modal với JSON payload |

| **Luồng sự kiện thay thế** | |
|---|---|

| STT | Thực hiện | Hành động |
|---|---|---|
| 1.3a | Hệ thống | ADMIN hoặc MANAGER cố xem log resource = 'backup' → tự động bị filter trong service, không thấy bản ghi nào |
| 1.3b | Hệ thống | MANAGER chỉ thấy log do tài khoản trong phạm vi đơn vị mình quản lý thực hiện |

| **Hậu điều kiện** | Người dùng nắm được lịch sử hành động trong hệ thống, phục vụ công tác kiểm tra, truy vết |

---

## Tổng kết

| ID | Use case | Actor | Đặc điểm |
|---|---|---|---|
| UC-01 | Đăng nhập | 4 role | JWT + bcrypt |
| UC-02 | Quản lý quân nhân | SUPER_ADMIN, ADMIN, MANAGER (cập nhật) | Auto init 3 hồ sơ + recalc so_luong |
| UC-03 | Tạo đề xuất hằng năm | MANAGER, ADMIN | Strategy + chain eligibility |
| UC-04 | Phê duyệt đề xuất | ADMIN | Transaction + recalc + 2 notification |
| UC-05 | Recalc eligibility | System (auto) | Chain rule + lifetime block |
| UC-06 | Import Excel khen thưởng | ADMIN | Preview + Confirm 2 bước |
| UC-07 | Quản lý đơn vị | SUPER_ADMIN, ADMIN | Cây CQDV → DVTT |
| UC-08 | Backup | SUPER_ADMIN, Cron | Custom JSON-to-SQL, monthly default |
| UC-09 | Quản lý tài khoản | SUPER_ADMIN, ADMIN | Bcrypt hash, 1-1 với quân nhân |
| UC-10 | Xem nhật ký | SUPER_ADMIN, ADMIN, MANAGER | Filter `resource = 'backup'` cho non-SUPER_ADMIN |

→ Báo cáo mẫu HRM có 5 bảng đặc tả. PM QLKT có **10 bảng** — đủ cho mục 2.3 báo cáo, mỗi bảng đối chiếu trực tiếp với code.

> **Lưu ý format**: Khi đưa vào báo cáo Word/LaTeX, chuyển mỗi bảng Markdown trên thành **bảng UML chuẩn 2 cột** (như báo cáo mẫu) với border đầy đủ. Các bảng phụ "Luồng sự kiện chính" và "Luồng sự kiện thay thế" có thể merge vào bảng chính bằng cách dùng cell rowspan.
