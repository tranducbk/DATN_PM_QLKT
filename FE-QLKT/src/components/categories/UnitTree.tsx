'use client';

import { useMemo } from 'react';
import { Tree, Tag, Typography, Empty } from 'antd';
import type { DataNode } from 'antd/es/tree';
import { BankOutlined, ApartmentOutlined, TeamOutlined } from '@ant-design/icons';
import { useRouter } from 'next/navigation';

const { Text } = Typography;

interface DonViTrucThuocNode {
  id: string;
  ten_don_vi: string;
  ma_don_vi?: string;
  so_luong?: number;
}

interface CoQuanDonViNode {
  id: string;
  ten_don_vi: string;
  ma_don_vi?: string;
  so_luong?: number;
  DonViTrucThuoc?: DonViTrucThuocNode[];
}

interface UnitTreeProps {
  units: CoQuanDonViNode[];
}

function buildNodeTitle(
  name: string,
  code: string | undefined,
  count: number | undefined,
  color: string
) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <span style={{ fontWeight: 500 }}>{name}</span>
      {code && (
        <Text type="secondary" style={{ fontSize: 12 }}>
          ({code})
        </Text>
      )}
      {count !== undefined && (
        <Tag color={color} style={{ marginLeft: 4, fontSize: 11 }}>
          {count} QN
        </Tag>
      )}
    </span>
  );
}

function buildTreeData(units: CoQuanDonViNode[]): DataNode[] {
  const totalPersonnel = units.reduce((sum, u) => {
    const childSum = (u.DonViTrucThuoc || []).reduce((s, d) => s + (d.so_luong || 0), 0);
    return sum + (u.so_luong || 0) + childSum;
  }, 0);

  const children: DataNode[] = units.map(u => {
    const subChildren: DataNode[] = (u.DonViTrucThuoc || []).map(d => ({
      key: d.id,
      icon: <TeamOutlined style={{ color: '#52c41a' }} />,
      title: buildNodeTitle(d.ten_don_vi, d.ma_don_vi, d.so_luong, 'green'),
      isLeaf: true,
    }));

    return {
      key: u.id,
      icon: <ApartmentOutlined style={{ color: '#1677ff' }} />,
      title: buildNodeTitle(u.ten_don_vi, u.ma_don_vi, u.so_luong, 'blue'),
      children: subChildren.length > 0 ? subChildren : undefined,
      isLeaf: subChildren.length === 0,
    };
  });

  return [
    {
      key: 'root',
      icon: <BankOutlined style={{ color: '#722ed1' }} />,
      title: buildNodeTitle('Học viện Khoa học Quân sự', 'HVKHQS', totalPersonnel, 'purple'),
      children,
      selectable: false,
    },
  ];
}

export function UnitTree({ units }: UnitTreeProps) {
  const router = useRouter();

  const treeData = useMemo(() => buildTreeData(units), [units]);

  const defaultExpandedKeys = useMemo(
    () => ['root', ...units.map(u => u.id)],
    [units]
  );

  if (units.length === 0) {
    return <Empty description="Chưa có đơn vị nào" />;
  }

  const handleSelect = (selectedKeys: React.Key[]) => {
    const key = selectedKeys[0];
    if (key && key !== 'root') {
      router.push(`/admin/categories/units/${key}`);
    }
  };

  return (
    <Tree
      showIcon
      showLine={{ showLeafIcon: false }}
      defaultExpandedKeys={defaultExpandedKeys}
      treeData={treeData}
      onSelect={handleSelect}
      style={{ fontSize: 14 }}
      selectable
    />
  );
}
