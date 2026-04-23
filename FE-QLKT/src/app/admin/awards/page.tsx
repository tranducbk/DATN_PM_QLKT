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
  Popconfirm,
  Empty,
} from 'antd';
import { getApiErrorMessage } from '@/lib/apiError';

import type { TableColumnsType } from 'antd';
import { DownloadOutlined, FilterOutlined, HomeOutlined, DeleteOutlined } from '@ant-design/icons';
import { apiClient } from '@/lib/apiClient';
import { downloadDecisionFile } from '@/utils/downloadDecisionFile';
import {
  DANH_HIEU_MAP,
  COLUMN_STYLES,
  renderDecision,
  renderAnnualAwards,
} from '@/utils/awardsHelper';
import { AWARD_TAB_DANH_HIEU, type AwardType } from '@/constants/danhHieu.constants';

import { ExportModal } from './ExportModal';
import {
  DEFAULT_ANTD_TABLE_PAGINATION,
  FETCH_ALL_LIMIT,
} from '@/lib/constants/pagination.constants';
import { formatDate } from '@/lib/utils';

const { Title, Paragraph, Text } = Typography;

/** Một dòng bảng khen thưởng — có thể là cấu trúc lồng (adhoc, scientific, …) */
interface AwardCore {
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
  danh_hieu: string | null;
  so_quyet_dinh?: string | null;
  ghi_chu?: string | null;
  nhan_bkbqp?: boolean;
  so_quyet_dinh_bkbqp?: string | null;
  nhan_cstdtq?: boolean;
  so_quyet_dinh_cstdtq?: string | null;
  nhan_bkttcp?: boolean;
  so_quyet_dinh_bkttcp?: string | null;
  mo_ta?: string | null;
  ten_de_tai?: string | null;
}

/** Dòng hiển thị/ghép filter — gồm cả bản ghi adhoc / scientific có quan hệ lồng */
type AwardTableRow = AwardCore & {
  loai?: string;
  QuanNhan?: {
    ho_ten?: string;
    ngay_sinh?: string;
    CoQuanDonVi?: { ten_don_vi?: string };
    DonViTrucThuoc?: { ten_don_vi?: string; CoQuanDonVi?: { ten_don_vi?: string } };
  };
  CoQuanDonVi?: { ten_don_vi?: string };
  DonViTrucThuoc?: { ten_don_vi?: string; CoQuanDonVi?: { ten_don_vi?: string } };
};

interface AwardFilters {
  nam: string;
  ho_ten: string;
  danh_hieu: string;
  de_tai: string;
}

interface PersonnelDisplay {
  displayName: string;
  unitInfoText: string;
  parentUnit: string | null;
  ngaySinh?: string;
}

const INITIAL_FILTERS: AwardFilters = {
  nam: '',
  ho_ten: '',
  danh_hieu: '',
  de_tai: '',
};

const TABS_WITH_NESTED_QUAN_NHAN = new Set<AwardType>([
  'NCKH',
  'HCQKQT',
  'HCBVTQ',
  'HCCSVV',
  'KNC_VSNXD_QDNDVN',
]);

const TABS_WITH_DANH_HIEU_FILTER = new Set<AwardType>(['CNHN', 'DVHN', 'HCCSVV', 'HCBVTQ']);
const TABS_WITH_DIRECT_DANH_HIEU_FILTER = new Set<AwardType>(['DVHN', 'HCCSVV', 'HCBVTQ']);

const AWARD_TYPE_CONFIG: Record<
  string,
  {
    fetch: (params: any) => Promise<any>;
    delete: (id: string) => Promise<any>;
  }
> = {
  CNHN: { fetch: apiClient.getAnnualRewards, delete: apiClient.deleteAnnualReward },
  DVHN: { fetch: apiClient.getUnitAnnualAwards, delete: apiClient.deleteUnitAnnualAward },
  HCCSVV: { fetch: apiClient.getHCCSVV, delete: apiClient.deleteHCCSVV },
  HCBVTQ: { fetch: apiClient.getContributionAwards, delete: apiClient.deleteContributionAward },
  KNC_VSNXD_QDNDVN: {
    fetch: apiClient.getCommemorationMedals,
    delete: apiClient.deleteCommemorationMedal,
  },
  HCQKQT: { fetch: apiClient.getMilitaryFlag, delete: apiClient.deleteMilitaryFlag },
  NCKH: {
    fetch: apiClient.getScientificAchievements,
    delete: apiClient.deleteScientificAchievement,
  },
};

