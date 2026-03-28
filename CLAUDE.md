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
- **Responses**: Always use `ResponseHelper.success()`, `.created()`, `.badRequest()`, `.notFound()`, etc.
- **Validation**: Joi schemas in `validations/` directory
- **Error classes**: `AppError`, `NotFoundError`, `ForbiddenError`

### Frontend
- **API client**: `apiClient` object in `lib/api/index.ts` — single entry point for all API calls
- **Forms**: Ant Design Form + Zod schemas in `lib/schemas.ts`
- **State**: React Context for auth (`AuthContext`), custom hooks for data (`useFetch`, `useMutation`)
- **UI text**: All user-facing text in Vietnamese
- **Date formatting**: Always use `formatDate()`, `formatDateTime()` from `lib/utils.ts`

## Do NOT

- Use default exports for React components
- Use underscore prefix for unused params (just name them normally)
- Hardcode status/role strings — use constants from `constants/` directory
- Use `console.log` in production code — use system log (`writeSystemLog`)
- Create new files for one-time utilities — add to existing helper files
- Mix Vietnamese and English in the same identifier
