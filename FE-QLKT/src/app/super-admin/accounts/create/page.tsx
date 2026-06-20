'use client';

import {
  Card,
  Typography,
  ConfigProvider,
  theme as antdTheme,
  Button,
} from 'antd';
import { AccountCreateForm } from '@/components/accounts/AccountCreateForm';
import Link from 'next/link';
import { ArrowLeftOutlined } from '@ant-design/icons';
import { useTheme } from '@/components/ThemeProvider';
import { PageBreadcrumb } from '@/components/shared/PageBreadcrumb';

const { Title } = Typography;

export default function CreateAccountPage() {
  const { theme } = useTheme();

  return (
    <ConfigProvider
      theme={{
        algorithm: theme === 'dark' ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
      }}
    >
      <div className="space-y-4 p-6">
        <PageBreadcrumb
          items={[
            { title: 'Tài khoản', href: '/super-admin/accounts' },
            { title: 'Tạo mới' },
          ]}
        />
        <div className="flex items-center gap-4">
          <Link href="/super-admin/accounts">
            <Button icon={<ArrowLeftOutlined />}>Quay lại</Button>
          </Link>
          <Title level={2} className="!mb-0">
            Tạo tài khoản mới
          </Title>
        </div>

        <Card bordered className="shadow-sm">
          <AccountCreateForm />
        </Card>
      </div>
    </ConfigProvider>
  );
}
