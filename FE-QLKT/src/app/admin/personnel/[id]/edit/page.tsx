'use client';

import { Button, Typography, Breadcrumb, ConfigProvider } from 'antd';
import { ArrowLeftOutlined, HomeOutlined } from '@ant-design/icons';
import Link from 'next/link';
import { useRouter, useParams } from 'next/navigation';
import { useTheme } from '@/components/ThemeProvider';
import { getAntdThemeConfig } from '@/lib/antdTheme';
import { PersonnelEditForm } from '@/components/personnel/PersonnelEditForm';

const { Title } = Typography;

export default function PersonnelEditPage() {
  const { theme } = useTheme();
  const router = useRouter();
  const params = useParams();
  const personnelId = params?.id as string;
  const detailPath = `/admin/personnel/${personnelId}`;

  return (
    <ConfigProvider theme={getAntdThemeConfig(theme === 'dark')}>
      <div className="space-y-6 p-6">
        <Breadcrumb
          items={[
            {
              title: (
                <Link href="/admin/dashboard">
                  <HomeOutlined />
                </Link>
              ),
            },
            { title: <Link href="/admin/personnel">Quân nhân</Link> },
            { title: <Link href={detailPath}>Chi tiết</Link> },
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
