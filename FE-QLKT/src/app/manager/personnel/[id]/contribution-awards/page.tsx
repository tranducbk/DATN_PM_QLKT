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
import type { TableColumnsType } from 'antd';
import { LeftOutlined, HomeOutlined } from '@ant-design/icons';
import { apiClient } from '@/lib/apiClient';
import { useTheme } from '@/components/ThemeProvider';
import { downloadDecisionFile } from '@/utils/downloadDecisionFile';
import { ELIGIBILITY_STATUS } from '@/constants/eligibilityStatus.constants';

const { Title, Paragraph } = Typography;

interface ContributionAward {
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

export default function ManagerContributionAwardsPage() {
  const params = useParams();
  const personnelId = params?.id as string;
  const { theme } = useTheme();
  const [loading, setLoading] = useState(true);
  const [personnel, setPersonnel] = useState<any>(null);
  const [awards, setAwards] = useState<ContributionAward[]>([]);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, [personnelId]);

  async function loadData() {
    try {
      setLoading(true);
      const [personnelRes, contributionRes] = await Promise.all([
        apiClient.getPersonnelById(personnelId),
        apiClient.getContributionAwards({ limit: 1000 }),
      ]);

      if (!personnelRes.success || !personnelRes.data) {
        message.error('Không tìm thấy thông tin quân nhân');
        return;
      }

      setPersonnel(personnelRes.data);

      // Lấy dữ liệu từ API Contribution Awards (HCBVTQ) - lấy tất cả và filter theo personnelId

      const mappedAwards: ContributionAward[] = [];

      // Lấy dữ liệu từ API Contribution Awards (HCBVTQ) và filter theo personnelId
      if (contributionRes.success && contributionRes.data) {
        contributionRes.data.forEach((award: any) => {
          // Kiểm tra cả quan_nhan_id trực tiếp và QuanNhan.id
          const awardPersonnelId = award.quan_nhan_id || award.QuanNhan?.id;
          if (awardPersonnelId === personnelId) {
            const danhHieu = award.danh_hieu || '';
            let rank = '';
            if (danhHieu.includes('HANG_BA')) rank = 'Hạng Ba';
            else if (danhHieu.includes('HANG_NHI')) rank = 'Hạng Nhì';
            else if (danhHieu.includes('HANG_NHAT')) rank = 'Hạng Nhất';

            mappedAwards.push({
              id: award.id,
              type: 'HCBVTQ',
              name: `Huân chương Bảo vệ Tổ quốc ${rank}`,
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

      setAwards(mappedAwards);
    } catch (error) {
      message.error('Không thể tải dữ liệu');
    } finally {
      setLoading(false);
    }
  }

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
      message.success('Xóa Huân chương Bảo vệ Tổ quốc thành công');
      setDeleteModalOpen(false);
      setDeleteId(null);
      loadData();
    } catch (error) {
      message.error('Có lỗi xảy ra khi xóa');
    }
  };

  const columns: TableColumnsType<ContributionAward> = [
    {
      title: 'Tên khen thưởng',
      dataIndex: 'name',
      key: 'name',
      width: 220,
      minWidth: 180,
      fixed: 'left',
      render: (name: string, record: ContributionAward) => (
        <div>
          <div style={{ fontWeight: 500 }}>{name}</div>
          {record.rank && (
            <div style={{ fontSize: '12px', color: '#8c8c8c' }}>Hạng: {record.rank}</div>
          )}
        </div>
      ),
    },
    {
      title: 'Năm',
      dataIndex: 'nam',
      key: 'nam',
      width: 80,
      minWidth: 70,
      align: 'center',
      render: (nam: number) => nam || '-',
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
      render: (soQuyetDinh: string) => {
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
            style={{
              color: '#52c41a',
              fontWeight: 500,
              textDecoration: 'underline',
              cursor: 'pointer',
            }}
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
          <Breadcrumb.Item>Huân chương Bảo vệ Tổ quốc</Breadcrumb.Item>
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
              Huân chương Bảo vệ Tổ quốc
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
              dataSource={awards}
              rowKey="id"
              pagination={false}
              scroll={{ x: 'max-content' }}
              size="small"
              locale={{
                emptyText: <Empty description="Chưa có dữ liệu Huân chương Bảo vệ Tổ quốc" />,
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
