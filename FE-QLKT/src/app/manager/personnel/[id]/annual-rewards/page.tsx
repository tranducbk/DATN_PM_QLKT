'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  Card,
  Button,
  Table,
  Modal,
  Space,
  Typography,
  Breadcrumb,
  message,
  ConfigProvider,
  theme as antdTheme,
  Empty,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { LeftOutlined, HomeOutlined } from '@ant-design/icons';
import { apiClient } from '@/lib/apiClient';
import { downloadDecisionFile } from '@/lib/file/downloadDecisionFile';
import { useTheme } from '@/components/ThemeProvider';
import { LoadingState } from '@/components/shared/LoadingState';
import type { PersonnelDetail } from '@/lib/types/personnelList';
import { renderAnnualAwards } from '@/lib/award/awardsHelper';


const { Title, Paragraph } = Typography;

interface RewardRecord {
  id: string;
  nam: number;
  danh_hieu: string;
  cap_bac?: string;
  chuc_vu?: string;
  ghi_chu?: string;
  so_quyet_dinh?: string;
  file_quyet_dinh?: string;
  nhan_bkbqp: boolean;
  so_quyet_dinh_bkbqp?: string;
  file_quyet_dinh_bkbqp?: string;
  nhan_cstdtq: boolean;
  so_quyet_dinh_cstdtq?: string;
  nhan_bkttcp: boolean;
  so_quyet_dinh_bkttcp?: string;
  file_quyet_dinh_cstdtq?: string;
}

export default function ManagerAnnualRewardsPage() {
  const params = useParams();
  const personnelId = params?.id as string;
  const { theme } = useTheme();

  const [loading, setLoading] = useState(true);
  const [personnel, setPersonnel] = useState<PersonnelDetail | null>(null);
  const [rewards, setRewards] = useState<RewardRecord[]>([]);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [personnelRes, rewardsRes] = await Promise.all([
        apiClient.getPersonnelById(personnelId),
        apiClient.getAnnualRewardsByPersonnel(personnelId),
      ]);

      if (personnelRes.success) {
        setPersonnel(personnelRes.data);
      }
      if (rewardsRes.success) {
        setRewards(rewardsRes.data || []);
      }
    } catch (error) {
      message.error('Không thể tải dữ liệu');
    } finally {
      setLoading(false);
    }
  }, [personnelId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      const res = await apiClient.deleteAnnualReward(deleteId);

      if (res.success) {
        message.success('Xóa khen thưởng thành công');
        setDeleteModalOpen(false);
        setDeleteId(null);
        loadData();
      } else {
        message.error(res.message || 'Có lỗi xảy ra khi xóa');
      }
    } catch (error) {
      message.error('Có lỗi xảy ra khi xóa');
    }
  };

  const handleOpenDecisionFile = async (soQuyetDinh: string) => {
    await downloadDecisionFile(soQuyetDinh);
  };

  const columns: ColumnsType<RewardRecord> = [
    {
      title: 'Năm',
      dataIndex: 'nam',
      key: 'nam',
      width: 70,
      align: 'center',
      render: (text: number) => <div style={{ textAlign: 'center' }}>{text || '-'}</div>,
    },
    {
      title: 'Danh hiệu',
      dataIndex: 'danh_hieu',
      key: 'danh_hieu',
      width: 320,
      align: 'center',
      onCell: () => ({
        style: {
          whiteSpace: 'normal',
          wordBreak: 'break-word',
          overflowWrap: 'anywhere',
        },
      }),
      render: (text: string, record: RewardRecord) =>
        renderAnnualAwards(text, record, {
          onDownload: handleOpenDecisionFile,
        }),
    },
    {
      title: 'Chức vụ / Cấp bậc',
      key: 'chuc_vu_cap_bac',
      width: 160,
      align: 'center',
      render: (_: unknown, record: RewardRecord) => (
        <div style={{ textAlign: 'center', wordBreak: 'break-word' }}>
          <div title={record.chuc_vu || '-'}>{record.chuc_vu || '-'}</div>
          <div style={{ fontSize: 12, opacity: 0.75 }} title={record.cap_bac || '-'}>
            {record.cap_bac || '-'}
          </div>
        </div>
      ),
    },
  ];

  return (
    <ConfigProvider
      theme={{
        algorithm: theme === 'dark' ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
      }}
    >
      <div style={{ padding: '24px' }}>
        {/* Breadcrumb */}
        <Breadcrumb style={{ marginBottom: 24 }}>
          <Breadcrumb.Item>
            <Link href="/manager/dashboard">
              <HomeOutlined />
            </Link>
          </Breadcrumb.Item>
          <Breadcrumb.Item>
            <Link href="/manager/personnel">Quân nhân</Link>
          </Breadcrumb.Item>
          <Breadcrumb.Item>
            <Link href={`/manager/personnel/${personnelId}`}>{personnel?.ho_ten}</Link>
          </Breadcrumb.Item>
          <Breadcrumb.Item>Khen thưởng hằng năm</Breadcrumb.Item>
        </Breadcrumb>

        {/* Header */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            marginBottom: 24,
            flexWrap: 'wrap',
            gap: 16,
          }}
        >
          <div>
            <Space style={{ marginBottom: 8 }}>
              <Link href={`/manager/personnel/${personnelId}?tab=3`}>
                <Button icon={<LeftOutlined />}>Quay lại</Button>
              </Link>
            </Space>
            <Title level={2} style={{ marginTop: 8, marginBottom: 8 }}>
              Khen thưởng hằng năm
            </Title>
            {personnel && (
              <Paragraph type="secondary" style={{ fontSize: 14, marginBottom: 0 }}>
                Quân nhân: {personnel.ho_ten}
              </Paragraph>
            )}
          </div>
        </div>

        {/* Table */}
        {loading ? (
          <Card>
            <LoadingState />
          </Card>
        ) : (
          <Card>
            <Table
              columns={columns}
              dataSource={rewards}
              rowKey="id"
              pagination={false}
              tableLayout="fixed"
              scroll={{ x: 720 }}
              locale={{
                emptyText: <Empty description="Chưa có dữ liệu khen thưởng hằng năm" />,
              }}
            />
          </Card>
        )}

        {/* Delete Confirmation Modal */}
        <Modal
          title="Xác nhận xóa"
          open={deleteModalOpen}
          onOk={handleDelete}
          onCancel={() => {
            setDeleteModalOpen(false);
            setDeleteId(null);
          }}
          okText="Xóa"
          cancelText="Hủy"
          okButtonProps={{ danger: true }}
        >
          <Paragraph>
            Bạn có chắc chắn muốn xóa khen thưởng này? Hành động này không thể hoàn tác.
          </Paragraph>
        </Modal>
      </div>
    </ConfigProvider>
  );
}
