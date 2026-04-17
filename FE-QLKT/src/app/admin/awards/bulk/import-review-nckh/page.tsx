'use client';

import { useMemo } from 'react';
import { Tag } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { apiClient } from '@/lib/apiClient';
import { DANH_HIEU_COLORS, THANH_TICH_KHOA_HOC_SHORT_LABELS } from '@/constants/danhHieu.constants';
import {
  ImportReviewPageContent,
  type PreviewItem,
  type ImportReviewConfig,
  renderText,
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

function getLoaiTag(loai: string | undefined) {
  if (!loai) return <Tag>--</Tag>;
  const color = DANH_HIEU_COLORS[loai] ?? 'default';
  const label = THANH_TICH_KHOA_HOC_SHORT_LABELS[loai] ?? loai;
  return <Tag color={color}>{label}</Tag>;
}

export default function ImportReviewNCKHPage() {
  const validColumns: ColumnsType<PreviewItem> = useMemo(
    () => [
      makeSTTColumn(),
      makeHoTenColumn(),
      makeCapBacColumn(),
      makeChucVuColumn(),
      makeNamColumn(),
      {
        title: 'Loại',
        dataIndex: 'loai',
        width: 100,
        render: (val: string) => getLoaiTag(val),
      },
      {
        title: 'Mô tả',
        dataIndex: 'mo_ta',
        width: 200,
        ellipsis: true,
        render: renderText,
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
        title: 'Loại',
        dataIndex: 'loai',
        width: 100,
        render: (val: string) => getLoaiTag(val),
      },
      {
        title: 'Mô tả',
        dataIndex: 'mo_ta',
        width: 200,
        ellipsis: true,
        render: renderText,
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
        title: 'Loại',
        dataIndex: 'loai',
        width: 100,
        render: (val: string) => (val ? getLoaiTag(val) : '--'),
      },
      makeErrorColumn(),
    ],
    []
  );

  const config: ImportReviewConfig = {
    sessionStorageKey: 'importPreviewDataNCKH',
    title: 'Xem trước dữ liệu Import - Thành tích NCKH',
    confirmImport: apiClient.confirmScientificAchievementsImport,
    successMessage: count => `Import thành công ${count} bản ghi thành tích NCKH.`,
    confirmButtonLabel: 'quân nhân',
    validColumns,
    invalidColumns,
    historyColumns,
    historyLabel: 'Lịch sử thành tích NCKH',
    noHistoryLabel: 'Chưa có lịch sử thành tích NCKH.',
  };

  return <ImportReviewPageContent config={config} />;
}
