'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Button,
  Breadcrumb,
  Card,
  Tabs,
  Table,
  Modal,
  Typography,
  message,
  Descriptions,
  Empty,
  ConfigProvider,
  theme as antdTheme,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { ArrowLeftOutlined, HomeOutlined, PlusOutlined, EditOutlined, EyeOutlined } from '@ant-design/icons';
import { UnitForm } from '@/components/categories/UnitForm';
import { UnitsTable } from '@/components/categories/UnitsTable';
import { PositionForm } from '@/components/categories/PositionForm';
import { PositionsTable, type PositionRow } from '@/components/categories/PositionsTable';
import { apiClient } from '@/lib/apiClient';
import type { UnitApiRow } from '@/lib/types/personnelList';
import { calcUnitTotal } from '@/lib/utils';
import { useTheme } from '@/components/ThemeProvider';
import { LoadingState } from '@/components/shared/LoadingState';
import Link from 'next/link';

const { Title, Text } = Typography;

const BASE_PATH = '/super-admin/categories';
const PERSONNEL_BASE = '/admin/personnel';

function getDialogTitle(
  dialogType: 'unit' | 'position' | null,
  editingItem: { id?: string; co_quan_don_vi_id?: string | null } | null
): string {
  if (dialogType === 'position') {
    return editingItem?.id ? 'Chỉnh sửa Chức vụ' : 'Thêm Chức vụ mới';
  }
  if (!editingItem?.id) return 'Thêm Đơn vị trực thuộc';
  return editingItem.co_quan_don_vi_id
    ? 'Chỉnh sửa Đơn vị trực thuộc'
    : 'Chỉnh sửa Cơ quan đơn vị';
}

interface UnitDetail extends UnitApiRow {
  co_quan_don_vi_id?: string | null;
  so_luong?: number;
  DonViTrucThuoc?: (UnitApiRow & { so_luong?: number })[];
  ChucVu?: PositionRow[];
}

interface PersonnelItem {
  id: string;
  ho_ten?: string | null;
  cap_bac?: string | null;
  co_quan_don_vi_id?: string | null;
  don_vi_truc_thuoc_id?: string | null;
  ChucVu?: { ten_chuc_vu?: string | null };
  DonViTrucThuoc?: { ten_don_vi?: string | null };
}

