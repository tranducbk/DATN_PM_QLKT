'use client';

import { useState } from 'react';
import { Table, Button, Space, Tag, Popconfirm, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { apiClient } from '@/lib/api-client';

interface PositionsTableProps {
  positions: any[];
  onEdit?: (position: any) => void;
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

  const columns: ColumnsType<any> = [
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
        // Chỉ hiển thị cột này cho chức vụ của cơ quan đơn vị (không có DonViTrucThuoc)
        if (record.DonViTrucThuoc) {
          return null; // Ẩn cột này cho đơn vị trực thuộc
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
        pageSize: 10,
        showSizeChanger: true,
        showTotal: total => `Tổng số ${total} chức vụ`,
      }}
      locale={{
        emptyText: 'Không có dữ liệu',
      }}
    />
  );
}
