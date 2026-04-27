'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Card,
  Button,
  Table,
  Tag,
  Space,
  Typography,
  Breadcrumb,
  message,
  Select,
  Input,
  Popconfirm,
  Tooltip,
  Row,
  Col,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  HomeOutlined,
  UserOutlined,
  TeamOutlined,
  EyeOutlined,
  SearchOutlined,
  FilterOutlined,
} from '@ant-design/icons';
import type { TableColumnsType } from 'antd';
import { apiClient } from '@/lib/apiClient';
import { DEFAULT_ANTD_TABLE_PAGINATION, FETCH_ALL_LIMIT } from '@/constants/pagination.constants';
import { downloadDecisionFile } from '@/lib/file/downloadDecisionFile';
import { CreateAdhocAwardModal } from '@/components/adhoc-awards/CreateAdhocAwardModal';
import { EditAdhocAwardModal } from '@/components/adhoc-awards/EditAdhocAwardModal';
import { DetailAdhocAwardModal } from '@/components/adhoc-awards/DetailAdhocAwardModal';
import type { AdhocAward, Personnel, Unit, TableFilters } from '@/components/adhoc-awards/types';
import { INITIAL_TABLE_FILTERS } from '@/components/adhoc-awards/types';

const { Title, Text } = Typography;

export default function AdhocAwardsPage() {
  const [awards, setAwards] = useState<AdhocAward[]>([]);
  const [personnel, setPersonnel] = useState<Personnel[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [subUnits, setSubUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(false);

  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingAward, setEditingAward] = useState<AdhocAward | null>(null);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [detailAward, setDetailAward] = useState<AdhocAward | null>(null);

  const [tableFilters, setTableFilters] = useState<TableFilters>(INITIAL_TABLE_FILTERS);

  const fetchAwards = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiClient.getAdhocAwards();
      setAwards(res.data ?? []);
    } catch {
      message.error('Không tải được danh sách khen thưởng đột xuất');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchPersonnelAndUnits = useCallback(async () => {
    try {
      const [personnelRes, allUnitsRes] = await Promise.all([
        apiClient.getPersonnel({ limit: FETCH_ALL_LIMIT }),
        apiClient.getUnits(),
      ]);

      const personnelData = personnelRes.data || [];
      const allUnitsData = Array.isArray(allUnitsRes.data) ? allUnitsRes.data : [];

      setPersonnel(personnelData);
      setUnits(allUnitsData.filter((u: Unit) => !u.co_quan_don_vi_id));
      setSubUnits(allUnitsData.filter((u: Unit) => u.co_quan_don_vi_id));
    } catch {
      message.error('Không tải được dữ liệu đối tượng');
    }
  }, []);

  useEffect(() => {
    fetchAwards();
    fetchPersonnelAndUnits();
  }, [fetchAwards, fetchPersonnelAndUnits]);

  const handleDelete = async (id: string) => {
    try {
      const res = await apiClient.deleteAdhocAward(id);
      if (!res.success) {
        message.error(res.message || 'Xóa thất bại');
        return;
      }
      message.success('Xóa khen thưởng đột xuất thành công');
      fetchAwards();
    } catch {
      message.error('Xóa thất bại');
    }
  };

  const handleOpenEditModal = (award: AdhocAward) => {
    setEditingAward(award);
    setEditModalVisible(true);
  };

  const handleOpenDecisionFile = async (soQuyetDinh: string) => {
    await downloadDecisionFile(soQuyetDinh);
  };

  const parseYearFilter = (value: string | number): number | null => {
    if (value === '') return null;
    return typeof value === 'number' ? value : Number(value);
  };

  const availableYears = useMemo(() => {
    return Array.from(new Set(awards.map(a => a.nam))).sort((a, b) => b - a);
  }, [awards]);

  const filteredAwards = useMemo(() => {
    return awards.filter(award => {
      if (tableFilters.year && award.nam !== tableFilters.year) return false;
      if (tableFilters.type !== 'ALL' && award.doi_tuong !== tableFilters.type) return false;

      if (tableFilters.searchText) {
        const searchLower = tableFilters.searchText.toLowerCase();
        const name =
          award.doi_tuong === 'CA_NHAN'
            ? award.QuanNhan?.ho_ten || ''
            : award.CoQuanDonVi?.ten_don_vi || award.DonViTrucThuoc?.ten_don_vi || '';
        const decisionNumber = award.so_quyet_dinh || '';
        const note = award.ghi_chu || '';
        const awardForm = award.hinh_thuc_khen_thuong || '';

        if (
          !name.toLowerCase().includes(searchLower) &&
          !decisionNumber.toLowerCase().includes(searchLower) &&
          !note.toLowerCase().includes(searchLower) &&
          !awardForm.toLowerCase().includes(searchLower)
        ) {
          return false;
        }
      }

      return true;
    });
  }, [awards, tableFilters]);

  const columns: TableColumnsType<AdhocAward> = [
    {
      title: 'STT',
      key: 'stt',
      width: 50,
      align: 'center',
      render: (_, __, index) => <div style={{ textAlign: 'center' }}>{index + 1}</div>,
    },
    {
      title: 'Năm',
      dataIndex: 'nam',
      key: 'nam',
      width: 70,
      align: 'center',
      sorter: (a, b) => a.nam - b.nam,
      render: (text: number) => <div style={{ textAlign: 'center' }}>{text}</div>,
    },
    {
      title: 'Đối tượng',
      dataIndex: 'doi_tuong',
      key: 'doi_tuong',
      width: 100,
      align: 'center',
      render: (doiTuong: string) => (
        <div style={{ textAlign: 'center' }}>
          <Tag color={doiTuong === 'CA_NHAN' ? 'blue' : 'green'}>
            {doiTuong === 'CA_NHAN' ? (
              <>
                <UserOutlined /> Cá nhân
              </>
            ) : (
              <>
                <TeamOutlined /> Tập thể
              </>
            )}
          </Tag>
        </div>
      ),
    },
    {
      title: 'Chi tiết đối tượng',
      key: 'target',
      ellipsis: true,
      align: 'center',
      render: (_, record) => {
        if (record.doi_tuong === 'CA_NHAN' && record.QuanNhan) {
          const capBac = record.cap_bac || record.QuanNhan.cap_bac;
          const chucVu = record.chuc_vu || record.QuanNhan.ChucVu?.ten_chuc_vu;
          const subInfo = [capBac, chucVu].filter(Boolean).join(' - ');
          return (
            <div style={{ textAlign: 'center' }}>
              <strong>{record.QuanNhan.ho_ten}</strong>
              {subInfo && (
                <div>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {subInfo}
                  </Text>
                </div>
              )}
            </div>
          );
        } else if (record.doi_tuong === 'TAP_THE') {
          const unitName = record.CoQuanDonVi?.ten_don_vi || record.DonViTrucThuoc?.ten_don_vi;
          return (
            <div style={{ textAlign: 'center' }}>
              <strong>{unitName || '-'}</strong>
              {record.DonViTrucThuoc?.CoQuanDonVi && (
                <div>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {record.DonViTrucThuoc.CoQuanDonVi.ten_don_vi}
                  </Text>
                </div>
              )}
            </div>
          );
        }
        return (
          <div style={{ textAlign: 'center' }}>
            <Text type="secondary">-</Text>
          </div>
        );
      },
    },
    {
      title: 'Hình thức khen thưởng',
      dataIndex: 'hinh_thuc_khen_thuong',
      key: 'hinh_thuc_khen_thuong',
      ellipsis: true,
      align: 'center',
      render: (text: string, record: AdhocAward) => (
        <div style={{ textAlign: 'center' }}>
          <span>{text}</span>
          {record.so_quyet_dinh && (
            <div>
              <a
                onClick={e => {
                  e.stopPropagation();
                  handleOpenDecisionFile(record.so_quyet_dinh!);
                }}
                style={{ color: '#52c41a', cursor: 'pointer', fontSize: 12 }}
              >
                QĐ: {record.so_quyet_dinh}
              </a>
            </div>
          )}
        </div>
      ),
    },
    {
      title: 'Ghi chú',
      dataIndex: 'ghi_chu',
      key: 'ghi_chu',
      width: 120,
      ellipsis: true,
      align: 'center',
      render: (text: string) => (
        <div style={{ textAlign: 'center' }}>
          {text ? (
            <Tooltip title={text}>
              <span>{text}</span>
            </Tooltip>
          ) : (
            <Text type="secondary" style={{ fontStyle: 'italic', opacity: 0.6 }}>
              Không có ghi chú
            </Text>
          )}
        </div>
      ),
    },
    {
      title: 'Thao tác',
      key: 'action',
      width: 150,
      align: 'center',
      render: (_, record) => (
        <div style={{ textAlign: 'center' }}>
          <Space size="small">
            <Tooltip title="Xem chi tiết">
              <Button
                type="text"
                icon={<EyeOutlined />}
                onClick={e => {
                  e.stopPropagation();
                  setDetailAward(record);
                  setDetailModalVisible(true);
                }}
                size="small"
                style={{ color: '#52c41a' }}
              />
            </Tooltip>
            <Tooltip title="Chỉnh sửa">
              <Button
                type="text"
                icon={<EditOutlined />}
                onClick={e => {
                  e.stopPropagation();
                  handleOpenEditModal(record);
                }}
                size="small"
                style={{ color: '#1890ff' }}
              />
            </Tooltip>
            <Popconfirm
              title="Xác nhận xóa"
              description="Bạn có chắc chắn muốn xóa khen thưởng này?"
              onConfirm={e => {
                e?.stopPropagation();
                handleDelete(record.id);
              }}
              onCancel={e => e?.stopPropagation()}
              okText="Xóa"
              cancelText="Hủy"
              okButtonProps={{ danger: true }}
            >
              <Tooltip title="Xóa">
                <Button
                  type="text"
                  danger
                  icon={<DeleteOutlined />}
                  size="small"
                  onClick={e => e.stopPropagation()}
                />
              </Tooltip>
            </Popconfirm>
          </Space>
        </div>
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <Breadcrumb
        style={{ marginBottom: 16 }}
        items={[
          { href: '/admin/dashboard', title: <HomeOutlined /> },
          { title: 'Khen thưởng đột xuất' },
        ]}
      />

      <Card>
        <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
          <Title level={3} style={{ margin: 0 }}>
            Quản lý khen thưởng đột xuất
          </Title>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setCreateModalVisible(true)}
          >
            Thêm khen thưởng
          </Button>
        </div>

        <Card size="small" style={{ marginBottom: 16 }}>
          <Row gutter={[16, 16]} align="middle">
            <Col xs={24} sm={12} md={6}>
              <label style={{ display: 'block', marginBottom: 4, fontSize: 12 }}>
                <FilterOutlined /> Năm
              </label>
              <Select
                style={{ width: '100%' }}
                placeholder="Tất cả các năm"
                value={tableFilters.year !== null ? tableFilters.year : ''}
                onChange={value =>
                  setTableFilters(prev => ({ ...prev, year: parseYearFilter(value) }))
                }
                allowClear
                size="large"
              >
                <Select.Option value="">Tất cả các năm</Select.Option>
                {availableYears.map(year => (
                  <Select.Option key={year} value={year}>
                    {year}
                  </Select.Option>
                ))}
              </Select>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <label style={{ display: 'block', marginBottom: 4, fontSize: 12 }}>
                <FilterOutlined /> Đối tượng
              </label>
              <Select
                style={{ width: '100%' }}
                placeholder="Tất cả loại"
                value={tableFilters.type}
                onChange={value => setTableFilters(prev => ({ ...prev, type: value }))}
                size="large"
              >
                <Select.Option value="ALL">Tất cả</Select.Option>
                <Select.Option value="CA_NHAN">Cá nhân</Select.Option>
                <Select.Option value="TAP_THE">Tập thể</Select.Option>
              </Select>
            </Col>
            <Col xs={24} sm={16} md={8}>
              <label style={{ display: 'block', marginBottom: 4, fontSize: 12 }}>
                <SearchOutlined /> Tìm kiếm
              </label>
              <Input
                placeholder="Tên, số quyết định, hình thức, ghi chú..."
                value={tableFilters.searchText}
                onChange={e => setTableFilters(prev => ({ ...prev, searchText: e.target.value }))}
                allowClear
                size="large"
                style={{ width: '100%' }}
              />
            </Col>
            <Col xs={24} sm={8} md={4}>
              <label
                style={{ display: 'block', marginBottom: 4, fontSize: 12, color: 'transparent' }}
              >
                .
              </label>
              <Button
                icon={null}
                onClick={() => setTableFilters(INITIAL_TABLE_FILTERS)}
                size="large"
                style={{ width: '100%' }}
              >
                Xoá bộ lọc
              </Button>
            </Col>
          </Row>
          {(tableFilters.year || tableFilters.type !== 'ALL' || tableFilters.searchText) && (
            <div style={{ marginTop: 12 }}>
              <Text type="secondary">
                Đang hiển thị <strong>{filteredAwards.length}</strong> / {awards.length} bản ghi
              </Text>
            </div>
          )}
        </Card>

        <Table
          columns={columns}
          dataSource={filteredAwards}
          rowKey="id"
          loading={loading}
          scroll={{ x: 'max-content' }}
          pagination={{
            ...DEFAULT_ANTD_TABLE_PAGINATION,
            showTotal: (total, range) => `${range[0]}-${range[1]} của ${total} bản ghi`,
          }}
          onRow={record => ({
            onClick: () => {
              setDetailAward(record);
              setDetailModalVisible(true);
            },
            style: { cursor: 'pointer' },
          })}
        />
      </Card>

      <CreateAdhocAwardModal
        open={createModalVisible}
        onClose={() => setCreateModalVisible(false)}
        onSuccess={fetchAwards}
        personnel={personnel}
        units={units}
        subUnits={subUnits}
      />

      <EditAdhocAwardModal
        open={editModalVisible}
        award={editingAward}
        onClose={() => {
          setEditModalVisible(false);
          setEditingAward(null);
        }}
        onSuccess={fetchAwards}
      />

      <DetailAdhocAwardModal
        open={detailModalVisible}
        award={detailAward}
        onClose={() => {
          setDetailModalVisible(false);
          setDetailAward(null);
        }}
        onEdit={handleOpenEditModal}
      />
    </div>
  );
}
