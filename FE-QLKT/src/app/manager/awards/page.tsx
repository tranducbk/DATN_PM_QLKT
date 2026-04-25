'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  Card,
  Button,
  Input,
  Select,
  Table,
  Space,
  Typography,
  Breadcrumb,
  Spin,
  message,
  Tabs,
  Empty,
} from 'antd';
import type { TableColumnsType } from 'antd';
import { FilterOutlined, HomeOutlined } from '@ant-design/icons';
import { apiClient } from '@/lib/apiClient';
import {
  DANH_HIEU_MAP,
  COLUMN_STYLES,
  renderDecision,
  renderAnnualAwards,
  getLoaiKhenThuong,
} from '@/utils/awardsHelper';
import { downloadDecisionFile } from '@/utils/downloadDecisionFile';
import { formatDate } from '@/lib/utils';
import type { AwardType } from '@/constants/danhHieu.constants';
import {
  DEFAULT_ANTD_TABLE_PAGINATION,
  FETCH_ALL_LIMIT,
} from '@/lib/constants/pagination.constants';

const { Title, Paragraph, Text } = Typography;

interface Award {
  id: string;
  cccd: string;
  ho_ten: string;
  ngay_sinh?: string;
  don_vi: string;
  co_quan_don_vi?: string;
  don_vi_truc_thuoc?: string;
  cap_bac?: string;
  chuc_vu: string;
  nam: number;
  thang?: number | null;
  danh_hieu: string | null;
  so_quyet_dinh?: string | null;
  ghi_chu?: string | null;
  nhan_bkbqp?: boolean;
  so_quyet_dinh_bkbqp?: string | null;
  nhan_cstdtq?: boolean;
  so_quyet_dinh_cstdtq?: string | null;
  nhan_bkttcp?: boolean;
  so_quyet_dinh_bkttcp?: string | null;
  mo_ta?: string;
  ten_de_tai?: string;
}

interface AwardFilters {
  nam: string;
  ho_ten: string;
  danh_hieu: string;
  de_tai: string;
}

interface QuanNhanInfo {
  ho_ten?: string;
  ngay_sinh?: string;
  CoQuanDonVi?: { ten_don_vi?: string };
  DonViTrucThuoc?: { ten_don_vi?: string };
}

type AwardRow = Award & {
  QuanNhan?: QuanNhanInfo;
  loai?: string;
  thoi_gian?: { display?: string };
  thoi_gian_nhom_0_7?: { display?: string };
  thoi_gian_nhom_0_8?: { display?: string };
  thoi_gian_nhom_0_9_1_0?: { display?: string };
};

const INITIAL_FILTERS: AwardFilters = {
  nam: '',
  ho_ten: '',
  danh_hieu: '',
  de_tai: '',
};

const TABS_WITH_DANH_HIEU_FILTER = new Set<AwardType>(['CNHN', 'HCCSVV', 'HCBVTQ']);
const TABS_WITH_NESTED_QUAN_NHAN = new Set<AwardType>([
  'NCKH',
  'HCQKQT',
  'HCBVTQ',
  'HCCSVV',
  'KNC_VSNXD_QDNDVN',
]);

const DANH_HIEU_OPTIONS: Record<string, string[]> = {
  CNHN: ['CSTDCS', 'CSTT', 'BKBQP', 'CSTDTQ'],
  HCCSVV: ['HCCSVV_HANG_NHAT', 'HCCSVV_HANG_NHI', 'HCCSVV_HANG_BA'],
  HCBVTQ: ['HCBVTQ_HANG_NHAT', 'HCBVTQ_HANG_NHI', 'HCBVTQ_HANG_BA'],
};

const AWARD_TYPE_CONFIG: Record<
  string,
  {
    fetch: (params: any) => Promise<any>;
    export: (params: any) => Promise<Blob>;
    exportFilename: string;
  }
