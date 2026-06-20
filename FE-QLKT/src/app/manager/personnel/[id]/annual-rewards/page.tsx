'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  Card,
  Button,
  Table,
  Space,
  Typography,
  message,
  ConfigProvider,
  theme as antdTheme,
  Empty,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { LeftOutlined } from '@ant-design/icons';
import { apiClient } from '@/lib/http/apiClient';
import { downloadDecisionFile } from '@/lib/file/downloadDecisionFile';
import { useTheme } from '@/components/ThemeProvider';
import { LoadingState } from '@/components/shared/LoadingState';
import { PageBreadcrumb } from '@/components/shared/PageBreadcrumb';
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
        <PageBreadcrumb
          items={[
            { title: 'Quân nhân', href: '/manager/personnel' },
            { title: personnel?.ho_ten, href: `/manager/personnel/${personnelId}` },
            { title: 'Khen thưởng hằng năm' },
          ]}
        />

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

      </div>
    </ConfigProvider>
  );
}
