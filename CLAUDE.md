# PM QLKT - Phần mềm Quản lý Khen thưởng

Monorepo gồm 2 phần: `FE-QLKT` (Next.js) và `BE-QLKT` (Express + Prisma).

## Quick Commands

```bash
# Backend
cd BE-QLKT && npm run dev          # Dev server (tsx watch)
cd BE-QLKT && npm run build        # Compile TypeScript
cd BE-QLKT && npm run typecheck    # Type check only
cd BE-QLKT && npm run format       # Prettier format

# Frontend
cd FE-QLKT && npm run dev          # Next.js dev
cd FE-QLKT && npm run build        # Production build
cd FE-QLKT && npm run typecheck    # Type check only
cd FE-QLKT && npm run lint         # ESLint
cd FE-QLKT && npm run format       # Prettier format

# Database
cd BE-QLKT && npx prisma migrate dev    # Run migrations
cd BE-QLKT && npx prisma generate       # Generate client
cd BE-QLKT && npx prisma studio         # DB GUI
cd BE-QLKT && npx prisma db push        # Sync schema (dev only, no migration file)
```

## Architecture

```
PM QLKT/
├── FE-QLKT/          # Next.js 14 (App Router) + Ant Design + Tailwind + shadcn/ui
└── BE-QLKT/          # Express + TypeScript + Prisma + PostgreSQL
```

- **4 roles**: SUPER_ADMIN > ADMIN > MANAGER > USER
- **7 award types**: Annual, Unit Annual, Tenure Medals (`tenure-medals`), Contribution (`contribution-medals`), Commemorative Medal (`commemorative-medals`), Military Flag (`military-flag`), Scientific Achievement
- **Real-time**: Socket.IO for notifications
- **Auth**: JWT (access + refresh tokens)

## Naming Conventions

### File Naming
| Type | Pattern | Example |
|------|---------|---------|
| React component | PascalCase.tsx | `LoginForm.tsx`, `PersonnelTable.tsx` |
| Hook | camelCase.ts | `useFetch.ts`, `useAuthGuard.ts` |
| Utility/lib | camelCase.ts | `apiClient.ts`, `apiError.ts` |
| Constants | camelCase.constants.ts | `roles.constants.ts`, `danhHieu.constants.ts` |
| BE Controller | camelCase.controller.ts | `account.controller.ts` |
| BE Service | camelCase.service.ts | `account.service.ts` |
| BE Route | camelCase.route.ts | `account.route.ts` |
| BE Validation | camelCase.validation.ts | `account.validation.ts` |
| shadcn/ui components | kebab-case.tsx (exception) | `button.tsx`, `dropdown-menu.tsx` |

### Code Naming
- Constants: `UPPER_SNAKE_CASE` with `as const` (`ROLES`, `ELIGIBILITY_STATUS`)
- Functions/variables: `camelCase`
- React components: `PascalCase` (named exports, NOT default exports)
- Prisma models: `PascalCase` with `@@map("snake_case")`
- DB fields: `snake_case` (Vietnamese names: `ho_ten`, `ngay_sinh`)
- Types/Interfaces: `PascalCase` (`ApiResponse<T>`, `PaginatedData<T>`)

### Imports
- FE uses path alias `@/*` mapping to `src/*`
- Order: React/Next → external libs → internal `@/` imports
- Named exports only (no default exports for components)

## Key Patterns

