'use client';

import { useState, useEffect } from 'react';
import { Table, Input, Select, Space, Alert, Typography, InputNumber, Divider } from 'antd';
import { SearchOutlined, TeamOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import axiosInstance from '@/utils/axiosInstance';
import { formatDate } from '@/lib/utils';
import ExcelImportSection from './ExcelImportSection';
import * as XLSX from 'xlsx';

const { Text } = Typography;

interface Personnel {
  id: string;
  ho_ten: string;
  cccd: string;
  ngay_sinh?: string | null;
  cap_bac?: string;
  co_quan_don_vi_id: string;
  don_vi_truc_thuoc_id: string;
  chuc_vu_id: string;
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

interface Step2SelectPersonnelCaNhanHangNamProps {
  selectedPersonnelIds: string[];
  onPersonnelChange: (ids: string[]) => void;
  nam: number;
  onNamChange: (nam: number) => void;
  titleData?: any[];
  onTitleDataChange?: (data: any[]) => void;
  onNextStep?: () => void;
}

export default function Step2SelectPersonnelCaNhanHangNam({
  selectedPersonnelIds,
  onPersonnelChange,
  nam,
  onNamChange,
  titleData,
  onTitleDataChange,
  onNextStep,
}: Step2SelectPersonnelCaNhanHangNamProps) {
  const [loading, setLoading] = useState(false);
  const [personnel, setPersonnel] = useState<Personnel[]>([]);
  const [searchText, setSearchText] = useState('');
  const [unitFilter, setUnitFilter] = useState<string>('ALL');
  const [localNam, setLocalNam] = useState<number | null>(nam);

  useEffect(() => {
    fetchPersonnel();
  }, []);

  // Đồng bộ localNam với nam từ props
  useEffect(() => {
    setLocalNam(nam);
  }, [nam]);

  const fetchPersonnel = async () => {
    try {
      setLoading(true);
      const response = await axiosInstance.get('/api/personnel', {
        params: {
          page: 1,
          limit: 1000,
        },
      });

      if (response.data.success) {
        const personnelData = response.data.data?.personnel || response.data.data || [];
        setPersonnel(personnelData);
      }
    } catch (error: any) {
      console.error('Error fetching personnel:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLocalExcelProcess = async (file: File): Promise<any> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = async e => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });

          // Lấy sheet đầu tiên
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];

          // Chuyển đổi sang JSON
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

          if (jsonData.length < 2) {
            throw new Error('File Excel không có dữ liệu hoặc thiếu header');
          }

          // Bỏ qua header row
          const dataRows = jsonData.slice(1);

          const titleData: any[] = [];
          const errors: string[] = [];
          const processedPersonnelIds: string[] = [];

          dataRows.forEach((row: any, index: number) => {
            const rowNumber = index + 2; // +2 vì bỏ header và index từ 0

            // Validate required fields
            const hoTen = row[0]?.toString().trim();
            const ngaySinh = row[1]?.toString().trim();
            const nam = row[2]?.toString().trim();
            const capBac = row[3]?.toString().trim();
            const chucVu = row[4]?.toString().trim();
            const danhHieu = row[5]?.toString().trim();

            if (!hoTen) {
              errors.push(`Dòng ${rowNumber}: Thiếu họ tên`);
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

            // Validate năm
            const namInt = parseInt(nam);

            // Tìm personnel ID dựa trên họ tên và ngày sinh (ngày sinh optional)
            let matchingPersonnel;
            if (ngaySinh) {
              // Nếu có ngày sinh, so sánh cả tên và ngày sinh
              matchingPersonnel = personnel.find(p => {
                const personnelName = p.ho_ten.toLowerCase().trim();
                const excelName = hoTen.toLowerCase().trim();

                // So sánh tên chính xác
                const nameMatch = personnelName === excelName;

                // So sánh ngày sinh
                const personnelBirth = p.ngay_sinh
                  ? new Date(p.ngay_sinh).toLocaleDateString('vi-VN')
                  : '';
                const excelBirth = ngaySinh;

                return nameMatch && personnelBirth === excelBirth;
              });
            } else {
              // Nếu không có ngày sinh, chỉ so sánh tên và lấy kết quả đầu tiên
              matchingPersonnel = personnel.find(p => {
                const personnelName = p.ho_ten.toLowerCase().trim();
                const excelName = hoTen.toLowerCase().trim();

                // So sánh tên chính xác
                return personnelName === excelName;
              });
            }

            if (!matchingPersonnel) {
              const errorMsg = ngaySinh
                ? `Dòng ${rowNumber}: Không tìm thấy quân nhân "${hoTen}" sinh ngày ${ngaySinh}`
                : `Dòng ${rowNumber}: Không tìm thấy quân nhân "${hoTen}"`;
              errors.push(errorMsg);
              return;
            }

            // Thêm vào danh sách
            processedPersonnelIds.push(matchingPersonnel.id);

            titleData.push({
              personnel_id: matchingPersonnel.id,
              danh_hieu: danhHieu,
              nam: namInt,
              cap_bac: capBac,
              chuc_vu: chucVu,
            });
          });

          // Remove duplicates from personnel IDs
          const uniquePersonnelIds = Array.from(new Set(processedPersonnelIds));

          // Kiểm tra trùng lặp trước khi resolve
          try {
            for (const item of titleData) {
              const checkResponse = await axiosInstance.get('/api/proposals/check-duplicate', {
                params: {
                  personnel_id: item.personnel_id,
                  nam: item.nam,
                  danh_hieu: item.danh_hieu,
                  proposal_type: 'CA_NHAN_HANG_NAM',
                },
              });

              if (checkResponse.data.data.success === false) {
                throw new Error(checkResponse.data.data.message || 'Có lỗi khi kiểm tra trùng lặp');
              }

              if (checkResponse.data.data.exists === true) {
                throw new Error(
                  'Dữ liệu import có trùng lặp với đề xuất đã tồn tại. Vui lòng kiểm tra lại.'
                );
              }
            }
          } catch (error: any) {
            reject(new Error(`Lỗi kiểm tra trùng lặp: ${error.message}`));
            return;
          }

          resolve({
            imported: titleData.length,
            total: dataRows.length,
            errors,
            selectedPersonnelIds: uniquePersonnelIds,
            titleData,
          });
        } catch (error: any) {
          reject(new Error(`Lỗi xử lý file Excel: ${error.message}`));
        }
      };

      reader.onerror = () => {
        reject(new Error('Lỗi đọc file Excel'));
      };

      reader.readAsArrayBuffer(file);
    });
  };

  const handleImportSuccess = (result: any) => {
    // Cập nhật danh sách quân nhân đã chọn và dữ liệu danh hiệu
    if (result.selectedPersonnelIds && result.selectedPersonnelIds.length > 0) {
      onPersonnelChange(result.selectedPersonnelIds);
    }

    // Populate titleData from imported data
    if (result.titleData && result.titleData.length > 0 && onTitleDataChange) {
      // Transform to titleData format
      const titleData = result.titleData.map((award: any) => ({
        personnel_id: String(
          award.quan_nhan_id ??
            award.personnel_id ??
            award.co_quan_don_vi_id ??
            award.don_vi_truc_thuoc_id ??
            '' // fallback nếu tất cả đều null/undefined
        ),
        danh_hieu: award.danh_hieu,
        nam: award.nam,
        cap_bac: award.cap_bac,
        chuc_vu: award.chuc_vu,
        ghi_chu: award.ghi_chu,
      }));

      onTitleDataChange(titleData);

      // Update nam from imported data if available
      if (result.titleData[0].nam) {
        onNamChange(result.titleData[0].nam);
      }
    }

    // Tự động chuyển sang bước 4 (Upload file) sau khi Đã thêm thành công
    // Bỏ qua bước 3 vì đã import dữ liệu từ Excel
    if (onNextStep) {
      setTimeout(() => {
        onNextStep(); // Chuyển sang bước 3
        setTimeout(() => {
          onNextStep(); // Chuyển sang bước 4
        }, 100);
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

    let matchesUnit = true;
    if (unitFilter && unitFilter !== 'ALL') {
      const unitId = unitFilter.split('|')[0];
      matchesUnit = p.don_vi_truc_thuoc_id === unitId || p.co_quan_don_vi_id === unitId;
    }

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

        let donViDisplay: string | null = null;

        if (donViTrucThuoc?.ten_don_vi) {
          donViDisplay = coQuan?.ten_don_vi
            ? `${donViTrucThuoc.ten_don_vi} (${coQuan.ten_don_vi})`
            : donViTrucThuoc.ten_don_vi;
        } else if (coQuan?.ten_don_vi) {
          donViDisplay = coQuan.ten_don_vi;
        }

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
      {/* <ExcelImportSection
        templateEndpoint="/api/annual-rewards/template"
        importEndpoint="/api/annual-rewards/import"
        templateFileName="mau_import_ca_nhan_hang_nam"
        onImportSuccess={handleImportSuccess}
        selectedCount={selectedPersonnelIds.length}
        entityLabel="quân nhân"
        localProcessing={true}
        onLocalProcess={handleLocalExcelProcess}
      />

      <Divider>Hoặc chọn thủ công</Divider> */}

      <Space style={{ marginBottom: 16 }} size="middle">
        <div>
          <Text strong>Năm đề xuất: </Text>
          <InputNumber
            value={localNam}
            onChange={value => {
              // Cho phép null/undefined để người dùng có thể xóa và nhập lại
              if (value === null || value === undefined) {
                setLocalNam(null);
                return;
              }

              const intValue = Math.floor(Number(value));

              // Nếu giá trị hợp lệ, cập nhật local state
              if (!isNaN(intValue)) {
                // Cho phép nhập bất kỳ số nào trong quá trình nhập (kể cả < 1900)
                // Chỉ giới hạn khi blur
                setLocalNam(intValue);
              }
            }}
            onBlur={e => {
              // Khi blur, đảm bảo giá trị trong khoảng hợp lệ và cập nhật lên parent
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
                // Giá trị hợp lệ, cập nhật lên parent
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
          pageSize: 20,
          showSizeChanger: true,
          showTotal: total => `Tổng số ${total} quân nhân`,
        }}
        bordered
        locale={{
          emptyText: 'Không có dữ liệu quân nhân',
        }}
      />
    </div>
  );
}
