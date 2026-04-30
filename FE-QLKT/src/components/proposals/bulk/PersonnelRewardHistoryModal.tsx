'use client';

import { Modal, Button, Descriptions, Tabs, Table, Tag, Typography, message } from 'antd';
import { HistoryOutlined, DownloadOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { previewFileWithApi } from '@/lib/file/filePreview';

const { Text } = Typography;

interface Personnel {
  id: string;
  ho_ten: string;
  ngay_sinh?: string | null;
}

interface AnnualProfile {
  tong_cstdcs?: number;
  tong_nckh?: number;
  tong_cstdcs_json?: any[];
  tong_nckh_json?: any[];
  cstdcs_lien_tuc?: number;
  nckh_lien_tuc?: number;
  bkbqp_lien_tuc?: number;
  cstdtq_lien_tuc?: number;
  du_dieu_kien_bkbqp?: boolean;
  du_dieu_kien_cstdtq?: boolean;
  du_dieu_kien_bkttcp?: boolean;
  goi_y?: string | null;
}

interface PersonnelRewardHistoryModalProps {
  visible: boolean;
  personnel: Personnel | null;
  annualProfile: AnnualProfile | null;
  loading: boolean;
  onClose: () => void;
}

export function PersonnelRewardHistoryModal({
  visible,
  personnel,
  annualProfile,
  loading,
  onClose,
}: PersonnelRewardHistoryModalProps) {
  // Fall back to legacy scalar fields if JSON detail fields are absent (backward compatibility)
  const tongCstdcs =
    annualProfile?.tong_cstdcs_json && Array.isArray(annualProfile.tong_cstdcs_json)
      ? annualProfile.tong_cstdcs_json
      : annualProfile?.tong_cstdcs && Array.isArray(annualProfile.tong_cstdcs)
        ? annualProfile.tong_cstdcs
        : [];
  const tongNckh =
    annualProfile?.tong_nckh_json && Array.isArray(annualProfile.tong_nckh_json)
      ? annualProfile.tong_nckh_json
      : annualProfile?.tong_nckh && Array.isArray(annualProfile.tong_nckh)
        ? annualProfile.tong_nckh
        : [];

  const hasData = tongCstdcs.length > 0 || tongNckh.length > 0;

  const handlePreviewFile = async (filePath: string, soQuyetDinh: string) => {
    if (!filePath) {
      message.warning('Không có file quyết định');
      return;
    }
    // Extract filename from path (uploads/decisions/filename.pdf -> filename.pdf)
    const filename = filePath.split('/').pop() || 'quyet-dinh.pdf';
    await previewFileWithApi(
      `/api/annual-rewards/decision-files/${filename}`,
      `${soQuyetDinh}.pdf`
    );
  };

  const cstdcsColumns: ColumnsType<any> = [
    {
      title: 'Năm',
      dataIndex: 'nam',
      key: 'nam',
      width: 100,
      align: 'center',
    },
    {
      title: 'Danh hiệu',
      dataIndex: 'danh_hieu',
      key: 'danh_hieu',
      width: 200,
      align: 'center',
      render: text => {
        if (!text) return <Text type="secondary">-</Text>;
        const map: Record<string, string> = {
          CSTDCS: 'Chiến sĩ thi đua cơ sở',
          CSTT: 'Chiến sĩ tiên tiến',
          BKBQP: 'Bằng khen Bộ Quốc phòng',
          CSTDTQ: 'Chiến sĩ thi đua toàn quân',
        };
        return map[text] || text;
      },
    },
    {
      title: 'Số quyết định',
      key: 'so_quyet_dinh',
      width: 200,
      align: 'center',
      render: (_, record) => {
        const items = [];
        const danhHieu = record.danh_hieu;
        const soQD = record.so_quyet_dinh;
        const file = record.file_quyet_dinh;

        if (soQD && danhHieu) {
          items.push(
            <div key={danhHieu}>
              <Text
                className={`text-xs ${
                  file
                    ? 'cursor-pointer text-blue-500 dark:text-blue-400 underline'
                    : 'cursor-default no-underline'
                }`}
                onClick={() => file && handlePreviewFile(file, soQD)}
              >
                {danhHieu}: {soQD}
                {file && <DownloadOutlined style={{ marginLeft: '4px' }} />}
              </Text>
            </div>
          );
        }

        const chainAwards = [
          { key: 'bkbqp', label: 'BKBQP', flag: record.nhan_bkbqp, qd: record.so_quyet_dinh_bkbqp, file: record.file_quyet_dinh_bkbqp },
          { key: 'cstdtq', label: 'CSTDTQ', flag: record.nhan_cstdtq, qd: record.so_quyet_dinh_cstdtq, file: record.file_quyet_dinh_cstdtq },
          { key: 'bkttcp', label: 'BKTTCP', flag: record.nhan_bkttcp, qd: record.so_quyet_dinh_bkttcp, file: record.file_quyet_dinh_bkttcp },
        ];

        for (const award of chainAwards) {
          if (!award.flag && !award.qd) continue;
          items.push(
            <div key={award.key}>
              <Text
                className={`text-xs ${
                  award.file
                    ? 'cursor-pointer text-blue-500 dark:text-blue-400 underline'
                    : 'cursor-default no-underline'
                }`}
                onClick={() => award.file && handlePreviewFile(award.file, award.qd || award.label)}
              >
                {award.label}: {award.qd || 'Chưa có số QĐ'}
                {award.file && <DownloadOutlined style={{ marginLeft: '4px' }} />}
              </Text>
            </div>
          );
        }

        if (items.length > 0) {
          return (
            <div
              style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'center' }}
            >
              {items}
            </div>
          );
        }
        return <Text type="secondary">-</Text>;
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
      title: 'Nhận CSTDTQ',
      dataIndex: 'nhan_cstdtq',
      key: 'nhan_cstdtq',
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
  ];

  const nckhColumns: ColumnsType<any> = [
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
      width: 150,
      align: 'center',
      render: text => {
        const map: Record<string, string> = {
          NCKH: 'Đề tài khoa học',
          DTKH: 'Đề tài khoa học',
          SKKH: 'Sáng kiến khoa học',
        };
        return map[text] || text;
      },
    },
    {
      title: 'Mô tả',
      dataIndex: 'mo_ta',
      key: 'mo_ta',
      align: 'left',
    },
    {
      title: 'Số quyết định',
      key: 'so_quyet_dinh',
      width: 180,
      align: 'center',
      render: (_, record) => {
        const soQD = record.so_quyet_dinh;
        const filePath = record.file_quyet_dinh;

        if (soQD) {
          return (
            <Text
              className={`flex items-center justify-center gap-1 ${
                filePath
                  ? 'cursor-pointer text-blue-500 dark:text-blue-400 underline'
                  : 'cursor-default no-underline'
              }`}
              onClick={() => filePath && handlePreviewFile(filePath, soQD)}
            >
              {soQD}
              {filePath && <DownloadOutlined />}
            </Text>
          );
        }
        return <Text type="secondary">-</Text>;
      },
    },
  ];

  return (
    <Modal
      title={
        <span>
          <HistoryOutlined /> Lịch sử khen thưởng - {personnel?.ho_ten || 'N/A'}
        </span>
      }
      open={visible}
      onCancel={onClose}
      footer={[
        <Button key="close" onClick={onClose}>
          Đóng
        </Button>,
      ]}
      width="min(1200px, calc(100vw - 32px))"
      loading={loading}
      centered
      style={{ top: 20 }}
      styles={{
        body: {
          maxHeight: 'calc(100vh - 200px)',
          overflowY: 'auto',
          padding: '24px',
        },
      }}
      className="personnel-reward-history-modal"
    >
      {loading && (
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <Text type="secondary">Đang tải dữ liệu...</Text>
        </div>
      )}
      {!loading && !hasData && (
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <Text type="secondary" style={{ fontSize: '16px' }}>
            Lịch sử khen thưởng trống
          </Text>
        </div>
      )}
      {!loading && hasData && (
        <div>
          <Descriptions
            title="Tóm tắt hồ sơ hằng năm"
            bordered
            column={2}
            style={{ marginBottom: 24 }}
          >
            <Descriptions.Item label="Tổng CSTDCS">{tongCstdcs.length} năm</Descriptions.Item>
            <Descriptions.Item label="Tổng NCKH">{tongNckh.length}</Descriptions.Item>
            <Descriptions.Item label="CSTDCS liên tục">
              {annualProfile?.cstdcs_lien_tuc || 0} năm
            </Descriptions.Item>
            <Descriptions.Item label="BKBQP liên tục">
              {annualProfile?.bkbqp_lien_tuc || 0} lần
            </Descriptions.Item>
            <Descriptions.Item label="CSTDTQ liên tục">
              {annualProfile?.cstdtq_lien_tuc || 0} lần
            </Descriptions.Item>
            <Descriptions.Item label="Đủ điều kiện BKBQP">
              {annualProfile?.du_dieu_kien_bkbqp ? <Tag color="green">Có</Tag> : <Tag>Chưa đủ</Tag>}
            </Descriptions.Item>
            <Descriptions.Item label="Đủ điều kiện CSTDTQ">
              {annualProfile?.du_dieu_kien_cstdtq ? (
                <Tag color="green">Có</Tag>
              ) : (
                <Tag>Chưa đủ</Tag>
              )}
            </Descriptions.Item>
            <Descriptions.Item label="Đủ điều kiện BKTTCP">
              {annualProfile?.du_dieu_kien_bkttcp ? <Tag color="gold">Có</Tag> : <Tag>Chưa đủ</Tag>}
            </Descriptions.Item>
            <Descriptions.Item label="Gợi ý" span={2}>
              <Text type="secondary" style={{ whiteSpace: 'pre-wrap' }}>
                {annualProfile?.goi_y || '-'}
              </Text>
            </Descriptions.Item>
          </Descriptions>

          <Tabs
            items={[
              {
                key: 'cstdcs',
                label: `Danh hiệu (${tongCstdcs.length})`,
                children: (
                  <div>
                    {tongCstdcs.length > 0 ? (
                      <Table
                        dataSource={tongCstdcs}
                        rowKey={(record, index) => `${record.nam}-${index}`}
                        pagination={false}
                        size="small"
                        columns={cstdcsColumns}
                        className="reward-history-table"
                        bordered
                        scroll={{ x: 'max-content' }}
                      />
                    ) : (
                      <Text type="secondary">Chưa có danh hiệu</Text>
                    )}
                  </div>
                ),
              },
              {
                key: 'nckh',
                label: `NCKH (${tongNckh.length})`,
                children: (
                  <div>
                    {tongNckh.length > 0 ? (
                      <Table
                        dataSource={tongNckh}
                        rowKey={(record, index) => `${record.nam}-${index}`}
                        pagination={false}
                        size="small"
                        columns={nckhColumns}
                        className="reward-history-table"
                        bordered
                        scroll={{ x: 'max-content' }}
                      />
                    ) : (
                      <Text type="secondary">Chưa có thành tích NCKH</Text>
                    )}
                  </div>
                ),
              },
            ]}
          />
        </div>
      )}
    </Modal>
  );
}
