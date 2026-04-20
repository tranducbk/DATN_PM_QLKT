'use client';

import { useState, useEffect } from 'react';
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
  Spin,
  ConfigProvider,
  theme as antdTheme,
  Tag,
  Empty,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { LeftOutlined, HomeOutlined } from '@ant-design/icons';
import { apiClient } from '@/lib/apiClient';
import { downloadDecisionFile } from '@/utils/downloadDecisionFile';
import { useTheme } from '@/components/ThemeProvider';
import type { PersonnelDetail } from '@/lib/types/personnelList';


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

  useEffect(() => {
    loadData();
  }, [personnelId]);

  async function loadData() {
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
  }

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
      width: 80,
      align: 'center',
    },
    {
      title: 'Danh hiệu',
      dataIndex: 'danh_hieu',
      key: 'danh_hieu',
      width: 150,
      align: 'center',
      ellipsis: true,
      render: (text: string) => (
        <div style={{ textAlign: 'center' }} title={text}>
          {text || '-'}
        </div>
      ),
    },
    {
      title: 'Cấp bậc',
      dataIndex: 'cap_bac',
      key: 'cap_bac',
      width: 100,
      align: 'center',
      ellipsis: true,
      render: (text: string) => (
        <div style={{ textAlign: 'center' }} title={text}>
          {text || '-'}
        </div>
      ),
    },
    {
      title: 'Chức vụ',
      dataIndex: 'chuc_vu',
      key: 'chuc_vu',
      width: 140,
      align: 'center',
      ellipsis: true,
      render: (text: string) => (
        <div style={{ textAlign: 'center' }} title={text}>
          {text || '-'}
        </div>
      ),
    },
    {
      title: 'Ghi chú',
      dataIndex: 'ghi_chu',
      key: 'ghi_chu',
      width: 150,
      ellipsis: true,
      align: 'center',
      render: (text: string) => (
        <div style={{ textAlign: 'center' }} title={text}>
          {text ? (
            text
          ) : (
            <span style={{ fontStyle: 'italic', opacity: 0.6 }}>Không có ghi chú</span>
          )}
        </div>
      ),
    },
    {
      title: 'Nhận BKBQP',
      dataIndex: 'nhan_bkbqp',
      key: 'nhan_bkbqp',
      width: 120,
      align: 'center',
      render: (value: boolean) => (value ? <Tag color="green">Có</Tag> : <Tag>Không</Tag>),
    },
    {
      title: 'Nhận CSTDTQ',
      dataIndex: 'nhan_cstdtq',
      key: 'nhan_cstdtq',
      width: 120,
      align: 'center',
      render: (value: boolean) => (value ? <Tag color="green">Có</Tag> : <Tag>Không</Tag>),
    },
    {
      title: 'Nhận BKTTCP',
      dataIndex: 'nhan_bkttcp',
      key: 'nhan_bkttcp',
      width: 120,
      align: 'center',
      render: (value: boolean) => (value ? <Tag color="green">Có</Tag> : <Tag>Không</Tag>),
    },
    {
      title: 'Số quyết định',
      dataIndex: 'so_quyet_dinh',
      key: 'so_quyet_dinh',
      width: 200,
      align: 'center',
      render: (text: string, record: RewardRecord) => {
        const items = [];

        if (record.so_quyet_dinh) {
          items.push(
            <div key="general" style={{ textAlign: 'center' }}>
              {record.so_quyet_dinh.trim() !== '' ? (
                <a
                  onClick={e => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleOpenDecisionFile(record.so_quyet_dinh!);
                  }}
                  style={{
                    color: '#52c41a',
                    fontWeight: 500,
                    textDecoration: 'underline',
                    cursor: 'pointer',
                  }}
                >
                  {record.so_quyet_dinh}
                </a>
              ) : (
                <span style={{ fontWeight: 400 }}>Chưa có</span>
              )}
            </div>
          );
        }
        if (record.nhan_bkbqp || record.so_quyet_dinh_bkbqp) {
          items.push(
            <div key="bkbqp" style={{ textAlign: 'center' }}>
              BKBQP:{' '}
              {record.so_quyet_dinh_bkbqp && record.so_quyet_dinh_bkbqp.trim() !== '' ? (
                <a
                  onClick={e => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleOpenDecisionFile(record.so_quyet_dinh_bkbqp!);
                  }}
                  style={{
                    color: '#52c41a',
                    fontWeight: 500,
                    textDecoration: 'underline',
                    cursor: 'pointer',
                  }}
                >
                  {record.so_quyet_dinh_bkbqp}
                </a>
              ) : (
                <span style={{ fontWeight: 400 }}>Chưa có</span>
              )}
            </div>
          );
        }

        if (record.nhan_cstdtq || record.so_quyet_dinh_cstdtq) {
          items.push(
            <div key="cstdtq" style={{ textAlign: 'center' }}>
              CSTDTQ:{' '}
              {record.so_quyet_dinh_cstdtq && record.so_quyet_dinh_cstdtq.trim() !== '' ? (
                <a
                  onClick={e => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleOpenDecisionFile(record.so_quyet_dinh_cstdtq!);
                  }}
                  style={{
                    color: '#52c41a',
                    fontWeight: 500,
                    textDecoration: 'underline',
                    cursor: 'pointer',
                  }}
                >
                  {record.so_quyet_dinh_cstdtq}
                </a>
              ) : (
                <span style={{ fontWeight: 400 }}>Chưa có</span>
              )}
            </div>
          );
        }

        if (record.nhan_bkttcp || record.so_quyet_dinh_bkttcp) {
          items.push(
            <div key="bkttcp" style={{ textAlign: 'center' }}>
              BKTTCP:{' '}
              {record.so_quyet_dinh_bkttcp && record.so_quyet_dinh_bkttcp.trim() !== '' ? (
                <a
                  onClick={e => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleOpenDecisionFile(record.so_quyet_dinh_bkttcp!);
                  }}
                  style={{
                    color: '#52c41a',
                    fontWeight: 500,
                    textDecoration: 'underline',
                    cursor: 'pointer',
                  }}
                >
                  {record.so_quyet_dinh_bkttcp}
                </a>
              ) : (
                <span style={{ fontWeight: 400 }}>Chưa có</span>
              )}
            </div>
          );
        }

        return items.length > 0 ? (
          <div style={{ textAlign: 'center' }}>{items}</div>
        ) : (
          <div style={{ textAlign: 'center' }}>-</div>
        );
      },
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
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <Spin size="large" />
              <div style={{ marginTop: 16 }}>Đang tải dữ liệu...</div>
            </div>
          </Card>
        ) : (
          <Card>
            <Table
              columns={columns}
              dataSource={rewards}
              rowKey="id"
              pagination={false}
              scroll={{ x: 950 }}
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
