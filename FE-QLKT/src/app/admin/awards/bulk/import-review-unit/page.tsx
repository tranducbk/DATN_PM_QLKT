'use client';

import { useMemo } from 'react';
import { Tag } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { apiClient } from '@/lib/apiClient';
import ImportReviewPageContent, {
  type PreviewItem,
  type ImportReviewConfig,
  renderText,
  BooleanIcon,
  makeErrorColumn,
} from '@/components/import-review/ImportReviewPageContent';

function getDanhHieuTagUnit(danhHieu: string | undefined) {
  if (!danhHieu) return <Tag>--</Tag>;
  if (danhHieu === 'ĐVQT') return <Tag color="green">Đơn vị Quyết thắng</Tag>;
  if (danhHieu === 'ĐVTT') return <Tag color="blue">Đơn vị Tiên tiến</Tag>;
  return <Tag>{danhHieu}</Tag>;
}

export default function ImportReviewUnitPage() {
  const validColumns: ColumnsType<PreviewItem> = useMemo(
    () => [
      {
        title: 'STT',
        width: 60,
        align: 'center' as const,
        render: (_: any, __: any, index: number) => index + 1,
      },
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
        width: 220,
        ellipsis: true,
        render: renderText,
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
        render: (val: string) => getDanhHieuTagUnit(val),
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
        render: (val: string) => getDanhHieuTagUnit(val),
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
        title: 'Tên đơn vị',
        dataIndex: 'ten_don_vi',
        width: 180,
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
        render: (val: string) => (val ? getDanhHieuTagUnit(val) : '--'),
      },
      makeErrorColumn(),
    ],
    []
  );

  const config: ImportReviewConfig = {
    sessionStorageKey: 'importPreviewDataUnit',
    title: 'Xem trước dữ liệu Import - Khen thưởng đơn vị hằng năm',
    confirmImport: apiClient.confirmUnitAnnualAwardsImport,
    successMessage: count => `Import thành công ${count} bản ghi khen thưởng đơn vị hằng năm.`,
    confirmButtonLabel: 'đơn vị',
    validColumns,
    invalidColumns,
    historyColumns,
    breadcrumbLastItem: 'Xem trước Import đơn vị',
    historyLabel: 'Lịch sử khen thưởng đơn vị',
  };

  return <ImportReviewPageContent config={config} />;
}
