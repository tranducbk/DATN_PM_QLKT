'use client';

import { useState } from 'react';
import { Table, Button, Space, Tag, Popconfirm, message, Empty } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { apiClient } from '@/lib/apiClient';
import { DEFAULT_ANTD_TABLE_PAGINATION } from '@/constants/pagination.constants';

export interface PositionRow {
  id: string;
  ten_chuc_vu?: string;
  he_so_chuc_vu?: number | string | null;
  is_manager?: boolean;
  don_vi_id?: string | null;
  co_quan_don_vi_id?: string | null;
  CoQuanDonVi?: { id?: string; ten_don_vi?: string } | null | undefined;
  DonViTrucThuoc?: { ten_don_vi?: string; CoQuanDonVi?: { id?: string; ten_don_vi?: string } | null | undefined } | null | undefined;
}

interface PositionsTableProps {
  positions: PositionRow[];
  onEdit?: (position: PositionRow) => void;
  onRefresh?: () => void;
}

export function PositionsTable({ positions, onEdit, onRefresh }: PositionsTableProps) {
  const [loading, setLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = async (id: string) => {
    try {
      setLoading(true);
      setDeletingId(id);
      await apiClient.deletePosition(id);
      message.success('Xóa chức vụ thành công');
      onRefresh?.();
    } catch (error) {
      message.error('Có lỗi xảy ra khi xóa');
    } finally {
      setLoading(false);
      setDeletingId(null);
    }
  };

  const columns: ColumnsType<PositionRow> = [
    {
      title: 'Tên Chức vụ',
      dataIndex: 'ten_chuc_vu',
      key: 'ten_chuc_vu',
      render: text => <strong>{text}</strong>,
    },
    {
      title: 'Cơ quan đơn vị',
      key: 'co_quan_don_vi',
      width: 200,
      render: (_, record) => {
        if (record.CoQuanDonVi) {
          return <span>{record.CoQuanDonVi.ten_don_vi}</span>;
        }
        if (record.DonViTrucThuoc?.CoQuanDonVi) {
          return <span>{record.DonViTrucThuoc.CoQuanDonVi.ten_don_vi}</span>;
        }
        return null;
      },
    },
    {
      title: 'Đơn vị trực thuộc',
      key: 'don_vi_truc_thuoc',
      width: 200,
      render: (_, record) => {
        if (record.DonViTrucThuoc) {
          return <span>{record.DonViTrucThuoc.ten_don_vi}</span>;
        }
        return null;
      },
    },
    {
      title: 'Là Chỉ huy?',
      dataIndex: 'is_manager',
      key: 'is_manager',
      width: 120,
      render: (isManager, record) => {
        // Hide this column for sub-unit positions (DonViTrucThuoc)
        if (record.DonViTrucThuoc) {
          return null;
        }
        return isManager ? <Tag color="green">Có</Tag> : <Tag>Không</Tag>;
      },
    },
    {
      title: 'Hệ số chức vụ',
      dataIndex: 'he_so_chuc_vu',
      key: 'he_so_chuc_vu',
      width: 150,
      render: value => parseFloat(value || 0).toFixed(2),
    },
    {
      title: 'Hành động',
      key: 'action',
      width: 180,
      align: 'right',
      render: (_, record) => (
        <Space size="small">
          <Button type="default" icon={<EditOutlined />} onClick={() => onEdit?.(record)}>
            Sửa
          </Button>
          <Popconfirm
            title="Xác nhận xóa"
            description="Bạn có chắc chắn muốn xóa chức vụ này? Hành động này không thể hoàn tác."
            onConfirm={() => handleDelete(record.id)}
            okText="Xóa"
            cancelText="Hủy"
            okButtonProps={{ danger: true, loading: deletingId === record.id }}
          >
            <Button
              type="default"
              danger
              icon={<DeleteOutlined />}
              loading={deletingId === record.id}
            >
              Xóa
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <Table
      columns={columns}
      dataSource={positions}
      rowKey="id"
      loading={loading}
      pagination={{
        ...DEFAULT_ANTD_TABLE_PAGINATION,
        showTotal: total => `Tổng số ${total} chức vụ`,
      }}
      scroll={{ x: 'max-content' }}
      locale={{
        emptyText: <Empty description="Không có dữ liệu" />,
      }}
    />
  );
}
