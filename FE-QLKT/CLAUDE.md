# FE-QLKT Frontend

Next.js 14 (App Router) + TypeScript + Ant Design + Tailwind CSS + shadcn/ui

## Structure

```
src/
├── app/                          # Next.js App Router
│   ├── (auth)/                   # Auth group (login, change-password)
│   ├── admin/                    # Admin pages
│   ├── super-admin/              # Super admin pages
│   ├── manager/                  # Manager pages
│   ├── user/                     # User pages
│   ├── dev_zone/                 # Developer tools
│   ├── layout.tsx, page.tsx
│   ├── error.tsx, not-found.tsx  # Error boundaries
│   └── globals.css               # Tailwind directives + custom CSS
├── components/
│   ├── ui/                       # shadcn/ui primitives (kebab-case, DO NOT modify)
│   ├── shared/                   # Cross-cutting reusable components
│   ├── auth/                     # Auth components (PascalCase)
│   ├── accounts/                 # Account CRUD
│   ├── personnel/                # Personnel components
│   ├── categories/               # Unit & position components
│   ├── adhoc-awards/             # Adhoc award components
│   ├── proposals/                # Proposal components (Step1/2/3 per type)
│   ├── decisions/                # Decision-number management
│   ├── profile/                  # Personnel/Unit profile views
│   ├── dashboard/                # Dashboard widgets
│   ├── charts/                   # Chart components
│   ├── system-logs/              # System log components
│   ├── import-review/            # Excel import review components
│   ├── super-admin/              # SUPER_ADMIN-only components
│   ├── MainLayout.tsx            # App shell with sidebar navigation
│   ├── ErrorBoundary.tsx
│   └── ThemeProvider.tsx
├── contexts/
│   └── AuthContext.tsx           # Auth state (user, login, logout)
├── hooks/                        # useFetch, useAuthGuard, useSocket, useMobile, useToast
├── lib/
│   ├── api/                      # API modules by domain (auth, accounts, personnel,
│   │                             #   awards, annualAwards, unitAnnualAwards, adhocAwards,
│   │                             #   proposals, profiles, decisions, dashboard,
│   │                             #   systemLogs, notifications, units, ...)
│   │                             # index.ts re-exports `apiClient` object
│   ├── award/                    # Award-domain helpers (chain rendering, danh hieu mapping)
│   ├── proposal/                 # Proposal-domain helpers
│   ├── file/                     # File handling helpers
│   ├── types/                    # Shared types (award.ts, proposal.ts, common.ts, ...)
│   ├── apiClient.ts              # Fetch wrapper
│   ├── axiosInstance.ts          # Axios instance with interceptors
│   ├── apiError.ts               # Error extraction helper
│   ├── schemas.ts                # Zod validation schemas for forms
│   ├── utils.ts                  # cn, formatDate, formatDateTime, ...
│   ├── antdTheme.ts              # Ant Design theme config
│   └── chartConfig.ts            # Chart.js config
├── constants/                    # roles, danhHieu, eligibilityStatus, proposal,
│                                 #   devZone, ... — all `*.constants.ts`
└── configs/
    └── index.ts                  # Environment config
```

## Adding a New Page

1. Create page at `app/{role}/feature-name/page.tsx`
2. Create components in `components/feature-name/` (PascalCase files)
3. Add API module in `lib/api/featureName.ts` if new endpoints
4. Re-export from `lib/api/index.ts` and add to `apiClient` object
5. Add navigation item in `MainLayout.tsx`
6. Add Zod schema in `lib/schemas.ts` if forms needed

## Component Pattern

```typescript
'use client';

import { useState } from 'react';
import { Form, Input, Button, message } from 'antd';
import { apiClient } from '@/lib/api';
import { getApiErrorMessage } from '@/lib/apiError';
import { ROLES } from '@/constants/roles.constants';

export function FeatureForm({ onSuccess }: { onSuccess: () => void }) {
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (values: any) => {
    setLoading(true);
    try {
      const result = await apiClient.createFeature(values);
      if (!result.success) {
        message.error(result.message || 'Thao tac that bai');
        return;
      }
      message.success('Thao tac thanh cong');
      onSuccess();
    } catch (error: unknown) {
      message.error(getApiErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Form onFinish={handleSubmit}>
      {/* form fields */}
      <Button type="primary" htmlType="submit" loading={loading}>Luu</Button>
    </Form>
  );
}
```

