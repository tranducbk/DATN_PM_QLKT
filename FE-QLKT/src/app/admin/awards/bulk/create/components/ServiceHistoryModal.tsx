'use client';

import { Modal, Descriptions, Typography, Spin, Tag, Divider, Empty } from 'antd';
import { HistoryOutlined } from '@ant-design/icons';

import { ELIGIBILITY_STATUS } from '@/constants/eligibilityStatus.constants';

const { Text, Title } = Typography;

const HCCSVV_ROWS = [
  { label: 'Hạng Ba', statusKey: 'hccsvv_hang_ba_status', danhHieu: 'HCCSVV_HANG_BA' },
  { label: 'Hạng Nhì', statusKey: 'hccsvv_hang_nhi_status', danhHieu: 'HCCSVV_HANG_NHI' },
  { label: 'Hạng Nhất', statusKey: 'hccsvv_hang_nhat_status', danhHieu: 'HCCSVV_HANG_NHAT' },
] as const;

const STATUS_CONFIG: Record<string, { color?: string; text: string }> = {
  DA_NHAN: { color: 'green', text: 'Đã nhận' },
  DU_DIEU_KIEN: { color: 'orange', text: 'Đủ điều kiện' },
};

interface ServiceHistoryModalProps {
  visible: boolean;
  personnel: { id: string; ho_ten: string } | null;
  serviceProfile: Record<string, any> | null;
  loading: boolean;
  onClose: () => void;
}

export function ServiceHistoryModal({
  visible,
  personnel,
  serviceProfile,
  loading,
  onClose,
}: ServiceHistoryModalProps) {
  const namNhan = serviceProfile?.hccsvv_nam_nhan || {};

  return (
    <Modal
      title={
        <span>
          <HistoryOutlined style={{ marginRight: 8 }} />
          Lịch sử Huy chương Chiến sĩ vẻ vang - {personnel?.ho_ten}
        </span>
      }
      open={visible}
      onCancel={onClose}
      footer={null}
      width={900}
      centered
    >
      <Spin spinning={loading}>
        {serviceProfile ? (
          <div>
            <Title level={5} style={{ marginTop: 0 }}>
              Huy chương Chiến sĩ Vẻ vang (HCCSVV)
            </Title>
            <Descriptions bordered column={1} size="small" style={{ marginBottom: 24 }}>
              {HCCSVV_ROWS.map(({ label, statusKey, danhHieu }) => {
                const status = serviceProfile[statusKey];
                const config = STATUS_CONFIG[status] || { text: 'Chưa đủ điều kiện' };
                return (
                  <Descriptions.Item key={danhHieu} label={label}>
                    <Tag color={config.color}>{config.text}</Tag>
                    {status === ELIGIBILITY_STATUS.DA_NHAN && namNhan[danhHieu] && (
                      <Text type="secondary" style={{ marginLeft: 8 }}>
                        Năm {namNhan[danhHieu]}
                      </Text>
                    )}
                  </Descriptions.Item>
                );
              })}
            </Descriptions>

            {serviceProfile.goi_y && (
              <>
                <Divider />
                <Descriptions bordered column={1} size="small">
                  <Descriptions.Item label="Gợi ý">
                    <Text style={{ whiteSpace: 'pre-wrap' }}>{serviceProfile.goi_y}</Text>
                  </Descriptions.Item>
                </Descriptions>
              </>
            )}
          </div>
        ) : (
          <Empty description="Chưa có dữ liệu lịch sử huy chương chiến sĩ vẻ vang" style={{ padding: '24px 0' }} />
        )}
      </Spin>
    </Modal>
  );
}
