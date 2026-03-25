// @ts-nocheck
'use client';

import { useEffect, useState, useCallback } from 'react';
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
} from 'antd';
import { getApiErrorMessage } from '@/lib/apiError';

import { useTheme } from '@/components/theme-provider';
import {
  SyncOutlined,
  HomeOutlined,
  UserOutlined,
  ApartmentOutlined,
  SafetyCertificateOutlined,
  EyeOutlined,
} from '@ant-design/icons';
import { PersonnelTable } from '@/components/personnel/personnel-table';
import { PersonnelForm } from '@/components/personnel/personnel-form';
import { apiClient } from '@/lib/api-client';
import { MILITARY_RANKS } from '@/lib/constants/military-ranks';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';

const { Title, Text } = Typography;
const { Option } = Select;

export default function ManagerPersonnelPage() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const [personnel, setPersonnel] = useState([]);
  const [units, setUnits] = useState([]);
  const [positions, setPositions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [viewingPersonnel, setViewingPersonnel] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPosition, setSelectedPosition] = useState('');
  const [selectedCapBac, setSelectedCapBac] = useState('');
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
  });
  const [managerUnitId, setManagerUnitId] = useState<string | null>(null);

  // Lấy thông tin đơn vị của manager từ auth context
  useEffect(() => {
    // Ưu tiên lấy don_vi_id trực tiếp từ user info
    if (user?.don_vi_id) {
      setManagerUnitId(user.don_vi_id);
    } else if (user?.quan_nhan_id) {
      // Fallback: Gọi API nếu chưa có don_vi_id (cho tài khoản đăng nhập cũ)
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

  // Load dữ liệu khi có managerUnitId
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
          unit_id: managerUnitId,
        }),
        apiClient.getPositions(),
        apiClient.getMyUnits(),
      ]);

      if (personnelRes.success) {
        const data = personnelRes.data;
        setPersonnel(data?.personnel || data || []);
        setPagination(prev => ({
          ...prev,
          total: data?.pagination?.total || data?.total || 0,
        }));
      }

      if (positionsRes.success) {
        setPositions(positionsRes.data || []);
      }

      if (unitsRes.success) {
        setUnits(unitsRes.data || []);
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

  const handleOpenDialog = (p?: any) => {
    setViewingPersonnel(p || null);
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setViewingPersonnel(null);
  };

  const handleUpdatePersonnel = async (id: string, data: any) => {
    try {
      const res = await apiClient.updatePersonnel(id, data);
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

  // Filter positions: Chỉ hiển thị các chức vụ đang được sử dụng bởi quân nhân trong đơn vị
  // Lấy danh sách chức vụ ID từ quân nhân thực tế
  const usedPositionIds = new Set(
    personnel.map(p => p.chuc_vu_id).filter(id => id !== null && id !== undefined)
  );

  // Lọc các chức vụ từ positions dựa trên:
  // 1. Chức vụ đang được sử dụng bởi quân nhân (có trong usedPositionIds)
  // 2. Và thuộc về đơn vị của manager
  // Sử dụng Map với ID làm key để loại bỏ trùng lặp theo ID
  const filteredPositionsMapById = new Map();
  // Sử dụng Map với tên làm key để loại bỏ trùng lặp theo tên
  const filteredPositionsMapByName = new Map();

  positions.forEach(pos => {
    if (!managerUnitId) return;

    // Chỉ thêm nếu chức vụ đang được sử dụng
    if (!usedPositionIds.has(pos.id)) {
      return;
    }

    let shouldInclude = false;

    // 1. Chức vụ thuộc trực tiếp cơ quan đơn vị (co_quan_don_vi_id = managerUnitId)
    if (pos.co_quan_don_vi_id === managerUnitId) {
      shouldInclude = true;
    }

    // 2. Chức vụ thuộc đơn vị trực thuộc của cơ quan đơn vị
    // Sử dụng DonViTrucThuoc relation có sẵn trong position
    if (!shouldInclude && pos.don_vi_truc_thuoc_id && pos.DonViTrucThuoc) {
      // Kiểm tra co_quan_don_vi_id từ DonViTrucThuoc relation
      const coQuanIdFromRelation =
        pos.DonViTrucThuoc.co_quan_don_vi_id || pos.DonViTrucThuoc.CoQuanDonVi?.id;
      if (coQuanIdFromRelation === managerUnitId) {
        shouldInclude = true;
      }
    }

    // Chỉ thêm vào Map nếu:
    // - Thuộc đơn vị của manager
    // - Chưa có trong Map theo ID (loại bỏ trùng lặp theo ID)
    // - Chưa có trong Map theo tên (loại bỏ trùng lặp theo tên)
    if (shouldInclude) {
      const positionName = pos.ten_chuc_vu?.trim() || '';

      // Kiểm tra trùng lặp theo ID
      if (!filteredPositionsMapById.has(pos.id)) {
        // Kiểm tra trùng lặp theo tên
        if (!filteredPositionsMapByName.has(positionName)) {
          filteredPositionsMapById.set(pos.id, pos);
          filteredPositionsMapByName.set(positionName, pos);
        }
      }
    }
  });

  // Chuyển Map thành mảng để sử dụng (chỉ lấy từ Map theo ID để đảm bảo không trùng)
  const filteredPositions = Array.from(filteredPositionsMapById.values());

  const filteredPersonnel = personnel
    .filter(p => {
      const matchesSearch =
        !searchTerm || (p.ho_ten && p.ho_ten.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchesPosition = !selectedPosition || p.chuc_vu_id === parseInt(selectedPosition);
      const matchesCapBac = !selectedCapBac || p.cap_bac === selectedCapBac;
      return matchesSearch && matchesPosition && matchesCapBac;
    })
    .sort((a, b) => {
      // Những người không có đơn vị trực thuộc (chỉ huy) lên đầu
      const aIsManager = !a.don_vi_truc_thuoc_id;
      const bIsManager = !b.don_vi_truc_thuoc_id;

      if (aIsManager && !bIsManager) return -1;
      if (!aIsManager && bIsManager) return 1;

      // Nếu cùng loại thì giữ nguyên thứ tự
      return 0;
    });

  const totalPersonnel = pagination.total;

  const totalSubUnits = units.filter((u: any) => {
    if (u.id === managerUnitId) {
      return false;
    }
    return !!(u.co_quan_don_vi_id || u.CoQuanDonVi);
  }).length;

  const uniquePositionIds = new Set(
    personnel.map(p => p.chuc_vu_id).filter(id => id !== null && id !== undefined)
  );
  const uniquePositions = uniquePositionIds.size;
  const statTextColor = theme === 'dark' ? '#e5e7eb' : '#0f172a';
  const statSubTextColor = theme === 'dark' ? '#cbd5e1' : '#475569';
  const iconBgBlue = theme === 'dark' ? '#1e3a8a' : '#e6f0ff';
  const iconBgGreen = theme === 'dark' ? '#0b3d2e' : '#e8f5e9';
  const iconBgPurple = theme === 'dark' ? '#3b0764' : '#f3e8ff';
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
          <Breadcrumb.Item>Quản lý Quân nhân Đơn vị</Breadcrumb.Item>
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
              Quản lý Quân nhân Đơn vị
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
          }}
        >
          <Card
            hoverable
            style={{
              borderRadius: '10px',
              boxShadow: cardShadow,
              transition: 'all 0.3s ease',
            }}
            bodyStyle={{ padding: '20px' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div
                style={{
                  width: '56px',
                  height: '56px',
                  borderRadius: '12px',
                  background: iconBgBlue,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: iconShadow,
                }}
              >
                <UserOutlined
                  style={{
                    fontSize: '26px',
                    color: theme === 'dark' ? '#93c5fd' : '#1d4ed8',
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
            }}
            bodyStyle={{ padding: '20px' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div
                style={{
                  width: '56px',
                  height: '56px',
                  borderRadius: '12px',
                  background: iconBgGreen,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: iconShadow,
                }}
              >
                <ApartmentOutlined
                  style={{
                    fontSize: '26px',
                    color: theme === 'dark' ? '#6ee7b7' : '#0f9d58',
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
            }}
            bodyStyle={{ padding: '20px' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div
                style={{
                  width: '56px',
                  height: '56px',
                  borderRadius: '12px',
                  background: iconBgPurple,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: iconShadow,
                }}
              >
                <SafetyCertificateOutlined
                  style={{
                    fontSize: '26px',
                    color: theme === 'dark' ? '#c4b5fd' : '#7c3aed',
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
              onEdit={handleOpenDialog}
              onRefresh={loadData}
              readOnly={false}
              viewLinkPrefix="/manager/personnel"
            />
          </Card>
        )}

        {/* Pagination */}
        {pagination.total > 0 && (
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '16px',
            }}
          >
            <Text type="secondary">
              Hiển thị {(pagination.page - 1) * pagination.limit + 1} -{' '}
              {Math.min(pagination.page * pagination.limit, pagination.total)} trong tổng số{' '}
              {pagination.total} quân nhân
            </Text>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Select
                value={pagination.limit.toString()}
                onChange={v => handleLimitChange(parseInt(v))}
                style={{ width: 80 }}
              >
                <Option value="10">10</Option>
                <Option value="20">20</Option>
                <Option value="50">50</Option>
              </Select>
              <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                <Button
                  onClick={() => handlePageChange(pagination.page - 1)}
                  disabled={pagination.page <= 1}
                >
                  Trước
                </Button>
                <span style={{ padding: '0 12px', fontSize: '14px' }}>
                  {pagination.page} / {Math.ceil(pagination.total / pagination.limit)}
                </span>
                <Button
                  onClick={() => handlePageChange(pagination.page + 1)}
                  disabled={pagination.page >= Math.ceil(pagination.total / pagination.limit)}
                >
                  Sau
                </Button>
              </div>
            </div>
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
              units={units}
              positions={positions}
              onSuccess={data => handleUpdatePersonnel(viewingPersonnel.id, data)}
              onClose={handleCloseDialog}
              readOnly={false}
            />
          )}
        </Modal>
      </div>
    </ConfigProvider>
  );
}
