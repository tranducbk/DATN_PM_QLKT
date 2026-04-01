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
```

## Architecture

```
PM QLKT/
├── FE-QLKT/          # Next.js 14 (App Router) + Ant Design + Tailwind + shadcn/ui
└── BE-QLKT/          # Express + TypeScript + Prisma + PostgreSQL
```

- **4 roles**: SUPER_ADMIN > ADMIN > MANAGER > USER
- **7 award types**: Annual, Unit Annual, HCCSVV, Contribution, Commemoration Medal, Military Flag, Scientific Achievement
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

### Frontend
- **API client**: `apiClient` object in `lib/api/index.ts` — single entry point for all API calls
- **Forms**: Ant Design Form + Zod schemas in `lib/schemas.ts`
- **State**: React Context for auth (`AuthContext`), custom hooks for data (`useFetch`, `useMutation`)
- **UI text**: All user-facing text in Vietnamese
- **Date formatting**: Always use `formatDate()`, `formatDateTime()` from `lib/utils.ts`

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
- Interfaces/Types: 1 dòng mô tả, chỉ doc field nếu non-obvious
- **Không** comment giải thích WHAT code làm — code phải tự giải thích qua naming
- **Chỉ** comment WHY (hidden constraints, workarounds, business rules)
- **Không** dùng section dividers (`// ─── ... ───`, `// -----------`)

## Code Quality Standards

### Module splitting
- **1 helper file = 1 responsibility** (vd: `excelImportHelper` = import, `excelTemplateHelper` = template)
- File > 500 dòng → xem xét tách
- Service > 800 dòng → tách logic phức tạp vào helper riêng
- Nếu 3+ services có logic giống nhau → extract vào shared helper
- FE: API file > 500 dòng → tách theo domain (`api/awards.ts`, `api/personnel.ts`)

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
- Use `console.log` in production code — use system log (`writeSystemLog`)
- Create new files for one-time utilities — add to existing helper files
- Mix Vietnamese and English in the same identifier
- Use `as never` type assertions — use proper type casts
- Write redundant aliases (`const pageNum = page`) — use original variable
- Copy-paste logic across services — extract to shared helper first
