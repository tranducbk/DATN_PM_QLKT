'use client';

import { useEffect, useState } from 'react';
import {
  Button,
  Card,
  Tabs,
  Select,
  Modal,
  Typography,
  message,
  ConfigProvider,
  theme as antdTheme,
  Spin,
} from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import dynamic from 'next/dynamic';
import { UnitsTable } from '@/components/categories/UnitsTable';
import { UnitList } from '@/components/categories/UnitList';
import { PositionsTable, type PositionRow } from '@/components/categories/PositionsTable';
import { apiClient } from '@/lib/http/apiClient';
import { useTheme } from '@/components/ThemeProvider';
import { LoadingState } from '@/components/shared/LoadingState';
import { PageBreadcrumb } from '@/components/shared/PageBreadcrumb';

const { Title, Text } = Typography;
const { Option } = Select;

const BASE_PATH = '/super-admin/categories';

const UnitForm = dynamic(
  () => import('@/components/categories/UnitForm').then(m => ({ default: m.UnitForm })),
  { ssr: false, loading: () => <Spin /> }
);
const PositionForm = dynamic(
  () => import('@/components/categories/PositionForm').then(m => ({ default: m.PositionForm })),
  { ssr: false, loading: () => <Spin /> }
);

interface CategoryUnitRow {
  id: string;
  ten_don_vi: string;
  ma_don_vi?: string;
  co_quan_don_vi_id?: string | null;
}

interface PersonnelItem {
  id: string;
  ho_ten?: string | null;
  cap_bac?: string | null;
  co_quan_don_vi_id?: string | null;
  don_vi_truc_thuoc_id?: string | null;
  ChucVu?: { ten_chuc_vu?: string | null };
}

export default function SACategoriesPage() {
  const { theme } = useTheme();
  const [units, setUnits] = useState<CategoryUnitRow[]>([]);
  const [positions, setPositions] = useState<PositionRow[]>([]);
  const [allPersonnel, setAllPersonnel] = useState<PersonnelItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogType, setDialogType] = useState<'unit' | 'position'>('unit');
  const [editingItem, setEditingItem] = useState<CategoryUnitRow | PositionRow | null>(null);
  const [selectedUnit, setSelectedUnit] = useState('ALL');
  const [activeTab, setActiveTab] = useState('tree');

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);
      const [unitsRes, positionsRes, personnelRes] = await Promise.all([
        apiClient.getUnits({ hierarchy: true }),
        apiClient.getPositions(),
        apiClient.getPersonnel({ limit: 500 }),
      ]);
      setUnits((unitsRes.data || []) as CategoryUnitRow[]);
      setPositions((positionsRes.data || []) as PositionRow[]);
      setAllPersonnel((personnelRes.data || []) as PersonnelItem[]);
    } catch {
      message.error('Không thể tải dữ liệu');
    } finally {
      setLoading(false);
    }
  }

  const handleOpenDialog = (type: 'unit' | 'position', item?: CategoryUnitRow | PositionRow | null) => {
    setDialogType(type);
    setEditingItem(type === 'unit' && !item ? null : item || null);
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
          if (p.CoQuanDonVi?.id?.toString() === unitIdStr) return true;
          if (p.DonViTrucThuoc?.CoQuanDonVi?.id?.toString() === unitIdStr) return true;
          if (p.co_quan_don_vi_id?.toString() === unitIdStr) return true;
          return false;
        });

  const antdAlgorithm = theme === 'dark' ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm;

  return (
    <ConfigProvider theme={{ algorithm: antdAlgorithm }}>
      {loading ? (
        <LoadingState fullPage text="Đang tải danh mục..." />
      ) : (
        <div style={{ padding: '24px' }}>
          <PageBreadcrumb items={[{ title: 'Quản lý cơ quan đơn vị' }]} />

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
                Quản lý cơ quan đơn vị
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
                key: 'tree',
                label: 'Danh sách đơn vị',
                children: (
                  <UnitList units={units} allPersonnel={allPersonnel} basePath={BASE_PATH} />
                ),
              },
              {
                key: 'units',
                label: `Cơ quan đơn vị (${units.length})`,
                children: (
                  <>
                    <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'flex-end' }}>
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
                        basePath={BASE_PATH}
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
                    <Card style={{ marginBottom: 24 }}>
                      <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                        <div style={{ flex: 1, minWidth: 300 }}>
                          <Text type="secondary" style={{ marginBottom: 8, display: 'block' }}>
                            Cơ quan đơn vị
                          </Text>
                          <Select
                            value={selectedUnit}
                            onChange={setSelectedUnit}
                            style={{ width: '100%' }}
                            size="large"
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
                          <div style={{ height: '22px', marginBottom: 8 }} />
                          <Button
                            type="primary"
                            size="large"
                            icon={<PlusOutlined />}
                            onClick={() => handleOpenDialog('position')}
                          >
                            Thêm Chức vụ
                          </Button>
                        </div>
                      </div>
                    </Card>
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
            destroyOnClose
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
              <UnitForm unit={editingItem} units={units} onSuccess={loadData} onClose={handleCloseDialog} />
            )}
            {dialogType === 'position' && (
              <PositionForm position={editingItem} units={units} onSuccess={loadData} onClose={handleCloseDialog} />
            )}
          </Modal>
        </div>
      )}
    </ConfigProvider>
  );
}