export default function AdminAwardsPage() {
  const [activeTab, setActiveTab] = useState<AwardType>('CNHN');
  const [awards, setAwards] = useState<AwardTableRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [filters, setFilters] = useState<AwardFilters>(INITIAL_FILTERS);
  const [debouncedFilters, setDebouncedFilters] = useState(filters);
  const [deletingId, setDeletingId] = useState<string | null>(null);

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

  const handleDeleteAward = async (id: string) => {
    try {
      setDeletingId(id);
      const config = AWARD_TYPE_CONFIG[activeTab];
      if (!config) {
        message.error('Loại khen thưởng không được hỗ trợ xóa');
        return;
      }
      const result = await config.delete(id);

      if (!result.success) {
        message.error(result.message || 'Xóa khen thưởng thất bại');
        return;
      }
      message.success('Xóa khen thưởng thành công');
      await fetchAwards();
    } catch (error: unknown) {
      message.error(getApiErrorMessage(error, 'Có lỗi xảy ra khi xóa khen thưởng'));
    } finally {
      setDeletingId(null);
    }
  };

  const handleDownloadDecision = async (soQuyetDinh: string) => {
    await downloadDecisionFile(soQuyetDinh);
  };

  const getPersonName = (record: AwardTableRow) => record.QuanNhan?.ho_ten || record.ho_ten || '';

  const getUnitName = (record: AwardTableRow) =>
    record.DonViTrucThuoc?.ten_don_vi ||
    record.CoQuanDonVi?.ten_don_vi ||
    record.don_vi_truc_thuoc ||
    record.co_quan_don_vi ||
    record.don_vi ||
    '';

  const matchesNameFilter = (record: AwardTableRow, normalizedNameFilter: string): boolean => {
    if (!normalizedNameFilter) return true;
    if (activeTab === 'DVHN') {
      return getUnitName(record).toLowerCase().includes(normalizedNameFilter);
    }
    return getPersonName(record).toLowerCase().includes(normalizedNameFilter);
  };

  const matchesDanhHieuFilter = (record: AwardTableRow, selectedDanhHieu: string): boolean => {
    if (!selectedDanhHieu || !TABS_WITH_DANH_HIEU_FILTER.has(activeTab)) return true;
    if (activeTab === 'CNHN') {
      const isBKBQP = selectedDanhHieu === 'BKBQP' && Boolean(record.nhan_bkbqp);
      const isCSTDTQ = selectedDanhHieu === 'CSTDTQ' && Boolean(record.nhan_cstdtq);
      const isBKTTCP = selectedDanhHieu === 'BKTTCP' && Boolean(record.nhan_bkttcp);
      if (isBKBQP || isCSTDTQ || isBKTTCP) return true;
      return record.danh_hieu === selectedDanhHieu;
    }
    if (TABS_WITH_DIRECT_DANH_HIEU_FILTER.has(activeTab)) {
      return record.danh_hieu === selectedDanhHieu;
    }
    return true;
  };

  const resolvePersonnelDisplay = (record: AwardTableRow): PersonnelDisplay => {
    const isAnnualTab = activeTab === 'CNHN';
    const hasNestedQuanNhan = TABS_WITH_NESTED_QUAN_NHAN.has(activeTab);
    const hoTen = hasNestedQuanNhan
      ? record.QuanNhan?.ho_ten
      : isAnnualTab
        ? record.QuanNhan?.ho_ten || record.ho_ten
        : record.ho_ten;

    const unitInfo: string[] = [];
    const parentUnit = hasNestedQuanNhan
      ? (record.QuanNhan?.DonViTrucThuoc?.CoQuanDonVi?.ten_don_vi ?? null)
      : (record.DonViTrucThuoc?.CoQuanDonVi?.ten_don_vi ?? null);

    if (hasNestedQuanNhan) {
      if (record.QuanNhan?.DonViTrucThuoc?.ten_don_vi) {
        unitInfo.push(record.QuanNhan.DonViTrucThuoc.ten_don_vi);
      }
      if (record.QuanNhan?.CoQuanDonVi?.ten_don_vi) {
        unitInfo.push(record.QuanNhan.CoQuanDonVi.ten_don_vi);
      }
    } else {
      if (record.DonViTrucThuoc?.ten_don_vi) unitInfo.push(record.DonViTrucThuoc.ten_don_vi);
      if (record.CoQuanDonVi?.ten_don_vi) unitInfo.push(record.CoQuanDonVi.ten_don_vi);
      if (unitInfo.length === 0) {
        if (record.don_vi_truc_thuoc) unitInfo.push(record.don_vi_truc_thuoc);
        if (record.co_quan_don_vi) unitInfo.push(record.co_quan_don_vi);
        if (record.don_vi) unitInfo.push(record.don_vi);
      }
    }

    return {
      displayName:
        activeTab === 'DVHN' ? (unitInfo.length ? unitInfo.join(', ') : record.don_vi || '-') : hoTen || '-',
      unitInfoText: unitInfo.length > 0 ? unitInfo.join(', ') : record.don_vi || '',
      parentUnit,
      ngaySinh: hasNestedQuanNhan
        ? record.QuanNhan?.ngay_sinh
        : isAnnualTab
          ? record.QuanNhan?.ngay_sinh || record.ngay_sinh
          : record.ngay_sinh,
    };
  };

  const danhHieuOptions = useMemo(() => {
    const options = AWARD_TAB_DANH_HIEU[activeTab] || [];
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

    return awards.filter((record: AwardTableRow) => {
      if (yearFilter && String(record.nam) !== yearFilter) return false;

      if (!matchesNameFilter(record, nameFilter)) return false;
      if (!matchesDanhHieuFilter(record, danhHieuFilter)) return false;

      // Scientific topic filter
      if (activeTab === 'NCKH' && topicFilter) {
        const topic = record.mo_ta?.toLowerCase() || record.ten_de_tai?.toLowerCase() || '';
        if (!topic.includes(topicFilter)) return false;
      }

      return true;
    });
  }, [awards, debouncedFilters, activeTab]);

  const columns: TableColumnsType<AwardTableRow> = [
    {
      title: 'STT',
      key: 'index',
      width: 60,
      align: 'center',
      render: (_, __, index) => index + 1,
    },
    {
      title: activeTab === 'DVHN' ? 'Tên đơn vị' : 'Họ tên',
      dataIndex: 'ho_ten',
      key: 'ho_ten',
      width: 200,
      align: 'center',
      render: (_text: string, record: AwardTableRow) => {
        const { displayName, unitInfoText, parentUnit } = resolvePersonnelDisplay(record);

        return (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <Text strong>{displayName}</Text>
            {activeTab === 'DVHN' && parentUnit && (
              <Text type="secondary" style={{ fontSize: '12px', marginTop: '4px' }}>
                Thuộc: {parentUnit}
              </Text>
            )}
            {activeTab !== 'DVHN' && unitInfoText && (
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
      render: (_: unknown, record: AwardTableRow) => {
        const { ngaySinh } = resolvePersonnelDisplay(record);
        return <Text>{formatDate(ngaySinh)}</Text>;
      },
    },
    {
      title: 'Cấp bậc / Chức vụ',
      key: 'cap_bac_chuc_vu',
      width: 150,
      align: 'center',
      render: (_: unknown, record: AwardTableRow) => {
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
      title: 'Năm',
      dataIndex: 'nam',
      key: 'nam',
      width: 70,
      align: 'center',
      render: text => <Text strong>{text}</Text>,
    },
    {
      title: activeTab === 'NCKH' ? 'Loại thành tích' : 'Loại khen thưởng',
      key: 'loai_khen_thuong',
      width: 140,
      align: 'center',
      render: (_: unknown, record: AwardTableRow) => {
        // Only visible on the NCKH tab (filtered below)
        const loaiMap: Record<string, string> = {
          DTKH: 'Đề tài khoa học',
          SKKH: 'Sáng kiến khoa học',
        };
        const loai = record.loai ?? '';
        return <Text>{loaiMap[loai] || loai || '-'}</Text>;
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
      render: (text: string | null, record: AwardTableRow) => {
        // Scientific achievements
        if (activeTab === 'NCKH') {
          return (
            <div style={COLUMN_STYLES.container}>
              <Text>{text || '-'}</Text>
              {renderDecision(record.so_quyet_dinh, handleDownloadDecision)}
              {record.ghi_chu && (
                <Text type="secondary" style={COLUMN_STYLES.noteText}>
                  {record.ghi_chu}
                </Text>
              )}
            </div>
          );
        }

        // Commemoration medals
        if (activeTab === 'KNC_VSNXD_QDNDVN') {
          const hasData = record.so_quyet_dinh || record.ghi_chu;
          return (
            <div style={COLUMN_STYLES.container}>
              {renderDecision(record.so_quyet_dinh, handleDownloadDecision)}
              {record.ghi_chu && (
                <Text type="secondary" style={COLUMN_STYLES.noteText}>
                  {record.ghi_chu}
                </Text>
              )}
              {!hasData && <Text>-</Text>}
            </div>
          );
        }

        // Military flag
        if (activeTab === 'HCQKQT') {
          return (
            <div style={COLUMN_STYLES.container}>
              {renderDecision(record.so_quyet_dinh, handleDownloadDecision)}
              {record.ghi_chu && (
                <Text type="secondary" style={COLUMN_STYLES.noteText}>
                  {record.ghi_chu}
                </Text>
              )}
              {!record.so_quyet_dinh && !record.ghi_chu && <Text>-</Text>}
            </div>
          );
        }

        // Contribution awards
        if (activeTab === 'HCBVTQ') {
          const fullName = text ? DANH_HIEU_MAP[text] || text : '-';
          return (
            <div style={COLUMN_STYLES.container}>
              <Text>{fullName}</Text>
              {renderDecision(record.so_quyet_dinh, handleDownloadDecision)}
              {record.ghi_chu && (
                <Text type="secondary" style={COLUMN_STYLES.noteText}>
                  {record.ghi_chu}
                </Text>
              )}
            </div>
          );
        }

        // HCCSVV awards
        if (activeTab === 'HCCSVV') {
          const fullName = text ? DANH_HIEU_MAP[text] || text : '-';
          return (
            <div style={COLUMN_STYLES.container}>
              <Text>{fullName}</Text>
              {renderDecision(record.so_quyet_dinh, handleDownloadDecision)}
              {record.ghi_chu && (
                <Text type="secondary" style={COLUMN_STYLES.noteText}>
                  {record.ghi_chu}
                </Text>
              )}
            </div>
          );
        }

        // Annual awards (default) and Unit awards
        return renderAnnualAwards(text, record, { onDownload: handleDownloadDecision });
      },
    },
    {
      title: 'Thao tác',
      key: 'action',
      width: 100,
      align: 'center',
      fixed: 'right',
      render: (_: unknown, record: AwardTableRow) => {
        return (
          <Popconfirm
            title="Xóa khen thưởng"
            description="Bạn có chắc chắn muốn xóa khen thưởng này? Thao tác này không thể hoàn tác. Lưu ý: Đề xuất khen thưởng sẽ không bị xóa."
            onConfirm={() => handleDeleteAward(record.id)}
            okText="Xóa"
            cancelText="Hủy"
            okButtonProps={{ danger: true }}
          >
            <Button
              type="text"
              danger
              icon={<DeleteOutlined />}
              loading={deletingId === record.id}
              size="small"
            >
              Xóa
            </Button>
          </Popconfirm>
        );
      },
    },
  ];

  const visibleColumns = useMemo(
    () =>
      columns.filter(col => {
        if (activeTab === 'DVHN' && (col.key === 'ngay_sinh' || col.key === 'cap_bac_chuc_vu')) {
          return false;
        }
        if (col.key === 'loai_khen_thuong' && activeTab !== 'NCKH') {
          return false;
        }
        return true;
      }),
    [columns, activeTab]
  );

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
        <Space>
          <Button
            type="primary"
            icon={<DownloadOutlined />}
            onClick={() => setExportModalOpen(true)}
            size="large"
          >
            Xuất Excel
          </Button>
        </Space>
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
            key: 'DVHN',
            label: 'Khen thưởng đơn vị hằng năm',
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

      <ExportModal
        open={exportModalOpen}
        onCancel={() => setExportModalOpen(false)}
        activeTab={activeTab}
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
            {activeTab !== 'DVHN' && (
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
            )}
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
                  placeholder={
                    activeTab === 'DVHN'
                      ? 'Chọn danh hiệu đơn vị'
                      : activeTab === 'CNHN'
                        ? 'Chọn danh hiệu cá nhân'
                        : 'Chọn danh hiệu'
                  }
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
                columns={visibleColumns}
                dataSource={filteredAwards}
                rowKey="id"
                scroll={{ x: 'max-content' }}
                pagination={{
                  ...DEFAULT_ANTD_TABLE_PAGINATION,
                  showTotal: (total, range) => `${range[0]}-${range[1]} của ${total} bản ghi`,
                }}
                bordered
              />
            )}
          </Spin>
        </Card>
      </>
    );
  }
}
