'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  Button,
  Breadcrumb,
  Card,
  Input,
  Select,
  Modal,
  Typography,
  message,
  ConfigProvider,
  theme as antdTheme,
  Spin,
  Pagination,
} from 'antd';
import { getApiErrorMessage } from '@/lib/apiError';
import { DEFAULT_PAGE_SIZE, DEFAULT_ANTD_TABLE_PAGINATION } from '@/lib/constants/pagination.constants';
import { useTheme } from '@/components/ThemeProvider';
import {
  SyncOutlined,
  HomeOutlined,
  UserOutlined,
  ApartmentOutlined,
  SafetyCertificateOutlined,
  EyeOutlined,
} from '@ant-design/icons';
import { PersonnelTable } from '@/components/personnel/PersonnelTable';
import { PersonnelForm } from '@/components/personnel/PersonnelForm';
import { apiClient } from '@/lib/apiClient';
import { personnelFormSchema } from '@/lib/schemas';
import type { z } from 'zod';
import { MILITARY_RANKS } from '@/lib/constants/military-ranks';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import type { ManagerPositionRow, PersonnelListItem, UnitOptionRow } from '@/lib/types/personnelList';

type PersonnelFormValues = z.infer<typeof personnelFormSchema>;

const { Title, Text } = Typography;
const { Option } = Select;

