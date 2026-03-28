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
│   ├── layout.tsx                # Root layout
│   ├── page.tsx                  # Landing page
│   └── globals.css               # Tailwind directives + custom CSS
├── components/
│   ├── ui/                       # shadcn/ui primitives (kebab-case, DO NOT modify)
│   ├── auth/                     # Auth components (PascalCase)
│   ├── accounts/                 # Account CRUD components
│   ├── personnel/                # Personnel components
│   ├── categories/               # Unit & position components
│   ├── awards/                   # Award components
│   ├── proposals/                # Proposal components
│   ├── charts/                   # Chart components
│   ├── system-logs/              # System log components
│   ├── import-review/            # Excel import review components
│   ├── MainLayout.tsx            # App shell with sidebar navigation
│   ├── ErrorBoundary.tsx         # Error boundary wrapper
│   └── ThemeProvider.tsx         # Theme context provider
├── contexts/
│   └── AuthContext.tsx           # Auth state (user, login, logout)
├── hooks/
│   ├── useFetch.ts               # Data fetching hook
│   ├── useAuthGuard.ts           # Auth route protection
│   ├── useSocket.ts              # Socket.IO connection
│   ├── useMobile.ts              # Mobile breakpoint detection
│   └── useToast.ts               # Toast notifications (shadcn)
├── lib/
│   ├── api/                      # API modules by domain
│   │   ├── index.ts              # Re-exports apiClient object
│   │   ├── auth.ts, accounts.ts, personnel.ts, ...
│   │   └── systemLogs.ts
│   ├── apiClient.ts              # Axios instance with interceptors
│   ├── apiError.ts               # Error extraction helper
│   ├── schemas.ts                # Zod validation schemas for forms
│   ├── types.ts                  # Shared TypeScript types
│   ├── utils.ts                  # Utilities (cn, formatDate, formatDateTime, etc.)
│   ├── antdTheme.ts              # Ant Design theme config
│   ├── chartConfig.ts            # Chart.js config
│   └── AntdRegistry.tsx          # Ant Design SSR registry
├── constants/
│   ├── roles.constants.ts        # ROLES, ROLE_LABELS, ROLE_COLORS, getRoleInfo()
│   ├── danhHieu.constants.ts     # Award type constants
│   ├── eligibilityStatus.constants.ts
│   ├── proposal.constants.ts
│   └── devZone.constants.ts
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
