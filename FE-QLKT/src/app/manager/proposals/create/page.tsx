'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Card,
  Typography,
  Button,
  Upload,
  Steps,
  Space,
  Breadcrumb,
  Radio,
  Alert,
  message as antMessage,
  Descriptions,
  Tag,
  Table,
  Input,
  Empty,
} from 'antd';
import { getApiErrorMessage } from '@/lib/apiError';

import {
  UploadOutlined,
  HomeOutlined,
  TrophyOutlined,
  TeamOutlined,
  CheckCircleOutlined,
  ArrowLeftOutlined,
  EditOutlined,
} from '@ant-design/icons';
import Link from 'next/link';
import type { UploadFile } from 'antd/es/upload/interface';
import type { ColumnsType } from 'antd/es/table';
import type { DateInput } from '@/lib/types/common';
import { apiClient } from '@/lib/apiClient';
import {
  DANH_HIEU_CA_NHAN_HANG_NAM,
  DANH_HIEU_DON_VI_HANG_NAM,
  getDanhHieuName,
  HCQKQT_YEARS_REQUIRED,
} from '@/constants/danhHieu.constants';
import type { UnitApiRow, ContributionProfile } from '@/lib/types/personnelList';
import type { TitleDataItem } from '@/lib/types/proposal';
import {
  PROPOSAL_TYPES,
  requiresProposalMonth,
  type ProposalType,
} from '@/constants/proposal.constants';
import { PROPOSAL_TYPE_ICON_COMPONENTS } from '@/constants/proposalUi.constants';
import { FileAttachmentList } from '@/components/proposals/FileAttachmentList';
// Shared components — reuse from admin to avoid duplicating ~2000 lines
import { Step2SelectPersonnelCaNhanHangNam } from '@/components/proposals/bulk/Step2SelectPersonnelCaNhanHangNam';
import { Step2SelectPersonnelNienHan } from '@/components/proposals/bulk/Step2SelectPersonnelNienHan';
import { Step2SelectPersonnelHCQKQT } from '@/components/proposals/bulk/Step2SelectPersonnelHCQKQT';
import { Step2SelectPersonnelKNCVSNXDQDNDVN } from '@/components/proposals/bulk/Step2SelectPersonnelKNCVSNXDQDNDVN';
import { Step2SelectPersonnelCongHien } from '@/components/proposals/bulk/Step2SelectPersonnelCongHien';
import { Step2SelectPersonnelNCKH } from '@/components/proposals/bulk/Step2SelectPersonnelNCKH';
import { Step2SelectUnits } from '@/components/proposals/bulk/Step2SelectUnits';
import { Step3SetTitles } from '@/components/proposals/bulk/Step3SetTitles';

import {
  renderServiceTime,
  makeContributionColumns,
  fetchContributionProfiles,
} from '@/lib/award/serviceTimeHelpers';

const { Title, Paragraph, Text } = Typography;

interface Personnel {
  id: string;
  ho_ten: string;
  cccd: string;
  ngay_nhap_ngu?: DateInput;
  ngay_xuat_ngu?: DateInput;
  ChucVu?: {
    id: string;
    ten_chuc_vu: string;
  };
  cap_bac?: string;
  CoQuanDonVi?: {
    ten_don_vi: string;
  };
  DonViTrucThuoc?: {
    ten_don_vi: string;
  };
}

type ReviewRow = (Personnel | UnitApiRow) & Partial<TitleDataItem> & {
  id: string;
  co_quan_don_vi_id?: string | null;
};

