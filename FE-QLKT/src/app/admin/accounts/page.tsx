'use client';

import { useEffect, useState, useMemo } from 'react';
import {
  Card,
  Typography,
  Button,
  Table,
  message,
  Breadcrumb,
  Tag,
  Space,
  Modal,
  ConfigProvider,
  theme as antdTheme,
  Skeleton,
  Input,
  Select,
} from 'antd';
import {
  PlusOutlined,
  DeleteOutlined,
  LockOutlined,
  HomeOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import Link from 'next/link';
import { useTheme } from '@/components/ThemeProvider';
import { apiClient } from '@/lib/apiClient';
import { DEFAULT_ANTD_TABLE_PAGINATION } from '@/constants/pagination.constants';
import { ROLES, ROLE_LABELS, ROLE_COLORS, roleSelectOptions } from '@/constants/roles.constants';

const { Title } = Typography;
const { confirm } = Modal;

interface AccountRow {
  id: string;
  username: string;
  role: string;
  quan_nhan_id: string | null;
  ho_ten: string | null;
  don_vi: string | null;
  cap_bac: string | null;
  chuc_vu: string | null;
}

const ROLE_ORDER: Record<string, number> = {
  [ROLES.SUPER_ADMIN]: 0,
  [ROLES.ADMIN]: 1,
  [ROLES.MANAGER]: 2,
  [ROLES.USER]: 3,
};

export default function AdminAccountsPage() {
  const { theme } = useTheme();
  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState('');
  const [roleFilter, setRoleFilter] = useState<string | undefined>(undefined);

  useEffect(() => {
    loadAccounts();
  }, []);

  const loadAccounts = async () => {
    try {
      setLoading(true);
      const response = await apiClient.getAccounts({});
      if (response.success) {
        setAccounts(response.data || []);
      } else {
        message.error(response.message || 'Không thể tải danh sách tài khoản');
      }
    } catch (error) {
      message.error('Lỗi khi tải danh sách tài khoản');
    } finally {
      setLoading(false);
    }
  };

  const filteredAccounts = useMemo(() => {
    let result = [...accounts];
    if (searchText.trim()) {
      const q = searchText.trim().toLowerCase();
      result = result.filter(
        a =>
          a.username.toLowerCase().includes(q) ||
          (a.ho_ten && a.ho_ten.toLowerCase().includes(q))
      );
    }
    if (roleFilter) {
      result = result.filter(a => a.role === roleFilter);
    }
    result.sort((a, b) => (ROLE_ORDER[a.role] ?? 99) - (ROLE_ORDER[b.role] ?? 99));
    return result;
  }, [accounts, searchText, roleFilter]);

  const handleDelete = (account: AccountRow) => {
    confirm({
      title: 'Xác nhận xóa',
      content: account.quan_nhan_id
        ? `Xóa tài khoản "${account.username}" và toàn bộ dữ liệu quân nhân liên quan?`
        : `Bạn có chắc muốn xóa tài khoản "${account.username}"?`,
      okText: 'Xóa',
      cancelText: 'Hủy',
      okType: 'danger',
      centered: true,
      onOk: async () => {
        try {
          // Deleting personnel cascades all related data; deleting an account-only row is safe
          if (account.quan_nhan_id) {
            const response = await apiClient.deletePersonnel(account.quan_nhan_id);
            if (response.success) {
              message.success('Xóa quân nhân và toàn bộ dữ liệu liên quan thành công');
              loadAccounts();
            } else {
              message.error(response.message || 'Không thể xóa quân nhân');
            }
          } else {
            const response = await apiClient.deleteAccount(account.id);
            if (response.success) {
              message.success('Xóa tài khoản thành công');
              loadAccounts();
            } else {
              message.error(response.message || 'Không thể xóa tài khoản');
            }
          }
        } catch (error) {
          message.error('Lỗi khi xóa');
        }
      },
    });
  };

  const handleResetPassword = (account: AccountRow) => {
    confirm({
      title: 'Xác nhận reset mật khẩu',
      content: `Reset mật khẩu tài khoản "${account.username}" về "Hvkhqs@123"?`,
      okText: 'Reset',
      cancelText: 'Hủy',
      centered: true,
      onOk: async () => {
        try {
          const response = await apiClient.resetAccountPassword(account.id);
          if (response.success) {
            message.success('Reset mật khẩu thành công');
          } else {
            message.error(response.message || 'Không thể reset mật khẩu');
          }
        } catch (error) {
          message.error('Lỗi khi reset mật khẩu');
        }
      },
    });
  };

  const getRoleTag = (role: string) => (
    <Tag color={ROLE_COLORS[role] ?? 'default'}>{ROLE_LABELS[role] ?? role}</Tag>
  );

  const columns = [
    {
      title: 'Username',
      dataIndex: 'username',
      key: 'username',
      align: 'center' as const,
    },
    {
      title: 'Vai trò',
      dataIndex: 'role',
      key: 'role',
      align: 'center' as const,
      render: (role: string) => getRoleTag(role),
    },
    {
      title: 'Quân nhân',
      key: 'quan_nhan',
      align: 'center' as const,
      render: (_: unknown, record: AccountRow) => {
        if (record.quan_nhan_id) {
          return <Link href={`/admin/personnel/${record.quan_nhan_id}`}>{record.ho_ten}</Link>;
        }
        return <span className="text-gray-400">Chưa liên kết</span>;
      },
    },
    {
      title: 'Đơn vị',
      key: 'don_vi',
      align: 'center' as const,
      render: (_: unknown, record: AccountRow) =>
        record.don_vi || <span className="text-gray-400">-</span>,
    },
    {
      title: 'Cấp bậc / Chức vụ',
      key: 'cap_bac_chuc_vu',
      width: 180,
      align: 'center' as const,
      render: (_: unknown, record: AccountRow) => {
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
      title: 'Thao tác',
      key: 'actions',
      align: 'center' as const,
      render: (_: unknown, record: AccountRow) => {
        // Admin cannot modify SUPER_ADMIN or other ADMIN accounts
        const canModify = record.role !== ROLES.SUPER_ADMIN && record.role !== ROLES.ADMIN;

        return (
          <Space>
            <Button
              type="link"
              size="small"
              icon={<LockOutlined />}
              onClick={() => handleResetPassword(record)}
              disabled={!canModify}
            >
              Reset MK
            </Button>
            <Button
              type="link"
              size="small"
              danger
              icon={<DeleteOutlined />}
              onClick={() => handleDelete(record)}
              disabled={!canModify}
            >
              Xóa
            </Button>
          </Space>
        );
      },
    },
  ];

  if (loading && accounts.length === 0) {
    return (
      <ConfigProvider
        theme={{
          algorithm: theme === 'dark' ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
        }}
      >
        <div className="p-6">
          <Skeleton active paragraph={{ rows: 2 }} className="mb-6" />
          <Skeleton active paragraph={{ rows: 10 }} />
        </div>
      </ConfigProvider>
    );
  }

  return (
    <ConfigProvider
      theme={{
        algorithm: theme === 'dark' ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
      }}
    >
      <div className="space-y-6 p-6">
        {/* Breadcrumb */}
        <Breadcrumb
          items={[
            {
              title: (
                <Link href="/admin/dashboard">
                  <HomeOutlined />
                </Link>
              ),
            },
            { title: 'Quản lý tài khoản' },
          ]}
        />

        {/* Header */}
        <div className="flex justify-between items-center">
          <Title level={2} className="!mb-0">
            Quản lý tài khoản
          </Title>
          <Link href="/admin/accounts/create">
            <Button type="primary" icon={<PlusOutlined />} size="large">
              Tạo tài khoản
            </Button>
          </Link>
        </div>

        {/* Filters */}
        <Card>
          <div className="flex gap-3 flex-wrap mb-4">
            <Input
              placeholder="Tìm username hoặc họ tên..."
              prefix={<SearchOutlined />}
              value={searchText}
              onChange={e => setSearchText(e.target.value)}
              allowClear
              style={{ width: 320 }}
            />
            <Select
              placeholder="Lọc theo vai trò"
              allowClear
              value={roleFilter}
              onChange={val => setRoleFilter(val)}
              style={{ width: 180 }}
              options={roleSelectOptions([ROLES.ADMIN, ROLES.MANAGER, ROLES.USER])}
            />
          </div>

          <Table
            dataSource={filteredAccounts}
            columns={columns}
            rowKey="id"
            loading={loading}
            scroll={{ x: 'max-content' }}
            pagination={{
              ...DEFAULT_ANTD_TABLE_PAGINATION,
              showTotal: (total, range) => `${range[0]}-${range[1]} của ${total} tài khoản`,
            }}
          />
        </Card>
      </div>
    </ConfigProvider>
  );
}