> = {
  CNHN: {
    fetch: apiClient.getAnnualRewards,
    export: apiClient.exportAnnualRewards,
    exportFilename: 'ca_nhan_hang_nam',
  },
  HCCSVV: {
    fetch: apiClient.getHCCSVV,
    export: apiClient.exportHCCSVV,
    exportFilename: 'hccsvv',
  },
  HCBVTQ: {
    fetch: apiClient.getContributionAwards,
    export: apiClient.exportContributionAwards,
    exportFilename: 'hcbvtq_cong_hien',
  },
  KNC_VSNXD_QDNDVN: {
    fetch: apiClient.getCommemorationMedals,
    export: apiClient.exportCommemorationMedals,
    exportFilename: 'knc_vsnxd_qdndvn',
  },
  HCQKQT: {
    fetch: apiClient.getMilitaryFlag,
    export: apiClient.exportMilitaryFlag,
    exportFilename: 'hc_quan_ky_quyet_thang',
  },
  NCKH: {
    fetch: apiClient.getScientificAchievements,
    export: apiClient.exportScientificAchievements,
    exportFilename: 'thanh_tich_khoa_hoc',
  },
};

export default function ManagerAwardsPage() {
  const [activeTab, setActiveTab] = useState<AwardType>('CNHN');
  const [awards, setAwards] = useState<Award[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<AwardFilters>(INITIAL_FILTERS);
  const [debouncedFilters, setDebouncedFilters] = useState(filters);

  useEffect(() => {
    fetchAwards();
  }, [activeTab]);

  useEffect(() => {
    setFilters(INITIAL_FILTERS);
  }, [activeTab]);

  useEffect(() => {
    const id = setTimeout(() => setDebouncedFilters(filters), 300);
    return () => clearTimeout(id);
  }, [filters]);

  const fetchAwards = async () => {
    try {
      setLoading(true);
      const params: any = { limit: FETCH_ALL_LIMIT };

      const config = AWARD_TYPE_CONFIG[activeTab];
      const result = await (config ?? AWARD_TYPE_CONFIG.CNHN).fetch(params);

      if (!result.success) {
        message.error(result.message || 'Không thể tải danh sách khen thưởng');
        return;
      }
      setAwards(result.data ?? []);
    } catch {
      message.error('Không thể tải danh sách khen thưởng');
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (key: keyof AwardFilters, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const handleDownloadDecision = async (soQuyetDinh: string) => {
    await downloadDecisionFile(soQuyetDinh);
  };

  const getPersonName = (record: AwardRow) => record.QuanNhan?.ho_ten || record.ho_ten || '';

  const resolvePersonnelDisplay = (record: AwardRow) => {
    const isAnnualTab = activeTab === 'CNHN';
    const hasNestedQuanNhan = TABS_WITH_NESTED_QUAN_NHAN.has(activeTab);

    const hoTen = hasNestedQuanNhan
      ? record.QuanNhan?.ho_ten
      : isAnnualTab
        ? record.QuanNhan?.ho_ten || record.ho_ten
        : record.ho_ten;

    const ngaySinh = hasNestedQuanNhan
      ? record.QuanNhan?.ngay_sinh
      : isAnnualTab
        ? record.QuanNhan?.ngay_sinh || record.ngay_sinh
        : record.ngay_sinh;

    const unitInfo: string[] = [];
    if (hasNestedQuanNhan || (isAnnualTab && record.QuanNhan)) {
      if (record.QuanNhan?.DonViTrucThuoc?.ten_don_vi) unitInfo.push(record.QuanNhan.DonViTrucThuoc.ten_don_vi);
      if (record.QuanNhan?.CoQuanDonVi?.ten_don_vi) unitInfo.push(record.QuanNhan.CoQuanDonVi.ten_don_vi);
    } else if (isAnnualTab) {
      if (record.don_vi_truc_thuoc) unitInfo.push(record.don_vi_truc_thuoc);
      if (record.co_quan_don_vi) unitInfo.push(record.co_quan_don_vi);
      if (record.don_vi) unitInfo.push(record.don_vi);
    }

    return {
      hoTen: hoTen || '-',
      ngaySinh,
      unitInfoText: unitInfo.length > 0 ? unitInfo.join(', ') : record.don_vi || '',
    };
  };

  const danhHieuOptions = useMemo(() => {
    const options = DANH_HIEU_OPTIONS[activeTab] || [];
    return [
      { value: '', label: 'Tất cả danh hiệu' },
      ...options.map(value => ({
        value,
        label: DANH_HIEU_MAP[value] || value,
      })),
    ];
  }, [activeTab]);

  const availableYears = useMemo(() => {
    const years = new Set<number>();
    awards.forEach(award => {
      if (award.nam) {
        years.add(award.nam);
      }
    });
    return Array.from(years).sort((a, b) => b - a); // descending
  }, [awards]);

  const filteredAwards = useMemo(() => {
    const yearFilter = debouncedFilters.nam.trim();
    const nameFilter = debouncedFilters.ho_ten.trim().toLowerCase();
    const danhHieuFilter = debouncedFilters.danh_hieu.trim();
    const topicFilter = debouncedFilters.de_tai.trim().toLowerCase();

    return awards.filter(record => {
      if (yearFilter && String(record.nam) !== yearFilter) return false;

      // Name search
      if (nameFilter) {
        const name = getPersonName(record).toLowerCase();
        if (!name.includes(nameFilter)) return false;
      }

      if (danhHieuFilter) {
        if (['CNHN', 'HCCSVV', 'HCBVTQ'].includes(activeTab)) {
          if (activeTab === 'CNHN') {
            const isBKBQP = danhHieuFilter === 'BKBQP' && record.nhan_bkbqp === true;
            const isCSTDTQ = danhHieuFilter === 'CSTDTQ' && record.nhan_cstdtq === true;
            const isBKTTCP = danhHieuFilter === 'BKTTCP' && record.nhan_bkttcp === true;

            if (!isBKBQP && !isCSTDTQ && !isBKTTCP && record.danh_hieu !== danhHieuFilter) {
              return false;
            }
          } else if (record.danh_hieu !== danhHieuFilter) {
            return false;
          }
        }
      }

      // Scientific topic filter
      if (activeTab === 'NCKH' && topicFilter) {
        const topic = record.mo_ta?.toLowerCase() || record.ten_de_tai?.toLowerCase() || '';
        if (!topic.includes(topicFilter)) return false;
      }

      return true;
    });
  }, [awards, debouncedFilters, activeTab]);

  const columns: TableColumnsType<Award> = [
    {
      title: 'STT',
      key: 'index',
      width: 60,
      align: 'center',
      render: (_, __, index) => index + 1,
    },
    {
      title: 'Họ tên',
      dataIndex: 'ho_ten',
      key: 'ho_ten',
      width: 200,
      align: 'center',
      render: (_text: string, record: AwardRow) => {
        const { hoTen, unitInfoText } = resolvePersonnelDisplay(record);

        return (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <Text strong>{hoTen}</Text>
            {unitInfoText && (
              <Text type="secondary" style={{ fontSize: '12px', marginTop: '4px' }}>
                {unitInfoText}
              </Text>
            )}
          </div>
        );
      },
    },
    {
      title: 'Ngày sinh',
      key: 'ngay_sinh',
      width: 120,
      align: 'center',
      render: (_: unknown, record: AwardRow) => {
        const { ngaySinh } = resolvePersonnelDisplay(record);
        return <Text>{formatDate(ngaySinh)}</Text>;
      },
    },
    {
      title: 'Cấp bậc / Chức vụ',
      key: 'cap_bac_chuc_vu',
      width: 150,
      align: 'center',
      render: (_: unknown, record: AwardRow) => {
        const capBac = record.cap_bac;
        const chucVu = record.chuc_vu;

        return (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <Text strong style={{ marginBottom: '4px' }}>
              {capBac || '-'}
            </Text>
            <Text type="secondary" style={{ fontSize: '12px' }}>
              {chucVu || '-'}
            </Text>
          </div>
        );
      },
    },
    {
      title: (['HCCSVV', 'HCBVTQ', 'HCQKQT', 'KNC_VSNXD_QDNDVN'] as AwardType[]).includes(activeTab) ? 'Thời gian nhận' : 'Năm nhận',
      key: 'nam',
      width: (['HCCSVV', 'HCBVTQ', 'HCQKQT', 'KNC_VSNXD_QDNDVN'] as AwardType[]).includes(activeTab) ? 120 : 70,
      align: 'center',
      render: (_: unknown, record: AwardRow) => {
        if ((['HCCSVV', 'HCBVTQ', 'HCQKQT', 'KNC_VSNXD_QDNDVN'] as AwardType[]).includes(activeTab) && record.thang) {
          return <Text strong>{`${String(record.thang).padStart(2, '0')}/${record.nam}`}</Text>;
        }
        return <Text strong>{record.nam}</Text>;
      },
    },
    {
      title: 'Loại khen thưởng',
      key: 'loai_khen_thuong',
      width: 140,
      align: 'center',
      render: (_: unknown, record: AwardRow) => {
        if (activeTab === 'NCKH') {
          const loaiMap: Record<string, string> = {
            DTKH: 'ĐTKH',
            SKKH: 'SKKH',
          };
          const loai = record.loai ?? '';
          return <Text>{loaiMap[loai] || loai || '-'}</Text>;
        }
        if (activeTab === 'HCQKQT' || activeTab === 'HCCSVV' || activeTab === 'KNC_VSNXD_QDNDVN') {
          const thanhTich = record.thoi_gian?.display || '-';
          return <Text>{thanhTich}</Text>;
        }
        if (activeTab === 'HCBVTQ') {
          const thoiGian =
            [
              record.thoi_gian_nhom_0_7?.display,
              record.thoi_gian_nhom_0_8?.display,
              record.thoi_gian_nhom_0_9_1_0?.display,
            ]
              .filter(t => t && t !== '-')
              .join(' + ') || '-';
          return <Text>{thoiGian}</Text>;
        }
        return <Text>{getLoaiKhenThuong(record.danh_hieu)}</Text>;
      },
    },
    {
      title:
        activeTab === 'NCKH'
          ? 'Mô tả'
          : activeTab === 'HCQKQT' || activeTab === 'KNC_VSNXD_QDNDVN'
            ? 'Số quyết định / Ghi chú'
            : 'Danh hiệu',
      dataIndex: activeTab === 'NCKH' ? 'mo_ta' : 'danh_hieu',
      key: activeTab === 'NCKH' ? 'mo_ta' : 'danh_hieu',
      width: 220,
      align: 'center',
      render: (text: string | null, record: AwardRow) => {
        // Scientific achievements
        if (activeTab === 'NCKH') {
          return (
            <div style={COLUMN_STYLES.container}>
              <Text>{text || '-'}</Text>
              {renderDecision(record.so_quyet_dinh, handleDownloadDecision)}
            </div>
          );
        }

        // Commemoration medals — if record exists, default title is KNC
        if (activeTab === 'KNC_VSNXD_QDNDVN') {
          const danhHieu = DANH_HIEU_MAP['KNC_VSNXD_QDNDVN'] || 'Kỷ niệm chương vì sự nghiệp xây dựng QĐNDVN';
          return (
            <div style={COLUMN_STYLES.container}>
              <Text strong>{danhHieu}</Text>
              {record.ghi_chu && (
                <Text type="secondary" style={COLUMN_STYLES.noteText}>
                  {record.ghi_chu}
                </Text>
              )}
              {renderDecision(record.so_quyet_dinh, handleDownloadDecision)}
            </div>
          );
        }

        // Military flag — if record exists, default title is HC_QKQT
        if (activeTab === 'HCQKQT') {
          const danhHieu = DANH_HIEU_MAP['HC_QKQT'] || 'Huy chương Quân kỳ quyết thắng';
          return (
            <div style={COLUMN_STYLES.container}>
              <Text strong>{danhHieu}</Text>
              {record.ghi_chu && (
                <Text type="secondary" style={COLUMN_STYLES.noteText}>
                  {record.ghi_chu}
                </Text>
              )}
              {renderDecision(record.so_quyet_dinh, handleDownloadDecision)}
            </div>
          );
        }

        // Contribution awards
        if (activeTab === 'HCBVTQ') {
          const fullName = text ? DANH_HIEU_MAP[text] || text : '-';
          return (
            <div style={COLUMN_STYLES.container}>
              <Text>{fullName}</Text>
              {record.ghi_chu && <Text type="secondary" style={COLUMN_STYLES.noteText}>{record.ghi_chu}</Text>}
              {renderDecision(record.so_quyet_dinh, handleDownloadDecision)}
            </div>
          );
        }

        // HCCSVV awards
        if (activeTab === 'HCCSVV') {
          const fullName = text ? DANH_HIEU_MAP[text] || text : '-';
          return (
            <div style={COLUMN_STYLES.container}>
              <Text>{fullName}</Text>
              {record.ghi_chu && <Text type="secondary" style={COLUMN_STYLES.noteText}>{record.ghi_chu}</Text>}
              {renderDecision(record.so_quyet_dinh, handleDownloadDecision)}
            </div>
          );
        }

        // Annual awards (default)
        return renderAnnualAwards(text, record, { onDownload: handleDownloadDecision });
      },
    },
  ];

  return (
    <div style={{ padding: '24px' }}>
      <Breadcrumb style={{ marginBottom: '16px' }}>
        <Breadcrumb.Item href="/">
          <HomeOutlined />
        </Breadcrumb.Item>
        <Breadcrumb.Item>Quản lý khen thưởng</Breadcrumb.Item>
      </Breadcrumb>

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: '24px',
        }}
      >
        <div>
          <Title level={2} style={{ margin: 0 }}>
            Quản lý khen thưởng
          </Title>
          <Paragraph type="secondary" style={{ marginTop: '4px', marginBottom: 0 }}>
            Danh sách khen thưởng tất cả các đơn vị
          </Paragraph>
        </div>
      </div>

      <Tabs
        activeKey={activeTab}
        onChange={key => setActiveTab(key as AwardType)}
        size="large"
        items={[
          {
            key: 'CNHN',
            label: 'Khen thưởng cá nhân hằng năm',
            children: renderAwardContent(),
          },
          {
            key: 'HCCSVV',
            label: 'Huy chương Chiến sĩ vẻ vang',
            children: renderAwardContent(),
          },
          {
            key: 'HCBVTQ',
            label: 'Huân chương Bảo vệ Tổ quốc',
            children: renderAwardContent(),
          },
          {
            key: 'KNC_VSNXD_QDNDVN',
            label: 'Kỷ niệm chương vì sự nghiệp xây dựng QĐNDVN',
            children: renderAwardContent(),
          },
          {
            key: 'HCQKQT',
            label: 'Huy chương Quân kỳ quyết thắng',
            children: renderAwardContent(),
          },
          {
            key: 'NCKH',
            label: 'Thành tích Nghiên cứu khoa học',
            children: renderAwardContent(),
          },
        ]}
      />
    </div>
  );

  function renderAwardContent() {
    return (
      <>
        {/* Filters */}
        <Card
          title={
            <Space>
              <FilterOutlined />
              Bộ lọc
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
                onChange={value => handleFilterChange('nam', value || '')}
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
                Tìm kiếm theo họ tên
              </Text>
              <Input
                placeholder="Nhập tên để tìm kiếm"
                value={filters.ho_ten}
                onChange={e => handleFilterChange('ho_ten', e.target.value)}
                allowClear
                size="large"
              />
            </div>
            {TABS_WITH_DANH_HIEU_FILTER.has(activeTab) && (
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
                  allowClear
                  showSearch
                  optionFilterProp="label"
                  style={{ width: '100%' }}
                  placeholder={activeTab === 'CNHN' ? 'Chọn danh hiệu cá nhân' : 'Chọn danh hiệu'}
                  value={filters.danh_hieu === '' ? '' : filters.danh_hieu || undefined}
                  onChange={value => handleFilterChange('danh_hieu', value || '')}
                  options={danhHieuOptions}
                  size="large"
                />
              </div>
            )}
            {activeTab === 'NCKH' && (
              <div
                style={{
                  flex: '1 1 200px',
                  minWidth: '200px',
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                <Text strong style={{ display: 'block', marginBottom: '8px' }}>
                  Đề tài
                </Text>
                <Input
                  placeholder="Nhập đề tài / mô tả"
                  value={filters.de_tai}
                  onChange={e => handleFilterChange('de_tai', e.target.value)}
                  allowClear
                  size="large"
                />
              </div>
            )}
            <div style={{ flex: '0 0 auto', display: 'flex', flexDirection: 'column' }}>
              <div style={{ height: '22px', marginBottom: '8px' }}></div>
              <Button
                size="large"
                onClick={() => setFilters(INITIAL_FILTERS)}
                icon={null}
              >
                Xóa bộ lọc
              </Button>
            </div>
          </div>
        </Card>

        {/* Awards Table */}
        <Card title={`Danh sách khen thưởng (${filteredAwards.length})`}>
          <Spin spinning={loading} tip="Đang tải...">
            {!loading && awards.length === 0 ? (
              <Empty description="Chưa có dữ liệu khen thưởng" style={{ padding: '48px 0' }} />
            ) : (
              <Table
                columns={columns.filter(col => {
                  if (col.key === 'loai_khen_thuong' && activeTab !== 'NCKH') {
                    return false;
                  }
                  return true;
                })}
                dataSource={filteredAwards}
                rowKey="id"
                pagination={{
                  ...DEFAULT_ANTD_TABLE_PAGINATION,
                  showTotal: total => `Tổng ${total} bản ghi`,
                }}
                bordered
                scroll={{ x: 'max-content' }}
              />
            )}
          </Spin>
        </Card>
      </>
    );
  }
}
