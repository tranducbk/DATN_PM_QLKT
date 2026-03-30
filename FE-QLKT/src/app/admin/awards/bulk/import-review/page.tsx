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
  BooleanIcon,
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

export default function ImportReviewPage() {
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
        width: 180,
        ellipsis: true,
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
