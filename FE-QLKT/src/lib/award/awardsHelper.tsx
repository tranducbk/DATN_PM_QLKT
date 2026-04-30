import { Button, Popconfirm, Typography } from 'antd';
import { DeleteOutlined } from '@ant-design/icons';
import type { CSSProperties } from 'react';
import {
  DANH_HIEU_CA_NHAN_HANG_NAM,
  DANH_HIEU_MAP,
  getLoaiKhenThuongByDanhHieu,
} from '@/constants/danhHieu.constants';
import type { AnnualRewardRecord, UnitAnnualRewardRecord } from '@/lib/types/award';

const { Text } = Typography;

// Re-export DANH_HIEU_MAP for backward compatibility
export { DANH_HIEU_MAP };

export const COLUMN_STYLES: {
  container: CSSProperties;
  item: CSSProperties;
  decisionText: CSSProperties;
  noteText: CSSProperties;
} = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '4px',
    whiteSpace: 'normal',
    wordBreak: 'break-word',
    overflowWrap: 'anywhere',
  },
  item: {
    marginBottom: '4px',
    whiteSpace: 'normal',
    wordBreak: 'break-word',
    overflowWrap: 'anywhere',
  },
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
        style={COLUMN_STYLES.decisionText}
        className="cursor-pointer text-green-600 dark:text-green-400"
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
  note?: string | null,
  isStrong = false,
  onDownload?: (soQuyetDinh: string) => void
) => (
  <div key={key} style={COLUMN_STYLES.item}>
    <div style={{ textAlign: 'center' }}>
      {isStrong ? <Text strong>{title}</Text> : <Text>{title}</Text>}
    </div>
    {renderDecision(soQuyetDinh, onDownload)}
    {note ? (
      <Text type="secondary" style={COLUMN_STYLES.noteText}>
        {note}
      </Text>
    ) : null}
  </div>
);

export interface AwardEntry {
  code: string;
  label: string;
  shortLabel: string;
}

/**
 * Collects active awards from a CA_NHAN_HANG_NAM record (danh_hieu base + chain flags).
 * Highest-tier chain awards come first so the most prestigious title is rendered on top.
 * @param record - DanhHieuHangNam-like row
 * @returns Awards present, ordered BKTTCP → CSTDTQ → BKBQP → base (CSTDCS/CSTT)
 */
export const collectPersonalAwards = (record: {
  danh_hieu?: string | null;
  nhan_bkbqp?: boolean;
  nhan_cstdtq?: boolean;
  nhan_bkttcp?: boolean;
}): AwardEntry[] => {
  const list: AwardEntry[] = [];
  if (record.nhan_bkttcp) {
    list.push({
      code: DANH_HIEU_CA_NHAN_HANG_NAM.BKTTCP,
      label: DANH_HIEU_MAP.BKTTCP,
      shortLabel: DANH_HIEU_CA_NHAN_HANG_NAM.BKTTCP,
    });
  }
  if (record.nhan_cstdtq) {
    list.push({
      code: DANH_HIEU_CA_NHAN_HANG_NAM.CSTDTQ,
      label: DANH_HIEU_MAP.CSTDTQ,
      shortLabel: DANH_HIEU_CA_NHAN_HANG_NAM.CSTDTQ,
    });
  }
  if (record.nhan_bkbqp) {
    list.push({
      code: DANH_HIEU_CA_NHAN_HANG_NAM.BKBQP,
      label: DANH_HIEU_MAP.BKBQP,
      shortLabel: DANH_HIEU_CA_NHAN_HANG_NAM.BKBQP,
    });
  }
  if (record.danh_hieu) {
    list.push({
      code: record.danh_hieu,
      label: DANH_HIEU_MAP[record.danh_hieu] || record.danh_hieu,
      shortLabel: record.danh_hieu,
    });
  }
  return list;
};

/** Unit variant — order BKTTCP → BKBQP → base (ĐVQT/ĐVTT). */
export const collectUnitAwards = (record: {
  danh_hieu?: string | null;
  nhan_bkbqp?: boolean;
  nhan_bkttcp?: boolean;
}): AwardEntry[] => {
  const list: AwardEntry[] = [];
  if (record.nhan_bkttcp) {
    list.push({
      code: DANH_HIEU_CA_NHAN_HANG_NAM.BKTTCP,
      label: DANH_HIEU_MAP.BKTTCP,
      shortLabel: DANH_HIEU_CA_NHAN_HANG_NAM.BKTTCP,
    });
  }
  if (record.nhan_bkbqp) {
    list.push({
      code: DANH_HIEU_CA_NHAN_HANG_NAM.BKBQP,
      label: DANH_HIEU_MAP.BKBQP,
      shortLabel: DANH_HIEU_CA_NHAN_HANG_NAM.BKBQP,
    });
  }
  if (record.danh_hieu) {
    list.push({
      code: record.danh_hieu,
      label: DANH_HIEU_MAP[record.danh_hieu] || record.danh_hieu,
      shortLabel: record.danh_hieu,
    });
  }
  return list;
};

/**
 * Renders a vertical stack of per-award delete buttons for the action column.
 * @param awards - Awards present in the row
 * @param onDelete - Callback invoked on confirmed delete
 */
