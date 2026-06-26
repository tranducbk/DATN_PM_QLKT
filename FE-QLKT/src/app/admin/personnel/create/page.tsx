'use client';

import {
  Card,
  Typography,
  ConfigProvider,
  theme as antdTheme,
  Button,
  Alert,
} from 'antd';
import { AccountCreateForm } from '@/components/accounts/AccountCreateForm';
import Link from 'next/link';
import { ArrowLeftOutlined } from '@ant-design/icons';
import { useTheme } from '@/components/ThemeProvider';
import { PageBreadcrumb } from '@/components/shared/PageBreadcrumb';

const { Title } = Typography;

export default function PersonnelCreatePage() {
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
            { title: 'Quân nhân', href: '/admin/personnel' },
            { title: 'Tạo mới' },
          ]}
        />
        <div className="flex items-center gap-4">
          <Link href="/admin/personnel">
            <Button icon={<ArrowLeftOutlined />}>Quay lại</Button>
          </Link>
          <Title level={2} className="!mb-0">
            Tạo tài khoản mới
          </Title>
        </div>

        <Alert
          type="info"
          showIcon
          message="Tạo tài khoản"
          description="Nhập username, password, vai trò, đơn vị và chức vụ để tạo tài khoản mới."
        />

        <Card bordered className="shadow-sm">
          <AccountCreateForm />
        </Card>
      </div>
    </ConfigProvider>
  );
}