export default function CreateProposalPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);

  // Step 1: Proposal Type
  const [proposalType, setProposalType] = useState<ProposalType>(PROPOSAL_TYPES.CA_NHAN_HANG_NAM);

  // Step 2: Select Personnel/Units
  const [nam, setNam] = useState(new Date().getFullYear());
  const [thang, setThang] = useState(new Date().getMonth() + 1);
  const [selectedPersonnelIds, setSelectedPersonnelIds] = useState<string[]>([]);
  const [selectedUnitIds, setSelectedUnitIds] = useState<string[]>([]);

  // Step 3: Set Titles
  const [titleData, setTitleData] = useState<TitleDataItem[]>([]);

  // HCBVTQ contribution profiles
  const [contributionProfiles, setContributionProfiles] = useState<
    Record<string, ContributionProfile>
  >({});

  // Step 4: Upload Files
  const [attachedFiles, setAttachedFiles] = useState<UploadFile[]>([]);

  // Step 5: Personnel/Unit details for review
  const [personnelDetails, setPersonnelDetails] = useState<Personnel[]>([]);
  const [unitDetails, setUnitDetails] = useState<UnitApiRow[]>([]);

  // Step 5: Note
  const [proposalNote, setProposalNote] = useState<string>('');

  const getProposalReferenceEndDate = (): Date => {
    if (Number.isInteger(thang) && thang >= 1 && thang <= 12) {
      return new Date(nam, thang, 0);
    }
    return new Date(nam, 11, 31);
  };

  const renderProposalTypeIcon = (type: ProposalType) => {
    const Icon = PROPOSAL_TYPE_ICON_COMPONENTS[type];
    return Icon ? <Icon /> : <TrophyOutlined />;
  };

  // Proposal type config
  const proposalTypeConfig: Partial<
    Record<ProposalType, { icon: React.ReactNode; label: string; description: string }>
  > = {
    [PROPOSAL_TYPES.CA_NHAN_HANG_NAM]: {
      icon: renderProposalTypeIcon(PROPOSAL_TYPES.CA_NHAN_HANG_NAM),
      label: 'Khen thưởng cá nhân hằng năm',
      description: 'Danh hiệu CSTT, CSTDCS, BKBQP, CSTĐTQ',
    },
    [PROPOSAL_TYPES.DON_VI_HANG_NAM]: {
      icon: renderProposalTypeIcon(PROPOSAL_TYPES.DON_VI_HANG_NAM),
      label: 'Khen thưởng đơn vị hằng năm',
      description: 'Danh hiệu ĐVTT, ĐVQT, BKBQP, BKTTCP',
    },
    [PROPOSAL_TYPES.NIEN_HAN]: {
      icon: renderProposalTypeIcon(PROPOSAL_TYPES.NIEN_HAN),
      label: 'Huy chương Chiến sĩ vẻ vang',
      description: 'Danh hiệu Huy chương Chiến sĩ vẻ vang 3 hạng (Ba, Nhì, Nhất)',
    },
    [PROPOSAL_TYPES.HC_QKQT]: {
      icon: renderProposalTypeIcon(PROPOSAL_TYPES.HC_QKQT),
      label: 'Huy chương Quân kỳ quyết thắng',
      description: 'Yêu cầu đủ 25 năm phục vụ trong QĐNDVN',
    },
    [PROPOSAL_TYPES.KNC_VSNXD_QDNDVN]: {
      icon: renderProposalTypeIcon(PROPOSAL_TYPES.KNC_VSNXD_QDNDVN),
      label: 'Kỷ niệm chương vì sự nghiệp xây dựng QĐNDVN',
      description:
        'Yêu cầu đủ 25 năm phục vụ đối với nam và 20 năm phục vụ đối với nữ trong QĐNDVN',
    },
    [PROPOSAL_TYPES.CONG_HIEN]: {
      icon: renderProposalTypeIcon(PROPOSAL_TYPES.CONG_HIEN),
      label: 'Huân chương Bảo vệ Tổ quốc',
      description: 'Danh hiệu Huân chương Bảo vệ Tổ quốc 3 hạng (Ba, Nhì, Nhất)',
    },
    [PROPOSAL_TYPES.NCKH]: {
      icon: renderProposalTypeIcon(PROPOSAL_TYPES.NCKH),
      label: 'Thành tích Nghiên cứu khoa học',
      description: 'Đề tài khoa học / Sáng kiến khoa học',
    },
  };

  // Steps config
  const getSteps = () => {
    const step2Title =
      proposalType === PROPOSAL_TYPES.DON_VI_HANG_NAM ? 'Chọn đơn vị' : 'Chọn quân nhân';
    return [
      { title: 'Chọn loại', icon: <TrophyOutlined /> },
      { title: step2Title, icon: <TeamOutlined /> },
      { title: 'Thêm danh hiệu', icon: <CheckCircleOutlined /> },
      { title: 'Upload file', icon: <UploadOutlined /> },
      { title: 'Xem lại & Gửi', icon: <CheckCircleOutlined /> },
    ];
  };
  const steps = getSteps();

  useEffect(() => {
    if (currentStep === 0) {
      setSelectedPersonnelIds([]);
      setSelectedUnitIds([]);
      setTitleData([]);
      setAttachedFiles([]);
      setPersonnelDetails([]);
      setUnitDetails([]);
      setProposalNote('');
    }
  }, [currentStep]);

  useEffect(() => {
    setSelectedPersonnelIds([]);
    setSelectedUnitIds([]);
    setTitleData([]);
    setAttachedFiles([]);
    setPersonnelDetails([]);
    setUnitDetails([]);
    setProposalNote('');
    setNam(new Date().getFullYear());
  }, [proposalType]);

  // Fetch personnel/unit details when reaching Step 5 (Review)
  useEffect(() => {
    if (currentStep === 4) {
      if (proposalType === PROPOSAL_TYPES.DON_VI_HANG_NAM && selectedUnitIds.length > 0) {
        fetchUnitDetails();
      } else if (selectedPersonnelIds.length > 0) {
        fetchPersonnelDetails();
      }
      if (proposalType === PROPOSAL_TYPES.CONG_HIEN && selectedPersonnelIds.length > 0) {
        loadContributionProfiles();
      }
    }
  }, [currentStep, proposalType, selectedUnitIds, selectedPersonnelIds]);

  const fetchPersonnelDetails = async () => {
    try {
      const promises = selectedPersonnelIds.map(id => apiClient.getPersonnelById(id));
      const responses = await Promise.all(promises);
      const personnelData = responses.filter(r => r.success).map(r => r.data);
      setPersonnelDetails(personnelData);
    } catch (error: unknown) {
      antMessage.error(getApiErrorMessage(error, 'Không tải được thông tin quân nhân'));
    }
  };

  const loadContributionProfiles = async () => {
    const profiles = await fetchContributionProfiles(selectedPersonnelIds);
    setContributionProfiles(profiles);
  };

  const fetchUnitDetails = async () => {
    try {
      const unitsRes = await apiClient.getMyUnits();
      if (unitsRes.success) {
        const unitsData = unitsRes.data || [];
        const selectedUnits = (unitsData as UnitApiRow[]).filter(unit =>
          selectedUnitIds.includes(unit.id)
        );
        setUnitDetails(selectedUnits);
      }
    } catch (error) {
      antMessage.error(getApiErrorMessage(error));
    }
  };

  // Validate current step
  const canProceedToNextStep = () => {
    switch (currentStep) {
      case 0: // Step 1: Type selected (always true)
        return true;
      case 1: // Step 2: Must select at least 1 personnel/unit
        if (proposalType === PROPOSAL_TYPES.DON_VI_HANG_NAM) {
          return selectedUnitIds.length > 0;
        }
        return selectedPersonnelIds.length > 0;
      case 2: // Step 3: All personnel/units must have titles set
        const expectedLength =
          proposalType === PROPOSAL_TYPES.DON_VI_HANG_NAM
            ? selectedUnitIds.length
            : selectedPersonnelIds.length;
        if (titleData.length !== expectedLength) return false;

        if (proposalType === PROPOSAL_TYPES.NCKH) {
          return titleData.every(d => d.loai && d.mo_ta && d.cap_bac && d.chuc_vu);
        }

        if (proposalType === PROPOSAL_TYPES.DON_VI_HANG_NAM) {
          return titleData.every(d => d.danh_hieu);
        }

        return titleData.every(d => d.danh_hieu && d.cap_bac?.trim() && d.chuc_vu?.trim());
      case 3: // Step 4: Always allow to continue (attachedFiles is optional)
        return true;
      default:
        return false;
    }
  };

  // Handle next step
  const handleNext = async () => {
    // KNC_VSNXD_QDNDVN: validate gender and enlistment date before advancing to Step 3
    if (
      currentStep === 1 &&
      proposalType === PROPOSAL_TYPES.KNC_VSNXD_QDNDVN &&
      selectedPersonnelIds.length > 0
    ) {
      try {
        const promises = selectedPersonnelIds.map(id => apiClient.getPersonnelById(id));
        const responses = await Promise.all(promises);
        const personnelData = responses.filter(r => r.success).map(r => r.data);

        const missingGender = personnelData.filter(
          p => !p.gioi_tinh || (p.gioi_tinh !== 'NAM' && p.gioi_tinh !== 'NU')
        );
        const missingNgayNhapNgu = personnelData.filter(p => !p.ngay_nhap_ngu);

        if (missingGender.length > 0 || missingNgayNhapNgu.length > 0) {
          const errors = [];
          if (missingGender.length > 0) {
            const names = missingGender.map(p => p.ho_ten).join(', ');
            errors.push(`chưa cập nhật giới tính: ${names}`);
          }
          if (missingNgayNhapNgu.length > 0) {
            const names = missingNgayNhapNgu.map(p => p.ho_ten).join(', ');
            errors.push(`chưa cập nhật ngày nhập ngũ: ${names}`);
          }
          antMessage.error(
            `Một số quân nhân ${errors.join(' và ')}. Vui lòng cập nhật trước khi tiếp tục.`
          );
          return;
        }
      } catch (error: unknown) {
        antMessage.error('Lỗi khi kiểm tra thông tin quân nhân');
        return;
      }
    }

    // NIEN_HAN: validate enlistment date before advancing to Step 3
    if (
      currentStep === 1 &&
      proposalType === PROPOSAL_TYPES.NIEN_HAN &&
      selectedPersonnelIds.length > 0
    ) {
      try {
        const promises = selectedPersonnelIds.map(id => apiClient.getPersonnelById(id));
        const responses = await Promise.all(promises);
        const personnelData = responses.filter(r => r.success).map(r => r.data);

        const missingNgayNhapNgu = personnelData.filter(p => !p.ngay_nhap_ngu);

        if (missingNgayNhapNgu.length > 0) {
          const names = missingNgayNhapNgu.map(p => p.ho_ten).join(', ');
          antMessage.error(
            `Một số quân nhân chưa cập nhật ngày nhập ngũ: ${names}. Vui lòng cập nhật trước khi tiếp tục.`
          );
          return;
        }
      } catch (error: unknown) {
        antMessage.error('Lỗi khi kiểm tra thông tin quân nhân');
        return;
      }
    }

    // HC_QKQT: validate >= 25 years of service before advancing to Step 3
    if (
      currentStep === 1 &&
      proposalType === PROPOSAL_TYPES.HC_QKQT &&
      selectedPersonnelIds.length > 0
    ) {
      try {
        const proposalReferenceEndDate = getProposalReferenceEndDate();
        const promises = selectedPersonnelIds.map(id => apiClient.getPersonnelById(id));
        const responses = await Promise.all(promises);
        const personnelData = responses.filter(r => r.success).map(r => r.data);

        const ineligiblePersonnel: Array<{ ho_ten: string; reason: string }> = [];

        for (const p of personnelData) {
          if (!p.ngay_nhap_ngu) {
            ineligiblePersonnel.push({
              ho_ten: p.ho_ten,
              reason: 'Chưa cập nhật ngày nhập ngũ',
            });
            continue;
          }

          const ngayNhapNgu = new Date(p.ngay_nhap_ngu);
          const ngayKetThuc = p.ngay_xuat_ngu
            ? new Date(p.ngay_xuat_ngu)
            : proposalReferenceEndDate;
          const effectiveEndDate =
            ngayKetThuc > proposalReferenceEndDate ? proposalReferenceEndDate : ngayKetThuc;

          const months = Math.max(
            0,
            (effectiveEndDate.getFullYear() - ngayNhapNgu.getFullYear()) * 12 +
              effectiveEndDate.getMonth() -
              ngayNhapNgu.getMonth()
          );
          const years = Math.floor(months / 12);

          // Requirement: >= 25 years of service (gender-neutral)
          if (years < HCQKQT_YEARS_REQUIRED) {
            ineligiblePersonnel.push({
              ho_ten: p.ho_ten,
              reason: `Chưa đủ ${HCQKQT_YEARS_REQUIRED} năm phục vụ (hiện tại: ${years} năm)`,
            });
          }
        }

        if (ineligiblePersonnel.length > 0) {
          const names = ineligiblePersonnel.map(p => `${p.ho_ten} (${p.reason})`).join(', ');
          antMessage.error(
            `Một số quân nhân chưa đủ điều kiện đề xuất Huy chương Quân kỳ quyết thắng (yêu cầu >= ${HCQKQT_YEARS_REQUIRED} năm): ${names}. Vui lòng cập nhật trước khi tiếp tục.`
          );
          return;
        }
      } catch (error: unknown) {
        antMessage.error('Lỗi khi kiểm tra thông tin quân nhân');
        return;
      }
    }

    if (canProceedToNextStep()) {
      setCurrentStep(currentStep + 1);
    } else {
      switch (currentStep) {
        case 1:
          if (proposalType === PROPOSAL_TYPES.DON_VI_HANG_NAM) {
            antMessage.warning('Vui lòng chọn ít nhất một đơn vị!');
          } else {
            antMessage.warning('Vui lòng chọn ít nhất một quân nhân!');
          }
          break;
        case 2:
          antMessage.warning('Vui lòng chọn danh hiệu cho tất cả quân nhân!');
          break;
        case 3:
          antMessage.warning('Vui lòng upload file đính kèm!');
          break;
      }
    }
  };

  // Handle previous step
  const handlePrev = () => {
    if (currentStep == 2) {
      setTitleData([]);
    }
    setCurrentStep(currentStep - 1);
  };

  // Handle submit
  const handleSubmit = async () => {
    try {
      setLoading(true);

      // KNC_VSNXD_QDNDVN: validate gender and enlistment date
      if (proposalType === PROPOSAL_TYPES.KNC_VSNXD_QDNDVN && selectedPersonnelIds.length > 0) {
        try {
          const promises = selectedPersonnelIds.map(id => apiClient.getPersonnelById(id));
          const responses = await Promise.all(promises);
          const personnelData = responses.filter(r => r.success).map(r => r.data);

          const missingGender = personnelData.filter(
            p => !p.gioi_tinh || (p.gioi_tinh !== 'NAM' && p.gioi_tinh !== 'NU')
          );
          const missingNgayNhapNgu = personnelData.filter(p => !p.ngay_nhap_ngu);

          if (missingGender.length > 0 || missingNgayNhapNgu.length > 0) {
            const errors = [];
            if (missingGender.length > 0) {
              const names = missingGender.map(p => p.ho_ten).join(', ');
              errors.push(`chưa cập nhật giới tính: ${names}`);
            }
            if (missingNgayNhapNgu.length > 0) {
              const names = missingNgayNhapNgu.map(p => p.ho_ten).join(', ');
              errors.push(`chưa cập nhật ngày nhập ngũ: ${names}`);
            }
            antMessage.error(
              `Một số quân nhân ${errors.join(' và ')}. Vui lòng cập nhật trước khi đề xuất.`
            );
            setLoading(false);
            return;
          }
        } catch (error: unknown) {
          antMessage.error('Lỗi khi kiểm tra thông tin quân nhân');
          setLoading(false);
          return;
        }
      }

      // NIEN_HAN: validate enlistment date
      if (proposalType === PROPOSAL_TYPES.NIEN_HAN && selectedPersonnelIds.length > 0) {
        try {
          const promises = selectedPersonnelIds.map(id => apiClient.getPersonnelById(id));
          const responses = await Promise.all(promises);
          const personnelData = responses.filter(r => r.success).map(r => r.data);

          const missingNgayNhapNgu = personnelData.filter(p => !p.ngay_nhap_ngu);

          if (missingNgayNhapNgu.length > 0) {
            const names = missingNgayNhapNgu.map(p => p.ho_ten).join(', ');
            antMessage.error(
              `Một số quân nhân chưa cập nhật ngày nhập ngũ: ${names}. Vui lòng cập nhật trước khi đề xuất.`
            );
            setLoading(false);
            return;
          }
        } catch (error: unknown) {
          antMessage.error('Lỗi khi kiểm tra thông tin quân nhân');
          setLoading(false);
          return;
        }
      }

      // Rank/position entered in Step 3 are required for all types except DON_VI_HANG_NAM
      if (proposalType !== PROPOSAL_TYPES.DON_VI_HANG_NAM && selectedPersonnelIds.length > 0) {
        const missingInfo = titleData.filter(item => !item.cap_bac || !item.chuc_vu);
        if (missingInfo.length > 0) {
          const missingNames = missingInfo
            .map(
              item =>
                personnelDetails.find(p => p.id === item.personnel_id)
                  ?.ho_ten
            )
            .filter(Boolean)
            .join(', ');
          antMessage.error(`Vui lòng nhập đầy đủ cấp bậc và chức vụ cho: ${missingNames}`);
          setLoading(false);
          return;
        }
      }

      // HC_QKQT: validate >= 25 years of service
      if (proposalType === PROPOSAL_TYPES.HC_QKQT && selectedPersonnelIds.length > 0) {
        try {
          const proposalReferenceEndDate = getProposalReferenceEndDate();
          const promises = selectedPersonnelIds.map(id => apiClient.getPersonnelById(id));
          const responses = await Promise.all(promises);
          const personnelData = responses.filter(r => r.success).map(r => r.data);

          const ineligiblePersonnel: Array<{ ho_ten: string; reason: string }> = [];

          for (const p of personnelData) {
            if (!p.ngay_nhap_ngu) {
              ineligiblePersonnel.push({
                ho_ten: p.ho_ten,
                reason: 'Chưa cập nhật ngày nhập ngũ',
              });
              continue;
            }

            const ngayNhapNgu = new Date(p.ngay_nhap_ngu);
            const ngayKetThuc = p.ngay_xuat_ngu
              ? new Date(p.ngay_xuat_ngu)
              : proposalReferenceEndDate;
            const effectiveEndDate =
              ngayKetThuc > proposalReferenceEndDate ? proposalReferenceEndDate : ngayKetThuc;

            let months = (effectiveEndDate.getFullYear() - ngayNhapNgu.getFullYear()) * 12;
            months += effectiveEndDate.getMonth() - ngayNhapNgu.getMonth();
            months = Math.max(0, months);

            const years = Math.floor(months / 12);

            // Requirement: >= 25 years of service (gender-neutral)
            if (years < 25) {
              ineligiblePersonnel.push({
                ho_ten: p.ho_ten,
                reason: `Chưa đủ 25 năm phục vụ (hiện tại: ${years} năm)`,
              });
            }
          }

          if (ineligiblePersonnel.length > 0) {
            const names = ineligiblePersonnel.map(p => `${p.ho_ten} (${p.reason})`).join(', ');
            antMessage.error(
              `Một số quân nhân chưa đủ điều kiện đề xuất Huy chương Quân kỳ quyết thắng (yêu cầu >= ${HCQKQT_YEARS_REQUIRED} năm): ${names}. Vui lòng cập nhật trước khi đề xuất.`
            );
            setLoading(false);
            return;
          }
        } catch (error: unknown) {
          antMessage.error('Lỗi khi kiểm tra thông tin quân nhân');
          setLoading(false);
          return;
        }
      }

      const formData = new FormData();
      formData.append('type', proposalType);
      formData.append('nam', String(nam));
      if (requiresProposalMonth(proposalType)) {
        if (!Number.isInteger(thang) || thang < 1 || thang > 12) {
          antMessage.error('Loại đề xuất này bắt buộc chọn tháng hợp lệ (1-12)');
          return;
        }
        formData.append('thang', String(thang));
      }

      if (proposalType === PROPOSAL_TYPES.DON_VI_HANG_NAM) {
        formData.append('selected_units', JSON.stringify(selectedUnitIds));
      } else {
        formData.append('selected_personnel', JSON.stringify(selectedPersonnelIds));
      }

      // Rank/position from Step 3 are submitted as-is; personnel data was only used to pre-fill
      formData.append('title_data', JSON.stringify(titleData));

      if (proposalNote.trim()) {
        formData.append('ghi_chu', proposalNote.trim());
      }

      if (attachedFiles.length > 0) {
        attachedFiles.forEach(file => {
          if (file.originFileObj) {
            formData.append('attached_files', file.originFileObj as File);
          }
        });
      }

      const result = await apiClient.submitProposal(formData);

      if (!result.success) {
        throw new Error(result.message || 'Gửi đề xuất thất bại');
      }

      antMessage.success('Gửi đề xuất thành công! Chờ Quản trị viên phê duyệt.');

      // Reset form
      setCurrentStep(0);
      setProposalType(PROPOSAL_TYPES.CA_NHAN_HANG_NAM);
      setNam(new Date().getFullYear());
      setSelectedPersonnelIds([]);
      setSelectedUnitIds([]);
      setTitleData([]);
      setAttachedFiles([]);
      setPersonnelDetails([]);
      setUnitDetails([]);
      setProposalNote('');

      setTimeout(() => {
        router.push('/manager/proposals');
      }, 1000);
    } catch (error: unknown) {
      antMessage.error(getApiErrorMessage(error, 'Lỗi khi gửi đề xuất'));
    } finally {
      setLoading(false);
    }
  };

  // Render step content
  const renderStepContent = () => {
    switch (currentStep) {
      case 0: // Step 1: Choose Type
        return (
          <div>
            <Alert
              message="Bước 1: Chọn loại khen thưởng"
              description="Vui lòng chọn loại khen thưởng bạn muốn đề xuất"
              type="info"
              showIcon
              style={{ marginBottom: 24 }}
            />
            <Radio.Group
              value={proposalType}
              onChange={e => setProposalType(e.target.value)}
              size="large"
              style={{ width: '100%' }}
            >
              <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                {Object.entries(proposalTypeConfig).map(([key, config]) => (
                  <Radio.Button
                    key={key}
                    value={key}
                    style={{ width: '100%', height: 'auto', padding: '16px' }}
                  >
                    <Space direction="vertical" size="small">
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span
                          style={{
                            fontSize: 20,
                            color: proposalType === key ? '#1890ff' : '#8c8c8c',
                          }}
                        >
                          {config.icon}
                        </span>
                        <Text strong style={{ fontSize: 16 }}>
                          {config.label}
                        </Text>
                      </div>
                      <Text
                        type="secondary"
                        style={{ fontSize: 13, display: 'block', marginLeft: 28 }}
                      >
                        {config.description}
                      </Text>
                    </Space>
                  </Radio.Button>
                ))}
              </Space>
            </Radio.Group>
          </div>
        );

      case 1: // Step 2: Select Personnel/Units
        if (proposalType === PROPOSAL_TYPES.DON_VI_HANG_NAM) {
          return (
            <Step2SelectUnits
              selectedUnitIds={selectedUnitIds}
              onUnitChange={setSelectedUnitIds}
              nam={nam}
              onNamChange={setNam}
              onTitleDataChange={setTitleData}
              isManager
              onNextStep={() => setCurrentStep(prev => prev + 1)}
            />
          );
        }
        switch (proposalType) {
          case PROPOSAL_TYPES.CA_NHAN_HANG_NAM:
            return (
              <Step2SelectPersonnelCaNhanHangNam
                selectedPersonnelIds={selectedPersonnelIds}
                onPersonnelChange={setSelectedPersonnelIds}
                nam={nam}
                onNamChange={setNam}
                titleData={titleData}
                onTitleDataChange={setTitleData}
                onNextStep={() => setCurrentStep(prev => prev + 1)}
                isManager
              />
            );
          case PROPOSAL_TYPES.NIEN_HAN:
            return (
              <Step2SelectPersonnelNienHan
                selectedPersonnelIds={selectedPersonnelIds}
                onPersonnelChange={setSelectedPersonnelIds}
                nam={nam}
                onNamChange={setNam}
                thang={thang}
                onThangChange={setThang}
                onTitleDataChange={setTitleData}
                onNextStep={() => setCurrentStep(prev => prev + 1)}
                isManager
              />
            );
          case PROPOSAL_TYPES.HC_QKQT:
            return (
              <Step2SelectPersonnelHCQKQT
                selectedPersonnelIds={selectedPersonnelIds}
                onPersonnelChange={setSelectedPersonnelIds}
                nam={nam}
                onNamChange={setNam}
                thang={thang}
                onThangChange={setThang}
                onTitleDataChange={setTitleData}
                onNextStep={() => setCurrentStep(prev => prev + 1)}
                isManager
              />
            );
          case PROPOSAL_TYPES.KNC_VSNXD_QDNDVN:
            return (
              <Step2SelectPersonnelKNCVSNXDQDNDVN
                selectedPersonnelIds={selectedPersonnelIds}
                onPersonnelChange={setSelectedPersonnelIds}
                nam={nam}
                onNamChange={setNam}
                thang={thang}
                onThangChange={setThang}
                onTitleDataChange={setTitleData}
                onNextStep={() => setCurrentStep(prev => prev + 1)}
                isManager
              />
            );
          case PROPOSAL_TYPES.CONG_HIEN:
            return (
              <Step2SelectPersonnelCongHien
                selectedPersonnelIds={selectedPersonnelIds}
                onPersonnelChange={setSelectedPersonnelIds}
                nam={nam}
                onNamChange={setNam}
                thang={thang}
                onThangChange={setThang}
                onTitleDataChange={setTitleData}
                onNextStep={() => setCurrentStep(prev => prev + 1)}
                isManager
              />
            );
          case PROPOSAL_TYPES.NCKH:
            return (
              <Step2SelectPersonnelNCKH
                selectedPersonnelIds={selectedPersonnelIds}
                onPersonnelChange={setSelectedPersonnelIds}
                nam={nam}
                onNamChange={setNam}
                onTitleDataChange={setTitleData}
                onNextStep={() => setCurrentStep(prev => prev + 1)}
                isManager
              />
            );
          default:
            return null;
        }

      case 2: // Step 3: Set Titles
        return (
          <Step3SetTitles
            selectedPersonnelIds={selectedPersonnelIds}
            selectedUnitIds={selectedUnitIds}
            proposalType={proposalType}
            titleData={titleData}
            onTitleDataChange={setTitleData}
            onPersonnelChange={setSelectedPersonnelIds}
            onUnitChange={setSelectedUnitIds}
            nam={nam}
            thang={thang}
          />
        );

      case 3: // Step 4: Upload Files
        return (
          <div>
            <Alert
              message="Bước 4: Upload file đính kèm"
              description="Upload các file đính kèm liên quan (tùy chọn, không giới hạn số lượng)"
              type="info"
              showIcon
              style={{ marginBottom: 24 }}
            />

            {/* Upload file đính kèm */}
            <Upload.Dragger
              fileList={attachedFiles}
              onChange={({ fileList }) => setAttachedFiles(fileList)}
              beforeUpload={() => false}
              multiple
              accept=".pdf,.doc,.docx,.xls,.xlsx"
            >
              <p className="ant-upload-drag-icon">
                <UploadOutlined style={{ fontSize: 48, color: '#1890ff' }} />
              </p>
              <p className="ant-upload-text">Click hoặc kéo file vào đây để upload</p>
              <p className="ant-upload-hint">
                Hỗ trợ: PDF, Word (.doc, .docx), Excel (.xls, .xlsx). Có thể chọn nhiều file cùng
                lúc, không giới hạn số lượng.
              </p>
            </Upload.Dragger>
          </div>
        );

      case 4: // Step 5: Review & Submit
        // Merge personnel/unit details with title data
        let reviewTableData: ReviewRow[] = [];

        if (proposalType === PROPOSAL_TYPES.DON_VI_HANG_NAM) {
          reviewTableData = unitDetails.map(unit => {
            const titleInfo = titleData.find(t => t.don_vi_id === unit.id);
            return {
              ...unit,
              ...titleInfo,
            };
          });
        } else {
          reviewTableData = personnelDetails.map(p => {
            const titleInfo = titleData.find(t => String(t.personnel_id) === String(p.id));
            return {
              ...p,
              ...titleInfo,
              cap_bac: titleInfo?.cap_bac || '',
              chuc_vu: titleInfo?.chuc_vu || '',
            };
          });
        }

        // Build table columns based on proposal type
        const reviewColumns: ColumnsType<ReviewRow> = [];

        if (proposalType === PROPOSAL_TYPES.DON_VI_HANG_NAM) {
          reviewColumns.push(
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
              render: (_, record) => {
                const type =
                  record.co_quan_don_vi_id || record.CoQuanDonVi
                    ? 'DON_VI_TRUC_THUOC'
                    : 'CO_QUAN_DON_VI';
                return (
                  <Tag color={type === 'CO_QUAN_DON_VI' ? 'blue' : 'green'}>
                    {type === 'CO_QUAN_DON_VI' ? 'Cơ quan đơn vị' : 'Đơn vị trực thuộc'}
                  </Tag>
                );
              },
            },
            {
              title: 'Mã đơn vị',
              dataIndex: 'ma_don_vi',
              key: 'ma_don_vi',
              width: 150,
              align: 'center',
              render: (text: string) => <Text code>{text}</Text>,
            },
            {
              title: 'Tên đơn vị',
              dataIndex: 'ten_don_vi',
              key: 'ten_don_vi',
              width: 250,
              align: 'center',
              render: (text: string) => <Text strong>{text}</Text>,
            }
          );
        } else {
          reviewColumns.push(
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
              render: (text: string) => <Text strong>{text}</Text>,
            },
            {
              title: 'Cấp bậc / Chức vụ',
              key: 'cap_bac_chuc_vu',
              width: 200,
              align: 'center',
              render: (_, record) => {
                // Rank/position from Step 3 — no fallback to current personnel data
                const capBac = record.cap_bac;
                const chucVu = record.chuc_vu;
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
            }
          );

          if (
            proposalType === PROPOSAL_TYPES.NIEN_HAN ||
            proposalType === PROPOSAL_TYPES.HC_QKQT ||
            proposalType === PROPOSAL_TYPES.KNC_VSNXD_QDNDVN
          ) {
            reviewColumns.push({
              title: 'Tổng thời gian',
              key: 'tong_thoi_gian',
              width: 150,
              align: 'center' as const,
              render: (_: unknown, record: ReviewRow) => renderServiceTime(record, nam, thang),
            });
          }

          if (proposalType === PROPOSAL_TYPES.CONG_HIEN) {
            reviewColumns.push(
              ...(makeContributionColumns(contributionProfiles) as ColumnsType<ReviewRow>)
            );
          }
        }

        // Add title/achievement columns based on type
        if (proposalType === PROPOSAL_TYPES.NCKH) {
          reviewColumns.push(
            {
              title: 'Loại',
              dataIndex: 'loai',
              key: 'loai',
              width: 160,
              align: 'center',
              render: (loai: string) => (
                <Tag color={loai === 'DTKH' ? 'blue' : 'green'}>
                  {loai === 'DTKH' ? 'Đề tài khoa học' : 'Sáng kiến khoa học'}
                </Tag>
              ),
            },
            {
              title: 'Mô tả',
              dataIndex: 'mo_ta',
              key: 'mo_ta',
              align: 'center',
              render: (_, record) => {
                const moTa = titleData.find(
                  t => String(t.personnel_id) === String(record.id)
                )?.mo_ta;
                return <Text>{moTa}</Text>;
              },
            }
          );
        } else {
          reviewColumns.push({
            title: 'Danh hiệu đề xuất',
            dataIndex: 'danh_hieu',
            key: 'danh_hieu',
            width: 250,
            align: 'center',
            render: (_, record) => {
              const titleInfo = titleData.find(
                t =>
                  String(t.personnel_id) === String(record.id) ||
                  String(t.don_vi_id) === String(record.id) ||
                  String(t.personnel_id) === String(record.id)
              );
              const danh_hieu = titleInfo?.danh_hieu;
              const fullName = getDanhHieuName(danh_hieu);
              return <Text>{fullName || '-'}</Text>;
            },
          });
        }

        const proposalTypeSummary = proposalTypeConfig[proposalType];

        return (
          <div>
            <Alert
              message="Bước 5: Xem lại thông tin và gửi đề xuất"
              description="Kiểm tra kỹ thông tin trước khi gửi"
              type="success"
              showIcon
              style={{ marginBottom: 24 }}
            />

            <Card title="Tóm tắt đề xuất" style={{ marginBottom: 16 }}>
              <Descriptions bordered column={2}>
                <Descriptions.Item label="Loại khen thưởng" span={2}>
                  {proposalTypeSummary ? (
                    <Tag icon={proposalTypeSummary.icon}>{proposalTypeSummary.label}</Tag>
                  ) : null}
                </Descriptions.Item>
                {requiresProposalMonth(proposalType) && (
                  <Descriptions.Item label="Tháng đề xuất">
                    <Text strong>{thang}</Text>
                  </Descriptions.Item>
                )}
                <Descriptions.Item label="Năm đề xuất">
                  <Text strong>{nam}</Text>
                </Descriptions.Item>
                <Descriptions.Item
                  label={
                    proposalType === PROPOSAL_TYPES.DON_VI_HANG_NAM ? 'Số đơn vị' : 'Số quân nhân'
                  }
                >
                  <Text strong>
                    {proposalType === PROPOSAL_TYPES.DON_VI_HANG_NAM
                      ? selectedUnitIds.length
                      : selectedPersonnelIds.length}
                  </Text>
                </Descriptions.Item>
                <Descriptions.Item label="File đính kèm" span={2}>
                  {attachedFiles.length > 0 ? (
                    <Text strong>{attachedFiles.length} file</Text>
                  ) : (
                    <Text type="secondary">Không có file</Text>
                  )}
                </Descriptions.Item>
              </Descriptions>
            </Card>

            {/* File đính kèm */}
            {attachedFiles.length > 0 && (
              <Card title="File đính kèm" style={{ marginTop: 16, marginBottom: 16 }}>
                <FileAttachmentList files={attachedFiles} mode="local" />
              </Card>
            )}

            <Card
              title={
                <div style={{ display: 'flex', alignItems: 'baseline' }}>
                  <span>
                    {proposalType === PROPOSAL_TYPES.DON_VI_HANG_NAM
                      ? 'Danh sách đơn vị và danh hiệu'
                      : 'Danh sách quân nhân và danh hiệu'}
                  </span>
                  {(proposalType === PROPOSAL_TYPES.CA_NHAN_HANG_NAM ||
                    proposalType === PROPOSAL_TYPES.DON_VI_HANG_NAM) &&
                    reviewTableData.length > 0 &&
                    (() => {
                      const allowedTitles: string[] = [
                        DANH_HIEU_CA_NHAN_HANG_NAM.CSTT,
                        DANH_HIEU_CA_NHAN_HANG_NAM.CSTDCS,
                        DANH_HIEU_DON_VI_HANG_NAM.DVTT,
                        DANH_HIEU_DON_VI_HANG_NAM.DVQT,
                      ];
                      const titleCounts: Record<string, number> = {};

                      reviewTableData.forEach(item => {
                        const title = item.danh_hieu;
                        if (title && allowedTitles.includes(title)) {
                          titleCounts[title] = (titleCounts[title] || 0) + 1;
                        }
                      });

                      if (Object.keys(titleCounts).length === 0) return null;

                      const total = Object.values(titleCounts).reduce(
                        (sum, count) => sum + count,
                        0
                      );
                      const percentages = Object.entries(titleCounts).map(([title, count]) => ({
                        title,
                        count,
                        percentage: ((count / total) * 100).toFixed(1),
                      }));

                      return (
                        <span
                          style={{
                            fontSize: '14px',
                            marginLeft: '12px',
                            color: '#1890ff',
                            fontWeight: 600,
                          }}
                        >
                          (
                          {percentages.map((item, idx) => (
                            <span key={item.title}>
                              {item.title}: {item.count} ({item.percentage}%)
                              {idx < percentages.length - 1 ? ', ' : ''}
                            </span>
                          ))}
                          )
                        </span>
                      );
                    })()}
                </div>
              }
            >
              <Table
                columns={reviewColumns}
                dataSource={reviewTableData}
                rowKey="id"
                pagination={false}
                size="small"
                bordered
                scroll={{
                  x:
                    proposalType === PROPOSAL_TYPES.NCKH
                      ? 1100
                      : proposalType === PROPOSAL_TYPES.NIEN_HAN ||
                          proposalType === PROPOSAL_TYPES.HC_QKQT ||
                          proposalType === PROPOSAL_TYPES.KNC_VSNXD_QDNDVN
                        ? 1150
                        : 1000,
                }}
                locale={{
                  emptyText: <Empty description="Không có dữ liệu" />,
                }}
              />
            </Card>

            {/* Ghi chú */}
            <Card
              title={
                <Space>
                  <EditOutlined />
                  <span>Ghi chú (tùy chọn)</span>
                </Space>
              }
              style={{ marginTop: 16 }}
            >
              <Input.TextArea
                placeholder="Nhập ghi chú cho đề xuất này (không bắt buộc)..."
                value={proposalNote}
                onChange={e => setProposalNote(e.target.value)}
                rows={3}
                maxLength={1000}
                showCount
              />
            </Card>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div style={{ padding: '24px' }}>
      {/* Breadcrumb */}
      <Breadcrumb
        style={{ marginBottom: 16 }}
        items={[
          {
            title: (
              <Link href="/manager/dashboard">
                <HomeOutlined />
              </Link>
            ),
          },
          {
            title: 'Tạo danh sách đề xuất khen thưởng',
          },
        ]}
      />

      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 8 }}>
          <Button
            icon={<ArrowLeftOutlined />}
            onClick={() => {
              if (currentStep === 0) {
                router.push('/manager/proposals');
              } else {
                setCurrentStep(0);
              }
            }}
            style={{ marginBottom: 0 }}
          >
            {currentStep === 0 ? 'Quay lại danh sách' : 'Quay lại chọn loại đề xuất'}
          </Button>
        </div>
        <Title level={2} style={{ marginBottom: 8 }}>
          Tạo danh sách đề xuất khen thưởng
        </Title>
        <Paragraph type="secondary">
          Theo dõi các bước bên dưới để hoàn thành đề xuất khen thưởng
        </Paragraph>
      </div>

      {/* Steps Progress */}
      <Card style={{ marginBottom: 24 }}>
        <Steps current={currentStep} items={steps} />
      </Card>

      {/* Step Content */}
      <Card style={{ marginBottom: 24, minHeight: 400 }}>{renderStepContent()}</Card>

      {/* Navigation */}
      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <Button size="large" onClick={handlePrev} disabled={currentStep === 0}>
            Quay lại
          </Button>
          <div>
            {currentStep < steps.length - 1 ? (
              <Button
                type="primary"
                size="large"
                onClick={handleNext}
                disabled={!canProceedToNextStep()}
              >
                Tiếp tục
              </Button>
            ) : (
              <Button
                type="primary"
                size="large"
                onClick={handleSubmit}
                loading={loading}
                disabled={loading}
                icon={<CheckCircleOutlined />}
              >
                Gửi đề xuất
              </Button>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}
