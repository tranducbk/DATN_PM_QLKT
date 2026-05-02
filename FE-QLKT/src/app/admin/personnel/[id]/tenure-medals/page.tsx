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
  Tag,
  Empty,
} from 'antd';
import type { TableColumnsType } from 'antd';
import {
  LeftOutlined,
  HomeOutlined,
} from '@ant-design/icons';
import { apiClient } from '@/lib/apiClient';
import { useTheme } from '@/components/ThemeProvider';
import { LoadingState } from '@/components/shared/LoadingState';
import { downloadDecisionFile } from '@/lib/file/downloadDecisionFile';
import { ELIGIBILITY_STATUS } from '@/constants/eligibilityStatus.constants';
import { FETCH_ALL_LIMIT } from '@/constants/pagination.constants';
import type { PersonnelDetail } from '@/lib/types/personnelList';


const { Title, Paragraph } = Typography;

interface ServiceReward {
  id: string;
  type: string;
  name: string;
  nam?: number;
  cap_bac?: string;
  chuc_vu?: string;
  so_quyet_dinh?: string;
  ghi_chu?: string;
  danh_hieu?: string;
  rank?: string;
  status: string;
}

export default function AdminServiceRewardsPage() {
  const params = useParams();
  const personnelId = params?.id as string;
  const { theme } = useTheme();
  const [loading, setLoading] = useState(true);
  const [personnel, setPersonnel] = useState<PersonnelDetail | null>(null);
  const [rewards, setRewards] = useState<ServiceReward[]>([]);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [personnelRes, tenureRes] = await Promise.all([
        apiClient.getPersonnelById(personnelId),
        apiClient.getTenureMedals({ limit: FETCH_ALL_LIMIT }),
      ]);

      if (!personnelRes.success || !personnelRes.data) {
        message.error('Không tìm thấy thông tin quân nhân');
        return;
      }

      setPersonnel(personnelRes.data);


      const mappedRewards: ServiceReward[] = [];

      if (tenureRes.success && tenureRes.data) {
        tenureRes.data.forEach((award: any) => {
          if (award.quan_nhan_id === personnelId || award.QuanNhan?.id === personnelId) {
            const danhHieu = award.danh_hieu || '';
            const rank = danhHieu.includes('HANG_NHAT') ? 'hạng Nhất' : danhHieu.includes('HANG_NHI') ? 'hạng Nhì' : danhHieu.includes('HANG_BA') ? 'hạng Ba' : '';

            mappedRewards.push({
              id: award.id,
              type: 'HCCSVV',
              name: 'Huy chương Chiến sĩ vẻ vang',
              nam: award.nam,
              cap_bac: award.cap_bac,
              chuc_vu: award.chuc_vu,
              so_quyet_dinh: award.so_quyet_dinh,
              ghi_chu: award.ghi_chu,
              danh_hieu: award.danh_hieu,
              rank: rank,
              status: ELIGIBILITY_STATUS.DA_NHAN,
            });
          }
        });
      }

      setRewards(mappedRewards);
    } catch (error) {
      message.error('Không thể tải dữ liệu');
    } finally {
      setLoading(false);
    }
  }, [personnelId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const getStatusTag = (status: string) => {
    const statusMap: Record<string, { label: string; color: string }> = {
      DA_NHAN: { label: 'Đã nhận', color: 'green' },
      DU_DIEU_KIEN: { label: 'Đủ điều kiện', color: 'orange' },
      CHUA_DU: { label: 'Chưa đủ', color: 'default' },
    };
    const s = statusMap[status] || statusMap.CHUA_DU;
    return <Tag color={s.color}>{s.label}</Tag>;
  };

  const handleOpenDecisionFile = async (soQuyetDinh: string) => {
    await downloadDecisionFile(soQuyetDinh);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      // Note: This would need actual API endpoint
      message.success('Xóa khen thưởng thành công');
      setDeleteModalOpen(false);
      setDeleteId(null);
      loadData();
    } catch (error) {
      message.error('Có lỗi xảy ra khi xóa');
    }
  };

  const columns: TableColumnsType<ServiceReward> = [
    {
      title: 'Tên khen thưởng',
      dataIndex: 'name',
      key: 'name',
      width: 220,
      minWidth: 180,
      fixed: 'left',
      render: (name: string, record: ServiceReward) => (
        <div>
          <div style={{ fontWeight: 500 }}>{name}</div>
          {record.rank && (
            <div style={{ fontSize: '12px', color: '#8c8c8c' }}>Hạng: {record.rank}</div>
          )}
        </div>
      ),
    },
    {
      title: 'Tháng/Năm',
      key: 'thang_nam',
      width: 100,
      minWidth: 90,
      align: 'center',
      render: (_: unknown, record: any) =>
        record.thang && record.nam ? `${record.thang}/${record.nam}` : record.nam || '-',
    },
    {
      title: 'Cấp bậc',
      dataIndex: 'cap_bac',
      key: 'cap_bac',
      width: 120,
      minWidth: 100,
      align: 'center',
      render: (capBac: string) => capBac || '-',
    },
    {
      title: 'Chức vụ',
      dataIndex: 'chuc_vu',
      key: 'chuc_vu',
      width: 150,
      minWidth: 120,
      align: 'center',
      ellipsis: true,
      render: (chucVu: string) => chucVu || '-',
    },
    {
      title: 'Số quyết định',
      dataIndex: 'so_quyet_dinh',
      key: 'so_quyet_dinh',
      width: 140,
      minWidth: 120,
      align: 'center',
      render: (soQuyetDinh: string, record: ServiceReward) => {
        if (!soQuyetDinh || soQuyetDinh.trim() === '') {
          return <span>Chưa có</span>;
        }
        return (
          <a
            onClick={e => {
              e.preventDefault();
              e.stopPropagation();
              handleOpenDecisionFile(soQuyetDinh);
            }}
            className="text-green-600 dark:text-green-400 font-medium underline cursor-pointer"
          >
            {soQuyetDinh}
          </a>
        );
      },
    },
    {
      title: 'Ghi chú',
      dataIndex: 'ghi_chu',
      key: 'ghi_chu',
      width: 200,
      minWidth: 150,
      ellipsis: true,
      render: (ghiChu: string) => ghiChu || '-',
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      minWidth: 100,
      align: 'center',
      fixed: 'right',
      render: (status: string) => getStatusTag(status),
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
            <Link href="/admin/dashboard">
              <HomeOutlined />
            </Link>
          </Breadcrumb.Item>
          <Breadcrumb.Item>
            <Link href="/admin/personnel">Quân nhân</Link>
          </Breadcrumb.Item>
          <Breadcrumb.Item>
            <Link href={`/admin/personnel/${personnelId}`}>{personnel?.ho_ten}</Link>
          </Breadcrumb.Item>
          <Breadcrumb.Item>Huy chương Chiến sĩ vẻ vang</Breadcrumb.Item>
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
              <Link href={`/admin/personnel/${personnelId}?tab=3`}>
                <Button icon={<LeftOutlined />}>Quay lại</Button>
              </Link>
            </Space>
            <Title level={2} style={{ marginTop: 8, marginBottom: 8 }}>
              Huy chương Chiến sĩ vẻ vang
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
              scroll={{ x: 'max-content' }}
              size="small"
              locale={{
                emptyText: <Empty description="Chưa có dữ liệu Huy chương Chiến sĩ vẻ vang" />,
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
