'use client';

import { Modal, Table, Tag, Spin, Descriptions, Empty, Typography } from 'antd';
import { HistoryOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { downloadDecisionFile } from '@/lib/file/downloadDecisionFile';
import { getDanhHieuName } from '@/constants/danhHieu.constants';

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

export interface UnitAnnualAwards {
  tong_dvqt?: number;
  dvqt_lien_tuc?: number;
  du_dieu_kien_bkbqp?: boolean;
  du_dieu_kien_bkttcp?: boolean;
  tong_dvqt_json?: UnitAnnualAward[];
  goi_y?: string | null;
}

interface UnitAnnualAwardHistoryModalProps {
  visible: boolean;
  unit: Unit | null;
  annualAwards: UnitAnnualAwards | null;
  loading: boolean;
  onClose: () => void;
}

export function UnitAnnualAwardHistoryModal({
  visible,
  unit,
  annualAwards,
  loading,
  onClose,
}: UnitAnnualAwardHistoryModalProps) {
  const handleOpenDecisionFile = async (soQuyetDinh: string) => {
    await downloadDecisionFile(soQuyetDinh);
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
      width: 180,
      align: 'center',
      render: (text: string | null) => {
        if (!text) return <Text type="secondary">-</Text>;
        return getDanhHieuName(text);
      },
    },
    {
      title: 'Số quyết định',
      key: 'so_quyet_dinh',
      width: 220,
      align: 'center',
      render: (_, record) => {
        const items: Array<{ label: string; soQuyetDinh: string | null }> = [];

        if (record.danh_hieu && record.so_quyet_dinh) {
          items.push({
            label: `${record.danh_hieu}: ${record.so_quyet_dinh}`,
            soQuyetDinh: record.so_quyet_dinh,
          });
        }

        const chainAwards = [
          { label: 'BKBQP', qd: record.so_quyet_dinh_bkbqp },
          { label: 'BKTTCP', qd: record.so_quyet_dinh_bkttcp },
        ];

        for (const award of chainAwards) {
          if (!award.qd) continue;
          items.push({
            label: `${award.label}: ${award.qd}`,
            soQuyetDinh: award.qd,
          });
        }

        if (items.length === 0) return <Text type="secondary">-</Text>;

        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'center' }}>
            {items.map((d, i) =>
              d.soQuyetDinh ? (
                <a
                  key={i}
                  onClick={() => handleOpenDecisionFile(d.soQuyetDinh!)}
                  className="text-green-600 dark:text-green-400 cursor-pointer underline text-xs"
                >
                  {d.label}
                </a>
              ) : (
                <span key={i} className="text-xs">
                  {d.label}
                </span>
              )
            )}
          </div>
        );
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
  ];

  const records = annualAwards?.tong_dvqt_json ?? [];
  const bkbqpCount = records.filter(r => r.nhan_bkbqp).length;
  const bkttcpCount = records.filter(r => r.nhan_bkttcp).length;

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
      width="min(1000px, calc(100vw - 32px))"
      centered
    >
      <Spin spinning={loading}>
        {annualAwards && annualAwards.tong_dvqt_json && annualAwards.tong_dvqt_json.length > 0 ? (
          <div>
            <Descriptions
              title="Tóm tắt hồ sơ đơn vị hằng năm"
              bordered
              column={2}
              size="small"
              style={{ marginBottom: 16 }}
            >
              <Descriptions.Item label="Tổng số Đơn vị Quyết thắng">
                {annualAwards?.tong_dvqt || 0} năm
              </Descriptions.Item>
              <Descriptions.Item label="ĐVQT liên tục">
                {annualAwards?.dvqt_lien_tuc || 0} năm
              </Descriptions.Item>
              <Descriptions.Item label="Số lần đã nhận BKBQP">
                {bkbqpCount} lần
              </Descriptions.Item>
              <Descriptions.Item label="Số lần đã nhận BKTTCP">
                {bkttcpCount} lần
              </Descriptions.Item>
              <Descriptions.Item label="Đủ điều kiện BK của Bộ trưởng Bộ Quốc phòng">
                {annualAwards?.du_dieu_kien_bkbqp ? (
                  <Tag color="green">Có</Tag>
                ) : (
                  <Tag>Chưa đủ</Tag>
                )}
              </Descriptions.Item>
              <Descriptions.Item label="Đủ điều kiện BK của Thủ tướng Chính phủ">
                {annualAwards?.du_dieu_kien_bkttcp ? (
                  <Tag color="gold">Có</Tag>
                ) : (
                  <Tag>Chưa đủ</Tag>
                )}
              </Descriptions.Item>
              <Descriptions.Item label="Gợi ý" span={2}>
                <Text type="secondary" style={{ whiteSpace: 'pre-wrap' }}>
                  {annualAwards?.goi_y || '-'}
                </Text>
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
          <Empty description="Chưa có dữ liệu lịch sử khen thưởng đơn vị" style={{ padding: '24px 0' }} />
        )}
      </Spin>
    </Modal>
  );
}
