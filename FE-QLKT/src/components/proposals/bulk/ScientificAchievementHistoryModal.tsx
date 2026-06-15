'use client';

import { Modal, Table, Tag, Empty } from 'antd';
import { HistoryOutlined } from '@ant-design/icons';
import { getDanhHieuName } from '@/constants/danhHieu.constants';
import type { ColumnsType } from 'antd/es/table';

interface ScientificAchievement {
  id: string;
  nam: number;
  loai: 'DTKH' | 'SKKH';
  mo_ta: string;
}

const LOAI_COLORS: Record<string, string> = {
  DTKH: 'blue',
  SKKH: 'green',
};

const columns: ColumnsType<ScientificAchievement> = [
  {
    title: 'Năm nhận',
    dataIndex: 'nam',
    key: 'nam',
    width: 100,
    align: 'center',
  },
  {
    title: 'Loại thành tích',
    dataIndex: 'loai',
    key: 'loai',
    width: 160,
    align: 'center',
    render: (loai: string) => (
      <Tag color={LOAI_COLORS[loai] || 'default'}>{getDanhHieuName(loai)}</Tag>
    ),
  },
  {
    title: 'Mô tả',
    dataIndex: 'mo_ta',
    key: 'mo_ta',
    ellipsis: true,
  },
];

interface ScientificAchievementHistoryModalProps {
  visible: boolean;
  personnel: { id: string; ho_ten: string } | null;
  achievements: ScientificAchievement[];
  loading: boolean;
  onClose: () => void;
}

export function ScientificAchievementHistoryModal({
  visible,
  personnel,
  achievements,
  loading,
  onClose,
}: ScientificAchievementHistoryModalProps) {
  return (
    <Modal
      title={
        <span>
          <HistoryOutlined style={{ marginRight: 8 }} />
          Lịch sử thành tích nghiên cứu khoa học - {personnel?.ho_ten}
        </span>
      }
      open={visible}
      onCancel={onClose}
      footer={null}
      width="min(900px, calc(100vw - 32px))"
      centered
    >
      {!loading && (!achievements || achievements.length === 0) ? (
        <Empty
          description="Chưa có dữ liệu lịch sử thành tích nghiên cứu khoa học"
          style={{ padding: '24px 0' }}
        />
      ) : (
        <Table
          columns={columns}
          dataSource={achievements}
          rowKey="id"
          loading={loading}
          pagination={false}
          size="small"
          scroll={{ x: 'max-content' }}
        />
      )}
    </Modal>
  );
}