### Backend
- **Layered**: Route → Middleware → Controller → Service → Prisma
- **Middleware chain**: `verifyToken → requireRole → validate(schema) → auditLog(options) → controller.method`
- **Async errors**: Wrap controllers with `catchAsync()` helper
- **Responses**: Always use `ResponseHelper.success()`, `.created()`, `.paginated()`, `.badRequest()`, `.notFound()`, etc.
- **List APIs**: Luôn dùng `ResponseHelper.paginated()` để trả `data` + `pagination.total` — kể cả khi chưa phân trang thật (default limit cao)
- **Unit priority**: Khi xác định đơn vị của quân nhân, luôn ưu tiên `don_vi_truc_thuoc_id || co_quan_don_vi_id` (DVTT trước, CQDV sau — vì CQDV có thể là đơn vị cha)
- **Unit count (`so_luong`)**: Khi thay đổi đơn vị quân nhân, dùng `if/else` (chỉ increment/decrement 1 đơn vị), không dùng 2 `if` riêng biệt (tránh đếm dư)
- **Validation**: Joi schemas in `validations/` directory
- **Error classes**: `AppError`, `NotFoundError`, `ForbiddenError`
- **Type declarations**: Khai báo `interface`/`type` ở đầu file (sau imports), không khai báo inline trong function body. Đặc biệt `req.body`, `req.query`, `req.params` phải được cast sang named interface/type — không dùng `req.body as { field?: string }` trực tiếp
- **Fire-and-forget logs**: `writeSystemLog` trong catch block phải dùng `void writeSystemLog(...)` — không bỏ qua promise hoàn toàn
- **Rename resource slug**: Khi đổi tên resource (vd: `hccsvv` → `tenure-medals`), phải cập nhật đồng bộ: tên biến, export name, import, audit log map, notification map, route path, FE API URL. Sau đó chạy migration SQL để cập nhật `system_logs.resource` và `notifications.resource` trong DB (`UPDATE system_logs SET resource = 'new-slug' WHERE resource = 'old-slug'`)
- **Audit log helpers**: Tên biến local phải match resource slug (vd: `const tenureMedals = buildAwardTypeHelpers('tenure-medals')` — không dùng tên cũ `hccsvv`)
- **Audit log imports trong routes**: `getResourceId` lấy từ `middlewares/auditLog`; `getLogDescription` lấy từ `helpers/auditLog`. Không import `getResourceId` từ helpers
- **Best-effort catches**: Bare `catch` dùng khi swallow hoàn toàn (không cần biết lỗi gì). Dùng `catch (error) { console.error('...context...', error); }` khi muốn surface lỗi để debug nhưng không được throw (vd: audit log payload builder). `console.error` trong catch block của audit helpers là chấp nhận được — khác với `console.log` trong business logic
- **DB column rename**: Khi đổi tên cột có dữ liệu, KHÔNG dùng `db push` (sẽ drop + recreate → mất data). Thay vào đó: (1) viết script dùng `prisma.$executeRawUnsafe('ALTER TABLE x RENAME COLUMN old TO "new"')` trong `src/scripts/`, (2) chạy script để đổi tên cột trong DB, (3) sau đó mới `db push` để sync schema — lúc này Prisma thấy cột đã đúng tên, không drop gì cả.
- **Backup**: SQL text backup (`backups/*.sql`) sinh bởi `backup.service.ts`. Schedule + toggle qua DevZone (`/api/dev-zone/backup/*`). Download/delete qua `/api/backups` (SUPER_ADMIN only). Backup logs (`resource: 'backup'`) trong system_logs chỉ SUPER_ADMIN xem được — service tự filter cho role thấp hơn
- **System log visibility**: `resource: 'backup'` restricted to SUPER_ADMIN in `systemLogs.service.ts`. Khi thêm resource mới chỉ dành cho SUPER_ADMIN, áp dụng cùng pattern: check `userRole !== ROLES.SUPER_ADMIN` trong `getLogs` và `getResources`

### Frontend
- **API client**: `apiClient` object in `lib/api/index.ts` — single entry point for all API calls
- **Forms**: Ant Design Form + Zod schemas in `lib/schemas.ts`
- **State**: React Context for auth (`AuthContext`), custom hooks for data (`useFetch`, `useMutation`)
- **UI text**: All user-facing text in Vietnamese
- **Date formatting**: Always use `formatDate()`, `formatDateTime()` from `lib/utils.ts`
- **Conditional rendering**: Dùng multiple `{condition && <Component />}` blocks riêng thay vì ternary lồng nhau — tránh `condition ? <A /> : otherCondition ? <B /> : null`

## JSDoc Standards

Exported functions phải có JSDoc chuẩn:
```typescript
/**
 * Brief description (1 dòng).
 * @param paramName - Mô tả param
 * @returns Mô tả return value
 * @throws ErrorClass - Khi nào throw (nếu có)
 */
```

- Exported functions: **bắt buộc** `@param` + `@returns`
- Private/internal functions: 1 dòng mô tả là đủ
- Interfaces/Types: optional 1-line English description — omit if the name is self-explanatory; only doc individual fields if non-obvious
- **Không** comment giải thích WHAT code làm — code phải tự giải thích qua naming
- **Chỉ** comment WHY (hidden constraints, workarounds, business rules)
- **Không** dùng section dividers (`// ─── ... ───`, `// -----------`)
- **Không** viết JSDoc template rỗng như `/** getXxx API wrapper. @returns API response payload */` — chỉ viết khi có gì non-obvious cần giải thích
- **Route JSDoc** (`@desc`, `@access`): luôn giữ tiếng Anh — không đổi sang tiếng Việt

