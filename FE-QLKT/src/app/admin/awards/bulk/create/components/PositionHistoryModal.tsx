'use client';

import { Modal, Table, Tag, Spin, Empty } from 'antd';
import { HistoryOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';

interface Personnel {
  id: string;
  ho_ten: string;
}

interface PositionHistory {
  id: string;
  chuc_vu?: {
    ten_chuc_vu: string;
    he_so_chuc_vu: number;
  };
  ChucVu?: {
    ten_chuc_vu: string;
    he_so_chuc_vu: number;
  };
  ngay_bat_dau: string;
  ngay_ket_thuc?: string;
  so_thang?: number;
  he_so_chuc_vu?: number;
}

interface PositionHistoryModalProps {
  visible: boolean;
  personnel: Personnel | null;
  positionHistory: PositionHistory[];
  loading: boolean;
  onClose: () => void;
}

export function PositionHistoryModal({
  visible,
  personnel,
  positionHistory,
  loading,
  onClose,
}: PositionHistoryModalProps) {
  const calculateDuration = (startDate: string, endDate?: string | null) => {
    if (!startDate) return '-';
    const start = dayjs(startDate);
    const end = endDate ? dayjs(endDate) : dayjs();
    const months = end.diff(start, 'month', true);
    const years = Math.floor(months / 12);
    const remainingMonths = Math.floor(months % 12);
    if (years > 0 && remainingMonths > 0) {
      return `${years} năm ${remainingMonths} tháng`;
    } else if (years > 0) {
      return `${years} năm`;
    } else {
      return `${remainingMonths} tháng`;
    }
  };

  const columns: ColumnsType<PositionHistory> = [
    {
      title: 'STT',
      key: 'index',
      width: 60,
      align: 'center',
      render: (_: any, __: any, index: number) => index + 1,
    },
    {
      title: 'Chức vụ',
      key: 'chuc_vu',
      width: 200,
      render: (record: PositionHistory) => {
        const chucVu = record.chuc_vu || record.ChucVu;
        return chucVu?.ten_chuc_vu || '-';
      },
    },
    {
      title: 'Hệ số',
      key: 'he_so',
      width: 100,
      align: 'center',
      render: (record: PositionHistory) => {
        const heSo =
          record.he_so_chuc_vu || record.chuc_vu?.he_so_chuc_vu || record.ChucVu?.he_so_chuc_vu;
        if (!heSo) return '-';
        if (heSo >= 0.9) {
          return <Tag color="green">{heSo}</Tag>;
        } else if (heSo >= 0.8) {
          return <Tag color="blue">{heSo}</Tag>;
        } else if (heSo >= 0.7) {
          return <Tag color="orange">{heSo}</Tag>;
        }
        return <Tag>{heSo}</Tag>;
      },
    },
    {
      title: 'Ngày bắt đầu',
      dataIndex: 'ngay_bat_dau',
      key: 'ngay_bat_dau',
      width: 150,
      align: 'center',
      render: (date: string) => (date ? dayjs(date).format('DD/MM/YYYY') : '-'),
    },
    {
      title: 'Ngày kết thúc',
      dataIndex: 'ngay_ket_thuc',
      key: 'ngay_ket_thuc',
      width: 150,
      align: 'center',
      render: (date: string | null | undefined, record: PositionHistory) => {
        if (date) {
          return dayjs(date).format('DD/MM/YYYY');
        }
        return <Tag color="blue">Đang đảm nhiệm</Tag>;
      },
    },
    {
      title: 'Thời gian',
      key: 'duration',
      width: 150,
      align: 'center',
      render: (record: PositionHistory) => {
        if (record.so_thang) {
          const years = Math.floor(record.so_thang / 12);
          const months = record.so_thang % 12;
          if (years > 0 && months > 0) {
            return `${years} năm ${months} tháng`;
          } else if (years > 0) {
            return `${years} năm`;
          } else {
            return `${months} tháng`;
          }
        }
        return calculateDuration(record.ngay_bat_dau, record.ngay_ket_thuc);
      },
    },
  ];

  return (
    <Modal
      title={
        <span>
          <HistoryOutlined style={{ marginRight: 8 }} />
          Lịch sử chức vụ - {personnel?.ho_ten}
        </span>
      }
      open={visible}
      onCancel={onClose}
      footer={null}
      width="min(900px, calc(100vw - 32px))"
      centered
    >
      <Spin spinning={loading}>
        {positionHistory && positionHistory.length > 0 ? (
          <Table
            columns={columns}
            dataSource={positionHistory}
            rowKey="id"
            pagination={false}
            size="small"
          />
        ) : (
          <Empty description="Chưa có dữ liệu lịch sử chức vụ" style={{ padding: '24px 0' }} />
        )}
      </Spin>
    </Modal>
  );
}