## Styling Priority

1. **Ant Design** components for forms, tables, modals, layout
2. **Tailwind CSS** for spacing, flex, grid, custom layout
3. **CSS Modules** (`*.module.css`) only when Ant Design + Tailwind can't handle it
4. Use `cn()` utility from `lib/utils.ts` for conditional Tailwind classes

## API Calls

Always use `apiClient` from `@/lib/api`:
```typescript
import { apiClient } from '@/lib/api';
const result = await apiClient.getPersonnel({ page: 1, limit: 10 });
```

For error messages, use `getApiErrorMessage()`:
```typescript
import { getApiErrorMessage } from '@/lib/apiError';
catch (error) { message.error(getApiErrorMessage(error)); }
```

## Date Formatting

Always use helpers from `lib/utils.ts`:
```typescript
import { formatDate, formatDateTime } from '@/lib/utils';
formatDate(record.ngay_sinh);      // "25/03/2026"
formatDateTime(record.createdAt);  // "25/03/2026 14:30"
```

## Path Alias

`@/*` maps to `src/*`. Always use absolute imports:
```typescript
// Good
import { LoginForm } from '@/components/auth/LoginForm';
// Bad
import { LoginForm } from '../../components/auth/LoginForm';
```

## Page organization (file > 1000 LOC)

Pattern đã áp dụng cho `app/admin/proposals/review/[id]/page.tsx`:

```
app/admin/proposals/review/[id]/
├── page.tsx                  # Component + JSX render
├── types.ts                  # Local types (DanhHieuItem, ProposalDetail, ...)
└── helpers.ts                # Pure utility fns (calculateTotalTimeByGroup, ...)
```

- **Bước 1 (an toàn)**: extract types + pure helpers (không động JSX/state) → giảm size không đổi behavior
- **Bước 2 (cần browser test)**: tách Card/section thành sub-components
- **Bước 3 (cần browser test)**: tách columns definitions vào `columns/<type>.ts` files

Không nhảy bước 2/3 nếu không có dev server để verify visual.

## Shared component extraction (Step2SelectPersonnel pattern)

Khi 3+ component có structure giống nhau (vd: `Step2SelectPersonnelHCQKQT`, `KNC`, `NienHan`):

1. Tạo `components/<feature>/types.ts` cho interface chung (vd: `Step2Personnel`)
2. Tạo `components/<feature>/<utility>.ts` cho pure helpers (vd: `serviceDuration.ts`)
3. Mỗi component import shared types/helpers thay vì inline
4. **Chỉ extract base UI component** sau khi đã verify behavior identical trên browser

## User-facing error messages

- Không leak technical ID (CUID, internal field) trong error toast/alert
- Fallback `record.ho_ten || 'một quân nhân'`, **không** `record.id`
- Catch error → log technical detail vào `console.error`, hiển thị message generic cho user qua `message.error()`

## Chain awards (BKBQP / CSTDTQ / BKTTCP) — FE rendering

Logic chuỗi danh hiệu nằm hoàn toàn ở BE. FE chỉ render:

- **Hồ sơ hằng năm** trả về từ BE chứa: `cstdcs_lien_tuc`, `nckh_lien_tuc`, `du_dieu_kien_bkbqp/cstdtq/bkttcp`, `goi_y` (text tiếng Việt đã build sẵn), `chainContext` (chainStartYear, lastBkbqp/Cstdtq/BkttcpYear, streakSinceLast<flag>, missedBkbqp/Cstdtq).
- Hồ sơ đơn vị: `dvqt_lien_tuc`, `du_dieu_kien_bk_tong_cuc/bk_thu_tuong`, `goi_y`.
- **KHÔNG tự build text gợi ý** trên FE — luôn render `goi_y` từ BE để giữ consistency.
- BKTTCP cá nhân là one-time per lifetime; sau khi nhận → BE trả `goi_y = "Phần mềm chưa hỗ trợ khen thưởng cao hơn ..."`.
- BKTTCP đơn vị + BKBQP/CSTDTQ cá nhân: lặp lại theo chu kỳ. UI không cần special-case.
- Hiển thị progress chu kỳ (vd "đang ở năm X/2 chu kỳ BKBQP"): tính từ `chainContext.streakSinceLast<flag>` chia `cycleYears` (2/3/7).
