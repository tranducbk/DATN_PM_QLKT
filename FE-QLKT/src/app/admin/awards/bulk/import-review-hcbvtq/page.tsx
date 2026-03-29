'use client';

import { useMemo } from 'react';
import type { ColumnsType } from 'antd/es/table';
import { apiClient } from '@/lib/apiClient';
import { DANH_HIEU_COLORS } from '@/constants/danhHieu.constants';
import {
  ImportReviewPageContent,
  type PreviewItem,
  type ImportReviewConfig,
  getDanhHieuTag,
  makeErrorColumn,
  makeSTTColumn,
  makeRowNumberColumn,
  makeHoTenColumn,
  makeNamColumn,
  makeCapBacColumn,
  makeChucVuColumn,
  makeSoQDColumn,
  makeGhiChuColumn,
} from '@/components/import-review/ImportReviewPageContent';

export default function ImportReviewHCBVTQPage() {
  const validColumns: ColumnsType<PreviewItem> = useMemo(
    () => [
      makeSTTColumn(),
      makeHoTenColumn(),
      makeCapBacColumn(),
      makeChucVuColumn(),
      makeNamColumn(),
      {
        title: 'Danh hiệu',
        dataIndex: 'danh_hieu',
        width: 200,
        render: (val: string) => getDanhHieuTag(val, DANH_HIEU_COLORS),
      },
      makeSoQDColumn(),
      makeGhiChuColumn(),
    ],
    []
  );

  const historyColumns: ColumnsType<Record<string, any>> = useMemo(
    () => [
      makeNamColumn(),
      {
        title: 'Danh hiệu',
        dataIndex: 'danh_hieu',
        width: 200,
        render: (val: string) => getDanhHieuTag(val, DANH_HIEU_COLORS),
      },
      makeSoQDColumn(120),
    ],
    []
  );

  const invalidColumns: ColumnsType<PreviewItem> = useMemo(
    () => [
      makeSTTColumn(50),
      makeRowNumberColumn(),
      makeHoTenColumn(150, true),
      makeNamColumn(60, true),
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
