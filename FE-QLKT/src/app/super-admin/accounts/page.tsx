'use client';

import { useState, useEffect } from 'react';
import {
  Table,
  Button,
  Space,
  Typography,
  Card,
  message,
  Popconfirm,
  Tag,
  Input,
  Select,
  Breadcrumb,
  ConfigProvider,
  theme as antdTheme,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  ReloadOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import Link from 'next/link';
import { apiClient } from '@/lib/api-client';
import { useTheme } from '@/components/theme-provider';

const { Title } = Typography;

// Helper functions for role display
const getRoleColor = (role: string) => {
  const colors: Record<string, string> = {
    SUPER_ADMIN: 'red',
    ADMIN: 'orange',
    MANAGER: 'blue',
    USER: 'green',
  };
  return colors[role] || 'default';
};

const getRoleText = (role: string) => {
  const texts: Record<string, string> = {
    SUPER_ADMIN: 'Super Admin',
    ADMIN: 'Admin',
    MANAGER: 'Quản lý',
    USER: 'Người dùng',
  };
  return texts[role] || role;
};

export default function AccountsListPage() {
  const { theme } = useTheme();
  const [loading, setLoading] = useState(false);
  const [tableLoading, setTableLoading] = useState(false);
  const [accounts, setAccounts] = useState([]);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 });
  const [searchText, setSearchText] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string | undefined>(undefined);

  const fetchAccounts = async (page = 1, pageSize = 10, search = '', role?: string) => {
    // Chỉ set loading ban đầu, khi chuyển trang thì dùng tableLoading
    if (accounts.length === 0 || page === 1) {
    setLoading(true);
    } else {
      setTableLoading(true);
    }
    try {
      const params: any = { page, limit: pageSize };
      if (search) params.search = search;
      if (role) params.role = role;

      const response = await apiClient.getAccounts(params);

      if (response.success) {
        setAccounts(response.data?.accounts || response.data?.data || []);
        setPagination({
          current: page,
          pageSize,
          total: response.data?.pagination?.total || response.data?.total || 0,
        });
      } else {
        message.error(response.message || 'Không thể tải danh sách tài khoản');
      }
    } catch (error: any) {
      message.error(error.message || 'Không thể tải danh sách tài khoản');
    } finally {
      setLoading(false);
      setTableLoading(false);
    }
  };

  const handleDelete = async (record: any) => {
    try {
      // Nếu tài khoản có liên kết quân nhân, xóa quân nhân (cascade delete tất cả)
      // Nếu không có quân nhân, chỉ xóa tài khoản
      if (record.quan_nhan_id) {
        const response = await apiClient.deletePersonnel(record.quan_nhan_id);
        if (response.success) {
          message.success('Xóa quân nhân và toàn bộ dữ liệu liên quan thành công');
          fetchAccounts(pagination.current, pagination.pageSize, debouncedSearch, roleFilter);
        } else {
          message.error(response.message || 'Không thể xóa quân nhân');
        }
      } else {
        const response = await apiClient.deleteAccount(record.id);
        if (response.success) {
          message.success('Xóa tài khoản thành công');
          fetchAccounts(pagination.current, pagination.pageSize, debouncedSearch, roleFilter);
        } else {
          message.error(response.message || 'Không thể xóa tài khoản');
        }
      }
    } catch (error: any) {
      message.error(error.message || 'Không thể xóa');
    }
  };

  const handleSearch = () => {
    const newSearch = searchText.trim();
    setDebouncedSearch(newSearch);
    fetchAccounts(1, pagination.pageSize, newSearch, roleFilter);
  };

  const handleTableChange = (pag: any) => {
    setTableLoading(true);
    fetchAccounts(pag.current, pag.pageSize, debouncedSearch, roleFilter);
  };

  const handleRoleFilterChange = (value: string | undefined) => {
    setRoleFilter(value);
    fetchAccounts(1, pagination.pageSize, debouncedSearch, value);
  };

  // Initial load
  useEffect(() => {
    fetchAccounts(1, 10);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const columns = [
    {
      title: 'STT',
      key: 'stt',
      width: 60,
      fixed: 'left' as const,
      align: 'center' as const,
      render: (_: any, __: any, index: number) =>
        (pagination.current - 1) * pagination.pageSize + index + 1,
    },
    {
      title: 'Tên đăng nhập',
      dataIndex: 'username',
      key: 'username',
      ellipsis: true,
      width: 150,
      align: 'center' as const,
    },
    {
      title: 'Vai trò',
      dataIndex: 'role',
      key: 'role',
      width: 120,
      align: 'center' as const,
      render: (role: string) => <Tag color={getRoleColor(role)}>{getRoleText(role)}</Tag>,
    },
    {
      title: 'Quân nhân',
      key: 'quan_nhan',
      width: 150,
      align: 'center' as const,
      render: (_: any, record: any) => {
        if (record.quan_nhan_id) {
          return <Link href={`/super-admin/accounts/${record.id}`}>{record.ho_ten}</Link>;
        }
        return <span className="text-gray-400">Chưa liên kết</span>;
      },
    },
    {
      title: 'Đơn vị',
      key: 'don_vi',
      width: 150,
      align: 'center' as const,
      ellipsis: true,
      render: (_: any, record: any) => record.don_vi || <span className="text-gray-400">-</span>,
    },
    {
      title: 'Cấp bậc / Chức vụ',
      key: 'cap_bac_chuc_vu',
      width: 180,
      align: 'center' as const,
      render: (_: any, record: any) => {
        const capBac = record.cap_bac;
        const chucVu = record.chuc_vu;
        if (!capBac && !chucVu) {
          return <span className="text-gray-400">-</span>;
        }
        return (
          <div
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}
          >
            {capBac ? (
              <span style={{ fontWeight: 600 }}>{capBac}</span>
            ) : (
              <span className="text-gray-400">-</span>
            )}
            {chucVu ? (
              <span style={{ fontSize: '12px', color: '#8c8c8c' }}>{chucVu}</span>
            ) : (
              <span className="text-gray-400" style={{ fontSize: '12px' }}>
                -
              </span>
            )}
          </div>
        );
      },
    },
    {
      title: 'Thời gian tạo',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 160,
      align: 'center' as const,
      render: (date: string) => {
        if (!date) return '-';
        const d = new Date(date);
        const hours = d.getHours().toString().padStart(2, '0');
        const minutes = d.getMinutes().toString().padStart(2, '0');
        const day = d.getDate().toString().padStart(2, '0');
        const month = (d.getMonth() + 1).toString().padStart(2, '0');
        const year = d.getFullYear();
        return `${hours}:${minutes} ${day}/${month}/${year}`;
      },
    },
    {
      title: 'Thao tác',
      key: 'action',
      width: 200,
      fixed: 'right' as const,
      align: 'center' as const,
      render: (_: any, record: any) => (
        <Space size="small" wrap>
          <Link href={`/super-admin/accounts/${record.id}`}>
            <Button size="small">Chi tiết</Button>
          </Link>
          <Link href={`/super-admin/accounts/${record.id}/edit`}>
            <Button size="small" icon={<EditOutlined />} />
          </Link>
          <Popconfirm
            title="Xác nhận xóa?"
            description={
              record.quan_nhan_id
                ? 'Xóa tài khoản và toàn bộ dữ liệu quân nhân liên quan?'
                : 'Bạn có chắc muốn xóa tài khoản này?'
            }
            onConfirm={() => handleDelete(record)}
            okText="Xóa"
            cancelText="Hủy"
            okButtonProps={{ danger: true }}
          >
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <ConfigProvider
      theme={{
        algorithm: theme === 'dark' ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
      }}
    >
      <div className="space-y-4 p-6">
        <Breadcrumb
          items={[
            { title: <Link href="/super-admin/dashboard">Dashboard</Link> },
            { title: 'Tài khoản' },
          ]}
        />
        <div className="flex justify-between items-center">
          <Title level={2} className="mb-0">
            Quản lý Tài khoản
          </Title>
          <Link href="/super-admin/accounts/create">
            <Button type="primary" icon={<PlusOutlined />}>
              Tạo tài khoản
            </Button>
          </Link>
        </div>

        <Card>
          <Space direction="vertical" style={{ width: '100%' }} size="middle">
            <Space wrap>
              <Input
                placeholder="Tìm kiếm theo tên đăng nhập"
                prefix={<SearchOutlined />}
                value={searchText}
                onChange={e => setSearchText(e.target.value)}
                onPressEnter={handleSearch}
                style={{ width: 250 }}
              />
              <Select
                placeholder="Lọc theo vai trò"
                allowClear
                value={roleFilter}
                onChange={handleRoleFilterChange}
                style={{ width: 200 }}
                options={[
                  { value: 'ADMIN', label: 'Admin' },
                  { value: 'MANAGER', label: 'Quản lý' },
                  { value: 'USER', label: 'Người dùng' },
                ]}
              />
              <Button type="primary" icon={<SearchOutlined />} onClick={handleSearch}>
                Tìm kiếm
              </Button>
              <Button
                icon={<ReloadOutlined />}
                onClick={() => {
                  setSearchText('');
                  setDebouncedSearch('');
                  setRoleFilter(undefined);
                  fetchAccounts(1, pagination.pageSize);
                }}
              >
                Làm mới
              </Button>
            </Space>
          </Space>
        </Card>

        <Card>
          <Table
            columns={columns}
            dataSource={accounts}
            rowKey="id"
            loading={loading || tableLoading}
            pagination={{
              ...pagination,
              showTotal: total => `Tổng ${total} tài khoản`,
              showSizeChanger: true,
              pageSizeOptions: ['10', '20', '50'],
            }}
            onChange={handleTableChange}
            scroll={{ x: 'max-content' }}
          />
        </Card>
      </div>
    </ConfigProvider>
  );
}
