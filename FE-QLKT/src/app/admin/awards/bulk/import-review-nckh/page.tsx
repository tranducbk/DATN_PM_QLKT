'use client';

import { useMemo } from 'react';
import { Tag } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { apiClient } from '@/lib/api-client';
import ImportReviewPageContent, {
  type PreviewItem,
  type ImportReviewConfig,
  renderText,
  makeErrorColumn,
} from '@/components/import-review/ImportReviewPageContent';

function getLoaiTag(loai: string | undefined) {
  if (!loai) return <Tag>--</Tag>;
  let color = 'default';
  if (loai === 'DTKH') color = 'blue';
  else if (loai === 'SKKH') color = 'green';
  const labelMap: Record<string, string> = {
    DTKH: 'DTKH',
    SKKH: 'SKKH',
  };
  return <Tag color={color}>{labelMap[loai] ?? loai}</Tag>;
}

export default function ImportReviewNCKHPage() {
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
    title: 'Xem trước dữ liệu Import - Thành tích Nghiên cứu khoa học',
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
