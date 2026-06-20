'use client';

import { useState } from 'react';
import { Table, Button, Dropdown, Modal, App, Tag } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { MenuProps } from 'antd';
import { MoreOutlined, DeleteOutlined } from '@ant-design/icons';
import { apiClient } from '@/lib/http/apiClient';
import { formatDate } from '@/lib/utils';
import { getRoleInfo } from '@/constants/roles.constants';

interface AccountRow {
  id: string;
  username: string;
  personnel_name?: string;
  role: string;
  createdAt: string;
}

interface AccountsTableProps {
  accounts: AccountRow[];
  onEdit?: (account: AccountRow) => void;
  onRefresh?: () => void;
}

export function AccountsTable({ accounts, onEdit, onRefresh }: AccountsTableProps) {
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { message } = App.useApp();

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      setLoading(true);
      const result = await apiClient.deleteAccount(deleteId);
      if (!result.success) {
        message.error(result.message || 'Có lỗi xảy ra khi xóa');
        return;
      }
      message.success('Xóa tài khoản thành công');
      onRefresh?.();
      setDeleteId(null);
    } catch {
      message.error('Có lỗi xảy ra khi xóa');
    } finally {
      setLoading(false);
    }
  };

  const buildMenuItems = (account: AccountRow): MenuProps['items'] => [
    { key: 'edit', label: 'Sửa', onClick: () => onEdit?.(account) },
    { key: 'reset', label: 'Đặt lại mật khẩu' },
    {
      key: 'delete',
      label: 'Xóa',
      danger: true,
      icon: <DeleteOutlined />,
      onClick: () => setDeleteId(account.id),
    },
  ];

  const columns: ColumnsType<AccountRow> = [
    {
      title: 'Tên đăng nhập',
      dataIndex: 'username',
      key: 'username',
      render: (value: string) => <span className="font-medium">{value}</span>,
    },
    {
      title: 'Họ tên Quân nhân',
      dataIndex: 'personnel_name',
      key: 'personnel_name',
    },
    {
      title: 'Vai trò',
      dataIndex: 'role',
      key: 'role',
      render: (role: string) => <Tag color={getRoleInfo(role).color}>{getRoleInfo(role).label}</Tag>,
    },
    {
      title: 'Ngày tạo',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (value: string) => formatDate(value),
    },
    {
      title: 'Hành động',
      key: 'actions',
      width: 100,
      render: (_v, account) => (
        <Dropdown menu={{ items: buildMenuItems(account) }} trigger={['click']} placement="bottomRight">
          <Button type="text" icon={<MoreOutlined />} />
        </Dropdown>
      ),
    },
  ];

  return (
    <>
      <div className="min-w-0 max-w-full border rounded-lg">
        <Table<AccountRow>
          rowKey="id"
          columns={columns}
          dataSource={accounts}
          pagination={false}
          size="middle"
          locale={{ emptyText: 'Không có dữ liệu' }}
        />
      </div>

      <Modal
        open={!!deleteId}
        title="Xác nhận xóa"
        onCancel={() => setDeleteId(null)}
        onOk={handleDelete}
        confirmLoading={loading}
        okText="Xóa"
        cancelText="Hủy"
        okButtonProps={{ danger: true }}
      >
        <p>Bạn có chắc chắn muốn xóa tài khoản này? Hành động này không thể hoàn tác.</p>
      </Modal>
    </>
  );
}
