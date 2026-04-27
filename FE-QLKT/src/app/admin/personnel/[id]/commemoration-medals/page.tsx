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
  Spin,
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
import { downloadDecisionFile } from '@/lib/file/downloadDecisionFile';
import { ELIGIBILITY_STATUS } from '@/constants/eligibilityStatus.constants';
import { DANH_HIEU_MAP } from '@/constants/danhHieu.constants';
import type { PersonnelDetail, MedalData } from '@/lib/types/personnelList';


const { Title, Paragraph } = Typography;

interface CommemorationMedal {
  id: string;
  name: string;
  nam?: number;
  cap_bac?: string;
  chuc_vu?: string;
  so_quyet_dinh?: string;
  ghi_chu?: string;
  status: string;
}

export default function AdminCommemorativeMedalsPage() {
  const params = useParams();
  const personnelId = params?.id as string;
  const { theme } = useTheme();
  const [loading, setLoading] = useState(true);
  const [personnel, setPersonnel] = useState<PersonnelDetail | null>(null);
  const [, setCommemorationMedals] = useState<MedalData | null>(null);
  const [medals, setMedals] = useState<CommemorationMedal[]>([]);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [personnelRes, commRes] = await Promise.all([
        apiClient.getPersonnelById(personnelId),
        apiClient.getCommemorationMedalsByPersonnel(personnelId),
      ]);

      if (personnelRes.success) {
        setPersonnel(personnelRes.data);
      }
      if (commRes.success) {
        setCommemorationMedals(commRes.data);
        // Map commemoration medals data to medals array
        const mappedMedals: CommemorationMedal[] = [];
        if (commRes.data && commRes.data.hasReceived && commRes.data.data) {
          commRes.data.data.forEach((medal: any) => {
            mappedMedals.push({
              id: medal.id,
              name: DANH_HIEU_MAP['KNC_VSNXD_QDNDVN'],
              nam: medal.nam,
              cap_bac: medal.cap_bac,
              chuc_vu: medal.chuc_vu,
              so_quyet_dinh: medal.so_quyet_dinh,
              ghi_chu: medal.ghi_chu,
              status: ELIGIBILITY_STATUS.DA_NHAN,
            });
          });
        }
        setMedals(mappedMedals.filter(m => m.status === ELIGIBILITY_STATUS.DA_NHAN));
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
      message.success('Xóa kỷ niệm chương thành công');
      setDeleteModalOpen(false);
      setDeleteId(null);
      loadData();
    } catch (error) {
      message.error('Có lỗi xảy ra khi xóa');
    }
  };

  const columns: TableColumnsType<CommemorationMedal> = [
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
      render: (soQuyetDinh: string, record: CommemorationMedal) => {
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
          <Breadcrumb.Item>{DANH_HIEU_MAP['KNC_VSNXD_QDNDVN']}</Breadcrumb.Item>
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
              {DANH_HIEU_MAP['KNC_VSNXD_QDNDVN']}
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
              dataSource={medals}
              rowKey="id"
              pagination={false}
              scroll={{ x: 'max-content' }}
              size="small"
              locale={{
                emptyText: (
                  <Empty description={`Chưa có dữ liệu ${DANH_HIEU_MAP['KNC_VSNXD_QDNDVN']}`} />
                ),
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
            Bạn có chắc chắn muốn xóa kỷ niệm chương này? Hành động này không thể hoàn tác.
          </Paragraph>
        </Modal>
      </div>
    </ConfigProvider>
  );
}
