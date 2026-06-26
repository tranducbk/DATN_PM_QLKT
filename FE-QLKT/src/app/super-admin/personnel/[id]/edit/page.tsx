'use client';

import { Button, Typography, ConfigProvider } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import Link from 'next/link';
import { useRouter, useParams } from 'next/navigation';
import { useTheme } from '@/components/ThemeProvider';
import { getAntdThemeConfig } from '@/lib/antdTheme';
import { PersonnelEditForm } from '@/components/personnel/PersonnelEditForm';
import { PageBreadcrumb } from '@/components/shared/PageBreadcrumb';

const { Title } = Typography;

export default function SuperAdminPersonnelEditPage() {
  const { theme } = useTheme();
  const router = useRouter();
  const params = useParams();
  const personnelId = params?.id as string;
  const detailPath = `/super-admin/personnel/${personnelId}`;

  return (
    <ConfigProvider theme={getAntdThemeConfig(theme === 'dark')}>
      <div className="space-y-6 p-6">
        <PageBreadcrumb
          items={[
            { title: 'Quân nhân', href: '/super-admin/personnel' },
            { title: 'Chi tiết', href: detailPath },
            { title: 'Chỉnh sửa' },
          ]}
        />

        <div className="flex items-center gap-4">
          <Link href={detailPath}>
            <Button icon={<ArrowLeftOutlined />}>Quay lại</Button>
          </Link>
          <Title level={2} className="!mb-0">
            Chỉnh sửa Quân nhân
          </Title>
        </div>

        <PersonnelEditForm
          personnelId={personnelId}
          onSuccess={() => router.push(detailPath)}
          onCancel={() => router.push(detailPath)}
        />
      </div>
    </ConfigProvider>
  );
}
