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
  Divider,
  Descriptions,
  Tag,
  Table,
  Input,
  Row,
  Col,
} from 'antd';
import { getApiErrorMessage } from '@/lib/apiError';

import {
  UploadOutlined,
  DownloadOutlined,
  HomeOutlined,
  TrophyOutlined,
  TeamOutlined,
  ClockCircleOutlined,
  HeartOutlined,
  ExperimentOutlined,
  CheckCircleOutlined,
  ArrowLeftOutlined,
  EditOutlined,
  FileOutlined,
} from '@ant-design/icons';
import Link from 'next/link';
import type { UploadFile } from 'antd/es/upload/interface';
import type { ColumnsType } from 'antd/es/table';
import type { DateInput } from '@/lib/types';
import { apiClient } from '@/lib/api-client';
import axiosInstance from '@/utils/axiosInstance';
import { getDanhHieuName } from '@/constants/danhHieu.constants';
// Shared components - reuse từ admin (DRY principle, tránh duplicate ~2000 dòng code)
import Step2SelectPersonnelCaNhanHangNam from '@/app/admin/awards/bulk/create/components/Step2SelectPersonnelCaNhanHangNam';
import Step2SelectPersonnelNienHan from '@/app/admin/awards/bulk/create/components/Step2SelectPersonnelNienHan';
import Step2SelectPersonnelHCQKQT from '@/app/admin/awards/bulk/create/components/Step2SelectPersonnelHCQKQT';
import Step2SelectPersonnelKNCVSNXD from '@/app/admin/awards/bulk/create/components/Step2SelectPersonnelKNCVSNXD';
import Step2SelectPersonnelCongHien from '@/app/admin/awards/bulk/create/components/Step2SelectPersonnelCongHien';
import Step2SelectPersonnelNCKH from '@/app/admin/awards/bulk/create/components/Step2SelectPersonnelNCKH';
import Step2SelectUnits from '@/app/admin/awards/bulk/create/components/Step2SelectUnits';
import Step3SetTitles from '@/app/admin/awards/bulk/create/components/Step3SetTitles';

const { Title, Paragraph, Text } = Typography;

type ProposalType =
  | 'CA_NHAN_HANG_NAM'
  | 'DON_VI_HANG_NAM'
  | 'NIEN_HAN'
  | 'HC_QKQT'
  | 'KNC_VSNXD_QDNDVN'
  | 'CONG_HIEN'
  | 'NCKH';

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

