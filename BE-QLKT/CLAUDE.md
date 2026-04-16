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
│   ├── controllerHelpers.ts # Shared controller utilities (buildManagerQuanNhanFilter, etc.)
│   ├── auditLog/            # Audit log description builders by domain
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
