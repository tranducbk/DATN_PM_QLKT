# Báo cáo Audit Code — PM QLKT

> Sinh bởi multi-agent audit (13 zone review + verify đối kháng + 5 pass kiến trúc). Ngày 2026-06-20. Baseline: BE + FE typecheck pass clean (exit 0).

## 1. Tóm tắt điều hành

Codebase PM QLKT ở trạng thái **đã sạch và kỷ luật tốt** ở tầng nền tảng. Cụ thể, các bằng chứng tích cực xuyên suốt 13 zone:

- **TypeScript typecheck pass clean** (cả FE-lib và toàn dự án).
- **BE controllers**: 0 prisma import (AP-1 sạch), 0 `as any`/`as never`, mọi `req.body/query/params` đều cast sang named interface ở đầu file, gần như toàn bộ response đi qua `ResponseHelper`.
- **BE error handling**: 248 typed throw qua `AppError/NotFoundError/ForbiddenError/ValidationError` so với chỉ 2 throw ad-hoc.
- **FE**: 0 `as any`, không gọi `fetch` trực tiếp, không default export cho component, dùng `Promise.all` cho các fetch song song.
- **Hai abstraction trưởng thành đã có sẵn**: `ProposalStrategy` registry (cho 7 loại đề xuất) và `chainEligibility.checkChainEligibility` (rule core dùng chung cho cả recalc và API validation, không thể drift).
- **Một số pattern config-driven mẫu mực đã tồn tại**: `ImportReviewPageContent`, `SystemLogsPageContent` (wrapper 7 dòng theo role), `AWARD_TYPE_REGISTRY`, `VISIBLE_ROLES` matrix.

Vấn đề còn lại chủ yếu là **trùng lặp do thiếu tổng quát hóa** và **abstraction tốt nhưng dùng nửa vời**, chứ không phải lỗi nghiêm trọng. 8 vấn đề ưu tiên cao nhất:

| # | Vấn đề | Khu vực | Mức độ |
|---|--------|---------|--------|
| 1 | 4 medal domain (tenure/contribution/commemorative/military-flag) sao chép gần nguyên văn route+controller+service+repository, không có base chung | BE | high |
| 2 | Không có permission matrix; authorization rải rác 115 chỗ `userRole === ROLES.X` ở BE, 67 ở FE | BE+FE | high |
| 3 | God-files vượt ngưỡng bắt buộc tách: review/[id]/page.tsx 1343 LOC, manager [id] 1154, CreateAdhocAwardModal 1087, awardBulk orchestrator | FE+BE | high |
| 4 | `Number(he_so_chuc_vu) \| 0` âm thầm loại dòng khỏi tính tháng cống hiến → sai eligibility | BE | high |
| 5 | AP-9: leak personnel CUID + raw error.message vào message hiển thị cho user (8+ site trong awardBulk) | BE | high |
| 6 | Step2/Step3 bulk component trùng lặp khổng lồ (~8200 LOC, 7 variant), abstraction đã có nhưng dùng nửa vời | FE | high |
| 7 | apiClient god-object 146 method đăng ký tay → 21 method chết tích tụ; ProposalStrategy 2/4 method chết | FE+BE | medium-high |
| 8 | admin/super-admin/manager page tree sao chép nguyên cây; thêm role = copy-paste hàng chục file | FE | high |

Tóm lại: **nền tảng sạch, kỷ luật convention mạnh, nhưng chi phí mở rộng (thêm loại khen thưởng / thêm role / thêm import) cao do trùng lặp file-cluster**. Đây là focus chính của báo cáo.

---

## 2. Code chết (Dead code) — đã verify

Tất cả các mục dưới đây có `isDead: true`, đã được verify đối kháng (boundary grep, kiểm tra alias/destructuring, kiểm tra test reference). Số false-positive bị bác bỏ: **BE controllers 1, BE-award-services 2, BE-proposal 1, BE-core-services 3, BE-infra 1, FE-app-admin 1, FE-lib 1** — cho thấy quá trình verify nghiêm túc, không gắn cờ bừa.

### 2.1 Backend — file/symbol chết

| File | Symbol | Loại | Lý do verify |
|------|--------|------|--------------|
| `unitAnnualAward.controller.ts:137` | `nguoi_tao_id: user?.id \| body.nguoi_tao_id` | dead-validation | FE không gửi `nguoi_tao_id` (0 hit), Zod strip unknown keys, `verifyToken` đảm bảo `user` luôn có |
| `annualReward/contribution/scientific/unitAnnual.controller.ts` | confirmImport empty-items guard (4 chỗ) | dead-validation | Zod schema `items.min(1)` chặn ở middleware trước khi tới controller; không test nào assert |
| `unitAnnualAward/crud.ts` | `defaultDeps.checkUnitAwardEligibility` stub + field interface | no-op-stub | Không invoke ở đâu; service method gọi thẳng `eligibility.*` |
| `scientificAchievement/import.ts:278` | `confirmImport(adminId)` param | unused-variable | Body không đọc adminId |
| `contributionMedal.service.ts:72` | `confirmImport(adminId)` param | unused-variable | Nhận rồi drop, không forward |
| `militaryFlag/import.ts:255` | nhánh `existingAward ? [{...}]` populate history | dead-validation | Guard ở trên đã `continue` khi existingAward → nhánh không reachable |
| `personnel.service.ts:42` | `PersonnelService.parseCCCD` | no-op-stub | 0 caller (wrapper khác trong proposal/ mới là cái dùng) |
| `unit.service.ts:215` | `UnitService.isDescendant` | unused-export | 1 hit duy nhất là định nghĩa |
| `repositories/*` (21 file) | **41 method chết** (createMany, findById, bare findUnique/findFirst/findMany, findUniqueRaw...) | unused-export | Per-method boundary grep = 0, đều bị thay bởi `*Raw` generic |
| `notification/helpers.ts:72` | `sendSystemNotification` | unused-export | Re-export qua barrel nhưng 0 call site |
| `auditLog/index.ts:29` | `createLogDescription` | unused-export | Chỉ dùng nội bộ bởi `getLogDescription` |
| `excelHelper.ts` | `removeVietnameseAccents`, `normalizeHeaderKey` | unused-export | Chỉ dùng nội bộ file |
| `fileResponseHeaders.ts:9` | `contentTypeFromFilename` | unused-export | Chỉ dùng nội bộ |
| `serviceYearsHelper.ts:25` | `calculateCoveredMonthsByMonth` | unused-export | Chỉ dùng nội bộ |
| `excelTemplateHelper.ts:133` | `THIN_BORDER_ALL_SIDES` | unused-export | Chỉ dùng nội bộ |
| `middlewares/auth.ts:66` | `requireAuth = verifyToken` | unused-export | Alias 0 consumer |
| `configs/index.ts:10` | `DATABASE_URL` re-export | unused-export | 0 importer |
| `notificationTypes/Messages.constants.ts` | `ACHIEVEMENT_APPROVED`, `PERSONNEL_ADDED` (type + title, 4 symbol) | unused-export | Không createNotification nào dùng |
| `danhHieu.constants.ts` | `UNKNOWN_LABEL`, `DANH_HIEU_SHORT_MAP` (export keyword) | unused-export | FE import từ bản FE riêng, BE export 0 external importer |
| `proposalTypes.constants.ts:16` | `PROPOSAL_TYPES_REQUIRING_MONTH` (export) | unused-export | Test hit chỉ là comment |
| `proposalStrategy.ts` | `validateApprove` + `buildSuccessMessage` (interface + 7 impl mỗi cái) | no-op-stub | 0 call site `.validateApprove(`/`.buildSuccessMessage(`; 6/7 là `return []` |
| `proposalStrategy.ts` | `ProposalSubmitContext.userId/donViId/isCoQuanDonVi`; `ProposalApproveContext.proposalId/refDate/proposal` | unused-variable / legacy-compat | Strategy chỉ đọc `nam/thang/mappings/adminId/...`; các field này không bao giờ đọc |
| `hcbvtqStrategy.ts:309-316` | validation thứ tự `thang_quyet_dinh` | dead-validation (AP-10) | FE không bao giờ gửi `thang_quyet_dinh` (0 hit) → điều kiện không bao giờ fire |

