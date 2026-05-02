import { Button, Tag, Typography } from 'antd';
import { HistoryOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { EditableCell } from '@/components/shared/EditableCell';
import { getDanhHieuName } from '@/constants/danhHieu.constants';
import { PROPOSAL_STATUS } from '@/constants/proposal.constants';
import type { DanhHieuItem } from '../types';

const { Text } = Typography;

interface DonViHangNamColumnsDeps {
  proposalStatus: string;
  updateDanhHieu: (index: number, field: keyof DanhHieuItem, value: unknown) => void;
  handleOpenDecisionFile: (soQuyetDinh: string) => void;
  handleViewUnitHistory: (record: DanhHieuItem) => void;
}

export function buildDonViHangNamColumns(deps: DonViHangNamColumnsDeps): ColumnsType<DanhHieuItem> {
  const { proposalStatus, updateDanhHieu, handleOpenDecisionFile, handleViewUnitHistory } = deps;

  return [
    {
      title: 'STT',
      key: 'stt',
      width: 60,
      align: 'center' as const,
      render: (_: unknown, __: unknown, index: number) => index + 1,
    },
    {
      title: 'Loại đơn vị',
      key: 'loai_don_vi',
      width: 150,
      align: 'center' as const,
      render: (_: unknown, record: DanhHieuItem) => {
        const type =
          record.don_vi_type ||
          (record.co_quan_don_vi_cha ? 'DON_VI_TRUC_THUOC' : 'CO_QUAN_DON_VI');
        return (
          <div style={{ textAlign: 'center' }}>
            <Tag color={type === 'CO_QUAN_DON_VI' ? 'blue' : 'green'}>
              {type === 'CO_QUAN_DON_VI' ? 'Cơ quan đơn vị' : 'Đơn vị trực thuộc'}
            </Tag>
          </div>
        );
      },
    },
    {
      title: 'Mã đơn vị',
      dataIndex: 'ma_don_vi',
      key: 'ma_don_vi',
      width: 150,
      align: 'center' as const,
      render: (text: string) => (
        <div style={{ textAlign: 'center' }}>
          <Text code>{text || '-'}</Text>
        </div>
      ),
    },
    {
      title: 'Tên đơn vị',
      dataIndex: 'ten_don_vi',
      key: 'ten_don_vi',
      width: 250,
      align: 'center' as const,
      render: (text: string) => (
        <div style={{ textAlign: 'center' }}>
          <Text strong>{text || '-'}</Text>
        </div>
      ),
    },
    {
      title: 'Năm',
      dataIndex: 'nam',
      key: 'nam',
      width: 80,
      align: 'center' as const,
      render: (_: unknown, record: DanhHieuItem, index: number) => (
        <div style={{ textAlign: 'center' }}>
          <EditableCell
            value={record.nam}
            type="number"
            onSave={val => updateDanhHieu(index, 'nam', parseInt(val))}
            editable={proposalStatus === PROPOSAL_STATUS.PENDING}
          />
        </div>
      ),
    },
    {
      title: 'Danh hiệu',
      dataIndex: 'danh_hieu',
      key: 'danh_hieu',
      width: 200,
      align: 'center' as const,
      render: (_: unknown, record: DanhHieuItem) => {
        const fullName = record.danh_hieu ? getDanhHieuName(record.danh_hieu) : null;
        return (
          <div style={{ textAlign: 'center' }}>
            <Text>{fullName || '-'}</Text>
          </div>
        );
      },
    },
    {
      title: 'Số quyết định',
      dataIndex: 'so_quyet_dinh',
      key: 'so_quyet_dinh',
      width: 180,
      align: 'center' as const,
      render: (_: unknown, record: DanhHieuItem) => {
        const soQuyetDinh =
          record.so_quyet_dinh || record.so_quyet_dinh_bkbqp || record.so_quyet_dinh_cstdtq;

        if (!soQuyetDinh || (typeof soQuyetDinh === 'string' && soQuyetDinh.trim() === '')) {
          return (
            <div style={{ textAlign: 'center' }}>
              <span style={{ fontWeight: 400, fontStyle: 'italic', opacity: 0.6 }}>
                Chưa có số quyết định
              </span>
            </div>
          );
        }

        return (
          <div style={{ textAlign: 'center' }}>
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
          </div>
        );
      },
    },
    {
      title: 'Xem lịch sử khen thưởng',
      key: 'history',
      width: 180,
      align: 'center' as const,
      render: (_: unknown, record: DanhHieuItem) => (
        <Button
          type="link"
          icon={<HistoryOutlined />}
          size="small"
          onClick={() => handleViewUnitHistory(record)}
          disabled={!record.don_vi_id}
        >
          Xem lịch sử
        </Button>
      ),
    },
  ];
}
