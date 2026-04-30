'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Card, Button, Table, Modal, Space, Typography, Breadcrumb, message, Spin, Empty } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { LeftOutlined, HomeOutlined } from '@ant-design/icons';
import { apiClient } from '@/lib/apiClient';
import { downloadDecisionFile } from '@/lib/file/downloadDecisionFile';
import type { PersonnelDetail } from '@/lib/types/personnelList';


const { Title, Paragraph } = Typography;

interface AchievementRecord {
  id: string;
  nam: number;
  loai: string;
  mo_ta: string;
  so_quyet_dinh?: string;
  file_quyet_dinh?: string;
}

export default function ManagerScientificAchievementsPage() {
  const params = useParams();
  const personnelId = params?.id as string;
  const [loading, setLoading] = useState(true);
  const [personnel, setPersonnel] = useState<PersonnelDetail | null>(null);
  const [achievements, setAchievements] = useState<AchievementRecord[]>([]);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [personnelRes, achievementsRes] = await Promise.all([
        apiClient.getPersonnelById(personnelId),
        apiClient.getPersonnelScientificAchievements(personnelId),
      ]);

      if (personnelRes.success) {
        setPersonnel(personnelRes.data);
      }
      if (achievementsRes.success) {
        setAchievements(achievementsRes.data || []);
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
      const res = await apiClient.deleteScientificAchievement(deleteId);

      if (res.success) {
        message.success('Xóa thành tích thành công');
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

  const columns: ColumnsType<AchievementRecord> = [
    {
      title: 'Năm',
      dataIndex: 'nam',
      key: 'nam',
      width: 80,
      align: 'center',
    },
    {
      title: 'Loại',
      dataIndex: 'loai',
      key: 'loai',
      width: 150,
      align: 'center',
      render: (text: string) => {
        const map: Record<string, string> = {
          DTKH: 'ĐTKH',
          SKKH: 'SKKH',
        };
        return map[text] || text || '-';
      },
    },
    {
      title: 'Mô tả',
      dataIndex: 'mo_ta',
      key: 'mo_ta',
      width: 400,
      render: (text: string) => text || '-',
      ellipsis: true,
    },
    {
      title: 'Số quyết định',
      dataIndex: 'so_quyet_dinh',
      key: 'so_quyet_dinh',
      width: 150,
      align: 'center',
      render: (so_quyet_dinh: string) => {
        if (!so_quyet_dinh) return '-';
        return (
          <a
            onClick={() => handleOpenDecisionFile(so_quyet_dinh)}
            className="text-green-600 dark:text-green-400 underline cursor-pointer"
          >
            {so_quyet_dinh}
          </a>
        );
      },
    },
  ];

  return (
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
        <Breadcrumb.Item>Thành tích Nghiên cứu khoa học</Breadcrumb.Item>
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
            Thành tích Nghiên cứu khoa học
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
            dataSource={achievements}
            rowKey="id"
            pagination={false}
            scroll={{ x: 'max-content' }}
            locale={{
              emptyText: <Empty description="Chưa có dữ liệu thành tích khoa học" />,
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
          Bạn có chắc chắn muốn xóa thành tích khoa học này? Hành động này không thể hoàn tác.
        </Paragraph>
      </Modal>
    </div>
  );
}
