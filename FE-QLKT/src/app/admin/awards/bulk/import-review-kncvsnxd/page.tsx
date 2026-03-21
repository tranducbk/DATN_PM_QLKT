'use client';

import { useMemo } from 'react';
import type { ColumnsType } from 'antd/es/table';
import { apiClient } from '@/lib/api-client';
import ImportReviewPageContent, {
  type PreviewItem,
  type ImportReviewConfig,
  renderText,
  makeErrorColumn,
} from '@/components/import-review/ImportReviewPageContent';

export default function ImportReviewKNCVSNXDPage() {
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
      makeErrorColumn(),
    ],
    []
  );

  const config: ImportReviewConfig = {
    sessionStorageKey: 'importPreviewDataKNCVSNXD',
    title: 'Xem trước dữ liệu Import - Kỷ niệm chương VSNXD QĐNDVN',
    confirmImport: apiClient.confirmCommemorationMedalsImport,
    successMessage: count => `Import thành công ${count} bản ghi Kỷ niệm chương VSNXD QĐNDVN.`,
    confirmButtonLabel: 'quân nhân',
    validColumns,
    invalidColumns,
    historyColumns,
  };

  return <ImportReviewPageContent config={config} />;
}
