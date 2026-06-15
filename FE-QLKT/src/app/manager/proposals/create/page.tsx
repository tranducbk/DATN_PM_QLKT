'use client';

import React, { useState, useEffect, useCallback } from 'react';
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
import { getApiErrorMessage } from '@/lib/http/apiError';

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
import { apiClient } from '@/lib/http/apiClient';
import {
  DANH_HIEU_CA_NHAN_HANG_NAM,
  DANH_HIEU_DON_VI_HANG_NAM,
} from '@/constants/danhHieu.constants';
import type { UnitApiRow, ContributionProfile } from '@/lib/types/personnelList';
import type { TitleDataItem } from '@/lib/types/proposal';
import {
  PROPOSAL_TYPES,
  requiresProposalMonth,
  type ProposalType,
} from '@/constants/proposal.constants';
import { PROPOSAL_TYPE_ICON_COMPONENTS } from '@/constants/proposalUi.constants';
import { AWARD_TYPE_REGISTRY } from '@/constants/awardTypeRegistry.constants';
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
  fetchContributionProfiles,
} from '@/lib/award/serviceTimeHelpers';
import { buildReviewColumns } from '@/lib/proposal/reviewColumns';
import type { Personnel, ReviewRow } from './types';
import {
  getProposalReferenceEndDate as computeProposalReferenceEndDate,
  canProceedToNextStep as computeCanProceedToNextStep,
  buildKNCValidationError,
  buildNienHanValidationError,
  buildHCQKQTValidationError,
  computeTitleStats,
} from './helpers';

const { Title, Paragraph, Text } = Typography;

const PROPOSAL_DRAFT_KEY = 'manager_proposal_draft';

interface ProposalDraft {
  currentStep: number;
  proposalType: ProposalType;
  nam: number;
  thang?: number;
  selectedPersonnelIds: string[];
  selectedUnitIds: string[];
  titleData: TitleDataItem[];
  contributionProfiles: Record<string, ContributionProfile>;
  proposalNote: string;
}

