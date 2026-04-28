# BE-QLKT Backend

Express + TypeScript + Prisma + PostgreSQL

## Structure

```
src/
├── index.ts                 # App entry point
├── controllers/             # Request handlers (EntityName.controller.ts)
├── services/                # Business logic (EntityName.service.ts)
├── routes/                  # Route definitions (entityName.route.ts)
│   └── index.ts             # Aggregates all routes
├── middlewares/
│   ├── auth.ts              # verifyToken, requireAuth, requireManager, requireAdmin, requireSuperAdmin
│   ├── errorHandler.ts      # Global error handler
│   ├── auditLog.ts          # Audit logging middleware
│   ├── unitFilter.ts        # Unit-based data filtering
│   └── validate.ts          # Joi validation wrapper
├── helpers/
│   ├── catchAsync.ts        # Async error wrapper for controllers
│   ├── responseHelper.ts    # Standardized API responses
│   ├── paginationHelper.ts  # Pagination (MAX_LIMIT = 100)
│   ├── controllerHelper.ts  # Shared controller utilities (buildManagerQuanNhanFilter, etc.)
│   ├── profileRecalcHelper.ts
│   ├── serviceYearsHelper.ts
│   ├── settingsHelper.ts
│   ├── systemLogHelper.ts
│   ├── unitHelper.ts
│   ├── cccdHelper.ts, datetimeHelper.ts
│   ├── auditLog/            # Audit log description builders by domain
│   ├── award/               # Award-specific helpers
│   ├── awardValidation/     # Cross-cutting award validation helpers
│   ├── excel/               # Excel template + import/export helpers
│   ├── file/                # File handling helpers
│   └── notification/        # Notification helpers by domain
├── validations/             # Joi schemas (entityName.validation.ts)
├── constants/               # All use entityName.constants.ts pattern
├── types/
│   ├── api.ts               # ApiResponse<T>, PaginatedData<T>, AuditLogOptions
│   └── express.d.ts         # Express Request type augmentation (req.user)
├── models/
│   └── index.ts             # Prisma client singleton
├── configs/
│   ├── cors.ts
│   ├── multer.ts            # File upload configs (excelUpload, documentUpload, etc.)
│   └── rateLimiter.ts
├── utils/
│   └── socketService.ts     # Socket.IO singleton
└── scripts/
    └── initSuperAdmin.ts    # DB seed script
```

## Adding a New Feature

1. Create validation schema in `validations/newFeature.validation.ts`
2. Create service in `services/newFeature.service.ts`
3. Create controller in `controllers/newFeature.controller.ts` — use `catchAsync()` wrapper
4. Create route in `routes/newFeature.route.ts` — add middleware chain
5. Register route in `routes/index.ts`
6. Add audit log helper in `helpers/auditLog/` if needed
7. Add notification helper in `helpers/notification/` if needed

## Controller Pattern

```typescript
import catchAsync from '../helpers/catchAsync';
import { ResponseHelper } from '../helpers/responseHelper';
import { newFeatureService } from '../services/newFeature.service';

class NewFeatureController {
  getAll = catchAsync(async (req: Request, res: Response) => {
    const { page, limit } = req.query;
    const result = await newFeatureService.getAll({ page, limit });
    return ResponseHelper.paginated(res, { data: result });
  });

  create = catchAsync(async (req: Request, res: Response) => {
    const result = await newFeatureService.create(req.body);
    return ResponseHelper.created(res, { data: result, message: 'Tao thanh cong' });
  });
}

export const newFeatureController = new NewFeatureController();
```

## Route Pattern

```typescript
router.post(
  '/',
  verifyToken,
  requireAdmin,
  validate(newFeatureValidation.create),
  auditLog({ action: AUDIT_ACTIONS.CREATE, resource: 'NEW_FEATURE' }),
  newFeatureController.create
);
```

## Database

- Prisma schema: `prisma/schema.prisma`
- Generated client: `src/generated/prisma`
- IDs: CUID (`@default(cuid())`)
- Timestamps: `createdAt` + `updatedAt` with `@db.Timestamptz(6)`
- Model naming: PascalCase Vietnamese (`QuanNhan`, `CoQuanDonVi`) with `@@map("snake_case")`
- Field naming: snake_case Vietnamese (`ho_ten`, `ngay_sinh`, `co_quan_don_vi_id`)

