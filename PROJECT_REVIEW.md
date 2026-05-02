# PROJECT_REVIEW — PM QLKT

> Code review tổng thể cho luận văn (ĐATN). Tập trung 3 mục tiêu user yêu cầu:
> 1. **Dễ mở rộng** khi thêm loại khen thưởng mới
> 2. **Dễ rename** khi đổi tên slug / display name của loại khen thưởng đã có
> 3. **Dễ thay đổi** khi điều kiện xét duyệt thay đổi
>
> Ngoài ra: rà các pattern "fallback thừa" / defensive code có thể bị giảng viên trừ điểm.

---

## 1. Architecture snapshot (để nắm dự án nhanh)

```
PM QLKT/
├── BE-QLKT/  Express + TS + Prisma + PostgreSQL
│   └── src/
│       ├── constants/        # danhHieu, chainAwards, proposalTypes, eligibilityStatus, ...
│       ├── controllers/      # 1 controller/loại; mỏng (catchAsync + ResponseHelper)
│       ├── services/         # business logic
│       │   ├── proposal/strategies/   # Strategy registry — 7 loại đề xuất
│       │   ├── eligibility/chainEligibility.ts   # core rule (personal + unit dùng chung)
│       │   ├── profile/annual.ts                 # personal: chain context + recalc + check
│       │   └── unitAnnualAward/eligibility.ts    # unit: parallel pattern
│       ├── repositories/     # ✓ commit mới — decouple Prisma
│       ├── helpers/auditLog/ # log description builders/domain
│       └── helpers/notification/awards.ts        # RESOURCE_TO_PROPOSAL_TYPE map
└── FE-QLKT/  Next.js 14 (App Router) + AntD + Tailwind + shadcn/ui
    └── src/
        ├── constants/        # MIRROR của BE (xem §3.1 — vấn đề chính)
        ├── lib/api/awards.ts # 521 LOC, monolithic
        ├── components/proposals/bulk/
        │   ├── Step2SelectPersonnel*.tsx   # 7 file × ~700 LOC ≈ 5.6k LOC
        │   └── Step3SetTitles*.tsx         # 7 file × ~500 LOC ≈ 3.5k LOC
        └── app/{admin,manager,user}/personnel/[id]/<award-type>/page.tsx
                                              # 6 award type × 2 role ≈ 12 trang gần copy-paste
```

### Điểm tốt cần giữ và defend khi bảo vệ luận văn

| Điểm | Vị trí | Tại sao đáng đề cập |
|---|---|---|
| Strategy pattern cho proposal | `BE/services/proposal/strategies/index.ts:22-31` | 7 loại đề xuất đều registered, không còn `if/else` dispatch |
| Chain rule centralized | `BE/constants/chainAwards.constants.ts` + `BE/services/eligibility/chainEligibility.ts` | Personal & unit dùng chung 1 hàm `checkChainEligibility` |
| Repository layer (commit `9bd12f6`) | `BE/repositories/*.repository.ts` | Service không gọi `prisma` trực tiếp (đa số) |
| Eligibility test suite | `BE/tests/services/eligibility-{bkbqp,cstdtq,bkttcp}-{personal,unit}.test.ts` + `chainContext`, `chainCycleScenarios` | Đủ rộng để defend "rule được kiểm chứng" |
| Single-source error messages cho test | `BE/tests/helpers/errorMessages.ts` | Đổi message → 1 file thay vì hàng chục |
| Anti-pattern guide | `BE-QLKT/CLAUDE.md` (AP-1 → AP-9) | Phần guideline rõ ràng — bằng chứng "có quy chuẩn" |

---

## 2. Đánh giá khả năng mở rộng / rename / thay rule

