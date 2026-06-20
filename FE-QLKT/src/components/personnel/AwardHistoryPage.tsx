'use client';

import { useState, useEffect, useCallback, type ReactNode } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  Card,
  Button,
  Table,
  Space,
  Typography,
  message,
  ConfigProvider,
  theme as antdTheme,
  Tag,
  Empty,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { LeftOutlined } from '@ant-design/icons';
import { apiClient } from '@/lib/http/apiClient';
import { PageBreadcrumb } from '@/components/shared/PageBreadcrumb';
import { useTheme } from '@/components/ThemeProvider';
import { LoadingState } from '@/components/shared/LoadingState';
import { downloadDecisionFile } from '@/lib/file/downloadDecisionFile';
import { getEligibilityStatusMeta } from '@/constants/eligibilityStatus.constants';
import type { PersonnelDetail } from '@/lib/types/personnelList';

const { Title, Paragraph } = Typography;

export interface AwardHistoryRow {
  id: string;
  name?: string;
  nam?: number;
  thang?: number | null;
  cap_bac?: string;
  chuc_vu?: string;
  so_quyet_dinh?: string;
  ghi_chu?: string;
  rank?: string;
  status: string;
}

/** Raw award record shape returned by the award list/by-personnel APIs. */
export interface RawAwardRecord {
  id: string;
  quan_nhan_id?: string;
  QuanNhan?: { id?: string } | null;
  danh_hieu?: string;
  nam?: number;
  thang?: number | null;
  cap_bac?: string;
  chuc_vu?: string;
  so_quyet_dinh?: string;
  ghi_chu?: string;
}

/** Wrapper shape for by-personnel award endpoints that report receipt status. */
export interface ReceivedAwardResponse {
  hasReceived?: boolean;
  data?: RawAwardRecord[];
}

/** Helpers passed to a page's column builder so cell renderers can reuse shared behavior. */
export interface AwardHistoryColumnHelpers {
  openDecisionFile: (soQuyetDinh: string) => void;
  renderStatusTag: (status: string) => ReactNode;
}

export const nameColumn: ColumnsType<AwardHistoryRow>[number] = {
  title: 'Tên khen thưởng',
  dataIndex: 'name',
  key: 'name',
  width: 220,
  minWidth: 180,
  fixed: 'left',
  render: (name: string, record: AwardHistoryRow) => (
    <div>
      <div style={{ fontWeight: 500 }}>{name}</div>
      {record.rank && (
        <div style={{ fontSize: '12px', color: '#8c8c8c' }}>Hạng: {record.rank}</div>
      )}
    </div>
  ),
};

/**
 * Builds the time column with the given header (award types differ in wording).
 * @param title - Column header text
 * @returns Column showing MM/YYYY when a month exists, otherwise the year
 */
export const timeColumn = (title: string): ColumnsType<AwardHistoryRow>[number] => ({
  title,
  key: 'thoi_gian_nhan',
  width: 120,
  minWidth: 90,
  align: 'center',
  render: (_: unknown, record: AwardHistoryRow) =>
    record.thang && record.nam
      ? `${String(record.thang).padStart(2, '0')}/${record.nam}`
      : record.nam || '-',
});

export const capBacColumn: ColumnsType<AwardHistoryRow>[number] = {
  title: 'Cấp bậc',
  dataIndex: 'cap_bac',
  key: 'cap_bac',
  width: 120,
  minWidth: 100,
  align: 'center',
  render: (capBac: string) => capBac || '-',
};

export const chucVuColumn: ColumnsType<AwardHistoryRow>[number] = {
  title: 'Chức vụ',
  dataIndex: 'chuc_vu',
  key: 'chuc_vu',
  width: 150,
  minWidth: 120,
  align: 'center',
  ellipsis: true,
  render: (chucVu: string) => chucVu || '-',
};

/**
 * Builds the decision-number column that downloads the decision file on click.
 * @param openDecisionFile - Handler that downloads a decision file by number
 * @returns Decision-number column
 */
export const decisionColumn = (
  openDecisionFile: (soQuyetDinh: string) => void
): ColumnsType<AwardHistoryRow>[number] => ({
  title: 'Số quyết định',
  dataIndex: 'so_quyet_dinh',
  key: 'so_quyet_dinh',
  width: 140,
  minWidth: 120,
  align: 'center',
  render: (soQuyetDinh: string) => {
    if (!soQuyetDinh || soQuyetDinh.trim() === '') {
      return <span>Chưa có</span>;
    }
    return (
      <a
        onClick={e => {
          e.preventDefault();
          e.stopPropagation();
          openDecisionFile(soQuyetDinh);
        }}
        className="text-green-600 dark:text-green-400 font-medium underline cursor-pointer"
      >
        {soQuyetDinh}
      </a>
    );
  },
});