## Response Format

All API responses follow `ApiResponse<T>`:
```json
{ "success": true, "message": "...", "data": { ... } }
```

Paginated responses (`ResponseHelper.paginated`): `data` là mảng trực tiếp, `pagination` ở top level:
```json
{
  "success": true,
  "message": "...",
  "data": [...],
  "pagination": { "total": 100, "page": 1, "limit": 10, "totalPages": 10 }
}
```

## TypeScript Config

- `strict: false`, `strictNullChecks: false` (relaxed mode)
- Target: ES2020, Module: CommonJS
- Type declarations in `src/types/`

## Chain awards eligibility (BKBQP / CSTDTQ / BKTTCP)

Source files (sửa logic chuỗi phải đụng tất cả):

```
src/constants/chainAwards.constants.ts        # PERSONAL_CHAIN_AWARDS, UNIT_CHAIN_AWARDS configs
src/services/eligibility/chainEligibility.ts  # checkChainEligibility (core rule, dùng cho cả personal & unit)
src/services/profile/annual.ts                # personal: lastFlagYearInChain, computeChainContext,
                                              #   computeEligibilityFlags, checkAwardEligibility, recalculateAnnualProfile
src/services/profile/types.ts                 # ChainContext, AnnualStreakResult
src/services/unitAnnualAward/eligibility.ts   # unit: cùng pattern, async DB
```

**Rule chốt** (xem root `CLAUDE.md` để chi tiết):
- Cycle = repeatable mỗi `cycleYears` (BKBQP=2, CSTDTQ=3, BKTTCP=7). Eligibility = `streak >= cycleYears && % cycleYears === 0` + flags + NCKH (personal).
- Lỡ đợt → đợi đến chu kỳ kế (cộng `cycleYears` năm), KHÔNG cần đứt chuỗi CSTDCS/ĐVQT.
- BKTTCP cá nhân `isLifetime: true` → sau khi nhận một lần, lifetime block với reason "Đã có ... chưa hỗ trợ cao hơn ...". Tất cả chuỗi đơn vị + BKBQP/CSTDTQ cá nhân đều `isLifetime: false` (lặp lại).
- `chainEligibility.ts` **không còn** branch "đã bỏ lỡ" / "chưa hỗ trợ" độc lập — chỉ giữ lifetime block khi `hasReceived=true`.
- Cửa sổ đếm flags:
  - CSTDTQ count BKBQP: cửa sổ trượt 3y cuối từ `year-1`.
  - Unit BKTTCP count BKBQP: cửa sổ trượt 7y cuối từ `year-1`.
  - Personal BKTTCP count BKBQP/CSTDTQ: cửa sổ trượt 7y cuối, strict `=== 3` và `=== 2`.

**Khi sửa rule chuỗi**: phải update cả `computeEligibilityFlags` (recalc) và `checkAwardEligibility` (API) để khớp; cập nhật tests trong `tests/services/eligibility-{bkbqp,cstdtq,bkttcp}-{personal,unit}.test.ts`, `chainContext.test.ts`, `chainCycleScenarios.test.ts`.

**Khi đổi message**: update keys trong `tests/helpers/errorMessages.ts` (`eligibilityReasons`, `unitEligibilityReasons`, `suggestionMessages`) — single source cho assertion-grade messages.

## Service module organization (file > 800 LOC)

Pattern đã áp dụng cho `services/proposal/approve.ts`:

```
services/proposal/
├── approve.ts                    # Public API + flow chính (< 500 LOC)
└── approve/
    ├── types.ts                  # Shared types (ProposalContext, ImportAccumulator, ...)
    ├── validation.ts             # Pre-flight checks (duplicate, eligibility, decision#)
    ├── decisionMappings.ts       # Decision metadata + PDF persist + sync
    └── import.ts                 # Transactional import dispatch
```

