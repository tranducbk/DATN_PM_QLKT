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
  renderText,
  BooleanIcon,
  makeErrorColumn,
  makeSTTColumn,
  makeRowNumberColumn,
  makeNamColumn,
  makeSoQDColumn,
  makeGhiChuColumn,
} from '@/components/import-review/ImportReviewPageContent';

export default function ImportReviewUnitPage() {
  const validColumns: ColumnsType<PreviewItem> = useMemo(
    () => [
      makeSTTColumn(),
      {
        title: 'Mã đơn vị',
        dataIndex: 'ma_don_vi',
        width: 120,
        ellipsis: true,
        render: renderText,
      },
      {
        title: 'Tên đơn vị',
        dataIndex: 'ten_don_vi',
        render: renderText,
      },
      makeNamColumn(),
      {
        title: 'Danh hiệu',
        dataIndex: 'danh_hieu',
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
      {
        title: 'Tên đơn vị',
        dataIndex: 'ten_don_vi',
        render: renderText,
      },
      makeNamColumn(60, true),
      {
        title: 'Danh hiệu',
        dataIndex: 'danh_hieu',
        render: (val: string) => (val ? getDanhHieuTag(val, DANH_HIEU_COLORS) : '--'),
      },
      makeErrorColumn(),
    ],
    []
  );

  const config: ImportReviewConfig = {
    sessionStorageKey: 'importPreviewDataDVHN',
    title: 'Xem trước dữ liệu tải lên - Khen thưởng đơn vị hằng năm',
    confirmImport: apiClient.confirmUnitAnnualAwardsImport,
    successMessage: count => `Nhập dữ liệu thành công ${count} bản ghi khen thưởng đơn vị hằng năm.`,
    confirmButtonLabel: 'đơn vị',
    validColumns,
    invalidColumns,
    historyColumns,
    breadcrumbLastItem: 'Xem trước dữ liệu tải lên đơn vị',
    historyLabel: 'Lịch sử khen thưởng đơn vị',
  };

  return <ImportReviewPageContent config={config} />;
}
