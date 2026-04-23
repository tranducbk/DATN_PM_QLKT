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
  Divider,
  Empty,
} from 'antd';
import { SearchOutlined, TeamOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { getApiErrorMessage } from '@/lib/apiError';
import { formatDate } from '@/lib/utils';
import { apiClient } from '@/lib/apiClient';
import {
  DEFAULT_ANTD_TABLE_PAGINATION,
  FETCH_ALL_LIMIT,
} from '@/lib/constants/pagination.constants';
import { ExcelImportSection } from './ExcelImportSection';
import { PROPOSAL_STATUS, PROPOSAL_MONTH_OPTIONS } from '@/constants/proposal.constants';
import {
  calculateContributionMonthsByGroup,
  formatMonthsToText,
  getContributionRequiredMonths,
  getHighestEligibleContributionAward,
  getReferenceEndDate,
} from '@/lib/contributionTimeHelper';
import { DANH_HIEU_SHORT_MAP } from '@/constants/danhHieu.constants';
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

interface Step2SelectPersonnelCongHienProps {
  selectedPersonnelIds: string[];
  onPersonnelChange: (ids: string[]) => void;
  nam: number;
  onNamChange: (nam: number) => void;
  thang?: number;
  onThangChange?: (thang: number) => void;
  onTitleDataChange?: (titleData: any[]) => void;
  onNextStep?: () => void;
  isManager?: boolean;
}

interface IneligiblePersonnel {
  personnelId: string;
  reason: string;
  status: string;
  awardYear?: number;
  awardTitle?: string;
  proposalId?: string;
  proposalYear?: number;
}

export function Step2SelectPersonnelCongHien({
  selectedPersonnelIds,
  onPersonnelChange,
  nam,
  onNamChange,
  thang,
  onThangChange,
  onTitleDataChange,
  onNextStep,
  isManager = false,
}: Step2SelectPersonnelCongHienProps) {
  const [loading, setLoading] = useState(false);
  const [checkingEligibility, setCheckingEligibility] = useState(false);
  const [personnel, setPersonnel] = useState<Personnel[]>([]);
  const [searchText, setSearchText] = useState('');
  const [unitFilter, setUnitFilter] = useState<string>('ALL');
  const [positionHistoriesMap, setPositionHistoriesMap] = useState<Record<string, any[]>>({});
  const CURRENT_YEAR = new Date().getFullYear();
  const [localNam, setLocalNam] = useState<number | null>(nam);
  const [localThang, setLocalThang] = useState<number>(thang ?? new Date().getMonth() + 1);
  const [ineligiblePersonnel, setIneligiblePersonnel] = useState<IneligiblePersonnel[]>([]);

  useEffect(() => {
    fetchPersonnel();
  }, []);

  useEffect(() => {
    if (personnel.length > 0) {
      fetchPositionHistories(personnel);
      checkContributionEligibility(personnel.map(p => p.id));
    }
  }, [personnel.length]);

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

  const fetchPositionHistories = async (personnelList: Personnel[]) => {
    try {
      const historiesMap: Record<string, any[]> = {};

      await Promise.all(
        personnelList.map(async p => {
          if (p.id) {
            try {
              const res = await apiClient.getPositionHistory(p.id);
              if (res.success && res.data) {
                historiesMap[p.id] = res.data;
              }
            } catch (error) {
              // Ignore errors for individual personnel
              historiesMap[p.id] = [];
            }
          }
        })
      );

      setPositionHistoriesMap(historiesMap);
    } catch (error) {
      message.error(getApiErrorMessage(error));
    }
  };

  const checkContributionEligibility = async (personnelIds: string[]) => {
    try {
      setCheckingEligibility(true);
      const response = await apiClient.checkContributionEligibility(personnelIds);

      if (response.success) {
        setIneligiblePersonnel(response.data.ineligiblePersonnel || []);
      }
    } catch (error: unknown) {
      message.error('Không thể kiểm tra tính đủ điều kiện nhận khen thưởng');
    } finally {
      setCheckingEligibility(false);
    }
  };

  const getTotalMonthsByGroup = (personnelId: string, group: '0.7' | '0.8' | '0.9-1.0'): number => {
    const histories = positionHistoriesMap[personnelId] || [];
    if (!histories.length) return 0;
    const effectiveYear = localNam ?? nam;
    const referenceEndDate = getReferenceEndDate(effectiveYear, localThang);
    return calculateContributionMonthsByGroup(histories, group, referenceEndDate);
  };

  const calculateTotalTimeByGroup = (personnelId: string, group: '0.7' | '0.8' | '0.9-1.0') => {
    const totalMonths = getTotalMonthsByGroup(personnelId, group);
    return formatMonthsToText(totalMonths);
  };

  /** Checks whether a personnel meets the service-time requirement for a given HCBVTQ rank. */
  const checkEligibleForRank = (
    personnelId: string,
    rank: 'HANG_NHAT' | 'HANG_NHI' | 'HANG_BA'
  ): boolean => {
    const person = personnel.find(p => p.id === personnelId);
    if (!person) return false;

    const requiredMonths = getContributionRequiredMonths(person.gioi_tinh);

    const months07 = getTotalMonthsByGroup(personnelId, '0.7');
    const months08 = getTotalMonthsByGroup(personnelId, '0.8');
    const months0910 = getTotalMonthsByGroup(personnelId, '0.9-1.0');

    if (rank === 'HANG_NHAT') return months0910 >= requiredMonths;
    if (rank === 'HANG_NHI') return months08 + months0910 >= requiredMonths;
    return months07 + months08 + months0910 >= requiredMonths;
  };

  /** Returns the highest HCBVTQ rank the personnel qualifies for. */
  const getHighestEligibleAward = (personnelId: string): string | null => {
    const person = personnel.find(p => p.id === personnelId);
    if (!person) return null;
    const requiredMonths = getContributionRequiredMonths(person.gioi_tinh);
    const months07 = getTotalMonthsByGroup(personnelId, '0.7');
    const months08 = getTotalMonthsByGroup(personnelId, '0.8');
    const months0910 = getTotalMonthsByGroup(personnelId, '0.9-1.0');
    return getHighestEligibleContributionAward(months07, months08, months0910, requiredMonths);
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

  // Sort priority: 0=eligible, 1=pending, 2=already received, 3=ineligible
  const getSortPriority = (record: Personnel): number => {
    const ineligible = ineligiblePersonnel.find(i => i.personnelId === record.id);

    if (ineligible) {
      if (ineligible.status === PROPOSAL_STATUS.PENDING) return 1; // pending approval
      if (ineligible.status === PROPOSAL_STATUS.APPROVED) return 2; // already received
    }

    const missingGender =
      !record.gioi_tinh || (record.gioi_tinh !== 'NAM' && record.gioi_tinh !== 'NU');
    if (missingGender) return 3;

    const highestAward = getHighestEligibleAward(record.id);
    if (highestAward) return 0; // eligible

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
        return <Text>{record.gioi_tinh === 'NAM' ? 'Nam' : 'Nữ'}</Text>;
      },
    },
    {
      title: 'Tổng thời gian (0.7)',
      key: 'total_time_0_7',
      width: 150,
      align: 'center',
      render: (_, record) => calculateTotalTimeByGroup(record.id, '0.7'),
    },
    {
      title: 'Tổng thời gian (0.8)',
      key: 'total_time_0_8',
      width: 150,
      align: 'center',
      render: (_, record) => calculateTotalTimeByGroup(record.id, '0.8'),
    },
    {
      title: 'Tổng thời gian (0.9-1.0)',
      key: 'total_time_0_9_1_0',
      width: 150,
      align: 'center',
      render: (_, record) => calculateTotalTimeByGroup(record.id, '0.9-1.0'),
    },
    {
      title: 'Trạng thái',
      key: 'eligibility_status',
      width: 180,
      align: 'center',
      fixed: 'right',
      render: (_, record) => {
        const ineligible = ineligiblePersonnel.find(i => i.personnelId === record.id);

        if (ineligible) {
          if (ineligible.status === PROPOSAL_STATUS.APPROVED) {
            return (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                <Text type="danger" strong>
                  Đã nhận{' '}
                  {ineligible.awardTitle
                    ? DANH_HIEU_SHORT_MAP[ineligible.awardTitle] || ineligible.awardTitle
                    : 'Huân chương Bảo vệ Tổ quốc'}
                </Text>
                <Text type="secondary" style={{ fontSize: '11px', textAlign: 'center' }}>
                  {ineligible.awardYear ? `Năm ${ineligible.awardYear}` : ineligible.reason}
                </Text>
              </div>
            );
          } else if (ineligible.status === PROPOSAL_STATUS.PENDING) {
            return (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                <Text type="warning" strong>
                  Đang chờ duyệt
                </Text>
                <Text type="secondary" style={{ fontSize: '11px', textAlign: 'center' }}>
                  {ineligible.proposalYear
                    ? `Hồ sơ đề xuất năm ${ineligible.proposalYear}`
                    : ineligible.reason}
                </Text>
              </div>
            );
          }
        }

        const missingGender =
          !record.gioi_tinh || (record.gioi_tinh !== 'NAM' && record.gioi_tinh !== 'NU');
        if (missingGender) {
          return (
            <Text type="danger" strong>
              Chưa cập nhật giới tính
            </Text>
          );
        }

        // Highest award the personnel currently qualifies for
        const highestAward = getHighestEligibleAward(record.id);
        if (highestAward) {
          const awardLabels: Record<string, string> = {
            HCBVTQ_HANG_NHAT: 'HCBVTQ Hạng Nhất',
            HCBVTQ_HANG_NHI: 'HCBVTQ Hạng Nhì',
            HCBVTQ_HANG_BA: 'HCBVTQ Hạng Ba',
          };
          return (
            <Text type="success" strong>
              {awardLabels[highestAward]}
            </Text>
          );
        } else {
          return <Text type="secondary">Không đủ điều kiện</Text>;
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
              danh_hieu: danhHieu,
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
                proposal_type: 'CONG_HIEN',
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
        const titleData = result.titleData.map((award: any) => ({
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

  const getSelectionDisabledReason = (record: Personnel): string | null => {
    if (checkingEligibility) {
      return 'Đang kiểm tra tính đủ điều kiện, vui lòng chờ...';
    }

    const missingGender =
      !record.gioi_tinh || (record.gioi_tinh !== 'NAM' && record.gioi_tinh !== 'NU');
    if (missingGender) {
      return 'Quân nhân này chưa cập nhật giới tính. Vui lòng cập nhật trước khi đề xuất.';
    }

    const ineligible = ineligiblePersonnel.find(i => i.personnelId === record.id);
    if (ineligible?.status === PROPOSAL_STATUS.APPROVED) {
      return `Quân nhân đã nhận danh hiệu Huân chương Bảo vệ Tổ quốc năm ${ineligible.awardYear}`;
    }
    if (ineligible?.status === PROPOSAL_STATUS.PENDING) {
      return 'Quân nhân đang có đề xuất Huân chương Bảo vệ Tổ quốc chờ duyệt';
    }

    const highestAward = getHighestEligibleAward(record.id);
    if (!highestAward) {
      return 'Quân nhân không đủ điều kiện nhận Huân chương Bảo vệ Tổ quốc';
    }

    return null;
  };

  useEffect(() => {
    if (checkingEligibility || personnel.length === 0 || selectedPersonnelIds.length === 0) {
      return;
    }

    const selectableIds = selectedPersonnelIds.filter(id => {
      const person = personnel.find(p => p.id === id);
      if (!person) return false;
      return !getSelectionDisabledReason(person);
    });

    if (selectableIds.length !== selectedPersonnelIds.length) {
      onPersonnelChange(selectableIds);
      message.info('Đã tự bỏ chọn các quân nhân không còn đủ điều kiện theo mốc tháng/năm hiện tại.');
    }
  }, [
    checkingEligibility,
    ineligiblePersonnel,
    localNam,
    localThang,
    onPersonnelChange,
    personnel,
    positionHistoriesMap,
    selectedPersonnelIds,
  ]);

  const rowSelection = {
    selectedRowKeys: selectedPersonnelIds,
    onChange: (selectedRowKeys: React.Key[]) => {
      onPersonnelChange(selectedRowKeys as string[]);
    },
    getCheckboxProps: (record: Personnel) => {
      const disabledReason = getSelectionDisabledReason(record);
      if (disabledReason) return { disabled: true, title: disabledReason };
      return { disabled: false, title: '' };
    },
    onSelect: (record: Personnel, selected: boolean) => {
      if (selected) {
        const disabledReason = getSelectionDisabledReason(record);
        if (disabledReason) {
          message.warning(`Quân nhân ${record.ho_ten}: ${disabledReason}`);
          return false;
        }
      }
    },
  };

  return (
    <div>
      <Alert
        message="Bước 2: Lựa chọn quân nhân - Huân chương Bảo vệ Tổ quốc"
        description={
          <div>
            <p>1. Chọn năm đề xuất để hệ thống xác định điều kiện theo kỳ xét.</p>
            <p>2. Lựa chọn quân nhân đủ điều kiện từ danh sách.</p>
            <p>3. Kiểm tra cảnh báo điều kiện trước khi xác nhận lựa chọn.</p>
            <p>4. Hoàn tất lựa chọn, nhấn &quot;Tiếp tục&quot; để sang bước chọn danh hiệu.</p>
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
            awardType="CONG_HIEN"
            downloadTemplate={apiClient.getContributionAwardsTemplate}
            importFile={apiClient.importContributionAwards}
            templateFileName="mau_import_hcbvtq"
            onImportSuccess={handleImportSuccess}
            selectedPersonnelIds={selectedPersonnelIds}
            selectedNames={selectedPersonnelIds.map(
              id => personnel.find(p => p.id === id)?.ho_ten || ''
            )}
            entityLabel="quân nhân"
            localProcessing={true}
            onLocalProcess={handleLocalExcelProcess}
            previewImport={apiClient.previewContributionAwardsImport}
            reviewPath="/admin/awards/bulk/import-review-hcbvtq"
            sessionStorageKey="importPreviewDataHCBVTQ"
          />
        </>
      )}

      <Space style={{ marginBottom: 16 }} size="middle" wrap>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Text strong>Tháng: </Text>
          <Select
            value={localThang}
            onChange={val => {
              setLocalThang(val);
              onThangChange?.(val);
            }}
            style={{ width: 120 }}
            size="large"
          >
            {PROPOSAL_MONTH_OPTIONS.map(m => (
              <Select.Option key={m} value={m}>
                Tháng {m}
              </Select.Option>
            ))}
          </Select>
        </div>
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

      {/* Cảnh báo về quân nhân chưa có giới tính và không đủ điều kiện */}
      {(() => {
        const missingGenderCount = filteredPersonnel.filter(
          p => !p.gioi_tinh || (p.gioi_tinh !== 'NAM' && p.gioi_tinh !== 'NU')
        ).length;

        const ineligibleCount = filteredPersonnel.filter(p =>
          ineligiblePersonnel.some(i => i.personnelId === p.id)
        ).length;
        const pendingCount = filteredPersonnel.filter(p =>
          ineligiblePersonnel.some(
            i => i.personnelId === p.id && i.status === PROPOSAL_STATUS.PENDING
          )
        ).length;
        const approvedCount = filteredPersonnel.filter(p =>
          ineligiblePersonnel.some(
            i => i.personnelId === p.id && i.status === PROPOSAL_STATUS.APPROVED
          )
        ).length;

        const notEligibleCount = filteredPersonnel.filter(p => {
          const missingGender = !p.gioi_tinh || (p.gioi_tinh !== 'NAM' && p.gioi_tinh !== 'NU');
          const ineligible = ineligiblePersonnel.some(i => i.personnelId === p.id);
          if (missingGender || ineligible) return false;
          return !getHighestEligibleAward(p.id);
        }).length;

        const warnings = [];

        if (missingGenderCount > 0) {
          warnings.push(
            <Alert
              key="gender-warning"
              message="Cảnh báo"
              description={`Có ${missingGenderCount} quân nhân chưa cập nhật giới tính. Vui lòng cập nhật trước khi đề xuất.`}
              type="warning"
              showIcon
              style={{ marginBottom: 16 }}
            />
          );
        }

        if (ineligibleCount > 0) {
          warnings.push(
            <Alert
              key="eligibility-warning"
              message="Không thể chọn lại Huân chương Bảo vệ Tổ quốc"
              description={`Có ${ineligibleCount} quân nhân đã có hồ sơ Huân chương Bảo vệ Tổ quốc trong hệ thống (${pendingCount} đang chờ duyệt, ${approvedCount} đã duyệt). Vui lòng bỏ chọn các quân nhân này hoặc xử lý hồ sơ hiện tại trước khi đề xuất mới.`}
              type="info"
              showIcon
              style={{ marginBottom: 16 }}
            />
          );
        }

        if (notEligibleCount > 0) {
          warnings.push(
            <Alert
              key="not-eligible-warning"
              message="Chưa đủ điều kiện theo thời gian công tác"
              description={`Có ${notEligibleCount} quân nhân chưa đạt mốc thời gian công tác tính đến tháng ${localThang}/${localNam ?? nam} nên chưa đủ điều kiện đề xuất Huân chương Bảo vệ Tổ quốc.`}
              type="info"
              showIcon
              style={{ marginBottom: 16 }}
            />
          );
        }

        return warnings.length > 0 ? <>{warnings}</> : null;
      })()}

      <Table
        columns={columns}
        dataSource={sortedPersonnel}
        rowKey="id"
        rowSelection={rowSelection}
        loading={loading || checkingEligibility}
        rowClassName={record => {
          // Highlight rows missing gender or ineligible for award
          const missingGender =
            !record.gioi_tinh || (record.gioi_tinh !== 'NAM' && record.gioi_tinh !== 'NU');
          const ineligible = ineligiblePersonnel.some(i => i.personnelId === record.id);
          const notEligible = !getHighestEligibleAward(record.id);

          if (missingGender) {
            return 'row-missing-gender';
          }
          if (ineligible) {
            return 'row-ineligible';
          }
          if (notEligible) {
            return 'row-not-eligible';
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
