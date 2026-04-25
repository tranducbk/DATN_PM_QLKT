'use client';

import { useMemo } from 'react';
import { Tag } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { apiClient } from '@/lib/apiClient';
import { DANH_HIEU_COLORS, THANH_TICH_KHOA_HOC_FULL_LABELS } from '@/constants/danhHieu.constants';
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
  makeCapBacChucVuColumn,
  makeSoQDColumn,
  makeGhiChuColumn,
} from '@/components/import-review/ImportReviewPageContent';

function getLoaiTag(loai: string | undefined) {
  if (!loai) return <Tag>--</Tag>;
  const color = DANH_HIEU_COLORS[loai] ?? 'default';
  const label = THANH_TICH_KHOA_HOC_FULL_LABELS[loai] ?? loai;
  return <Tag color={color} style={{ whiteSpace: 'nowrap' }}>{label}</Tag>;
}

export default function ImportReviewNCKHPage() {
  const validColumns: ColumnsType<PreviewItem> = useMemo(
    () => [
      makeSTTColumn(),
      makeHoTenColumn(),
      makeCapBacChucVuColumn(),
      makeNamColumn(),
      {
        title: 'Loại',
        dataIndex: 'loai',
        width: 170,
        render: (val: string) => getLoaiTag(val),
      },
      {
        title: 'Mô tả',
        dataIndex: 'mo_ta',
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
        width: 170,
        render: (val: string) => getLoaiTag(val),
      },
      {
        title: 'Mô tả',
        dataIndex: 'mo_ta',
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
        width: 170,
        render: (val: string) => (val ? getLoaiTag(val) : '--'),
      },
      makeErrorColumn(),
    ],
    []
  );

  const config: ImportReviewConfig = {
    sessionStorageKey: 'importPreviewDataNCKH',
    title: 'Xem trước dữ liệu tải lên - Thành tích Nghiên cứu khoa học',
    confirmImport: apiClient.confirmScientificAchievementsImport,
    successMessage: count => `Nhập dữ liệu thành công ${count} bản ghi thành tích Nghiên cứu khoa học.`,
    confirmButtonLabel: 'quân nhân',
    validColumns,
    invalidColumns,
    historyColumns,
    historyLabel: 'Lịch sử thành tích Nghiên cứu khoa học',
    noHistoryLabel: 'Chưa có lịch sử thành tích Nghiên cứu khoa học.',
  };

  return <ImportReviewPageContent config={config} />;
}