| Tiêu chí | Điểm | Lý do (1 câu) |
|---|---|---|
| **Extensibility** (thêm loại mới) | **5/10** | Logic dispatch tốt (strategy + chain config), nhưng schema Prisma có column tên cứng (`nhan_bkbqp`, `nhan_cstdtq`, `nhan_bkttcp`) → thêm tier mới = ALTER TABLE. |
| **Rename-safety** (đổi slug / display) | **4/10** | Không có TS enum/union cho slug; rename `tenure-medals` đụng **13+ file**; display name VN bị hardcode ở ≥7 component FE thay vì đọc từ `DANH_HIEU_MAP`. |
| **Condition-change-safety** | **7/10** | Cycle years (2/3/7) và threshold (10/15/20 năm, 120 tháng) đều ở constants. Yếu duy nhất: rule trùng giữa `computeEligibilityFlags` và `checkAwardEligibility` → đổi rule phải sync 2 chỗ. |

---

## 3. CRITICAL — phải fix trước khi defense

### 3.1. BE và FE duplicate hoàn toàn `danhHieu.constants.ts` (240 LOC × 2)

- `BE-QLKT/src/constants/danhHieu.constants.ts`
- `FE-QLKT/src/constants/danhHieu.constants.ts`

→ Bit-for-bit identical cho `DANH_HIEU_*`, `DANH_HIEU_MAP`, `getDanhHieuName()`, threshold years. Đổi 1 chỗ phải nhớ đổi chỗ kia. Đã có 1 lần FE drift (FE thêm `AWARD_TAB_LABELS`, `DANH_HIEU_COLORS` — BE không có).

**Fix có 3 cấp:**
1. **Quick (1h):** Tạo script `BE/scripts/syncDanhHieuToFe.ts` copy file BE → FE khi build, kèm comment cảnh báo "do not edit FE copy".
2. **Đúng (1 ngày):** Tách `shared/` package (npm workspace) chứa `danhHieu.constants.ts` + `eligibilityStatus.constants.ts` + `chainAwards.constants.ts`, BE và FE cùng import.
3. **Defensive (4h):** Expose endpoint `GET /api/meta/awards` trả config, FE fetch một lần khi boot và cache. Lợi ích phụ: FE đọc được `cycleYears` runtime thay vì hardcode.

→ **Khuyến nghị: option 2 (workspace)** — hợp với pattern monorepo hiện có.

### 3.2. Schema Prisma couple với tên loại danh hiệu

`BE-QLKT/prisma/schema.prisma` model `DanhHieuHangNam`:
```prisma
nhan_bkbqp   Boolean  @default(false)
nhan_cstdtq  Boolean  @default(false)
nhan_bkttcp  Boolean  @default(false)
so_quyet_dinh_bkbqp  String?
so_quyet_dinh_cstdtq String?
so_quyet_dinh_bkttcp String?
ghi_chu_bkbqp        String?
ghi_chu_cstdtq       String?
ghi_chu_bkttcp       String?
```

→ Thêm tier mới (ví dụ `BKQP_DAC_BIET`) = ALTER TABLE 3 cột. Đổi tên `BKBQP` = ALTER TABLE rename + sửa toàn bộ code đọc cột.

**Fix (medium effort, ≈4h):** Normalize sang bảng phụ `DanhHieuHangNamFlag`:
```
DanhHieuHangNamFlag {
  id, danh_hieu_hang_nam_id, code (BKBQP|CSTDTQ|BKTTCP|...),
  nhan: bool, so_quyet_dinh: string?, ghi_chu: string?
}
```
- Truy cập qua `findChainAwardConfig(...)` + lookup theo `code`.
- Migrate: backfill 3 cột hiện tại thành 3 dòng/quân nhân/năm.
- Rule cycle/threshold không đổi — chỉ đổi shape lưu trữ.

**Nếu không kịp:** ít nhất phải **viết comment ở schema** rõ ràng: "Adding new chain tier requires schema migration — see docs/extending-awards.md" + tạo `extending-awards.md` mô tả các bước.

### 3.3. Slug `tenure-medals` scattered 13+ file (rename impact)

Thử rename `tenure-medals` → `tenure-orders`:

| File | Số lần |
|---|---|
| `BE/routes/tenureMedal.route.ts` | 12 (paths + audit configs) |
| `BE/services/tenureMedal.service.ts` | 3 (notification resource) |
| `BE/controllers/tenureMedal.controller.ts` | 5 |
| `BE/helpers/auditLog/index.ts` | line 39, 78 |
| `BE/helpers/auditLog/awards/medals.ts` | line 3 |
| `BE/helpers/auditLog/awards/shared.ts` | line 30, 50 |
| `BE/helpers/notification/awards.ts` | line 592 |
| `FE/lib/api/awards.ts` | 9 endpoint strings |
| `FE/components/proposals/bulk/Step2SelectPersonnelNienHan.tsx` | line 891 |
| `FE/components/personnel/PersonnelDetailView.tsx` | line 738 |
| `FE/app/{admin,manager}/personnel/[id]/tenure-medals/` | folder names |
| Các file test | nhiều |

**Fix (2h):**
- Tạo `BE/constants/awardSlugs.constants.ts`:
  ```ts
  export const AWARD_SLUGS = {
    TENURE_MEDALS: 'tenure-medals',
    CONTRIBUTION_MEDALS: 'contribution-medals',
    COMMEMORATIVE_MEDALS: 'commemorative-medals',
    MILITARY_FLAG: 'military-flag',
    ANNUAL_REWARDS: 'annual-rewards',
    UNIT_ANNUAL_AWARDS: 'unit-annual-awards',
    SCIENTIFIC_ACHIEVEMENTS: 'scientific-achievements',
    ADHOC_AWARDS: 'adhoc-awards',
  } as const;
  export type AwardSlug = typeof AWARD_SLUGS[keyof typeof AWARD_SLUGS];
  ```
- Replace tất cả string literal bằng `AWARD_SLUGS.TENURE_MEDALS`. TS sẽ catch sai chính tả.
- FE mirror sang `FE/constants/awardSlugs.constants.ts` (hoặc đưa vào shared package §3.1).
- Folder route Next.js không tránh được (Next routing dùng folder name) — đành chấp nhận, nhưng giờ chỉ còn 2 folder thay vì 13 chỗ.

### 3.4. Display name VN hardcoded ở ≥7 component FE

Display name "Huân chương Bảo vệ Tổ quốc" / "Huy chương Chiến sĩ vẻ vang" có ở `DANH_HIEU_MAP` nhưng vẫn bị duplicate trong:

- `FE/components/proposals/bulk/Step3SetTitlesNienHan.tsx:385-387`
- `FE/components/proposals/bulk/Step3SetTitlesCongHien.tsx:327-329`
- `FE/components/proposals/bulk/Step2SelectPersonnelCongHien.tsx:391, 628, 631, 636, 694, 877, 878` (7 lần trong **một** file)
- `FE/components/personnel/PersonnelDetailView.tsx:344, 755, 827`
- `FE/components/proposals/bulk/ServiceHistoryModal.tsx:43, 56`
- `BE/services/personnel.service.ts:827` (eligibility reason message)

**Fix (1h):** grep "Huân chương" trong FE/components, replace bằng `getDanhHieuName(DANH_HIEU_*.<code>)`. ESLint rule custom cấm string literal khớp regex `/Huân chương|Huy chương|Bằng khen/` ngoài `constants/`.

### 3.5. Step2/Step3 components duplicate ~9k LOC

- 7 file `Step2SelectPersonnel*.tsx` mỗi file 500–1093 LOC, mỗi file fetch personnel + apply eligibility filter + render table — logic gần giống nhau, khác ở column config và filter rule.
- 7 file `Step3SetTitles*.tsx` tương tự.

**User CLAUDE.md** có rule "Giữ Step2/Step3 tách riêng theo từng loại, không gộp" — nhưng đây là rule đã được user xác nhận trước. Nếu giữ rule này, **vẫn nên** extract:
- `useEligiblePersonnel(awardType, filters)` hook chung — fetch + map status
- `<EligibilityStatusTag>` component chung
- `buildPersonnelColumns(awardType, options)` factory cho columns

→ Tiết kiệm ≈30–40% LOC mỗi file mà không gộp Step2/3.

**Confirm với user trước** khi đụng JSX (theo feedback `feedback_no_modify_tests.md` + flow refactor UI cần browser test).

---

