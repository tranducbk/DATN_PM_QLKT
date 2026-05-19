import { Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { getDanhHieuName } from '@/constants/danhHieu.constants';
import { PROPOSAL_TYPES } from '@/constants/proposal.constants';
import { renderServiceTime, makeContributionColumns } from '@/lib/award/serviceTimeHelpers';
import type { DateInput } from '@/lib/types/common';
import type { ContributionProfile } from '@/lib/types/personnelList';
import type { TitleDataItem } from '@/lib/types/proposal';

const { Text } = Typography;

export interface ProposalReviewRow {
  id: string;
  co_quan_don_vi_id?: string | null;
  CoQuanDonVi?: Record<string, unknown> | null;
  cap_bac?: string | null;
  chuc_vu?: string | null;
  ngay_nhap_ngu?: DateInput;
  ngay_xuat_ngu?: DateInput;
  ma_don_vi?: string;
  ten_don_vi?: string;
}

/**
 * Builds review-step table columns for the proposal wizard.
 * @param proposalType - Proposal type code (PROPOSAL_TYPES.*)
 * @param titleData - Title/achievement data from step 3
 * @param nam - Reference year
 * @param thang - Reference month
 * @param contributionProfiles - Contribution time profiles keyed by personnel ID
 * @param danhHieuTitle - Column header for the title column (default: 'Danh hiệu')
 */
export function buildReviewColumns<T extends ProposalReviewRow>(
  proposalType: string,
  titleData: TitleDataItem[],
  nam: number,
  thang: number,
  contributionProfiles: Record<string, ContributionProfile>,
  danhHieuTitle = 'Danh hiệu'
): ColumnsType<T> {
  const columns: ColumnsType<T> = [];

  if (proposalType === PROPOSAL_TYPES.DON_VI_HANG_NAM) {
    columns.push(
      {
        title: 'STT',
        key: 'index',
        width: 60,
        align: 'center',
        render: (_, __, index) => index + 1,
      },
      {
        title: 'Loại đơn vị',
        key: 'type',
        width: 150,
        align: 'center',
        render: (_, record) => {
          const type =
            record.co_quan_don_vi_id || record.CoQuanDonVi
              ? 'DON_VI_TRUC_THUOC'
              : 'CO_QUAN_DON_VI';
          return (
            <Tag color={type === 'CO_QUAN_DON_VI' ? 'blue' : 'green'}>
              {type === 'CO_QUAN_DON_VI' ? 'Cơ quan đơn vị' : 'Đơn vị trực thuộc'}
            </Tag>
          );
        },
      },
      {
        title: 'Mã đơn vị',
        dataIndex: 'ma_don_vi',
        key: 'ma_don_vi',
        width: 150,
        align: 'center',
        render: (text: string) => <Text code>{text}</Text>,
      },
      {
        title: 'Tên đơn vị',
        dataIndex: 'ten_don_vi',
        key: 'ten_don_vi',
        width: 250,
        align: 'center',
        render: (text: string) => <Text strong>{text}</Text>,
      }
    );
  } else {
    columns.push(
      {
        title: 'STT',
        key: 'index',
        width: 60,
        align: 'center',
        render: (_, __, index) => index + 1,
      },
      {
        title: 'Họ và tên',
        dataIndex: 'ho_ten',
        key: 'ho_ten',
        width: 200,
        align: 'center',
        render: (text: string) => <Text strong>{text}</Text>,
      },
      {
        title: 'Cấp bậc / Chức vụ',
        key: 'cap_bac_chuc_vu',
        width: 200,
        align: 'center',
        render: (_, record) => {
          const capBac = record.cap_bac;
          const chucVu = record.chuc_vu;
          return (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <Text strong style={{ marginBottom: '4px' }}>
                {capBac || '-'}
              </Text>
              <Text type="secondary" style={{ fontSize: '12px' }}>
                {chucVu || '-'}
              </Text>
            </div>
          );
        },
      }
    );

    if (
      proposalType === PROPOSAL_TYPES.NIEN_HAN ||
      proposalType === PROPOSAL_TYPES.HC_QKQT ||
      proposalType === PROPOSAL_TYPES.KNC_VSNXD_QDNDVN
    ) {
      columns.push({
        title: 'Tổng thời gian',
        key: 'tong_thoi_gian',
        width: 150,
        align: 'center' as const,
        render: (_: unknown, record: T) => renderServiceTime(record, nam, thang),
      });
    }

    if (proposalType === PROPOSAL_TYPES.CONG_HIEN) {
      columns.push(
        ...(makeContributionColumns(contributionProfiles) as ColumnsType<T>)
      );
    }
  }

  if (proposalType === PROPOSAL_TYPES.NCKH) {
    columns.push(
      {
        title: 'Loại',
        dataIndex: 'loai',
        key: 'loai',
        width: 160,
        align: 'center',
        render: (loai: string) => (
          <Tag color={loai === 'DTKH' ? 'blue' : 'green'}>
            {loai === 'DTKH' ? 'Đề tài khoa học' : 'Sáng kiến khoa học'}
          </Tag>
        ),
      },
      {
        title: 'Mô tả',
        dataIndex: 'mo_ta',
        key: 'mo_ta',
        align: 'center',
        render: (_, record) => {
          const moTa = titleData.find(
            t => String(t.personnel_id) === String(record.id)
          )?.mo_ta;
          return <Text>{moTa}</Text>;
        },
      }
    );
  } else {
    columns.push({
      title: danhHieuTitle,
      dataIndex: 'danh_hieu',
      key: 'danh_hieu',
      width: 250,
      align: 'center',
      render: (_, record) => {
        const titleInfo = titleData.find(
          t =>
            String(t.personnel_id) === String(record.id) ||
            String(t.don_vi_id) === String(record.id)
        );
        const danh_hieu = titleInfo?.danh_hieu;
        const fullName = getDanhHieuName(danh_hieu);
        return <Text>{fullName || '-'}</Text>;
      },
    });
  }

  return columns;
}
