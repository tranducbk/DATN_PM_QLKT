'use client';

import { useMemo } from 'react';
import type { ColumnsType } from 'antd/es/table';
import { apiClient } from '@/lib/api-client';
import ImportReviewPageContent, {
  type PreviewItem,
  type ImportReviewConfig,
  getDanhHieuTag,
  renderText,
  BooleanIcon,
  makeErrorColumn,
} from '@/components/import-review/ImportReviewPageContent';

const DANH_HIEU_COLORS: Record<string, string> = {
  CSTT: 'green',
  CSTDCS: 'blue',
  BKBQP: 'gold',
  CSTDTQ: 'purple',
  BKTTCP: 'red',
};

export default function ImportReviewPage() {
  const validColumns: ColumnsType<PreviewItem> = useMemo(
    () => [
      {
        title: 'STT',
        width: 60,
        align: 'center' as const,
        render: (_: any, __: any, index: number) => index + 1,
      },
      { title: 'Họ tên', dataIndex: 'ho_ten', width: 180, ellipsis: true },
      {
        title: 'Cấp bậc',
        dataIndex: 'cap_bac',
        width: 120,
        ellipsis: true,
      },
      {
        title: 'Chức vụ',
        dataIndex: 'chuc_vu',
        width: 150,
        ellipsis: true,
      },
      {
        title: 'Năm',
        dataIndex: 'nam',
        width: 80,
        align: 'center' as const,
      },
      {
        title: 'Danh hiệu',
        dataIndex: 'danh_hieu',
        width: 200,
        render: (val: string) => getDanhHieuTag(val, DANH_HIEU_COLORS),
      },
      {
        title: 'Số QĐ',
        dataIndex: 'so_quyet_dinh',
        width: 140,
        ellipsis: true,
        render: renderText,
      },
      {
        title: 'Ghi chú',
        dataIndex: 'ghi_chu',
        width: 150,
        ellipsis: true,
        render: renderText,
      },
    ],
    []
  );

  const historyColumns: ColumnsType<Record<string, any>> = useMemo(
    () => [
      {
        title: 'Năm',
        dataIndex: 'nam',
        width: 80,
        align: 'center' as const,
      },
      {
        title: 'Danh hiệu',
        dataIndex: 'danh_hieu',
        width: 200,
        render: (val: string) => getDanhHieuTag(val, DANH_HIEU_COLORS),
      },
      {
        title: 'BKBQP',
        dataIndex: 'nhan_bkbqp',
        width: 80,
        align: 'center' as const,
        render: (val: boolean) => <BooleanIcon value={val} />,
      },
      {
        title: 'CSTDTQ',
        dataIndex: 'nhan_cstdtq',
        width: 80,
        align: 'center' as const,
        render: (val: boolean) => <BooleanIcon value={val} />,
      },
      {
        title: 'BKTTCP',
        dataIndex: 'nhan_bkttcp',
        width: 80,
        align: 'center' as const,
        render: (val: boolean) => <BooleanIcon value={val} />,
      },
      {
        title: 'Số QĐ',
        dataIndex: 'so_quyet_dinh',
        width: 120,
        ellipsis: true,
        render: renderText,
      },
    ],
    []
  );

  const invalidColumns: ColumnsType<PreviewItem> = useMemo(
    () => [
      {
        title: 'STT',
        width: 50,
        align: 'center' as const,
        render: (_: any, __: any, index: number) => index + 1,
      },
      {
        title: 'Dòng',
        dataIndex: 'row',
        width: 60,
        align: 'center' as const,
        render: (val: number) => val ?? '--',
      },
      {
        title: 'Họ tên',
        dataIndex: 'ho_ten',
        width: 150,
        ellipsis: true,
        render: renderText,
      },
      {
        title: 'Năm',
        dataIndex: 'nam',
        width: 60,
        align: 'center' as const,
        render: (val: number) => val ?? '--',
      },
      {
        title: 'Danh hiệu',
        dataIndex: 'danh_hieu',
        width: 130,
        render: (val: string) => (val ? getDanhHieuTag(val, DANH_HIEU_COLORS) : '--'),
      },
      makeErrorColumn(),
    ],
    []
  );

  const config: ImportReviewConfig = {
    sessionStorageKey: 'importPreviewData',
    title: 'Xem trước dữ liệu Import - Khen thưởng cá nhân hằng năm',
    confirmImport: apiClient.confirmAnnualRewardsImport,
    successMessage: count => `Import thành công ${count} bản ghi khen thưởng cá nhân hằng năm.`,
    confirmButtonLabel: 'quân nhân',
    validColumns,
    invalidColumns,
    historyColumns,
  };

  return <ImportReviewPageContent config={config} />;
}
