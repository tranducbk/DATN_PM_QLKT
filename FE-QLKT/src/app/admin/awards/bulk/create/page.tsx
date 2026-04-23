'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Card,
  Typography,
  Button,
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
  FileTextOutlined,
} from '@ant-design/icons';
import Link from 'next/link';
import type { ColumnsType } from 'antd/es/table';
import { apiClient } from '@/lib/apiClient';
import { getDanhHieuName } from '@/constants/danhHieu.constants';
import { PROPOSAL_TYPES, type ProposalType } from '@/constants/proposal.constants';
import { Step2SelectPersonnelCaNhanHangNam } from './components/Step2SelectPersonnelCaNhanHangNam';
import { Step2SelectPersonnelNienHan } from './components/Step2SelectPersonnelNienHan';
import { Step2SelectPersonnelHCQKQT } from './components/Step2SelectPersonnelHCQKQT';
import { Step2SelectPersonnelKNCVSNXDQDNDVN } from './components/Step2SelectPersonnelKNCVSNXDQDNDVN';
import { Step2SelectPersonnelCongHien } from './components/Step2SelectPersonnelCongHien';
import { Step2SelectPersonnelNCKH } from './components/Step2SelectPersonnelNCKH';
import { Step2SelectUnits } from './components/Step2SelectUnits';
import { Step3SetTitles } from './components/Step3SetTitles';
import { DecisionModal } from '@/components/DecisionModal';
import type { DateInput } from '@/lib/types';
import type { ContributionProfile } from '@/lib/types/personnelList';
import {
  renderServiceTime,
  makeContributionColumns,
  fetchContributionProfiles,
} from '@/lib/serviceTimeHelpers';

const { Title, Paragraph, Text } = Typography;

type AwardType = Exclude<ProposalType, typeof PROPOSAL_TYPES.DOT_XUAT>;

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

