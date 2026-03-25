'use client';

import { Modal, Table, Tag, Typography, Spin, Descriptions } from 'antd';
import { HistoryOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import { apiClient } from '@/lib/api-client';
import { previewFileWithApi } from '@/utils/filePreview';
import { message } from 'antd';
import { getApiErrorMessage } from '@/lib/apiError';

const { Text } = Typography;

interface Unit {
  id: string;
  ten_don_vi: string;
  ma_don_vi?: string;
}

interface UnitAnnualAward {
  nam: number;
  danh_hieu: string;
  so_quyet_dinh?: string | null;
  file_quyet_dinh?: string | null;
  nhan_bkbqp?: boolean;
  nhan_bkttcp?: boolean;
  so_quyet_dinh_bkbqp?: string | null;
  file_quyet_dinh_bkbqp?: string | null;
  so_quyet_dinh_bkttcp?: string | null;
  file_quyet_dinh_bkttcp?: string | null;
}

interface UnitAnnualAwardHistoryModalProps {
  visible: boolean;
  unit: Unit | null;
  annualAwards: any;
  loading: boolean;
  onClose: () => void;
}

export default function UnitAnnualAwardHistoryModal({
  visible,
  unit,
  annualAwards,
  loading,
  onClose,
}: UnitAnnualAwardHistoryModalProps) {
  const handleOpenDecisionFile = async (soQuyetDinh: string) => {
    try {
      message.loading({ content: 'Đang tải file...', key: 'preview' });

      // Luôn query từ DB để lấy file path mới nhất
      const response = await apiClient.getDecisionFilePath(soQuyetDinh);

      if (!response.success || !response.data?.file_path) {
        message.warning({ content: 'Không tìm thấy file quyết định', key: 'preview' });
        return;
      }

      const filePath = response.data.file_path;
      const filename = filePath.split('/').pop() || `${soQuyetDinh}.pdf`;

      message.destroy('preview');
      await previewFileWithApi(`/${filePath}`, filename);
    } catch (error: unknown) {
      // Error handled by UI message
      const errorMessage =
        getApiErrorMessage(error) || 'Lỗi khi mở file quyết định';
      message.error({ content: errorMessage, key: 'preview' });
    }
  };

  const columns: ColumnsType<UnitAnnualAward> = [
    {
      title: 'Năm',
      dataIndex: 'nam',
      key: 'nam',
      width: 100,
      align: 'center',
      sorter: (a, b) => b.nam - a.nam,
      defaultSortOrder: 'descend',
    },
    {
      title: 'Danh hiệu',
      dataIndex: 'danh_hieu',
      key: 'danh_hieu',
      width: 150,
      align: 'center',
      render: (text: string) => {
        const map: Record<string, string> = {
          ĐVQT: 'Đơn vị quyết thắng',
          ĐVTT: 'Đơn vị tiên tiến',
        };
        return map[text] || text;
      },
    },
    {
      title: 'Nhận BKBQP',
      dataIndex: 'nhan_bkbqp',
      key: 'nhan_bkbqp',
      width: 120,
      align: 'center',
      render: value => (value ? <Tag color="green">Có</Tag> : <Tag>Không</Tag>),
    },
    {
      title: 'Nhận BKTTCP',
      dataIndex: 'nhan_bkttcp',
      key: 'nhan_bkttcp',
      width: 120,
      align: 'center',
      render: value => (value ? <Tag color="green">Có</Tag> : <Tag>Không</Tag>),
    },
    {
      title: 'Số quyết định',
      key: 'so_quyet_dinh',
      width: 200,
      align: 'center',
      render: (_, record) => {
        const decisions = [];

        if (record.so_quyet_dinh) {
          decisions.push({
            label: record.so_quyet_dinh,
            soQuyetDinh: record.so_quyet_dinh,
            filePath: record.file_quyet_dinh,
          });
        }

        if (record.so_quyet_dinh_bkbqp) {
          decisions.push({
            label: `BKBQP: ${record.so_quyet_dinh_bkbqp}`,
            soQuyetDinh: record.so_quyet_dinh_bkbqp,
            filePath: record.file_quyet_dinh_bkbqp,
          });
        }

        if (record.so_quyet_dinh_bkttcp) {
          decisions.push({
            label: `BKTTCP: ${record.so_quyet_dinh_bkttcp}`,
            soQuyetDinh: record.so_quyet_dinh_bkttcp,
            filePath: record.file_quyet_dinh_bkttcp,
          });
        }

        return decisions.length > 0 ? (
          <div style={{ textAlign: 'center' }}>
            {decisions.map((d, i) => (
              <div key={i} style={{ textAlign: 'center' }}>
                {d.soQuyetDinh ? (
                  <a
                    onClick={() => handleOpenDecisionFile(d.soQuyetDinh)}
                    style={{ color: '#52c41a', cursor: 'pointer', textDecoration: 'underline' }}
                  >
                    {d.label}
                  </a>
                ) : (
                  <span style={{ color: '#999' }}>{d.label}</span>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div style={{ textAlign: 'center' }}>-</div>
        );
      },
    },
  ];

  return (
    <Modal
      title={
        <span>
          <HistoryOutlined style={{ marginRight: 8 }} />
          Lịch sử khen thưởng đơn vị hằng năm - {unit?.ten_don_vi}
        </span>
      }
      open={visible}
      onCancel={onClose}
      footer={null}
      width={1000}
      centered
    >
      <Spin spinning={loading}>
        {annualAwards && annualAwards.tong_dvqt_json && annualAwards.tong_dvqt_json.length > 0 ? (
          <div>
            <Descriptions bordered column={1} size="small" style={{ marginBottom: 16 }}>
              <Descriptions.Item label="Tổng số danh hiệu Đơn vị Quyết thắng">
                <Tag color="green" style={{ fontSize: '14px', padding: '4px 12px' }}>
                  {annualAwards?.tong_dvqt || 0} năm
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Số năm liên tục Đơn vị Quyết thắng">
                <Tag color="blue" style={{ fontSize: '14px', padding: '4px 12px' }}>
                  {annualAwards?.dvqt_lien_tuc || 0} năm
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Đủ điều kiện BK của Bộ trưởng Bộ Quốc phòng">
                <Tag
                  color={annualAwards?.du_dieu_kien_bk_tong_cuc ? 'green' : 'default'}
                  style={{ fontSize: '14px', padding: '4px 12px' }}
                >
                  {annualAwards?.du_dieu_kien_bk_tong_cuc ? 'Có' : 'Không'}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Đủ điều kiện BK của Thủ tướng Chính phủ">
                <Tag
                  color={annualAwards?.du_dieu_kien_bk_thu_tuong ? 'green' : 'default'}
                  style={{ fontSize: '14px', padding: '4px 12px' }}
                >
                  {annualAwards?.du_dieu_kien_bk_thu_tuong ? 'Có' : 'Không'}
                </Tag>
              </Descriptions.Item>
            </Descriptions>
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <Table
                columns={columns}
                dataSource={annualAwards?.tong_dvqt_json}
                rowKey={(record, index) => `${record.nam}-${index}`}
                pagination={false}
                size="small"
                scroll={{ x: 900 }}
              />
            </div>
          </div>
        ) : (
          <Text type="secondary">Chưa có dữ liệu lịch sử khen thưởng đơn vị</Text>
        )}
      </Spin>
    </Modal>
  );
}