export default function CreateProposalPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);

  // Step 1: Proposal Type
  const [proposalType, setProposalType] = useState<ProposalType>('CA_NHAN_HANG_NAM');

  // Step 2: Select Personnel/Units
  const [nam, setNam] = useState(new Date().getFullYear());
  const [selectedPersonnelIds, setSelectedPersonnelIds] = useState<string[]>([]);
  const [selectedUnitIds, setSelectedUnitIds] = useState<string[]>([]);

  // Step 3: Set Titles
  const [titleData, setTitleData] = useState<any[]>([]);

  // Step 4: Upload Files
  const [attachedFiles, setAttachedFiles] = useState<UploadFile[]>([]); // File đính kèm (optional)

  // Step 5: Personnel/Unit details for review
  const [personnelDetails, setPersonnelDetails] = useState<Personnel[]>([]);
  const [unitDetails, setUnitDetails] = useState<any[]>([]);

  // Step 5: Note
  const [proposalNote, setProposalNote] = useState<string>('');

  // Proposal type config
  const proposalTypeConfig: Record<
    ProposalType,
    { icon: React.ReactNode; label: string; description: string }
  > = {
    CA_NHAN_HANG_NAM: {
      icon: <TrophyOutlined />,
      label: 'Cá nhân Hằng năm',
      description: 'Danh hiệu CSTT-CS, CSTĐ-CS, BK-BQP, CSTĐ-TQ',
    },
    DON_VI_HANG_NAM: {
      icon: <TeamOutlined />,
      label: 'Đơn vị Hằng năm',
      description: 'ĐVTT, ĐVQT, BK-BQP, BK-TTCP',
    },
    NIEN_HAN: {
      icon: <ClockCircleOutlined />,
      label: 'Huy chương Chiến sĩ vẻ vang',
      description: 'Huy chương Chiến sĩ vẻ vang 3 hạng',
    },
    HC_QKQT: {
      icon: <TrophyOutlined />,
      label: 'Huy chương Quân kỳ quyết thắng',
      description: 'HC Quân kỳ quyết thắng',
    },
    KNC_VSNXD_QDNDVN: {
      icon: <TrophyOutlined />,
      label: 'Kỷ niệm chương VSNXD QĐNDVN',
      description: 'Kỷ niệm chương Vì sự nghiệp xây dựng QĐNDVN',
    },
    CONG_HIEN: {
      icon: <HeartOutlined />,
      label: 'Huân chương Bảo vệ Tổ quốc',
      description: 'Huân chương Bảo vệ Tổ quốc 3 hạng',
    },
    NCKH: {
      icon: <ExperimentOutlined />,
      label: 'Nghiên cứu khoa học',
      description: 'Đề tài khoa học / Sáng kiến khoa học',
    },
  };

  // Steps config
  const getSteps = () => {
    const step2Title = proposalType === 'DON_VI_HANG_NAM' ? 'Chọn đơn vị' : 'Chọn quân nhân';
    return [
      { title: 'Chọn loại', icon: <TrophyOutlined /> },
      { title: step2Title, icon: <TeamOutlined /> },
      { title: 'Thêm danh hiệu', icon: <CheckCircleOutlined /> },
      { title: 'Upload file', icon: <UploadOutlined /> },
      { title: 'Xem lại & Gửi', icon: <CheckCircleOutlined /> },
    ];
  };
  const steps = getSteps();

  // Chỉ set năm hiện tại lần đầu khi component mount (nếu chưa có giá trị)
  useEffect(() => {
    if (!nam) {
      const currentYear = new Date().getFullYear();
      setNam(currentYear);
    }
  }, []);

  // Reset state khi quay lại bước 1 (chọn loại đề xuất)
  useEffect(() => {
    if (currentStep === 0) {
      // Reset tất cả state liên quan đến quân nhân/đơn vị đã chọn
      setSelectedPersonnelIds([]);
      setSelectedUnitIds([]);
      setTitleData([]);
      setAttachedFiles([]);
      setPersonnelDetails([]);
      setUnitDetails([]);
      setProposalNote('');
    }
  }, [currentStep]);

  // Reset state khi thay đổi loại đề xuất
  useEffect(() => {
    // Reset tất cả state khi thay đổi loại đề xuất
    setSelectedPersonnelIds([]);
    setSelectedUnitIds([]);
    setTitleData([]);
    setAttachedFiles([]);
    setPersonnelDetails([]);
    setUnitDetails([]);
    setProposalNote('');
    // Reset về năm hiện tại khi đổi loại đề xuất
    setNam(new Date().getFullYear());
  }, [proposalType]);

  // Fetch personnel/unit details when reaching Step 5 (Review)
  useEffect(() => {
    if (currentStep === 4) {
      if (proposalType === 'DON_VI_HANG_NAM' && selectedUnitIds.length > 0) {
        fetchUnitDetails();
      } else if (selectedPersonnelIds.length > 0) {
        fetchPersonnelDetails();
      }
    }
  }, [currentStep, proposalType, selectedUnitIds, selectedPersonnelIds]);

  const fetchPersonnelDetails = async () => {
    try {
      const promises = selectedPersonnelIds.map(id => axiosInstance.get(`/api/personnel/${id}`));
      const responses = await Promise.all(promises);
      const personnelData = responses.filter(r => r.data.success).map(r => r.data.data);
      setPersonnelDetails(personnelData);
    } catch (error) {
      // Error handled by UI
    }
  };

  const fetchUnitDetails = async () => {
    try {
      // Gọi API để lấy đơn vị của Manager
      const unitsRes = await apiClient.getMyUnits();

      if (unitsRes.success) {
        const unitsData = unitsRes.data || [];

        // Lọc các đơn vị đã chọn
        const selectedUnits = unitsData.filter((unit: any) => selectedUnitIds.includes(unit.id));
        setUnitDetails(selectedUnits);
      } else {
        // Failed to fetch units
      }
    } catch (error) {
      // Error handled by UI
    }
  };

  // Validate current step
  const canProceedToNextStep = () => {
    switch (currentStep) {
      case 0: // Step 1: Type selected (always true)
        return true;
      case 1: // Step 2: Must select at least 1 personnel/unit
        if (proposalType === 'DON_VI_HANG_NAM') {
          return selectedUnitIds.length > 0;
        }
        return selectedPersonnelIds.length > 0;
      case 2: // Step 3: All personnel/units must have titles set
        const expectedLength =
          proposalType === 'DON_VI_HANG_NAM' ? selectedUnitIds.length : selectedPersonnelIds.length;
        if (titleData.length !== expectedLength) return false;

        if (proposalType === 'NCKH') {
          // Kiểm tra loại, mô tả, cấp bậc và chức vụ
          return titleData.every(d => d.loai && d.mo_ta && d.cap_bac && d.chuc_vu);
        }

        if (proposalType === 'DON_VI_HANG_NAM') {
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
    // Validation đặc biệt cho KNC_VSNXD_QDNDVN: Kiểm tra giới tính và ngày nhập ngũ khi chuyển từ Step 2 sang Step 3
    if (
      currentStep === 1 &&
      proposalType === 'KNC_VSNXD_QDNDVN' &&
      selectedPersonnelIds.length > 0
    ) {
      try {
        const promises = selectedPersonnelIds.map(id => axiosInstance.get(`/api/personnel/${id}`));
        const responses = await Promise.all(promises);
        const personnelData = responses.filter(r => r.data.success).map(r => r.data.data);

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
        // Error handled by UI
        antMessage.error('Lỗi khi kiểm tra thông tin quân nhân');
        return;
      }
    }

    // Validation cho NIEN_HAN: Kiểm tra ngày nhập ngũ khi chuyển từ Step 2 sang Step 3
    if (currentStep === 1 && proposalType === 'NIEN_HAN' && selectedPersonnelIds.length > 0) {
      try {
        const promises = selectedPersonnelIds.map(id => axiosInstance.get(`/api/personnel/${id}`));
        const responses = await Promise.all(promises);
        const personnelData = responses.filter(r => r.data.success).map(r => r.data.data);

        const missingNgayNhapNgu = personnelData.filter(p => !p.ngay_nhap_ngu);

        if (missingNgayNhapNgu.length > 0) {
          const names = missingNgayNhapNgu.map(p => p.ho_ten).join(', ');
          antMessage.error(
            `Một số quân nhân chưa cập nhật ngày nhập ngũ: ${names}. Vui lòng cập nhật trước khi tiếp tục.`
          );
          return;
        }
      } catch (error: unknown) {
        // Error handled by UI
        antMessage.error('Lỗi khi kiểm tra thông tin quân nhân');
        return;
      }
    }

    // Validation cho HC_QKQT: Kiểm tra >= 25 năm phục vụ khi chuyển từ Step 2 sang Step 3
    if (currentStep === 1 && proposalType === 'HC_QKQT' && selectedPersonnelIds.length > 0) {
      try {
        const promises = selectedPersonnelIds.map(id => axiosInstance.get(`/api/personnel/${id}`));
        const responses = await Promise.all(promises);
        const personnelData = responses.filter(r => r.data.success).map(r => r.data.data);

        const ineligiblePersonnel: Array<{ ho_ten: string; reason: string }> = [];

        for (const p of personnelData) {
          if (!p.ngay_nhap_ngu) {
            ineligiblePersonnel.push({
              ho_ten: p.ho_ten,
              reason: 'Chưa cập nhật ngày nhập ngũ',
            });
            continue;
          }

          // Tính số năm phục vụ
          const ngayNhapNgu = new Date(p.ngay_nhap_ngu);
          const ngayKetThuc = p.ngay_xuat_ngu ? new Date(p.ngay_xuat_ngu) : new Date();

          let months = (ngayKetThuc.getFullYear() - ngayNhapNgu.getFullYear()) * 12;
          months += ngayKetThuc.getMonth() - ngayNhapNgu.getMonth();
          if (ngayKetThuc.getDate() < ngayNhapNgu.getDate()) {
            months--;
          }
          months = Math.max(0, months);

          const years = Math.floor(months / 12);

          // Yêu cầu: >= 25 năm (không phân biệt nam nữ)
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
            `Một số quân nhân chưa đủ điều kiện đề xuất Huy chương Quân kỳ quyết thắng (yêu cầu >= 25 năm): ${names}. Vui lòng cập nhật trước khi tiếp tục.`
          );
          return;
        }
      } catch (error: unknown) {
        // Error handled by UI
        antMessage.error('Lỗi khi kiểm tra thông tin quân nhân');
        return;
      }
    }

    if (canProceedToNextStep()) {
      setCurrentStep(currentStep + 1);
    } else {
      switch (currentStep) {
        case 1:
          if (proposalType === 'DON_VI_HANG_NAM') {
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

      // Validation cho KNC_VSNXD_QDNDVN: Kiểm tra giới tính và ngày nhập ngũ
      if (proposalType === 'KNC_VSNXD_QDNDVN' && selectedPersonnelIds.length > 0) {
        try {
          const promises = selectedPersonnelIds.map(id =>
            axiosInstance.get(`/api/personnel/${id}`)
          );
          const responses = await Promise.all(promises);
          const personnelData = responses.filter(r => r.data.success).map(r => r.data.data);

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
          // Error handled by UI
          antMessage.error('Lỗi khi kiểm tra thông tin quân nhân');
          setLoading(false);
          return;
        }
      }

      // Validation cho NIEN_HAN: Kiểm tra ngày nhập ngũ
      if (proposalType === 'NIEN_HAN' && selectedPersonnelIds.length > 0) {
        try {
          const promises = selectedPersonnelIds.map(id =>
            axiosInstance.get(`/api/personnel/${id}`)
          );
          const responses = await Promise.all(promises);
          const personnelData = responses.filter(r => r.data.success).map(r => r.data.data);

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
          // Error handled by UI
          antMessage.error('Lỗi khi kiểm tra thông tin quân nhân');
          setLoading(false);
          return;
        }
      }

      // Validation cho cấp bậc và chức vụ bắt buộc (cho tất cả loại trừ DON_VI_HANG_NAM)
      // Cấp bậc/chức vụ đã được nhập ở bước 3 (Set Titles), kiểm tra trong titleData
      if (proposalType !== 'DON_VI_HANG_NAM' && selectedPersonnelIds.length > 0) {
        const missingInfo = titleData.filter(item => !item.cap_bac || !item.chuc_vu);
        if (missingInfo.length > 0) {
          const missingNames = missingInfo
            .map(
              item =>
                personnelDetails.find(p => p.id === item.personnel_id || p.id === item.personnelId)
                  ?.ho_ten
            )
            .filter(Boolean)
            .join(', ');
          antMessage.error(`Vui lòng nhập đầy đủ cấp bậc và chức vụ cho: ${missingNames}`);
          setLoading(false);
          return;
        }
      }

      // Validation cho HC_QKQT: Kiểm tra >= 25 năm phục vụ
      if (proposalType === 'HC_QKQT' && selectedPersonnelIds.length > 0) {
        try {
          const promises = selectedPersonnelIds.map(id =>
            axiosInstance.get(`/api/personnel/${id}`)
          );
          const responses = await Promise.all(promises);
          const personnelData = responses.filter(r => r.data.success).map(r => r.data.data);

          const ineligiblePersonnel: Array<{ ho_ten: string; reason: string }> = [];

          for (const p of personnelData) {
            if (!p.ngay_nhap_ngu) {
              ineligiblePersonnel.push({
                ho_ten: p.ho_ten,
                reason: 'Chưa cập nhật ngày nhập ngũ',
              });
              continue;
            }

            // Tính số năm phục vụ
            const ngayNhapNgu = new Date(p.ngay_nhap_ngu);
            const ngayKetThuc = p.ngay_xuat_ngu ? new Date(p.ngay_xuat_ngu) : new Date();

            let months = (ngayKetThuc.getFullYear() - ngayNhapNgu.getFullYear()) * 12;
            months += ngayKetThuc.getMonth() - ngayNhapNgu.getMonth();
            if (ngayKetThuc.getDate() < ngayNhapNgu.getDate()) {
              months--;
            }
            months = Math.max(0, months);

            const years = Math.floor(months / 12);

            // Yêu cầu: >= 25 năm (không phân biệt nam nữ)
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
              `Một số quân nhân chưa đủ điều kiện đề xuất Huy chương Quân kỳ quyết thắng (yêu cầu >= 25 năm): ${names}. Vui lòng cập nhật trước khi đề xuất.`
            );
            setLoading(false);
            return;
          }
        } catch (error: unknown) {
          // Error handled by UI
          antMessage.error('Lỗi khi kiểm tra thông tin quân nhân');
          setLoading(false);
          return;
        }
      }

      // Tạo FormData
      const formData = new FormData();
      formData.append('type', proposalType);
      formData.append('nam', String(nam));

      if (proposalType === 'DON_VI_HANG_NAM') {
        formData.append('selected_units', JSON.stringify(selectedUnitIds));
      } else {
        formData.append('selected_personnel', JSON.stringify(selectedPersonnelIds));
      }

      // titleData đã có cap_bac và chuc_vu từ bước 3 (Set Titles)
      // Gửi đúng dữ liệu đã sửa ở bước 3, KHÔNG fallback về personnel (giống khen thưởng đột xuất)
      // Cấp bậc/chức vụ từ personnel chỉ để điền sẵn ở bước 3, không dùng khi submit
      formData.append('title_data', JSON.stringify(titleData));

      // Gửi ghi chú nếu có
      if (proposalNote.trim()) {
        formData.append('ghi_chu', proposalNote.trim());
      }

      // Upload các file đính kèm (optional, multiple)
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
      setProposalType('CA_NHAN_HANG_NAM');
      setNam(new Date().getFullYear()); // Reset về năm hiện tại
      setSelectedPersonnelIds([]);
      setSelectedUnitIds([]);
      setTitleData([]);
      setAttachedFiles([]);
      setPersonnelDetails([]);
      setUnitDetails([]);
      setProposalNote('');

      // Chuyển về trang danh sách đề xuất sau 1 giây
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
        if (proposalType === 'DON_VI_HANG_NAM') {
          return (
            <Step2SelectUnits
              selectedUnitIds={selectedUnitIds}
              onUnitChange={setSelectedUnitIds}
              nam={nam}
              onNamChange={setNam}
              onTitleDataChange={setTitleData}
              onNextStep={() => setCurrentStep(prev => prev + 1)}
            />
          );
        }
        // Render component riêng cho từng loại đề xuất
        switch (proposalType) {
          case 'CA_NHAN_HANG_NAM':
            return (
              <Step2SelectPersonnelCaNhanHangNam
                selectedPersonnelIds={selectedPersonnelIds}
                onPersonnelChange={setSelectedPersonnelIds}
                nam={nam}
                onNamChange={setNam}
                titleData={titleData}
                onTitleDataChange={setTitleData}
                onNextStep={() => setCurrentStep(prev => prev + 1)}
              />
            );
          case 'NIEN_HAN':
            return (
              <Step2SelectPersonnelNienHan
                selectedPersonnelIds={selectedPersonnelIds}
                onPersonnelChange={setSelectedPersonnelIds}
                nam={nam}
                onNamChange={setNam}
                onTitleDataChange={setTitleData}
                onNextStep={() => setCurrentStep(prev => prev + 1)}
              />
            );
          case 'HC_QKQT':
            return (
              <Step2SelectPersonnelHCQKQT
                selectedPersonnelIds={selectedPersonnelIds}
                onPersonnelChange={setSelectedPersonnelIds}
                nam={nam}
                onNamChange={setNam}
                onTitleDataChange={setTitleData}
                onNextStep={() => setCurrentStep(prev => prev + 1)}
              />
            );
          case 'KNC_VSNXD_QDNDVN':
            return (
              <Step2SelectPersonnelKNCVSNXD
                selectedPersonnelIds={selectedPersonnelIds}
                onPersonnelChange={setSelectedPersonnelIds}
                nam={nam}
                onNamChange={setNam}
                onTitleDataChange={setTitleData}
                onNextStep={() => setCurrentStep(prev => prev + 1)}
              />
            );
          case 'CONG_HIEN':
            return (
              <Step2SelectPersonnelCongHien
                selectedPersonnelIds={selectedPersonnelIds}
                onPersonnelChange={setSelectedPersonnelIds}
                nam={nam}
                onNamChange={setNam}
                onTitleDataChange={setTitleData}
                onNextStep={() => setCurrentStep(prev => prev + 1)}
              />
            );
          case 'NCKH':
            return (
              <Step2SelectPersonnelNCKH
                selectedPersonnelIds={selectedPersonnelIds}
                onPersonnelChange={setSelectedPersonnelIds}
                nam={nam}
                onNamChange={setNam}
                onTitleDataChange={setTitleData}
                onNextStep={() => setCurrentStep(prev => prev + 1)}
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
        let reviewTableData: any[] = [];

        if (proposalType === 'DON_VI_HANG_NAM') {
          reviewTableData = unitDetails.map(unit => {
            const titleInfo = titleData.find(t => t.don_vi_id === unit.id);
            return {
              ...unit,
              ...titleInfo,
            };
          });
        } else {
          // Merge titleData vào reviewTableData
          // titleData đã có cap_bac và chuc_vu từ bước 3 (đã được sửa hoặc điền sẵn)
          // Ưu tiên dữ liệu từ titleData, không fallback về personnel details
          reviewTableData = personnelDetails.map(p => {
            const titleInfo = titleData.find(t => String(t.personnel_id) === String(p.id));
            return {
              ...p,
              ...titleInfo,
              // Đảm bảo cap_bac và chuc_vu từ titleData được ưu tiên (giống khen thưởng đột xuất)
              cap_bac: titleInfo?.cap_bac || '',
              chuc_vu: titleInfo?.chuc_vu || '',
            };
          });
        }

        // Build table columns based on proposal type
        const reviewColumns: ColumnsType<any> = [];

        if (proposalType === 'DON_VI_HANG_NAM') {
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
              render: (_, record: any) => {
                // Hiển thị cấp bậc/chức vụ từ titleData (đã được sửa ở bước 3)
                // KHÔNG fallback về personnel details (giống khen thưởng đột xuất)
                // Cấp bậc/chức vụ từ personnel chỉ để điền sẵn ở bước 3, không dùng ở bước 5
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

          // Thêm cột Tổng tháng cho đề xuất Niên hạn
          if (
            proposalType === 'NIEN_HAN' ||
            proposalType === 'HC_QKQT' ||
            proposalType === 'KNC_VSNXD_QDNDVN'
          ) {
            // Hàm tính tổng số tháng
            const calculateTotalMonths = (
              ngayNhapNgu: DateInput,
              ngayXuatNgu: DateInput
            ) => {
              if (!ngayNhapNgu) return null;

              try {
                const startDate =
                  typeof ngayNhapNgu === 'string' ? new Date(ngayNhapNgu) : ngayNhapNgu;
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
                  const lastDayOfPrevMonth = new Date(
                    endDate.getFullYear(),
                    endDate.getMonth(),
                    0
                  ).getDate();
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

            reviewColumns.push({
              title: 'Tổng tháng',
              key: 'tong_thang',
              width: 150,
              align: 'center' as const,
              render: (_: any, record: any) => {
                const result = calculateTotalMonths(record.ngay_nhap_ngu, record.ngay_xuat_ngu);
                if (!result) return <Text type="secondary">-</Text>;

                // Hiển thị năm ở trên, tháng nhỏ bên dưới
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
            });
          }
        }

        // Add title/achievement columns based on type
        if (proposalType === 'NCKH') {
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
                  t =>
                    String(t.personnelId) === String(record.id) ||
                    String(t.personnel_id) === String(record.id)
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
              // Lấy danh_hieu trực tiếp từ titleData để đảm bảo chính xác
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
                  <Tag icon={proposalTypeConfig[proposalType].icon}>
                    {proposalTypeConfig[proposalType].label}
                  </Tag>
                </Descriptions.Item>
                <Descriptions.Item label="Năm đề xuất">
                  <Text strong>{nam}</Text>
                </Descriptions.Item>
                <Descriptions.Item
                  label={proposalType === 'DON_VI_HANG_NAM' ? 'Số đơn vị' : 'Số quân nhân'}
                >
                  <Text strong>
                    {proposalType === 'DON_VI_HANG_NAM'
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
                <Space direction="vertical" style={{ width: '100%' }} size="middle">
                  {attachedFiles.map((file, index) => (
                    <div
                      key={index}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '8px 12px',
                        backgroundColor: 'rgba(0, 0, 0, 0.02)',
                        border: '1px solid rgba(0, 0, 0, 0.06)',
                        borderRadius: '4px',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <FileOutlined style={{ color: '#1890ff', fontSize: '16px' }} />
                        <Text style={{ fontSize: '14px' }}>{file.name || 'Không có tên file'}</Text>
                        {file.size && (
                          <Text type="secondary" style={{ fontSize: '12px' }}>
                            ({(file.size / 1024).toFixed(2)} KB)
                          </Text>
                        )}
                      </div>
                      <Button
                        type="link"
                        icon={<DownloadOutlined />}
                        style={{ padding: '0 8px', borderRadius: '6px' }}
                        onClick={() => {
                          if (file.originFileObj) {
                            const url = URL.createObjectURL(file.originFileObj);
                            const link = document.createElement('a');
                            link.href = url;
                            link.download = file.name;
                            document.body.appendChild(link);
                            link.click();
                            document.body.removeChild(link);
                            URL.revokeObjectURL(url);
                          }
                        }}
                      >
                        Tải xuống
                      </Button>
                    </div>
                  ))}
                </Space>
              </Card>
            )}

            <Card
              title={
                <div style={{ display: 'flex', alignItems: 'baseline' }}>
                  <span>
                    {proposalType === 'DON_VI_HANG_NAM'
                      ? 'Danh sách đơn vị và danh hiệu'
                      : 'Danh sách quân nhân và danh hiệu'}
                  </span>
                  {(proposalType === 'CA_NHAN_HANG_NAM' || proposalType === 'DON_VI_HANG_NAM') &&
                    reviewTableData.length > 0 &&
                    (() => {
                      // Chỉ tính cho CSTT, CSTDCS, DVTT, DVQT
                      const allowedTitles = ['CSTT', 'CSTDCS', 'ĐVTT', 'ĐVQT'];
                      const titleCounts: Record<string, number> = {};

                      reviewTableData.forEach((item: any) => {
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
                    proposalType === 'NCKH'
                      ? 1100
                      : proposalType === 'NIEN_HAN' ||
                          proposalType === 'HC_QKQT' ||
                          proposalType === 'KNC_VSNXD_QDNDVN'
                        ? 1150
                        : 1000,
                }}
                locale={{
                  emptyText: 'Không có dữ liệu',
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
            title: 'Tạo Danh Sách Đề Xuất Khen Thưởng',
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
                // Nếu đang ở bước chọn loại đề xuất, quay về trang danh sách
                router.push('/manager/proposals');
              } else {
                // Nếu đang ở bước khác, quay lại bước chọn loại đề xuất
                setCurrentStep(0);
              }
            }}
            style={{ marginBottom: 0 }}
          >
            {currentStep === 0 ? 'Quay lại danh sách' : 'Quay lại chọn loại đề xuất'}
          </Button>
        </div>
        <Title level={2} style={{ marginBottom: 8 }}>
          Tạo Danh Sách Đề Xuất Khen Thưởng
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
