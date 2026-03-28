'use client';

import { useMemo } from 'react';
import type { ColumnsType } from 'antd/es/table';
import { apiClient } from '@/lib/apiClient';
import ImportReviewPageContent, {
  type PreviewItem,
  type ImportReviewConfig,
  getDanhHieuTag,
  renderText,
  makeErrorColumn,
} from '@/components/import-review/ImportReviewPageContent';

const DANH_HIEU_COLORS: Record<string, string> = {
  HCBVTQ_HANG_BA: 'green',
  HCBVTQ_HANG_NHI: 'blue',
  HCBVTQ_HANG_NHAT: 'gold',
};

export default function ImportReviewHCBVTQPage() {
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
    sessionStorageKey: 'importPreviewDataHCBVTQ',
    title: 'Xem trước dữ liệu Import - Huân chương Bảo vệ Tổ quốc',
    confirmImport: apiClient.confirmContributionAwardsImport,
    successMessage: count => `Import thành công ${count} bản ghi Huân chương Bảo vệ Tổ quốc.`,
    confirmButtonLabel: 'quân nhân',
    validColumns,
    invalidColumns,
    historyColumns,
  };

  return <ImportReviewPageContent config={config} />;
}
