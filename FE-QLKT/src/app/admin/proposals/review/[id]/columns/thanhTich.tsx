import { Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { EditableCell } from '@/components/shared/EditableCell';
import { formatUnitInfo } from '../helpers';
import type { ThanhTichItem } from '../types';

const { Text } = Typography;

interface ThanhTichColumnsDeps {
  updateThanhTich: (index: number, field: keyof ThanhTichItem, value: unknown) => void;
  handleOpenDecisionFile: (soQuyetDinh: string) => void;
}

export function buildThanhTichColumns(deps: ThanhTichColumnsDeps): ColumnsType<ThanhTichItem> {
  const { updateThanhTich, handleOpenDecisionFile } = deps;

  return [
    {
      title: 'STT',
      key: 'stt',
      width: 60,
      align: 'center' as const,
      render: (_: unknown, __: unknown, index: number) => (
        <div style={{ textAlign: 'center' }}>{index + 1}</div>
      ),
    },
    {
      title: 'Họ tên',
      dataIndex: 'ho_ten',
      key: 'ho_ten',
      width: 250,
      align: 'center' as const,
      render: (text: string, record: ThanhTichItem) => {
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
      render: (_: unknown, record: ThanhTichItem) => {
        const capBac = record.cap_bac;
        const chucVu = record.chuc_vu;

        if (!capBac && !chucVu) {
          return (
            <div style={{ textAlign: 'center' }}>
              <span style={{ fontStyle: 'italic', opacity: 0.6 }}>Chưa có dữ liệu</span>
            </div>
          );
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
    {
      title: 'Năm',
      dataIndex: 'nam',
      key: 'nam',
      width: 80,
      align: 'center' as const,
      render: (_: unknown, record: ThanhTichItem, index: number) => (
        <div style={{ textAlign: 'center' }}>
          <EditableCell
            value={record.nam}
            type="number"
            onSave={val => updateThanhTich(index, 'nam', parseInt(val))}
            editable={false}
          />
        </div>
      ),
    },
    {
      title: 'Loại',
      dataIndex: 'loai',
      key: 'loai',
      width: 100,
      align: 'center' as const,
      render: (_: unknown, record: ThanhTichItem, index: number) => (
        <div style={{ textAlign: 'center' }}>
          <EditableCell
            value={record.loai}
            type="select"
            options={[
              { label: 'ĐTKH', value: 'DTKH' },
              { label: 'SKKH', value: 'SKKH' },
            ]}
            onSave={val => updateThanhTich(index, 'loai', val)}
            editable={false}
          />
        </div>
      ),
    },
    {
      title: 'Mô tả',
      dataIndex: 'mo_ta',
      key: 'mo_ta',
      align: 'center' as const,
      render: (_: unknown, record: ThanhTichItem, index: number) => (
        <div style={{ textAlign: 'center' }}>
          <EditableCell
            value={record.mo_ta}
            type="text"
            onSave={val => updateThanhTich(index, 'mo_ta', val)}
            editable={false}
          />
        </div>
      ),
    },
    {
      title: 'Số quyết định',
      dataIndex: 'so_quyet_dinh',
      key: 'so_quyet_dinh',
      width: 180,
      align: 'center' as const,
      render: (_: unknown, record: ThanhTichItem) => {
        const soQuyetDinh = record.so_quyet_dinh;
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
  ];
}