## 4. MEDIUM — nên fix nếu còn thời gian

### 4.1. Eligibility logic split (recalc vs API check)

`BE/services/profile/annual.ts` có hai hàm gần như parallel:
- `computeEligibilityFlags()` (dòng 342-373) — dùng khi recalc batch profile
- `checkAwardEligibility()` (dòng 473-512) — dùng khi submit/approve

→ Đổi rule chuỗi phải sửa cả 2 + unit mirror trong `unitAnnualAward/eligibility.ts`. Đã được CLAUDE.md cảnh báo nhưng vẫn là rủi ro: dễ quên 1 chỗ.

**Fix:** Extract `EligibilityRuleEngine.evaluate(personnel, year, awardCode, ctx) → { eligible, reason, flag }`. Cả recalc và API đều gọi. Personal BKTTCP lifetime block chỉ là 1 layer wrapper.

### 4.2. `Step2SelectPersonnelNienHan.tsx` 1093 LOC

Largest single component trong FE. Theo CLAUDE.md "File > 500 dòng → xem xét tách". Nên:
- Extract `nienHanColumns.tsx` (column factory)
- Extract `nienHanFilters.ts` (filter logic)
- Giữ JSX router + state ở file gốc (~400 LOC)

### 4.3. Excel template formulas hardcoded

`BE/constants/awardExcel.constants.ts:136`:
```ts
UNIT_ANNUAL_DANH_HIEU_VALIDATION_FORMULA = '"ĐVQT,ĐVTT"'
```

→ Đổi `ĐVQT` → bất cứ tên gì = phải nhớ sửa formula. Build từ `DANH_HIEU_DON_VI_HANG_NAM` map thay vì literal:
```ts
const UNIT_ANNUAL_DANH_HIEU_VALIDATION_FORMULA =
  `"${Object.values(DANH_HIEU_DON_VI_HANG_NAM_DISPLAY).join(',')}"`;
```

### 4.4. Audit log RESOURCE_VI và notification map có overlap

- `BE/helpers/auditLog/index.ts:62-80` định nghĩa `RESOURCE_VI`
- `BE/helpers/notification/awards.ts:589-597` định nghĩa `RESOURCE_TO_PROPOSAL_TYPE`

Cả 2 cùng key (`tenure-medals`, `contribution-medals`, ...). Nên merge thành `BE/constants/awardResource.constants.ts`:
```ts
export const AWARD_RESOURCE: Record<AwardSlug, {
  vi: string;
  proposalType: ProposalType | null;
}> = { ... };
```

### 4.5. Lifetime block message duplicate

Message "Đã có BKTTCP. Phần mềm chưa hỗ trợ các danh hiệu cao hơn BKTTCP, sẽ phát triển trong thời gian tới." được hardcode ít nhất ở:
- `BE/services/eligibility/chainEligibility.ts`
- `BE/services/profile/annual.ts` (recalc goi_y order)
- `BE/tests/helpers/errorMessages.ts` (test)

Nên nhập vào `BE/constants/eligibilityMessages.constants.ts` và import từ 1 chỗ.

---

## 5. LOW — defensive code "bị giảng viên trừ điểm"

User worry: thầy cô đánh giá nhầm nếu thấy fallback thừa làm ẩn bug. Top 10 chỗ gãi đáng dọn:

