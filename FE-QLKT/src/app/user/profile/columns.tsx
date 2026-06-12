import { Tag } from 'antd';
import { calculateDuration, formatDate, formatHeSoChucVu } from '@/lib/utils';
import { THANH_TICH_KHOA_HOC_FULL_LABELS } from '@/constants/danhHieu.constants';
import type { ScientificAchievementRow, PositionHistoryRow, AdhocAwardRow } from './types';

function renderDecisionLink(
  text: string,
  onOpen: (so: string) => void,
  options: { bold?: boolean } = {}
) {
  if (!text || text.trim() === '') return '-';
  return (
    <a
      onClick={e => {
        e.preventDefault();
        e.stopPropagation();
        onOpen(text);
      }}
      className={`text-green-600 dark:text-green-400 cursor-pointer underline${
        options.bold ? ' font-medium' : ''
      }`}
    >
      {text}
    </a>
  );
}

export function makeScientificColumns(onOpenDecision: (so: string) => void) {
  return [
    {
      title: 'STT',
      key: 'index',
      width: 80,
      align: 'center' as const,
      render: (_: unknown, __: unknown, index: number) => index + 1,
    },
    {
      title: 'Năm',
      dataIndex: 'nam',
      key: 'nam',
      width: 100,
      align: 'center' as const,
      sorter: (a: ScientificAchievementRow, b: ScientificAchievementRow) => a.nam - b.nam,
    },
    {
      title: 'Loại',
      dataIndex: 'loai',
      key: 'loai',
      width: 170,
      align: 'left' as const,
      render: (text: string) => {
        if (!text) return '-';
        const label = THANH_TICH_KHOA_HOC_FULL_LABELS[text] || text;
        const isSangKien = text === 'SKKH' || text === 'Sáng kiến khoa học';
        return <Tag color={isSangKien ? 'purple' : 'geekblue'}>{label}</Tag>;
      },
    },
    {
      title: 'Mô tả',
      dataIndex: 'mo_ta',
      key: 'mo_ta',
      minWidth: 200,
      align: 'left' as const,
      ellipsis: { showTitle: false },
      render: (text: string) => (
        <span title={text} style={{ display: 'block', maxWidth: '100%' }}>
          {text || '-'}
        </span>
      ),
    },
    {
      title: 'Số quyết định',
      dataIndex: 'so_quyet_dinh',
      key: 'so_quyet_dinh',
      width: 150,
      align: 'center' as const,
      render: (text: string) => renderDecisionLink(text, onOpenDecision),
    },
  ];
}

export function makePositionHistoryColumns() {
  return [
    {
      title: 'STT',
      key: 'index',
      width: 80,
      align: 'center' as const,
      fixed: 'left' as const,
      render: (_: unknown, __: unknown, index: number) => index + 1,
    },
    {
      title: 'Chức vụ',
      dataIndex: 'ChucVu',
      key: 'ChucVu',
      width: 200,
      align: 'left' as const,
      render: (chucVu: PositionHistoryRow['ChucVu']) => chucVu?.ten_chuc_vu || 'N/A',
    },
    {
      title: 'Hệ số chức vụ',
      dataIndex: 'ChucVu',
      key: 'he_so_chuc_vu',
      width: 130,
      align: 'center' as const,
      render: (chucVu: PositionHistoryRow['ChucVu']) =>
        formatHeSoChucVu(chucVu?.he_so_chuc_vu, 'N/A'),
    },
    {
      title: 'Ngày bắt đầu',
      dataIndex: 'ngay_bat_dau',
      key: 'ngay_bat_dau',
      width: 130,
      align: 'center' as const,
      render: (date: string) => (date ? formatDate(date) : 'N/A'),
    },
    {
      title: 'Ngày kết thúc',
      dataIndex: 'ngay_ket_thuc',
      key: 'ngay_ket_thuc',
      width: 130,
      align: 'center' as const,
      render: (date: string) => (date ? formatDate(date) : 'Hiện tại'),
    },
    {
      title: 'Thời gian',
      key: 'duration',
      width: 120,
      align: 'center' as const,
      render: (_: unknown, record: PositionHistoryRow) => {
        if (!record.ngay_bat_dau) return '-';
        return calculateDuration(record.ngay_bat_dau, record.ngay_ket_thuc ?? undefined);
      },
    },
  ];
}

export function makeAdhocColumns(onOpenDecision: (so: string) => void) {
  return [
    {
      title: 'STT',
      key: 'index',
      width: 80,
      align: 'center' as const,
      fixed: 'left' as const,
      render: (_: unknown, __: unknown, index: number) => index + 1,
    },
    {
      title: 'Hình thức khen thưởng',
      dataIndex: 'hinh_thuc_khen_thuong',
      key: 'hinh_thuc_khen_thuong',
      width: 200,
      align: 'left' as const,
      ellipsis: { showTitle: false },
      render: (text: string) => (
        <span title={text} style={{ display: 'block', maxWidth: '100%' }}>
          {text || '-'}
        </span>
      ),
    },
    {
      title: 'Năm',
      dataIndex: 'nam',
      key: 'nam',
      width: 100,
      align: 'center' as const,
      sorter: (a: AdhocAwardRow, b: AdhocAwardRow) => a.nam - b.nam,
    },
    {
      title: 'Cấp bậc',
      dataIndex: 'cap_bac',
      key: 'cap_bac',
      width: 120,
      align: 'center' as const,
      render: (text: string) => text || '-',
    },
    {
      title: 'Chức vụ',
      dataIndex: 'chuc_vu',
      key: 'chuc_vu',
      width: 150,
      align: 'left' as const,
      ellipsis: { showTitle: false },
      render: (text: string) => (
        <span title={text} style={{ display: 'block', maxWidth: '100%' }}>
          {text || '-'}
        </span>
      ),
    },
    {
      title: 'Số quyết định',
      dataIndex: 'so_quyet_dinh',
      key: 'so_quyet_dinh',
      width: 180,
      align: 'center' as const,
      render: (text: string) => renderDecisionLink(text, onOpenDecision, { bold: true }),
    },
  ];
}
