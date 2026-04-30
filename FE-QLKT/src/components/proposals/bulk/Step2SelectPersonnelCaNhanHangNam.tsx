'use client';

import { useState, useEffect } from 'react';
import { Table, Input, Select, Space, Typography, InputNumber, Empty, message } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { apiClient } from '@/lib/apiClient';
import { DEFAULT_ANTD_TABLE_PAGINATION, FETCH_ALL_LIMIT } from '@/constants/pagination.constants';
import { getApiErrorMessage } from '@/lib/apiError';
import { formatDate } from '@/lib/utils';
import { ExcelImportSection } from './ExcelImportSection';
import * as XLSX from 'xlsx';
import { DANH_HIEU_CA_NHAN_HANG_NAM } from '@/constants/danhHieu.constants';
import type {
  ExcelRow,
  Step2ImportSuccessResult,
  Step2ImportedAward,
  Step2LocalImportResult,
  Step2Personnel as Personnel,
} from './types';
import type { TitleDataItem } from '@/lib/types/proposal';

const { Text } = Typography;

interface Step2SelectPersonnelCaNhanHangNamProps {
  selectedPersonnelIds: string[];
  onPersonnelChange: (ids: string[]) => void;
  nam: number;
  onNamChange: (nam: number) => void;
  titleData?: TitleDataItem[];
  onTitleDataChange?: (data: TitleDataItem[]) => void;
  onNextStep?: () => void;
  isManager?: boolean;
}

