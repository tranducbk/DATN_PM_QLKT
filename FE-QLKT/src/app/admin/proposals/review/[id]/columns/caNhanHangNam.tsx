import { Button, DatePicker, Popconfirm, Tooltip, Typography } from 'antd';
import { CloseOutlined, HistoryOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import {
  CONTRIBUTION_COEFFICIENT_GROUPS,
  type ContributionCoefficientGroup,
  getDanhHieuName,
} from '@/constants/danhHieu.constants';
import { PROPOSAL_STATUS, PROPOSAL_TYPES } from '@/constants/proposal.constants';
import { renderServiceTime, type ServiceTimeRow } from '@/lib/award/serviceTimeHelpers';
import { formatUnitInfo, getDurationDisplay } from '../helpers';
import type { DanhHieuItem, ProposalDetail } from '../types';

const { Text } = Typography;

interface CaNhanHangNamColumnsDeps {
  proposal: ProposalDetail;
  personnelDetails: Record<string, ServiceTimeRow>;
  totalTimeByGroup: (personnelId: string, group: ContributionCoefficientGroup) => string;
  updateNienHan: (index: number, fields: Partial<DanhHieuItem>) => void;
  handleOpenDecisionFile: (soQuyetDinh: string) => void;
  handleClearDecision: (index: number) => void;
  handleViewPersonnelHistory: (record: DanhHieuItem) => void;
}

/**
 * Builds the personal annual-award review columns (also reused, filtered, for the
 * contribution-medal review table).
 * @param deps - Proposal context, service-time data, and row action handlers
 * @returns Ant Design columns for the personal annual review table
 */
export function buildCaNhanHangNamColumns(
  deps: CaNhanHangNamColumnsDeps
): ColumnsType<DanhHieuItem> {
  const {
    proposal,
    personnelDetails,
    totalTimeByGroup,
    updateNienHan,
    handleOpenDecisionFile,
    handleClearDecision,
    handleViewPersonnelHistory,
  } = deps;

  return [
    {
      title: 'STT',
      key: 'stt',
      width: 60,
      align: 'center' as const,
      render: (_: unknown, __: unknown, index: number) => index + 1,
    },
    {
      title: 'Họ tên',
      dataIndex: 'ho_ten',
      key: 'ho_ten',
      width: 250,
      align: 'center' as const,
      render: (text: string, record: DanhHieuItem) => {
        const unitInfo = formatUnitInfo(record);

        return (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <Text strong>{text}</Text>
            {unitInfo && (
              <Text type="secondary" style={{ fontSize: '12px', marginTop: '4px' }}>
                {unitInfo}
              </Text>
            )}
          </div>
        );
      },
    },
    {
      title: 'Cấp bậc / Chức vụ',
      key: 'cap_bac_chuc_vu',
      width: 180,
      align: 'center' as const,
      render: (_: unknown, record: DanhHieuItem) => {
        const capBac = record.cap_bac;
        const chucVu = record.chuc_vu;

        if (!capBac && !chucVu) {
          return <span>-</span>;
        }

        return (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            {capBac && <Text strong>{capBac}</Text>}
            {chucVu && (
              <Text type="secondary" style={{ fontSize: '12px', marginTop: capBac ? '4px' : '0' }}>
                {chucVu}
              </Text>
            )}
          </div>
        );
      },
    },
    ...((
      [
        PROPOSAL_TYPES.NIEN_HAN,
        PROPOSAL_TYPES.HC_QKQT,
        PROPOSAL_TYPES.KNC_VSNXD_QDNDVN,
        PROPOSAL_TYPES.CONG_HIEN,
      ] as string[]
    ).includes(proposal?.loai_de_xuat)
      ? [
          {
            title: 'Tháng',
            dataIndex: 'thang',
            key: 'thang',
            width: 70,
            align: 'center' as const,
            render: (val: number | null | undefined) => val ?? proposal?.thang ?? '—',
          },
        ]
      : []),
    {
      title: 'Năm',
      dataIndex: 'nam',
      key: 'nam',
      width: 80,
      align: 'center' as const,
      render: (_: unknown, record: DanhHieuItem) => <Text>{record.nam}</Text>,
    },
    ...((
      [PROPOSAL_TYPES.NIEN_HAN, PROPOSAL_TYPES.HC_QKQT, PROPOSAL_TYPES.KNC_VSNXD_QDNDVN] as string[]
    ).includes(proposal?.loai_de_xuat)
      ? [
          {
            title: 'Tổng thời gian',
            key: 'tong_thoi_gian',
            width: 150,
            align: 'center' as const,
            render: (_: unknown, record: DanhHieuItem) => {
              const person = personnelDetails[record.personnel_id ?? ''];
              if (!person) return '';
              if (!record.thang) return <Text type="secondary">—</Text>;
              return renderServiceTime(person, record.nam, record.thang);
            },
          },
        ]
      : []),
    {
      title: 'Danh hiệu',
      dataIndex: 'danh_hieu',
      key: 'danh_hieu',
      width: 250,
      align: 'center' as const,
      render: (_: unknown, record: DanhHieuItem, index: number) => {
        const fullName = getDanhHieuName(record.danh_hieu || '');
        return (
          <div style={{ textAlign: 'center' }}>
            <Text>{fullName}</Text>
          </div>
        );
      },
    },
    ...(proposal?.loai_de_xuat === PROPOSAL_TYPES.CONG_HIEN
      ? [
          {
            title: 'Tổng thời gian (0.7)',
            key: 'total_time_0_7',
            width: 150,
            align: 'center' as const,
            render: (_: unknown, record: DanhHieuItem) => {
              const display = getDurationDisplay(record.thoi_gian_nhom_0_7);
              return display
                ? display
                : totalTimeByGroup(record.personnel_id ?? '', CONTRIBUTION_COEFFICIENT_GROUPS.LEVEL_07);
            },
          },
          {
            title: 'Tổng thời gian (0.8)',
            key: 'total_time_0_8',
            width: 150,
            align: 'center' as const,
            render: (_: unknown, record: DanhHieuItem) => {
              const display = getDurationDisplay(record.thoi_gian_nhom_0_8);
              return display
                ? display
                : totalTimeByGroup(record.personnel_id ?? '', CONTRIBUTION_COEFFICIENT_GROUPS.LEVEL_08);
            },
          },
          {
            title: 'Tổng thời gian (0.9-1.0)',
            key: 'total_time_0_9_1_0',
            width: 150,
            align: 'center' as const,
            render: (_: unknown, record: DanhHieuItem) => {
              const display = getDurationDisplay(record.thoi_gian_nhom_0_9_1_0);
              return display
                ? display
                : totalTimeByGroup(record.personnel_id ?? '', CONTRIBUTION_COEFFICIENT_GROUPS.LEVEL_09_10);
            },
          },
        ]
      : []),
    {
      title: 'Tháng nhận',
      key: 'thang_nhan_nien_han',
      width: 160,
      align: 'center' as const,
      render: (_: unknown, record: DanhHieuItem, index: number) => {
        const hasDecision = !!record.so_quyet_dinh?.trim();
        const isPending = proposal?.status === PROPOSAL_STATUS.PENDING;
        const hasValue = !!(record.thang_nhan && record.nam_nhan);

        if (!isPending && hasValue) {
          return <Text>{`${String(record.thang_nhan).padStart(2, '0')}/${record.nam_nhan}`}</Text>;
        }
        if (!isPending) {
          return <Text type="secondary">—</Text>;
        }

        const minDate = proposal?.thang
          ? dayjs()
              .year(proposal.nam)
              .month(proposal.thang - 1)
          : undefined;
        const pickerValue = hasValue
          ? dayjs()
              .year(record.nam_nhan!)
              .month(record.thang_nhan! - 1)
          : null;
        const picker = (
          <DatePicker
            picker="month"
            value={pickerValue}
            minDate={minDate}
            disabled={!hasDecision}
            onChange={date => {
              if (date) {
                updateNienHan(index, { thang_nhan: date.month() + 1, nam_nhan: date.year() });
              } else {
                updateNienHan(index, { thang_nhan: null, nam_nhan: null });
              }
            }}
            placeholder="Chọn tháng"
            size="small"
            variant="filled"
            style={{ width: '100%' }}
          />
        );
        if (!hasDecision) {
          return <Tooltip title="Cần thêm số quyết định trước">{picker}</Tooltip>;
        }
        return picker;
      },
    },
    {
      title: 'Số quyết định',
      dataIndex: 'so_quyet_dinh',
      key: 'so_quyet_dinh',
      width: 180,
      align: 'center' as const,
      render: (_: unknown, record: DanhHieuItem, index: number) => {
        // Check both so_quyet_dinh and legacy fields for backward compatibility
        const soQuyetDinh =
          record.so_quyet_dinh || record.so_quyet_dinh_bkbqp || record.so_quyet_dinh_cstdtq;

        if (!soQuyetDinh || (typeof soQuyetDinh === 'string' && soQuyetDinh.trim() === '')) {
          return (
            <div style={{ textAlign: 'center' }}>
              <span
                style={{
                  fontWeight: 400,
                  fontStyle: 'italic',
                  opacity: 0.6,
                }}
              >
                Chưa có số quyết định
              </span>
            </div>
          );
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
            <a
              onClick={e => {
                e.preventDefault();
                e.stopPropagation();
                handleOpenDecisionFile(soQuyetDinh);
              }}
              className="text-green-600 dark:text-green-400 font-medium underline cursor-pointer"
            >
              {soQuyetDinh}
            </a>
            {proposal?.status === PROPOSAL_STATUS.PENDING && (
              <span onClick={e => e.stopPropagation()}>
                <Popconfirm
                  title="Gỡ số quyết định?"
                  okText="Gỡ"
                  cancelText="Hủy"
                  onConfirm={() => handleClearDecision(index)}
                >
                  <Button
                    type="text"
                    danger
                    size="small"
                    icon={<CloseOutlined />}
                    title="Gỡ số quyết định"
                  />
                </Popconfirm>
              </span>
            )}
          </div>
        );
      },
    },
    {
      title:
        proposal?.loai_de_xuat === PROPOSAL_TYPES.CONG_HIEN
          ? 'Xem lịch sử chức vụ'
          : 'Xem lịch sử khen thưởng',
      key: 'history',
      width: 180,
      align: 'center' as const,
      render: (_: unknown, record: DanhHieuItem) => (
        <Button
          type="link"
          icon={<HistoryOutlined />}
          size="small"
          onClick={() => handleViewPersonnelHistory(record)}
          disabled={!record.personnel_id}
        >
          Xem lịch sử
        </Button>
      ),
    },
  ];
}
