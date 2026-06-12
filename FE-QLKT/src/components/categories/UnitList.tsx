'use client';

import { Collapse, Table, Button, Tag, Typography, Space } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { ApartmentOutlined, TeamOutlined, EyeOutlined } from '@ant-design/icons';
import { useRouter } from 'next/navigation';
import { EmptyState } from '@/components/shared/EmptyState';

const { Text } = Typography;

interface PersonnelItem {
  id: string;
  ho_ten?: string | null;
  cap_bac?: string | null;
  co_quan_don_vi_id?: string | null;
  don_vi_truc_thuoc_id?: string | null;
  ChucVu?: { ten_chuc_vu?: string | null };
}

interface DonViTrucThuocRow {
  id: string;
  ten_don_vi: string;
  ma_don_vi?: string;
  so_luong?: number;
}

interface CoQuanDonViRow {
  id: string;
  ten_don_vi: string;
  ma_don_vi?: string;
  so_luong?: number;
  DonViTrucThuoc?: DonViTrucThuocRow[];
}

interface UnitListProps {
  units: CoQuanDonViRow[];
  allPersonnel: PersonnelItem[];
  basePath?: string;
}

function personnelColumns(
  router: ReturnType<typeof useRouter>,
  roleBase: string
): ColumnsType<PersonnelItem> {
  return [
    {
      title: 'STT',
      key: 'stt',
      width: 52,
      align: 'center',
      render: (_v, _r, idx) => idx + 1,
    },
    {
      title: 'Họ tên',
      dataIndex: 'ho_ten',
      key: 'ho_ten',
      align: 'center',
      render: v => v || '—',
    },
    {
      title: 'Cấp bậc',
      dataIndex: 'cap_bac',
      key: 'cap_bac',
      width: 140,
      align: 'center',
      render: v => v || '—',
    },
    {
      title: 'Chức vụ',
      key: 'chuc_vu',
      width: 180,
      align: 'center',
      render: (_v, r) => r.ChucVu?.ten_chuc_vu || '—',
    },
    {
      title: '',
      key: 'action',
      width: 100,
      align: 'center',
      render: (_v, r) => (
        <Button
          size="small"
          icon={<EyeOutlined />}
          onClick={() => router.push(`${roleBase}/personnel/${r.id}`)}
        >
          Chi tiết
        </Button>
      ),
    },
  ];
}

function PersonnelTable({
  personnel,
  roleBase,
}: {
  personnel: PersonnelItem[];
  roleBase: string;
}) {
  const router = useRouter();

  if (personnel.length === 0) {
    return <EmptyState compact description="Chưa có quân nhân nào" />;
  }

  return (
    <Table
      size="small"
      columns={personnelColumns(router, roleBase)}
      dataSource={personnel}
      rowKey="id"
      pagination={false}
      scroll={{ x: 'max-content' }}
    />
  );
}

function SubUnitPanel({
  dvtt,
  personnel,
  basePath,
  roleBase,
}: {
  dvtt: DonViTrucThuocRow;
  personnel: PersonnelItem[];
  basePath: string;
  roleBase: string;
}) {
  const router = useRouter();
  const count = personnel.length;

  return (
    <Collapse
      size="small"
      style={{ marginBottom: 8, background: 'transparent' }}
      items={[
        {
          key: dvtt.id,
          label: (
            <Space>
              <TeamOutlined style={{ color: '#52c41a' }} />
              <Text strong style={{ fontSize: 13 }}>
                {dvtt.ten_don_vi}
              </Text>
              {dvtt.ma_don_vi && (
                <Text type="secondary" style={{ fontSize: 12 }}>
                  ({dvtt.ma_don_vi})
                </Text>
              )}
              <Tag color="green" style={{ fontSize: 11 }}>
                {count} QN
              </Tag>
            </Space>
          ),
          extra: (
            <Button
              size="small"
              type="primary"
              icon={<EyeOutlined />}
              onClick={e => {
                e.stopPropagation();
                router.push(`${basePath}/units/${dvtt.id}`);
              }}
            >
              Chi tiết
            </Button>
          ),
          children: <PersonnelTable personnel={personnel} roleBase={roleBase} />,
        },
      ]}
    />
  );
}

export function UnitList({ units, allPersonnel, basePath = '/admin/categories' }: UnitListProps) {
  const router = useRouter();
  const roleBase = `/${basePath.split('/').filter(Boolean)[0] || 'admin'}`;

  if (units.length === 0) {
    return <EmptyState description="Chưa có đơn vị nào" />;
  }

  const personnelByCqdv = (cqdvId: string) =>
    allPersonnel.filter(p => p.co_quan_don_vi_id === cqdvId && !p.don_vi_truc_thuoc_id);

  const personnelByDvtt = (dvttId: string) =>
    allPersonnel.filter(p => p.don_vi_truc_thuoc_id === dvttId);

  const collapseItems = units.map(unit => {
    const directPersonnel = personnelByCqdv(unit.id);
    const subUnits = unit.DonViTrucThuoc || [];
    const totalCount = allPersonnel.filter(p => p.co_quan_don_vi_id === unit.id).length;

    return {
      key: unit.id,
      label: (
        <Space>
          <ApartmentOutlined style={{ color: '#1677ff' }} />
          <Text strong>{unit.ten_don_vi}</Text>
          {unit.ma_don_vi && (
            <Text type="secondary" style={{ fontSize: 12 }}>
              ({unit.ma_don_vi})
            </Text>
          )}
          <Tag color="blue" style={{ fontSize: 11 }}>
            {totalCount} QN
          </Tag>
          {subUnits.length > 0 && (
            <Tag color="geekblue" style={{ fontSize: 11 }}>
              {subUnits.length} ĐVTT
            </Tag>
          )}
        </Space>
      ),
      extra: (
        <Button
          type="primary"
          icon={<EyeOutlined />}
          onClick={e => {
            e.stopPropagation();
            router.push(`${basePath}/units/${unit.id}`);
          }}
        >
          Chi tiết
        </Button>
      ),
      children: (
        <div style={{ padding: '4px 0' }}>
          {directPersonnel.length > 0 && (
            <div style={{ marginBottom: subUnits.length > 0 ? 16 : 0 }}>
              {subUnits.length > 0 && (
                <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 8 }}>
                  Quân nhân trực thuộc cơ quan
                </Text>
              )}
              <PersonnelTable personnel={directPersonnel} roleBase={roleBase} />
            </div>
          )}

          {subUnits.map(dvtt => (
            <SubUnitPanel
              key={dvtt.id}
              dvtt={dvtt}
              personnel={personnelByDvtt(dvtt.id)}
              basePath={basePath}
              roleBase={roleBase}
            />
          ))}

          {directPersonnel.length === 0 && subUnits.length === 0 && (
            <EmptyState compact description="Chưa có quân nhân nào" />
          )}
        </div>
      ),
    };
  });

  return (
    <Collapse
      items={collapseItems}
      defaultActiveKey={units.map(u => u.id)}
    />
  );
}
