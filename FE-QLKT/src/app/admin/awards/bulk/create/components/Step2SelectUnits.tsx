'use client';

import { useState, useEffect } from 'react';
import {
  Table,
  Input,
  Select,
  Space,
  Alert,
  Typography,
  Tag,
  message,
  InputNumber,
  Divider,
  Empty,
} from 'antd';
import { getApiErrorMessage } from '@/lib/apiError';

import { SearchOutlined, TeamOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { apiClient } from '@/lib/apiClient';
import { DEFAULT_ANTD_TABLE_PAGINATION } from '@/lib/constants/pagination.constants';
import { ExcelImportSection } from './ExcelImportSection';
import * as XLSX from 'xlsx';

const { Text } = Typography;

interface Unit {
  id: string;
  ten_don_vi: string;
  ma_don_vi: string;
  type: 'CO_QUAN_DON_VI' | 'DON_VI_TRUC_THUOC';
  CoQuanDonVi?: {
    id: string;
    ten_don_vi: string;
    ma_don_vi: string;
  };
}

interface Step2SelectUnitsProps {
  selectedUnitIds: string[];
  onUnitChange: (ids: string[]) => void;
  nam: number;
  onNamChange: (nam: number) => void;
  onTitleDataChange?: (titleData: any[]) => void;
  onNextStep?: () => void;
  isManager?: boolean;
}

export function Step2SelectUnits({
  selectedUnitIds,
  onUnitChange,
  nam,
  onNamChange,
  onTitleDataChange,
  onNextStep,
  isManager = false,
}: Step2SelectUnitsProps) {
  const [loading, setLoading] = useState(false);
  const [units, setUnits] = useState<Unit[]>([]);
  const [searchText, setSearchText] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [localNam, setLocalNam] = useState<number | null>(nam);

  // Fetch all units
  useEffect(() => {
    fetchUnits();
  }, []);

  useEffect(() => {
    setLocalNam(nam);
  }, [nam]);

  const fetchUnits = async () => {
    try {
      setLoading(true);
      const response = isManager ? await apiClient.getMyUnits() : await apiClient.getUnits();

      if (response.success && response.data) {
        const unitsData = Array.isArray(response.data) ? response.data : [];

        const formattedUnits: Unit[] = [];

        unitsData.forEach((unit: any) => {
          if (unit.co_quan_don_vi_id || unit.CoQuanDonVi) {
            formattedUnits.push({
              id: unit.id,
              ten_don_vi: unit.ten_don_vi,
              ma_don_vi: unit.ma_don_vi,
              type: 'DON_VI_TRUC_THUOC',
              CoQuanDonVi: unit.CoQuanDonVi || null,
            });
          } else {
            formattedUnits.push({
              id: unit.id,
              ten_don_vi: unit.ten_don_vi,
              ma_don_vi: unit.ma_don_vi,
              type: 'CO_QUAN_DON_VI',
            });
          }
        });

        // Sort: parent units first, then sub-units
        formattedUnits.sort((a, b) => {
          if (a.type === 'CO_QUAN_DON_VI' && b.type === 'DON_VI_TRUC_THUOC') return -1;
          if (a.type === 'DON_VI_TRUC_THUOC' && b.type === 'CO_QUAN_DON_VI') return 1;
          return a.ten_don_vi.localeCompare(b.ten_don_vi);
        });

        setUnits(formattedUnits);
        if (formattedUnits.length === 0) {
          message.warning('Không có đơn vị nào trong hệ thống');
        }
      } else {
        // Failed to fetch units
        message.error(response.message || 'Không thể tải danh sách đơn vị');
        setUnits([]);
      }
    } catch (error: unknown) {
      message.error('Lỗi khi tải danh sách đơn vị: ' + getApiErrorMessage(error, 'Unknown error'));
      setUnits([]);
    } finally {
      setLoading(false);
    }
  };

  // Filter units
  const filteredUnits = units.filter(unit => {
    // Search filter
    const matchesSearch =
      searchText === '' ||
      unit.ten_don_vi.toLowerCase().includes(searchText.toLowerCase()) ||
      unit.ma_don_vi.toLowerCase().includes(searchText.toLowerCase());

    // Type filter
    let matchesType = true;
    if (typeFilter !== 'ALL') {
      matchesType = unit.type === typeFilter;
    }

    return matchesSearch && matchesType;
  });

  const columns: ColumnsType<Unit> = [
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
      render: (_, record) => (
        <Tag color={record.type === 'CO_QUAN_DON_VI' ? 'blue' : 'green'}>
          {record.type === 'CO_QUAN_DON_VI' ? 'Cơ quan đơn vị' : 'Đơn vị trực thuộc'}
        </Tag>
      ),
    },
    {
      title: 'Mã đơn vị',
      dataIndex: 'ma_don_vi',
      key: 'ma_don_vi',
      width: 150,
      align: 'center',
      render: text => <Text code>{text}</Text>,
    },
    {
      title: 'Tên đơn vị',
      dataIndex: 'ten_don_vi',
      key: 'ten_don_vi',
      width: 250,
      align: 'center',
      render: text => <Text strong>{text}</Text>,
    },
  ];

  const handleLocalExcelProcess = async (file: File): Promise<any> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = async e => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });

          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];

          const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

          if (jsonData.length < 2) {
            throw new Error('File Excel không có dữ liệu hoặc thiếu header');
          }

          const dataRows = jsonData.slice(1); // skip header row

          const titleData: any[] = [];
          const errors: string[] = [];
          const processedUnitIds: string[] = [];

          dataRows.forEach((row: any, index: number) => {
            const rowNumber = index + 2; // +2: skip header + 0-based index

            // Validate required fields
            const maDonVi = row[0]?.toString().trim();
            const tenDonVi = row[1]?.toString().trim();
            const nam = row[2]?.toString().trim();
            const danhHieu = row[3]?.toString().trim();

            if (!tenDonVi) {
              errors.push(`Dòng ${rowNumber}: Thiếu tên đơn vị`);
              return;
            }

            if (!nam) {
              errors.push(`Dòng ${rowNumber}: Thiếu năm`);
              return;
            }

            if (!danhHieu) {
              errors.push(`Dòng ${rowNumber}: Thiếu danh hiệu`);
              return;
            }

            const namInt = parseInt(nam);

            const matchingUnit = units.find(u => {
              const unitCode = u.ma_don_vi.toLowerCase().trim();
              const unitName = u.ten_don_vi.toLowerCase().trim();
              const excelName = tenDonVi.toLowerCase().trim();
              if (maDonVi) {
                return unitCode === maDonVi.toLowerCase() && unitName === excelName;
              }

              return unitName === excelName;
            });

            if (!matchingUnit) {
              errors.push(`Dòng ${rowNumber}: Không tìm thấy đơn vị "${tenDonVi}"`);
              return;
            }

            processedUnitIds.push(matchingUnit.id);

            titleData.push({
              don_vi_id: matchingUnit.id,
              danh_hieu: danhHieu,
              nam: namInt,
              don_vi_type: matchingUnit.type,
            });
          });

          // Remove duplicates from unit IDs
          const uniqueUnitIds = Array.from(new Set(processedUnitIds));

          // Reject early if any row duplicates an existing proposal
          try {
            for (const item of titleData) {
              const checkResponse = await apiClient.checkDuplicateUnit({
                  don_vi_id: item.don_vi_id,
                  nam: item.nam,
                  danh_hieu: item.danh_hieu,
                  proposal_type: 'DON_VI_HANG_NAM',
              });

              if (checkResponse.data.success === false) {
                throw new Error(checkResponse.data.message || 'Có lỗi khi kiểm tra trùng lặp');
              }

              if (checkResponse.data.exists === true) {
                throw new Error(
                  'Dữ liệu import có trùng lặp với đề xuất đã tồn tại. Vui lòng kiểm tra lại.'
                );
              }
            }
          } catch (error: unknown) {
            reject(new Error(`Lỗi kiểm tra trùng lặp: ${getApiErrorMessage(error)}`));
            return;
          }

          resolve({
            imported: titleData.length,
            total: dataRows.length,
            errors,
            selectedUnitIds: uniqueUnitIds,
            titleData,
          });
        } catch (error: unknown) {
          reject(new Error(`Lỗi xử lý file Excel: ${getApiErrorMessage(error)}`));
        }
      };

      reader.onerror = () => {
        reject(new Error('Lỗi đọc file Excel'));
      };

      reader.readAsArrayBuffer(file);
    });
  };

  const handleImportSuccess = async (result: any) => {
    if (result.selectedUnitIds && result.selectedUnitIds.length > 0) {
      onUnitChange(result.selectedUnitIds);
    }

    // Update titleData through parent callback if available
    if (result.titleData.length > 0 && onTitleDataChange) {
      onTitleDataChange(result.titleData);
    }
    if (result.titleData[0].nam) {
      onNamChange(result.titleData[0].nam);
    }

    // Advance to Step 3 (Review) so the user can verify before confirming
    if (onNextStep) {
      setTimeout(() => {
        onNextStep();
      }, 500);
    }
  };

  // Row selection config
  const rowSelection = {
    selectedRowKeys: selectedUnitIds,
    onChange: (selectedRowKeys: React.Key[]) => {
      onUnitChange(selectedRowKeys as string[]);
    },
  };

  return (
    <div>
      <Alert
        message="Hướng dẫn"
        description={
          <div>
            <p>1. Nhập năm đề xuất khen thưởng</p>
            <p>
              2. Chọn các đơn vị cần đề xuất khen thưởng từ danh sách dưới đây (bao gồm cơ quan đơn
              vị và đơn vị trực thuộc)
            </p>
            <p>3. Sau khi chọn xong, nhấn &quot;Tiếp tục&quot; để sang bước chọn danh hiệu</p>
          </div>
        }
        type="info"
        showIcon
        icon={<TeamOutlined />}
        style={{ marginBottom: 24 }}
      />

      {/* Upload Excel Section - chỉ hiện cho admin */}
      {!isManager && (
        <>
          <ExcelImportSection
            awardType="DON_VI_HANG_NAM"
            downloadTemplate={apiClient.getUnitAnnualAwardsTemplate}
            importFile={apiClient.importUnitAnnualAwards}
            templateFileName="mau_import_don_vi_hang_nam"
            onImportSuccess={handleImportSuccess}
            selectedPersonnelIds={selectedUnitIds}
            selectedNames={selectedUnitIds.map(id => units.find(u => u.id === id)?.ten_don_vi || '')}
            entityLabel="đơn vị"
            localProcessing={true}
            onLocalProcess={handleLocalExcelProcess}
            previewImport={apiClient.previewUnitAnnualAwardsImport}
            reviewPath="/admin/awards/bulk/import-review-unit"
            sessionStorageKey="importPreviewDataUnit"
          />
        </>
      )}

      {/* Filters */}
      <Space style={{ marginBottom: 16 }} size="middle" wrap>
        <div>
          <Text strong>Năm đề xuất: </Text>
          <InputNumber
            value={localNam}
            onChange={value => {
              // Allow null so the user can clear and retype without validation errors
              if (value === null || value === undefined) {
                setLocalNam(null);
                return;
              }

              const intValue = Math.floor(Number(value));

              if (!isNaN(intValue)) {
                // Allow any value while typing; clamp only on blur
                setLocalNam(intValue);
              }
            }}
            onBlur={e => {
              // Clamp to valid range and propagate to parent on blur
              const currentValue = localNam;
              if (currentValue === null || currentValue === undefined || currentValue < 1900) {
                const finalValue = 1900;
                setLocalNam(finalValue);
                onNamChange(finalValue);
              } else if (currentValue > 2999) {
                const finalValue = 2999;
                setLocalNam(finalValue);
                onNamChange(finalValue);
              } else {
                onNamChange(currentValue);
              }
            }}
            style={{ width: 150 }}
            size="large"
            min={1900}
            max={2999}
            placeholder="Nhập năm"
            controls={true}
            step={1}
            precision={0}
            keyboard={true}
          />
        </div>

        <Input
          placeholder="Tìm theo tên hoặc mã đơn vị"
          prefix={<SearchOutlined />}
          value={searchText}
          onChange={e => setSearchText(e.target.value)}
          style={{ width: 300 }}
          size="large"
          allowClear
        />

        <Select
          placeholder="Lọc theo loại đơn vị"
          value={typeFilter}
          onChange={setTypeFilter}
          style={{ width: 200 }}
          size="large"
        >
          <Select.Option value="ALL">Tất cả đơn vị</Select.Option>
          <Select.Option value="CO_QUAN_DON_VI">Cơ quan đơn vị</Select.Option>
          <Select.Option value="DON_VI_TRUC_THUOC">Đơn vị trực thuộc</Select.Option>
        </Select>
      </Space>

      {/* Summary */}
      <div style={{ marginBottom: 16 }}>
        <Text type="secondary">
          Tổng số đơn vị: <strong>{filteredUnits.length}</strong> | Đã chọn:{' '}
          <strong style={{ color: '#1890ff' }}>{selectedUnitIds.length}</strong>
        </Text>
      </div>

      {/* Table */}
      <Table
        columns={columns}
        dataSource={filteredUnits}
        rowKey="id"
        rowSelection={rowSelection}
        loading={loading}
        pagination={{
          ...DEFAULT_ANTD_TABLE_PAGINATION,
          showTotal: total => `Tổng số ${total} đơn vị`,
        }}
        bordered
        locale={{
          emptyText: <Empty description="Không có dữ liệu đơn vị" />,
        }}
      />
    </div>
  );
}