export const ghiChuColumn: ColumnsType<AwardHistoryRow>[number] = {
  title: 'Ghi chú',
  dataIndex: 'ghi_chu',
  key: 'ghi_chu',
  width: 200,
  minWidth: 150,
  ellipsis: true,
  render: (ghiChu: string) => ghiChu || '-',
};

/**
 * Builds the status column rendered as a colored tag.
 * @param renderStatusTag - Renders an eligibility status as a tag
 * @returns Status column
 */
export const statusColumn = (
  renderStatusTag: (status: string) => ReactNode
): ColumnsType<AwardHistoryRow>[number] => ({
  title: 'Trạng thái',
  dataIndex: 'status',
  key: 'status',
  width: 120,
  minWidth: 100,
  align: 'center',
  fixed: 'right',
  render: (status: string) => renderStatusTag(status),
});

interface AwardHistoryPageProps {
  basePath: '/admin' | '/manager';
  awardLabel: string;
  fetchRows: (personnelId: string) => Promise<AwardHistoryRow[]>;
  buildColumns: (helpers: AwardHistoryColumnHelpers) => ColumnsType<AwardHistoryRow>;
  backTab?: number;
}

/**
 * Shared personnel award-history page: breadcrumb, header, and a read-only table.
 * Each award type supplies its own data fetch/mapping and column set.
 * @returns The award-history page element
 */
export function AwardHistoryPage({
  basePath,
  awardLabel,
  fetchRows,
  buildColumns,
  backTab = 3,
}: AwardHistoryPageProps) {
  const params = useParams();
  const personnelId = params?.id as string;
  const { theme } = useTheme();
  const [loading, setLoading] = useState(true);
  const [personnel, setPersonnel] = useState<PersonnelDetail | null>(null);
  const [rows, setRows] = useState<AwardHistoryRow[]>([]);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [personnelRes, rowsData] = await Promise.all([
        apiClient.getPersonnelById(personnelId),
        fetchRows(personnelId),
      ]);
      if (personnelRes.success && personnelRes.data) {
        setPersonnel(personnelRes.data);
      }
      setRows(rowsData);
    } catch (error) {
      message.error('Không thể tải dữ liệu');
    } finally {
      setLoading(false);
    }
  }, [personnelId, fetchRows]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const helpers: AwardHistoryColumnHelpers = {
    openDecisionFile: (soQuyetDinh: string) => {
      void downloadDecisionFile(soQuyetDinh);
    },
    renderStatusTag: (status: string) => {
      const s = getEligibilityStatusMeta(status);
      return <Tag color={s.color}>{s.label}</Tag>;
    },
  };

  return (
    <ConfigProvider
      theme={{
        algorithm: theme === 'dark' ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
      }}
    >
      <div style={{ padding: '24px' }}>
        <PageBreadcrumb
          items={[
            { title: 'Quân nhân', href: `${basePath}/personnel` },
            { title: personnel?.ho_ten, href: `${basePath}/personnel/${personnelId}` },
            { title: awardLabel },
          ]}
        />

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            marginBottom: 24,
            flexWrap: 'wrap',
            gap: 16,
          }}
        >
          <div>
            <Space style={{ marginBottom: 8 }}>
              <Link href={`${basePath}/personnel/${personnelId}?tab=${backTab}`}>
                <Button icon={<LeftOutlined />}>Quay lại</Button>
              </Link>
            </Space>
            <Title level={2} style={{ marginTop: 8, marginBottom: 8 }}>
              {awardLabel}
            </Title>
            {personnel && (
              <Paragraph type="secondary" style={{ fontSize: 14, marginBottom: 0 }}>
                Quân nhân: {personnel.ho_ten}
              </Paragraph>
            )}
          </div>
        </div>

        {loading ? (
          <Card>
            <LoadingState />
          </Card>
        ) : (
          <Card>
            <Table
              columns={buildColumns(helpers)}
              dataSource={rows}
              rowKey="id"
              pagination={false}
              scroll={{ x: 'max-content' }}
              size="small"
              locale={{ emptyText: <Empty description={`Chưa có dữ liệu ${awardLabel}`} /> }}
            />
          </Card>
        )}
      </div>
    </ConfigProvider>
  );
}
