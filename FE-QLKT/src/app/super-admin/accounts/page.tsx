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
import type { ColumnsType } from 'antd/es/table';
import { getApiErrorMessage } from '@/lib/apiError';
import { DEFAULT_PAGE_SIZE, DEFAULT_ANTD_TABLE_PAGINATION } from '@/lib/constants/pagination.constants';

import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  ReloadOutlined,
  SearchOutlined,
  HomeOutlined,
} from '@ant-design/icons';
import Link from 'next/link';
import { apiClient } from '@/lib/apiClient';
import { useTheme } from '@/components/ThemeProvider';
import { ROLES, getRoleInfo } from '@/constants/roles.constants';

const { Title } = Typography;

/** Dòng bảng tài khoản (API getAccounts). */
interface SuperAdminAccountRow {
  id: string;
  username: string;
  role: string;
  quan_nhan_id?: string | null;
  ho_ten?: string;
  don_vi?: string;
  cap_bac?: string;
  chuc_vu?: string;
  createdAt: string;
}

export default function AccountsListPage() {
  const { theme } = useTheme();
  const [loading, setLoading] = useState(false);
  const [tableLoading, setTableLoading] = useState(false);
  const [accounts, setAccounts] = useState<SuperAdminAccountRow[]>([]);
  const [pagination, setPagination] = useState({ current: 1, pageSize: DEFAULT_PAGE_SIZE, total: 0 });
  const [searchText, setSearchText] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string | undefined>(undefined);

  const fetchAccounts = async (page = 1, pageSize = DEFAULT_PAGE_SIZE, search = '', role?: string) => {
    if (accounts.length === 0 || page === 1) {
      setLoading(true);
    } else {
      setTableLoading(true);
    }
    try {
      const params: { page: number; limit: number; search?: string; role?: string } = {
        page,
        limit: pageSize,
      };
      if (search) params.search = search;
      if (role) params.role = role;

      const response = await apiClient.getAccounts(params);

      if (response.success) {
        setAccounts((response.data?.accounts ?? []) as SuperAdminAccountRow[]);
        setPagination({
          current: page,
          pageSize,
          total: response.data?.pagination?.total ?? 0,
        });
      } else {
        message.error(response.message || 'Không thể tải danh sách tài khoản');
      }
    } catch (error: unknown) {
      message.error(getApiErrorMessage(error, 'Không thể tải danh sách tài khoản'));
    } finally {
      setLoading(false);
      setTableLoading(false);
    }
  };

  const handleDelete = async (record: SuperAdminAccountRow) => {
    try {
      // Deleting personnel cascades all related data; deleting an account-only row is safe
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
    } catch (error: unknown) {
      message.error(getApiErrorMessage(error, 'Không thể xóa'));
    }
  };

  const handleSearch = () => {
    const newSearch = searchText.trim();
    setDebouncedSearch(newSearch);
    fetchAccounts(1, pagination.pageSize, newSearch, roleFilter);
  };

  const handleTableChange = (pag: { current?: number; pageSize?: number }) => {
    setTableLoading(true);
    fetchAccounts(
      pag.current ?? 1,
      pag.pageSize ?? pagination.pageSize,
      debouncedSearch,
      roleFilter
    );
  };

  const handleRoleFilterChange = (value: string | undefined) => {
    setRoleFilter(value);
    fetchAccounts(1, pagination.pageSize, debouncedSearch, value);
  };

  useEffect(() => {
    fetchAccounts(1, 10);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only run on mount
  }, []);

  const columns: ColumnsType<SuperAdminAccountRow> = [
    {
      title: 'STT',
      key: 'stt',
      width: 60,
      fixed: 'left',
      align: 'center',
      render: (_value, _record, index) =>
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
      render: (role: string) => <Tag color={getRoleInfo(role).color}>{getRoleInfo(role).label}</Tag>,
    },
    {
      title: 'Quân nhân',
      key: 'quan_nhan',
      width: 150,
      align: 'center' as const,
      render: (_value, record) => {
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
      render: (_value, record) => record.don_vi || <span className="text-gray-400">-</span>,
    },
    {
      title: 'Cấp bậc / Chức vụ',
      key: 'cap_bac_chuc_vu',
      width: 180,
      align: 'center' as const,
      render: (_value, record) => {
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
      render: (_value, record) => (
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
            { title: <Link href="/super-admin/dashboard"><HomeOutlined /></Link> },
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
                  { value: ROLES.ADMIN, label: 'Admin' },
                  { value: ROLES.MANAGER, label: 'Quản lý' },
                  { value: ROLES.USER, label: 'Người dùng' },
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
              ...DEFAULT_ANTD_TABLE_PAGINATION,
              ...pagination,
              showTotal: total => `Tổng ${total} tài khoản`,
            }}
            onChange={handleTableChange}
            scroll={{ x: 'max-content' }}
          />
        </Card>
      </div>
    </ConfigProvider>
  );
}
