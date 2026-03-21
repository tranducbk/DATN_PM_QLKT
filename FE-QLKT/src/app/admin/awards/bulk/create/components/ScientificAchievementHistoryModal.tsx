'use client';

import { Modal, Table, Tag, Typography, Spin } from 'antd';
import { HistoryOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';

const { Text } = Typography;

interface ScientificAchievement {
  id: string;
  nam: number;
  loai: 'DTKH' | 'SKKH';
  mo_ta: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
}

const LOAI_MAP: Record<string, { text: string; color: string }> = {
  DTKH: { text: 'Đề tài khoa học', color: 'blue' },
  SKKH: { text: 'Sáng kiến khoa học', color: 'green' },
};

const STATUS_MAP: Record<string, { text: string; color: string }> = {
  PENDING: { text: 'Chờ duyệt', color: 'orange' },
  APPROVED: { text: 'Đã duyệt', color: 'green' },
  REJECTED: { text: 'Từ chối', color: 'red' },
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
    render: (loai: string) => {
      const item = LOAI_MAP[loai] || { text: loai, color: 'default' };
      return <Tag color={item.color}>{item.text}</Tag>;
    },
  },
  {
    title: 'Mô tả',
    dataIndex: 'mo_ta',
    key: 'mo_ta',
    ellipsis: true,
  },
  {
    title: 'Trạng thái',
    dataIndex: 'status',
    key: 'status',
    width: 120,
    align: 'center',
    render: (status: string) => {
      const item = STATUS_MAP[status] || { text: status, color: 'default' };
      return <Tag color={item.color}>{item.text}</Tag>;
    },
  },
];

interface ScientificAchievementHistoryModalProps {
  visible: boolean;
  personnel: { id: string; ho_ten: string } | null;
  achievements: ScientificAchievement[];
  loading: boolean;
  onClose: () => void;
}

export default function ScientificAchievementHistoryModal({
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
          Lịch sử thành tích khoa học - {personnel?.ho_ten}
        </span>
      }
      open={visible}
      onCancel={onClose}
      footer={null}
      width={900}
      centered
    >
      <Spin spinning={loading}>
        {achievements && achievements.length > 0 ? (
          <Table
            columns={columns}
            dataSource={achievements}
            rowKey="id"
            pagination={false}
            size="small"
          />
        ) : (
          <Text type="secondary">Chưa có dữ liệu lịch sử thành tích khoa học</Text>
        )}
      </Spin>
    </Modal>
  );
}
