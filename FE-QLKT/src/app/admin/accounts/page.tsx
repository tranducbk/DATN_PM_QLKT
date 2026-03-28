'use client';

import { useEffect, useState } from 'react';
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
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  LockOutlined,
  HomeOutlined,
} from '@ant-design/icons';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTheme } from '@/components/ThemeProvider';
import { apiClient } from '@/lib/apiClient';
import { ROLES } from '@/constants/roles.constants';

const { Title } = Typography;
const { confirm } = Modal;

export default function AdminAccountsPage() {
  const { theme } = useTheme();
  const router = useRouter();
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAccounts();
  }, []);

  const loadAccounts = async () => {
    try {
      setLoading(true);
      const response = await apiClient.getAccounts({});
      if (response.success) {
        // Backend returns { accounts: [], pagination: {} }
        setAccounts(response.data?.accounts || []);
      } else {
        message.error(response.message || 'Không thể tải danh sách tài khoản');
      }
    } catch (error) {
      message.error('Lỗi khi tải danh sách tài khoản');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = (account: any) => {
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
          // Nếu tài khoản có liên kết quân nhân, xóa quân nhân (cascade delete tất cả)
          // Nếu không có quân nhân, chỉ xóa tài khoản
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

  const handleResetPassword = (account: any) => {
    confirm({
      title: 'Xác nhận reset mật khẩu',
      content: `Reset mật khẩu tài khoản "${account.username}" về "123456"?`,
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

  const getRoleTag = (role: string) => {
    const roleConfig: Record<string, { color: string; label: string }> = {
      [ROLES.SUPER_ADMIN]: { color: 'purple', label: 'Super Admin' },
      [ROLES.ADMIN]: { color: 'red', label: 'Admin' },
      [ROLES.MANAGER]: { color: 'blue', label: 'Quản lý' },
      [ROLES.USER]: { color: 'green', label: 'Người dùng' },
    };
    const config = roleConfig[role] || { color: 'default', label: role };
    return <Tag color={config.color}>{config.label}</Tag>;
  };

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
      render: (_: any, record: any) => {
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
      title: 'Thao tác',
      key: 'actions',
      align: 'center' as const,
      render: (_: any, record: any) => {
        // Admin không thể xóa/sửa SUPER_ADMIN hoặc ADMIN khác
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
            { title: 'Quản lý Tài khoản' },
          ]}
        />

        {/* Header */}
        <div className="flex justify-between items-center">
          <Title level={2} className="!mb-0">
            Quản lý Tài khoản
          </Title>
          <Link href="/admin/accounts/create">
            <Button type="primary" icon={<PlusOutlined />} size="large">
              Tạo Tài khoản
            </Button>
          </Link>
        </div>

        {/* Table */}
        <Card>
          <Table
            dataSource={accounts}
            columns={columns}
            rowKey="id"
            loading={loading}
            pagination={{
              pageSize: 20,
              showSizeChanger: true,
              showTotal: (total, range) => `${range[0]}-${range[1]} của ${total} tài khoản`,
              pageSizeOptions: ['10', '20', '50', '100'],
            }}
          />
        </Card>
      </div>
    </ConfigProvider>
  );
}
