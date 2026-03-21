'use client';

import { useState, useEffect } from 'react';
import {
  Table,
  Input,
  Select,
  Space,
  Alert,
  Typography,
  InputNumber,
  message,
  Tag,
  Divider,
} from 'antd';
import { SearchOutlined, TrophyOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import axiosInstance from '@/utils/axiosInstance';
import { formatDate } from '@/lib/utils';
import { apiClient } from '@/lib/api-client';
import ExcelImportSection from './ExcelImportSection';
import * as XLSX from 'xlsx';

const { Text } = Typography;

interface Personnel {
  id: string;
  ho_ten: string;
  cccd: string;
  ngay_sinh?: string | null;
  gioi_tinh?: string | null;
  co_quan_don_vi_id: string;
  don_vi_truc_thuoc_id: string;
  chuc_vu_id: string;
  cap_bac?: string;
  ngay_nhap_ngu?: string | Date | null;
  ngay_xuat_ngu?: string | Date | null;
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

interface Step2SelectPersonnelKNCVSNXDProps {
  selectedPersonnelIds: string[];
  onPersonnelChange: (ids: string[]) => void;
  nam: number;
  onNamChange: (nam: number) => void;
  onTitleDataChange?: (titleData: any[]) => void;
  onNextStep?: () => void;
}

export default function Step2SelectPersonnelKNCVSNXD({
  selectedPersonnelIds,
  onPersonnelChange,
  nam,
  onNamChange,
  onTitleDataChange,
  onNextStep,
}: Step2SelectPersonnelKNCVSNXDProps) {
  const [loading, setLoading] = useState(false);
  const [personnel, setPersonnel] = useState<Personnel[]>([]);
  const [searchText, setSearchText] = useState('');
  const [unitFilter, setUnitFilter] = useState<string>('ALL');
  const [localNam, setLocalNam] = useState<number | null>(nam);
  const [alreadyReceivedMap, setAlreadyReceivedMap] = useState<Record<string, boolean>>({});
  const [receivedReasonMap, setReceivedReasonMap] = useState<Record<string, string>>({});
  const [checkingReceived, setCheckingReceived] = useState(false);

  useEffect(() => {
    fetchPersonnel();
  }, []);

  // Đồng bộ localNam với nam từ props
  useEffect(() => {
    setLocalNam(nam);
  }, [nam]);

  // Kiểm tra quân nhân đã nhận KNC VSNXD chưa
  useEffect(() => {
    if (personnel.length > 0) {
      checkAlreadyReceived();
    }
  }, [personnel]);

  const checkAlreadyReceived = async () => {
    try {
      setCheckingReceived(true);
      const receivedMap: Record<string, boolean> = {};
      const reasonMap: Record<string, string> = {};

      await Promise.all(
        personnel.map(async p => {
          try {
            const response = await axiosInstance.get(`/api/annual-rewards/check-knc-vsnxd/${p.id}`);
            if (response.data.success) {
              receivedMap[p.id] = response.data.data.alreadyReceived;
              if (response.data.data.alreadyReceived && response.data.data.reason) {
                reasonMap[p.id] = response.data.data.reason;
              }
            }
          } catch (error) {
            // Error handled silently per-item
            receivedMap[p.id] = false;
          }
        })
      );

      setAlreadyReceivedMap(receivedMap);
      setReceivedReasonMap(reasonMap);
    } catch (error) {
      // Error handled by UI
    } finally {
      setCheckingReceived(false);
    }
  };

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
        if (personnelData.length === 0) {
          message.warning('Không có quân nhân nào trong đơn vị của bạn.');
        }
      } else {
        message.error(response.data.message || 'Không thể lấy danh sách quân nhân');
      }
    } catch (error: any) {
      // Error handled by UI
      message.error(
        error?.response?.data?.message || error?.message || 'Lỗi khi tải danh sách quân nhân'
      );
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

    let matchesUnit = true;
    if (unitFilter && unitFilter !== 'ALL') {
      const unitId = unitFilter.split('|')[0];
      matchesUnit = p.don_vi_truc_thuoc_id === unitId || p.co_quan_don_vi_id === unitId;
    }

    return matchesSearch && matchesUnit;
  });

  const calculateTotalMonths = (
    ngayNhapNgu: string | Date | null | undefined,
    ngayXuatNgu: string | Date | null | undefined
  ) => {
    if (!ngayNhapNgu) return null;

    try {
      const startDate = typeof ngayNhapNgu === 'string' ? new Date(ngayNhapNgu) : ngayNhapNgu;
      const endDate = ngayXuatNgu
        ? typeof ngayXuatNgu === 'string'
          ? new Date(ngayXuatNgu)
          : ngayXuatNgu
        : new Date();

      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        return null;
      }

      let years = endDate.getFullYear() - startDate.getFullYear();
      let months = endDate.getMonth() - startDate.getMonth();
      let days = endDate.getDate() - startDate.getDate();

      if (days < 0) {
        months -= 1;
        const lastDayOfPrevMonth = new Date(endDate.getFullYear(), endDate.getMonth(), 0).getDate();
        days += lastDayOfPrevMonth;
      }

      if (months < 0) {
        years -= 1;
        months += 12;
      }

      const totalMonths = years * 12 + months;
      const totalYears = Math.floor(totalMonths / 12);
      const remainingMonths = totalMonths % 12;

      return {
        years: totalYears,
        months: remainingMonths,
        totalMonths: totalMonths,
      };
    } catch {
      return null;
    }
  };

  // Kiểm tra quân nhân có đủ điều kiện đề xuất KNC_VSNXD_QDNDVN không
  const checkEligibleForKNCVSNXD = (record: Personnel): { eligible: boolean; reason?: string } => {
    // Kiểm tra đã nhận chưa
    if (alreadyReceivedMap[record.id]) {
      return { eligible: false, reason: 'Đã nhận' };
    }

    // Kiểm tra giới tính
    if (!record.gioi_tinh || (record.gioi_tinh !== 'NAM' && record.gioi_tinh !== 'NU')) {
      return { eligible: false, reason: 'Chưa cập nhật giới tính' };
    }

    // Kiểm tra ngày nhập ngũ
    if (!record.ngay_nhap_ngu) {
      return { eligible: false, reason: 'Chưa cập nhật ngày nhập ngũ' };
    }

    // Tính số năm phục vụ
    const result = calculateTotalMonths(record.ngay_nhap_ngu, record.ngay_xuat_ngu);
    if (!result || result.years === 0) {
      return { eligible: false, reason: 'Chưa đủ thời gian phục vụ' };
    }

    // Yêu cầu: nữ >= 20 năm, nam >= 25 năm
    const requiredYears = record.gioi_tinh === 'NU' ? 20 : 25;
    if (result.years < requiredYears) {
      return {
        eligible: false,
        reason: `Chưa đủ ${requiredYears} năm phục vụ (hiện tại: ${result.years} năm)`,
      };
    }

    return { eligible: true };
  };

  // Hàm lấy priority sắp xếp: 0=đủ điều kiện, 1=đang chờ duyệt, 2=đã nhận, 3=không đủ điều kiện
  const getSortPriority = (record: Personnel): number => {
    const alreadyReceived = alreadyReceivedMap[record.id];
    const reason = receivedReasonMap[record.id] || '';

    if (alreadyReceived) {
      // Phân biệt đang chờ duyệt và đã nhận dựa vào reason
      if (reason.includes('chờ duyệt') || reason.includes('Đang chờ')) return 1; // Đang chờ duyệt
      return 2; // Đã nhận
    }

    const eligibility = checkEligibleForKNCVSNXD(record);
    if (eligibility.eligible) return 0; // Đủ điều kiện

    return 3; // Không đủ điều kiện
  };

  // Sắp xếp: đủ điều kiện → đang chờ duyệt → đã nhận → không đủ điều kiện
  const sortedPersonnel = [...filteredPersonnel].sort((a, b) => {
    return getSortPriority(a) - getSortPriority(b);
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
    {
      title: 'Giới tính',
      key: 'gioi_tinh',
      width: 120,
      align: 'center',
      render: (_, record) => {
        if (!record.gioi_tinh) {
          return <Text type="danger">Chưa cập nhật</Text>;
        }
        return <Text>{record.gioi_tinh === 'NAM' ? 'Nam' : 'Nữ'}</Text>;
      },
    },
    {
      title: 'Ngày nhập ngũ',
      key: 'ngay_nhap_ngu',
      width: 150,
      align: 'center',
      render: (_, record) => {
        if (!record.ngay_nhap_ngu) return <Text type="secondary">-</Text>;
        return formatDate(record.ngay_nhap_ngu);
      },
    },
    {
      title: 'Ngày xuất ngũ',
      key: 'ngay_xuat_ngu',
      width: 150,
      align: 'center',
      render: (_, record) => {
        if (!record.ngay_xuat_ngu) return <Text type="secondary">Chưa xuất ngũ</Text>;
        return formatDate(record.ngay_xuat_ngu);
      },
    },
    {
      title: 'Tổng tháng',
      key: 'tong_thang',
      width: 150,
      align: 'center',
      render: (_, record) => {
        const result = calculateTotalMonths(record.ngay_nhap_ngu, record.ngay_xuat_ngu);
        if (!result) return <Text type="secondary">-</Text>;

        if (result.years > 0 && result.months > 0) {
          return (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <Text strong>{result.years} năm</Text>
              <Text type="secondary" style={{ fontSize: '12px', lineHeight: '1.2' }}>
                {result.months} tháng
              </Text>
            </div>
          );
        } else if (result.years > 0) {
          return <Text strong>{result.years} năm</Text>;
        } else if (result.totalMonths > 0) {
          return <Text strong>{result.totalMonths} tháng</Text>;
        } else {
          return <Text type="secondary">0 tháng</Text>;
        }
      },
    },
    {
      title: 'Đủ điều kiện',
      key: 'du_dieu_kien',
      width: 200,
      align: 'center',
      render: (_, record) => {
        if (alreadyReceivedMap[record.id]) {
          const reason = receivedReasonMap[record.id] || 'Đã nhận';
          return (
            <Tag color="red" style={{ fontSize: '13px', padding: '4px 12px' }}>
              {reason}
            </Tag>
          );
        }

        const eligibility = checkEligibleForKNCVSNXD(record);
        if (eligibility.eligible) {
          return (
            <Text type="success" strong>
              ✓ Đủ điều kiện
            </Text>
          );
        } else {
          return (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <Text type="danger" strong>
                ✗ Không đủ
              </Text>
              <Text type="secondary" style={{ fontSize: '11px', textAlign: 'center' }}>
                {eligibility.reason}
              </Text>
            </div>
          );
        }
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

            if (!hoTen) {
              errors.push(`Dòng ${rowNumber}: Thiếu họ tên`);
              return;
            }

            if (!nam) {
              errors.push(`Dòng ${rowNumber}: Thiếu năm`);
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
                const personnelBirth = p.ngay_sinh ? formatDate(p.ngay_sinh) : '';
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
              danh_hieu: 'KNC_VSNXD_QDNDVN',
              nam: namInt,
              cap_bac: capBac,
              chuc_vu: chucVu,
              ghi_chu: '', // Không có ghi chú trong Excel
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
                  proposal_type: 'KNC_VSNXD_QDNDVN',
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

  const handleImportSuccess = async (result: any) => {
    // Cập nhật danh sách quân nhân đã chọn
    if (result.selectedPersonnelIds && result.selectedPersonnelIds.length > 0) {
      onPersonnelChange(result.selectedPersonnelIds);

      // Populate titleData from imported data
      if (result.titleData && result.titleData.length > 0) {
        // Transform to titleData format
        const titleData = result.titleData.map((award: any) => ({
          personnel_id: String(
            award.quan_nhan_id ??
              award.personnel_id ??
              award.co_quan_don_vi_id ??
              award.don_vi_truc_thuoc_id ??
              '' // fallback nếu tất cả đều null/undefined
          ),
          danh_hieu: 'KNC_VSNXD_QDNDVN',
          nam: award.nam,
          cap_bac: award.cap_bac,
          chuc_vu: award.chuc_vu,
          ghi_chu: award.ghi_chu,
        }));

        onTitleDataChange?.(titleData);

        // Update nam from imported data if available
        if (result.titleData[0].nam) {
          onNamChange(result.titleData[0].nam);
        }
      }
    }

    // Chuyển sang bước 3 (Review) để xem trước dữ liệu trước khi xác nhận
    if (onNextStep) {
      setTimeout(() => {
        onNextStep(); // Chuyển sang bước 3 — dừng lại ở đây để review
      }, 500);
    }
  };

  const rowSelection = {
    selectedRowKeys: selectedPersonnelIds,
    onChange: (selectedRowKeys: React.Key[]) => {
      onPersonnelChange(selectedRowKeys as string[]);
    },
    getCheckboxProps: (record: Personnel) => {
      // Disable all checkboxes while checking eligibility
      if (checkingReceived) {
        return {
          disabled: true,
          title: 'Đang kiểm tra tính đủ điều kiện, vui lòng chờ...',
        };
      }

      const eligibility = checkEligibleForKNCVSNXD(record);
      const isDisabled = !eligibility.eligible;

      return {
        disabled: isDisabled,
        title: isDisabled ? eligibility.reason || 'Không đủ điều kiện đề xuất' : '',
      };
    },
    onSelect: (record: Personnel, selected: boolean) => {
      if (selected) {
        const eligibility = checkEligibleForKNCVSNXD(record);
        if (!eligibility.eligible) {
          message.warning(
            `Quân nhân ${record.ho_ten} không đủ điều kiện: ${
              eligibility.reason || 'Không đủ điều kiện đề xuất'
            }.`
          );
          return false;
        }
      }
    },
  };

  return (
    <div>
      <Alert
        message="Bước 2: Chọn quân nhân - Kỷ niệm chương VSNXD QĐNDVN"
        description={
          <div>
            <p>1. Nhập năm đề xuất khen thưởng</p>
            <p>2. Chọn các quân nhân cần đề xuất khen thưởng từ danh sách dưới đây</p>
            <p>
              3. Bảng hiển thị thông tin ngày nhập ngũ, xuất ngũ và tổng tháng để hỗ trợ lựa chọn
            </p>
            <p>4. Sau khi chọn xong, nhấn &quot;Tiếp tục&quot; để sang bước chọn danh hiệu</p>
          </div>
        }
        type="info"
        showIcon
        icon={<TrophyOutlined />}
        style={{ marginBottom: 24 }}
      />

      {/* Upload Excel Section */}
      <ExcelImportSection
        awardType="KNC_VSNXD_QDNDVN"
        templateEndpoint="/api/commemorative-medals/template"
        importEndpoint="/api/commemorative-medals/import"
        templateFileName="mau_import_knc_vsnxd"
        onImportSuccess={handleImportSuccess}
        selectedCount={selectedPersonnelIds.length}
        selectedPersonnelIds={selectedPersonnelIds}
        entityLabel="quân nhân"
        localProcessing={true}
        onLocalProcess={handleLocalExcelProcess}
        previewEndpoint="/api/commemorative-medals/import/preview"
        reviewPath="/admin/awards/bulk/import-review-kncvsnxd"
        sessionStorageKey="importPreviewDataKNCVSNXD"
      />

      <Divider>Hoặc chọn thủ công</Divider>

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

      {/* Cảnh báo về quân nhân không đủ điều kiện */}
      {(() => {
        const ineligiblePersonnel = filteredPersonnel.filter(
          p => !checkEligibleForKNCVSNXD(p).eligible
        );
        const ineligibleCount = ineligiblePersonnel.length;

        if (ineligibleCount > 0) {
          return (
            <Alert
              message="Cảnh báo"
              description={`Có ${ineligibleCount} quân nhân không đủ điều kiện đề xuất (yêu cầu: Nữ >= 20 năm, Nam >= 25 năm phục vụ). Vui lòng kiểm tra và cập nhật thông tin trước khi đề xuất.`}
              type="warning"
              showIcon
              style={{ marginBottom: 16 }}
            />
          );
        }
        return null;
      })()}

      <Table
        columns={columns}
        dataSource={sortedPersonnel}
        rowKey="id"
        rowSelection={rowSelection}
        loading={loading || checkingReceived}
        rowClassName={record => {
          // Tô màu dòng quân nhân không đủ điều kiện
          const eligibility = checkEligibleForKNCVSNXD(record);
          if (!eligibility.eligible) {
            return 'row-ineligible';
          }
          return '';
        }}
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