export default function CreateProposalPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);

  const hasMountedRef = React.useRef(false);
  const isRestoringDraft = React.useRef(false);
  // Prevents save effect from overwriting the existing draft with defaults on initial mount
  const suppressNextSave = React.useRef(true);

  const [proposalType, setProposalType] = useState<ProposalType>(PROPOSAL_TYPES.CA_NHAN_HANG_NAM);
  const [nam, setNam] = useState(new Date().getFullYear());
  const [thang, setThang] = useState(new Date().getMonth() + 1);
  const [selectedPersonnelIds, setSelectedPersonnelIds] = useState<string[]>([]);
  const [selectedUnitIds, setSelectedUnitIds] = useState<string[]>([]);
  const [titleData, setTitleData] = useState<TitleDataItem[]>([]);
  const [contributionProfiles, setContributionProfiles] = useState<
    Record<string, ContributionProfile>
  >({});
  const [attachedFiles, setAttachedFiles] = useState<UploadFile[]>([]);
  const [personnelDetails, setPersonnelDetails] = useState<Personnel[]>([]);
  const [unitDetails, setUnitDetails] = useState<UnitApiRow[]>([]);
  const [proposalNote, setProposalNote] = useState<string>('');

  const getProposalReferenceEndDate = (): Date => computeProposalReferenceEndDate(nam, thang);

  const renderProposalTypeIcon = (type: ProposalType) => {
    const Icon = PROPOSAL_TYPE_ICON_COMPONENTS[type];
    return Icon ? <Icon /> : <TrophyOutlined />;
  };

  const proposalTypeConfig: Partial<
    Record<ProposalType, { icon: React.ReactNode; label: string; description: string }>
  > = Object.fromEntries(
    (Object.keys(AWARD_TYPE_REGISTRY) as ProposalType[])
      .filter(code => code !== PROPOSAL_TYPES.DOT_XUAT)
      .map(code => {
        const meta = AWARD_TYPE_REGISTRY[code];
        return [
          code,
          {
            icon: renderProposalTypeIcon(code),
            label: meta.label,
            description: meta.description,
          },
        ];
      })
  );

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
    if (!hasMountedRef.current) return;
    if (currentStep === 0) {
      setSelectedPersonnelIds([]);
      setSelectedUnitIds([]);
      setTitleData([]);
      setAttachedFiles([]);
      setPersonnelDetails([]);
      setUnitDetails([]);
      setProposalNote('');
      sessionStorage.removeItem(PROPOSAL_DRAFT_KEY);
    }
  }, [currentStep]);

  useEffect(() => {
    if (!hasMountedRef.current || isRestoringDraft.current) return;
    setSelectedPersonnelIds([]);
    setSelectedUnitIds([]);
    setTitleData([]);
    setAttachedFiles([]);
    setPersonnelDetails([]);
    setUnitDetails([]);
    setProposalNote('');
    setNam(new Date().getFullYear());
  }, [proposalType]);

  const fetchPersonnelDetails = useCallback(async () => {
    try {
      const promises = selectedPersonnelIds.map(id => apiClient.getPersonnelById(id));
      const responses = await Promise.all(promises);
      const personnelData = responses.filter(r => r.success).map(r => r.data);
      setPersonnelDetails(personnelData);
    } catch (error: unknown) {
      antMessage.error(getApiErrorMessage(error, 'Không tải được thông tin quân nhân'));
    }
  }, [selectedPersonnelIds]);

  const loadContributionProfiles = useCallback(async () => {
    const profiles = await fetchContributionProfiles(selectedPersonnelIds);
    setContributionProfiles(profiles);
  }, [selectedPersonnelIds]);

  const fetchUnitDetails = useCallback(async () => {
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
  }, [selectedUnitIds]);

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
  }, [
    currentStep,
    proposalType,
    selectedUnitIds,
    selectedPersonnelIds,
    fetchUnitDetails,
    fetchPersonnelDetails,
    loadContributionProfiles,
  ]);

  // Restore draft from sessionStorage on mount (client-only)
  useEffect(() => {
    hasMountedRef.current = true;
    try {
      const saved = sessionStorage.getItem(PROPOSAL_DRAFT_KEY);
      if (!saved) return;
      const draft = JSON.parse(saved) as ProposalDraft;
      isRestoringDraft.current = true;
      setCurrentStep(draft.currentStep ?? 0);
      setProposalType(draft.proposalType ?? PROPOSAL_TYPES.CA_NHAN_HANG_NAM);
      setNam(draft.nam ?? new Date().getFullYear());
      setThang(draft.thang ?? new Date().getMonth() + 1);
      setSelectedPersonnelIds(draft.selectedPersonnelIds ?? []);
      setSelectedUnitIds(draft.selectedUnitIds ?? []);
      setTitleData(draft.titleData ?? []);
      setContributionProfiles(draft.contributionProfiles ?? {});
      setProposalNote(draft.proposalNote ?? '');
      // Reset flag after the re-render's effects have run
      setTimeout(() => {
        isRestoringDraft.current = false;
      }, 100);
    } catch {
      sessionStorage.removeItem(PROPOSAL_DRAFT_KEY);
    }
  }, []);

  // Save draft to sessionStorage whenever serializable state changes
  useEffect(() => {
    if (!hasMountedRef.current) return;
    // Skip once after mount so restore effect's setState can take effect first
    if (suppressNextSave.current) {
      suppressNextSave.current = false;
      return;
    }
    try {
      const draft: ProposalDraft = {
        currentStep,
        proposalType,
        nam,
        ...(requiresProposalMonth(proposalType) && { thang }),
        selectedPersonnelIds,
        selectedUnitIds,
        titleData,
        contributionProfiles,
        proposalNote,
      };
      sessionStorage.setItem(PROPOSAL_DRAFT_KEY, JSON.stringify(draft));
    } catch {
      // sessionStorage unavailable or full
    }
  }, [
    currentStep,
    proposalType,
    nam,
    thang,
    selectedPersonnelIds,
    selectedUnitIds,
    titleData,
    contributionProfiles,
    proposalNote,
  ]);

  const canProceedToNextStep = () =>
    computeCanProceedToNextStep(
      currentStep,
      proposalType,
      selectedPersonnelIds,
      selectedUnitIds,
      titleData
    );

  const handleNext = async () => {
    if (
      currentStep === 1 &&
      selectedPersonnelIds.length > 0 &&
      (proposalType === PROPOSAL_TYPES.KNC_VSNXD_QDNDVN ||
        proposalType === PROPOSAL_TYPES.NIEN_HAN ||
        proposalType === PROPOSAL_TYPES.HC_QKQT)
    ) {
      try {
        const responses = await Promise.all(
          selectedPersonnelIds.map(id => apiClient.getPersonnelById(id))
        );
        const personnelData = responses.filter(r => r.success).map(r => r.data);
        let error: string | null = null;
        if (proposalType === PROPOSAL_TYPES.KNC_VSNXD_QDNDVN) {
          error = buildKNCValidationError(personnelData, 'next');
        } else if (proposalType === PROPOSAL_TYPES.NIEN_HAN) {
          error = buildNienHanValidationError(personnelData, 'next');
        } else {
          error = buildHCQKQTValidationError(personnelData, getProposalReferenceEndDate(), 'next');
        }
        if (error) { antMessage.error(error); return; }
      } catch {
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

  const handlePrev = () => {
    if (currentStep == 2) {
      setTitleData([]);
    }
    setCurrentStep(currentStep - 1);
  };

  const handleSubmit = async () => {
    try {
      setLoading(true);

      if (
        selectedPersonnelIds.length > 0 &&
        (proposalType === PROPOSAL_TYPES.KNC_VSNXD_QDNDVN ||
          proposalType === PROPOSAL_TYPES.NIEN_HAN ||
          proposalType === PROPOSAL_TYPES.HC_QKQT)
      ) {
        try {
          const responses = await Promise.all(
            selectedPersonnelIds.map(id => apiClient.getPersonnelById(id))
          );
          const personnelData = responses.filter(r => r.success).map(r => r.data);
          let error: string | null = null;
          if (proposalType === PROPOSAL_TYPES.KNC_VSNXD_QDNDVN) {
            error = buildKNCValidationError(personnelData, 'submit');
          } else if (proposalType === PROPOSAL_TYPES.NIEN_HAN) {
            error = buildNienHanValidationError(personnelData, 'submit');
          } else {
            error = buildHCQKQTValidationError(
              personnelData,
              getProposalReferenceEndDate(),
              'submit'
            );
          }
          if (error) { antMessage.error(error); setLoading(false); return; }
        } catch {
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

      // Append nhiều file cùng key 'attached_files' → multer.fields() gom thành
      // mảng req.files; originFileObj là File gốc (chỉ có khi user vừa chọn).
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

      sessionStorage.removeItem(PROPOSAL_DRAFT_KEY);

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
                          className={`text-xl ${
                            proposalType === key
                              ? 'text-blue-500 dark:text-blue-400'
                              : 'text-gray-500 dark:text-gray-400'
                          }`}
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

            {/* beforeUpload trả false → chặn Ant auto-upload, chỉ giữ file trong
                fileList; file gửi thủ công qua FormData lúc submit */}
            <Upload.Dragger
              fileList={attachedFiles}
              onChange={({ fileList }) => setAttachedFiles(fileList)}
              beforeUpload={() => false}
              multiple
              accept=".pdf,.doc,.docx,.xls,.xlsx"
            >
              <p className="ant-upload-drag-icon">
                <UploadOutlined className="text-5xl text-blue-500 dark:text-blue-400" />
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

        const reviewColumns = buildReviewColumns<ReviewRow>(
          proposalType,
          titleData,
          nam,
          thang,
          contributionProfiles,
          'Danh hiệu đề xuất'
        );

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

            {/* Attachments */}
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
                      const stats = computeTitleStats(reviewTableData, [
                        DANH_HIEU_CA_NHAN_HANG_NAM.CSTT,
                        DANH_HIEU_CA_NHAN_HANG_NAM.CSTDCS,
                        DANH_HIEU_DON_VI_HANG_NAM.DVTT,
                        DANH_HIEU_DON_VI_HANG_NAM.DVQT,
                      ]);
                      if (!stats) return null;
                      return (
                        <span className="text-sm ml-3 text-blue-500 dark:text-blue-400 font-semibold">
                          (
                          {stats.map((item, idx) => (
                            <span key={item.title}>
                              {item.title}: {item.count} ({item.percentage}%)
                              {idx < stats.length - 1 ? ', ' : ''}
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

            {/* Note */}
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
      <Card style={{ marginBottom: 24 }}>{renderStepContent()}</Card>

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