### 2.2 Frontend — file/symbol chết

| File | Symbol | Loại | Lý do verify |
|------|--------|------|--------------|
| `hooks/useFetch.ts` (toàn file, 148 LOC) | `useFetch` + `useMutation` | unused-file | 0 importer ngoài chính file; 66 file vẫn tự hand-roll fetch |
| `components/categories/UnitTree.tsx` | `UnitTree` (toàn file) | unused-file | 2 hit đều trong file; `UnitList` mới là cái dùng |
| `components/accounts/AccountsTable.tsx` | `AccountsTable` (toàn file) + menu item 'reset' no-op | unused-file | Page accounts render table inline riêng |
| `(auth)/change-password/page.tsx` | `ChangePasswordPage` (`<div>ChangePasswordPage</div>`) | no-op-stub | Route group không reachable; real impl ở 4 thư mục role |
| `proposals/page.tsx:95,382` | `setExtraordinaryRewardModalVisible` + nút "Thêm đột xuất" | no-op-stub | State value bị discard, không ai đọc |
| `manager/units/page.tsx:73` | `selectedUnitId` + Card "Chi tiết đơn vị" | unreachable-branch | Không có setter → luôn null → Card không render |
| `manager/personnel/[id]/edit:125` | `managerUnitId` (write-only) | dead-validation | Setter chỉ ghi, value không đọc |
| `user/profile/page.tsx:71` | `personnelId` (write-only) | unused-variable | Dùng `user.quan_nhan_id` trực tiếp |
| `manager/awards/page.tsx:350-364` | nhánh render HCQKQT/HCCSVV/KNC/HCBVTQ của cột 'Loại khen thưởng' | unreachable-branch | Cột bị filter khỏi mọi tab ≠ NCKH → chỉ NCKH branch chạy |
| `manager/dashboard/page.tsx:176-178` | else branch rỗng (chỉ comment) | no-op-stub | Không có statement |
| `Step3SetTitlesNienHan.tsx:79` | `serviceProfilesMap` state | unused-variable | Đọc local var, không đọc state |
| `Step2SelectPersonnel.tsx` (base, 301 LOC) | toàn file | unused-file | 3 page đều import per-type variant |
| `Step2SelectPersonnelCaNhanHangNam.tsx:31` | prop `titleData` | dead-validation | Parent truyền nhưng component không destructure/đọc |
| `PersonnelForm.tsx:188` | `disabled={false}` | no-op-stub | Là default của AntD Button |
| `lib/api/index.ts` | 11 named re-export (authApi…systemLogsApi) + `export default apiClient` | unused-export | 0 importer named module; consumer dùng `{ apiClient }` |
| `lib/http/apiClient.ts:4` | `export default apiClient` | unused-export | 90 importer đều dùng named |
| `lib/api/awards.ts` + index | `getAwards`, 4× `get*Statistics`, `createTenureMedalDirect`, `create/updateScientificAchievement` | unused-export | 0 caller ngoài lib/api |
| `lib/api/annualAwards.ts` | `createAnnualReward`, `updateAnnualReward` | unused-export | Annual tạo qua bulk; singular 0 caller |
| `lib/api/*` | `getUnitAnnualAwardsByUnit`, `getAdhocAwardById`, `getAdhocAwardsByUnit`, `deleteNotification`, `recalculateProfile`, `getAllServiceProfiles`, `updateServiceProfile`, `getDecisionById`, `getDecisionFilePaths`, `getSystemLogResources`, `deleteAllSystemLogs` | unused-export | 0 caller (tổng ~21 method apiClient chết) |
| `lib/api/*`, `lib/types/proposal.ts`, `antdTheme.ts` | `DecisionsPagination`, `PositionHistoryWarning`, `CreateAccountBody`, `DecisionData`, `DecisionRef`, `ANTD_FONT_FAMILY` (export keyword) | unused-export | Chỉ dùng nội bộ, export thừa |
| `constants/awardSlugs.constants.ts:6` | `AWARD_SLUGS` | unused-export | 0 importer |
| `constants/awardIcons.constants.ts:36` | `getAwardIcon` | unused-export | Consumer dùng `AWARD_ICONS` trực tiếp |
| `constants/proposal.constants.ts:20` | `PROPOSAL_STATUS_COLORS` | unused-export | Dùng `PROPOSAL_STATUS_UI/ADMIN` |
| `hooks/useDebounce.ts:4`, `roles.constants.ts` | `SEARCH_DEBOUNCE_MS`, `Role` (export keyword) | unused-export | Chỉ dùng nội bộ |
| `SystemLogsPageContent.tsx` | `RawLogEntry.Actor`; nhánh `.items`/`.results` | unused-variable / dead-validation | BE trả `NguoiThucHien` + `data` array, không bao giờ trả Actor/items/results |

**Tổng kết dead code**: BE có 1 cụm lớn (41 repository method) cộng ~25 symbol lẻ; FE có 5 file chết hẳn cộng ~30 export/symbol. Phần lớn là **boilerplate sinh dư** (repository CRUD, apiClient registration, named re-export). Đây là tín hiệu cấu trúc, không phải logic mục nát — xử lý gốc bằng factory (mục 5) sẽ ngăn tích tụ tiếp.