export default function BulkAddAwardsPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);

  // Step 1: Award Type
  const [awardType, setAwardType] = useState<AwardType>(PROPOSAL_TYPES.CA_NHAN_HANG_NAM);

  // Step 2: Select Personnel/Units
  const [nam, setNam] = useState(new Date().getFullYear());
  const [thang, setThang] = useState(new Date().getMonth() + 1);
  const [selectedPersonnelIds, setSelectedPersonnelIds] = useState<string[]>([]);
  const [selectedUnitIds, setSelectedUnitIds] = useState<string[]>([]);

  // Step 3: Set Titles
  const [titleData, setTitleData] = useState<any[]>([]);

  // Step 4: Personnel/Unit details for review
  const [personnelDetails, setPersonnelDetails] = useState<Personnel[]>([]);
  const [unitDetails, setUnitDetails] = useState<any[]>([]);

  // HCBVTQ contribution profiles (months_07, months_08, months_0910)
  const [contributionProfiles, setContributionProfiles] = useState<
    Record<string, ContributionProfile>
  >({});

  // Step 5: Note
  const [note, setNote] = useState<string>('');

  // Step 6: Decision data (so_quyet_dinh per personnel/unit)
  const [decisionDataMap, setDecisionDataMap] = useState<
    Record<string, { so_quyet_dinh: string; decision?: any }>
  >({});
  const [decisionModalVisible, setDecisionModalVisible] = useState(false);
  const [selectedPersonnelForDecision, setSelectedPersonnelForDecision] = useState<string[]>([]);

  // Award type config
  const awardTypeConfig: Record<
    AwardType,
    { icon: React.ReactNode; label: string; description: string }
  > = {
    [PROPOSAL_TYPES.CA_NHAN_HANG_NAM]: {
      icon: <TrophyOutlined />,
      label: 'Khen thưởng cá nhân hằng năm',
      description: 'Danh hiệu CSTT, CSTDCS, BKBQP, CSTĐTQ, BKTTCP',
    },
    [PROPOSAL_TYPES.DON_VI_HANG_NAM]: {
      icon: <TeamOutlined />,
      label: 'Khen thưởng đơn vị hằng năm',
      description: 'Danh hiệu ĐVTT, ĐVQT, BKBQP, BKTTCP',
    },
    [PROPOSAL_TYPES.NIEN_HAN]: {
      icon: <ClockCircleOutlined />,
      label: 'Huy chương Chiến sĩ vẻ vang',
      description: 'Danh hiệu Huy chương Chiến sĩ vẻ vang 3 hạng (Ba, Nhì, Nhất)',
    },
    [PROPOSAL_TYPES.HC_QKQT]: {
      icon: <TrophyOutlined />,
      label: 'Huy chương Quân kỳ quyết thắng',
      description: 'Yêu cầu đủ 25 năm phục vụ trong QĐNDVN',
    },
    [PROPOSAL_TYPES.KNC_VSNXD_QDNDVN]: {
      icon: <TrophyOutlined />,
      label: 'Kỷ niệm chương vì sự nghiệp xây dựng QĐNDVN',
      description: 'Yêu cầu đủ 25 năm phục vụ đối với nam và 20 năm phục vụ đối với nữ trong QĐNDVN',
    },
    [PROPOSAL_TYPES.CONG_HIEN]: {
      icon: <HeartOutlined />,
      label: 'Huân chương Bảo vệ Tổ quốc',
      description: 'Danh hiệu Huân chương Bảo vệ Tổ quốc 3 hạng (Ba, Nhì, Nhất)',
    },
    [PROPOSAL_TYPES.NCKH]: {
      icon: <ExperimentOutlined />,
      label: 'Thành tích Nghiên cứu khoa học',
      description: 'Đề tài khoa học / Sáng kiến khoa học',
    },
  };

  // 6-step wizard (file upload step removed)
  const getSteps = () => {
    const step2Title =
      awardType === PROPOSAL_TYPES.DON_VI_HANG_NAM ? 'Chọn đơn vị' : 'Chọn quân nhân';
    return [
      { title: 'Chọn loại', icon: <TrophyOutlined /> },
      { title: step2Title, icon: <TeamOutlined /> },
      { title: 'Thêm danh hiệu', icon: <CheckCircleOutlined /> },
      { title: 'Xem lại thông tin', icon: <FileTextOutlined /> },
      { title: 'Thêm số quyết định', icon: <FileTextOutlined /> },
      { title: 'Thêm khen thưởng', icon: <CheckCircleOutlined /> },
    ];
  };
  const steps = getSteps();

  // All current award types support ghi_chu in the schema; add exclusions here if that changes
  const awardTypesWithoutNote: AwardType[] = [];
  const canShowNote = !awardTypesWithoutNote.includes(awardType);

  useEffect(() => {
    if (!nam) {
      const currentYear = new Date().getFullYear();
      setNam(currentYear);
    }
  }, []);

  useEffect(() => {
    if (currentStep === 0) {
      setSelectedPersonnelIds([]);
      setSelectedUnitIds([]);
      setTitleData([]);
      setPersonnelDetails([]);
      setUnitDetails([]);
      setNote('');
      setDecisionDataMap({});
    }
  }, [currentStep]);

  useEffect(() => {
    setSelectedPersonnelIds([]);
    setSelectedUnitIds([]);
    setTitleData([]);
    setPersonnelDetails([]);
    setUnitDetails([]);
    setNote('');
    setDecisionDataMap({});
    setNam(new Date().getFullYear());
  }, [awardType]);

  // Fetch personnel/unit details when reaching Step 4 (Review)
  useEffect(() => {
    if (currentStep === 3) {
      if (awardType === PROPOSAL_TYPES.DON_VI_HANG_NAM && selectedUnitIds.length > 0) {
        fetchUnitDetails();
      } else if (selectedPersonnelIds.length > 0) {
        fetchPersonnelDetails();
      }
      if (awardType === PROPOSAL_TYPES.CONG_HIEN && selectedPersonnelIds.length > 0) {
        loadContributionProfiles();
      }
    }
  }, [currentStep, awardType, selectedUnitIds, selectedPersonnelIds]);

  const fetchPersonnelDetails = async () => {
    try {
      const promises = selectedPersonnelIds.map(id => apiClient.getPersonnelById(id));
      const responses = await Promise.all(promises);
      const personnelData = responses.filter(r => r.success).map(r => r.data);
      setPersonnelDetails(personnelData);
    } catch (error) {
      antMessage.error(getApiErrorMessage(error));
    }
  };

  const loadContributionProfiles = async () => {
    const profiles = await fetchContributionProfiles(selectedPersonnelIds);
    setContributionProfiles(profiles);
  };

  const fetchUnitDetails = async () => {
    try {
      const unitsRes = await apiClient.getUnits();
      if (unitsRes.success) {
        const unitsData = unitsRes.data || [];
        const selectedUnits = unitsData.filter((unit: any) => selectedUnitIds.includes(unit.id));
        setUnitDetails(selectedUnits);
      }
    } catch {}
  };

  // Validate current step
  const canProceedToNextStep = () => {
    switch (currentStep) {
      case 0:
        return true;
      case 1:
        if (awardType === PROPOSAL_TYPES.DON_VI_HANG_NAM) {
          return selectedUnitIds.length > 0;
        }
        return selectedPersonnelIds.length > 0;
      case 2:
        const expectedLength =
          awardType === PROPOSAL_TYPES.DON_VI_HANG_NAM
            ? selectedUnitIds.length
            : selectedPersonnelIds.length;
        if (titleData.length !== expectedLength) return false;

        if (awardType === PROPOSAL_TYPES.NCKH) {
          return titleData.every(d => d.loai && d.mo_ta && d.cap_bac && d.chuc_vu);
        }

        if (awardType === PROPOSAL_TYPES.DON_VI_HANG_NAM) {
          return titleData.every(d => d.danh_hieu);
        }

        return titleData.every(d => d.danh_hieu && d.cap_bac?.trim() && d.chuc_vu?.trim());
      case 3:
        return true; // Review step
      case 4: {
        const ids =
          awardType === PROPOSAL_TYPES.DON_VI_HANG_NAM ? selectedUnitIds : selectedPersonnelIds;
        return ids.every(id => decisionDataMap[id]?.so_quyet_dinh?.trim());
      }
      default:
        return false;
    }
  };

  // Handle next step
  const handleNext = async () => {
    if (canProceedToNextStep()) {
      setCurrentStep(currentStep + 1);
    } else {
      switch (currentStep) {
        case 1:
          if (awardType === PROPOSAL_TYPES.DON_VI_HANG_NAM) {
            antMessage.warning('Vui lòng chọn ít nhất một đơn vị!');
          } else {
            antMessage.warning('Vui lòng chọn ít nhất một quân nhân!');
          }
          break;
        case 2:
          antMessage.warning('Vui lòng chọn danh hiệu cho tất cả quân nhân!');
          break;
        case 4:
          antMessage.warning('Vui lòng nhập số quyết định cho tất cả!');
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

  const handleSubmit = async () => {
    try {
      const ids =
        awardType === PROPOSAL_TYPES.DON_VI_HANG_NAM ? selectedUnitIds : selectedPersonnelIds;
      const missingDecision = ids.some(id => !decisionDataMap[id]?.so_quyet_dinh?.trim());
      if (missingDecision) {
        antMessage.error('Vui lòng nhập số quyết định cho tất cả trước khi thêm khen thưởng!');
        return;
      }

      setLoading(true);

      const titleDataWithDecisions = titleData.map(item => {
        const personnelId = item.personnel_id || item.don_vi_id;
        const decisionInfo = decisionDataMap[personnelId];
        return {
          ...item,
          so_quyet_dinh: decisionInfo?.so_quyet_dinh || null,
        };
      });

      const formData = new FormData();
      formData.append('type', awardType);
      formData.append('nam', String(nam));
      formData.append('thang', String(thang));

      if (awardType === PROPOSAL_TYPES.DON_VI_HANG_NAM) {
        formData.append('selected_units', JSON.stringify(selectedUnitIds));
      } else {
        formData.append('selected_personnel', JSON.stringify(selectedPersonnelIds));
      }

      formData.append('title_data', JSON.stringify(titleDataWithDecisions));

      if (note.trim()) {
        formData.append('ghi_chu', note.trim());
      }

      const result = await apiClient.bulkCreateAwards(formData);

      if (!result.success) {
        throw new Error(result.message || 'Thêm khen thưởng thất bại');
      }

      const data = result.data || {};
      const importedCount = data.importedCount || 0;
      const errorCount = data.errorCount || 0;

      const msg =
        importedCount > 0
          ? `Đã thêm thành công ${importedCount} ${awardType === PROPOSAL_TYPES.DON_VI_HANG_NAM ? 'đơn vị' : 'quân nhân'}${
              errorCount > 0 ? `, ${errorCount} lỗi` : ''
            }`
          : 'Thêm khen thưởng thành công!';

      if (errorCount > 0 && data.errors) {
        antMessage.warning(msg);
      } else {
        antMessage.success(msg);
      }

      setTimeout(() => {
        router.push('/admin/awards');
      }, 1000);
    } catch (error: unknown) {
      antMessage.error(getApiErrorMessage(error, 'Lỗi khi thêm khen thưởng'));
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
              description="Vui lòng chọn loại khen thưởng bạn muốn thêm"
              type="info"
              showIcon
              style={{ marginBottom: 24 }}
            />
            <Radio.Group
              value={awardType}
              onChange={e => setAwardType(e.target.value)}
              size="large"
              style={{ width: '100%' }}
            >
              <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                {Object.entries(awardTypeConfig).map(([key, config]) => (
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
                            color: awardType === key ? '#1890ff' : '#8c8c8c',
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
        if (awardType === PROPOSAL_TYPES.DON_VI_HANG_NAM) {
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
        switch (awardType) {
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
            proposalType={awardType}
            titleData={titleData}
            onTitleDataChange={setTitleData}
            onPersonnelChange={setSelectedPersonnelIds}
            onUnitChange={setSelectedUnitIds}
            nam={nam}
            thang={thang}
          />
        );

      case 3: // Step 4: Review
        // Merge personnel/unit details with title data
        let reviewTableData: any[] = [];

        if (awardType === PROPOSAL_TYPES.DON_VI_HANG_NAM) {
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

        // Build table columns
        const reviewColumns: ColumnsType<any> = [];

        if (awardType === PROPOSAL_TYPES.DON_VI_HANG_NAM) {
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
            (
              [
                PROPOSAL_TYPES.NIEN_HAN,
                PROPOSAL_TYPES.HC_QKQT,
                PROPOSAL_TYPES.KNC_VSNXD_QDNDVN,
              ] as string[]
            ).includes(awardType)
          ) {
            reviewColumns.push({
              title: 'Tổng thời gian',
              key: 'tong_thoi_gian',
              width: 150,
              align: 'center' as const,
              render: (_: unknown, record: any) => renderServiceTime(record, nam, thang),
            });
          }

          if (awardType === PROPOSAL_TYPES.CONG_HIEN) {
            reviewColumns.push(...makeContributionColumns(contributionProfiles));
          }
        }

        // Add title/achievement columns
        if (awardType === PROPOSAL_TYPES.NCKH) {
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
            title: 'Danh hiệu',
            dataIndex: 'danh_hieu',
            key: 'danh_hieu',
            width: 250,
            align: 'center',
            render: (_, record) => {
              const titleInfo = titleData.find(
                t =>
                  String(t.personnel_id) === String(record.id) ||
                  String(t.don_vi_id) === String(record.id)
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
              message="Bước 5: Xem lại thông tin"
              description="Kiểm tra kỹ thông tin trước khi tiếp tục"
              type="success"
              showIcon
              style={{ marginBottom: 24 }}
            />

            <Card title="Tóm tắt" style={{ marginBottom: 16 }}>
              <Descriptions bordered column={2}>
                <Descriptions.Item label="Loại khen thưởng" span={2}>
                  <Tag icon={awardTypeConfig[awardType].icon}>
                    {awardTypeConfig[awardType].label}
                  </Tag>
                </Descriptions.Item>
                <Descriptions.Item label="Năm">
                  <Text strong>{nam}</Text>
                </Descriptions.Item>
                {(
                  [
                    PROPOSAL_TYPES.NIEN_HAN,
                    PROPOSAL_TYPES.HC_QKQT,
                    PROPOSAL_TYPES.KNC_VSNXD_QDNDVN,
                  ] as string[]
                ).includes(awardType) && (
                  <Descriptions.Item label="Tháng">
                    <Text strong>{thang}</Text>
                  </Descriptions.Item>
                )}
                <Descriptions.Item
                  label={
                    awardType === PROPOSAL_TYPES.DON_VI_HANG_NAM ? 'Số đơn vị' : 'Số quân nhân'
                  }
                >
                  <Text strong>
                    {awardType === PROPOSAL_TYPES.DON_VI_HANG_NAM
                      ? selectedUnitIds.length
                      : selectedPersonnelIds.length}
                  </Text>
                </Descriptions.Item>
              </Descriptions>
            </Card>

            <Card
              title={
                awardType === PROPOSAL_TYPES.DON_VI_HANG_NAM
                  ? 'Danh sách đơn vị và danh hiệu'
                  : 'Danh sách quân nhân và danh hiệu'
              }
            >
              <Table
                columns={reviewColumns}
                dataSource={reviewTableData}
                rowKey="id"
                pagination={false}
                size="small"
                bordered
                scroll={{ x: 1000 }}
                locale={{
                  emptyText: <Empty description="Không có dữ liệu" />,
                }}
              />
            </Card>

            {/* Chỉ hiển thị trường ghi chú nếu loại khen thưởng hỗ trợ lưu ghi chú */}
            {canShowNote && (
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
                  placeholder="Nhập ghi chú (không bắt buộc)..."
                  value={note}
                  onChange={e => setNote(e.target.value)}
                  rows={3}
                  maxLength={1000}
                  showCount
                />
              </Card>
            )}
          </div>
        );

      case 4: // Step 5: Add decision number
        const decisionTableData =
          awardType === PROPOSAL_TYPES.DON_VI_HANG_NAM ? unitDetails : personnelDetails;

        const decisionColumns: ColumnsType<any> = [
          {
            title: 'STT',
            key: 'index',
            width: 60,
            align: 'center',
            render: (_, __, index) => index + 1,
          },
          {
            title: awardType === PROPOSAL_TYPES.DON_VI_HANG_NAM ? 'Tên đơn vị' : 'Họ và tên',
            dataIndex: awardType === PROPOSAL_TYPES.DON_VI_HANG_NAM ? 'ten_don_vi' : 'ho_ten',
            key: awardType === PROPOSAL_TYPES.DON_VI_HANG_NAM ? 'ten_don_vi' : 'ho_ten',
            width: 200,
            align: 'center',
            render: (text: string) => <Text strong>{text}</Text>,
          },
          {
            title: 'Số quyết định',
            key: 'so_quyet_dinh',
            width: 300,
            align: 'center',
            render: (_, record) => {
              const id = record.id;
              const decisionInfo = decisionDataMap[id];
              const soQuyetDinh = decisionInfo?.so_quyet_dinh;

              return (
                <Space>
                  {soQuyetDinh ? (
                    <Tag
                      color="green"
                      closable
                      onClose={() => {
                        const newMap = { ...decisionDataMap };
                        delete newMap[id];
                        setDecisionDataMap(newMap);
                      }}
                    >
                      {soQuyetDinh}
                    </Tag>
                  ) : (
                    <Text type="secondary">Chưa có số quyết định</Text>
                  )}
                  <Button
                    size="small"
                    type="link"
                    onClick={() => {
                      setSelectedPersonnelForDecision([id]);
                      setDecisionModalVisible(true);
                    }}
                  >
                    {soQuyetDinh ? 'Sửa' : 'Thêm'}
                  </Button>
                </Space>
              );
            },
          },
        ];

        return (
          <div>
            <Alert
              message="Bước 5: Thêm số quyết định"
              description="Thêm số quyết định cho từng quân nhân/đơn vị (tùy chọn)"
              type="info"
              showIcon
              style={{ marginBottom: 24 }}
            />

            <Card
              title="Danh sách quân nhân/đơn vị"
              extra={
                <Button
                  type="primary"
                  onClick={() => {
                    const allIds =
                      awardType === PROPOSAL_TYPES.DON_VI_HANG_NAM
                        ? selectedUnitIds
                        : selectedPersonnelIds;
                    setSelectedPersonnelForDecision(allIds);
                    setDecisionModalVisible(true);
                  }}
                >
                  Thêm số quyết định cho tất cả
                </Button>
              }
            >
              <Table
                columns={decisionColumns}
                dataSource={decisionTableData}
                rowKey="id"
                pagination={false}
                size="small"
                bordered
              />
            </Card>
          </div>
        );

      case 5: // Step 6: Final review before submit
        const finalTableData =
          awardType === PROPOSAL_TYPES.DON_VI_HANG_NAM ? unitDetails : personnelDetails;

        const finalColumns: ColumnsType<any> = [
          {
            title: 'STT',
            key: 'index',
            width: 60,
            align: 'center',
            render: (_, __, index) => index + 1,
          },
          {
            title: awardType === PROPOSAL_TYPES.DON_VI_HANG_NAM ? 'Tên đơn vị' : 'Họ và tên',
            dataIndex: awardType === PROPOSAL_TYPES.DON_VI_HANG_NAM ? 'ten_don_vi' : 'ho_ten',
            key: awardType === PROPOSAL_TYPES.DON_VI_HANG_NAM ? 'ten_don_vi' : 'ho_ten',
            width: 200,
            align: 'center',
            render: (text: string) => <Text strong>{text}</Text>,
          },
        ];

        if (
          (
            [
              PROPOSAL_TYPES.NIEN_HAN,
              PROPOSAL_TYPES.HC_QKQT,
              PROPOSAL_TYPES.KNC_VSNXD_QDNDVN,
            ] as string[]
          ).includes(awardType)
        ) {
          finalColumns.push({
            title: 'Tổng thời gian',
            key: 'tong_thoi_gian',
            width: 150,
            align: 'center' as const,
            render: (_: unknown, record: any) => renderServiceTime(record, nam, thang),
          });
        }

        if (awardType === PROPOSAL_TYPES.CONG_HIEN) {
          finalColumns.push(...makeContributionColumns(contributionProfiles));
        }

        // Add columns based on award type
        if (awardType === PROPOSAL_TYPES.NCKH) {
          finalColumns.push(
            {
              title: 'Loại',
              dataIndex: 'loai',
              key: 'loai',
              width: 150,
              align: 'center',
              render: (_, record) => {
                const titleInfo = titleData.find(t => String(t.personnel_id) === String(record.id));
                const loai = titleInfo?.loai;
                return (
                  <Tag color={loai === PROPOSAL_TYPES.NCKH ? 'blue' : 'green'}>
                    {loai === PROPOSAL_TYPES.NCKH ? 'Đề tài khoa học' : 'Sáng kiến khoa học'}
                  </Tag>
                );
              },
            },
            {
              title: 'Mô tả',
              key: 'mo_ta',
              width: 300,
              align: 'center',
              render: (_, record) => {
                const titleInfo = titleData.find(t => String(t.personnel_id) === String(record.id));
                return <Text>{titleInfo?.mo_ta || '-'}</Text>;
              },
            }
          );
        } else {
          finalColumns.push({
            title: 'Danh hiệu',
            key: 'danh_hieu',
            width: 250,
            align: 'center',
            render: (_, record) => {
              const titleInfo = titleData.find(
                t =>
                  String(t.personnel_id) === String(record.id) ||
                  String(t.don_vi_id) === String(record.id)
              );
              const danh_hieu = titleInfo?.danh_hieu;
              const fullName = getDanhHieuName(danh_hieu);
              return <Text>{fullName || '-'}</Text>;
            },
          });
        }

        finalColumns.push({
          title: 'Số quyết định',
          key: 'so_quyet_dinh',
          width: 200,
          align: 'center',
          render: (_, record) => {
            const id = record.id;
            const decisionInfo = decisionDataMap[id];
            return decisionInfo?.so_quyet_dinh ? (
              <Tag color="green">{decisionInfo.so_quyet_dinh}</Tag>
            ) : (
              <Text type="secondary">Chưa có</Text>
            );
          },
        });

        return (
          <div>
            <Alert
              message="Bước 6: Xác nhận và thêm khen thưởng"
              description="Kiểm tra lại thông tin trước khi thêm khen thưởng vào hệ thống"
              type="warning"
              showIcon
              style={{ marginBottom: 24 }}
            />

            <Card title="Danh sách khen thưởng sẽ được thêm">
              <Table
                columns={finalColumns}
                dataSource={finalTableData}
                rowKey="id"
                pagination={false}
                size="small"
                bordered
                scroll={{ x: 1000 }}
              />
            </Card>
          </div>
        );

      default:
        return null;
    }
  };

  // Handle decision modal success
  const handleDecisionSuccess = (decision: any, isNewDecision: boolean = false) => {
    // Apply decision number to all selected personnel/units
    const newMap = { ...decisionDataMap };
    selectedPersonnelForDecision.forEach(id => {
      newMap[id] = {
        so_quyet_dinh: decision.so_quyet_dinh,
        decision: decision,
      };
    });
    setDecisionDataMap(newMap);
    setDecisionModalVisible(false);
    setSelectedPersonnelForDecision([]);
    antMessage.success('Đã thêm số quyết định thành công');
  };

  return (
    <div style={{ padding: '24px' }}>
      {/* Breadcrumb */}
      <Breadcrumb
        style={{ marginBottom: 16 }}
        items={[
          {
            title: (
              <Link href="/admin/dashboard">
                <HomeOutlined />
              </Link>
            ),
          },
          {
            title: 'Thêm khen thưởng đồng loạt',
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
                router.push('/admin/awards');
              } else {
                setCurrentStep(0);
              }
            }}
            style={{ marginBottom: 0 }}
          >
            {currentStep === 0 ? 'Quay lại' : 'Quay lại chọn loại'}
          </Button>
        </div>
        <Title level={2} style={{ marginBottom: 8 }}>
          Thêm khen thưởng đồng loạt
        </Title>
        <Paragraph type="secondary">
          Theo dõi các bước bên dưới để thêm khen thưởng vào hệ thống
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
                Thêm khen thưởng
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* Decision Modal */}
      <DecisionModal
        visible={decisionModalVisible}
        onClose={() => {
          setDecisionModalVisible(false);
          setSelectedPersonnelForDecision([]);
        }}
        onSuccess={handleDecisionSuccess}
        loaiKhenThuong={awardType}
      />
    </div>
  );
}
