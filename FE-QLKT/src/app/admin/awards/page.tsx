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
  getLoaiKhenThuong,
} from '@/utils/awardsHelpers';
import { AWARD_TAB_DANH_HIEU } from '@/constants/danhHieu.constants';
import ExportModal from './ExportModal';
import { formatDate } from '@/lib/utils';

const { Title, Paragraph, Text } = Typography;

/** Một dòng bảng khen thưởng — có thể là cấu trúc lồng (adhoc, scientific, …) */
interface AwardCore {
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
  mo_ta?: string | null;
  ten_de_tai?: string | null;
}

/** Dòng hiển thị/ghép filter — gồm cả bản ghi adhoc / scientific có quan hệ lồng */
type AwardTableRow = AwardCore & {
  doi_tuong?: string;
  loai?: string;
  QuanNhan?: { ho_ten?: string };
  CoQuanDonVi?: { ten_don_vi?: string };
  DonViTrucThuoc?: { ten_don_vi?: string };
  hinh_thuc_khen_thuong?: string;
};

type Award = AwardCore;

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
  const [activeTab, setActiveTab] = useState('CNHN');
  const [awards, setAwards] = useState<AwardTableRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [filters, setFilters] = useState({
    nam: '',
    ho_ten: '',
    danh_hieu: '',
    de_tai: '',
    doi_tuong: '', // Cho adhoc: CA_NHAN, TAP_THE hoặc '' (tất cả)
  });
  const [debouncedFilters, setDebouncedFilters] = useState(filters);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    fetchAwards();
  }, [activeTab]);

  // Reset bộ lọc khi đổi tab để không dùng chung giữa các loại
  useEffect(() => {
    setFilters({
      nam: '',
      ho_ten: '',
      danh_hieu: '',
      de_tai: '',
      doi_tuong: '',
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
      // Error handled by UI message
      message.error(getApiErrorMessage(error, 'Có lỗi xảy ra khi xóa khen thưởng'));
    } finally {
      setDeletingId(null);
    }
  };

  const handleDownloadDecision = async (soQuyetDinh: string) => {
    await downloadDecisionFile(soQuyetDinh);
  };

  const getPersonName = (record: any) => record?.QuanNhan?.ho_ten || record?.ho_ten || '';

  const getUnitName = (record: any) =>
    record?.DonViTrucThuoc?.ten_don_vi ||
    record?.CoQuanDonVi?.ten_don_vi ||
    record?.don_vi_truc_thuoc ||
    record?.co_quan_don_vi ||
    record?.don_vi ||
    '';

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
    const doiTuongFilter = debouncedFilters.doi_tuong.trim();

    return awards.filter((record: AwardTableRow) => {
      if (yearFilter && String(record.nam) !== yearFilter) return false;

      // Name / unit search
      if (activeTab === 'DVHN') {
        if (nameFilter) {
          const unit = getUnitName(record).toLowerCase();
          if (!unit.includes(nameFilter)) return false;
        }
      } else if (activeTab === 'adhoc') {
        // Adhoc: tìm kiếm theo tên cá nhân, tên đơn vị, hoặc hình thức khen thưởng
        if (nameFilter) {
          const doiTuong = record.doi_tuong || record.loai;
          let searchText = '';
          if (doiTuong === 'CA_NHAN') {
            searchText = record.QuanNhan?.ho_ten || '';
          } else {
            searchText = record.CoQuanDonVi?.ten_don_vi || record.DonViTrucThuoc?.ten_don_vi || '';
          }
          // Thêm hình thức khen thưởng vào tìm kiếm
          const hinhThuc = record.hinh_thuc_khen_thuong || '';
          const combined = `${searchText} ${hinhThuc}`.toLowerCase();
          if (!combined.includes(nameFilter)) return false;
        }
        // Filter theo đối tượng (CA_NHAN / TAP_THE)
        if (doiTuongFilter) {
          const doiTuong = record.doi_tuong || record.loai;
          if (doiTuong !== doiTuongFilter) return false;
        }
      } else {
        if (nameFilter) {
          const name = getPersonName(record).toLowerCase();
          if (!name.includes(nameFilter)) return false;
        }
      }

      // Danh hiệu filters
      if (danhHieuFilter) {
        if (['CNHN', 'DVHN', 'HCCSVV', 'HCBVTQ'].includes(activeTab)) {
          if (activeTab === 'CNHN') {
            const nhanBKBQP = record.nhan_bkbqp;
            const nhanCSTDTQ = record.nhan_cstdtq;
            const nhanBKTTCP = record.nhan_bkttcp;

            const hasBKBQPFlag = Boolean(nhanBKBQP);
            const hasCSTDTQFlag = Boolean(nhanCSTDTQ);
            const hasBKTTCPFlag = Boolean(nhanBKTTCP);

            const isBKBQP = danhHieuFilter === 'BKBQP' && hasBKBQPFlag;
            const isCSTDTQ = danhHieuFilter === 'CSTDTQ' && hasCSTDTQFlag;
            const isBKTTCP = danhHieuFilter === 'BKTTCP' && hasBKTTCPFlag;

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
      render: (text: string, record: any) => {
        // Handle nested QuanNhan structure for scientific, military flag, contribution, annual, hccsvv, and commemoration awards
        const hasNestedQuanNhan =
          activeTab === 'NCKH' ||
          activeTab === 'HCQKQT' ||
          activeTab === 'HCBVTQ' ||
          activeTab === 'CNHN' ||
          activeTab === 'HCCSVV' ||
          activeTab === 'KNC_VSNXD_QDNDVN';
        const hoTen = hasNestedQuanNhan ? record.QuanNhan?.ho_ten : text;
        const unitInfo: string[] = [];
        let parentUnit: string | null = null;

        if (hasNestedQuanNhan) {
          if (record.QuanNhan?.DonViTrucThuoc?.ten_don_vi) {
            unitInfo.push(record.QuanNhan.DonViTrucThuoc.ten_don_vi);
            parentUnit = record.QuanNhan.DonViTrucThuoc.CoQuanDonVi?.ten_don_vi || null;
          }
          if (record.QuanNhan?.CoQuanDonVi?.ten_don_vi) {
            unitInfo.push(record.QuanNhan.CoQuanDonVi.ten_don_vi);
          }
        } else {
          // Unit awards
          if (record.DonViTrucThuoc?.ten_don_vi) {
            unitInfo.push(record.DonViTrucThuoc.ten_don_vi);
            parentUnit = record.DonViTrucThuoc.CoQuanDonVi?.ten_don_vi || null;
          }
          if (record.CoQuanDonVi?.ten_don_vi) {
            unitInfo.push(record.CoQuanDonVi.ten_don_vi);
          }
          // Fallback to string fields
          if (unitInfo.length === 0) {
            if (record.don_vi_truc_thuoc) unitInfo.push(record.don_vi_truc_thuoc);
            if (record.co_quan_don_vi) unitInfo.push(record.co_quan_don_vi);
          }
        }

        const unitInfoText = unitInfo.length > 0 ? unitInfo.join(', ') : record.don_vi || '';
        const displayName = activeTab === 'DVHN' ? unitInfoText : hoTen || '-';

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
      render: (_: any, record: any) => {
        // Get date from nested QuanNhan or direct field
        const hasNestedQuanNhan =
          activeTab === 'NCKH' ||
          activeTab === 'HCQKQT' ||
          activeTab === 'HCBVTQ' ||
          activeTab === 'CNHN' ||
          activeTab === 'HCCSVV' ||
          activeTab === 'KNC_VSNXD_QDNDVN';

        const ngaySinh = hasNestedQuanNhan ? record.QuanNhan?.ngay_sinh : record.ngay_sinh;

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
      title: activeTab === 'NCKH' ? 'Loại thành tích' : 'Loại khen thưởng',
      key: 'loai_khen_thuong',
      width: 140,
      align: 'center',
      render: (_: any, record: any) => {
        if (activeTab === 'NCKH') {
          const loaiMap: Record<string, string> = {
            DTKH: 'Đề tài khoa học',
            SKKH: 'Sáng kiến khoa học',
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
      render: (_: any, record: any) => {
        // Hiển thị nút xóa cho tất cả các loại khen thưởng
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
        onChange={setActiveTab}
        size="large"
        items={[
          {
            key: 'CNHN',
            label: 'Cá nhân hằng năm',
            children: renderAwardContent(),
          },
          {
            key: 'DVHN',
            label: 'Đơn vị hằng năm',
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
            {activeTab !== 'DVHN' && activeTab !== 'adhoc' && (
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
            {activeTab === 'adhoc' && (
              <>
                <div
                  style={{
                    flex: '1 1 200px',
                    minWidth: '200px',
                    display: 'flex',
                    flexDirection: 'column',
                  }}
                >
                  <Text strong style={{ display: 'block', marginBottom: '8px' }}>
                    Tìm kiếm
                  </Text>
                  <Input
                    placeholder="Tên cá nhân, đơn vị hoặc hình thức khen thưởng"
                    value={filters.ho_ten}
                    onChange={e => handleFilterChange('ho_ten', e.target.value)}
                    allowClear
                    size="large"
                  />
                </div>
                <div style={{ flex: '0 0 160px', display: 'flex', flexDirection: 'column' }}>
                  <Text strong style={{ display: 'block', marginBottom: '8px' }}>
                    Đối tượng
                  </Text>
                  <Select
                    allowClear
                    style={{ width: '100%' }}
                    placeholder="Tất cả"
                    value={filters.doi_tuong || undefined}
                    onChange={value => handleFilterChange('doi_tuong', value || '')}
                    size="large"
                  >
                    <Select.Option value="CA_NHAN">Cá nhân</Select.Option>
                    <Select.Option value="TAP_THE">Tập thể</Select.Option>
                  </Select>
                </div>
              </>
            )}
            {(activeTab === 'CNHN' ||
              activeTab === 'HCCSVV' ||
              activeTab === 'HCBVTQ' ||
              activeTab === 'DVHN') && (
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
                onClick={() =>
                  setFilters({ nam: '', ho_ten: '', danh_hieu: '', de_tai: '', doi_tuong: '' })
                }
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
                  // Filter out 'ngay_sinh' and 'cap_bac_chuc_vu' columns for unit tab
                  if (
                    activeTab === 'DVHN' &&
                    (col.key === 'ngay_sinh' || col.key === 'cap_bac_chuc_vu')
                  ) {
                    return false;
                  }
                  // Keep 'loai_khen_thuong' only for scientific tab
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
                  showTotal: (total, range) => `${range[0]}-${range[1]} của ${total} bản ghi`,
                  pageSizeOptions: ['10', '20', '50', '100'],
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
