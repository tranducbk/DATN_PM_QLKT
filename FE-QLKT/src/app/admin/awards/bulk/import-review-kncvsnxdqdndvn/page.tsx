'use client';

import { useMemo } from 'react';
import type { ColumnsType } from 'antd/es/table';
import { apiClient } from '@/lib/apiClient';
import {
  ImportReviewPageContent,
  type PreviewItem,
  type ImportReviewConfig,
  makeErrorColumn,
  makeSTTColumn,
  makeRowNumberColumn,
  makeHoTenColumn,
  makeNamColumn,
  makeCapBacColumn,
  makeChucVuColumn,
  makeSoQDColumn,
} from '@/components/import-review/ImportReviewPageContent';

export default function ImportReviewKNCVSNXDQDNDVNPage() {
  const validColumns: ColumnsType<PreviewItem> = useMemo(
    () => [
      makeSTTColumn(),
      makeHoTenColumn(),
      makeCapBacColumn(),
      makeChucVuColumn(),
      makeNamColumn(),
      {
        title: 'Tháng',
        dataIndex: 'thang',
        width: 70,
        align: 'center' as const,
      },
      makeSoQDColumn(),
      {
        title: 'Ghi chú',
        dataIndex: 'ghi_chu',
        width: 200,
        render: (val: string) => val ?? '',
      },
    ],
    []
  );

  const historyColumns: ColumnsType<Record<string, any>> = useMemo(
    () => [makeNamColumn(), makeSoQDColumn(120)],
    []
  );

  const invalidColumns: ColumnsType<PreviewItem> = useMemo(
    () => [
      makeSTTColumn(50),
      makeRowNumberColumn(),
      makeHoTenColumn(150, true),
      makeNamColumn(60, true),
      {
        title: 'Tháng',
        dataIndex: 'thang',
        width: 70,
        align: 'center' as const,
      },
      makeErrorColumn(),
    ],
    []
  );

  const config: ImportReviewConfig = {
    sessionStorageKey: 'importPreviewDataKNCVSNXDQDNDVN',
    title: 'Xem trước dữ liệu tải lên - Kỷ niệm chương vì sự nghiệp xây dựng QĐNDVN',
    confirmImport: apiClient.confirmCommemorationMedalsImport,
    successMessage: count =>
      `Tải dữ liệu thành công ${count} bản ghi Kỷ niệm chương vì sự nghiệp xây dựng QĐNDVN.`,
    confirmButtonLabel: 'quân nhân',
    validColumns,
    invalidColumns,
    historyColumns,
  };

  return <ImportReviewPageContent config={config} />;
}