## Inline Comment Rules (STRICT)

- **Language: English only** — no Vietnamese, no mixed Vietnamese/English. This applies to all inline comments AND JSDoc for interfaces/types (1-line description must be English, or omit entirely if obvious from the name)
- **WHY not WHAT**: Delete any comment that just restates what the next line does
  - ❌ `// Check if personnel exists` before `const p = await prisma.quanNhan.findUnique(...)`
  - ❌ `// Validate year` before `if (nam < 2000 || nam > 2100)`
  - ❌ `// Delete record` before `await prisma.x.delete(...)`
  - ❌ `// intentionally not pre-filled` hoặc `// intentionally left empty` — code tự nói lên điều đó
  - ❌ `// Ensure X exists`, `// Validate X`, `// Compute X`, `// Build X`, `// Parse X` — đây là WHAT, không phải WHY
  - ✅ `// DVTT takes priority — increment CQDV only when no DVTT (avoid double-counting)`
  - ✅ `// Skip initial mount — only fire on subsequent status changes`
  - ✅ `// HC BVTQ is a one-time lifetime award, no duplicates allowed`
- **Section headings** like `// BƯỚC 1:`, `// BƯỚC 2:` are banned — extract into functions instead
- **Short**: ≤ 80 chars; if it needs more, the code needs to be renamed/refactored instead

## Code Quality Standards

### Module splitting
- **1 helper file = 1 responsibility** (vd: `excelImportHelper` = import, `excelTemplateHelper` = template)
- File > 500 dòng → xem xét tách
- Service > 800 dòng → tách logic phức tạp vào helper riêng
- Nếu 3+ services có logic giống nhau → extract vào shared helper
- FE: API file > 500 dòng → tách theo domain (`api/awards.ts`, `api/personnel.ts`)

### Variable declarations
- Dùng `const` thay `let` khi giá trị không cần reassign — chỉ dùng `let` khi thực sự cần thay đổi giá trị sau khai báo
- Không dùng `let` để khai báo biến rồi gán lại ngay trong `if/else` — thay bằng ternary hoặc tách hàm

### DRY (Don't Repeat Yourself)
- Magic numbers → extract vào `constants/` (vd: `MAX_EXCEL_ROWS`, `MIN_TEMPLATE_ROWS`)
- Logic lặp 2+ lần → extract function
- Joi schemas giống nhau → tạo base schema rồi extend
- FE columns giống nhau → dùng factory functions với optional params

### Performance
- Independent DB queries → `Promise.all()` thay vì sequential `await`
- N+1 queries → batch query trước loop (`findMany({ where: { in: [...] } })` + `Map`)
- Không query trong loop — collect IDs trước, query 1 lần
- Excel: dùng `loadWorkbook()` + `getAndValidateWorksheet()` từ helpers

### Security
- Validate `req.body` bằng Joi trước khi pass vào service
- Filter composition: dùng `AND` khi combine multiple where conditions, không overwrite
- `stripUnknown: true` trong Joi để bỏ fields thừa

### Khi thêm feature mới (Excel import/export)
1. Define columns trong service, gọi `buildTemplate(config)` — không viết inline
2. Preview import: dùng `loadWorkbook()` + `getAndValidateWorksheet()` + `batchQueryPersonnel()`
3. Confirm import: dùng `runConfirmTransaction()` + Joi validation trên route
4. Constants: thêm vào `excel.constants.ts`, không hardcode
5. FE: dùng `createPreviewImport(url)` / `createConfirmImport(url)` factory

## Do NOT

- Use default exports for React components
- Use underscore prefix for unused params (just name them normally)
- Hardcode status/role strings — use constants from `constants/` directory
- Use `console.log` in production code — use system log (`writeSystemLog`). Exception: `console.error` trong catch block của audit/log helpers là cho phép
- Create new files for one-time utilities — add to existing helper files
- Mix Vietnamese and English in the same identifier
- Use `as never` type assertions — use proper type casts
- Write redundant aliases (`const pageNum = page`) — use original variable
- Copy-paste logic across services — extract to shared helper first
- Write generic JSDoc like `/** getXxx API wrapper. @returns API response payload */` — omit JSDoc if there's nothing meaningful to add
- Change route `@desc` or `@access` comments to Vietnamese — keep them in English always
- Use `catch (e)` or `catch (error)` when the variable is not used and not logged — use bare `catch` instead. Nếu cần log lỗi, dùng `catch (error) { console.error('...context...', error); }`
- Declare `interface`/`type` inline inside function bodies — always declare at the top of the file