| # | File:line | Code hiện tại | Vấn đề | Suggested fix |
|---|---|---|---|---|
| 1 | `BE/services/proposal/submit.ts:160` | `nam: parseInt(String(nam), 10) \|\| new Date().getFullYear()` | parseInt fail → silently dùng năm hiện tại, người dùng không biết Excel sai năm | Joi đã validate `nam` ở route → ép kiểu trực tiếp, không fallback |
| 2 | `BE/services/proposal/core.ts:244, 281` | `nam: item.nam \|\| proposal.createdAt?.getFullYear() \|\| new Date().getFullYear()` | Triple fallback | `item.nam ?? proposal.createdAt.getFullYear()` (Prisma đảm bảo `createdAt` không null) |
| 3 | `BE/helpers/auditLog/auth.ts:10, 13` | `req.user?.username \|\| 'N/A'` | Audit chỉ chạy sau `verifyToken` → `req.user` chắc chắn có | Bỏ optional + bỏ 'N/A'; dùng `req.user!.username` (hoặc kiểm `if (!req.user) throw`) |
| 4 | `BE/services/profile/annual.ts:484-486` | `try { ... } catch { return { eligible: false, reason: 'Quân nhân không tồn tại' }; }` | Nuốt mọi error thành cùng 1 message — connection error cũng thành "không tồn tại" | Bắt riêng `NotFoundError`, ném tiếp những error khác |
| 5 | `BE/services/personnel.service.ts:608-609, 621` | `catch (...) { void writeSystemLog(...) }` cho recalc + notification | Endpoint trả 200 dù recalc/notification fail — user tưởng OK | Trả `data.warnings: []` để FE hiển thị; vẫn không throw |
| 6 | `BE/helpers/auditLog/accounts.ts:25-26, 51-52, 68-69` | `catch (e) { /* Ignore */ }` (3 lần) | Bare swallow JSON.parse | Thêm `console.error('[auditLog/accounts]', e)` để debug |
| 7 | `BE/services/awardBulk/handlers.ts:458, 461, 464` | `as unknown as Prisma.InputJsonValue` (3 lần) | Double cast = bỏ type check | Validate shape bằng Joi/Zod 1 lần ở boundary, sau đó single cast |
| 8 | `BE/services/eligibility/congHienMonthsAggregator.ts:69` | `recalcPositionMonths(histories as any[], ...)` | `any[]` mất type | Define interface `PositionHistorySnapshot[]`, dùng |
| 9 | `BE/services/proposal/submit.ts:104-112` | `try { decode } catch { originalName = 'file'; }` | Filename decode fail → file lưu với tên 'file' | Throw validation error; user upload lại file đúng encoding |
| 10 | `BE/services/proposal/helpers.ts:113`, `core.ts:350-351` | `if (value === null \|\| value === undefined) return null` | Dual check thừa | `return value ?? null` |

**Quick win cho thesis defense:** chạy 1 PR cleanup riêng cho 10 mục trên (≈2h). Giảng viên xem diff sẽ thấy ý thức "remove unnecessary fallbacks" — đây là điểm cộng rõ ràng.

---

## 6. Roadmap đề xuất (theo thứ tự ROI)

| Bước | Effort | ROI | Mô tả |
|---|---|---|---|
| 1 | 30 min | Cao | **§5** — clean 10 fallback thừa, no behavior change |
| 2 | 2h | Cao | **§3.3** — tạo `awardSlugs.constants.ts`, replace string literals |
| 3 | 1h | Cao | **§3.4** — replace display name hardcoded → `getDanhHieuName()` |
| 4 | 4h | Cao | **§3.1** — gom shared constants thành workspace package |
| 5 | 2h | Trung | **§4.1** — extract `EligibilityRuleEngine` |
| 6 | 1h | Trung | **§4.4** — gom audit + notification resource map |
| 7 | 2h | Trung | **§4.2** — split `Step2SelectPersonnelNienHan.tsx` |
| 8 | 4h | Thấp (nhưng đáng cho thesis) | **§3.2** — normalize `nhan_bkbqp/cstdtq/bkttcp` thành bảng phụ |
| 9 | 1 ngày | Thấp | **§3.5** — extract `useEligiblePersonnel` + column factory cho Step2 |

**Khuyến nghị tối thiểu trước defense:** bước **1 → 2 → 3 → 5 → 6** (tổng ≈6h, all behavior-preserving). Đủ để defend "có centralized constants, có rule engine, không hardcode string". Bước 4, 8 đáng làm nếu còn thời gian.

---

## 7. Cho lần review sau