export default function ManagerPersonnelPage() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const [personnel, setPersonnel] = useState<PersonnelListItem[]>([]);
  const [units, setUnits] = useState<UnitOptionRow[]>([]);
  const [positions, setPositions] = useState<ManagerPositionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [viewingPersonnel, setViewingPersonnel] = useState<PersonnelListItem | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPosition, setSelectedPosition] = useState('');
  const [selectedCapBac, setSelectedCapBac] = useState('');
  const [pagination, setPagination] = useState({
    page: 1,
    limit: DEFAULT_PAGE_SIZE,
    total: 0,
  });
  const [managerUnitId, setManagerUnitId] = useState<string | null>(null);

  useEffect(() => {
    // Prefer don_vi_id from user info; fall back to API call for legacy accounts
    if (user?.don_vi_id) {
      setManagerUnitId(user.don_vi_id);
    } else if (user?.quan_nhan_id) {
      apiClient
        .getPersonnelById(user.quan_nhan_id)
        .then(res => {
          const donViId = res.data?.co_quan_don_vi_id || res.data?.don_vi_truc_thuoc_id;
          if (res.success && donViId) {
            setManagerUnitId(donViId);
          } else {
            message.error('Không thể xác định đơn vị quản lý.');
            setLoading(false);
          }
        })
        .catch(() => {
          message.error('Không thể tải thông tin đơn vị.');
          setLoading(false);
        });
    } else {
      message.error('Không tìm thấy thông tin quản lý. Vui lòng đăng nhập lại.');
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (managerUnitId !== null) {
      loadData();
    }
  }, [managerUnitId, pagination.page, pagination.limit]);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [personnelRes, positionsRes, unitsRes] = await Promise.all([
        apiClient.getPersonnel({
          page: pagination.page,
          limit: pagination.limit,
          search: searchTerm,
          unit_id: managerUnitId ?? undefined,
        }),
        apiClient.getPositions(),
        apiClient.getMyUnits(),
      ]);

      if (personnelRes.success) {
        const data = personnelRes.data;
        const personnelList = (data || []) as PersonnelListItem[];
        setPersonnel(personnelList);
        setPagination(prev => ({
          ...prev,
          total: personnelList.length,
        }));
      }

      if (positionsRes.success) {
        setPositions((positionsRes.data || []) as ManagerPositionRow[]);
      }

      if (unitsRes.success) {
        setUnits((unitsRes.data || []) as UnitOptionRow[]);
      }
    } catch (error) {
      message.error('Không thể tải dữ liệu quân nhân.');
    } finally {
      setLoading(false);
    }
  }, [managerUnitId, pagination.page, pagination.limit, searchTerm]);

  const handleSearch = useCallback(() => {
    setPagination(prev => ({ ...prev, page: 1 }));
    loadData();
  }, [loadData]);

  const handlePageChange = useCallback((page: number) => {
    setPagination(prev => ({ ...prev, page }));
  }, []);

  const handleLimitChange = useCallback((limit: number) => {
    setPagination(prev => ({ ...prev, limit, page: 1 }));
  }, []);

  const handleOpenDialog = (p?: PersonnelListItem) => {
    setViewingPersonnel(p || null);
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setViewingPersonnel(null);
  };

  const handleUpdatePersonnel = async (id: string, data: PersonnelFormValues) => {
    try {
      const res = await apiClient.updatePersonnel(id, { ...data });
      if (res.success) {
        message.success('Cập nhật thông tin quân nhân thành công');
        loadData();
        handleCloseDialog();
      } else {
        message.error(res.message || 'Có lỗi xảy ra khi cập nhật');
      }
    } catch (error: unknown) {
      message.error(getApiErrorMessage(error, 'Có lỗi xảy ra khi cập nhật'));
    }
  };

  // Only show positions actually used by personnel in this unit
  const usedPositionIds = new Set(
    personnel.map(p => p.chuc_vu_id).filter(id => id !== null && id !== undefined)
  );

  // Deduplicate by ID and by name
  const filteredPositionsMapById = new Map<string, ManagerPositionRow>();
  const filteredPositionsMapByName = new Map<string, ManagerPositionRow>();

  positions.forEach(pos => {
    if (!managerUnitId) return;

    if (!usedPositionIds.has(pos.id)) {
      return;
    }

    const coQuanIdFromRelation = pos.DonViTrucThuoc?.co_quan_don_vi_id || pos.DonViTrucThuoc?.CoQuanDonVi?.id;
    const shouldInclude =
      pos.co_quan_don_vi_id === managerUnitId ||
      (!!pos.don_vi_truc_thuoc_id && !!pos.DonViTrucThuoc && coQuanIdFromRelation === managerUnitId);

    if (shouldInclude) {
      const positionName = pos.ten_chuc_vu?.trim() || '';

      if (!filteredPositionsMapById.has(pos.id)) {
        if (!filteredPositionsMapByName.has(positionName)) {
          filteredPositionsMapById.set(pos.id, pos);
          filteredPositionsMapByName.set(positionName, pos);
        }
      }
    }
  });

  const filteredPositions = Array.from(filteredPositionsMapById.values());

  const filteredPersonnel = personnel
    .filter(p => {
      const matchesSearch =
        !searchTerm || (p.ho_ten && p.ho_ten.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchesPosition = !selectedPosition || p.chuc_vu_id === selectedPosition;
      const matchesCapBac = !selectedCapBac || p.cap_bac === selectedCapBac;
      return matchesSearch && matchesPosition && matchesCapBac;
    })
    .sort((a, b) => {
      // Commanders (no sub-unit) sort first
      const aIsManager = !a.don_vi_truc_thuoc_id;
      const bIsManager = !b.don_vi_truc_thuoc_id;

      if (aIsManager && !bIsManager) return -1;
      if (!aIsManager && bIsManager) return 1;

      return 0;
    });

  const totalPersonnel = pagination.total;

  const totalSubUnits = units.filter(u => {
    if (u.id === managerUnitId) {
      return false;
    }
    return !!(u.co_quan_don_vi_id || u.CoQuanDonVi);
  }).length;

  const coQuanDonViList = useMemo(
    () => units.filter(u => !u.co_quan_don_vi_id && !u.CoQuanDonVi),
    [units]
  );
  const donViTrucThuocList = useMemo(
    () => units.filter(u => !!(u.co_quan_don_vi_id || u.CoQuanDonVi)),
    [units]
  );

  const uniquePositionIds = new Set(
    personnel.map(p => p.chuc_vu_id).filter(id => id !== null && id !== undefined)
  );
  const uniquePositions = uniquePositionIds.size;
  const statTextColor = theme === 'dark' ? '#e5e7eb' : '#0f172a';
  const statSubTextColor = theme === 'dark' ? '#cbd5e1' : '#475569';
  const iconContainerBg = theme === 'dark' ? 'rgba(148, 163, 184, 0.14)' : '#f1f5f9';
  const iconColor = theme === 'dark' ? '#cbd5e1' : '#475569';
  const iconShadow =
    theme === 'dark' ? '0 1px 3px rgba(0, 0, 0, 0.45)' : '0 1px 3px rgba(0, 0, 0, 0.05)';
  const cardShadow =
    theme === 'dark' ? '0 1px 6px rgba(0, 0, 0, 0.35)' : '0 1px 4px rgba(0, 0, 0, 0.06)';

  if (loading && personnel.length === 0 && managerUnitId !== null) {
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
            <Link href="/manager/dashboard">
              <HomeOutlined />
            </Link>
          </Breadcrumb.Item>
          <Breadcrumb.Item>Quản lý quân nhân đơn vị</Breadcrumb.Item>
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
            <Title level={1} style={{ margin: 0 }}>
              Quản lý quân nhân đơn vị
            </Title>
            <Text type="secondary" style={{ display: 'block', marginTop: '8px' }}>
              Xem và quản lý thông tin quân nhân thuộc đơn vị của bạn
            </Text>
          </div>
          <Button icon={<SyncOutlined spin={loading} />} onClick={loadData} disabled={loading}>
            Làm mới
          </Button>
        </div>

        {/* Stats Cards */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
            gap: '16px',
            marginBottom: '24px',
            alignItems: 'stretch',
          }}
        >
          <Card
            hoverable
            style={{
              borderRadius: '10px',
              boxShadow: cardShadow,
              transition: 'all 0.3s ease',
              height: '100%',
            }}
            styles={{ body: { padding: '20px', height: '100%' } }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', minHeight: 84 }}>
              <div
                style={{
                  width: '56px',
                  height: '56px',
                  borderRadius: '12px',
                  background: iconContainerBg,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: iconShadow,
                }}
              >
                <UserOutlined
                  style={{
                    fontSize: '26px',
                    color: iconColor,
                  }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <Text
                  type="secondary"
                  style={{
                    fontSize: '14px',
                    fontWeight: 500,
                    display: 'block',
                    marginBottom: '4px',
                    color: statSubTextColor,
                  }}
                >
                  Tổng quân nhân
                </Text>
                <div
                  style={{
                    fontSize: '32px',
                    fontWeight: 'bold',
                    color: statTextColor,
                    lineHeight: '1.1',
                  }}
                >
                  {totalPersonnel}
                </div>
              </div>
            </div>
          </Card>

          <Card
            hoverable
            style={{
              borderRadius: '10px',
              boxShadow: cardShadow,
              transition: 'all 0.3s ease',
              height: '100%',
            }}
            styles={{ body: { padding: '20px', height: '100%' } }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', minHeight: 84 }}>
              <div
                style={{
                  width: '56px',
                  height: '56px',
                  borderRadius: '12px',
                  background: iconContainerBg,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: iconShadow,
                }}
              >
                <ApartmentOutlined
                  style={{
                    fontSize: '26px',
                    color: iconColor,
                  }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <Text
                  type="secondary"
                  style={{
                    fontSize: '14px',
                    fontWeight: 500,
                    display: 'block',
                    marginBottom: '4px',
                    color: statSubTextColor,
                  }}
                >
                  Số đơn vị trực thuộc
                </Text>
                <div style={{ fontSize: '28px', fontWeight: 'bold', color: statTextColor }}>
                  {totalSubUnits}
                </div>
              </div>
            </div>
          </Card>

          <Card
            hoverable
            style={{
              borderRadius: '10px',
              boxShadow: cardShadow,
              transition: 'all 0.3s ease',
              height: '100%',
            }}
            styles={{ body: { padding: '20px', height: '100%' } }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', minHeight: 84 }}>
              <div
                style={{
                  width: '56px',
                  height: '56px',
                  borderRadius: '12px',
                  background: iconContainerBg,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: iconShadow,
                }}
              >
                <SafetyCertificateOutlined
                  style={{
                    fontSize: '26px',
                    color: iconColor,
                  }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <Text
                  type="secondary"
                  style={{
                    fontSize: '14px',
                    fontWeight: 500,
                    display: 'block',
                    marginBottom: '4px',
                    color: statSubTextColor,
                  }}
                >
                  Số chức vụ
                </Text>
                <div style={{ fontSize: '28px', fontWeight: 'bold', color: statTextColor }}>
                  {uniquePositions}
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* Filters */}
        <Card style={{ marginBottom: '24px', padding: '16px' }}>
          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
            <Input
              placeholder="Tìm kiếm theo tên..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              size="large"
              style={{ flex: 1, minWidth: '200px' }}
            />
            <Select
              value={selectedCapBac}
              onChange={setSelectedCapBac}
              size="large"
              style={{ width: 200 }}
              placeholder="Lọc theo Cấp bậc"
              allowClear
            >
              <Option value="">Tất cả cấp bậc</Option>
              {MILITARY_RANKS.map(rank => (
                <Option key={rank} value={rank}>
                  {rank}
                </Option>
              ))}
            </Select>
            <Select
              value={selectedPosition}
              onChange={setSelectedPosition}
              size="large"
              style={{ width: 256 }}
              placeholder="Lọc theo Chức vụ"
              allowClear
            >
              <Option value="">Tất cả chức vụ ({filteredPositions.length})</Option>
              {filteredPositions.map(position => (
                <Option key={position.id} value={position.id.toString()}>
                  {position.ten_chuc_vu}
                </Option>
              ))}
            </Select>
          </div>
        </Card>

        {/* Table */}
        {loading ? (
          <Card style={{ padding: '32px', textAlign: 'center' }}>
            <Text type="secondary">Đang tải dữ liệu...</Text>
          </Card>
        ) : (
          <Card style={{ padding: 0, marginBottom: '24px' }}>
            <PersonnelTable
              personnel={filteredPersonnel}
              sttOffset={(pagination.page - 1) * pagination.limit}
              onEdit={handleOpenDialog}
              onRefresh={loadData}
              readOnly={false}
              viewLinkPrefix="/manager/personnel"
            />
          </Card>
        )}

        {/* Pagination */}
        {pagination.total > 0 && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
            <Pagination
              current={pagination.page}
              pageSize={pagination.limit}
              total={pagination.total}
              showSizeChanger
              showQuickJumper
              showLessItems
              showTotal={(total, range) => `${range[0]}-${range[1]} của ${total} quân nhân`}
              pageSizeOptions={DEFAULT_ANTD_TABLE_PAGINATION.pageSizeOptions}
              onChange={(page, pageSize) => {
                if (pageSize !== pagination.limit) {
                  handleLimitChange(pageSize);
                } else {
                  handlePageChange(page);
                }
              }}
            />
          </div>
        )}

        {/* Dialog for viewing/editing details */}
        <Modal
          open={dialogOpen}
          onCancel={handleCloseDialog}
          footer={null}
          width={800}
          style={{ maxHeight: '90vh' }}
          title={
            <span>
              <EyeOutlined style={{ marginRight: '8px' }} />
              {viewingPersonnel ? 'Xem/Chỉnh sửa thông tin Quân nhân' : 'Thông tin Quân nhân'}
            </span>
          }
        >
          {viewingPersonnel && (
            <PersonnelForm
              personnel={viewingPersonnel}
              coQuanDonViList={coQuanDonViList}
              donViTrucThuocList={donViTrucThuocList}
              positions={positions}
              onSuccess={data => handleUpdatePersonnel(String(viewingPersonnel.id), data)}
              onClose={handleCloseDialog}
              readOnly={false}
            />
          )}
        </Modal>
      </div>
    </ConfigProvider>
  );
}