export const renderAwardDeleteButtons = (
  awards: AwardEntry[],
  onDelete: (awardCode: string, awardLabel: string) => void
) => {
  if (awards.length === 0) return <Text type="secondary">-</Text>;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {awards.map(award => (
        <Popconfirm
          key={award.code}
          title={`Xóa ${award.label}`}
          description={
            <span>
              Bạn có chắc chắn muốn xóa <b>{award.label}</b>? Số quyết định và ghi chú liên
              quan cũng sẽ bị xóa.
            </span>
          }
          onConfirm={e => {
            e?.stopPropagation();
            onDelete(award.code, award.label);
          }}
          onCancel={e => e?.stopPropagation()}
          okText="Xóa"
          cancelText="Hủy"
          okButtonProps={{ danger: true }}
        >
          <Button
            type="text"
            danger
            size="small"
            icon={<DeleteOutlined />}
            onClick={e => e.stopPropagation()}
          >
            {award.shortLabel}
          </Button>
        </Popconfirm>
      ))}
    </div>
  );
};

export interface RenderAnnualAwardsOptions {
  onDownload?: (soQuyetDinh: string) => void;
}

export const renderAnnualAwards = (
  text: string | null,
  record: Partial<AnnualRewardRecord>,
  options?: RenderAnnualAwardsOptions
) => {
  const items = [];
  const onDownload = options?.onDownload;
  const recordNotes = {
    main: record.ghi_chu,
    bkbqp: record.ghi_chu_bkbqp,
    cstdtq: record.ghi_chu_cstdtq,
    bkttcp: record.ghi_chu_bkttcp,
  };

  // Render chain awards top-down by prestige: BKTTCP → CSTDTQ → BKBQP → base (CSTDCS/CSTT).
  const chainAwards = [
    { key: 'bkttcp', flag: record.nhan_bkttcp, decision: record.so_quyet_dinh_bkttcp, code: DANH_HIEU_CA_NHAN_HANG_NAM.BKTTCP, note: recordNotes.bkttcp },
    { key: 'cstdtq', flag: record.nhan_cstdtq, decision: record.so_quyet_dinh_cstdtq, code: DANH_HIEU_CA_NHAN_HANG_NAM.CSTDTQ, note: recordNotes.cstdtq },
    { key: 'bkbqp', flag: record.nhan_bkbqp, decision: record.so_quyet_dinh_bkbqp, code: DANH_HIEU_CA_NHAN_HANG_NAM.BKBQP, note: recordNotes.bkbqp },
  ];

  chainAwards.forEach(({ key, flag, decision, code, note }) => {
    if (flag) {
      const label = DANH_HIEU_MAP[code] || code;
      items.push(renderAwardItem(key, label, decision, note, true, onDownload));
    }
  });

  if (text) {
    const fullName = DANH_HIEU_MAP[text] || text;
    items.push(
      renderAwardItem('danh_hieu', fullName, record.so_quyet_dinh, recordNotes.main, true, onDownload)
    );
  }

  if (recordNotes.main && !text) {
    items.push(
      <Text key="ghi_chu" type="secondary" style={COLUMN_STYLES.noteText}>
        {recordNotes.main}
      </Text>
    );
  }

  if (items.length === 0) return <Text type="secondary">-</Text>;

  return <div style={COLUMN_STYLES.container}>{items}</div>;
};

export const renderUnitAnnualAwards = (
  text: string | null,
  record: Partial<UnitAnnualRewardRecord>,
  options?: RenderAnnualAwardsOptions
) => {
  const items = [];
  const onDownload = options?.onDownload;
  const recordNotes = {
    main: record.ghi_chu,
    bkbqp: record.ghi_chu_bkbqp,
    bkttcp: record.ghi_chu_bkttcp,
  };

  // Unit chain order top-down: BKTTCP → BKBQP → base (ĐVQT/ĐVTT).
  const chainAwards = [
    { key: 'bkttcp', flag: record.nhan_bkttcp, decision: record.so_quyet_dinh_bkttcp, code: DANH_HIEU_CA_NHAN_HANG_NAM.BKTTCP, note: recordNotes.bkttcp },
    { key: 'bkbqp', flag: record.nhan_bkbqp, decision: record.so_quyet_dinh_bkbqp, code: DANH_HIEU_CA_NHAN_HANG_NAM.BKBQP, note: recordNotes.bkbqp },
  ];

  chainAwards.forEach(({ key, flag, decision, code, note }) => {
    if (flag) {
      const label = DANH_HIEU_MAP[code] || code;
      items.push(renderAwardItem(key, label, decision, note, true, onDownload));
    }
  });

  if (text) {
    const fullName = DANH_HIEU_MAP[text] || text;
    items.push(
      renderAwardItem('danh_hieu', fullName, record.so_quyet_dinh, recordNotes.main, true, onDownload)
    );
  }

  if (recordNotes.main && !text) {
    items.push(
      <Text key="ghi_chu" type="secondary" style={COLUMN_STYLES.noteText}>
        {recordNotes.main}
      </Text>
    );
  }

  if (items.length === 0) return <Text type="secondary">-</Text>;

  return <div style={COLUMN_STYLES.container}>{items}</div>;
};

export const getLoaiKhenThuong = (danhHieu: string | null): string => {
  if (!danhHieu) return '-';
  return getLoaiKhenThuongByDanhHieu(danhHieu);
};
