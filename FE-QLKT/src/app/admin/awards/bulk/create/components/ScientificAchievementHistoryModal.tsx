'use client';

import { Modal, Table, Tag, Typography, Spin } from 'antd';
import { HistoryOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';

const { Text } = Typography;

interface Personnel {
  id: string;
  ho_ten: string;
}

interface ScientificAchievement {
  id: string;
  nam: number;
  loai: 'DTKH' | 'SKKH';
  mo_ta: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
}

interface ScientificAchievementHistoryModalProps {
  visible: boolean;
  personnel: Personnel | null;
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
  const columns: ColumnsType<ScientificAchievement> = [
    {
      title: 'Năm',
      dataIndex: 'nam',
      key: 'nam',
      width: 100,
      align: 'center',
    },
    {
      title: 'Loại',
      dataIndex: 'loai',
      key: 'loai',
      width: 120,
      align: 'center',
      render: (loai: string) => {
        const map: Record<string, { text: string; color: string }> = {
          DTKH: { text: 'ĐTKH', color: 'blue' },
          SKKH: { text: 'SKKH', color: 'green' },
        };
        const item = map[loai] || { text: loai, color: 'default' };
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
        const map: Record<string, { text: string; color: string }> = {
          PENDING: { text: 'Chờ duyệt', color: 'orange' },
          APPROVED: { text: 'Đã duyệt', color: 'green' },
          REJECTED: { text: 'Từ chối', color: 'red' },
        };
        const item = map[status] || { text: status, color: 'default' };
        return <Tag color={item.color}>{item.text}</Tag>;
      },
    },
  ];

  return (
    <Modal
      title={
        <span>
          <HistoryOutlined style={{ marginRight: 8 }} />
          Lịch sử NCKH/SKKH - {personnel?.ho_ten}
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
          <Text type="secondary">Chưa có dữ liệu lịch sử NCKH/SKKH</Text>
        )}
      </Spin>
    </Modal>
  );
}
