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
import { getApiErrorMessage } from '@/lib/apiError';

import type { TableColumnsType } from 'antd';
import { FilterOutlined, HomeOutlined } from '@ant-design/icons';
import { apiClient } from '@/lib/apiClient';
import {
  DANH_HIEU_MAP,
  COLUMN_STYLES,
  renderDecision,
  renderAnnualAwards,
  getLoaiKhenThuong,
} from '@/utils/awardsHelpers';
import { downloadDecisionFile } from '@/utils/downloadDecisionFile';
import { formatDate } from '@/lib/utils';
import type { AwardType } from '@/constants/danhHieu.constants';

const { Title, Paragraph, Text } = Typography;

interface Award {
  id: number;
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
  mo_ta?: string;
  ten_de_tai?: string;
}

const AWARD_TYPE_CONFIG: Record<
  string,
  {
    fetch: (params: any) => Promise<any>;
    export: (params: any) => Promise<Blob>;
    exportFilename: string;
    template: () => Promise<Blob>;
    templateFilename: string;
    import: (file: File) => Promise<any>;
  }
> = {
  CNHN: {
    fetch: apiClient.getAnnualRewards,
    export: apiClient.exportAnnualRewards,
    exportFilename: 'ca_nhan_hang_nam',
    template: apiClient.getAnnualRewardsTemplate,
    templateFilename: 'mau_import_ca_nhan_hang_nam',
    import: apiClient.importAnnualRewards,
  },
  HCCSVV: {
    fetch: apiClient.getHCCSVV,
    export: apiClient.exportHCCSVV,
    exportFilename: 'hccsvv',
    template: apiClient.getHCCSVVTemplate,
    templateFilename: 'mau_import_hccsvv',
    import: apiClient.importHCCSVV,
  },
  HCBVTQ: {
    fetch: apiClient.getContributionAwards,
    export: apiClient.exportContributionAwards,
    exportFilename: 'hcbvtq_cong_hien',
    template: apiClient.getContributionAwardsTemplate,
    templateFilename: 'mau_import_hcbvtq_cong_hien',
    import: apiClient.importContributionAwards,
  },
  KNC_VSNXD_QDNDVN: {
    fetch: apiClient.getCommemorationMedals,
    export: apiClient.exportCommemorationMedals,
    exportFilename: 'knc_vsnxd_qdndvn',
    template: apiClient.getCommemorationMedalsTemplate,
    templateFilename: 'mau_import_knc_vsnxd_qdndvn',
    import: apiClient.importCommemorationMedals,
  },
  HCQKQT: {
    fetch: apiClient.getMilitaryFlag,
    export: apiClient.exportMilitaryFlag,
    exportFilename: 'hc_quan_ky_quyet_thang',
    template: apiClient.getMilitaryFlagTemplate,
    templateFilename: 'mau_import_hc_quan_ky_quyet_thang',
    import: apiClient.importMilitaryFlag,
  },
  NCKH: {
    fetch: apiClient.getScientificAchievements,
    export: apiClient.exportScientificAchievements,
    exportFilename: 'thanh_tich_khoa_hoc',
    template: apiClient.getScientificAchievementsTemplate,
    templateFilename: 'mau_import_thanh_tich_khoa_hoc',
    import: apiClient.importScientificAchievements,
  },
};

