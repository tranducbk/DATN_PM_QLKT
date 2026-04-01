'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  Card,
  Button,
  Table,
  Typography,
  Breadcrumb,
  message,
  ConfigProvider,
  theme as antdTheme,
  Spin,
  Space,
  Input,
  Select,
} from 'antd';
import { useTheme } from '@/components/ThemeProvider';
import { HomeOutlined, FilterOutlined } from '@ant-design/icons';
import type { TableColumnsType } from 'antd';
import { apiClient } from '@/lib/apiClient';
import { DEFAULT_PAGE_SIZE, PAGE_SIZE_OPTIONS } from '@/lib/constants/pagination.constants';
import { renderAnnualAwards, COLUMN_STYLES, DANH_HIEU_MAP } from '@/utils/awardsHelpers';
import { downloadDecisionFile } from '@/utils/downloadDecisionFile';

const { Title, Text } = Typography;

interface Unit {
  id: string;
  ma_don_vi: string;
  ten_don_vi: string;
  CoQuanDonVi?: {
    id: string;
    ten_don_vi: string;
    ma_don_vi: string;
  };
}

export default function ManagerUnitsPage() {
  const { theme } = useTheme();
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null);
  const [allAwards, setAllAwards] = useState<any[]>([]);
  const [awardsLoading, setAwardsLoading] = useState(false);
  const [unitSearch, setUnitSearch] = useState('');
  const [debouncedUnitSearch, setDebouncedUnitSearch] = useState('');
  const [filters, setFilters] = useState({
    nam: '',
    ten_don_vi: '',
    danh_hieu: '',
  });
  const [debouncedFilters, setDebouncedFilters] = useState(filters);
  const [awardsPageSize, setAwardsPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [unitsPageSize, setUnitsPageSize] = useState(DEFAULT_PAGE_SIZE);

  useEffect(() => {
    fetchUnits();
    fetchAllAwards();
  }, []);

  const fetchUnits = async () => {
    try {
      setLoading(true);
      const result = await apiClient.getMyUnits();
      if (!result.success) {
        message.error(result.message || 'Không thể tải danh sách đơn vị');
        return;
      }
      setUnits(Array.isArray(result.data) ? result.data : []);
    } catch {
      message.error('Không thể tải danh sách đơn vị');
    } finally {
      setLoading(false);
    }
  };

  const fetchAllAwards = async () => {
    try {
      setAwardsLoading(true);
      const result = await apiClient.getUnitAnnualAwards({ limit: 1000 });
      if (!result.success) {
        message.error(result.message || 'Không thể tải danh sách khen thưởng');
        return;
      }
      setAllAwards(result.data ?? []);
    } catch {
      message.error('Không thể tải danh sách khen thưởng');
    } finally {
      setAwardsLoading(false);
    }
  };

  useEffect(() => {
    const id = setTimeout(() => setDebouncedFilters(filters), 300);
    return () => clearTimeout(id);
  }, [filters]);

  useEffect(() => {
    const id = setTimeout(() => setDebouncedUnitSearch(unitSearch.trim().toLowerCase()), 300);
    return () => clearTimeout(id);
  }, [unitSearch]);

  const handleOpenDecisionFile = async (soQuyetDinh: string) => {
    await downloadDecisionFile(soQuyetDinh);
  };

  const columns: TableColumnsType<Unit> = [
    {
      title: 'Mã đơn vị',
      dataIndex: 'ma_don_vi',
      key: 'ma_don_vi',
      width: 150,
    },
    {
      title: 'Tên đơn vị',
      dataIndex: 'ten_don_vi',
      key: 'ten_don_vi',
      width: 300,
    },
    {
      title: 'Cơ quan đơn vị',
      key: 'co_quan_don_vi',
      render: (_, record) => {
        if (record.CoQuanDonVi) {
          return record.CoQuanDonVi.ten_don_vi;
        }
        return 'Cơ quan chính';
      },
      width: 200,
    },
  ];

  // Lấy danh sách các năm có trong dữ liệu
  const availableYears = useMemo(() => {
    const years = new Set<number>();
    allAwards.forEach(award => {
      if (award.nam) {
        years.add(award.nam);
      }
    });
    return Array.from(years).sort((a, b) => b - a); // Sắp xếp giảm dần
  }, [allAwards]);

  // Danh sách danh hiệu cho đơn vị
  const danhHieuOptions = useMemo(() => {
    return [
      { value: '', label: 'Tất cả danh hiệu' },
      { value: 'ĐVQT', label: DANH_HIEU_MAP['ĐVQT'] || 'Đơn vị Quyết thắng' },
      { value: 'ĐVTT', label: DANH_HIEU_MAP['ĐVTT'] || 'Đơn vị Tiên tiến' },
      { value: 'BKBQP', label: DANH_HIEU_MAP['BKBQP'] || 'Bằng khen của Bộ trưởng Bộ Quốc phòng' },
      { value: 'BKTTCP', label: DANH_HIEU_MAP['BKTTCP'] || 'Bằng khen Thủ tướng Chính phủ' },
    ];
  }, []);

  const filteredAwards = useMemo(() => {
    const yearFilter = debouncedFilters.nam.trim();
    const nameFilter = debouncedFilters.ten_don_vi.trim().toLowerCase();
    const danhHieuFilter = debouncedFilters.danh_hieu.trim();

    return allAwards.filter(record => {
      if (yearFilter && String(record.nam) !== yearFilter) return false;

      if (nameFilter) {
        const name =
          record?.DonViTrucThuoc?.ten_don_vi?.toLowerCase() ||
          record?.CoQuanDonVi?.ten_don_vi?.toLowerCase() ||
          '';
        if (!name.includes(nameFilter)) return false;
      }

      if (danhHieuFilter) {
        // BKBQP và BKTTCP là trường boolean, ĐVQT và ĐVTT là danh_hieu
        const isBKBQP = danhHieuFilter === 'BKBQP' && record.nhan_bkbqp === true;
        const isBKTTCP = danhHieuFilter === 'BKTTCP' && record.nhan_bkttcp === true;

        if (!isBKBQP && !isBKTTCP && record.danh_hieu !== danhHieuFilter) {
          return false;
        }
      }

      return true;
    });
  }, [allAwards, debouncedFilters]);

  const filteredUnits = useMemo(() => {
    if (!debouncedUnitSearch) return units;
    return units.filter(u => {
      const name = u.ten_don_vi?.toLowerCase() || '';
      const code = u.ma_don_vi?.toLowerCase() || '';
      const parent = u.CoQuanDonVi?.ten_don_vi?.toLowerCase() || '';
      return (
        name.includes(debouncedUnitSearch) ||
        code.includes(debouncedUnitSearch) ||
        parent.includes(debouncedUnitSearch)
      );
    });
  }, [units, debouncedUnitSearch]);

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
      <div className="p-6">
        <Breadcrumb
          items={[
            {
              href: '/manager/dashboard',
              title: (
                <>
                  <HomeOutlined />
                  <span>Dashboard</span>
                </>
              ),
            },
            {
              title: 'Quản lý Đơn vị',
            },
          ]}
        />

        <div className="mt-4">
          <Title level={2}>Quản lý Đơn vị</Title>
          <Text type="secondary">
            Quản lý và xem chi tiết các đơn vị trực thuộc cùng tất cả khen thưởng
          </Text>
        </div>

        <Card className="mt-6">
          <Space style={{ marginBottom: 12 }} wrap>
            <Input
              placeholder="Tìm đơn vị (tên/mã/cơ quan)"
              value={unitSearch}
              onChange={e => setUnitSearch(e.target.value)}
              allowClear
              size="large"
              style={{ width: 260 }}
            />
            <Button size="large" onClick={() => setUnitSearch('')} icon={null}>
              Xoá bộ lọc
            </Button>
          </Space>
          <Table
            columns={columns}
            dataSource={filteredUnits}
            rowKey="id"
            pagination={{
              pageSize: unitsPageSize,
              showSizeChanger: true,
              showQuickJumper: true,
              showTotal: (total, range) => `${range[0]}-${range[1]} của ${total} đơn vị`,
              pageSizeOptions: PAGE_SIZE_OPTIONS,
              onShowSizeChange: (current, size) => {
                setUnitsPageSize(size);
              },
            }}
            scroll={{ x: 800 }}
          />
        </Card>

        {selectedUnitId && (
          <Card className="mt-6">
            <Title level={3}>Chi tiết đơn vị</Title>
            {(() => {
              const selectedUnit = units.find(u => u.id === selectedUnitId);
              if (!selectedUnit) return null;
              return (
                <div>
                  <p>
                    <strong>Mã đơn vị:</strong> {selectedUnit.ma_don_vi}
                  </p>
                  <p>
                    <strong>Tên đơn vị:</strong> {selectedUnit.ten_don_vi}
                  </p>
                  <p>
                    <strong>Cơ quan đơn vị:</strong>{' '}
                    {selectedUnit.CoQuanDonVi
                      ? selectedUnit.CoQuanDonVi.ten_don_vi
                      : 'Cơ quan chính'}
                  </p>
                </div>
              );
            })()}
          </Card>
        )}

        <Card className="mt-6">
          <Title level={3}>Tất cả khen thưởng của các đơn vị</Title>
          <Card
            title={
              <Space>
                <FilterOutlined />
                <span>Bộ lọc</span>
              </Space>
            }
            style={{ marginBottom: '24px' }}
          >
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '16px',
                alignItems: 'flex-end',
              }}
            >
              <div style={{ flex: '0 0 180px', display: 'flex', flexDirection: 'column' }}>
                <Text strong style={{ display: 'block', marginBottom: '8px' }}>
                  Năm
                </Text>
                <Select
                  placeholder="Tất cả các năm"
                  value={filters.nam === '' ? '' : filters.nam || undefined}
                  onChange={value => setFilters(prev => ({ ...prev, nam: value || '' }))}
                  allowClear
                  size="large"
                  style={{ width: '100%' }}
                  options={[
                    { value: '', label: 'Tất cả các năm' },
                    ...availableYears.map(year => ({
                      value: String(year),
                      label: String(year),
                    })),
                  ]}
                />
              </div>
              <div
                style={{
                  flex: '1 1 200px',
                  minWidth: '200px',
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                <Text strong style={{ display: 'block', marginBottom: '8px' }}>
                  Tìm kiếm theo tên đơn vị
                </Text>
                <Input
                  placeholder="Nhập tên đơn vị để tìm kiếm"
                  value={filters.ten_don_vi}
                  onChange={e => setFilters(prev => ({ ...prev, ten_don_vi: e.target.value }))}
                  allowClear
                  size="large"
                />
              </div>
              <div
                style={{
                  flex: '1 1 250px',
                  minWidth: '250px',
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                <Text strong style={{ display: 'block', marginBottom: '8px' }}>
                  Danh hiệu
                </Text>
                <Select
                  placeholder="Tất cả danh hiệu"
                  value={filters.danh_hieu === '' ? '' : filters.danh_hieu || undefined}
                  onChange={value => setFilters(prev => ({ ...prev, danh_hieu: value || '' }))}
                  allowClear
                  showSearch
                  optionFilterProp="label"
                  size="large"
                  style={{ width: '100%' }}
                  options={danhHieuOptions}
                />
              </div>
              <div style={{ flex: '0 0 auto', display: 'flex', flexDirection: 'column' }}>
                <div style={{ height: '22px', marginBottom: '8px' }}></div>
                <Button
                  size="large"
                  onClick={() => setFilters({ nam: '', ten_don_vi: '', danh_hieu: '' })}
                  icon={null}
                >
                  Xóa bộ lọc
                </Button>
              </div>
            </div>
          </Card>
          {awardsLoading ? (
            <Spin size="large" />
          ) : (
            <Table
              columns={[
                {
                  title: 'STT',
                  key: 'stt',
                  width: 60,
                  align: 'center',
                  render: (_: any, __: any, index: number) => index + 1,
                },
                {
                  title: 'Năm',
                  dataIndex: 'nam',
                  key: 'nam',
                  width: 80,
                  align: 'center',
                },
                {
                  title: 'Tên đơn vị',
                  key: 'ten_don_vi',
                  width: 200,
                  align: 'center',
                  render: (_: any, record: any) => {
                    const unitName =
                      record?.DonViTrucThuoc?.ten_don_vi ?? record?.CoQuanDonVi?.ten_don_vi ?? '';
                    const parentName = record?.DonViTrucThuoc?.CoQuanDonVi?.ten_don_vi;
                    if (parentName) {
                      return (
                        <div style={{ textAlign: 'center' }}>
                          <div>{unitName}</div>
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            Thuộc: {parentName}
                          </Text>
                        </div>
                      );
                    }
                    return unitName;
                  },
                },
                {
                  title: 'Danh hiệu',
                  dataIndex: 'danh_hieu',
                  key: 'danh_hieu',
                  width: 320,
                  align: 'center',
                  render: (text: string | null, record: any) => {
                    return renderAnnualAwards(text, record, {
                      onDownload: handleOpenDecisionFile,
                    });
                  },
                },
                {
                  title: 'Ghi chú',
                  key: 'ghi_chu',
                  width: 200,
                  align: 'center',
                  render: (_: any, record: any) => {
                    if (record.ghi_chu) {
                      return (
                        <Text type="secondary" style={COLUMN_STYLES.noteText}>
                          {record.ghi_chu}
                        </Text>
                      );
                    }
                    return (
                      <Text type="secondary" style={{ fontStyle: 'italic', opacity: 0.6 }}>
                        Không có ghi chú
                      </Text>
                    );
                  },
                },
              ]}
              dataSource={filteredAwards}
              rowKey="id"
              pagination={{
                pageSize: awardsPageSize,
                showSizeChanger: true,
                showQuickJumper: true,
                showTotal: (total, range) => `${range[0]}-${range[1]} của ${total} khen thưởng`,
                pageSizeOptions: PAGE_SIZE_OPTIONS,
                onShowSizeChange: (current, size) => {
                  setAwardsPageSize(size);
                },
              }}
              scroll={{ x: 800 }}
            />
          )}
        </Card>
      </div>
    </ConfigProvider>
  );
}
