'use client';

import { useMemo } from 'react';
import { Tag } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { apiClient } from '@/lib/apiClient';
import { DANH_HIEU_SHORT_MAP, DANH_HIEU_COLORS } from '@/constants/danhHieu.constants';
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

function getShortDanhHieuTag(danhHieu: string | undefined) {
  if (!danhHieu) return <Tag>--</Tag>;
  const label = DANH_HIEU_SHORT_MAP[danhHieu] ?? danhHieu;
  const color = DANH_HIEU_COLORS[danhHieu] ?? 'default';
  return <Tag color={color} style={{ whiteSpace: 'nowrap' }}>{label}</Tag>;
}

export default function ImportReviewHCCSVVPage() {
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
        align: 'center',
      },
      {
        title: 'Tổng thời gian',
        dataIndex: 'tong_thoi_gian',
        width: 130,
        align: 'center',
        render: (val: string) => val || '',
      },
      {
        title: 'Danh hiệu',
        dataIndex: 'danh_hieu',
        width: 160,
        render: (val: string) => getShortDanhHieuTag(val),
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
    () => [
      makeNamColumn(),
      {
        title: 'Danh hiệu',
        dataIndex: 'danh_hieu',
        width: 160,
        render: (val: string) => getShortDanhHieuTag(val),
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
        title: 'Tháng',
        dataIndex: 'thang',
        width: 70,
        align: 'center',
      },
      {
        title: 'Danh hiệu',
        dataIndex: 'danh_hieu',
        width: 160,
        render: (val: string) => (val ? getShortDanhHieuTag(val) : ''),
      },
      makeErrorColumn(),
    ],
    []
  );

  const config: ImportReviewConfig = {
    sessionStorageKey: 'importPreviewDataHCCSVV',
    title: 'Xem trước dữ liệu tải lên - Khen thưởng HCCSVV',
    confirmImport: apiClient.confirmHCCSVVImport,
    successMessage: count => `Tải dữ liệu thành công ${count} bản ghi khen thưởng HCCSVV.`,
    confirmButtonLabel: 'quân nhân',
    validColumns,
    invalidColumns,
    historyColumns,
  };

  return <ImportReviewPageContent config={config} />;
}
