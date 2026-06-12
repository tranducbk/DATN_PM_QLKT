'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Card,
  Table,
  Input,
  Button,
  Breadcrumb,
  Typography,
  message,
  ConfigProvider,
  theme as antdTheme,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { HomeOutlined, SearchOutlined, EyeOutlined } from '@ant-design/icons';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/http/apiClient';
import { useTheme } from '@/components/ThemeProvider';
import { useDebounce } from '@/hooks/useDebounce';
import { EmptyState } from '@/components/shared/EmptyState';
import { DEFAULT_ANTD_TABLE_PAGINATION, FETCH_ALL_LIMIT } from '@/constants/pagination.constants';

const { Title } = Typography;

interface PersonnelRow {
  id: string;
  ho_ten?: string | null;
  cap_bac?: string | null;
  ChucVu?: { ten_chuc_vu?: string | null } | null;
  CoQuanDonVi?: { ten_don_vi?: string | null } | null;
  DonViTrucThuoc?: { ten_don_vi?: string | null } | null;
}

const unitName = (r: PersonnelRow) =>
  r.DonViTrucThuoc?.ten_don_vi || r.CoQuanDonVi?.ten_don_vi || '-';

export default function SuperAdminPersonnelPage() {
  const { theme } = useTheme();
  const router = useRouter();
  const [personnel, setPersonnel] = useState<PersonnelRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState('');
  const keyword = useDebounce(searchText).trim().toLowerCase();

  useEffect(() => {
    (async () => {
      try {
        const res = await apiClient.getPersonnel({ limit: FETCH_ALL_LIMIT });
        if (res.success) {
          setPersonnel((res.data ?? []) as PersonnelRow[]);
        } else {
          message.error(res.message || 'Không thể tải danh sách quân nhân');
        }
      } catch {
        message.error('Không thể tải danh sách quân nhân');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtered = useMemo(
    () =>
      keyword
        ? personnel.filter(p => (p.ho_ten ?? '').toLowerCase().includes(keyword))
        : personnel,
    [personnel, keyword]
  );

  const columns: ColumnsType<PersonnelRow> = [
    { title: 'STT', key: 'stt', width: 64, align: 'center', render: (_v, _r, i) => i + 1 },
    {
      title: 'Họ và tên',
      dataIndex: 'ho_ten',
      key: 'ho_ten',
      render: v => <strong>{v || '-'}</strong>,
    },
    {
      title: 'Cấp bậc',
      dataIndex: 'cap_bac',
      key: 'cap_bac',
      width: 160,
      align: 'center',
      render: v => v || '-',
    },
    {
      title: 'Chức vụ',
      key: 'chuc_vu',
      width: 180,
      align: 'center',
      render: (_v, r) => r.ChucVu?.ten_chuc_vu || '-',
    },
    { title: 'Đơn vị', key: 'don_vi', render: (_v, r) => unitName(r) },
    {
      title: 'Hành động',
      key: 'action',
      width: 110,
      align: 'center',
      render: (_v, r) => (
        <Button
          type="primary"
          size="small"
          icon={<EyeOutlined />}
          onClick={() => router.push(`/super-admin/personnel/${r.id}`)}
        >
          Xem
        </Button>
      ),
    },
  ];

  return (
    <ConfigProvider
      theme={{ algorithm: theme === 'dark' ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm }}
    >
      <div className="p-6 space-y-4">
        <Breadcrumb
          items={[
            {
              title: (
                <Link href="/super-admin/dashboard">
                  <HomeOutlined />
                </Link>
              ),
            },
            { title: 'Quản lý quân nhân' },
          ]}
        />
        <Title level={2} style={{ margin: 0 }}>
          Quản lý quân nhân
        </Title>
        <Card>
          <Input
            placeholder="Tìm theo tên..."
            prefix={<SearchOutlined />}
            value={searchText}
            onChange={e => setSearchText(e.target.value)}
            allowClear
            size="large"
            style={{ maxWidth: 360, marginBottom: 16 }}
          />
          <Table
            columns={columns}
            dataSource={filtered}
            rowKey="id"
            loading={loading}
            pagination={{
              ...DEFAULT_ANTD_TABLE_PAGINATION,
              showTotal: total => `Tổng ${total} quân nhân`,
            }}
            scroll={{ x: 'max-content' }}
            locale={{ emptyText: <EmptyState description="Chưa có quân nhân nào" /> }}
          />
        </Card>
      </div>
    </ConfigProvider>
  );
}
