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
import type { ColumnsType } from 'antd/es/table';
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
import { DEFAULT_PAGE_SIZE, DEFAULT_ANTD_TABLE_PAGINATION } from '@/lib/constants/pagination.constants';
import type {
  AdminCoQuanDonViRow,
  AdminDonViTrucThuocRow,
  PersonnelApiRow,
  PersonnelListItem,
  ManagerPositionRow,
  UnitApiRow,
  UnitRelationLike,
} from '@/lib/types/personnelList';
import type { DefaultOptionType } from 'antd/es/select';

const { Title, Text } = Typography;

function filterSelectByLabelAndValue(input: string, option?: DefaultOptionType) {
  const label = String(option?.label ?? option?.children ?? '');
  const value = String(option?.value ?? '');
  const q = input.toLowerCase();
  return label.toLowerCase().includes(q) || value.toLowerCase().includes(q);
}

function filterSelectByLabel(input: string, option?: DefaultOptionType) {
  const label = String(option?.label ?? option?.children ?? '');
  return label.toLowerCase().includes(input.toLowerCase());
}

export default function PersonnelPage() {
  const { theme } = useTheme();
  const [personnel, setPersonnel] = useState<PersonnelListItem[]>([]);
  const [units, setUnits] = useState<{
    coQuanDonVi: AdminCoQuanDonViRow[];
    donViTrucThuocMap: Record<string, AdminDonViTrucThuocRow[]>;
  }>({ coQuanDonVi: [], donViTrucThuocMap: {} });
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCoQuanDonVi, setSelectedCoQuanDonVi] = useState<string | 'ALL'>('ALL');
  const [selectedDonViTrucThuoc, setSelectedDonViTrucThuoc] = useState<string | 'ALL' | null>(null);
  const [selectedChucVu, setSelectedChucVu] = useState<string | 'ALL'>('ALL');
  const [chucVuSearchValue, setChucVuSearchValue] = useState<string>('');
  const [selectedCapBac, setSelectedCapBac] = useState<string | 'ALL'>('ALL');
  const [positions, setPositions] = useState<ManagerPositionRow[]>([]);
  const [tableLoading, setTableLoading] = useState(false);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: DEFAULT_PAGE_SIZE,
    total: 0,
  });
  const router = useRouter();

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setTableLoading(true);

      const settled = await Promise.allSettled([
        apiClient.getPersonnel({
          page: 1,
          limit: 10000, // Fetch all for client-side pagination
        }),
        apiClient.getUnits(),
        apiClient.getPositions(),
      ]);

      const personnelRes =
        settled[0].status === 'fulfilled'
          ? settled[0].value
          : ({ success: false as const, message: 'Không thể tải danh sách quân nhân' } as const);
      const unitsRes =
        settled[1].status === 'fulfilled'
          ? settled[1].value
          : ({ success: false as const } as const);
      const positionsRes =
        settled[2].status === 'fulfilled'
          ? settled[2].value
          : ({ success: false as const } as const);

      if (personnelRes.success) {
        const personnelData = (personnelRes.data || []).map((p: PersonnelApiRow) => {
          const coQuanDonViRelation = (p.CoQuanDonVi ||
            p.DonViTrucThuoc?.CoQuanDonVi ||
            p.DonVi?.CoQuanDonVi ||
            (typeof p.co_quan_don_vi === 'object' && p.co_quan_don_vi ? p.co_quan_don_vi : null) ||
            null) as UnitRelationLike | null;

          const donViTrucThuocRelation = (p.DonViTrucThuoc ||
            (p.DonVi && (p.DonVi.co_quan_don_vi_id || p.DonVi.CoQuanDonVi) ? p.DonVi : null) ||
            (typeof p.don_vi_truc_thuoc === 'object' && p.don_vi_truc_thuoc
              ? p.don_vi_truc_thuoc
              : null)) as UnitRelationLike | null;

          const coQuanTen = coQuanDonViRelation?.ten_don_vi || coQuanDonViRelation?.ten || null;
          const donViTen =
            donViTrucThuocRelation?.ten_don_vi || donViTrucThuocRelation?.ten || coQuanTen || null;

          const tenDonVi = donViTrucThuocRelation?.ten_don_vi || donViTrucThuocRelation?.ten || '';
          const donViDisplay = tenDonVi
            ? coQuanTen ? `${tenDonVi} (${coQuanTen})` : tenDonVi
            : coQuanTen || '-';

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
          } as PersonnelListItem;
        });

        setPersonnel(personnelData);

        const total = personnelData.length;
        setPagination(prev => ({
          ...prev,
          total: total,
        }));
      } else {
        message.error(personnelRes.message || 'Không thể tải danh sách quân nhân');
      }

      if (unitsRes.success) {
        const unitsData = (unitsRes.data || []) as UnitApiRow[];
        const coQuanDonViList: AdminCoQuanDonViRow[] = [];
        const donViTrucThuocMap: Record<string, AdminDonViTrucThuocRow[]> = {};

        unitsData.forEach(unit => {
          if (unit.co_quan_don_vi_id || unit.CoQuanDonVi) {
            const parentId = String(unit.co_quan_don_vi_id || unit.CoQuanDonVi?.id || '');
            if (!parentId) return;
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

        unitsData.forEach(unit => {
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

      if (positionsRes.success) {
        setPositions((positionsRes.data || []) as ManagerPositionRow[]);
      } else {
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

      const matchesCoQuanDonVi =
        !selectedCoQuanDonVi ||
        selectedCoQuanDonVi === 'ALL' ||
        p.co_quan_don_vi_id === selectedCoQuanDonVi ||
        p.DonViTrucThuoc?.CoQuanDonVi?.id === selectedCoQuanDonVi ||
        p.DonViTrucThuoc?.co_quan_don_vi_id === selectedCoQuanDonVi;

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
      // Personnel without a sub-unit (commanders) are sorted first
      const aIsManager = !a.don_vi_truc_thuoc_id;
      const bIsManager = !b.don_vi_truc_thuoc_id;

      if (aIsManager && !bIsManager) return -1;
      if (!aIsManager && bIsManager) return 1;

      return 0;
    });

  const availableDonViTrucThuoc =
    selectedCoQuanDonVi && selectedCoQuanDonVi !== 'ALL'
      ? units.donViTrucThuocMap[selectedCoQuanDonVi] || []
      : [];

  const columns: ColumnsType<PersonnelListItem> = [
    {
      title: 'STT',
      key: 'index',
      width: 60,
      align: 'center' as const,
      render: (_: unknown, __: unknown, index: number) =>
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
      render: (_: unknown, record: PersonnelListItem) => {
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
      render: (_: unknown, record: PersonnelListItem) => {
        const donViTrucThuoc = record.DonViTrucThuoc?.ten_don_vi;
        return donViTrucThuoc || '-';
      },
    },
    {
      title: 'Cấp bậc',
      key: 'cap_bac',
      width: 120,
      align: 'center' as const,
      ellipsis: true,
      render: (_: unknown, record: PersonnelListItem) => {
        const capBac = record.cap_bac;
        return capBac || '-';
      },
    },
    {
      title: 'Chức vụ',
      key: 'chuc_vu',
      width: 180,
      ellipsis: true,
      render: (_: unknown, record: PersonnelListItem) => {
        const chucVu = record.chuc_vu_name;
        return chucVu || '-';
      },
    },
    {
      title: 'Hành động',
      key: 'action',
      width: 100,
      align: 'center' as const,
      render: (_: unknown, record: PersonnelListItem) => (
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
                  setSelectedChucVu('ALL');
                  setChucVuSearchValue('');
                }}
                onClear={() => {
                  setSelectedCoQuanDonVi('ALL');
                  setSelectedDonViTrucThuoc(null);
                  setSelectedChucVu('ALL');
                  setChucVuSearchValue(''); // Clear search value
                }}
                style={{ width: '100%' }}
                size="large"
                showSearch
                placeholder="Chọn hoặc tìm kiếm cơ quan đơn vị..."
                optionFilterProp="label"
                filterOption={filterSelectByLabelAndValue}
                suffixIcon={<FilterOutlined />}
                allowClear
              >
                <Select.Option value="ALL" label="Tất cả cơ quan đơn vị">
                  Tất cả cơ quan đơn vị ({units.coQuanDonVi.length})
                </Select.Option>
                {units.coQuanDonVi.map((coQuanDonVi: AdminCoQuanDonViRow) => {
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
                  setSelectedChucVu('ALL');
                  setChucVuSearchValue('');
                }}
                onClear={() => {
                  setSelectedDonViTrucThuoc('ALL');
                  setSelectedChucVu('ALL');
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
                filterOption={filterSelectByLabelAndValue}
                suffixIcon={<FilterOutlined />}
                allowClear
                disabled={!selectedCoQuanDonVi || selectedCoQuanDonVi === 'ALL'}
              >
                {selectedCoQuanDonVi && selectedCoQuanDonVi !== 'ALL' && (
                  <Select.Option value="ALL" label="Tất cả đơn vị trực thuộc">
                    Tất cả đơn vị trực thuộc ({availableDonViTrucThuoc.length})
                  </Select.Option>
                )}
                {availableDonViTrucThuoc.map((donVi: AdminDonViTrucThuocRow) => {
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
                filterOption={filterSelectByLabel}
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
                filterOption={filterSelectByLabel}
                suffixIcon={<FilterOutlined />}
                allowClear
              >
                {(() => {
                  const filteredPositions = positions.filter((pos: ManagerPositionRow) => {
                    if (!selectedCoQuanDonVi || selectedCoQuanDonVi === 'ALL') return true;

                    if (selectedDonViTrucThuoc && selectedDonViTrucThuoc !== 'ALL') {
                      return pos.don_vi_truc_thuoc_id === selectedDonViTrucThuoc;
                    }

                    if (pos.co_quan_don_vi_id === selectedCoQuanDonVi) return true;

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
              ...DEFAULT_ANTD_TABLE_PAGINATION,
              current: pagination.current,
              pageSize: pagination.pageSize,
              total: filteredPersonnel.length,
              showTotal: (total, range) => `${range[0]}-${range[1]} của ${total} quân nhân`,
              onChange: (page, pageSize) => {
                setPagination(prev => ({
                  ...prev,
                  current: page,
                  pageSize: pageSize || prev.pageSize,
                }));
              },
              onShowSizeChange: (current, size) => {
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
