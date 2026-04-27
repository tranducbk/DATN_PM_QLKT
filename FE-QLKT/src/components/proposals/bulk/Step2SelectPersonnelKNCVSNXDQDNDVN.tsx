'use client';

import { useState, useEffect, useCallback } from 'react';
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
  Empty,
} from 'antd';
import { SearchOutlined, TrophyOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { formatDate } from '@/lib/utils';
import { apiClient } from '@/lib/apiClient';
import { calculateTotalMonths } from './serviceDuration';
import type { Step2Personnel as Personnel } from './types';
import { DEFAULT_ANTD_TABLE_PAGINATION, FETCH_ALL_LIMIT } from '@/constants/pagination.constants';
import { getApiErrorMessage } from '@/lib/apiError';
import { ExcelImportSection } from './ExcelImportSection';
import {
  DANH_HIEU_DAC_BIET,
  DANH_HIEU_MAP,
  KNC_YEARS_REQUIRED_NAM,
  KNC_YEARS_REQUIRED_NU,
} from '@/constants/danhHieu.constants';
import { PROPOSAL_TYPES } from '@/constants/proposal.constants';
import { GENDER } from '@/constants/gender.constants';
import * as XLSX from 'xlsx';
import type {
  DuplicateCheckResult,
  ExcelRow,
  Step2ImportSuccessResult,
  Step2ImportedAward,
  Step2LocalImportResult,
} from './types';
import type { TitleDataItem } from '@/lib/types/proposal';

const { Text } = Typography;

interface Step2SelectPersonnelKNCVSNXDQDNDVNProps {
  selectedPersonnelIds: string[];
  onPersonnelChange: (ids: string[]) => void;
  nam: number;
  onNamChange: (nam: number) => void;
  thang: number;
  onThangChange?: (thang: number) => void;
  onTitleDataChange?: (titleData: TitleDataItem[]) => void;
  onNextStep?: () => void;
  isManager?: boolean;
}

export function Step2SelectPersonnelKNCVSNXDQDNDVN({
  selectedPersonnelIds,
  onPersonnelChange,
  nam,
  onNamChange,
  thang,
  onThangChange,
  onTitleDataChange,
  onNextStep,
  isManager = false,
}: Step2SelectPersonnelKNCVSNXDQDNDVNProps) {
  const [loading, setLoading] = useState(false);
  const [personnel, setPersonnel] = useState<Personnel[]>([]);
  const [searchText, setSearchText] = useState('');
  const [unitFilter, setUnitFilter] = useState<string>('ALL');
  const NOW = new Date();
  const CURRENT_YEAR = NOW.getFullYear();
  const CURRENT_MONTH = NOW.getMonth() + 1;
  const [localNam, setLocalNam] = useState<number | null>(nam);
  const [localThang, setLocalThang] = useState<number>(thang);
  const [alreadyReceivedMap, setAlreadyReceivedMap] = useState<Record<string, boolean>>({});
  const [receivedReasonMap, setReceivedReasonMap] = useState<Record<string, string>>({});
  const [checkingReceived, setCheckingReceived] = useState(false);

  useEffect(() => {
    fetchPersonnel();
  }, []);

  useEffect(() => {
    setLocalNam(nam);
  }, [nam]);

  useEffect(() => {
    setLocalThang(thang);
  }, [thang]);

  const checkAlreadyReceived = useCallback(async () => {
    try {
      setCheckingReceived(true);
      const receivedMap: Record<string, boolean> = {};
      const reasonMap: Record<string, string> = {};

      await Promise.all(
        personnel.map(async p => {
          try {
            const response = await apiClient.checkKNCVSNXDQDNDVN(p.id);
            if (response.success) {
              receivedMap[p.id] = response.data.alreadyReceived;
              if (response.data.alreadyReceived) {
                const yearReceived = response.data.award?.nam;
                reasonMap[p.id] = yearReceived
                  ? `Đã nhận (${yearReceived})`
                  : (response.data.reason || 'Đã nhận');
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
      message.error(getApiErrorMessage(error));
    } finally {
      setCheckingReceived(false);
    }
  }, [personnel]);

  useEffect(() => {
    if (personnel.length > 0) {
      checkAlreadyReceived();
    }
  }, [personnel, checkAlreadyReceived]);

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
        if (personnelData.length === 0) {
          message.warning('Không có quân nhân nào trong đơn vị của bạn.');
        }
      } else {
        message.error(response.message || 'Không thể lấy danh sách quân nhân');
      }
    } catch (error: unknown) {
      message.error(
        getApiErrorMessage(error) || 'Lỗi khi tải danh sách quân nhân'
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

    const matchesUnit =
      !unitFilter ||
      unitFilter === 'ALL' ||
      p.don_vi_truc_thuoc_id === unitFilter.split('|')[0] ||
      p.co_quan_don_vi_id === unitFilter.split('|')[0];

    return matchesSearch && matchesUnit;
  });

  const refDate = new Date(localNam ?? CURRENT_YEAR, localThang, 0);

  // Check whether a personnel meets the KNC_VSNXD_QDNDVN eligibility requirement
  const checkEligibleForKNCVSNXDQDNDVN = (record: Personnel): { eligible: boolean; reason?: string } => {
    if (alreadyReceivedMap[record.id]) {
      return { eligible: false, reason: 'Đã nhận' };
    }

    if (!record.gioi_tinh || (record.gioi_tinh !== 'NAM' && record.gioi_tinh !== 'NU')) {
      return { eligible: false, reason: 'Chưa cập nhật giới tính' };
    }

    if (!record.ngay_nhap_ngu) {
      return { eligible: false, reason: 'Chưa cập nhật ngày nhập ngũ' };
    }

    const result = calculateTotalMonths(record.ngay_nhap_ngu, record.ngay_xuat_ngu, refDate);
    if (!result || result.years === 0) {
      return { eligible: false, reason: 'Chưa đủ thời gian phục vụ' };
    }

    // Requirement: female >= 20 years, male >= 25 years
    const requiredYears = record.gioi_tinh === GENDER.FEMALE ? KNC_YEARS_REQUIRED_NU : KNC_YEARS_REQUIRED_NAM;
    if (result.years < requiredYears) {
      return {
        eligible: false,
        reason: `Chưa đủ ${requiredYears} năm phục vụ (hiện tại: ${result.years} năm)`,
      };
    }

    return { eligible: true };
  };

  // Sort priority: 0=eligible, 1=pending, 2=already received, 3=ineligible
  const getSortPriority = (record: Personnel): number => {
    const alreadyReceived = alreadyReceivedMap[record.id];
    const reason = receivedReasonMap[record.id] || '';

    if (alreadyReceived) {
      if (reason.includes('chờ duyệt') || reason.includes('Đang chờ')) return 1; // pending approval
      return 2; // already received
    }

    const eligibility = checkEligibleForKNCVSNXDQDNDVN(record);
    if (eligibility.eligible) return 0; // eligible

    return 3; // ineligible
  };

  // Sort: eligible → pending → already received → ineligible
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
    {
      title: 'Giới tính',
      key: 'gioi_tinh',
      width: 120,
      align: 'center',
      render: (_, record) => {
        if (!record.gioi_tinh) {
          return <Text type="danger">Chưa cập nhật</Text>;
        }
        return <Text>{record.gioi_tinh === GENDER.MALE ? 'Nam' : 'Nữ'}</Text>;
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
        const result = calculateTotalMonths(record.ngay_nhap_ngu, record.ngay_xuat_ngu, refDate);
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

        const eligibility = checkEligibleForKNCVSNXDQDNDVN(record);
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

          dataRows.forEach((row: ExcelRow, index: number) => {
            const rowNumber = index + 2; // +2: skip header + 0-based index

            // Validate required fields
            const hoTen = row[0]?.toString().trim();
            const ngaySinh = row[1]?.toString().trim();
            const nam = row[2]?.toString().trim();
            const thangRaw = parseInt(row[3]?.toString().trim() ?? '');
            const thang = !isNaN(thangRaw) && thangRaw >= 1 && thangRaw <= 12 ? thangRaw : localThang;
            const capBac = row[4]?.toString().trim();
            const chucVu = row[5]?.toString().trim();

            if (!hoTen) {
              errors.push(`Dòng ${rowNumber}: Thiếu họ tên`);
              return;
            }

            if (!nam) {
              errors.push(`Dòng ${rowNumber}: Thiếu năm`);
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
              danh_hieu: DANH_HIEU_DAC_BIET.KNC_VSNXD_QDNDVN,
              nam: namInt,
              thang,
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
                personnel_id: item.personnel_id ?? '',
                nam: item.nam ?? 0,
                danh_hieu: item.danh_hieu ?? '',
                proposal_type: PROPOSAL_TYPES.KNC_VSNXD_QDNDVN,
              }))
            );
            if (!batchResponse.success) throw new Error(batchResponse.message);
            const duplicateIds = new Set<string>();
            (batchResponse.data as DuplicateCheckResult[]).forEach(result => {
              if (result.exists && result.personnel_id) {
                const hoTen = personnel.find(p => p.id === result.personnel_id)?.ho_ten || result.personnel_id;
                errors.push(`${hoTen}: ${result.message}`);
                duplicateIds.add(result.personnel_id);
              }
            });
            const filteredTitleData = duplicateIds.size > 0
              ? titleData.filter(item => !duplicateIds.has(item.personnel_id ?? ''))
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

  const handleImportSuccess = async (result: Step2ImportSuccessResult) => {
    if (result.selectedPersonnelIds && result.selectedPersonnelIds.length > 0) {
      onPersonnelChange(result.selectedPersonnelIds);

      // Populate titleData from imported data
      if (result.titleData && result.titleData.length > 0) {
        // Transform to titleData format
        const titleData: TitleDataItem[] = result.titleData.map((award: Step2ImportedAward) => ({
          personnel_id: String(
            award.quan_nhan_id ??
              award.personnel_id ??
              award.co_quan_don_vi_id ??
              award.don_vi_truc_thuoc_id ??
              ''
          ),
          danh_hieu: DANH_HIEU_DAC_BIET.KNC_VSNXD_QDNDVN,
          nam: award.nam,
          thang: award.thang ?? localThang,
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
    getCheckboxProps: (record: Personnel) => {
      // Disable all checkboxes while checking eligibility
      if (checkingReceived) {
        return {
          disabled: true,
          title: 'Đang kiểm tra tính đủ điều kiện, vui lòng chờ...',
        };
      }

      const eligibility = checkEligibleForKNCVSNXDQDNDVN(record);
      const isDisabled = !eligibility.eligible;

      return {
        disabled: isDisabled,
        title: isDisabled ? eligibility.reason || 'Không đủ điều kiện đề xuất' : '',
      };
    },
    onSelect: (record: Personnel, selected: boolean) => {
      if (selected) {
        const eligibility = checkEligibleForKNCVSNXDQDNDVN(record);
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
        message={`Bước 2: Chọn quân nhân — ${DANH_HIEU_MAP['KNC_VSNXD_QDNDVN']}`}
        description={
          <div>
            <p>1. Chọn năm và tháng đề xuất để hệ thống đánh giá điều kiện theo đúng mốc thời gian.</p>
            <p>2. Lựa chọn quân nhân đủ điều kiện từ danh sách.</p>
            <p>3. Đối chiếu thời gian công tác và cảnh báo điều kiện trước khi xác nhận.</p>
            <p>4. Hoàn tất lựa chọn, nhấn &quot;Tiếp tục&quot; để sang bước chọn danh hiệu.</p>
          </div>
        }
        type="info"
        showIcon
        icon={<TrophyOutlined />}
        style={{ marginBottom: 24 }}
      />

      {/* Upload Excel Section */}
      {!isManager && (
        <>
          <ExcelImportSection
            awardType="KNC_VSNXD_QDNDVN"
            downloadTemplate={apiClient.getCommemorationMedalsTemplate}
            importFile={apiClient.importCommemorationMedals}
            templateFileName="mau_import_knc_vsnxd_qdndvn"
            onImportSuccess={handleImportSuccess}
            selectedPersonnelIds={selectedPersonnelIds}
            selectedNames={selectedPersonnelIds.map(id => personnel.find(p => p.id === id)?.ho_ten || '')}
            entityLabel="quân nhân"
            localProcessing={true}
            onLocalProcess={handleLocalExcelProcess}
            previewImport={apiClient.previewCommemorationMedalsImport}
            reviewPath="/admin/awards/bulk/import-review-kncvsnxdqdndvn"
            sessionStorageKey="importPreviewDataKNCVSNXDQDNDVN"
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
                setLocalNam(intValue);
                if (intValue >= 1900 && intValue <= CURRENT_YEAR) {
                  onNamChange(intValue);
                }
                if (intValue === CURRENT_YEAR && localThang > CURRENT_MONTH) {
                  setLocalThang(CURRENT_MONTH);
                  onThangChange?.(CURRENT_MONTH);
                }
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
              if (finalValue === CURRENT_YEAR && localThang > CURRENT_MONTH) {
                setLocalThang(CURRENT_MONTH);
                onThangChange?.(CURRENT_MONTH);
              }
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
        <div>
          <Text strong>Tháng: </Text>
          <Select
            value={localThang}
            onChange={v => {
              const val = v ?? CURRENT_MONTH;
              setLocalThang(val);
              onThangChange?.(val);
            }}
            style={{ width: 110 }}
            size="large"
            allowClear
          >
            {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
              <Select.Option key={m} value={m} disabled={localNam === CURRENT_YEAR && m > CURRENT_MONTH}>
                Tháng {m}
              </Select.Option>
            ))}
          </Select>
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
          p => !checkEligibleForKNCVSNXDQDNDVN(p).eligible
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
          // Highlight ineligible rows
          const eligibility = checkEligibleForKNCVSNXDQDNDVN(record);
          if (!eligibility.eligible) {
            return 'row-ineligible';
          }
          return '';
        }}
        pagination={{
          ...DEFAULT_ANTD_TABLE_PAGINATION,
          showTotal: total => `Tổng số ${total} quân nhân`,
        }}
        bordered
        locale={{
          emptyText: <Empty description="Không có dữ liệu quân nhân" />,
        }}
      />
    </div>
  );
}
