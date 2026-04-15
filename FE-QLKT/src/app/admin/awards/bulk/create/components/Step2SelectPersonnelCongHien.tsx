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
import { ELIGIBILITY_STATUS } from '@/constants/eligibilityStatus.constants';
import { PROPOSAL_STATUS } from '@/constants/proposal.constants';
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
  const [localNam, setLocalNam] = useState<number | null>(nam);
  const [ineligiblePersonnel, setIneligiblePersonnel] = useState<IneligiblePersonnel[]>([]);
  const [contributionProfiles, setContributionProfiles] = useState<Record<string, any>>({});

  useEffect(() => {
    fetchPersonnel();
  }, []);

  useEffect(() => {
    if (personnel.length > 0) {
      fetchPositionHistories(personnel);
      fetchContributionProfiles(personnel.map(p => p.id));
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
      console.error('Lỗi tải danh sách quân nhân cống hiến', error);
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
      console.error('Lỗi tải lịch sử chức vụ cống hiến', error);
    }
  };

  const fetchContributionProfiles = async (personnelIds: string[]) => {
    try {
      const profilesMap: Record<string, any> = {};

      await Promise.all(
        personnelIds.map(async id => {
          try {
            const response = await apiClient.getContributionProfile(id);
            if (response.success && response.data) {
              profilesMap[id] = response.data;
            }
          } catch (error) {
            // Error handled silently per-item
          }
        })
      );

      setContributionProfiles(profilesMap);
    } catch (error) {
      console.error('Lỗi tải hồ sơ cống hiến', error);
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

  /** Computes total service months for a coefficient group from API data. */
  const getTotalMonthsByGroup = (personnelId: string, group: '0.7' | '0.8' | '0.9-1.0'): number => {
    const profile = contributionProfiles[personnelId];
    if (!profile) return 0;

    if (group === '0.7') {
      return profile.months_07 || 0;
    } else if (group === '0.8') {
      return profile.months_08 || 0;
    } else if (group === '0.9-1.0') {
      return profile.months_0910 || 0;
    }

    return 0;
  };

  const calculateTotalTimeByGroup = (personnelId: string, group: '0.7' | '0.8' | '0.9-1.0') => {
    const totalMonths = getTotalMonthsByGroup(personnelId, group);

    const years = Math.floor(totalMonths / 12);
    const remainingMonths = totalMonths % 12;

    if (totalMonths === 0) return '-';
    if (years > 0 && remainingMonths > 0) {
      return `${years} năm ${remainingMonths} tháng`;
    } else if (years > 0) {
      return `${years} năm`;
    } else {
      return `${remainingMonths} tháng`;
    }
  };

  /** Checks whether a personnel meets the service-time requirement for a given HCBVTQ rank. */
  const checkEligibleForRank = (
    personnelId: string,
    rank: 'HANG_NHAT' | 'HANG_NHI' | 'HANG_BA'
  ): boolean => {
    const profile = contributionProfiles[personnelId];
    if (!profile) return false;

    if (rank === 'HANG_NHAT') {
      return profile.hcbvtq_hang_nhat_status === ELIGIBILITY_STATUS.DU_DIEU_KIEN;
    } else if (rank === 'HANG_NHI') {
      return profile.hcbvtq_hang_nhi_status === ELIGIBILITY_STATUS.DU_DIEU_KIEN;
    } else if (rank === 'HANG_BA') {
      return profile.hcbvtq_hang_ba_status === ELIGIBILITY_STATUS.DU_DIEU_KIEN;
    }

    return false;
  };

  /** Returns the highest HCBVTQ rank the personnel qualifies for. */
  const getHighestEligibleAward = (personnelId: string): string | null => {
    if (checkEligibleForRank(personnelId, 'HANG_NHAT')) {
      return 'HCBVTQ_HANG_NHAT';
    } else if (checkEligibleForRank(personnelId, 'HANG_NHI')) {
      return 'HCBVTQ_HANG_NHI';
    } else if (checkEligibleForRank(personnelId, 'HANG_BA')) {
      return 'HCBVTQ_HANG_BA';
    }
    return null;
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
              <Text type="danger" strong>
                Đã nhận ({ineligible.awardYear})
              </Text>
            );
          } else if (ineligible.status === PROPOSAL_STATUS.PENDING) {
            return (
              <Text type="warning" strong>
                Đang chờ duyệt
              </Text>
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

            // Match by name + DOB (DOB optional — used to disambiguate duplicate names)
            let matchingPersonnel;
            if (ngaySinh) {
              matchingPersonnel = personnel.find(p => {
                const nameMatch = p.ho_ten.toLowerCase().trim() === hoTen.toLowerCase().trim();
                const personnelBirth = p.ngay_sinh ? formatDate(p.ngay_sinh) : '';
                return nameMatch && personnelBirth === ngaySinh;
              });
            } else {
              matchingPersonnel = personnel.find(
                p => p.ho_ten.toLowerCase().trim() === hoTen.toLowerCase().trim()
              );
            }

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

          // Reject early if any row duplicates an existing proposal
          try {
            for (const item of titleData) {
              const checkResponse = await apiClient.checkDuplicate({
                personnel_id: item.personnel_id,
                nam: item.nam,
                danh_hieu: item.danh_hieu,
                proposal_type: 'CONG_HIEN',
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

  const rowSelection = {
    selectedRowKeys: selectedPersonnelIds,
    onChange: (selectedRowKeys: React.Key[]) => {
      onPersonnelChange(selectedRowKeys as string[]);
    },
    getCheckboxProps: (record: Personnel) => {
      // Disable all checkboxes while checking eligibility
      if (checkingEligibility) {
        return {
          disabled: true,
          title: 'Đang kiểm tra tính đủ điều kiện, vui lòng chờ...',
        };
      }

      const missingGender =
        !record.gioi_tinh || (record.gioi_tinh !== 'NAM' && record.gioi_tinh !== 'NU');

      const ineligible = ineligiblePersonnel.find(i => i.personnelId === record.id);

      const highestAward = getHighestEligibleAward(record.id);
      const notEligible = !highestAward;

      let disabled = false;
      let title = '';

      if (missingGender) {
        disabled = true;
        title = 'Quân nhân này chưa cập nhật giới tính. Vui lòng cập nhật trước khi đề xuất.';
      } else if (ineligible) {
        disabled = true;
        if (ineligible.status === PROPOSAL_STATUS.APPROVED) {
          title = `Quân nhân đã nhận danh hiệu huân chương bảo vệ tổ quốc năm ${ineligible.awardYear}`;
        } else if (ineligible.status === PROPOSAL_STATUS.PENDING) {
          title = 'Quân nhân đang có đề xuất huân chương bảo vệ tổ quốc chờ duyệt';
        }
      } else if (notEligible) {
        disabled = true;
        title = 'Quân nhân không đủ điều kiện nhận huân chương bảo vệ tổ quốc';
      }

      return {
        disabled,
        title,
      };
    },
    onSelect: (record: Personnel, selected: boolean) => {
      if (selected) {
        const missingGender =
          !record.gioi_tinh || (record.gioi_tinh !== 'NAM' && record.gioi_tinh !== 'NU');
        if (missingGender) {
          message.warning(
            `Quân nhân ${record.ho_ten} chưa cập nhật giới tính. Vui lòng cập nhật trước khi đề xuất.`
          );
          return false;
        }

        const ineligible = ineligiblePersonnel.find(i => i.personnelId === record.id);
        if (ineligible) {
          if (ineligible.status === PROPOSAL_STATUS.APPROVED) {
            message.warning(
              `Quân nhân ${record.ho_ten} đã nhận danh hiệu huân chương bảo vệ tổ quốc năm ${ineligible.awardYear}`
            );
          } else if (ineligible.status === PROPOSAL_STATUS.PENDING) {
            message.warning(
              `Quân nhân ${record.ho_ten} đang có đề xuất huân chương bảo vệ tổ quốc chờ duyệt`
            );
          }
          return false;
        }

        const highestAward = getHighestEligibleAward(record.id);
        if (!highestAward) {
          message.warning(
            `Quân nhân ${record.ho_ten} không đủ điều kiện nhận huân chương bảo vệ tổ quốc`
          );
          return false;
        }
      }
    },
  };

  return (
    <div>
      <Alert
        message="Bước 2: Chọn quân nhân - Huân chương Bảo vệ Tổ quốc"
        description={
          <div>
            <p>1. Nhập năm đề xuất khen thưởng</p>
            <p>
              2. Chọn các quân nhân cần đề xuất Huân chương Bảo vệ Tổ quốc từ danh sách dưới đây
            </p>
            <p>3. Sau khi chọn xong, nhấn &quot;Tiếp tục&quot; để sang bước chọn danh hiệu</p>
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
              message="Thông báo"
              description={`Có ${ineligibleCount} quân nhân đã nhận hoặc đang chờ duyệt Huân chương Bảo vệ Tổ quốc, không được phép chọn lại.`}
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
              message="Thông báo"
              description={`Có ${notEligibleCount} quân nhân không đủ điều kiện nhận huân chương bảo vệ tổ quốc.`}
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
