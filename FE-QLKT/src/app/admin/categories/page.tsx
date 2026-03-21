'use client';

import { useEffect, useState } from 'react';
import {
  Button,
  Breadcrumb,
  Card,
  Tabs,
  Select,
  Modal,
  Typography,
  message,
  ConfigProvider,
  theme as antdTheme,
  Space,
  Spin,
} from 'antd';
import { PlusOutlined, HomeOutlined } from '@ant-design/icons';
import { UnitForm } from '@/components/categories/unit-form';
import { UnitsTable } from '@/components/categories/units-table';
import { PositionForm } from '@/components/categories/position-form';
import { PositionsTable } from '@/components/categories/positions-table';
import { apiClient } from '@/lib/api-client';
import { useTheme } from '@/components/theme-provider';
import Link from 'next/link';

const { Title, Text } = Typography;
const { Option } = Select;

export default function CategoriesPage() {
  const { theme } = useTheme();
  const [units, setUnits] = useState<any[]>([]);
  const [positions, setPositions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogType, setDialogType] = useState<'unit' | 'position'>('unit');
  const [editingItem, setEditingItem] = useState<any>(null);
  const [selectedUnit, setSelectedUnit] = useState('ALL');
  const [activeTab, setActiveTab] = useState('units');

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);
      // Gọi API với hierarchy=true để chỉ lấy các "Cơ quan đơn vị" cấp cao nhất
      const [unitsRes, positionsRes] = await Promise.all([
        apiClient.getUnits({ hierarchy: true }), // Chỉ lấy cơ quan đơn vị cấp cao nhất
        apiClient.getPositions(),
      ]);
      setUnits(unitsRes.data || []);
      setPositions(positionsRes.data || []);
    } catch (error) {
      // Error handled by UI message
      message.error('Không thể tải dữ liệu');
    } finally {
      setLoading(false);
    }
  }

  const handleOpenDialog = (type: 'unit' | 'position', item?: any) => {
    setDialogType(type);
    // Khi tạo mới đơn vị ở trang categories, không set co_quan_don_vi_id (chỉ tạo cơ quan đơn vị)
    if (type === 'unit' && !item) {
      setEditingItem(null); // Tạo cơ quan đơn vị mới (không có co_quan_don_vi_id)
    } else {
      setEditingItem(item || null);
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingItem(null);
  };

  const filteredPositions =
    selectedUnit === 'ALL'
      ? positions
      : positions.filter(p => {
          const unitIdStr = selectedUnit.toString();
          // Nếu chức vụ trực thuộc cơ quan đơn vị (qua relation object)
          if (p.CoQuanDonVi?.id?.toString() === unitIdStr) return true;
          // Nếu chức vụ của đơn vị trực thuộc thuộc cơ quan đơn vị đó (qua relation object)
          if (p.DonViTrucThuoc?.CoQuanDonVi?.id?.toString() === unitIdStr) return true;
          // Fallback: kiểm tra co_quan_don_vi_id trực tiếp
          if (p.co_quan_don_vi_id?.toString() === unitIdStr) return true;
          return false;
        });

  if (loading) {
    return (
      <ConfigProvider
        theme={{
          algorithm: theme === 'dark' ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
        }}
      >
        <div className="flex justify-center items-center min-h-screen">
          <Spin size="large" />
        </div>
      </ConfigProvider>
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
        <Breadcrumb
          style={{ marginBottom: 16 }}
          items={[
            {
              title: (
                <Link href="/admin/dashboard">
                  <HomeOutlined />
                </Link>
              ),
            },
            {
              title: 'Quản lý Cơ quan Đơn vị',
            },
          ]}
        />

        {/* Header */}
        <div
          style={{
            marginBottom: 24,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 16,
          }}
        >
          <div>
            <Title level={2} style={{ margin: 0, marginBottom: 8 }}>
              Quản lý Cơ quan Đơn vị
            </Title>
            <Text type="secondary">
              Quản lý cơ quan đơn vị ({units.length}) và chức vụ ({positions.length})
            </Text>
          </div>
        </div>
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={[
            {
              key: 'units',
              label: `Cơ quan đơn vị (${units.length})`,
              children: (
                <>
                  <div
                    style={{
                      marginBottom: 24,
                      display: 'flex',
                      justifyContent: 'flex-end',
                      alignItems: 'center',
                    }}
                  >
                    <Button
                      type="primary"
                      size="large"
                      icon={<PlusOutlined />}
                      onClick={() => handleOpenDialog('unit')}
                    >
                      Thêm Cơ quan đơn vị
                    </Button>
                  </div>
                  <Card>
                    <UnitsTable
                      units={units}
                      onEdit={unit => handleOpenDialog('unit', unit)}
                      onRefresh={loadData}
                    />
                  </Card>
                </>
              ),
            },
            {
              key: 'positions',
              label: `Chức vụ (${positions.length})`,
              children: (
                <>
                  {/* Filters */}
                  <Card style={{ marginBottom: 24 }}>
                    <div
                      style={{
                        display: 'flex',
                        gap: '16px',
                        alignItems: 'flex-end',
                        flexWrap: 'wrap',
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 300 }}>
                        <Text type="secondary" style={{ marginBottom: 8, display: 'block' }}>
                          Cơ quan đơn vị
                        </Text>
                        <Select
                          value={selectedUnit}
                          onChange={setSelectedUnit}
                          style={{ width: '100%' }}
                          size="large"
                          placeholder="Chọn Cơ quan đơn vị"
                        >
                          <Option value="ALL">Tất cả Cơ quan đơn vị ({units.length})</Option>
                          {units.map(unit => (
                            <Option key={unit.id} value={unit.id.toString()}>
                              {unit.ten_don_vi}
                            </Option>
                          ))}
                        </Select>
                      </div>
                      <div>
                        <div style={{ height: '22px', marginBottom: 8 }}></div>
                        <Button
                          type="primary"
                          size="large"
                          icon={<PlusOutlined />}
                          onClick={() => handleOpenDialog('position')}
                          style={{ minWidth: 'auto' }}
                        >
                          Thêm Chức vụ
                        </Button>
                      </div>
                    </div>
                  </Card>

                  {/* Table */}
                  <Card>
                    <PositionsTable
                      positions={filteredPositions}
                      onEdit={pos => handleOpenDialog('position', pos)}
                      onRefresh={loadData}
                    />
                  </Card>
                </>
              ),
            },
          ]}
        />

        <Modal
          open={dialogOpen}
          onCancel={handleCloseDialog}
          footer={null}
          width={800}
          centered
          style={{ maxHeight: '90vh' }}
          styles={{
            content: {
              borderRadius: '12px !important',
              overflow: 'hidden',
            },
            header: {
              borderRadius: '12px 12px 0 0 !important',
            },
            body: {
              borderRadius: '0 0 12px 12px !important',
            },
          }}
          maskStyle={{
            borderRadius: '12px',
          }}
          title={
            dialogType === 'unit'
              ? editingItem
                ? editingItem.co_quan_don_vi_id
                  ? 'Sửa Đơn vị trực thuộc'
                  : 'Sửa Cơ quan đơn vị'
                : 'Thêm Cơ quan đơn vị mới'
              : editingItem
                ? 'Sửa Chức vụ'
                : 'Thêm Chức vụ mới'
          }
        >
          {dialogType === 'unit' && (
            <UnitForm
              unit={editingItem}
              units={units}
              onSuccess={loadData}
              onClose={handleCloseDialog}
            />
          )}

          {dialogType === 'position' && (
            <PositionForm
              position={editingItem}
              units={units}
              onSuccess={loadData}
              onClose={handleCloseDialog}
            />
          )}
        </Modal>
      </div>
    </ConfigProvider>
  );
}
