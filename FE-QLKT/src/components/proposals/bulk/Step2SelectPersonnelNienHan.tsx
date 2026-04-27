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
  Empty,
} from 'antd';
import { SearchOutlined, TeamOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { getApiErrorMessage } from '@/lib/apiError';
import { formatDate } from '@/lib/utils';
import { apiClient } from '@/lib/apiClient';
import { calculateTotalMonths } from './serviceDuration';
import type { Step2Personnel as Personnel } from './types';
import { DEFAULT_ANTD_TABLE_PAGINATION, FETCH_ALL_LIMIT } from '@/constants/pagination.constants';
import { ELIGIBILITY_STATUS } from '@/constants/eligibilityStatus.constants';
import { PROPOSAL_TYPES } from '@/constants/proposal.constants';
import { HCCSVV_YEARS_HANG_BA, HCCSVV_YEARS_HANG_NHI, HCCSVV_YEARS_HANG_NHAT } from '@/constants/danhHieu.constants';
import { GENDER } from '@/constants/gender.constants';
import { ExcelImportSection } from './ExcelImportSection';
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

type HCCSVVRank = 'HCCSVV_HANG_BA' | 'HCCSVV_HANG_NHI' | 'HCCSVV_HANG_NHAT';

interface NienHanEligibility {
  eligible: boolean;
  reason?: string;
  suggestedRank?: HCCSVVRank;
}

const RANK_LABEL: Record<HCCSVVRank, string> = {
  HCCSVV_HANG_BA: 'hạng Ba',
  HCCSVV_HANG_NHI: 'hạng Nhì',
  HCCSVV_HANG_NHAT: 'hạng Nhất',
};

interface Step2SelectPersonnelNienHanProps {
  selectedPersonnelIds: string[];
  onPersonnelChange: (ids: string[]) => void;
  nam: number;
  onNamChange: (nam: number) => void;
  thang: number;
  onThangChange?: (thang: number) => void;
  onTitleDataChange?: (titleData: TitleDataItem[]) => void;
  onNextStep?: () => void;
  bypassEligibility?: boolean;
  isManager?: boolean;
}

function formatMonthsRemaining(years: number, months: number): string {
  if (years > 0 && months > 0) return `${years} năm ${months} tháng`;
  if (years > 0) return `${years} năm`;
  return `${months} tháng`;
}

export function Step2SelectPersonnelNienHan({
  selectedPersonnelIds,
  onPersonnelChange,
  nam,
  onNamChange,
  thang,
  onThangChange,
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
  const NOW = new Date();
  const CURRENT_YEAR = NOW.getFullYear();
  const CURRENT_MONTH = NOW.getMonth() + 1;

  const [localNam, setLocalNam] = useState<number | null>(nam);
  const [localThang, setLocalThang] = useState<number>(thang);
  const [serviceProfilesMap, setServiceProfilesMap] = useState<Record<string, any>>({});

  useEffect(() => {
    fetchPersonnel();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setLocalNam(nam);
  }, [nam]);

  useEffect(() => {
    setLocalThang(thang);
  }, [thang]);

  // Auto-deselect personnel who become ineligible when year/month changes
  useEffect(() => {
    if (bypassEligibility || selectedPersonnelIds.length === 0 || personnel.length === 0) return;
    const personnelById = new Map(personnel.map(p => [p.id, p] as const));
    const stillEligible = selectedPersonnelIds.filter(id => {
      const record = personnelById.get(id);
      return record && canProposeNextRank(record);
    });
    if (stillEligible.length < selectedPersonnelIds.length) {
      onPersonnelChange(stillEligible);
    }
    // canProposeNextRank reads serviceProfilesMap/localNam/localThang already in deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bypassEligibility, selectedPersonnelIds, personnel, serviceProfilesMap, localNam, localThang, onPersonnelChange]);

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

    const matchesUnit =
      !unitFilter ||
      unitFilter === 'ALL' ||
      p.don_vi_truc_thuoc_id === unitFilter.split('|')[0] ||
      p.co_quan_don_vi_id === unitFilter.split('|')[0];

    return matchesSearch && matchesUnit;
  });

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
    eligibilityDateBa.setFullYear(eligibilityDateBa.getFullYear() + HCCSVV_YEARS_HANG_BA);

    const eligibilityDateNhi = new Date(startDate);
    eligibilityDateNhi.setFullYear(eligibilityDateNhi.getFullYear() + HCCSVV_YEARS_HANG_NHI);

    const eligibilityDateNhat = new Date(startDate);
    eligibilityDateNhat.setFullYear(eligibilityDateNhat.getFullYear() + HCCSVV_YEARS_HANG_NHAT);

    const proposalYear = localNam ?? new Date().getFullYear();
    const refDate = new Date(proposalYear, localThang, 0);

    const monthsUntil = (target: Date): number => {
      const total = (target.getFullYear() - refDate.getFullYear()) * 12 + (target.getMonth() - refDate.getMonth());
      return Math.max(0, total);
    };

    const remainingBa = monthsUntil(eligibilityDateBa);
    const remainingNhi = monthsUntil(eligibilityDateNhi);
    const remainingNhat = monthsUntil(eligibilityDateNhat);

    return {
      hangBa: {
        eligible: refDate >= eligibilityDateBa,
        yearsNeeded: Math.floor(remainingBa / 12),
        monthsNeeded: remainingBa % 12,
        totalYears,
      },
      hangNhi: {
        eligible: refDate >= eligibilityDateNhi,
        yearsNeeded: Math.floor(remainingNhi / 12),
        monthsNeeded: remainingNhi % 12,
        totalYears,
      },
      hangNhat: {
        eligible: refDate >= eligibilityDateNhat,
        yearsNeeded: Math.floor(remainingNhat / 12),
        monthsNeeded: remainingNhat % 12,
        totalYears,
      },
    };
  };

  /** Returns full eligibility info (reason + suggested rank) for the next HCCSVV rank. */
  const getNienHanProposalEligibility = (record: Personnel): NienHanEligibility => {
    if (!record.gioi_tinh || (record.gioi_tinh !== 'NAM' && record.gioi_tinh !== 'NU')) {
      return { eligible: false, reason: 'Quân nhân chưa cập nhật giới tính' };
    }
    if (!record.ngay_nhap_ngu) {
      return { eligible: false, reason: 'Quân nhân chưa cập nhật ngày nhập ngũ' };
    }

    const eligibility = checkHCCSVVEligibility(record);
    if (!eligibility) {
      return { eligible: false, reason: 'Không đủ dữ liệu để đánh giá' };
    }

    const serviceProfile = serviceProfilesMap[record.id];
    const hasHangBa = serviceProfile?.hccsvv_hang_ba_status === ELIGIBILITY_STATUS.DA_NHAN;
    const hasHangNhi = serviceProfile?.hccsvv_hang_nhi_status === ELIGIBILITY_STATUS.DA_NHAN;
    const hasHangNhat = serviceProfile?.hccsvv_hang_nhat_status === ELIGIBILITY_STATUS.DA_NHAN;

    if (hasHangNhat) {
      return { eligible: false, reason: 'Đã nhận đủ tất cả hạng Huy chương Chiến sĩ vẻ vang' };
    }

    const namNhan = serviceProfile?.hccsvv_nam_nhan as
      | Record<string, { nam?: number | null }>
      | undefined;

    let targetRank: HCCSVVRank;
    let targetTimeOk: boolean;
    let yearsThreshold: number;
    let timeRemaining: { yearsNeeded: number; monthsNeeded: number };
    let lowerRankYear: number | null = null;
    let lowerRankName = '';

    if (!hasHangBa) {
      targetRank = 'HCCSVV_HANG_BA';
      targetTimeOk = eligibility.hangBa.eligible;
      yearsThreshold = HCCSVV_YEARS_HANG_BA;
      timeRemaining = eligibility.hangBa;
    } else if (!hasHangNhi) {
      targetRank = 'HCCSVV_HANG_NHI';
      targetTimeOk = eligibility.hangNhi.eligible;
      yearsThreshold = HCCSVV_YEARS_HANG_NHI;
      timeRemaining = eligibility.hangNhi;
      lowerRankYear = namNhan?.HCCSVV_HANG_BA?.nam ?? null;
      lowerRankName = 'hạng Ba';
    } else {
      targetRank = 'HCCSVV_HANG_NHAT';
      targetTimeOk = eligibility.hangNhat.eligible;
      yearsThreshold = HCCSVV_YEARS_HANG_NHAT;
      timeRemaining = eligibility.hangNhat;
      lowerRankYear = namNhan?.HCCSVV_HANG_NHI?.nam ?? null;
      lowerRankName = 'hạng Nhì';
    }

    const targetLabel = RANK_LABEL[targetRank];

    if (!targetTimeOk) {
      return {
        eligible: false,
        reason: `Chưa đủ ${yearsThreshold} năm để đề xuất ${targetLabel}. Còn ${formatMonthsRemaining(timeRemaining.yearsNeeded, timeRemaining.monthsNeeded)}.`,
        suggestedRank: targetRank,
      };
    }

    const proposalYear = localNam ?? new Date().getFullYear();
    if (lowerRankYear != null && proposalYear <= lowerRankYear) {
      return {
        eligible: false,
        reason: `Năm đề xuất ${targetLabel} (${proposalYear}) phải sau năm đã nhận ${lowerRankName} (${lowerRankYear}). Vui lòng chọn năm đề xuất sau ${lowerRankYear}.`,
        suggestedRank: targetRank,
      };
    }

    return { eligible: true, suggestedRank: targetRank };
  };

  const canProposeNextRank = (record: Personnel) =>
    getNienHanProposalEligibility(record).eligible;

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
        const refYear = localNam ?? new Date().getFullYear();
        const lastDayOfMonth = new Date(refYear, localThang, 0);
        const result = calculateTotalMonths(record.ngay_nhap_ngu, record.ngay_xuat_ngu, lastDayOfMonth);
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
                Chưa đủ {HCCSVV_YEARS_HANG_BA} năm
              </Text>
              <Text type="secondary" style={{ fontSize: '11px' }}>
                Còn {formatMonthsRemaining(hangBa.yearsNeeded, hangBa.monthsNeeded)}
              </Text>
            </div>
          );
        }

        // >= 10 years, no Rank 3 yet — eligible to propose Rank 3
        if (hangBa.eligible && !hasHangBa) {
          return (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <Text type="success" strong>
                Đủ hạng Ba
              </Text>
              <Text type="secondary" style={{ fontSize: '11px' }}>
                Có thể đề xuất hạng Ba
              </Text>
            </div>
          );
        }

        // Rank 3 received, >= 15 years, no Rank 2 yet — check rank-order by year
        if (hasHangBa && hangNhi.eligible && !hasHangNhi) {
          const namNhan = serviceProfile?.hccsvv_nam_nhan as
            | Record<string, { nam?: number | null }>
            | undefined;
          const lowerYear = namNhan?.HCCSVV_HANG_BA?.nam ?? null;
          const proposalYear = localNam ?? new Date().getFullYear();
          if (lowerYear != null && proposalYear <= lowerYear) {
            return (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                <Text type="warning" strong>
                  Chưa thể đề xuất hạng Nhì
                </Text>
                <Text type="secondary" style={{ fontSize: '11px' }}>
                  Cần năm đề xuất sau {lowerYear} (đã nhận hạng Ba năm {lowerYear})
                </Text>
              </div>
            );
          }
          return (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <Text type="success" strong>
                Đủ hạng Nhì
              </Text>
              <Text type="secondary" style={{ fontSize: '11px' }}>
                Có thể đề xuất hạng Nhì
              </Text>
            </div>
          );
        }

        // Rank 3 received but < 15 years — not yet eligible for Rank 2
        if (hasHangBa && !hangNhi.eligible) {
          return (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <Text type="success" strong>
                Đã nhận hạng Ba
              </Text>
              <Text type="warning" style={{ fontSize: '11px' }}>
                Còn {formatMonthsRemaining(hangNhi.yearsNeeded, hangNhi.monthsNeeded)} nữa (hạng Nhì)
              </Text>
            </div>
          );
        }

        // Rank 2 received, >= 20 years, no Rank 1 yet — check rank-order by year
        if (hasHangNhi && hangNhat.eligible && !hasHangNhat) {
          const namNhan = serviceProfile?.hccsvv_nam_nhan as
            | Record<string, { nam?: number | null }>
            | undefined;
          const lowerYear = namNhan?.HCCSVV_HANG_NHI?.nam ?? null;
          const proposalYear = localNam ?? new Date().getFullYear();
          if (lowerYear != null && proposalYear <= lowerYear) {
            return (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                <Text type="warning" strong>
                  Chưa thể đề xuất hạng Nhất
                </Text>
                <Text type="secondary" style={{ fontSize: '11px' }}>
                  Cần năm đề xuất sau {lowerYear} (đã nhận hạng Nhì năm {lowerYear})
                </Text>
              </div>
            );
          }
          return (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <Text type="success" strong>
                Đủ hạng Nhất
              </Text>
              <Text type="secondary" style={{ fontSize: '11px' }}>
                Có thể đề xuất hạng Nhất
              </Text>
            </div>
          );
        }

        // Rank 2 received but < 20 years — not yet eligible for Rank 1
        if (hasHangNhi && !hangNhat.eligible) {
          return (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <Text type="success" strong>
                Đã nhận hạng Nhì
              </Text>
              <Text type="warning" style={{ fontSize: '11px' }}>
                Còn {formatMonthsRemaining(hangNhat.yearsNeeded, hangNhat.monthsNeeded)} nữa (hạng Nhất)
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
            const thangRaw = row[3] !== undefined && row[3] !== null && row[3] !== '' ? parseInt(row[3].toString().trim()) : NaN;
            const thang = !isNaN(thangRaw) && thangRaw >= 1 && thangRaw <= 12 ? thangRaw : localThang;
            const capBac = row[4]?.toString().trim();
            const chucVu = row[5]?.toString().trim();
            const danhHieu = row[6]?.toString().trim();

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
                proposal_type: PROPOSAL_TYPES.NIEN_HAN,
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
              '' // fallback if all ID fields are null/undefined
          ),
          danh_hieu: award.danh_hieu,
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
      const eligibilityResult = getNienHanProposalEligibility(record);
      const canPropose = eligibilityResult.eligible;

      return {
        disabled: bypassEligibility
          ? missingGender || missingNgayNhapNgu
          : missingGender || missingNgayNhapNgu || !canPropose,
        title: canPropose ? '' : (eligibilityResult.reason ?? ''),
      };
    },
    onSelect: (record: Personnel, selected: boolean) => {
      if (selected) {
        const result = getNienHanProposalEligibility(record);
        if (result.eligible) return;
        if (bypassEligibility) {
          const missingGender =
            !record.gioi_tinh || (record.gioi_tinh !== 'NAM' && record.gioi_tinh !== 'NU');
          if (!missingGender && record.ngay_nhap_ngu) {
            message.warning(
              `Cảnh báo: Quân nhân ${record.ho_ten} chưa đủ điều kiện khen thưởng niên hạn. Vẫn cho phép thêm khen thưởng quá khứ.`
            );
            return true;
          }
        }
        message.warning(`${record.ho_ten}: ${result.reason ?? 'Không đủ điều kiện'}`);
        return false;
      }
    },
  };

  return (
    <div>
      <Alert
        message="Bước 2: Lựa chọn quân nhân - Huy chương Chiến sĩ vẻ vang"
        description={
          <div>
            <p>1. Chọn năm và tháng đề xuất để hệ thống đánh giá điều kiện chính xác theo mốc thời gian.</p>
            <p>2. Lựa chọn quân nhân đủ điều kiện từ danh sách gợi ý.</p>
            <p>3. Đối chiếu thông tin ngày nhập ngũ, ngày xuất ngũ và thời gian công tác trước khi chọn.</p>
            <p>4. Hoàn tất lựa chọn, nhấn &quot;Tiếp tục&quot; để sang bước xác nhận danh hiệu.</p>
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
            reviewPath="/admin/awards/bulk/import-review-tenure-medals"
            sessionStorageKey="importPreviewDataHCCSVV"
          />

        </>
      )}

      <Space style={{ marginBottom: 16 }} size="middle" wrap>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Text strong>Năm đề xuất: </Text>
          <InputNumber
            value={localNam}
            onChange={value => {
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
