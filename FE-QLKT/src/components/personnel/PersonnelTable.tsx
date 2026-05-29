'use client';

import { Table, Button } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { EyeOutlined } from '@ant-design/icons';
import Link from 'next/link';
import { formatDate } from '@/lib/utils';

export interface PersonnelTableRow {
  id: string;
  ho_ten?: string | null;
  ngay_sinh?: string | null;
  cap_bac?: string | null;
  ChucVu?: { ten_chuc_vu?: string | null };
  ten_chuc_vu?: string | null;
  CoQuanDonVi?: { ten_don_vi?: string | null };
  DonViTrucThuoc?: {
    ten_don_vi?: string | null;
    CoQuanDonVi?: { ten_don_vi?: string | null };
  };
}

interface PersonnelTableProps {
  personnel: PersonnelTableRow[];
  sttOffset?: number;
  onEdit?: (p: PersonnelTableRow) => void;
  onRefresh?: () => void;
  readOnly?: boolean;
  viewLinkPrefix?: string;
}

export function PersonnelTable({
  personnel,
  sttOffset = 0,
  onEdit,
  readOnly = false,
  viewLinkPrefix = '/admin/personnel',
}: PersonnelTableProps) {
  const columns: ColumnsType<PersonnelTableRow> = [
    {
      title: 'STT',
      key: 'stt',
      width: 80,
      align: 'center',
      render: (_v, _r, index) => <span className="font-medium">{sttOffset + index + 1}</span>,
    },
    {
      title: 'Họ tên',
      key: 'ho_ten',
      width: 160,
      align: 'center',
      render: (_v, p) => (
        <div className="flex flex-col">
          <span className="font-medium">{p.ho_ten}</span>
          {p.ngay_sinh && (
            <span className="text-xs text-gray-500 mt-1">{formatDate(p.ngay_sinh)}</span>
          )}
        </div>
      ),
    },
    {
      title: 'Cơ quan đơn vị',
      key: 'cqdv',
      width: 200,
      align: 'center',
      render: (_v, p) =>
        p.DonViTrucThuoc?.CoQuanDonVi?.ten_don_vi || p.CoQuanDonVi?.ten_don_vi || '-',
    },
    {
      title: 'Đơn vị trực thuộc',
      key: 'dvtt',
      width: 200,
      align: 'center',
      render: (_v, p) => p.DonViTrucThuoc?.ten_don_vi || '-',
    },
    {
      title: 'Cấp bậc',
      dataIndex: 'cap_bac',
      key: 'cap_bac',
      width: 140,
      align: 'center',
      render: (value: string | null | undefined) => value || '-',
    },
    {
      title: 'Chức vụ',
      key: 'chuc_vu',
      width: 180,
      align: 'center',
      render: (_v, p) => p.ChucVu?.ten_chuc_vu || p.ten_chuc_vu || '-',
    },
    {
      title: 'Hành động',
      key: 'actions',
      width: 150,
      align: 'right',
      render: (_v, p) =>
        readOnly ? (
          <Button size="small" icon={<EyeOutlined />} onClick={() => onEdit?.(p)}>
            Xem
          </Button>
        ) : (
          <Link href={`${viewLinkPrefix}/${p.id}`}>
            <Button size="small" icon={<EyeOutlined />}>
              Xem
            </Button>
          </Link>
        ),
    },
  ];

  return (
    <div className="min-w-0 max-w-full">
      <Table<PersonnelTableRow>
        rowKey="id"
        columns={columns}
        dataSource={personnel}
        pagination={false}
        size="middle"
        locale={{ emptyText: 'Không có dữ liệu' }}
        scroll={{ x: 'max-content' }}
      />
    </div>
  );
}
