// @ts-nocheck
'use client';

import React, { useEffect, useState } from 'react';
import {
  Table,
  Button,
  Input,
  Select,
  Card,
  Space,
  Breadcrumb,
  Typography,
  message,
  ConfigProvider,
  theme as antdTheme,
  Skeleton,
  Empty,
} from 'antd';
import { useTheme } from '@/components/ThemeProvider';
import {
  PlusOutlined,
  HomeOutlined,
  SearchOutlined,
  EyeOutlined,
  FilterOutlined,
} from '@ant-design/icons';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/apiClient';
import { MILITARY_RANKS } from '@/lib/constants/military-ranks';
import { DEFAULT_PAGE_SIZE, PAGE_SIZE_OPTIONS } from '@/lib/constants/pagination.constants';

const { Title, Text } = Typography;

export default function PersonnelPage() {
  const { theme } = useTheme();
  const [personnel, setPersonnel] = useState([]);
  const [units, setUnits] = useState<{
    coQuanDonVi: any[];
    donViTrucThuocMap: Record<string, any[]>;
  }>({ coQuanDonVi: [], donViTrucThuocMap: {} });
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCoQuanDonVi, setSelectedCoQuanDonVi] = useState<string | 'ALL'>('ALL');
  const [selectedDonViTrucThuoc, setSelectedDonViTrucThuoc] = useState<string | 'ALL' | null>(null);
  const [selectedChucVu, setSelectedChucVu] = useState<string | 'ALL'>('ALL');
  const [chucVuSearchValue, setChucVuSearchValue] = useState<string>('');
  const [selectedCapBac, setSelectedCapBac] = useState<string | 'ALL'>('ALL');
  const [positions, setPositions] = useState<any[]>([]);
  const [tableLoading, setTableLoading] = useState(false);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: DEFAULT_PAGE_SIZE,
    total: 0,
  });
  const router = useRouter();

  useEffect(() => {
    loadData();
  }, []); // Chỉ load một lần khi mount, không load lại khi pagination thay đổi

  async function loadData() {
    try {
      setTableLoading(true);

      // 1. Lấy tất cả danh sách quân nhân (không pagination) để paginate ở client-side
      const personnelRes = await apiClient.getPersonnel({
        page: 1,
        limit: 10000, // Lấy tất cả để paginate ở client
      });
      if (personnelRes.success) {
        const personnelData = (personnelRes.data?.personnel || []).map(p => {
          const coQuanDonViRelation =
            p.CoQuanDonVi ||
            p.DonViTrucThuoc?.CoQuanDonVi ||
            p.DonVi?.CoQuanDonVi ||
            (typeof p.co_quan_don_vi === 'object' ? p.co_quan_don_vi : null) ||
            null;

          const donViTrucThuocRelation =
            p.DonViTrucThuoc ||
            (p.DonVi && (p.DonVi.co_quan_don_vi_id || p.DonVi.CoQuanDonVi) ? p.DonVi : null) ||
            (typeof p.don_vi_truc_thuoc === 'object' ? p.don_vi_truc_thuoc : null);

          const coQuanTen = coQuanDonViRelation?.ten_don_vi || coQuanDonViRelation?.ten || null;
          const donViTen =
            donViTrucThuocRelation?.ten_don_vi || donViTrucThuocRelation?.ten || coQuanTen || null;

          let donViDisplay = '-';
          if (donViTrucThuocRelation?.ten_don_vi || donViTrucThuocRelation?.ten) {
            const tenDonVi = donViTrucThuocRelation.ten_don_vi || donViTrucThuocRelation.ten;
            donViDisplay = coQuanTen ? `${tenDonVi} (${coQuanTen})` : tenDonVi;
          } else if (coQuanTen) {
            donViDisplay = coQuanTen;
          }

          const resolvedCoQuanId =
            p.co_quan_don_vi_id ||
            donViTrucThuocRelation?.co_quan_don_vi_id ||
            coQuanDonViRelation?.id ||
            coQuanDonViRelation?.co_quan_don_vi_id ||
            null;

          const resolvedDonViTrucThuocId =
            p.don_vi_truc_thuoc_id ||
            donViTrucThuocRelation?.id ||
            donViTrucThuocRelation?.don_vi_truc_thuoc_id ||
            null;

          return {
            ...p,
            don_vi_name: donViTen || '-',
            don_vi_display: donViDisplay,
            chuc_vu_name: p.ChucVu?.ten_chuc_vu || '-',
            co_quan_don_vi_id: resolvedCoQuanId,
            don_vi_truc_thuoc_id: resolvedDonViTrucThuocId,
            DonViTrucThuoc: donViTrucThuocRelation,
            CoQuanDonVi: coQuanDonViRelation,
          };
        });

        setPersonnel(personnelData);

        // Cập nhật pagination total từ API (tổng số records)
        const total = personnelRes.data?.pagination?.total || personnelData.length;
        setPagination(prev => ({
          ...prev,
          total: total,
        }));
      } else {
        message.error(personnelRes.message || 'Không thể tải danh sách quân nhân');
      }

      // 2. Lấy danh sách đơn vị (không chặn khi lỗi)
      try {
        const unitsRes = await apiClient.getUnits();
        if (unitsRes.success) {
          const unitsData = unitsRes.data || [];
          const coQuanDonViList: any[] = [];
          const donViTrucThuocMap: Record<string, any[]> = {};

          unitsData.forEach((unit: any) => {
            if (unit.co_quan_don_vi_id || unit.CoQuanDonVi) {
              const parentId = unit.co_quan_don_vi_id || unit.CoQuanDonVi?.id;
              if (!donViTrucThuocMap[parentId]) {
                donViTrucThuocMap[parentId] = [];
              }
              donViTrucThuocMap[parentId].push({
                id: unit.id,
                ten_don_vi: unit.ten_don_vi,
                ma_don_vi: unit.ma_don_vi || '',
                type: 'don_vi_truc_thuoc',
              });
            }
          });

          unitsData.forEach((unit: any) => {
            if (!unit.co_quan_don_vi_id && !unit.CoQuanDonVi) {
              coQuanDonViList.push({
                id: unit.id,
                ten_don_vi: unit.ten_don_vi,
                ma_don_vi: unit.ma_don_vi || '',
                type: 'co_quan_don_vi',
                donViTrucThuoc: donViTrucThuocMap[unit.id] || [],
              });
            }
          });

          setUnits({ coQuanDonVi: coQuanDonViList, donViTrucThuocMap });
        } else {
          setUnits({ coQuanDonVi: [], donViTrucThuocMap: {} });
        }
      } catch (unitsError) {
        setUnits({ coQuanDonVi: [], donViTrucThuocMap: {} });
      }

      // 3. Lấy danh sách chức vụ
      try {
        const positionsRes = await apiClient.getPositions();
        if (positionsRes.success) {
          setPositions(positionsRes.data || []);
        } else {
          setPositions([]);
        }
      } catch (positionsError) {
        setPositions([]);
      }
    } catch (error) {
      message.error('Không thể tải dữ liệu');
    } finally {
      setLoading(false);
      setTableLoading(false);
    }
  }

  const filteredPersonnel = personnel
    .filter(p => {
      const matchesSearch =
        p.ho_ten?.toLowerCase().includes(searchTerm.toLowerCase()) || p.cccd?.includes(searchTerm);

      // Filter theo cơ quan đơn vị
      let matchesCoQuanDonVi = true;
      if (selectedCoQuanDonVi && selectedCoQuanDonVi !== 'ALL') {
        // Nếu quân nhân thuộc cơ quan đơn vị trực tiếp
        if (p.co_quan_don_vi_id === selectedCoQuanDonVi) {
          matchesCoQuanDonVi = true;
        }
        // Nếu quân nhân thuộc đơn vị trực thuộc, check cơ quan đơn vị cha
        else if (p.DonViTrucThuoc?.CoQuanDonVi?.id === selectedCoQuanDonVi) {
          matchesCoQuanDonVi = true;
        }
        // Nếu có co_quan_don_vi_id từ relation
        else if (p.DonViTrucThuoc?.co_quan_don_vi_id === selectedCoQuanDonVi) {
          matchesCoQuanDonVi = true;
        } else {
          matchesCoQuanDonVi = false;
        }
      }

      // Filter theo đơn vị trực thuộc
      const matchesDonViTrucThuoc =
        !selectedDonViTrucThuoc ||
        selectedDonViTrucThuoc === 'ALL' ||
        p.don_vi_truc_thuoc_id === selectedDonViTrucThuoc;

      const matchesChucVu =
        !selectedChucVu || selectedChucVu === 'ALL' || p.chuc_vu_id === selectedChucVu;

      const matchesCapBac =
        !selectedCapBac || selectedCapBac === 'ALL' || p.cap_bac === selectedCapBac;

      return (
        matchesSearch &&
        matchesCoQuanDonVi &&
        matchesDonViTrucThuoc &&
        matchesChucVu &&
        matchesCapBac
      );
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

  // Lấy danh sách đơn vị trực thuộc để hiển thị (filter theo cơ quan đơn vị đã chọn hoặc tất cả)
  const availableDonViTrucThuoc =
    selectedCoQuanDonVi && selectedCoQuanDonVi !== 'ALL'
      ? units.donViTrucThuocMap[selectedCoQuanDonVi] || []
      : [];

  const columns = [
    {
      title: 'STT',
      key: 'index',
      width: 60,
      align: 'center',
      render: (_: any, __: any, index: number) =>
        (pagination.current - 1) * pagination.pageSize + index + 1,
    },
    {
      title: 'Họ tên',
      dataIndex: 'ho_ten',
      key: 'ho_ten',
      width: 150,
      ellipsis: true,
    },
    {
      title: 'Cơ quan đơn vị',
      key: 'co_quan_don_vi',
      width: 180,
      ellipsis: true,
      render: (_: any, record: any) => {
        const coQuanDonVi =
          record.CoQuanDonVi?.ten_don_vi || record.DonViTrucThuoc?.CoQuanDonVi?.ten_don_vi;
        return coQuanDonVi || '-';
      },
    },
    {
      title: 'Đơn vị trực thuộc',
      key: 'don_vi_truc_thuoc',
      width: 180,
      ellipsis: true,
      render: (_: any, record: any) => {
        const donViTrucThuoc = record.DonViTrucThuoc?.ten_don_vi;
        return donViTrucThuoc || '-';
      },
    },
    {
      title: 'Cấp bậc',
      key: 'cap_bac',
      width: 120,
      align: 'center',
      ellipsis: true,
      render: (_: any, record: any) => {
        const capBac = record.cap_bac;
        return capBac || '-';
      },
    },
    {
      title: 'Chức vụ',
      key: 'chuc_vu',
      width: 180,
      ellipsis: true,
      render: (_: any, record: any) => {
        const chucVu = record.chuc_vu_name;
        return chucVu || '-';
      },
    },
    {
      title: 'Hành động',
      key: 'action',
      width: 100,
      align: 'center',
      render: (_, record) => (
        <Button
          type="primary"
          icon={<EyeOutlined />}
          size="small"
          onClick={() => router.push(`/admin/personnel/${record.id}`)}
        >
          Xem
        </Button>
      ),
    },
  ];

  if (loading && personnel.length === 0) {
    return (
      <div className="p-6">
        <Skeleton active paragraph={{ rows: 2 }} className="mb-6" />
        <Skeleton active paragraph={{ rows: 10 }} />
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
              title: 'Quản lý Quân nhân',
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
              Quản lý Quân nhân
            </Title>
            <Text type="secondary">
              Quản lý thông tin quân nhân trong hệ thống ({filteredPersonnel.length} quân nhân)
            </Text>
          </div>
          <Space>
            <Link href="/admin/personnel/create">
              <Button type="primary" size="large" icon={<PlusOutlined />}>
                Thêm Quân nhân
              </Button>
            </Link>
          </Space>
        </div>

        {/* Filters */}
        <Card style={{ marginBottom: 24 }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: '16px',
            }}
          >
            <div>
              <Text type="secondary" style={{ marginBottom: 8, display: 'block' }}>
                Tìm kiếm
              </Text>
              <Input
                placeholder="Tìm kiếm theo tên..."
                prefix={<SearchOutlined />}
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                size="large"
                allowClear
              />
            </div>
            <div>
              <Text type="secondary" style={{ marginBottom: 8, display: 'block' }}>
                Cơ quan đơn vị
              </Text>
              <Select
                value={selectedCoQuanDonVi}
                onChange={value => {
                  const newValue = value || 'ALL';
                  setSelectedCoQuanDonVi(newValue);
                  setSelectedDonViTrucThuoc(newValue !== 'ALL' ? 'ALL' : null);
                  setSelectedChucVu('ALL'); // Reset chức vụ
                  setChucVuSearchValue(''); // Clear search value khi đổi cơ quan đơn vị
                }}
                onClear={() => {
                  setSelectedCoQuanDonVi('ALL');
                  setSelectedDonViTrucThuoc(null);
                  setSelectedChucVu('ALL'); // Reset chức vụ
                  setChucVuSearchValue(''); // Clear search value
                }}
                style={{ width: '100%' }}
                size="large"
                showSearch
                placeholder="Chọn hoặc tìm kiếm cơ quan đơn vị..."
                optionFilterProp="label"
                filterOption={(input, option: any) => {
                  const label = String(option?.label || option?.children || '');
                  const value = String(option?.value || '');
                  const searchText = input.toLowerCase();
                  return (
                    label.toLowerCase().includes(searchText) ||
                    value.toLowerCase().includes(searchText)
                  );
                }}
                suffixIcon={<FilterOutlined />}
                allowClear
              >
                <Select.Option value="ALL" label="Tất cả cơ quan đơn vị">
                  Tất cả cơ quan đơn vị ({units.coQuanDonVi.length})
                </Select.Option>
                {units.coQuanDonVi.map((coQuanDonVi: any) => {
                  const label = coQuanDonVi.ma_don_vi
                    ? `${coQuanDonVi.ten_don_vi} (${coQuanDonVi.ma_don_vi})`
                    : coQuanDonVi.ten_don_vi;
                  return (
                    <Select.Option key={coQuanDonVi.id} value={coQuanDonVi.id} label={label}>
                      {label}
                    </Select.Option>
                  );
                })}
              </Select>
            </div>
            <div>
              <Text type="secondary" style={{ marginBottom: 8, display: 'block' }}>
                Đơn vị trực thuộc
              </Text>
              <Select
                value={
                  selectedCoQuanDonVi && selectedCoQuanDonVi !== 'ALL'
                    ? selectedDonViTrucThuoc || 'ALL'
                    : undefined
                }
                onChange={value => {
                  setSelectedDonViTrucThuoc(value || 'ALL');
                  setSelectedChucVu('ALL'); // Reset chức vụ
                  setChucVuSearchValue(''); // Clear search value khi đổi đơn vị trực thuộc
                }}
                onClear={() => {
                  setSelectedDonViTrucThuoc('ALL');
                  setSelectedChucVu('ALL'); // Reset chức vụ
                  setChucVuSearchValue(''); // Clear search value
                }}
                style={{ width: '100%' }}
                size="large"
                showSearch
                placeholder={
                  selectedCoQuanDonVi && selectedCoQuanDonVi !== 'ALL'
                    ? 'Chọn hoặc tìm kiếm đơn vị trực thuộc...'
                    : 'Chọn cơ quan đơn vị trước'
                }
                optionFilterProp="label"
                filterOption={(input, option: any) => {
                  const label = String(option?.label || option?.children || '');
                  const value = String(option?.value || '');
                  const searchText = input.toLowerCase();
                  return (
                    label.toLowerCase().includes(searchText) ||
                    value.toLowerCase().includes(searchText)
                  );
                }}
                suffixIcon={<FilterOutlined />}
                allowClear
                disabled={!selectedCoQuanDonVi || selectedCoQuanDonVi === 'ALL'}
              >
                {selectedCoQuanDonVi && selectedCoQuanDonVi !== 'ALL' && (
                  <Select.Option value="ALL" label="Tất cả đơn vị trực thuộc">
                    Tất cả đơn vị trực thuộc ({availableDonViTrucThuoc.length})
                  </Select.Option>
                )}
                {availableDonViTrucThuoc.map((donVi: any) => {
                  const label = donVi.ma_don_vi
                    ? `${donVi.ten_don_vi} (${donVi.ma_don_vi})`
                    : donVi.ten_don_vi;
                  return (
                    <Select.Option key={donVi.id} value={donVi.id} label={label}>
                      {label}
                    </Select.Option>
                  );
                })}
              </Select>
            </div>
            <div>
              <Text type="secondary" style={{ marginBottom: 8, display: 'block' }}>
                Cấp bậc
              </Text>
              <Select
                value={selectedCapBac === 'ALL' ? undefined : selectedCapBac}
                onChange={value => {
                  setSelectedCapBac(value || 'ALL');
                }}
                onClear={() => {
                  setSelectedCapBac('ALL');
                }}
                style={{ width: '100%' }}
                size="large"
                showSearch
                placeholder="Lọc theo Cấp bậc"
                optionFilterProp="label"
                filterOption={(input, option: any) => {
                  const label = String(option?.label || option?.children || '');
                  const searchText = input.toLowerCase();
                  return label.toLowerCase().includes(searchText);
                }}
                suffixIcon={<FilterOutlined />}
                allowClear
              >
                <Select.Option value="ALL" label="Tất cả cấp bậc">
                  Tất cả cấp bậc
                </Select.Option>
                {MILITARY_RANKS.map(rank => (
                  <Select.Option key={rank} value={rank} label={rank}>
                    {rank}
                  </Select.Option>
                ))}
              </Select>
            </div>
            <div>
              <Text type="secondary" style={{ marginBottom: 8, display: 'block' }}>
                Chức vụ
              </Text>
              <Select
                value={selectedChucVu === 'ALL' ? undefined : selectedChucVu}
                onChange={value => {
                  setSelectedChucVu(value || 'ALL');
                  setChucVuSearchValue(''); // Clear search when selecting
                }}
                onClear={() => {
                  setSelectedChucVu('ALL');
                  setChucVuSearchValue('');
                }}
                searchValue={chucVuSearchValue}
                onSearch={setChucVuSearchValue}
                style={{ width: '100%' }}
                size="large"
                showSearch
                placeholder="Lọc theo Chức vụ"
                optionFilterProp="label"
                filterOption={(input, option: any) => {
                  const label = String(option?.label || option?.children || '');
                  const searchText = input.toLowerCase();
                  return label.toLowerCase().includes(searchText);
                }}
                suffixIcon={<FilterOutlined />}
                allowClear
              >
                {(() => {
                  // Filter positions dựa trên frontend
                  const filteredPositions = positions.filter(pos => {
                    // Nếu không chọn cơ quan đơn vị, hiển thị tất cả
                    if (!selectedCoQuanDonVi || selectedCoQuanDonVi === 'ALL') return true;

                    // Nếu chọn đơn vị trực thuộc cụ thể, chỉ hiển thị chức vụ của đơn vị đó
                    if (selectedDonViTrucThuoc && selectedDonViTrucThuoc !== 'ALL') {
                      return pos.don_vi_truc_thuoc_id === selectedDonViTrucThuoc;
                    }

                    // Nếu chỉ chọn cơ quan đơn vị, hiển thị:
                    // 1. Chức vụ có co_quan_don_vi_id = selectedCoQuanDonVi
                    if (pos.co_quan_don_vi_id === selectedCoQuanDonVi) return true;

                    // 2. Chức vụ của đơn vị trực thuộc thuộc cơ quan đơn vị đó
                    const donViTrucThuocList = units.donViTrucThuocMap[selectedCoQuanDonVi] || [];
                    return donViTrucThuocList.some(unit => unit.id === pos.don_vi_truc_thuoc_id);
                  });

                  return (
                    <>
                      <Select.Option value="ALL" label="Tất cả chức vụ">
                        Tất cả chức vụ ({filteredPositions.length})
                      </Select.Option>
                      {filteredPositions.map(pos => (
                        <Select.Option key={pos.id} value={pos.id} label={pos.ten_chuc_vu}>
                          {pos.ten_chuc_vu}
                        </Select.Option>
                      ))}
                    </>
                  );
                })()}
              </Select>
            </div>
          </div>
        </Card>

        {/* Table */}
        <Card>
          <Table
            columns={columns}
            dataSource={filteredPersonnel}
            rowKey="id"
            loading={loading}
            pagination={{
              current: pagination.current,
              pageSize: pagination.pageSize,
              total: filteredPersonnel.length, // Dùng filteredPersonnel.length thay vì total từ API
              showSizeChanger: true,
              showTotal: (total, range) => `${range[0]}-${range[1]} của ${total} quân nhân`,
              pageSizeOptions: PAGE_SIZE_OPTIONS,
              onChange: (page, pageSize) => {
                // Client-side pagination - không cần gọi API, không cần loading
                setPagination(prev => ({
                  ...prev,
                  current: page,
                  pageSize: pageSize || prev.pageSize,
                }));
              },
              onShowSizeChange: (current, size) => {
                // Client-side pagination - không cần gọi API, không cần loading
                setPagination(prev => ({
                  ...prev,
                  current: 1,
                  pageSize: size,
                }));
              },
            }}
            scroll={{ x: 1000 }}
            locale={{
              emptyText: <Empty description="Không có dữ liệu" />,
            }}
          />
        </Card>
      </div>
    </ConfigProvider>
  );
}
