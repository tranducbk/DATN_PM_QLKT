'use client';

import { Modal, Descriptions, Typography, Spin, Tag, Divider } from 'antd';
import { HistoryOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';

const { Text, Title } = Typography;

interface Personnel {
  id: string;
  ho_ten: string;
  ngay_sinh?: string | null;
}

interface ServiceProfile {
  hccsvv_hang_ba_status?: 'CHUA_DU' | 'DU_DIEU_KIEN' | 'DA_NHAN';
  hccsvv_hang_ba_ngay?: string | null;
  hccsvv_hang_nhi_status?: 'CHUA_DU' | 'DU_DIEU_KIEN' | 'DA_NHAN';
  hccsvv_hang_nhi_ngay?: string | null;
  hccsvv_hang_nhat_status?: 'CHUA_DU' | 'DU_DIEU_KIEN' | 'DA_NHAN';
  hccsvv_hang_nhat_ngay?: string | null;
  hcbvtq_total_months?: number;
  hcbvtq_hang_ba_status?: 'CHUA_DU' | 'DU_DIEU_KIEN' | 'DA_NHAN';
  hcbvtq_hang_nhi_status?: 'CHUA_DU' | 'DU_DIEU_KIEN' | 'DA_NHAN';
  hcbvtq_hang_nhat_status?: 'CHUA_DU' | 'DU_DIEU_KIEN' | 'DA_NHAN';
  goi_y?: string;
}

interface ServiceHistoryModalProps {
  visible: boolean;
  personnel: Personnel | null;
  serviceProfile: ServiceProfile | null;
  loading: boolean;
  onClose: () => void;
}

export default function ServiceHistoryModal({
  visible,
  personnel,
  serviceProfile,
  loading,
  onClose,
}: ServiceHistoryModalProps) {
  const formatDate = (date: string | null | undefined) => {
    if (!date) return '-';
    return dayjs(date).format('DD/MM/YYYY');
  };

  const getStatusTag = (status: string | undefined) => {
    if (status === 'DA_NHAN') {
      return <Tag color="green">Đã nhận</Tag>;
    } else if (status === 'DU_DIEU_KIEN') {
      return <Tag color="orange">Đủ điều kiện</Tag>;
    } else {
      return <Tag>Chưa đủ điều kiện</Tag>;
    }
  };

  const formatMonths = (months: number | undefined) => {
    if (!months || months === 0) return '0 tháng';
    const years = Math.floor(months / 12);
    const remainingMonths = months % 12;
    if (years > 0 && remainingMonths > 0) {
      return `${years} năm ${remainingMonths} tháng`;
    } else if (years > 0) {
      return `${years} năm`;
    } else {
      return `${remainingMonths} tháng`;
    }
  };

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
            {/* Huy chương Chiến sĩ Vẻ vang */}
            <Title level={5} style={{ marginTop: 0 }}>
              Huy chương Chiến sĩ Vẻ vang (HCCSVV)
            </Title>
            <Descriptions bordered column={1} size="small" style={{ marginBottom: 24 }}>
              <Descriptions.Item label="Hạng Ba">
                <div>
                  {getStatusTag(serviceProfile.hccsvv_hang_ba_status)}
                  {serviceProfile.hccsvv_hang_ba_ngay && (
                    <Text type="secondary" style={{ marginLeft: 8 }}>
                      (Ngày nhận: {formatDate(serviceProfile.hccsvv_hang_ba_ngay)})
                    </Text>
                  )}
                </div>
              </Descriptions.Item>
              <Descriptions.Item label="Hạng Nhì">
                <div>
                  {getStatusTag(serviceProfile.hccsvv_hang_nhi_status)}
                  {serviceProfile.hccsvv_hang_nhi_ngay && (
                    <Text type="secondary" style={{ marginLeft: 8 }}>
                      (Ngày nhận: {formatDate(serviceProfile.hccsvv_hang_nhi_ngay)})
                    </Text>
                  )}
                </div>
              </Descriptions.Item>
              <Descriptions.Item label="Hạng Nhất">
                <div>
                  {getStatusTag(serviceProfile.hccsvv_hang_nhat_status)}
                  {serviceProfile.hccsvv_hang_nhat_ngay && (
                    <Text type="secondary" style={{ marginLeft: 8 }}>
                      (Ngày nhận: {formatDate(serviceProfile.hccsvv_hang_nhat_ngay)})
                    </Text>
                  )}
                </div>
              </Descriptions.Item>
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
          <Text type="secondary">Chưa có dữ liệu lịch sử huy chương chiến sĩ vẻ vang</Text>
        )}
      </Spin>
    </Modal>
  );
}