Khi thêm concern mới: tạo file `<concern>.ts` trong subfolder, không chèn vào `approve.ts`.

## Strategy pattern cho proposal types

```
services/proposal/strategies/
├── proposalStrategy.ts           # Interface + shared types
├── index.ts                      # REGISTRY map
├── caNhanHangNamStrategy.ts
├── donViHangNamStrategy.ts
├── nienHanStrategy.ts
├── hcQkqtStrategy.ts             # Dùng singleMedalImporter helper
├── kncStrategy.ts                # Dùng singleMedalImporter helper
├── nckhStrategy.ts
├── congHienStrategy.ts
├── singleMedalImporter.ts        # Shared logic cho HC_QKQT + KNC
└── nienHanPayloadHelper.ts       # Shared payload builder
```

- Interface `ProposalStrategy` có 4 method: `buildSubmitPayload`, `validateApprove`, `importInTransaction`, `buildSuccessMessage`
- Dispatch qua REGISTRY: `getStrategy(type).method(...)` thay vì if/else
- 2 strategy "single-medal" (HC_QKQT, KNC) share logic qua `importSingleMedal()` helper với config callback

## Controller organization (file > 700 LOC)

Pattern đã áp dụng cho `proposal.controller.ts`:

```
controllers/
├── proposal.controller.ts        # Class với các endpoint methods
└── proposal/
    ├── types.ts                  # Request/response interfaces
    └── helpers.ts                # parseApproveBody, safeNotify, parseYearQuery, ...
```

Controller chỉ giữ logic `req → service → res`. Mọi parse/transform logic phải ở `helpers.ts` hoặc service.

## Anti-Patterns (BẮT BUỘC tránh khi viết code mới)

Lấy bối cảnh từ stack PM QLKT (Express + Prisma + PostgreSQL). Mỗi rule kèm ví dụ thực — copy/paste để check khi review.

### AP-1: Controller gọi Prisma trực tiếp (bypass service)

```typescript
// ❌ BAD — controllers/personnel.controller.ts
import { prisma } from '../models';

createPersonnel = catchAsync(async (req: Request, res: Response) => {
  const existing = await prisma.quanNhan.findFirst({ where: { cccd: req.body.cccd } });
  if (existing) throw new ValidationError('CCCD đã tồn tại');
  const personnel = await prisma.quanNhan.create({ data: req.body });
  return ResponseHelper.created(res, { data: personnel });
});
```

```typescript
// ✅ GOOD — Controller chỉ dispatch
createPersonnel = catchAsync(async (req: Request, res: Response) => {
  const personnel = await personnelService.create(req.body);
  return ResponseHelper.created(res, { data: personnel });
});

// services/personnel.service.ts — business logic ở đây
async create(data: CreatePersonnelData) {
  const existing = await prisma.quanNhan.findFirst({ where: { cccd: data.cccd } });
  if (existing) throw new ValidationError('CCCD đã tồn tại');
  return prisma.quanNhan.create({ data });
}
```

**Rule:** Controller không được `import { prisma }`. Mọi DB access phải qua service.

### AP-2: Controller chứa business logic (validate/transform/decide)

```typescript
// ❌ BAD — controllers/proposal.controller.ts
approveProposal = catchAsync(async (req, res) => {
  const proposal = await proposalService.getById(req.params.id);
  if (proposal.status === 'APPROVED') throw new ValidationError('Đã duyệt rồi');
  const editedDanhHieu = JSON.parse(req.body.data_danh_hieu || '[]');
  const eligibility = await profileService.checkEligibility(...);
  if (!eligibility.eligible) throw new ValidationError(eligibility.reason);
  // ... 50+ dòng logic phê duyệt
  return ResponseHelper.success(res, { data: result });
});
```

```typescript
// ✅ GOOD — Controller mỏng
approveProposal = catchAsync(async (req, res) => {
  const parsed = parseApproveBody(req.body, req.files);  // helper pure
  const result = await proposalService.approveProposal(
    req.params.id,
    parsed.editedData,
    req.user!.id,
    parsed.decisions,
    parsed.pdfFiles
  );
  return ResponseHelper.success(res, { data: result });
});
```

