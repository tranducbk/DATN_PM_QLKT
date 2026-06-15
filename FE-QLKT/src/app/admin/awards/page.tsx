'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Card,
  Button,
  Table,
  Space,
  Typography,
  Breadcrumb,
  message,
  Tabs,
  Popconfirm,
  Empty,
} from 'antd';
import { getApiErrorMessage } from '@/lib/http/apiError';

import type { TableColumnsType } from 'antd';
import { DownloadOutlined, HomeOutlined, DeleteOutlined } from '@ant-design/icons';
import { apiClient } from '@/lib/http/apiClient';
import { downloadDecisionFile } from '@/lib/file/downloadDecisionFile';
import {
  DANH_HIEU_MAP,
  COLUMN_STYLES,
  renderDecision,
  renderAnnualAwards,
  renderUnitAnnualAwards,
  collectPersonalAwards,
  collectUnitAwards,
  renderAwardDeleteButtons,
  matchesDanhHieuSelection,
  buildUnitSearchText,
} from '@/lib/award/awardsHelper';
import {
  AWARD_TAB_DANH_HIEU,
  AWARD_TAB_LABELS,
  AWARD_TAB_META,
  getDanhHieuName,
  type AwardType,
} from '@/constants/danhHieu.constants';

import { ExportModal } from './ExportModal';
import { DEFAULT_ANTD_TABLE_PAGINATION, FETCH_ALL_LIMIT } from '@/constants/pagination.constants';
import { useDebounce } from '@/hooks/useDebounce';
import { AwardsFilterBar } from '@/components/awards/AwardsFilterBar';
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

interface AwardTypeFetchParams {
  limit?: number;
  page?: number;
  [key: string]: unknown;
}

interface AwardTypeApiResult {
  success: boolean;
  message?: string;
  data?: AwardTableRow[];
}

interface AwardTypeDeleteResult {
  success: boolean;
  message?: string;
}

const AWARD_TYPE_CONFIG: Record<
  string,
  {
    fetch: (params: AwardTypeFetchParams) => Promise<AwardTypeApiResult>;
    delete: (id: string, awardType?: string) => Promise<AwardTypeDeleteResult>;
  }
