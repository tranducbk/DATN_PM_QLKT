'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Card, Button, Table, Space, Typography, Breadcrumb, message, Empty } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { LeftOutlined, HomeOutlined } from '@ant-design/icons';
import { apiClient } from '@/lib/http/apiClient';
import { LoadingState } from '@/components/shared/LoadingState';
import { downloadDecisionFile } from '@/lib/file/downloadDecisionFile';
import { THANH_TICH_KHOA_HOC_SHORT_LABELS } from '@/constants/danhHieu.constants';
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

export default function ScientificAchievementsPage() {
  const params = useParams();
  const personnelId = params?.id as string;
  const [loading, setLoading] = useState(true);
  const [personnel, setPersonnel] = useState<PersonnelDetail | null>(null);
  const [achievements, setAchievements] = useState<AchievementRecord[]>([]);

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

  const handleOpenDecisionFile = async (soQuyetDinh: string) => {
    await downloadDecisionFile(soQuyetDinh);
  };

  const columns: ColumnsType<AchievementRecord> = [
    {
      title: 'Năm',
      dataIndex: 'nam',
      key: 'nam',
      width: 80,
    },
    {
      title: 'Loại',
      dataIndex: 'loai',
      key: 'loai',
      width: 150,
      render: (text: string) => {
        return THANH_TICH_KHOA_HOC_SHORT_LABELS[text] || text || '-';
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
      render: (so_quyet_dinh: string, record: AchievementRecord) => {
        return (
          <a
            onClick={() => handleOpenDecisionFile(so_quyet_dinh!)}
            className="text-green-600 dark:text-green-400 underline cursor-pointer"
          >
            {so_quyet_dinh || 'N/A'}
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
            <Link href={`/admin/personnel/${personnelId}?tab=3`}>
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
          <LoadingState />
        </Card>
      ) : (
        <Card>
          <Table
            columns={columns}
            dataSource={achievements}
            rowKey="id"
            pagination={false}
            locale={{
              emptyText: <Empty description="Chưa có dữ liệu thành tích khoa học" />,
            }}
          />
        </Card>
      )}

    </div>
  );
}