export function Step2SelectPersonnelCaNhanHangNam({
  selectedPersonnelIds,
  onPersonnelChange,
  nam,
  onNamChange,
  onTitleDataChange,
  onNextStep,
  isManager = false,
}: Step2SelectPersonnelCaNhanHangNamProps) {
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

  const handleLocalExcelProcess = async (
    file: File
  ): Promise<Step2LocalImportResult<TitleDataItem>> => {
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

          const dataRows = jsonData.slice(1) as ExcelRow[];
          const titleData: TitleDataItem[] = [];
          const errors: string[] = [];
          const processedPersonnelIds: string[] = [];

          // Column order from template: STT(0), ID(1), Name(2), Rank(3), Position(4), Year(5), Title(6),
          // BKBQP(7), CSTDTQ(8), BKTTCP(9), Decision no. title(10), Decision no. BKBQP(11), Decision no. CSTDTQ(12), Decision no. BKTTCP(13), Note(14)
          const seenKeys = new Set<string>();

          dataRows.forEach((row: ExcelRow, index: number) => {
            const rowNumber = index + 2;

            const personnelId = row[1]?.toString().trim();
            const hoTen = row[2]?.toString().trim() || '';
            const nam = row[5]?.toString().trim();
            const danhHieu = row[6]?.toString().trim();
            const nhanBkbqp = row[7]?.toString().trim();
            const nhanCstdtq = row[8]?.toString().trim();
            const nhanBkttcp = row[9]?.toString().trim();
            const soQuyetDinh = row[10]?.toString().trim() || '';
            const soQdBkbqp = row[11]?.toString().trim() || '';
            const soQdCstdtq = row[12]?.toString().trim() || '';
            const soQdBkttcp = row[13]?.toString().trim() || '';
            const ghiChu = row[14]?.toString().trim() || '';

            if (!personnelId && !nam && !danhHieu) return; // skip blank/comment rows

            if (!personnelId) {
              errors.push(`Dòng ${rowNumber}: Thiếu ID quân nhân`);
              return;
            }

            if (!nam) {
              errors.push(`Dòng ${rowNumber} (${hoTen}): Thiếu năm`);
              return;
            }

            if (!danhHieu) {
              errors.push(`Dòng ${rowNumber} (${hoTen}): Thiếu danh hiệu`);
              return;
            }

            const namInt = parseInt(nam);
            if (isNaN(namInt) || namInt < 1900 || namInt > new Date().getFullYear()) {
              errors.push(`Dòng ${rowNumber} (${hoTen}): Năm không hợp lệ: ${nam}`);
              return;
            }

            const validDanhHieu: string[] = [
              DANH_HIEU_CA_NHAN_HANG_NAM.CSTT,
              DANH_HIEU_CA_NHAN_HANG_NAM.CSTDCS,
            ];
            if (!validDanhHieu.includes(danhHieu.toUpperCase())) {
              errors.push(
                `Dòng ${rowNumber} (${hoTen}): Danh hiệu không hợp lệ: ${danhHieu}. Chỉ chấp nhận: ${validDanhHieu.join(', ')}`
              );
              return;
            }

            const matchingPersonnel = personnel.find(p => p.id === personnelId);
            if (!matchingPersonnel) {
              errors.push(
                `Dòng ${rowNumber}: Không tìm thấy quân nhân ID "${personnelId}" (${hoTen}) trong danh sách`
              );
              return;
            }

            // Reject duplicate rows within the same file (same person + year + title)
            const key = `${personnelId}_${namInt}_${danhHieu}`;
            if (seenKeys.has(key)) {
              errors.push(
                `Dòng ${rowNumber} (${hoTen}): Trùng lặp — cùng quân nhân, năm ${namInt}, danh hiệu ${danhHieu}`
              );
              return;
            }
            seenKeys.add(key);

            const parseBool = (val: string | undefined) =>
              ['có', 'co', 'true', '1', 'x'].includes((val || '').toLowerCase());

            processedPersonnelIds.push(matchingPersonnel.id);
            titleData.push({
              personnel_id: matchingPersonnel.id,
              danh_hieu: danhHieu.toUpperCase(),
              nam: namInt,
              cap_bac: row[3]?.toString().trim() || matchingPersonnel.cap_bac || '',
              chuc_vu: row[4]?.toString().trim() || matchingPersonnel.ChucVu?.ten_chuc_vu || '',
              nhan_bkbqp: parseBool(nhanBkbqp),
              nhan_cstdtq: parseBool(nhanCstdtq),
              nhan_bkttcp: parseBool(nhanBkttcp),
              so_quyet_dinh: soQuyetDinh,
              so_quyet_dinh_bkbqp: soQdBkbqp,
              so_quyet_dinh_cstdtq: soQdCstdtq,
              so_quyet_dinh_bkttcp: soQdBkttcp,
              ghi_chu: ghiChu,
            });
          });

          const uniquePersonnelIds = Array.from(new Set(processedPersonnelIds));

          resolve({
            imported: titleData.length,
            total: dataRows.filter(r => r[1] || r[5] || r[6]).length,
            errors,
            selectedPersonnelIds: uniquePersonnelIds,
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

  const handleImportSuccess = (result: Step2ImportSuccessResult) => {
    if (result.selectedPersonnelIds && result.selectedPersonnelIds.length > 0) {
      onPersonnelChange(result.selectedPersonnelIds);
    }

    // Populate titleData from imported data
    if (result.titleData && result.titleData.length > 0 && onTitleDataChange) {
      // Transform to titleData format
      const titleData: TitleDataItem[] = result.titleData.map(
        (award: Step2ImportedAward) => ({
          personnel_id: String(
            award.quan_nhan_id ??
              award.personnel_id ??
              award.co_quan_don_vi_id ??
              award.don_vi_truc_thuoc_id ??
              '' // fallback if all ID fields are null/undefined
          ),
          danh_hieu: award.danh_hieu,
          nam: award.nam,
          cap_bac: award.cap_bac,
          chuc_vu: award.chuc_vu,
          ghi_chu: award.ghi_chu,
        })
      );

      onTitleDataChange(titleData);

      // Update nam from imported data if available
      if (result.titleData[0]?.nam) {
        onNamChange(result.titleData[0].nam);
      }
    }

    // Advance to Step 3 (Review) so the user can verify before confirming
    if (onNextStep) {
      setTimeout(() => {
        onNextStep();
      }, 500);
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
      render: (date: string) => (date ? formatDate(date) : '-'),
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

  const rowSelection = {
    selectedRowKeys: selectedPersonnelIds,
    onChange: (selectedRowKeys: React.Key[]) => {
      onPersonnelChange(selectedRowKeys as string[]);
    },
  };

  return (
    <div>
      {/* Upload Excel Section */}
      {!isManager && (
        <>
          <ExcelImportSection
            awardType="CA_NHAN_HANG_NAM"
            downloadTemplate={apiClient.getAnnualRewardsTemplate}
            importFile={apiClient.importAnnualRewards}
            templateFileName="mau_import_ca_nhan_hang_nam"
            onImportSuccess={handleImportSuccess}
            selectedPersonnelIds={selectedPersonnelIds}
            selectedNames={selectedPersonnelIds.map(id => personnel.find(p => p.id === id)?.ho_ten || '')}
            entityLabel="quân nhân"
            localProcessing={true}
            onLocalProcess={handleLocalExcelProcess}
            previewImport={apiClient.previewAnnualRewardsImport}
            reviewPath="/admin/awards/bulk/import-review"
            sessionStorageKey="importPreviewDataCNHN"
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
          <strong className="text-blue-500 dark:text-blue-400">{selectedPersonnelIds.length}</strong>
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
