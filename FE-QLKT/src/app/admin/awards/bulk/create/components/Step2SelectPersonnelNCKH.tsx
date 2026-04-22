'use client';

import { useState, useEffect } from 'react';
import { Table, Input, Select, Space, Alert, Typography, InputNumber, Divider, Empty, message } from 'antd';
import { SearchOutlined, TeamOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { getApiErrorMessage } from '@/lib/apiError';
import { formatDate } from '@/lib/utils';
import { apiClient } from '@/lib/apiClient';
import { DEFAULT_ANTD_TABLE_PAGINATION, FETCH_ALL_LIMIT } from '@/lib/constants/pagination.constants';
import { ExcelImportSection } from './ExcelImportSection';
import * as XLSX from 'xlsx';

const { Text } = Typography;

interface Personnel {
  id: string;
  ho_ten: string;
  cccd: string;
  ngay_sinh?: string | null;
  co_quan_don_vi_id: string;
  don_vi_truc_thuoc_id: string;
  chuc_vu_id: string;
  cap_bac?: string;
  CoQuanDonVi?: {
    id: string;
    ten_don_vi: string;
    ma_don_vi: string;
  };
  DonViTrucThuoc?: {
    id: string;
    ten_don_vi: string;
    ma_don_vi: string;
    CoQuanDonVi?: {
      id: string;
      ten_don_vi: string;
      ma_don_vi: string;
    };
  };
  ChucVu?: {
    id: string;
    ten_chuc_vu: string;
  };
}

interface Step2SelectPersonnelNCKHProps {
  selectedPersonnelIds: string[];
  onPersonnelChange: (ids: string[]) => void;
  nam: number;
  onNamChange: (nam: number) => void;
  onTitleDataChange?: (titleData: any[]) => void;
  onNextStep?: () => void;
  isManager?: boolean;
}

export function Step2SelectPersonnelNCKH({
  selectedPersonnelIds,
  onPersonnelChange,
  nam,
  onNamChange,
  onTitleDataChange,
  onNextStep,
  isManager = false,
}: Step2SelectPersonnelNCKHProps) {
  const [loading, setLoading] = useState(false);
  const [personnel, setPersonnel] = useState<Personnel[]>([]);
  const [searchText, setSearchText] = useState('');
  const [unitFilter, setUnitFilter] = useState<string>('ALL');
  const CURRENT_YEAR = new Date().getFullYear();
  const [localNam, setLocalNam] = useState<number | null>(nam);

  useEffect(() => {
    fetchPersonnel();
  }, []);

  useEffect(() => {
    setLocalNam(nam);
  }, [nam]);

  const fetchPersonnel = async () => {
    try {
      setLoading(true);
      const response = await apiClient.getPersonnel({
        page: 1,
        limit: FETCH_ALL_LIMIT,
      });

      if (response.success) {
        const personnelData = response.data ?? [];
        setPersonnel(personnelData);
      }
    } catch (error: unknown) {
      message.error(getApiErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  const units = Array.from(
    new Set(
      personnel.map(p => {
        if (p.DonViTrucThuoc) {
          return `${p.DonViTrucThuoc.id}|${p.DonViTrucThuoc.ten_don_vi}`;
        } else if (p.CoQuanDonVi) {
          return `${p.CoQuanDonVi.id}|${p.CoQuanDonVi.ten_don_vi}`;
        }
        return '';
      })
    )
  ).filter(Boolean);

  const filteredPersonnel = personnel.filter(p => {
    const matchesSearch =
      searchText === '' || p.ho_ten.toLowerCase().includes(searchText.toLowerCase());

    const matchesUnit =
      !unitFilter ||
      unitFilter === 'ALL' ||
      p.don_vi_truc_thuoc_id === unitFilter.split('|')[0] ||
      p.co_quan_don_vi_id === unitFilter.split('|')[0];

    return matchesSearch && matchesUnit;
  });

  const columns: ColumnsType<Personnel> = [
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
      render: (text: string, record) => {
        const coQuan = record.DonViTrucThuoc?.CoQuanDonVi || record.CoQuanDonVi;
        const donViTrucThuoc = record.DonViTrucThuoc;

        const donViDisplay: string | null = donViTrucThuoc?.ten_don_vi
          ? coQuan?.ten_don_vi
            ? `${donViTrucThuoc.ten_don_vi} (${coQuan.ten_don_vi})`
            : donViTrucThuoc.ten_don_vi
          : coQuan?.ten_don_vi || null;

        return (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <Text strong>{text}</Text>
            {donViDisplay && (
              <Text type="secondary" style={{ fontSize: '12px', marginTop: 4 }}>
                {donViDisplay}
              </Text>
            )}
          </div>
        );
      },
    },
    {
      title: 'Ngày sinh',
      dataIndex: 'ngay_sinh',
      key: 'ngay_sinh',
      width: 140,
      align: 'center',
      render: (date: string | undefined | null) => (date ? formatDate(date) : '-'),
    },
    {
      title: 'Cấp bậc / Chức vụ',
      key: 'cap_bac_chuc_vu',
      width: 180,
      align: 'center',
      render: (_, record) => {
        const capBac = record.cap_bac;
        const chucVu = record.ChucVu?.ten_chuc_vu;
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
          const processedPersonnelIds: string[] = [];

          dataRows.forEach((row: any, index: number) => {
            const rowNumber = index + 2; // +2: skip header + 0-based index

            // Validate required fields
            const hoTen = row[1]?.toString().trim();
            const ngaySinh = row[2]?.toString().trim();
            const nam = row[3]?.toString().trim();
            const loai = row[4]?.toString().trim();
            const mota = row[5]?.toString().trim();
            const capBac = row[6]?.toString().trim();
            const chucVu = row[7]?.toString().trim();

            if (!hoTen) {
              errors.push(`Dòng ${rowNumber}: Thiếu họ tên`);
              return;
            }

            if (!nam) {
              errors.push(`Dòng ${rowNumber}: Thiếu năm`);
              return;
            }

            if (!loai) {
              errors.push(`Dòng ${rowNumber}: Thiếu loại`);
              return;
            }

            const namInt = parseInt(nam);

            const matchingPersonnel = ngaySinh
              ? personnel.find(p => {
                  const nameMatch = p.ho_ten.toLowerCase().trim() === hoTen.toLowerCase().trim();
                  const personnelBirth = p.ngay_sinh ? formatDate(p.ngay_sinh) : '';
                  return nameMatch && personnelBirth === ngaySinh;
                })
              : personnel.find(p => p.ho_ten.toLowerCase().trim() === hoTen.toLowerCase().trim());

            if (!matchingPersonnel) {
              const errorMsg = ngaySinh
                ? `Dòng ${rowNumber}: Không tìm thấy quân nhân "${hoTen}" sinh ngày ${ngaySinh}`
                : `Dòng ${rowNumber}: Không tìm thấy quân nhân "${hoTen}"`;
              errors.push(errorMsg);
              return;
            }

            processedPersonnelIds.push(matchingPersonnel.id);

            titleData.push({
              personnel_id: matchingPersonnel.id,
              loai: loai,
              mo_ta: mota,
              nam: namInt,
              cap_bac: capBac,
              chuc_vu: chucVu,
              ghi_chu: '',
            });
          });

          // Remove duplicates from personnel IDs
          const uniquePersonnelIds = Array.from(new Set(processedPersonnelIds));

          try {
            const batchResponse = await apiClient.checkDuplicateBatch(
              titleData.map(item => ({
                personnel_id: item.personnel_id,
                nam: item.nam,
                danh_hieu: item.danh_hieu,
                proposal_type: 'NCKH',
              }))
            );
            if (!batchResponse.success) throw new Error(batchResponse.message);
            const duplicateIds = new Set<string>();
            (batchResponse.data as any[]).forEach(result => {
              if (result.exists) {
                const hoTen = personnel.find(p => p.id === result.personnel_id)?.ho_ten || result.personnel_id;
                errors.push(`${hoTen}: ${result.message}`);
                duplicateIds.add(result.personnel_id);
              }
            });
            const filteredTitleData = duplicateIds.size > 0
              ? titleData.filter(item => !duplicateIds.has(item.personnel_id))
              : titleData;
            const filteredPersonnelIds = duplicateIds.size > 0
              ? uniquePersonnelIds.filter(id => !duplicateIds.has(id))
              : uniquePersonnelIds;
            resolve({
              imported: filteredTitleData.length,
              total: dataRows.length,
              errors,
              selectedPersonnelIds: filteredPersonnelIds,
              titleData: filteredTitleData,
            });
          } catch (error: unknown) {
            reject(new Error(`Lỗi kiểm tra trùng lặp: ${getApiErrorMessage(error)}`));
          }
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
    if (result.selectedPersonnelIds && result.selectedPersonnelIds.length > 0) {
      onPersonnelChange(result.selectedPersonnelIds);

      // Populate titleData from imported data
      if (result.titleData && result.titleData.length > 0) {
        // Transform to titleData format
        const titleData = result.titleData.map((achievement: any) => ({
          personnel_id: String(
            achievement.quan_nhan_id ??
              achievement.personnel_id ??
              achievement.co_quan_don_vi_id ??
              achievement.don_vi_truc_thuoc_id ??
              '' // fallback if all ID fields are null/undefined
          ),
          loai: achievement.loai,
          mo_ta: achievement.mo_ta,
          nam: achievement.nam,
          cap_bac: achievement.cap_bac,
          chuc_vu: achievement.chuc_vu,
          ghi_chu: achievement.ghi_chu,
        }));

        onTitleDataChange?.(titleData);

        // Update nam from imported data if available
        if (result.titleData[0].nam) {
          onNamChange(result.titleData[0].nam);
        }
      }
    }

    // Advance to Step 3 (Review) so the user can verify before confirming
    if (onNextStep) {
      setTimeout(() => {
        onNextStep();
      }, 500);
    }
  };

  const rowSelection = {
    selectedRowKeys: selectedPersonnelIds,
    onChange: (selectedRowKeys: React.Key[]) => {
      onPersonnelChange(selectedRowKeys as string[]);
    },
  };

  return (
    <div>
      <Alert
        message="Bước 2: Chọn quân nhân - ĐTKH/SKKH"
        description={
          <div>
            <p>1. Nhập năm đề xuất khen thưởng</p>
            <p>2. Chọn các quân nhân có thành tích ĐTKH/SKKH từ danh sách dưới đây</p>
            <p>
              3. Sau khi chọn xong, nhấn &quot;Tiếp tục&quot; để sang bước nhập thông tin chi tiết
            </p>
          </div>
        }
        type="info"
        showIcon
        icon={<TeamOutlined />}
        style={{ marginBottom: 24 }}
      />

      {/* Upload Excel Section */}
      {!isManager && (
        <>
          <ExcelImportSection
            awardType="NCKH"
            downloadTemplate={apiClient.getScientificAchievementsTemplate}
            importFile={apiClient.importScientificAchievements}
            templateFileName="mau_import_thanh_tich_khoa_hoc"
            onImportSuccess={handleImportSuccess}
            selectedPersonnelIds={selectedPersonnelIds}
            selectedNames={selectedPersonnelIds.map(id => personnel.find(p => p.id === id)?.ho_ten || '')}
            entityLabel="quân nhân"
            localProcessing={true}
            onLocalProcess={handleLocalExcelProcess}
            previewImport={apiClient.previewScientificAchievementsImport}
            reviewPath="/admin/awards/bulk/import-review-nckh"
            sessionStorageKey="importPreviewDataNCKH"
          />

        </>
      )}

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
            onBlur={() => {
              const currentValue = localNam;
              let finalValue: number;
              if (currentValue === null || currentValue === undefined || currentValue < 1900) {
                finalValue = CURRENT_YEAR;
              } else if (currentValue > CURRENT_YEAR) {
                finalValue = CURRENT_YEAR;
              } else {
                finalValue = currentValue;
              }
              setLocalNam(finalValue);
              onNamChange(finalValue);
            }}
            style={{ width: 150 }}
            size="large"
            min={1900}
            max={CURRENT_YEAR}
            placeholder="Nhập năm"
            controls={true}
            step={1}
            precision={0}
            keyboard={true}
          />
        </div>

        <Input
          placeholder="Tìm theo tên"
          prefix={<SearchOutlined />}
          value={searchText}
          onChange={e => setSearchText(e.target.value)}
          style={{ width: 300 }}
          size="large"
          allowClear
        />

        <Select
          placeholder="Lọc theo đơn vị"
          value={unitFilter}
          onChange={value => setUnitFilter(value || 'ALL')}
          style={{ width: 250 }}
          size="large"
          allowClear
        >
          <Select.Option value="ALL">Tất cả đơn vị</Select.Option>
          {units.map(unit => {
            const [id, name] = unit.split('|');
            return (
              <Select.Option key={id} value={unit}>
                {name}
              </Select.Option>
            );
          })}
        </Select>
      </Space>

      <div style={{ marginBottom: 16 }}>
        <Text type="secondary">
          Tổng số quân nhân: <strong>{filteredPersonnel.length}</strong> | Đã chọn:{' '}
          <strong style={{ color: '#1890ff' }}>{selectedPersonnelIds.length}</strong>
        </Text>
      </div>

      <Table
        columns={columns}
        dataSource={filteredPersonnel}
        rowKey="id"
        rowSelection={rowSelection}
        loading={loading}
        pagination={{
          ...DEFAULT_ANTD_TABLE_PAGINATION,
          showTotal: total => `Tổng số ${total} quân nhân`,
        }}
        bordered
        scroll={{ x: 'max-content' }}
        locale={{
          emptyText: <Empty description="Không có dữ liệu quân nhân" />,
        }}
      />
    </div>
  );
}
