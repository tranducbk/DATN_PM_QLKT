'use client';

import { useEffect, useState } from 'react';
import {
  Button,
  Card,
  Breadcrumb,
  Typography,
  Space,
  Modal,
  Select,
  message,
  ConfigProvider,
  theme as antdTheme,
  Spin,
} from 'antd';
import { useTheme } from '@/components/theme-provider';
import { PositionForm } from '@/components/categories/position-form';
import { PositionsTable } from '@/components/categories/positions-table';
import { apiClient } from '@/lib/api-client';
import {
  PlusOutlined,
  HomeOutlined,
  SyncOutlined,
  IdcardOutlined,
  SafetyCertificateOutlined,
  CrownOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import Link from 'next/link';

const { Title, Text } = Typography;

export default function PositionsPage() {
  const { theme } = useTheme();
  const [positions, setPositions] = useState<any[]>([]);
  const [units, setUnits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPosition, setEditingPosition] = useState<any>(null);
  const [selectedUnit, setSelectedUnit] = useState('ALL');

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);
      const [positionsRes, unitsRes] = await Promise.all([
        apiClient.getPositions(),
        apiClient.getUnits(),
      ]);
      setPositions(positionsRes.data || []);
      setUnits(unitsRes.data || []);
    } catch (error) {
      message.error('Không thể tải dữ liệu');
    } finally {
      setLoading(false);
    }
  }

  const handleOpenDialog = (position?: any) => {
    setEditingPosition(position || null);
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingPosition(null);
  };

  const filteredPositions =
    selectedUnit === 'ALL'
      ? positions
      : positions.filter(p => p.don_vi_id?.toString() === selectedUnit);

  const managerPositions = positions.filter(p => p.is_manager);
  const regularPositions = positions.filter(p => !p.is_manager);

  if (loading && positions.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Spin size="large" />
      </div>
    );
  }

  return (
    <ConfigProvider
      theme={{
        algorithm: theme === 'dark' ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
      }}
    >
      <div style={{ padding: '24px' }}>
        {/* Breadcrumb */}
        <Breadcrumb style={{ marginBottom: '24px' }}>
          <Breadcrumb.Item>
            <Link href="/admin/dashboard">
              <HomeOutlined />
            </Link>
          </Breadcrumb.Item>
          <Breadcrumb.Item>Quản lý Chức vụ</Breadcrumb.Item>
        </Breadcrumb>

        {/* Header */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            marginBottom: '24px',
            flexWrap: 'wrap',
            gap: '16px',
          }}
        >
          <div>
            <Title
              level={1}
              style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '12px' }}
            >
              <div
                style={{
                  padding: '12px',
                  background: 'linear-gradient(135deg, #dc2626 0%, #f97316 100%)',
                  borderRadius: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <IdcardOutlined style={{ fontSize: '32px', color: '#fff' }} />
              </div>
              Quản lý Chức vụ
            </Title>
            <Text type="secondary" style={{ display: 'block', marginTop: '8px', fontSize: '15px' }}>
              Quản lý thông tin chức vụ, cấp bậc và nhóm cống hiến
            </Text>
          </div>
          <Button
            icon={<SyncOutlined spin={loading} />}
            onClick={loadData}
            disabled={loading}
            size="large"
          >
            Làm mới
          </Button>
        </div>

        {/* Stats Cards */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '16px',
            marginBottom: '24px',
          }}
        >
          <Card>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '16px' }}>
              <div
                style={{
                  padding: '12px',
                  backgroundColor: '#fee2e2',
                  borderRadius: '12px',
                  display: 'flex',
                }}
              >
                <IdcardOutlined style={{ fontSize: '24px', color: '#dc2626' }} />
              </div>
              <div>
                <Text type="secondary" style={{ fontSize: '14px' }}>
                  Tổng số chức vụ
                </Text>
                <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#dc2626' }}>
                  {positions.length}
                </div>
              </div>
            </div>
          </Card>

          <Card>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '16px' }}>
              <div
                style={{
                  padding: '12px',
                  backgroundColor: '#fef3c7',
                  borderRadius: '12px',
                  display: 'flex',
                }}
              >
                <CrownOutlined style={{ fontSize: '24px', color: '#f59e0b' }} />
              </div>
              <div>
                <Text type="secondary" style={{ fontSize: '14px' }}>
                  Chức vụ Chỉ huy
                </Text>
                <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#f59e0b' }}>
                  {managerPositions.length}
                </div>
              </div>
            </div>
          </Card>

          <Card>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '16px' }}>
              <div
                style={{
                  padding: '12px',
                  backgroundColor: '#e0f2fe',
                  borderRadius: '12px',
                  display: 'flex',
                }}
              >
                <TeamOutlined style={{ fontSize: '24px', color: '#0284c7' }} />
              </div>
              <div>
                <Text type="secondary" style={{ fontSize: '14px' }}>
                  Chức vụ thường
                </Text>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#0284c7' }}>
                  {regularPositions.length}
                </div>
              </div>
            </div>
          </Card>
        </div>

        {loading ? (
          <Card style={{ textAlign: 'center', padding: '48px' }}>
            <Space direction="vertical" size="large">
              <Spin size="large" />
              <Text type="secondary" style={{ fontSize: '18px', fontWeight: 500 }}>
                Đang tải dữ liệu chức vụ...
              </Text>
            </Space>
          </Card>
        ) : (
          <div>
            <Space direction="vertical" size="middle" style={{ width: '100%' }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '16px',
                }}
              >
                <Title level={3} style={{ margin: 0 }}>
                  Danh sách Chức vụ
                </Title>
                <Space size="middle">
                  <Select
                    value={selectedUnit}
                    onChange={setSelectedUnit}
                    style={{ width: 280 }}
                    size="large"
                  >
                    <Select.Option value="ALL">Tất cả Đơn vị ({units.length})</Select.Option>
                    {units.map(unit => (
                      <Select.Option key={unit.id} value={unit.id.toString()}>
                        {unit.ten_don_vi}
                      </Select.Option>
                    ))}
                  </Select>
                  <Button
                    type="primary"
                    icon={<PlusOutlined />}
                    onClick={() => handleOpenDialog()}
                    size="large"
                  >
                    Thêm Chức vụ
                  </Button>
                </Space>
              </div>
              <Card style={{ padding: 0 }}>
                <PositionsTable
                  positions={filteredPositions}
                  onEdit={handleOpenDialog}
                  onRefresh={loadData}
                />
              </Card>
            </Space>
          </div>
        )}

        <Modal
          title={
            <span style={{ fontSize: '18px', fontWeight: 600 }}>
              <IdcardOutlined style={{ marginRight: '8px', color: '#dc2626' }} />
              {editingPosition ? 'Sửa Chức vụ' : 'Thêm Chức vụ mới'}
            </span>
          }
          open={dialogOpen}
          onCancel={handleCloseDialog}
          footer={null}
          width={800}
          destroyOnClose
        >
          <PositionForm
            position={editingPosition}
            units={units}
            onSuccess={loadData}
            onClose={handleCloseDialog}
          />
        </Modal>
      </div>
    </ConfigProvider>
  );
}
