'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Button,
  Breadcrumb,
  Card,
  Tabs,
  Modal,
  Typography,
  message,
  Descriptions,
  ConfigProvider,
  theme as antdTheme,
  Spin,
} from 'antd';
import { ArrowLeftOutlined, HomeOutlined, PlusOutlined, EditOutlined } from '@ant-design/icons';
import { UnitForm } from '@/components/categories/UnitForm';
import { UnitsTable } from '@/components/categories/UnitsTable';
import { PositionForm } from '@/components/categories/PositionForm';
import { PositionsTable } from '@/components/categories/PositionsTable';
import { apiClient } from '@/lib/apiClient';
import { useTheme } from '@/components/ThemeProvider';
import Link from 'next/link';

const { Title, Text } = Typography;

export default function UnitDetailPage() {
  const { theme } = useTheme();
  const params = useParams();
  const router = useRouter();
  const unitId = params.id as string;

  const [unit, setUnit] = useState<any>(null);
  const [units, setUnits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogType, setDialogType] = useState<'unit' | 'position'>('unit');
  const [editingItem, setEditingItem] = useState<any>(null);
  const [activeTab, setActiveTab] = useState('info');

  useEffect(() => {
    loadUnitDetail();
  }, [unitId]);

  async function loadUnitDetail() {
    try {
      setLoading(true);
      const [unitRes, unitsRes] = await Promise.all([
        apiClient.getUnitById(unitId),
        apiClient.getUnits({ hierarchy: true }),
      ]);

      if (unitRes.success) {
        setUnit(unitRes.data);
        setUnits(unitsRes.data || []);
      } else {
        message.error(unitRes.message || 'Không thể tải thông tin đơn vị');
        router.push('/admin/categories');
      }
    } catch (error) {
      message.error('Không thể tải thông tin đơn vị');
      router.push('/admin/categories');
    } finally {
      setLoading(false);
    }
  }

  const handleOpenDialog = (type: 'unit' | 'position', item?: any) => {
    setDialogType(type);
    if (type === 'unit' && !item) {
      // Tạo đơn vị trực thuộc mới
      setEditingItem({ co_quan_don_vi_id: unitId });
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

  if (!unit) {
    return null;
  }

  // Xử lý dữ liệu từ 2 bảng khác nhau
  const childUnits = unit.DonViTrucThuoc || [];
  const currentUnitFallback = {
    id: unit.id,
    ten_don_vi: unit.ten_don_vi,
  };

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
      CoQuanDonVi: pos.CoQuanDonVi ||
        childFallback.CoQuanDonVi || {
          id: currentUnitFallback.id,
          ten_don_vi: currentUnitFallback.ten_don_vi,
        },
    }));
  });

  const positions = [...currentUnitPositions, ...childUnitPositions];
  // Kiểm tra xem đơn vị có phải là đơn vị trực thuộc không (có co_quan_don_vi_id)
  const isDonViTrucThuoc = !!unit.co_quan_don_vi_id;

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
              title: <Link href="/admin/categories">Quản lý Cơ quan Đơn vị</Link>,
            },
            {
              title: unit.ten_don_vi,
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
            <Button
              icon={<ArrowLeftOutlined />}
              onClick={() => {
                // Nếu là đơn vị trực thuộc, quay lại trang chi tiết cơ quan đơn vị cha
                if (isDonViTrucThuoc && unit.CoQuanDonVi?.id) {
                  router.push(`/admin/categories/units/${unit.CoQuanDonVi.id}`);
                } else {
                  // Nếu là cơ quan đơn vị, quay lại danh sách
                  router.push('/admin/categories');
                }
              }}
              style={{ marginBottom: 16 }}
            >
              Quay lại
            </Button>
            <Title level={2} style={{ margin: 0, marginBottom: 8 }}>
              {unit.ten_don_vi}
            </Title>
            <Text type="secondary">
              Mã: {unit.ma_don_vi}{' '}
              {unit.CoQuanDonVi && `• Trực thuộc: ${unit.CoQuanDonVi.ten_don_vi}`}
            </Text>
          </div>
          <Button
            icon={<EditOutlined />}
            onClick={() => handleOpenDialog('unit', unit)}
            type="primary"
            size="large"
          >
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
                    <Descriptions.Item
                      label={isDonViTrucThuoc ? 'Mã đơn vị trực thuộc' : 'Mã cơ quan đơn vị'}
                      span={1}
                    >
                      {unit.ma_don_vi}
                    </Descriptions.Item>
                    <Descriptions.Item
                      label={isDonViTrucThuoc ? 'Tên đơn vị trực thuộc' : 'Tên cơ quan đơn vị'}
                      span={1}
                    >
                      {unit.ten_don_vi}
                    </Descriptions.Item>
                    <Descriptions.Item label="Số lượng quân nhân" span={1}>
                      {unit.so_luong || 0}
                    </Descriptions.Item>
                    {/* Chỉ hiển thị "Cơ quan đơn vị" nếu đơn vị là đơn vị trực thuộc (có co_quan_don_vi_id) */}
                    {isDonViTrucThuoc && (
                      <Descriptions.Item label="Cơ quan đơn vị" span={1}>
                        {unit.CoQuanDonVi ? (
                          <Link href={`/admin/categories/units/${unit.CoQuanDonVi.id}`}>
                            {unit.CoQuanDonVi.ten_don_vi}
                          </Link>
                        ) : null}
                      </Descriptions.Item>
                    )}
                    {/* Chỉ hiển thị "Số đơn vị trực thuộc" nếu đơn vị là cơ quan đơn vị (không có co_quan_don_vi_id) */}
                    {!isDonViTrucThuoc && (
                      <Descriptions.Item label="Số đơn vị trực thuộc" span={1}>
                        {childUnits.length}
                      </Descriptions.Item>
                    )}
                    <Descriptions.Item label="Số chức vụ" span={1}>
                      {positions.length}
                    </Descriptions.Item>
                  </Descriptions>
                </Card>
              ),
            },
            // Chỉ hiển thị tab "Đơn vị trực thuộc" nếu đơn vị hiện tại là cơ quan đơn vị (không có co_quan_don_vi_id)
            // Đơn vị trực thuộc không thể có đơn vị con
            ...(!isDonViTrucThuoc
              ? [
                  {
                    key: 'child-units',
                    label: `Đơn vị trực thuộc (${childUnits.length})`,
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
                            />
                          ) : (
                            <div style={{ padding: '48px', textAlign: 'center' }}>
                              <Text type="secondary">
                                Chưa có đơn vị trực thuộc nào. Một cơ quan đơn vị có thể có hoặc
                                không có đơn vị trực thuộc.
                              </Text>
                            </div>
                          )}
                        </Card>
                      </>
                    ),
                  },
                ]
              : []),
            {
              key: 'positions',
              label: `Chức vụ (${positions.length})`,
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
                      onClick={() => handleOpenDialog('position')}
                    >
                      Thêm Chức vụ
                    </Button>
                  </div>
                  <Card>
                    {positions.length > 0 ? (
                      <PositionsTable
                        positions={positions}
                        onEdit={p => handleOpenDialog('position', p)}
                        onRefresh={loadUnitDetail}
                      />
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
          title={
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '8px',
                  background:
                    dialogType === 'unit'
                      ? 'linear-gradient(135deg, #0284c7 0%, #0ea5e9 100%)'
                      : 'linear-gradient(135deg, #7c3aed 0%, #a78bfa 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {dialogType === 'unit' ? (
                  editingItem?.id ? (
                    <EditOutlined style={{ fontSize: '18px', color: '#fff' }} />
                  ) : (
                    <PlusOutlined style={{ fontSize: '18px', color: '#fff' }} />
                  )
                ) : editingItem?.id ? (
                  <EditOutlined style={{ fontSize: '18px', color: '#fff' }} />
                ) : (
                  <PlusOutlined style={{ fontSize: '18px', color: '#fff' }} />
                )}
              </div>
              <span style={{ fontSize: '18px', fontWeight: 600 }}>
                {dialogType === 'unit'
                  ? editingItem?.id
                    ? editingItem.co_quan_don_vi_id
                      ? 'Chỉnh sửa Đơn vị trực thuộc'
                      : 'Chỉnh sửa Cơ quan đơn vị'
                    : 'Thêm Đơn vị trực thuộc'
                  : editingItem?.id
                    ? 'Chỉnh sửa Chức vụ'
                    : 'Thêm Chức vụ mới'}
              </span>
            </div>
          }
          styles={{
            header: {
              paddingBottom: '16px',
              marginBottom: '24px',
              borderBottom: '1px solid #f0f0f0',
            },
            body: {
              paddingTop: '24px',
            },
          }}
        >
          {dialogType === 'unit' && (
            <UnitForm
              unit={editingItem}
              units={units} // Truyền danh sách tất cả đơn vị để chọn parent
              onSuccess={handleSuccess}
              onClose={handleCloseDialog}
            />
          )}

          {dialogType === 'position' && (
            <PositionForm
              position={editingItem}
              units={[unit]} // Chỉ cho phép tạo chức vụ cho đơn vị hiện tại
              onSuccess={handleSuccess}
              onClose={handleCloseDialog}
            />
          )}
        </Modal>
      </div>
    </ConfigProvider>
  );
}
