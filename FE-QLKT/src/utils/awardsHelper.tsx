import { Typography } from 'antd';
import type { CSSProperties } from 'react';
import { DANH_HIEU_MAP, getLoaiKhenThuongByDanhHieu } from '@/constants/danhHieu.constants';

const { Text } = Typography;

// Re-export DANH_HIEU_MAP for backward compatibility
export { DANH_HIEU_MAP };

export const COLUMN_STYLES: {
  container: CSSProperties;
  item: CSSProperties;
  decisionText: CSSProperties;
  noteText: CSSProperties;
} = {
  container: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' },
  item: { marginBottom: '4px' },
  decisionText: { fontSize: '12px', display: 'block', marginTop: '2px' },
  noteText: { fontSize: '11px', fontStyle: 'italic' },
};

export const renderDecision = (
  soQuyetDinh: string | null | undefined,
  onDownload?: (soQuyetDinh: string) => void
) =>
  soQuyetDinh ? (
    onDownload ? (
      <a
        onClick={e => {
          e.stopPropagation();
          onDownload(soQuyetDinh);
        }}
        style={{ ...COLUMN_STYLES.decisionText, cursor: 'pointer', color: '#52c41a' }}
      >
        Số QĐ: {soQuyetDinh}
      </a>
    ) : (
      <Text type="secondary" style={COLUMN_STYLES.decisionText}>
        Số QĐ: {soQuyetDinh}
      </Text>
    )
  ) : null;

export const renderAwardItem = (
  key: string,
  title: string,
  soQuyetDinh: string | null | undefined,
  isStrong = false,
  onDownload?: (soQuyetDinh: string) => void
) => (
  <div key={key} style={COLUMN_STYLES.item}>
    {isStrong ? <Text strong>{title}</Text> : <Text>{title}</Text>}
    {renderDecision(soQuyetDinh, onDownload)}
  </div>
);

export interface RenderAnnualAwardsOptions {
  onDownload?: (soQuyetDinh: string) => void;
}

export const renderAnnualAwards = (
  text: string | null,
  record: any,
  options?: RenderAnnualAwardsOptions
) => {
  const items = [];
  const onDownload = options?.onDownload;

  if (text) {
    const fullName = DANH_HIEU_MAP[text] || text;
    items.push(renderAwardItem('danh_hieu', fullName, record.so_quyet_dinh, true, onDownload));
  }

  const additionalAwards = [
    {
      key: 'bkbqp',
      flag: record.nhan_bkbqp,
      decision: record.so_quyet_dinh_bkbqp,
      code: 'BKBQP',
    },
    {
      key: 'cstdtq',
      flag: record.nhan_cstdtq,
      decision: record.so_quyet_dinh_cstdtq,
      code: 'CSTDTQ',
    },
    {
      key: 'bkttcp',
      flag: record.nhan_bkttcp,
      decision: record.so_quyet_dinh_bkttcp,
      code: 'BKTTCP',
    },
  ];

  additionalAwards.forEach(({ key, flag, decision, code }) => {
    if (flag && decision) {
      items.push(renderAwardItem(key, DANH_HIEU_MAP[code] || code, decision, false, onDownload));
    }
  });

  if (record.ghi_chu) {
    items.push(
      <Text key="ghi_chu" type="secondary" style={COLUMN_STYLES.noteText}>
        {record.ghi_chu}
      </Text>
    );
  }

  if (items.length === 0) return <Text type="secondary">-</Text>;

  return <div style={COLUMN_STYLES.container}>{items}</div>;
};

// Re-export from constants for backward compatibility
export const getLoaiKhenThuong = (danhHieu: string | null): string => {
  if (!danhHieu) return '-';
  const result = getLoaiKhenThuongByDanhHieu(danhHieu);
  return result === 'Chưa xác định' ? '-' : result;
};