Khi rule chuỗi/loại danh hiệu đổi, file cần xem trước:
1. `BE/constants/chainAwards.constants.ts` — config
2. `BE/services/eligibility/chainEligibility.ts` — core rule
3. `BE/services/profile/annual.ts` — recalc (`computeEligibilityFlags`) + API check (`checkAwardEligibility`)
4. `BE/services/unitAnnualAward/eligibility.ts` — unit mirror
5. `BE/tests/services/eligibility-*.test.ts` — assertion
6. `BE/tests/helpers/errorMessages.ts` — single source cho message
7. `BE-QLKT/CLAUDE.md` § "Chain awards eligibility" — guideline đã viết

Khi thêm loại khen thưởng mới, follow:
1. Add code vào `BE/constants/danhHieu.constants.ts`
2. Add config vào `PERSONAL_CHAIN_AWARDS` hoặc `UNIT_CHAIN_AWARDS` (nếu là chain)
3. Tạo strategy class trong `BE/services/proposal/strategies/<type>Strategy.ts`
4. Register vào `BE/services/proposal/strategies/index.ts:REGISTRY`
5. Tạo controller/route/repository
6. Add audit helper trong `BE/helpers/auditLog/awards/`
7. Add notification map entry trong `BE/helpers/notification/awards.ts`
8. FE: add slug + display name vào `FE/constants/danhHieu.constants.ts` (sau khi có shared package thì chỉ 1 chỗ)
9. FE: add API functions vào `FE/lib/api/awards.ts`
10. FE: add page route + Step2/Step3 component

---

## 8. Hotfixes — 2026-05-02

Đợt review tổng thể (cấu trúc + chất lượng code BE/FE), kết quả:

| # | Việc | Trạng thái | Evidence |
|---|---|---|---|
| H1 | Bỏ `as any` ở `BE/src/services/tenureMedal.service.ts:837` (createDirect HCCSVV) | DONE | Type chuyển sang `Prisma.KhenThuongHCCSVVUncheckedCreateInput`; thêm `interface CreateDirectInput`; thêm field `thang` (default 12) cho phù hợp schema. Controller forward `thang` optional. |
| H2 | Bỏ 4 chỗ `as any` ở `FE/src/app/admin/proposals/review/[id]/page.tsx` (line 693/724/739/754 cũ) | DONE | Export `ServiceTimeRow` từ `lib/award/serviceTimeHelpers.tsx`; `personnelDetails` state typed `Record<string, ServiceTimeRow>`; thêm `thoi_gian_nhom_0_7/0_8/0_9_1_0` vào `DanhHieuItem`. |
| H3 | Tạo `.env.example` cho FE (BE đã có sẵn) | DONE | `FE-QLKT/.env.example` chứa `NEXT_PUBLIC_BASE_URL`. |
| H4 | Tách columns inline trong review page (1843 LOC) | PARTIAL | Tách `donViHangNamColumns` + `thanhTichColumns` thành `columns/donViHangNam.tsx` (157 LOC) + `columns/thanhTich.tsx` (166 LOC). Page giảm còn 1561 LOC. **Còn lại** `caNhanHangNamColumns` + `congHienColumns` chưa tách vì dependency vào `personnelDetails`, `positionHistoriesMap`, `congHienThangNhanColumn`, `totalTimeByGroup` — cần browser test rộng trước khi đụng. |

**Verify state sau hotfixes:**
- BE typecheck: clean
- FE typecheck: clean
- FE lint: clean (no warnings/errors)
- BE jest: 888 pass / 2 fail — khớp baseline (2 fail trong `tests/auth/rate-limit.test.ts` không liên quan, có sẵn từ trước)

**Còn pending (nằm ngoài đợt hotfix này):**
- §3.1 duplicate `danhHieu.constants.ts` BE↔FE — chưa fix
- §3.2 schema couple tên chuỗi (`nhan_bkbqp/cstdtq/bkttcp`) — chưa fix
- §3.3 slug `tenure-medals` scattered — đã có `AWARD_SLUGS` constants, một số file đã dùng nhưng FE folder route Next.js vẫn cần
- §3.4 display name VN hardcoded ở FE — chưa rà toàn bộ
- §3.5 Step2/Step3 ~9k LOC duplicate — chưa fix
- §5 cleanup 10 fallback thừa — chưa fix
- CI workflow (`.github/workflows/test.yml`) — user yêu cầu skip