export default function SAUnitDetailPage() {
  const { theme } = useTheme();
  const params = useParams();
  const router = useRouter();
  const unitId = params.id as string;

  const [unit, setUnit] = useState<UnitDetail | null>(null);
  const [units, setUnits] = useState<UnitApiRow[]>([]);
  const [personnel, setPersonnel] = useState<PersonnelItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogType, setDialogType] = useState<'unit' | 'position'>('unit');
  const [editingItem, setEditingItem] = useState<UnitApiRow | PositionRow | null>(null);
  const [activeTab, setActiveTab] = useState('info');

  const loadUnitDetail = useCallback(async () => {
    try {
      setLoading(true);
      const [unitRes, unitsRes, personnelRes] = await Promise.all([
        apiClient.getUnitById(unitId),
        apiClient.getUnits({ hierarchy: true }),
        apiClient.getPersonnel({ unit_id: unitId, limit: 500 }),
      ]);

      if (unitRes.success) {
        setUnit(unitRes.data);
        setUnits(unitsRes.data || []);
        setPersonnel((personnelRes.data || []) as PersonnelItem[]);
      } else {
        message.error(unitRes.message || 'Không thể tải thông tin đơn vị');
        router.push(BASE_PATH);
      }
    } catch {
      message.error('Không thể tải thông tin đơn vị');
      router.push(BASE_PATH);
    } finally {
      setLoading(false);
    }
  }, [unitId, router]);

  useEffect(() => {
    loadUnitDetail();
  }, [loadUnitDetail]);

  const handleOpenDialog = (type: 'unit' | 'position', item?: UnitApiRow | PositionRow) => {
    setDialogType(type);
    if (type === 'unit' && !item) {
      setEditingItem({ id: '', ten_don_vi: '', co_quan_don_vi_id: unitId });
    } else {
      setEditingItem(item || null);
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingItem(null);
  };

  const handleSuccess = () => {
    loadUnitDetail();
    handleCloseDialog();
  };

  if (loading) {
    return (
      <ConfigProvider theme={{ algorithm: theme === 'dark' ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm }}>
        <LoadingState fullPage text="Đang tải thông tin đơn vị..." />
      </ConfigProvider>
    );
  }

  if (!unit) return null;

  const childUnits = unit.DonViTrucThuoc || [];
  const currentUnitFallback = { id: unit.id, ten_don_vi: unit.ten_don_vi };

  const currentUnitPositions = (unit.ChucVu || []).map((pos: any) => ({
    ...pos,
    CoQuanDonVi: pos.CoQuanDonVi || currentUnitFallback,
  }));

  const childUnitPositions = childUnits.flatMap((child: any) => {
    const childFallback = {
      id: child.id,
      ten_don_vi: child.ten_don_vi,
      CoQuanDonVi: child.CoQuanDonVi || currentUnitFallback,
    };
    return (child.ChucVu || []).map((pos: any) => ({
      ...pos,
      DonViTrucThuoc: pos.DonViTrucThuoc || {
        id: childFallback.id,
        ten_don_vi: childFallback.ten_don_vi,
        CoQuanDonVi: childFallback.CoQuanDonVi,
      },
      CoQuanDonVi: pos.CoQuanDonVi || childFallback.CoQuanDonVi || {
        id: currentUnitFallback.id,
        ten_don_vi: currentUnitFallback.ten_don_vi,
      },
    }));
  });

  const positions = [...currentUnitPositions, ...childUnitPositions];
  const isDonViTrucThuoc = !!unit.co_quan_don_vi_id;

  const personnelColumns: ColumnsType<PersonnelItem> = [
    { title: 'STT', key: 'stt', width: 52, align: 'center', render: (_v, _r, idx) => idx + 1 },
    { title: 'Họ tên', dataIndex: 'ho_ten', key: 'ho_ten', align: 'center', render: v => v || '—' },
    { title: 'Cấp bậc', dataIndex: 'cap_bac', key: 'cap_bac', width: 140, align: 'center', render: v => v || '—' },
    { title: 'Chức vụ', key: 'chuc_vu', width: 200, align: 'center', render: (_v, r) => r.ChucVu?.ten_chuc_vu || '—' },
    ...(!isDonViTrucThuoc
      ? [{
          title: 'Đơn vị trực thuộc',
          key: 'dvtt',
          width: 180,
          align: 'center' as const,
          render: (_v: unknown, r: PersonnelItem) => r.DonViTrucThuoc?.ten_don_vi || '—',
        } as ColumnsType<PersonnelItem>[number]]
      : []),
    {
      title: '',
      key: 'action',
      width: 110,
      align: 'center',
      render: (_v, r) => (
        <Button size="small" icon={<EyeOutlined />} onClick={() => router.push(`${PERSONNEL_BASE}/${r.id}`)}>
          Chi tiết
        </Button>
      ),
    },
  ];

  return (
    <ConfigProvider theme={{ algorithm: theme === 'dark' ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm }}>
      <div style={{ padding: '24px' }}>
        <Breadcrumb
          style={{ marginBottom: 16 }}
          items={[
            { title: <Link href="/super-admin/dashboard"><HomeOutlined /></Link> },
            { title: <Link href={BASE_PATH}>Quản lý cơ quan đơn vị</Link> },
            ...(isDonViTrucThuoc && unit.CoQuanDonVi
              ? [{ title: <Link href={`${BASE_PATH}/units/${unit.CoQuanDonVi.id}`}>{unit.CoQuanDonVi.ten_don_vi}</Link> }]
              : []),
            { title: unit.ten_don_vi },
          ]}
        />

        <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <Button
              icon={<ArrowLeftOutlined />}
              onClick={() => {
                if (isDonViTrucThuoc && unit.CoQuanDonVi?.id) {
                  router.push(`${BASE_PATH}/units/${unit.CoQuanDonVi.id}`);
                } else {
                  router.push(BASE_PATH);
                }
              }}
              style={{ marginBottom: 16 }}
            >
              Quay lại
            </Button>
            <Title level={2} style={{ margin: 0, marginBottom: 8 }}>{unit.ten_don_vi}</Title>
            <Text type="secondary">
              Mã: {unit.ma_don_vi}{unit.CoQuanDonVi && ` • Trực thuộc: ${unit.CoQuanDonVi.ten_don_vi}`}
            </Text>
          </div>
          <Button icon={<EditOutlined />} onClick={() => handleOpenDialog('unit', unit)} type="primary" size="large">
            Sửa thông tin
          </Button>
        </div>

        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={[
            {
              key: 'info',
              label: 'Thông tin',
              children: (
                <Card>
                  <Descriptions bordered column={2}>
                    <Descriptions.Item label={isDonViTrucThuoc ? 'Mã đơn vị trực thuộc' : 'Mã cơ quan đơn vị'} span={1}>
                      {unit.ma_don_vi}
                    </Descriptions.Item>
                    <Descriptions.Item label={isDonViTrucThuoc ? 'Tên đơn vị trực thuộc' : 'Tên cơ quan đơn vị'} span={1}>
                      {unit.ten_don_vi}
                    </Descriptions.Item>
                    <Descriptions.Item label="Số lượng quân nhân" span={1}>{calcUnitTotal(unit)}</Descriptions.Item>
                    {isDonViTrucThuoc && (
                      <Descriptions.Item label="Cơ quan đơn vị" span={1}>
                        {unit.CoQuanDonVi ? (
                          <Link href={`${BASE_PATH}/units/${unit.CoQuanDonVi.id}`}>{unit.CoQuanDonVi.ten_don_vi}</Link>
                        ) : null}
                      </Descriptions.Item>
                    )}
                    {!isDonViTrucThuoc && (
                      <Descriptions.Item label="Số đơn vị trực thuộc" span={1}>{childUnits.length}</Descriptions.Item>
                    )}
                    <Descriptions.Item label="Số chức vụ" span={1}>{positions.length}</Descriptions.Item>
                  </Descriptions>
                </Card>
              ),
            },
            {
              key: 'personnel',
              label: `Quân nhân (${personnel.length})`,
              children: (
                <Card>
                  {personnel.length > 0 ? (
                    <Table
                      columns={personnelColumns}
                      dataSource={personnel}
                      rowKey="id"
                      size="middle"
                      pagination={{ pageSize: 20, showTotal: t => `Tổng ${t} quân nhân` }}
                      scroll={{ x: 'max-content' }}
                    />
                  ) : (
                    <div style={{ padding: '48px', textAlign: 'center' }}>
                      <Empty description="Chưa có quân nhân nào" />
                    </div>
                  )}
                </Card>
              ),
            },
            ...(!isDonViTrucThuoc
              ? [{
                  key: 'child-units',
                  label: `Đơn vị trực thuộc (${childUnits.length})`,
                  children: (
                    <>
                      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'flex-end' }}>
                        <Button type="primary" size="large" icon={<PlusOutlined />} onClick={() => handleOpenDialog('unit')}>
                          Thêm Đơn vị trực thuộc
                        </Button>
                      </div>
                      <Card>
                        {childUnits.length > 0 ? (
                          <UnitsTable
                            units={childUnits}
                            onEdit={u => handleOpenDialog('unit', u)}
                            onRefresh={loadUnitDetail}
                            showChildCount={false}
                            showPositionCount
                            showPositionList
                            basePath={BASE_PATH}
                          />
                        ) : (
                          <div style={{ padding: '48px', textAlign: 'center' }}>
                            <Text type="secondary">Chưa có đơn vị trực thuộc nào.</Text>
                          </div>
                        )}
                      </Card>
                    </>
                  ),
                }]
              : []),
            {
              key: 'positions',
              label: `Chức vụ (${positions.length})`,
              children: (
                <>
                  <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'flex-end' }}>
                    <Button type="primary" size="large" icon={<PlusOutlined />} onClick={() => handleOpenDialog('position')}>
                      Thêm Chức vụ
                    </Button>
                  </div>
                  <Card>
                    {positions.length > 0 ? (
                      <PositionsTable positions={positions} onEdit={p => handleOpenDialog('position', p)} onRefresh={loadUnitDetail} />
                    ) : (
                      <div style={{ padding: '48px', textAlign: 'center' }}>
                        <Text type="secondary">Chưa có chức vụ nào</Text>
                      </div>
                    )}
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
          width={600}
          centered
          destroyOnClose
          title={getDialogTitle(dialogType, editingItem)}
          styles={{ header: { paddingBottom: '16px', marginBottom: '24px', borderBottom: '1px solid #f0f0f0' }, body: { paddingTop: '24px' } }}
        >
          {dialogType === 'unit' && (
            <UnitForm unit={editingItem} units={units} onSuccess={handleSuccess} onClose={handleCloseDialog} />
          )}
          {dialogType === 'position' && (
            <PositionForm position={editingItem} units={[unit]} onSuccess={handleSuccess} onClose={handleCloseDialog} />
          )}
        </Modal>
      </div>
    </ConfigProvider>
  );
}
