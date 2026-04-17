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
import type { DateInput } from '@/lib/types';
import { apiClient } from '@/lib/apiClient';
import { DEFAULT_ANTD_TABLE_PAGINATION, FETCH_ALL_LIMIT } from '@/lib/constants/pagination.constants';
import { ELIGIBILITY_STATUS } from '@/constants/eligibilityStatus.constants';
import { ExcelImportSection } from './ExcelImportSection';
import * as XLSX from 'xlsx';

const { Text } = Typography;

interface Personnel {
  id: string;
  ho_ten: string;
  cccd: string;
  cap_bac?: string;
  gioi_tinh?: string | null;
  ngay_sinh?: string | null;
  co_quan_don_vi_id: string;
  don_vi_truc_thuoc_id: string;
  chuc_vu_id: string;
  ngay_nhap_ngu?: DateInput;
  ngay_xuat_ngu?: DateInput;
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

interface Step2SelectPersonnelNienHanProps {
  selectedPersonnelIds: string[];
  onPersonnelChange: (ids: string[]) => void;
  nam: number;
  onNamChange: (nam: number) => void;
  onTitleDataChange?: (titleData: any[]) => void;
  onNextStep?: () => void;
  bypassEligibility?: boolean;
  isManager?: boolean;
}

export function Step2SelectPersonnelNienHan({
  selectedPersonnelIds,
  onPersonnelChange,
  nam,
  onNamChange,
  onTitleDataChange,
  onNextStep,
  bypassEligibility = false,
  isManager = false,
}: Step2SelectPersonnelNienHanProps) {
  const [loading, setLoading] = useState(false);
  const [checkingProfiles, setCheckingProfiles] = useState(false);
  const [personnel, setPersonnel] = useState<Personnel[]>([]);
  const [searchText, setSearchText] = useState('');
  const [unitFilter, setUnitFilter] = useState<string>('ALL');
  const [localNam, setLocalNam] = useState<number | null>(nam);
  const [serviceProfilesMap, setServiceProfilesMap] = useState<Record<string, any>>({});

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

        if (personnelData.length > 0) {
          await fetchServiceProfiles(personnelData);
        }
      }
    } catch (error: unknown) {
      message.error(getApiErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  const fetchServiceProfiles = async (personnelList: Personnel[]) => {
    try {
      setCheckingProfiles(true);
      const profilesMap: Record<string, any> = {};

      await Promise.all(
        personnelList.map(async p => {
          if (p.id) {
            try {
              const res = await apiClient.getTenureProfile(p.id);
              if (res.success && res.data) {
                profilesMap[p.id] = res.data;
              }
            } catch (error) {
              // Ignore errors for individual personnel
              profilesMap[p.id] = null;
            }
          }
        })
      );

      setServiceProfilesMap(profilesMap);
    } catch (error) {
      message.error(getApiErrorMessage(error));
    } finally {
      setCheckingProfiles(false);
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
    ngayNhapNgu: DateInput,
    ngayXuatNgu: DateInput
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

  /** Checks whether service time meets HCCSVV eligibility thresholds. */
  const checkHCCSVVEligibility = (record: Personnel) => {
    if (!record.ngay_nhap_ngu) return null;

    const result = calculateTotalMonths(record.ngay_nhap_ngu, record.ngay_xuat_ngu);
    if (!result) return null;

    const totalYears = result.years;
    const startDate =
      typeof record.ngay_nhap_ngu === 'string'
        ? new Date(record.ngay_nhap_ngu)
        : record.ngay_nhap_ngu;

    const eligibilityDateBa = new Date(startDate);
    eligibilityDateBa.setFullYear(eligibilityDateBa.getFullYear() + 10);
    const eligibilityYearBa = eligibilityDateBa.getFullYear();

    const eligibilityDateNhi = new Date(startDate);
    eligibilityDateNhi.setFullYear(eligibilityDateNhi.getFullYear() + 15);
    const eligibilityYearNhi = eligibilityDateNhi.getFullYear();

    const eligibilityDateNhat = new Date(startDate);
    eligibilityDateNhat.setFullYear(eligibilityDateNhat.getFullYear() + 20);
    const eligibilityYearNhat = eligibilityDateNhat.getFullYear();

    const currentYear = new Date().getFullYear();

    return {
      hangBa: {
        eligible: currentYear >= eligibilityYearBa,
        yearsNeeded: Math.max(0, eligibilityYearBa - currentYear),
        totalYears,
      },
      hangNhi: {
        eligible: currentYear >= eligibilityYearNhi,
        yearsNeeded: Math.max(0, eligibilityYearNhi - currentYear),
        totalYears,
      },
      hangNhat: {
        eligible: currentYear >= eligibilityYearNhat,
        yearsNeeded: Math.max(0, eligibilityYearNhat - currentYear),
        totalYears,
      },
    };
  };

  /** Returns true if the personnel is eligible to be proposed for the next HCCSVV rank. */
  const canProposeNextRank = (record: Personnel) => {
    if (!record.gioi_tinh || (record.gioi_tinh !== 'NAM' && record.gioi_tinh !== 'NU')) {
      return false;
    }

    if (!record.ngay_nhap_ngu) return false;

    const eligibility = checkHCCSVVEligibility(record);
    if (!eligibility) return false;

    const serviceProfile = serviceProfilesMap[record.id];
    const hasHangBa = serviceProfile?.hccsvv_hang_ba_status === ELIGIBILITY_STATUS.DA_NHAN;
    const hasHangNhi = serviceProfile?.hccsvv_hang_nhi_status === ELIGIBILITY_STATUS.DA_NHAN;
    const hasHangNhat = serviceProfile?.hccsvv_hang_nhat_status === ELIGIBILITY_STATUS.DA_NHAN;

    // Not yet received Rank 3: requires >= 10 years
    if (!hasHangBa) {
      return eligibility.hangBa.eligible;
    }

    // Received Rank 3 but not yet Rank 2: requires >= 15 years
    if (hasHangBa && !hasHangNhi) {
      return eligibility.hangNhi.eligible;
    }

    // Received Rank 2 but not yet Rank 1: requires >= 20 years
    if (hasHangNhi && !hasHangNhat) {
      return eligibility.hangNhat.eligible;
    }

    // Already received all ranks — no further proposal possible
    return false;
  };

  // Sort priority: 0=eligible for next rank, 2=received all ranks, 3=ineligible
  const getSortPriority = (record: Personnel): number => {
    const missingGender =
      !record.gioi_tinh || (record.gioi_tinh !== 'NAM' && record.gioi_tinh !== 'NU');
    if (missingGender) return 3;

    if (!record.ngay_nhap_ngu) return 3;

    const serviceProfile = serviceProfilesMap[record.id];
    const hasHangNhat = serviceProfile?.hccsvv_hang_nhat_status === ELIGIBILITY_STATUS.DA_NHAN;

    if (hasHangNhat) return 2;

    if (canProposeNextRank(record)) return 0;

    return 3; // ineligible
  };

  // Sort: eligible → all ranks received → ineligible
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
      title: 'Điều kiện HCCSVV',
      key: 'hccsvv_eligibility',
      width: 200,
      align: 'center',
      render: (_, record) => {
        const eligibility = checkHCCSVVEligibility(record);
        if (!eligibility) return <Text type="secondary">-</Text>;

        const serviceProfile = serviceProfilesMap[record.id];
        const hasHangBa = serviceProfile?.hccsvv_hang_ba_status === ELIGIBILITY_STATUS.DA_NHAN;
        const hasHangNhi = serviceProfile?.hccsvv_hang_nhi_status === ELIGIBILITY_STATUS.DA_NHAN;
        const hasHangNhat = serviceProfile?.hccsvv_hang_nhat_status === ELIGIBILITY_STATUS.DA_NHAN;

        const { hangBa, hangNhi, hangNhat } = eligibility;

        // < 10 years — not yet eligible for Rank 3
        if (!hangBa.eligible) {
          return (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <Text type="warning" strong>
                Chưa đủ 10 năm
              </Text>
              <Text type="secondary" style={{ fontSize: '11px' }}>
                Còn {hangBa.yearsNeeded} năm
              </Text>
            </div>
          );
        }

        // >= 10 years, no Rank 3 yet — eligible to propose Rank 3
        if (hangBa.eligible && !hasHangBa) {
          return (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <Text type="success" strong>
                Đủ Hạng Ba
              </Text>
              <Text type="secondary" style={{ fontSize: '11px' }}>
                Có thể đề xuất Hạng Ba
              </Text>
            </div>
          );
        }

        // Rank 3 received, >= 15 years, no Rank 2 yet — eligible to propose Rank 2
        if (hasHangBa && hangNhi.eligible && !hasHangNhi) {
          return (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <Text type="success" strong>
                Đủ Hạng Nhì
              </Text>
              <Text type="secondary" style={{ fontSize: '11px' }}>
                Có thể đề xuất Hạng Nhì
              </Text>
            </div>
          );
        }

        // Rank 3 received but < 15 years — not yet eligible for Rank 2
        if (hasHangBa && !hangNhi.eligible) {
          return (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <Text type="success" strong>
                Đã nhận Hạng Ba
              </Text>
              <Text type="warning" style={{ fontSize: '11px' }}>
                Chưa đủ 15 năm (Hạng Nhì)
              </Text>
            </div>
          );
        }

        // Rank 2 received, >= 20 years, no Rank 1 yet — eligible to propose Rank 1
        if (hasHangNhi && hangNhat.eligible && !hasHangNhat) {
          return (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <Text type="success" strong>
                Đủ Hạng Nhất
              </Text>
              <Text type="secondary" style={{ fontSize: '11px' }}>
                Có thể đề xuất Hạng Nhất
              </Text>
            </div>
          );
        }

        // Rank 2 received but < 20 years — not yet eligible for Rank 1
        if (hasHangNhi && !hangNhat.eligible) {
          return (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <Text type="success" strong>
                Đã nhận Hạng Nhì
              </Text>
              <Text type="warning" style={{ fontSize: '11px' }}>
                Chưa đủ 20 năm (Hạng Nhất)
              </Text>
            </div>
          );
        }

        // All ranks received
        if (hasHangNhat) {
          return (
            <Text type="success" strong>
              Đã nhận đủ tất cả hạng
            </Text>
          );
        }

        return <Text type="secondary">-</Text>;
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
                const nameMatch =
                  p.ho_ten.toLowerCase().trim() === hoTen.toLowerCase().trim();
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

          try {
            const batchResponse = await apiClient.checkDuplicateBatch(
              titleData.map(item => ({
                personnel_id: item.personnel_id,
                nam: item.nam,
                danh_hieu: item.danh_hieu,
                proposal_type: 'NIEN_HAN',
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

  const rowSelection = {
    selectedRowKeys: selectedPersonnelIds,
    onChange: (selectedRowKeys: React.Key[]) => {
      onPersonnelChange(selectedRowKeys as string[]);
    },
    getCheckboxProps: (record: Personnel) => {
      // Disable all checkboxes while checking profiles
      if (checkingProfiles) {
        return {
          disabled: true,
          title: 'Đang kiểm tra tính đủ điều kiện, vui lòng chờ...',
        };
      }

      const missingGender =
        !record.gioi_tinh || (record.gioi_tinh !== 'NAM' && record.gioi_tinh !== 'NU');
      const missingNgayNhapNgu = !record.ngay_nhap_ngu;
      const canPropose = canProposeNextRank(record);

      let title = '';
      if (missingGender) {
        title = 'Quân nhân này chưa cập nhật giới tính. Vui lòng cập nhật trước khi đề xuất.';
      } else if (missingNgayNhapNgu) {
        title = 'Quân nhân này chưa cập nhật ngày nhập ngũ. Vui lòng cập nhật trước khi đề xuất.';
      } else if (!canPropose) {
        const eligibility = checkHCCSVVEligibility(record);
        const serviceProfile = serviceProfilesMap[record.id];
        const hasHangBa = serviceProfile?.hccsvv_hang_ba_status === ELIGIBILITY_STATUS.DA_NHAN;
        const hasHangNhi = serviceProfile?.hccsvv_hang_nhi_status === ELIGIBILITY_STATUS.DA_NHAN;
        const hasHangNhat = serviceProfile?.hccsvv_hang_nhat_status === ELIGIBILITY_STATUS.DA_NHAN;

        if (!hasHangBa && eligibility && !eligibility.hangBa.eligible) {
          title = `Chưa đủ 10 năm để đề xuất Hạng Ba. Còn ${eligibility.hangBa.yearsNeeded} năm.`;
        } else if (hasHangBa && !hasHangNhi && eligibility && !eligibility.hangNhi.eligible) {
          title = `Chưa đủ 15 năm để đề xuất Hạng Nhì. Còn ${eligibility.hangNhi.yearsNeeded} năm.`;
        } else if (hasHangNhi && !hasHangNhat && eligibility && !eligibility.hangNhat.eligible) {
          title = `Chưa đủ 20 năm để đề xuất Hạng Nhất. Còn ${eligibility.hangNhat.yearsNeeded} năm.`;
        } else if (hasHangNhat) {
          title = 'Quân nhân này đã nhận đủ tất cả hạng HCCSVV.';
        }
      }

      return {
        disabled: bypassEligibility
          ? missingGender || missingNgayNhapNgu
          : missingGender || missingNgayNhapNgu || !canPropose,
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
        if (!record.ngay_nhap_ngu) {
          message.warning(
            `Quân nhân ${record.ho_ten} chưa cập nhật ngày nhập ngũ. Vui lòng cập nhật trước khi đề xuất.`
          );
          return false;
        }
        if (!canProposeNextRank(record)) {
          if (bypassEligibility) {
            // Allow selection but show warning
            message.warning(
              `Cảnh báo: Quân nhân ${record.ho_ten} chưa đủ điều kiện khen thưởng niên hạn. Vẫn cho phép thêm khen thưởng quá khứ.`
            );
            return true;
          }
          const eligibility = checkHCCSVVEligibility(record);
          const serviceProfile = serviceProfilesMap[record.id];
          const hasHangBa = serviceProfile?.hccsvv_hang_ba_status === ELIGIBILITY_STATUS.DA_NHAN;
          const hasHangNhi = serviceProfile?.hccsvv_hang_nhi_status === ELIGIBILITY_STATUS.DA_NHAN;
          const hasHangNhat = serviceProfile?.hccsvv_hang_nhat_status === ELIGIBILITY_STATUS.DA_NHAN;

          if (!hasHangBa && eligibility && !eligibility.hangBa.eligible) {
            message.warning(
              `Quân nhân ${record.ho_ten} chưa đủ 10 năm để đề xuất Hạng Ba. Còn ${eligibility.hangBa.yearsNeeded} năm.`
            );
          } else if (hasHangBa && !hasHangNhi && eligibility && !eligibility.hangNhi.eligible) {
            message.warning(
              `Quân nhân ${record.ho_ten} chưa đủ 15 năm để đề xuất Hạng Nhì. Còn ${eligibility.hangNhi.yearsNeeded} năm.`
            );
          } else if (hasHangNhi && !hasHangNhat && eligibility && !eligibility.hangNhat.eligible) {
            message.warning(
              `Quân nhân ${record.ho_ten} chưa đủ 20 năm để đề xuất Hạng Nhất. Còn ${eligibility.hangNhat.yearsNeeded} năm.`
            );
          } else if (hasHangNhat) {
            message.warning(`Quân nhân ${record.ho_ten} đã nhận đủ tất cả hạng HCCSVV.`);
          }
          return false;
        }
      }
    },
  };

  return (
    <div>
      <Alert
        message="Bước 2: Chọn quân nhân - Huy chương Chiến sĩ vẻ vang"
        description={
          <div>
            <p>1. Nhập năm đề xuất khen thưởng</p>
            <p>
              2. Chọn các quân nhân cần đề xuất Huy chương Chiến sĩ vẻ vang từ danh sách dưới đây
            </p>
            <p>
              3. Bảng hiển thị thông tin ngày nhập ngũ, xuất ngũ và tổng tháng để hỗ trợ lựa chọn
            </p>
            <p>4. Sau khi chọn xong, nhấn &quot;Tiếp tục&quot; để sang bước chọn danh hiệu</p>
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
            awardType="NIEN_HAN"
            downloadTemplate={apiClient.getHCCSVVTemplate}
            importFile={apiClient.importHCCSVV}
            templateFileName="mau_import_hccsvv"
            onImportSuccess={handleImportSuccess}
            selectedPersonnelIds={selectedPersonnelIds}
            selectedNames={selectedPersonnelIds.map(id => personnel.find(p => p.id === id)?.ho_ten || '')}
            entityLabel="quân nhân"
            localProcessing={true}
            onLocalProcess={handleLocalExcelProcess}
            previewImport={apiClient.previewHCCSVVImport}
            reviewPath="/admin/awards/bulk/import-review-hccsvv"
            sessionStorageKey="importPreviewDataHCCSVV"
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

      {/* Cảnh báo về quân nhân chưa có giới tính hoặc ngày nhập ngũ */}
      {(() => {
        const missingGenderCount = filteredPersonnel.filter(
          p => !p.gioi_tinh || (p.gioi_tinh !== 'NAM' && p.gioi_tinh !== 'NU')
        ).length;
        const missingNgayNhapNguCount = filteredPersonnel.filter(p => !p.ngay_nhap_ngu).length;

        if (missingGenderCount > 0 || missingNgayNhapNguCount > 0) {
          const messages = [];
          if (missingGenderCount > 0) {
            messages.push(`${missingGenderCount} quân nhân chưa cập nhật giới tính`);
          }
          if (missingNgayNhapNguCount > 0) {
            messages.push(`${missingNgayNhapNguCount} quân nhân chưa cập nhật ngày nhập ngũ`);
          }

          return (
            <Alert
              message="Cảnh báo"
              description={`Có ${messages.join(', ')}. Vui lòng cập nhật trước khi đề xuất.`}
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
        loading={loading || checkingProfiles}
        rowClassName={record => {
          // Highlight rows missing gender
          const missingGender =
            !record.gioi_tinh || (record.gioi_tinh !== 'NAM' && record.gioi_tinh !== 'NU');
          if (missingGender) {
            return 'row-missing-gender';
          }

          // Highlight rows missing enlistment date
          if (!record.ngay_nhap_ngu) {
            return 'row-missing-ngay-nhap-ngu';
          }

          // Only highlight if not yet eligible for next rank
          if (!canProposeNextRank(record)) {
            const eligibility = checkHCCSVVEligibility(record);
            const serviceProfile = serviceProfilesMap[record.id];
            const hasHangBa = serviceProfile?.hccsvv_hang_ba_status === ELIGIBILITY_STATUS.DA_NHAN;
            const hasHangNhi = serviceProfile?.hccsvv_hang_nhi_status === ELIGIBILITY_STATUS.DA_NHAN;
            const hasHangNhat = serviceProfile?.hccsvv_hang_nhat_status === ELIGIBILITY_STATUS.DA_NHAN;

            // Rank 3 not received and < 10 years
            if (!hasHangBa && eligibility && !eligibility.hangBa.eligible) {
              return 'row-not-eligible-hccsvv';
            }
            // Rank 3 received but Rank 2 not yet and < 15 years
            if (hasHangBa && !hasHangNhi && eligibility && !eligibility.hangNhi.eligible) {
              return 'row-partial-eligible-hccsvv';
            }
            // Rank 2 received but Rank 1 not yet and < 20 years
            if (hasHangNhi && !hasHangNhat && eligibility && !eligibility.hangNhat.eligible) {
              return 'row-partial-eligible-hccsvv';
            }
            // All ranks received
            if (hasHangNhat) {
              return 'row-not-eligible-hccsvv';
            }
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