**Rule:** Controller body không quá ~15 dòng. Logic > 15 dòng → service.

### AP-3: Helper gọi DB / API (helper phải pure)

```typescript
// ❌ BAD — helpers/profileHelper.ts
import { prisma } from '../models';

export async function calculateProfileScore(personnelId: string) {
  const awards = await prisma.danhHieuHangNam.findMany({
    where: { quan_nhan_id: personnelId },
  });
  return awards.reduce((sum, a) => sum + (a.danh_hieu === 'CSTT' ? 10 : 5), 0);
}
```

```typescript
// ✅ GOOD — Helper pure, service fetch + gọi helper
// helpers/profileScoring.ts
export function computeProfileScore(awards: DanhHieuHangNam[]): number {
  return awards.reduce((sum, a) => sum + (a.danh_hieu === 'CSTT' ? 10 : 5), 0);
}

// services/profile.service.ts
async function getProfileScore(personnelId: string) {
  const awards = await prisma.danhHieuHangNam.findMany({
    where: { quan_nhan_id: personnelId },
  });
  return computeProfileScore(awards);
}
```

**Rule:** File trong `helpers/` không được import `prisma`, `apiClient`, hoặc service nào. Chỉ pure function. Exception: `auditLog/` và `notification/` helpers vốn đã coupling với DB là chấp nhận được.

### AP-4: Duplicate logic across services/controllers

```typescript
// ❌ BAD — Logic check duplicate award lặp ở 3 service
// annualReward.service.ts
const existing = await prisma.danhHieuHangNam.findFirst({
  where: { quan_nhan_id, nam, danh_hieu, status: 'APPROVED' },
});
if (existing) throw new ValidationError('Đã có danh hiệu năm này');

// commemorativeMedal.service.ts — copy gần giống
// awardBulk.service.ts — lại copy lần nữa
```

```typescript
// ✅ GOOD — Extract vào shared validation helper
// services/proposal/validation.ts (đã có pattern này)
export async function checkDuplicateAward(
  personnel_id: string,
  nam: number,
  danh_hieu: string,
  proposalType: string,
  status: string,
  excludeProposalId?: string
): Promise<{ exists: boolean; message?: string }> {
  // ... logic tập trung 1 chỗ
}
```

**Rule:** Logic lặp 2+ lần ở các service khác nhau → extract vào shared helper trong `services/eligibility/`, `services/<feature>/validation.ts`, hoặc `helpers/`.

### AP-5: Service gọi service circular hoặc deep chain

```typescript
// ❌ BAD — Circular
// proposalService → profileService.recalculate → proposalService.getList → profileService...
```

```typescript
// ❌ BAD — Deep chain (>3 levels)
// controller → serviceA → serviceB → serviceC → serviceD
```

```typescript
// ✅ GOOD — Service ngang, gọi tối đa 2 cấp
// controller → proposalService
// proposalService → profileService (recalculate sau khi approve)
// profileService → KHÔNG gọi lại proposalService
```

**Rule:** Service A gọi service B → service B không được gọi lại service A (kể cả gián tiếp). Chain tối đa 3 cấp `controller → serviceA → serviceB`.

### AP-6: Hardcoded role/status/danh hiệu strings

```typescript
// ❌ BAD
if (user.role === 'SUPER_ADMIN') { ... }
if (proposal.status === 'PENDING') { ... }
if (item.danh_hieu === 'BKBQP') { ... }
```

```typescript
// ✅ GOOD
import { ROLES } from '../constants/roles.constants';
import { PROPOSAL_STATUS } from '../constants/proposalStatus.constants';
import { DANH_HIEU_CA_NHAN_HANG_NAM } from '../constants/danhHieu.constants';

if (user.role === ROLES.SUPER_ADMIN) { ... }
if (proposal.status === PROPOSAL_STATUS.PENDING) { ... }
if (item.danh_hieu === DANH_HIEU_CA_NHAN_HANG_NAM.BKBQP) { ... }
```

**Rule:** Mọi string đại diện enum/constant phải import từ `constants/`. Đặc biệt: role, status, danh hiệu, proposal type, audit action.