---

## 3. Độ sạch & nơi cần cải thiện

### 3.1 Comment tiếng Việt / mixed (English-only rule) — severity medium

Đây là vi phạm cơ học, nhiều nhất ở shared infra:

| File:line | Nội dung |
|-----------|----------|
| `profile/annual.ts:130-132,150-152` | JSDoc tiếng Việt stack chồng lên JSDoc tiếng Anh (duplicate) — severity **high** |
| `profile.service.ts:90-102` | JSDoc wrapper tiếng Việt |
| `apiError.ts:21-36`, `utils.ts:153-156`, `types/common.ts:18,27` | JSDoc/comment tiếng Việt |
| `AuthContext.tsx:28,38,155`, `useAuthGuard.ts:8-26`, `useFetch.ts` | JSDoc tiếng Việt |
| `danhHieu/devZone/militaryRanks.constants.ts` | nhiều JSDoc tiếng Việt |
| `system-logs/constants.ts:1,23`, `MainLayout.tsx:58-105` | JSDoc tiếng Việt |
| `rateLimiter.ts:49` | comment mixed VN/EN |
| `manager/dashboard:240`, `Step3SetTitlesDonViHangNam.tsx:24-52` | comment/JSDoc tiếng Việt |
| FE interfaces JSDoc tiếng Việt: `awards/page.tsx:50,76`, `annual-rewards/bulk/page.tsx:37,44`, `manager/units:49`, `super-admin/accounts:39` | |

**Cách sửa**: dịch sang tiếng Anh hoặc xóa nếu tên đã tự giải thích. Ưu tiên file shared infra trước (AuthContext, profile services).

### 3.2 WHAT-comment (restate code) — severity low

Rải rác nhiều, ví dụ tiêu biểu:
- `annualReward/crud.ts:93,97,131` (`// Block:`, `// Allow:`)
- `scientific/import.ts:76,83`, `commemorative/import.ts:208,220`
- `personnel.service.ts` + `personnel/update.ts` (~27 comment WHAT)
- `profile/annual.ts:192-244` (`// Case 1:`...`// Case 13:` — số case không còn nghĩa)
- FE: `awards/page.tsx:420-498`, `manager/awards:248-456`, `PositionForm.tsx:58-79`, `lib/api/index.ts:14-66`

**Cách sửa**: xóa hẳn; điều kiện `if`/tên biến đã tự nói.

### 3.3 Section-divider comment (banned) — severity medium

- `manager/adhoc-awards/page.tsx` (12 heading: `// TYPES`, `// MAIN COMPONENT`, `// DATA FETCHING`...)
- `lib/api/index.ts:29-66`, `personnel.ts:65`, `units.ts:5,69` (`// Auth`, `// Units`, `// Positions`)

**Cách sửa**: xóa; nếu cần nhóm thì tách file.

### 3.4 let-vs-const & let-then-if/else (banned anti-pattern) — severity medium

| File:line | Pattern |
|-----------|---------|
| `nienHanHelpers.ts:122-148` | 6 `let` gán trong if/else-if/else |
| `PersonnelEditForm.tsx:150-161`, `manager/personnel/[id]/edit:149-160` | `let currentUnit/coQuanId/donViTrucThuocId` rồi gán if/else |
| `account.service.ts:61-67`, `profile/tenure.ts:182` | `let x = default; if(...) x =...` |
| `awards/bulk/create:550`, `manager/proposals/create:675` | `let reviewTableData = []` rồi gán if/else |
| `accounts.ts:73`, `notification/awards.ts:219-226`, `awardsBulkAdded.ts:149-156` | let-then-assign |
| `caNhanHangNamStrategy.ts:244-264`, `decisionMappings.ts:37-63` | let mutate trong closure |

**Cách sửa**: dùng `const` + ternary, hoặc extract helper trả về object đã tính.

### 3.5 Inline type declaration / req.body cast inline — severity low-medium

- `devZone.route.ts:189,270,330,396` — `req.body` destructure/cast inline, cast 2 lần liền (`as {password?}` rồi `as {password:string}`)
- `quanNhan.repository.ts:81-93` — inline anonymous object type cho findMany args
- `core.ts:340,453,528` — `const personnelMap = {}` không index signature

**Cách sửa**: khai báo named interface ở đầu file (CronScheduleBody, BackupScheduleBody...), cast 1 lần.

### 3.6 Hardcoded string (AP-6) — severity low-medium

| File:line | Vấn đề | Sửa |
|-----------|--------|-----|
| `routes/index.ts:54` | `/api/military-flags` (plural) ≠ slug `military-flag` | đồng bộ mount + slug + FE — severity **medium** |
| `adhocAward.service.ts:293` | `loai: 'KHEN_THUONG_DOT_XUAT'` | dùng constant |
| `profile.controller.ts:116,126` | `'DON_VI'` hardcode 2 lần | dùng constant |
| `chainAwardSqd.ts:10-17` | label `'BKBQP'/'CSTDTQ'/'BKTTCP'` | dùng `DANH_HIEU_*` constants |
| `serviceYearsEligibility.ts:11-17` | literal union + label map tự khai | dùng `PROPOSAL_TYPES` + `getDanhHieuName` |
| `hcqkqtStrategy.ts:51-56` | label award hardcode tiếng Việt | dùng `getDanhHieuName` |
| `annual-rewards/bulk/page.tsx:325-339` | option danh hiệu hardcode | build từ `DANH_HIEU_MAP` |
| `Step3SetTitlesCaNhanHangNam.tsx:225-231` | label danh hiệu inline (đã drift 1 từ với constant) | `getDanhHieuName` |
| FE gender `'NAM'/'NU'`: `PersonnelEditForm:356`, `manager/personnel/edit:400` | | dùng `GENDER.MALE/FEMALE` |
| FE doi_tuong `'CA_NHAN'/'TAP_THE'`: adhoc modals, `adhoc-awards/page` | | constant `ADHOC_TARGET` |
| `super-admin/accounts/[id]:90` | default password `'Hvkhqs@123'` hardcode trong JSX | constant shared — severity **medium** |
| `devZone.route.ts:115,353,355` | `'devzone'`/`'manual'`/`'scheduled'` | `BACKUP_TRIGGER`/`BACKUP_TYPE` constant |

### 3.7 any-cast — severity medium