export default function AdminAwardsPage() {
  const [activeTab, setActiveTab] = useState<AwardType>('CNHN');
  const [awards, setAwards] = useState<Award[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    nam: '',
    ho_ten: '',
    danh_hieu: '',
    de_tai: '',
  });
  const [debouncedFilters, setDebouncedFilters] = useState(filters);

  const DANH_HIEU_OPTIONS: Record<string, string[]> = {
    CNHN: ['CSTDCS', 'CSTT', 'BKBQP', 'CSTDTQ'],
    HCCSVV: ['HCCSVV_HANG_NHAT', 'HCCSVV_HANG_NHI', 'HCCSVV_HANG_BA'],
    HCBVTQ: ['HCBVTQ_HANG_NHAT', 'HCBVTQ_HANG_NHI', 'HCBVTQ_HANG_BA'],
  };

  // Detail modal state

  useEffect(() => {
    fetchAwards();
  }, [activeTab]);

  // Reset bộ lọc khi đổi tab để không giữ giá trị tab khác
  useEffect(() => {
    setFilters({
      nam: '',
      ho_ten: '',
      danh_hieu: '',
      de_tai: '',
    });
  }, [activeTab]);

  useEffect(() => {
    const id = setTimeout(() => setDebouncedFilters(filters), 300);
    return () => clearTimeout(id);
  }, [filters]);

  const fetchAwards = async () => {
    try {
      setLoading(true);
      const params: any = { limit: 1000 };

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

  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const handleDownloadDecision = async (soQuyetDinh: string) => {
    await downloadDecisionFile(soQuyetDinh);
  };

  const getPersonName = (record: any) => record?.QuanNhan?.ho_ten || record?.ho_ten || '';

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

  // Lấy danh sách các năm có trong dữ liệu
  const availableYears = useMemo(() => {
    const years = new Set<number>();
    awards.forEach(award => {
      if (award.nam) {
        years.add(award.nam);
      }
    });
    return Array.from(years).sort((a, b) => b - a); // Sắp xếp giảm dần
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

      // Danh hiệu filters
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
      render: (text: string, record: any) => {
        // Handle nested QuanNhan structure for scientific, military flag, contribution, hccsvv, and commemoration awards
        // Note: annual awards may or may not have nested QuanNhan, so we check both
        const hasNestedQuanNhan =
          activeTab === 'NCKH' ||
          activeTab === 'HCQKQT' ||
          activeTab === 'HCBVTQ' ||
          activeTab === 'HCCSVV' ||
          activeTab === 'KNC_VSNXD_QDNDVN';

        // For annual tab, check if QuanNhan exists, otherwise use direct fields
        const isAnnualTab = activeTab === 'CNHN';
        const hoTen = hasNestedQuanNhan
          ? record.QuanNhan?.ho_ten
          : isAnnualTab
            ? record.QuanNhan?.ho_ten || text || record.ho_ten
            : text;
        const unitInfo: string[] = [];

        if (hasNestedQuanNhan || (isAnnualTab && record.QuanNhan)) {
          // Has nested QuanNhan structure
          if (record.QuanNhan?.DonViTrucThuoc?.ten_don_vi) {
            unitInfo.push(record.QuanNhan.DonViTrucThuoc.ten_don_vi);
          }
          if (record.QuanNhan?.CoQuanDonVi?.ten_don_vi) {
            unitInfo.push(record.QuanNhan.CoQuanDonVi.ten_don_vi);
          }
        } else if (isAnnualTab) {
          // Annual tab without nested QuanNhan - use direct fields
          if (record.don_vi_truc_thuoc) unitInfo.push(record.don_vi_truc_thuoc);
          if (record.co_quan_don_vi) unitInfo.push(record.co_quan_don_vi);
          if (record.don_vi) unitInfo.push(record.don_vi);
        }

        const unitInfoText = unitInfo.length > 0 ? unitInfo.join(', ') : record.don_vi || '';

        return (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <Text strong>{hoTen || '-'}</Text>
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
      render: (_: any, record: any) => {
        // Get date from nested QuanNhan or direct field
        const hasNestedQuanNhan =
          activeTab === 'NCKH' ||
          activeTab === 'HCQKQT' ||
          activeTab === 'HCBVTQ' ||
          activeTab === 'HCCSVV' ||
          activeTab === 'KNC_VSNXD_QDNDVN';

        // For annual tab, check if QuanNhan exists, otherwise use direct field
        const isAnnualTab = activeTab === 'CNHN';
        const ngaySinh = hasNestedQuanNhan
          ? record.QuanNhan?.ngay_sinh
          : isAnnualTab
            ? record.QuanNhan?.ngay_sinh || record.ngay_sinh
            : record.ngay_sinh;

        return <Text>{formatDate(ngaySinh)}</Text>;
      },
    },
    {
      title: 'Cấp bậc / Chức vụ',
      key: 'cap_bac_chuc_vu',
      width: 150,
      align: 'center',
      render: (_: any, record: any) => {
        // Lấy trực tiếp từ record (dữ liệu đã lưu trong bảng)
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
      title: 'Loại khen thưởng',
      key: 'loai_khen_thuong',
      width: 140,
      align: 'center',
      render: (_: any, record: any) => {
        if (activeTab === 'NCKH') {
          const loaiMap: Record<string, string> = {
            DTKH: 'ĐTKH',
            SKKH: 'SKKH',
          };
          return <Text>{loaiMap[record.loai] || record.loai || '-'}</Text>;
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
      render: (text: string | null, record: any) => {
        // Scientific achievements
        if (activeTab === 'NCKH') {
          return (
            <div style={COLUMN_STYLES.container}>
              <Text>{text || '-'}</Text>
              {renderDecision(record.so_quyet_dinh, handleDownloadDecision)}
            </div>
          );
        }

        // Commemoration medals (KNC_VSNXD_QDNDVN) - Nếu có bản ghi thì mặc định là KNC
        if (activeTab === 'KNC_VSNXD_QDNDVN') {
          const danhHieu =
            DANH_HIEU_MAP['KNC_VSNXD_QDNDVN'] || 'Kỷ niệm chương Vì sự nghiệp xây dựng QĐNDVN';
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

        // Military flag - Nếu có bản ghi thì mặc định là HC_QKQT
        if (activeTab === 'HCQKQT') {
          const danhHieu = DANH_HIEU_MAP['HC_QKQT'] || 'Huy chương Quân kỳ Quyết thắng';
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
              {record.ghi_chu && (
                <Text type="secondary" style={COLUMN_STYLES.noteText}>
                  {record.ghi_chu}
                </Text>
              )}
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
              {record.ghi_chu && (
                <Text type="secondary" style={COLUMN_STYLES.noteText}>
                  {record.ghi_chu}
                </Text>
              )}
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
        <Breadcrumb.Item>Quản Lý Khen Thưởng</Breadcrumb.Item>
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
            Quản Lý Khen Thưởng
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
            label: 'Cá nhân hằng năm',
            children: renderAwardContent(),
          },
          {
            key: 'HCCSVV',
            label: 'Huy chương Chiến sĩ Vẻ vang',
            children: renderAwardContent(),
          },
          {
            key: 'HCBVTQ',
            label: 'Huân chương Bảo vệ Tổ quốc',
            children: renderAwardContent(),
          },
          {
            key: 'KNC_VSNXD_QDNDVN',
            label: 'Kỷ niệm chương VSNXD QĐNDVN',
            children: renderAwardContent(),
          },
          {
            key: 'HCQKQT',
            label: 'Huy chương Quân kỳ Quyết thắng',
            children: renderAwardContent(),
          },
          {
            key: 'NCKH',
            label: 'Thành tích khoa học',
            children: renderAwardContent(),
          },
        ]}
      />
    </div>
  );

  function renderAwardContent() {
    return (
      <>
        {/* Import Section */}
        {/* {(activeTab === 'CNHN' ||
          activeTab === 'DVHN' ||
          activeTab === 'NCKH' ||
          activeTab === 'HCCSVV' ||
          activeTab === 'HCBVTQ' ||
          activeTab === 'KNC_VSNXD_QDNDVN' ||
          activeTab === 'HCQKQT') && (
          <Card
            title={
              <Space>
                <UploadOutlined />
                Import Khen Thưởng
              </Space>
            }
            style={{ marginBottom: '24px' }}
          >
            <Space direction="vertical" style={{ width: '100%' }} size="large">
              <Space wrap>
                <Button
                  icon={<FileExcelOutlined />}
                  onClick={handleDownloadTemplate}
                  loading={downloadingTemplate}
                >
                  {downloadingTemplate ? 'Đang tải...' : 'Tải File Mẫu Excel'}
                </Button>
                <Button
                  type="primary"
                  icon={<UploadOutlined />}
                  onClick={handleUploadClick}
                  loading={importing}
                >
                  {importing ? 'Đang import...' : 'Upload File Excel'}
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleFileChange}
                  style={{ display: 'none' }}
                />
              </Space>

              {importResult && (
                <Alert
                  type={importResult.type === 'success' ? 'success' : 'error'}
                  message={<Text strong>{importResult.message}</Text>}
                  description={
                    importResult.details?.errors && importResult.details.errors.length > 0 ? (
                      <div style={{ marginTop: '8px' }}>
                        <Text strong>Lỗi chi tiết:</Text>
                        <ul style={{ marginTop: '4px', marginBottom: 0 }}>
                          {importResult.details.errors.slice(0, 5).map((err, idx) => (
                            <li key={idx}>{err}</li>
                          ))}
                          {importResult.details.errors.length > 5 && (
                            <li style={{ color: '#8c8c8c' }}>
                              ... và {importResult.details.errors.length - 5} lỗi khác
                            </li>
                          )}
                        </ul>
                      </div>
                    ) : null
                  }
                  closable
                  onClose={() => setImportResult(null)}
                />
              )}
            </Space>
          </Card>
        )} */}

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
            {(activeTab === 'CNHN' || activeTab === 'HCCSVV' || activeTab === 'HCBVTQ') && (
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
                onClick={() => setFilters({ nam: '', ho_ten: '', danh_hieu: '', de_tai: '' })}
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
                  // Keep 'loai_khen_thuong' for scientific tab only
                  if (col.key === 'loai_khen_thuong' && activeTab !== 'NCKH') {
                    return false;
                  }
                  return true;
                })}
                dataSource={filteredAwards}
                rowKey="id"
                pagination={{
                  pageSize: 20,
                  showSizeChanger: true,
                  showTotal: total => `Tổng ${total} bản ghi`,
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