### AP-7: Response format không qua ResponseHelper

```typescript
// ❌ BAD
res.json({ success: true, data: result });
res.status(400).json({ message: 'Lỗi' });
return res.send(result);
```

```typescript
// ✅ GOOD
return ResponseHelper.success(res, { data: result });
return ResponseHelper.created(res, { data: result, message: 'Tạo thành công' });
return ResponseHelper.paginated(res, { data: result, pagination });
return ResponseHelper.badRequest(res, 'Lỗi cụ thể');
return ResponseHelper.notFound(res, 'Không tìm thấy');
```

**Rule:** Mọi response trong controller phải qua `ResponseHelper.<method>()`. Đảm bảo format `{ success, data, message }` nhất quán.

### AP-8: Sửa schema Prisma có data → dùng `db push` (mất data)

```bash
# ❌ BAD — Đổi tên cột có data trong DB
# Sửa schema.prisma: ho_ten_cu → ho_ten_moi
npx prisma db push  # → DROP cột cũ + CREATE cột mới → MẤT DATA
```

```typescript
// ✅ GOOD — Migration script raw SQL
// src/scripts/renameHoTenColumn.ts
await prisma.$executeRawUnsafe(
  'ALTER TABLE quan_nhan RENAME COLUMN ho_ten_cu TO ho_ten_moi'
);
// Chạy script → cột đã đổi tên trong DB
// Sau đó mới `prisma db push` để sync schema (Prisma thấy cột đã đúng tên, không drop)
```

**Rule:** Cột có data → KHÔNG dùng `db push` để rename. Dùng raw SQL trong `src/scripts/` trước.

### AP-9: Catch error nhưng leak technical detail vào user message

```typescript
// ❌ BAD
try {
  await prisma.quanNhan.create({ data });
} catch (error) {
  acc.errors.push(`Lỗi import personnel_id ${id}: ${(error as Error).message}`);
  // → user nhìn thấy "Lỗi import personnel_id clxyz123: P2002 unique constraint..."
}
```

```typescript
// ✅ GOOD
try {
  await prisma.quanNhan.create({ data });
} catch (error) {
  console.error('[importPersonnel] error:', { personnel_id: id, error });
  acc.errors.push('Có lỗi xảy ra khi lưu thông tin quân nhân, vui lòng thử lại.');
}
```

**Rule:** Catch block log technical (CUID, stack, Prisma error code) vào `console.error` hoặc `writeSystemLog`. Push message generic + tiếng Việt cho user qua `acc.errors`/`throw`.

## Anti-Patterns (FE)

### AP-FE-1: Component gọi `fetch`/`axios` trực tiếp (bypass apiClient)

```typescript
// ❌ BAD
const res = await fetch(`/api/personnel/${id}`);
const res = await axios.get('/api/proposals');
```

```typescript
// ✅ GOOD
import { apiClient } from '@/lib/api';
const res = await apiClient.getPersonnel({ id });
```

### AP-FE-2: Format date inline thay vì dùng helper

```typescript
// ❌ BAD
{new Date(record.ngay_sinh).toLocaleDateString('vi-VN')}
{record.ngay_sinh?.split('T')[0]}
```

```typescript
// ✅ GOOD
import { formatDate, formatDateTime } from '@/lib/utils';
{formatDate(record.ngay_sinh)}
{formatDateTime(record.createdAt)}
```

### AP-FE-3: Default export cho component thường

```typescript
// ❌ BAD
export default function LoginForm() { ... }
```

```typescript
// ✅ GOOD
export function LoginForm() { ... }
```

Exception: chỉ `app/**/page.tsx` và `app/**/layout.tsx` của Next.js mới `export default` (Next.js bắt buộc).

### AP-FE-4: Ternary lồng nhau trong JSX

```tsx
// ❌ BAD
{loading ? <Spin /> : error ? <Alert /> : data ? <Table /> : <Empty />}
```

```tsx
// ✅ GOOD
{loading && <Spin />}
{!loading && error && <Alert />}
{!loading && !error && data && <Table />}
{!loading && !error && !data && <Empty />}
```