| File | Vấn đề |
|------|--------|
| `militaryFlag/types.ts:4`, `scientific/types.ts:4` | `nam: number \| unknown` (collapse thành unknown) |
| `unitAnnualAward/crud.ts`, `excel.ts`, `.service.ts` | pervasive `Record<string,any>`, param implicit any |
| `awardBulk/handlers.ts:468,485` | `thang as number`, per-field Prisma JSON cast |
| `profile/tenure.ts:314`, `scripts/fixChainAwardDecisions.ts:28,62` | `Record<string,any>` |
| FE `ApproveModal.tsx`, `super-admin/add-awards`, `annual-rewards/bulk/details` | titleData/decision/columns `any` (severity **high** ở add-awards) |
| FE `EditableCell.tsx:8`, `UnitForm/PositionForm/UnitsTable`, `categories/units/[id]` | prop/form/column `any` |
| FE `lib/types/common.ts:9` | `ApiResponse<T = any>` → nên `unknown` |
| FE `Step3*`, `PositionHistoryView`, `ImportReviewPageContent`, `PersonnelRewardHistoryModal` | `any[]`, `[key:string]:any`, `ColumnsType<any>` |

**Cách sửa**: dùng interface trong `types/proposal.ts`; cast Prisma JSON 1 lần ở boundary qua `Prisma.XxxUpdateInput`; `ApiResponse<T = unknown>`.

### 3.8 Duplicate logic (DRY) — severity medium-high

Đây là nhóm lớn nhất, các cụm tiêu biểu (chi tiết kiến trúc ở mục 5):