> = {
  CNHN: { fetch: apiClient.getAnnualRewards, delete: apiClient.deleteAnnualReward },
  DVHN: { fetch: apiClient.getUnitAnnualAwards, delete: apiClient.deleteUnitAnnualAward },
  HCCSVV: { fetch: apiClient.getTenureMedals, delete: apiClient.deleteTenureMedal },
  HCBVTQ: { fetch: apiClient.getContributionMedals, delete: apiClient.deleteContributionMedal },
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
  const [awardsByTab, setAwardsByTab] = useState<Partial<Record<AwardType, AwardTableRow[]>>>({});
  const [loading, setLoading] = useState(true);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [filters, setFilters] = useState<AwardFilters>(INITIAL_FILTERS);
  const debouncedFilters = useDebounce(filters);
  const [deleting, setDeleting] = useState<{ id: string; awardType?: string } | null>(null);
  const awards = useMemo(() => awardsByTab[activeTab] ?? [], [awardsByTab, activeTab]);

  const fetchAwards = useCallback(async () => {
    try {
      const cachedData = awardsByTab[activeTab];
      if (cachedData) {
        setLoading(false);
        return;
      }
      setLoading(true);
      const params: AwardTypeFetchParams = { limit: FETCH_ALL_LIMIT };

      const config = AWARD_TYPE_CONFIG[activeTab];
      const result = await (config ?? AWARD_TYPE_CONFIG.CNHN).fetch(params);

      if (!result.success) {
        message.error(result.message || 'Không thể tải danh sách khen thưởng');
        return;
      }
      setAwardsByTab(prev => ({ ...prev, [activeTab]: result.data ?? [] }));
    } catch {
      message.error('Không thể tải danh sách khen thưởng');
    } finally {
      setLoading(false);
    }
  }, [activeTab, awardsByTab]);

  useEffect(() => {
    fetchAwards();
  }, [fetchAwards]);

  useEffect(() => {
    setFilters(INITIAL_FILTERS);
  }, [activeTab]);

  const handleFilterChange = (key: keyof AwardFilters, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const handleDeleteAward = async (id: string, awardType?: string, awardLabel?: string) => {
    try {
      setDeleting({ id, awardType });
      const config = AWARD_TYPE_CONFIG[activeTab];
      if (!config) {
        message.error('Loại khen thưởng không được hỗ trợ xóa');
        return;
      }
      const result = await config.delete(id, awardType);

      if (!result.success) {
        message.error(result.message || 'Xóa khen thưởng thất bại');
        return;
      }
      message.success(awardLabel ? `Đã xóa ${awardLabel}` : 'Xóa khen thưởng thành công');
      await fetchAwards();
    } catch (error: unknown) {
      message.error(getApiErrorMessage(error, 'Có lỗi xảy ra khi xóa khen thưởng'));
    } finally {
      setDeleting(null);
    }
  };

  const handleDownloadDecision = async (soQuyetDinh: string) => {
    await downloadDecisionFile(soQuyetDinh);
  };

  const getPersonName = (record: AwardTableRow) => record.QuanNhan?.ho_ten || record.ho_ten || '';

  const matchesNameFilter = useCallback(
    (record: AwardTableRow, normalizedNameFilter: string): boolean => {
      if (!normalizedNameFilter) return true;
      const haystack = activeTab === 'DVHN' ? buildUnitSearchText(record) : getPersonName(record);
      return haystack.toLowerCase().includes(normalizedNameFilter);
    },
    [activeTab]
  );

  const matchesDanhHieuFilter = useCallback(
    (record: AwardTableRow, selectedDanhHieu: string): boolean => {
      if (!selectedDanhHieu || !AWARD_TAB_META[activeTab].hasDanhHieuFilter) return true;
      return matchesDanhHieuSelection(record, selectedDanhHieu);
    },
    [activeTab]
  );

  const resolvePersonnelDisplay = (record: AwardTableRow): PersonnelDisplay => {
    const isAnnualTab = activeTab === 'CNHN';
    const hasNestedQuanNhan = AWARD_TAB_META[activeTab].hasNestedQuanNhan;
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
        activeTab === 'DVHN'
          ? unitInfo.length
            ? unitInfo.join(', ')
            : record.don_vi || '-'
          : hoTen || '-',
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
  }, [awards, debouncedFilters, activeTab, matchesNameFilter, matchesDanhHieuFilter]);

  const columns: TableColumnsType<AwardTableRow> = useMemo(
    () => [
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
        width: 110,
        align: 'center',
        render: (_: unknown, record: AwardTableRow) => {
          const { ngaySinh } = resolvePersonnelDisplay(record);
          return <Text>{formatDate(ngaySinh)}</Text>;
        },
      },
      {
        title: 'Cấp bậc / Chức vụ',
        key: 'cap_bac_chuc_vu',
        width: 140,
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
        title: AWARD_TAB_META[activeTab].hasThangNhan ? 'Thời gian nhận' : 'Năm nhận',
        key: 'nam',
        width: AWARD_TAB_META[activeTab].hasThangNhan ? 120 : 70,
        align: 'center',
        render: (_: unknown, record: AwardTableRow) => {
          if (AWARD_TAB_META[activeTab].hasThangNhan && record.thang) {
            return <Text strong>{`${String(record.thang).padStart(2, '0')}/${record.nam}`}</Text>;
          }
          return <Text strong>{record.nam}</Text>;
        },
      },
      {
        title: activeTab === 'NCKH' ? 'Loại thành tích' : 'Loại khen thưởng',
        key: 'loai_khen_thuong',
        width: 140,
        align: 'center',
        render: (_: unknown, record: AwardTableRow) => {
          // Only visible on the NCKH tab (filtered below)
          return <Text>{record.loai ? getDanhHieuName(record.loai) : '-'}</Text>;
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
        width: 300,
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

          if (activeTab === 'DVHN') {
            return renderUnitAnnualAwards(text, record, { onDownload: handleDownloadDecision });
          }

          return renderAnnualAwards(text, record, { onDownload: handleDownloadDecision });
        },
      },
      {
        title: 'Thao tác',
        key: 'action',
        width: 130,
        align: 'center',
        fixed: 'right',
        render: (_: unknown, record: AwardTableRow) => {
          if (activeTab === 'CNHN') {
            const awards = collectPersonalAwards(record);
            return renderAwardDeleteButtons(awards, (awardCode, awardLabel) =>
              handleDeleteAward(record.id, awardCode, awardLabel)
            );
          }
          if (activeTab === 'DVHN') {
            const awards = collectUnitAwards(record);
            return renderAwardDeleteButtons(awards, (awardCode, awardLabel) =>
              handleDeleteAward(record.id, awardCode, awardLabel)
            );
          }
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
                loading={deleting?.id === record.id && !deleting?.awardType}
                size="small"
              >
                Xóa
              </Button>
            </Popconfirm>
          );
        },
      },
      // eslint-disable-next-line react-hooks/exhaustive-deps
    ],
    [activeTab, deleting]
  );

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
          { key: 'CNHN', label: AWARD_TAB_LABELS.CNHN },
          { key: 'DVHN', label: AWARD_TAB_LABELS.DVHN },
          { key: 'HCCSVV', label: AWARD_TAB_LABELS.HCCSVV },
          { key: 'HCBVTQ', label: AWARD_TAB_LABELS.HCBVTQ },
          { key: 'KNC_VSNXD_QDNDVN', label: AWARD_TAB_LABELS.KNC_VSNXD_QDNDVN },
          { key: 'HCQKQT', label: AWARD_TAB_LABELS.HCQKQT },
          { key: 'NCKH', label: AWARD_TAB_LABELS.NCKH },
        ]}
      />
      {renderAwardContent()}

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
        <AwardsFilterBar
          filters={filters}
          availableYears={availableYears}
          danhHieuOptions={danhHieuOptions}
          showDanhHieuFilter={AWARD_TAB_META[activeTab].hasDanhHieuFilter}
          showTopicFilter={activeTab === 'NCKH'}
          searchLabel={AWARD_TAB_META[activeTab].searchLabel}
          searchPlaceholder={AWARD_TAB_META[activeTab].searchPlaceholder}
          danhHieuPlaceholder={AWARD_TAB_META[activeTab].danhHieuPlaceholder}
          onFilterChange={handleFilterChange}
          onReset={() => setFilters(INITIAL_FILTERS)}
        />

        {/* Awards Table */}
        <Card title={`Danh sách khen thưởng (${filteredAwards.length})`}>
          {!loading && awards.length === 0 ? (
            <Empty description="Chưa có dữ liệu khen thưởng" style={{ padding: '48px 0' }} />
          ) : (
            <Table
              columns={visibleColumns}
              dataSource={filteredAwards}
              rowKey="id"
              loading={loading}
              scroll={{ x: 'max-content' }}
              pagination={{
                ...DEFAULT_ANTD_TABLE_PAGINATION,
                showTotal: (total, range) => `${range[0]}-${range[1]} của ${total} bản ghi`,
              }}
              bordered
            />
          )}
        </Card>
      </>
    );
  }
}