| Cụm | File | Severity |
|-----|------|----------|
| 5 single-medal import file chia sẻ ~150 dòng preview loop copy 5× | `tenureMedal/import.ts` (577) + 4 medal khác | **high** |
| 4 medal controller ~90% giống nhau | tenure/contribution/commemorative/militaryFlag controllers | **high** |
| recalc-then-log try/catch lặp 7× | positionHistory/annualReward/scientificAchievement controllers | medium |
| notifyOnImport+catch lặp 7× (2 style: console.error vs writeSystemLog) | 7 controllers | **high** |
| `convertThoiGian` duplicate verbatim (1 dùng `\|` 1 dùng `??`) | contribution + commemorative service | medium |
| `getTotalMonths`/`getMonths` duplicate trong 1 file + overlap `aggregatePositionMonthsByGroup` | `contributionMedal/import.ts` | medium |
| approve-time validation re-implement rule đã có trong strategy buildSubmitPayload | `approve/validation.ts` | medium |
| `calculateTotalMonths`/`getDurationDisplay`/`calculateTotalTimeByGroup` duplicate manager↔admin | proposal helpers | medium |
| Step2/Step3 Excel pipeline ~120 dòng copy 7× | bulk components | **high** |
| month-diff math hand-roll 4 nơi | `utils.ts`, `serviceTimeHelpers`, `contributionTimeHelper`, `serviceTime.ts` | medium |
| StatCard re-implement inline + hardcoded hex | `SystemLogsPageContent.tsx:209-291` | medium |
| chart options/theme/palette duplicate | `SuperAdminDashboardCharts.tsx` | medium |
| user dashboard badge ternary lặp 6× | `user/dashboard:579-830` | medium |
| RANK_ORDER khai báo 3 file | awardValidation/* | medium |

### 3.9 Silent catch / AP-9 (leak technical detail) — severity high (AP-9), medium (silent)

| File:line | Vấn đề |
|-----------|--------|
| `awardBulk/handlers.ts:83,160,186,235,293` | leak `item.personnel_id` (CUID) + raw error.message vào user message — **high** |
| `awardBulk.service.ts:91,95` | leak personnel_id vào message — **high** |
| `profile/annual.ts:517`, `annualReward/import.ts:666` | dùng id làm fallback name — **high** |
| `decision.service.ts:185` | trả `error.message` thẳng cho user, không log — medium |
| FE `proposals/page.tsx:540` | toast leak "API endpoint chưa được tạo" cho admin |
| Nhiều `catch (error)` bind nhưng không dùng/log (FE ~123 chỗ, BE routes, audit helpers không nhất quán bare vs console.error) | low-medium |

**Cách sửa AP-9**: resolve `ho_ten` trước (đã có map), fallback `'một quân nhân'`/`'Một đơn vị'`; log CUID+error vào `console.error`/`writeSystemLog`; push message generic cho user. **Phải update test assertion** khớp message cũ.

### 3.10 Layering violation (AP-2/AP-7) — severity medium

| File | Vấn đề |
|------|--------|
| `proposal.controller.ts:67-127` submitProposal | ~60 dòng parse/validate inline (khác approveProposal đã factor tốt) |
| `account.controller.ts:91-229` create/update | 65-70 dòng authz policy + role matrix trong controller |
| `profile.controller.ts:108-148` checkEligibility | dispatch theo type + reshape inline |
| `commemorative/militaryFlag.controller.ts` getByPersonnelId | ~30 dòng manager scope authz duplicate, shadow biến `user` |
| `decision.controller.ts:202` getFilePath | raw `res.status().json` thay ResponseHelper (AP-7) |
| `proposal.controller.ts:259` getAllAwards | dùng `.success` thay `.paginated` (AP-7) |
| `devZone.route.ts:176-449` | 14+ raw `res.json` bypass ResponseHelper (AP-7) |
| `annualReward/unitAnnualAward.route.ts` | inline file-serving handler trong route (AP-2+AP-7) |

---

## 4. Fallback cần giảm (ưu tiên của người dùng)

Quy mô tổng (cho thấy phần lớn là **hợp lệ**, không nên đụng bừa):

| Pattern | BE | FE |
|---------|----|----|
| `\| []` | 49 | 100 |
| `\| 0` | 63 | 92 |
| `?? ''` | 91 | — |
| `\| ''` | 125 | 173 |
| `?? null` | 91 | — |
| `\| 'N/A'` | — | 9 |

**Fallback HỢP LỆ (giữ nguyên)**: live??snapshot trong positionHistory, pagination default qua `parsePagination`, degradation của error-message trong axiosInstance, render `'-'` cho field optional, default-disabled trong DevZoneContext.

**Fallback PHÒNG THỦ GÂY HẠI (cần sửa)** — xếp theo mức độ nguy hiểm:

| # | File:line | Vấn đề | Cách sửa đúng |
|---|-----------|--------|---------------|
| 1 | `congHienMonthsAggregator.ts:50` + `profile/contribution.ts:117` + `contributionMedal/import.ts:325,493` + `positionHistory.service.ts:197,269` | `Number(he_so_chuc_vu) \| 0` → dòng bị `continue` loại khỏi tính tháng cống hiến. Gộp "0 thật" với "missing/NaN" → **quân nhân bị xử sai eligibility, không log** | Làm `he_so_chuc_vu` non-nullable trong row type; nếu null thì `console.error` + continue/throw, KHÔNG coi là 0 |
| 2 | `unit.service.ts:215-228` isDescendant | try/catch nuốt lỗi DB → `return false` cho 1 quyết định scope/permission | Bỏ try/catch, để lỗi propagate; predicate authz không được đoán khi infra fail |
| 3 | `annual-rewards/bulk/details:154-156` | `eligibleIds = param ? JSON.parse : personnelIds` "treat all as eligible" → có thể thêm khen thưởng cho người không đủ ĐK | Nếu eligible_ids bắt buộc cho đúng → error/redirect khi thiếu, không default all |
| 4 | `LoginForm.tsx:58-71` | `accessToken = payload.accessToken \| payload.token`, `user \| {}`, `id \| ''` → "đăng nhập" với token rỗng | Validate accessToken + user.id tồn tại; thiếu → coi là login fail |
| 5 | `awardsHelper.tsx` (6×), `awards/page.tsx`, `lib/award` | `DANH_HIEU_MAP[x] \| x` leak raw code khi không khớp | dùng `getDanhHieuName(x)` |
| 6 | `notification/awards.ts:343` | fallback về raw slug (`'tenure-medals'`) trong message user (borderline AP-9) | fallback default tiếng Việt `'khen thưởng'` |
| 7 | `SystemLogsPageContent.tsx:83-94` | unwrap `res.data ?? res` rồi `\| .logs \| .items \| .results \| []` → shape regression thành table rỗng im lặng | type hóa response, đọc `res.data` trực tiếp, bỏ nhánh speculative |
| 8 | `setX(res.data \| [])` (~30 chỗ FE) trong nhánh `if(res.success)` | `\| []` dead noise + che shape regression thành "empty list" | type hóa `res.data: T[]`, bỏ `\| []`; shape lạ thì log |
| 9 | `proposal/core.ts:313-396` | enrich `ho_ten \| item.ho_ten \| ''` → tên rỗng thay vì surface orphan record | dùng placeholder documented `'một quân nhân'`/`'Một đơn vị'`, log khi cả snapshot+live đều miss |
| 10 | `reviewColumns.tsx:58-66` | suy ra unit-type từ presence của relation optional → mislabel DVTT thành CQDV | dùng discriminator field từ API (`don_vi_type`) |
| 11 | `personnel.controller.ts:143,145` | `co_quan_don_vi_id \| don_vi_id \| unit_id` multi-alias coalesce che field nào là canonical | normalize tên field FE, hoặc map 1 lần trong service |

**Nguyên tắc**: numeric `\| 0` trên giá trị "không bao giờ thiếu hợp lệ" phải phân biệt 0 với missing; `\| []` trên array đã đảm bảo hợp đồng là noise + che regression; fallback cho authz/eligibility decision phải fail loudly.

---

## 5. SOLID & Design Patterns — để code dễ phát triển

Đây là phần quan trọng nhất. Tổ chức theo **kịch bản mở rộng** (chi phí hiện tại → thiết kế lý tưởng) rồi đến SRP/OCP/DIP.

### 5.1 Kịch bản: "Thêm một loại khen thưởng mới (loại thứ 8)"

**Chi phí hiện tại (~12-14 file, ~700+ LOC copy-paste)**:

Backend phải tạo/sửa:
- `repositories/x.repository.ts` (~85 LOC boilerplate forwarding)
- `services/x.service.ts` (~290 LOC copy từ sibling medal) + `x/import.ts` + `x/types.ts`
- `controllers/x.controller.ts` (~187 LOC copy)
- `routes/x.route.ts` + đăng ký vào `routes/index.ts`
- `constants/awardSlugs`, `awardLabels`, `proposalTypes.constants.ts`
- `proposal/strategies/` + REGISTRY entry
- `awardBulk/dispatchTables.ts` (4 lookup table) + `handlers.ts` CREATE_HANDLERS + if/else trong `bulkCreateAwards`

Frontend phải tạo/sửa:
- route `import-review-<slug>/page.tsx` (~90 LOC copy)
- `AWARD_TYPE_CONFIG` trong **cả** `admin/awards/page.tsx` **và** `manager/awards/page.tsx`
- `Step2SelectPersonnel<Type>.tsx` + `Step3SetTitles<Type>.tsx` variant
- case trong switch Step2 + dispatcher Step3 ở `bulk/create/page.tsx`
- `check<Type>` trong `lib/api/awards.ts` + dòng trong `lib/api/index.ts`

**Nguyên nhân gốc**:
- 4 medal domain (tenureMedal 242, contributionMedal 291, commemorativeMedal 346, militaryFlag 289 LOC) là copy độc lập: `getUserWithUnit` byte-identical 4 file; `deleteAward` chỉ khác biến repository/slug/recalc; `getAll` filter unit có chỗ dùng shared `buildMedalListWhere`, có chỗ inline copy (đã drift `\|` vs `??`).
- 21 repository là wrapper boilerplate y hệt (findById/findManyRaw/count/create/upsertRaw/delete...), gốc của 41 method chết.
- `bulkCreateAwards` (awardBulk.service.ts:39-162) hardcode if/else per-type dù đã có CREATE_HANDLERS registry.

**Thiết kế lý tưởng**:

1. **`createMedalAwardService(config)` factory** (mirror `ProposalStrategy`): config = `{ slug, proposalType, repository, label, templateColumns, exportColumns, sheetName, hasDanhHieu, recalcProfile?, exportRowMapper, thoiGianFields }`. 4 service → 4 config object + `export default createMedalAwardService(config)`. Tương tự `createMedalController(service, config)` + `buildMedalRoutes(controller, validation)`. **deleteAward** fold vào factory (gọi `config.recalcProfile` chỉ khi defined). → gộp ~1100 LOC service + ~700 LOC controller + 4 route. **Effort L, payoff high**.
2. **`createCrudRepository(tx => tx.<model>)` factory**: mỗi repository thành 1 dòng. Bỏ ~1500 LOC forwarding, ngăn dead-method tích tụ. **Effort M, payoff medium**.
3. **`runMedalPreview(buffer, config)` driver** (helpers/excel): config = `{ sheetName, templateColumns, proposalType, dataField, repository, eligibilityCheck, buildValidItem }`. Mỗi medal chỉ cấp eligibility + columns. **Effort L, payoff high**.
4. **Bulk: extend CREATE_HANDLERS** với `validateTitleData?` + `needsPersonnelPrefetch` → `bulkCreateAwards` thành type-agnostic. **Effort M, payoff high**.

FE:
5. **`AWARD_TYPE_REGISTRY` thành single extension point**: thêm `importReviewConfig` (columns qua factory, confirmImport, messages); collapse 7 `import-review-*/page.tsx` thành 1 dynamic route `import-review/[awardType]/page.tsx`. **Effort M, payoff high**.
6. **Shared `AwardsListView`** + 1 `AWARD_TYPE_CONFIG` duy nhất, role là prop → admin/manager page thành wrapper mỏng. **Effort L, payoff high**.

**Kết quả**: thêm loại mới = 1 registry/config entry + (tùy chọn) 1 Step2/Step3 variant nếu UI eligibility thật sự khác. 0 route file mới, 0 switch edit.

> **Baseline tốt cần noi theo**: `chainEligibility.checkChainEligibility` + `personalChainEvaluator`/`unitChainEvaluator` adapter và `strategies/index.ts` REGISTRY là mẫu engine+config+registry đã chứng minh. Khi tổng quát hóa medal/bulk, bám pattern này; KHÔNG duplicate streak-counter (khác biệt domain hợp lệ).

### 5.2 Kịch bản: "Thêm một role / nhóm permission mới"

**Chi phí hiện tại (~40-50 file)**: không có permission matrix nào trong codebase. Authorization = (1) route guard hardcode array trong `auth.ts` (160 usage), (2) **115 nhánh inline `userRole === ROLES.X` ở BE** + 67 ở FE.

Thêm role thứ 5 (vd AUDITOR):
- BE: `roles.constants.ts` (ROLES, ROLE_LABELS, ROLE_RANK) → sửa/thêm guard `auth.ts` → wire ~20 route file → duyệt 115 nhánh inline ở personnel.service, unitAnnualAward/crud+excel, proposal/core, account.service, logVisibility, dashboard để quyết AUDITOR rơi vào if hay else → thêm vào VISIBLE_ROLES.
- FE: `roles.constants.ts` (ROLES, LABELS, COLORS) → `ROLE_DASHBOARD_MAP` (useAuthGuard) → if-branch + hrefs trong `navigation.tsx` → `ROUTE_KEY_MAP` rows → **copy nguyên cây `app/auditor/`** từ `app/admin/` (hàng chục file rồi drift).

**Vấn đề SOLID**:
- Permission là control-flow rải 180+ site, không phải data. Named guard couple role-membership với capability (`requireAdmin` thực ra nghĩa "manage accounts").
- Unit-scoping re-implement 8+ service dù `buildUnitWhereFilter` đã tồn tại (chỉ personnel.service dùng).
- `ROLE_RANK`/`canManageRole` chỉ dùng 1/2 chỗ applicable (account.service.ts:583 hardcode lại rank check).
- Page tree là physical duplication theo role (admin/personnel 633 vs manager 432 vs super-admin 148 LOC; accounts admin 330 vs super-admin 326 đã drift). Đối chiếu: system-logs làm ĐÚNG (wrapper 7 dòng quanh `SystemLogsPageContent`).
- Nav là 3 map hardcode song song (menu items, ROUTE_KEY_MAP, ROLE_DASHBOARD_MAP) phải giữ đồng bộ tay.

**Thiết kế lý tưởng**:

1. **Capability matrix**: `ACTIONS` const (MANAGE_ACCOUNTS, REVIEW_PROPOSAL, VIEW_ALL_PERSONNEL, SCOPED_TO_UNIT...) + `ROLE_CAPABILITIES: Record<Role, Capability[]>`. Thay named guard bằng `requireCapability(cap)`, thay inline `userRole === X` bằng `can(role, CAP)`. Thêm role = thêm 1 row. **Effort L, payoff high**.
2. **Unit scope 1 nguồn**: migrate unitAnnualAward, logVisibility, dashboard, commemorative, militaryFlag, personnel/update lên `buildUnitWhereFilter`; thêm `resolveScopeForRole(role, quanNhanId)`. **Effort L, payoff high**.
3. **Dùng `canManageRole`** thay check inline ở account.service.ts:583. **Effort S, payoff medium**.
4. **Shared role-page components** (theo pattern SystemLogsPageContent): `PersonnelListPage`, `DashboardPage`, `AccountsPage`, award-detail pages nhận `basePath`+`role` prop; mỗi `app/<role>/feature/page.tsx` thành wrapper 1 dòng. Hoặc dùng 1 segment động `[role]` guard bởi matrix. **Effort L, payoff high**.
5. **Nav config-driven**: `NAV_CONFIG` = mảng `{key, icon, label, capability}`, derive menu bằng filter theo matrix + prefix `getRoleSlug(role)`. ROUTE_KEY_MAP + dashboard-redirect derive cùng config. **Effort M, payoff high**.
6. **Role table derive**: mọi satellite map (ROLE_COLORS, ROLE_RANK, ROLE_DASHBOARD_MAP) keyed `Record<Role,...>` để TS báo thiếu entry khi thêm role. **Effort M, payoff medium**.

> **Baseline**: `VISIBLE_ROLES` (logVisibility.ts:11-15) đã chứng minh pattern matrix hoạt động — chỉ cần tổng quát hóa ra toàn hệ.

**Kết quả**: thêm role = 1 row matrix BE + 1 entry FE + (tùy chọn) 1 wrapper layout. ~3-5 file, không copy page tree.

### 5.3 Kịch bản: "Thêm import Excel / import-review mới"

**Chi phí hiện tại**: đăng ký 4 lookup table `dispatchTables.ts` + handler + CREATE_HANDLERS + sửa if/else `bulkCreateAwards` + tạo route `import-review-<slug>/page.tsx` copy ~90 LOC. Membership array (`typesNeedingPersonnelValidation`, prefetch list) dễ desync.

**Thiết kế lý tưởng**: 1 registry entry keyed ProposalType mang `{ handler, validateTitleData?, duplicateStrategy, tableQuery, needsPersonnelPrefetch, serviceYearCheck? }`; orchestrator chạy generic (lookup → validate → prefetch-if-flagged → handler). FE: import-review config vào `AWARD_TYPE_REGISTRY` + dynamic route. **Effort M, payoff high**.

> Lưu ý: `tenure-medals` re-declare local `getShortDanhHieuTag` thay vì dùng shared `getDanhHieuTag` — fold vào shared (truyền `DANH_HIEU_SHORT_MAP`).

### 5.4 SRP — God-files cần tách

| File | LOC | Cách tách (theo pattern dự án) |
|------|-----|-------------------------------|
| `admin/proposals/review/[id]/page.tsx` | 1343 | đã có types/helpers/columns; extract `AwardReviewCard` sub-component, `useProposalHistory`/`useBulkDecision` hooks; gộp 2 block bulk-month |
| `manager/proposals/[id]/page.tsx` | 1154 | áp dụng split columns/*.tsx như admin đã làm; extract cell renderer (formatUnitInfo, decision link) |
| `CreateAdhocAwardModal.tsx` | 1087 | tách Step0-4 sub-component + `useAdhocCreateForm` hook + `useDecisionAutocomplete` (dùng chung Edit modal) |
| `awards/bulk/create/page.tsx` | 1012 | strategy registry cho 7 award type thay switch |
| `user/dashboard/page.tsx` | 884 | `MedalProgressRow` sub-component + `getEligibilityBadge` helper + chart aggregation helper |
| `PersonnelDetailView.tsx` | 871 | tách `PersonnelInfoTab/AwardsTab/ManagementTab`; 7 tile từ data array |
| `core.ts` getProposalById | 375 (file 657) | tách `enrichUnitNames/enrichPersonnel/hydrateApprovedPdfPaths` (NIEN_HAN_ENRICH config đã chỉ shape đúng) |
| `account.service.ts` create/update | ~200 mỗi | extract `resolveUnitAssignment(role, ids)` (đang duplicate create↔update), tách write-side |
| `personnel/update.ts` updatePersonnel | ~330 | tách authz / unit-mapping / write-tx |
| `tenureMedal/import.ts` previewImport | ~400 | tách `resolveContext/parseRow/validateRow/buildValidItem` |
| `awardBulk/handlers.ts` handleCongHien | ~210 | tách 3 filter pass thành pure function, bỏ `.length=0;.push` mutation |
| `lib/api/awards.ts` | 515 | tách per-domain + barrel; `buildAwardTypeApi(slug)` factory |

### 5.5 OCP/DIP — thay if/else dispatch bằng strategy/registry

| Nơi | Hiện tại | Đề xuất | Effort |
|-----|----------|---------|--------|
| `proposalStrategy.ts` | interface 4 method, 2 chết | hoặc shrink còn 2 method, hoặc thật sự route approve validation + success message qua strategy | M |
| `approve/validation.ts` (512 LOC) | 3 if-chain dispatch theo type | revive `validateApprove` qua `getProposalStrategy(type)` | M |
| `profile.controller.ts` checkEligibility | if/else DON_VI vs personal | service method map type → handler | S |
| `Step3SetTitles.tsx` | switch 8 case | `STEP3_REGISTRY: Record<type, Component>` | M |
| `awards/bulk/create` renderStepContent | inner switch 7 component | `AWARD_TYPE_REGISTRY[awardType]` | M |
| `manager/awards` cột danh hiệu | 6 if-branch | `AWARD_TAB_META[activeTab].renderTitle` | S |
| `getLoaiKhenThuongByDanhHieu` (danhHieu.constants:356) | 6-branch if/else | reverse lookup từ `AWARD_TYPE_REGISTRY` | S |
| `auditLog/proposals.ts` APPROVE/REJECT | 6-branch quantity dispatch | `resolveApprovedQuantity` strategy map | S |
| `apiClient` (lib/api/index.ts) | 146 method đăng ký tay | `{ ...authApi, ...accountsApi, ... }` spread | S |

**DIP — service bypass abstraction**:
- `profile/contribution.ts` re-implement months-by-group thay vì dùng `congHienMonthsAggregator` + `CONG_HIEN_HE_SO_RANGES`. Effort M.
- `ProfileService` (233 LOC) là facade pass-through duplicate toàn bộ JSDoc → thay bằng barrel re-export. Effort S.
- `ProfileViewForm.tsx` tự decode JWT thay vì `useAuth().user`. Effort S.

### 5.6 Duplicate cấu trúc khác (DRY cấp file-cluster)

- 4 medal repository giống nhau (xem 5.1).
- Step2/Step3 (~8200 LOC, 7 variant): abstraction (`usePersonnelList`, `step2Columns`, `serviceDuration`) đã có nhưng base `Step2SelectPersonnel.tsx` (chết) còn re-declare inline column + `calculateTotalMonths`. Hoàn tất migration → xóa base. Extract `useStep2Personnel(config)` hook + `useEligibilityCheck` + `EligibilityStatusCell`. **Effort M, payoff medium**.
- `useFetch`/`useMutation` dead nhưng 66 file hand-roll fetch → hoặc xóa, hoặc adopt thật sự per-directory. **Effort M, payoff high**.

---

## 6. Tính nhất quán & format (code nhìn đều/đẹp)

Codebase **rất uniform** ở khung (class + `export default new XxxService()`, repository object literal, controller thin catchAsync+ResponseHelper, named req-cast interface). Các outlier phá vỡ "nhìn đều":

| Loại | Pattern chủ đạo | Outlier | Quy tắc chuẩn hóa |
|------|-----------------|---------|-------------------|
| **Naming class↔file** | class = PascalCase(fileBaseName) | `tenureMedal.service.ts` export `HCCSVVService`; `contributionMedal.*` dùng `ContributionAwardService/Controller`; console tag `'[contribution-awards]'` ≠ slug `contribution-medals` | class = PascalCase(file); singleton = camelCase(file); console/audit tag = slug |
| **Repository naming** | `findUniqueRaw/findFirstRaw/findManyRaw` generic + SelectSubset | `danhHieu*` dùng bare `findUnique/findFirst/findMany` non-generic; `tenureMedal` có cả bare findMany (chết) lẫn findManyRaw | normalize tất cả về Raw + SelectSubset generic |
| **Notify-after-import** | — | 6 dùng `console.error`, 1 (militaryFlag) dùng `writeSystemLog`, deletion dùng `void` | 1 helper `safeNotifyImport` + 1 convention swallow |
| **JSDoc density service** | — | profile 19/19 vs account/decision/positionHistory/notification/unitAnnual/annual 0/N | trong 1 service: all-documented-meaningfully hoặc all-bare, không nửa vời, không stub rỗng |
| **FE import order** | React/Next → external → @/ | `DecisionModal:17-23`, `PersonnelEditForm:6-9`, `ScientificAchievementHistoryModal:5-6`, MainLayout, LoginForm interleave | 1 nhóm external liền mạch rồi 1 nhóm @/; thêm ESLint import-order rule |
| **apiClient import path** | `@/lib/http/apiClient` (90 file) | MainLayout, `Step3SetTitlesHCQKQT.tsx` dùng `@/lib/api` | chuẩn về `@/lib/http/apiClient` |
| **formatDate** | `@/lib/utils` (48 file, dd/MM/yyyy) | `annual-rewards/bulk/page.tsx:134` local formatDate ISO | xóa local, import canonical |
| **FE prop typing** | named `XxxProps` interface (48 file) | sub-component đa-prop inline type: `DecisionModal` FileSection, `UnitList` PersonnelTable/SubUnitPanel, `ImportReviewPageContent` | 2+ prop → named interface đầu file |
| **catch style** | — | 78 `catch (error: unknown)` vs 45 `catch (error)`; `VietnamAddressCascader:76` bind-then-discard + comment restate | bare `catch {` khi swallow, `catch (error)` chỉ khi dùng/log |

Phụ: `excelHelper.ts:12-16` JSDoc lạc chỗ (mô tả parseHeaderMap nhưng đặt trên normalizeHeaderKey); `datetimeHelper.ts:18` indentation lệch 1 space; `Step3SetTitlesDonViHangNam.tsx:156` typo `fetchUnitAnnualAwardss`; `PersonnelDetailView.tsx:92` snake_case `current_year`; MainLayout/LoginForm hardcode `© 2026`.

---

## 7. Lộ trình đề xuất (Action plan)

### Quick wins — Effort S, payoff cao (làm trước)

| # | Việc | File chính | Payoff |
|---|------|-----------|--------|
| 1 | Sửa AP-9: bỏ leak CUID/error.message, dùng `ho_ten`/placeholder; **update test assertion** | `awardBulk/handlers.ts`, `awardBulk.service.ts`, `profile/annual.ts`, `annualReward/import.ts` | high |
| 2 | Bỏ try/catch nuốt lỗi `isDescendant` (authz fail loudly) | `unit.service.ts:215` | high |
| 3 | `apiClient` spread `{...authApi,...}` thay 146 dòng đăng ký tay (lộ 21 method chết) | `lib/api/index.ts` | high |
| 4 | Dùng `canManageRole` thay rank check inline | `account.service.ts:583` | medium |
| 5 | Xóa dead file/symbol chắc chắn: useFetch, UnitTree, AccountsTable, (auth)/change-password, Step2SelectPersonnel base, no-op buttons/state | nhiều (xem mục 2) | medium |
| 6 | Xóa local `formatDate` ISO, dùng `@/lib/utils` | `annual-rewards/bulk/page.tsx:134` | medium |
| 7 | Chuẩn naming: `HCCSVVService→TenureMedalService`, `ContributionAward*→ContributionMedal*`, fix console tag | tenure/contribution service+controller | medium |
| 8 | Fix slug `military-flags`→`military-flag` (mount+slug+FE) | `routes/index.ts:54` | medium |
| 9 | Dịch JSDoc/comment tiếng Việt ở shared infra | AuthContext, profile services, apiError, useAuthGuard | medium |
| 10 | Bỏ section-divider + WHAT-comment (manager/adhoc-awards, lib/api/index) | nhiều | low |
| 11 | Sửa `Number(he_so) \| 0`: log/throw khi null thay vì coi là 0 | `congHienMonthsAggregator.ts:50` + 5 chỗ | high |

### Medium — Effort M

| # | Việc | File chính | Payoff |
|---|------|-----------|--------|
| 12 | `createCrudRepository(tx=>tx.model)` factory; trim 41 method chết | `repositories/*` | medium |
| 13 | Extend CREATE_HANDLERS registry, bỏ if/else `bulkCreateAwards` | `awardBulk.service.ts`, `dispatchTables.ts`, `handlers.ts` | high |
| 14 | Capability matrix BE + `requireCapability` thay named guard | `auth.ts`, `roles.constants.ts`, services | high |
| 15 | Nav config-driven (`NAV_CONFIG` + filter capability) | `navigation.tsx`, `useAuthGuard.ts` | high |
| 16 | `AWARD_TYPE_REGISTRY` mang import-review config; collapse 7 route thành `import-review/[awardType]` | `import-review-*/page.tsx`, registry | high |
| 17 | Extract shared helper: `safeNotifyImport`, `recalcAnnualAndLog`, `convertThoiGian→durationToMonths`, `monthsBetween`, `resolveUnitIdFromRecord` | controllers + services + lib | medium |
| 18 | adopt `useFetch`/`useMutation` per-directory hoặc xóa | 66 file | high |
| 19 | Type hóa `any`: ApproveModal, add-awards, ApiResponse<unknown>, EditableCell, categories forms | FE | medium |
| 20 | Replace if/else dispatch bằng registry: Step3SetTitles, getLoaiKhenThuongByDanhHieu, manager awards column | FE | medium |
| 21 | ESLint import-order rule + chuẩn apiClient path + catch style | FE toàn cục | medium |
| 22 | Reuse `buildUnitWhereFilter` ở unitAnnualAward/logVisibility/dashboard/medal services | BE services | high |

### Large refactors — Effort L (lập kế hoạch riêng, theo refactor workflow của CLAUDE.md: baseline test → từng unit nhỏ → typecheck+test sau mỗi bước)

| # | Việc | File chính | Payoff |
|---|------|-----------|--------|
| 23 | `createMedalAwardService(config)` + `createMedalController` + `buildMedalRoutes`; fold deleteAward; `runMedalPreview` driver | 4 medal service/controller/route/import | high |
| 24 | Shared `AwardsListView` + 1 `AWARD_TYPE_CONFIG`, admin/manager thành wrapper | `admin/awards`, `manager/awards` | high |
| 25 | Shared role-page components (theo SystemLogsPageContent) cho personnel/dashboard/accounts/award-detail | `app/{admin,manager,super-admin}/*` | high |
| 26 | Tách god-files: review/[id] 1343, manager [id] 1154, CreateAdhocAwardModal 1087, awards/bulk/create 1012, user/dashboard, PersonnelDetailView | xem 5.4 | high |
| 27 | Hoàn tất migration Step2/Step3 lên shared abstraction, xóa inline duplicate, extract hooks | bulk components | medium |
| 28 | Permission/role-page hợp nhất FE+BE end-to-end (capability + shared pages + nav config) | toàn hệ | high |
| 29 | Chuẩn hóa JSDoc density per-service (all-or-bare) | BE services | medium |

**Nguyên tắc thực thi**: ưu tiên 1-11 (quick wins) làm ngay vì rủi ro thấp, payoff cao, đặc biệt #1/#2/#11 ảnh hưởng tính đúng đắn (AP-9 + eligibility). Nhóm Large bám 2 trục lớn nhất — **medal abstraction (#23-24)** và **permission/role-page (#25,#28)** — đây là 2 nguồn chi phí mở rộng lớn nhất của dự án.
