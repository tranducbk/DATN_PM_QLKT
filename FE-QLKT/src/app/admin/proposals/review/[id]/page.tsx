'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Card,
  Button,
  Table,
  Alert,
  Typography,
  Space,
  Empty,
  Modal,
  Input,
  Tag,
  App,
  ConfigProvider,
  theme as antdTheme,
  Popconfirm,
  Tooltip,
  DatePicker,
  Upload,
} from 'antd';
import type { UploadFile } from 'antd/es/upload/interface';
import dayjs from 'dayjs';
import { getApiErrorMessage } from '@/lib/http/apiError';
import { LoadingState } from '@/components/shared/LoadingState';

import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  LoadingOutlined,
  ArrowLeftOutlined,
  WarningOutlined,
  FileTextOutlined,
  DeleteOutlined,
  UploadOutlined,
} from '@ant-design/icons';
import { PageBreadcrumb } from '@/components/shared/PageBreadcrumb';
import { DecisionModal } from '@/components/decisions/DecisionModal';
import { PersonnelRewardHistoryModal } from '@/components/proposals/bulk/PersonnelRewardHistoryModal';
import { ServiceHistoryModal } from '@/components/proposals/bulk/ServiceHistoryModal';
import { PositionHistoryModal } from '@/components/proposals/bulk/PositionHistoryModal';
import {
  UnitAnnualAwardHistoryModal,
  type UnitAnnualAwards,
} from '@/components/proposals/bulk/UnitAnnualAwardHistoryModal';
import { formatDateTime } from '@/lib/utils';
import { apiClient } from '@/lib/http/apiClient';
import { downloadDecisionFile } from '@/lib/file/downloadDecisionFile';
import { FileAttachmentList } from '@/components/proposals/FileAttachmentList';
import { ProposalStatusTag } from '@/components/proposals/ProposalStatusTag';
import { InfoNote } from '@/components/shared/InfoNote';
import { useTheme } from '@/components/ThemeProvider';
import { type ContributionCoefficientGroup } from '@/constants/danhHieu.constants';
import type { ServiceTimeRow } from '@/lib/award/serviceTimeHelpers';
import {
  PROPOSAL_REVIEW_CARD_TITLES,
  PROPOSAL_STATUS,
  PROPOSAL_TYPES,
  isProposalType,
  getProposalTypeLabel,
  getProposalStatusLabel,
} from '@/constants/proposal.constants';
import { ADMIN_PROPOSAL_DETAIL_STATUS_LABELS } from '@/constants/proposalUi.constants';
import type {
  ApprovalImportSummary,
  DanhHieuItem,
  ThanhTichItem,
  PositionHistoryEntry,
  DecisionPayload,
  ProposalDetail,
} from './types';
import {
  buildApprovalSuccessMessage,
  calculateTotalTimeByGroup,
  collectMissingDecisions,
  parseJsonArray,
} from './helpers';
import { buildDonViHangNamColumns } from './columns/donViHangNam';
import { buildThanhTichColumns } from './columns/thanhTich';
import { buildCaNhanHangNamColumns } from './columns/caNhanHangNam';

const { Title, Paragraph, Text } = Typography;

export default function ProposalDetailPage() {
  const { theme } = useTheme();
  const { modal, message } = App.useApp();
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [proposal, setProposal] = useState<ProposalDetail | null>(null);
  const [editedDanhHieu, setEditedDanhHieu] = useState<DanhHieuItem[]>([]);
  const [editedThanhTich, setEditedThanhTich] = useState<ThanhTichItem[]>([]);
  const [editedNienHan, setEditedNienHan] = useState<DanhHieuItem[]>([]);
  const [editedCongHien, setEditedCongHien] = useState<DanhHieuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [positionHistoriesMap, setPositionHistoriesMap] = useState<
    Record<string, PositionHistoryEntry[]>
  >({});
  const [personnelDetails, setPersonnelDetails] = useState<Record<string, ServiceTimeRow>>({});
  const [approving, setApproving] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [adminFileList, setAdminFileList] = useState<UploadFile[]>([]);
  const [messageAlert, setMessageAlert] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  const [bulkMonthPicker, setBulkMonthPicker] = useState<dayjs.Dayjs | null>(null);

  // Selection states for Danh Hieu
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

  const bulkSelectedSet = new Set(selectedRowKeys.map(String));

  // Selection states for Thanh Tich
  const [selectedThanhTichKeys, setSelectedThanhTichKeys] = useState<React.Key[]>([]);

  const [decisionModalVisible, setDecisionModalVisible] = useState(false);
  const [decisionModalType, setDecisionModalType] = useState<'danh_hieu' | 'thanh_tich'>(
    'danh_hieu'
  );

  // Reject modal
  const [rejectModalVisible, setRejectModalVisible] = useState(false);
  const [ghiChu, setGhiChu] = useState('');

  const [historyModalType, setHistoryModalType] = useState<
    'annual' | 'service' | 'position' | 'unit' | null
  >(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyPersonnel, setHistoryPersonnel] = useState<{
    id: string;
    ho_ten: string;
  } | null>(null);
  const [historyUnit, setHistoryUnit] = useState<{
    id: string;
    ten_don_vi: string;
    ma_don_vi?: string;
  } | null>(null);
  const [historyAnnualProfile, setHistoryAnnualProfile] = useState<any>(null);
  const [historyServiceProfile, setHistoryServiceProfile] = useState<Record<
    string,
    unknown
  > | null>(null);
  const [historyPositionList, setHistoryPositionList] = useState<any[]>([]);
  const [historyUnitAwards, setHistoryUnitAwards] = useState<UnitAnnualAwards | null>(null);

  const fetchPersonnelDetails = useCallback(
    async (danhHieuItems: DanhHieuItem[]) => {
      try {
        const detailsMap: Record<string, ServiceTimeRow> = {};

        await Promise.all(
          danhHieuItems.map(async item => {
            if (item.personnel_id) {
              try {
                const personnelResponse = await apiClient.getPersonnelById(item.personnel_id);
                if (personnelResponse.success && personnelResponse.data) {
                  detailsMap[item.personnel_id] = personnelResponse.data as ServiceTimeRow;
                }
              } catch {}
            }
          })
        );

        setPersonnelDetails(detailsMap);
      } catch (error) {
        message.error(getApiErrorMessage(error));
      }
    },
    [message]
  );

  const fetchPositionHistories = useCallback(
    async (danhHieuItems: DanhHieuItem[]) => {
      try {
        const historiesMap: Record<string, PositionHistoryEntry[]> = {};

        await Promise.all(
          danhHieuItems.map(async item => {
            if (item.personnel_id) {
              try {
                const positionHistoryResponse = await apiClient.getPositionHistory(
                  item.personnel_id
                );
                if (positionHistoryResponse.success && positionHistoryResponse.data) {
                  historiesMap[item.personnel_id] = positionHistoryResponse.data;
                }
              } catch (error) {
                historiesMap[item.personnel_id] = [];
              }
            }
          })
        );

        setPositionHistoriesMap(historiesMap);
      } catch (error) {
        message.error(getApiErrorMessage(error));
      }
    },
    [message]
  );

  const fetchProposalDetail = useCallback(async () => {
    try {
      setLoading(true);
      const proposalResponse = await apiClient.getProposalById(String(id));

      if (proposalResponse.success && proposalResponse.data) {
        const parsedFilesAttached = parseJsonArray<
          NonNullable<ProposalDetail['files_attached']>[number]
        >(proposalResponse.data.files_attached);
        const parsedFilesAttachedAdmin = parseJsonArray<
          NonNullable<ProposalDetail['files_attached_admin']>[number]
        >(proposalResponse.data.files_attached_admin);

        setProposal({
          ...proposalResponse.data,
          files_attached: parsedFilesAttached,
          files_attached_admin: parsedFilesAttachedAdmin,
        });

        const parsedDanhHieu = parseJsonArray<DanhHieuItem>(proposalResponse.data.data_danh_hieu);
        const parsedThanhTich = parseJsonArray<ThanhTichItem>(
          proposalResponse.data.data_thanh_tich
        );
        const parsedNienHan = parseJsonArray<DanhHieuItem>(proposalResponse.data.data_nien_han);
        const parsedCongHien = parseJsonArray<DanhHieuItem>(proposalResponse.data.data_cong_hien);

        setEditedDanhHieu(parsedDanhHieu);
        setEditedThanhTich(parsedThanhTich);
        setEditedNienHan(
          parsedNienHan.map((item: DanhHieuItem) => ({
            ...item,
            thang_nhan: item.thang_nhan ?? item.thang ?? null,
          }))
        );
        setEditedCongHien(parsedCongHien);

        let proposalAwardRows: DanhHieuItem[] = [];
        if (parsedDanhHieu.length > 0) {
          proposalAwardRows = parsedDanhHieu;
        } else if (parsedNienHan.length > 0) {
          proposalAwardRows = parsedNienHan;
        } else if (parsedCongHien.length > 0) {
          proposalAwardRows = parsedCongHien;
        }

        const detailTasks: Promise<void>[] = [];
        if (proposalAwardRows.length > 0) {
          detailTasks.push(fetchPersonnelDetails(proposalAwardRows));
        }
        if (
          proposalResponse.data.loai_de_xuat === PROPOSAL_TYPES.CONG_HIEN &&
          parsedCongHien.length > 0
        ) {
          detailTasks.push(fetchPositionHistories(parsedCongHien));
        }
        if (detailTasks.length > 0) {
          await Promise.all(detailTasks);
        }
      } else {
        setMessageAlert({
          type: 'error',
          text: proposalResponse.message || 'Không tải được đề xuất',
        });
      }
    } catch (error: unknown) {
      setMessageAlert({ type: 'error', text: getApiErrorMessage(error, 'Lỗi khi tải đề xuất') });
    } finally {
      setLoading(false);
    }
  }, [id, fetchPersonnelDetails, fetchPositionHistories]);

  useEffect(() => {
    if (id) {
      fetchProposalDetail();
    }
  }, [id, fetchProposalDetail]);

  const totalTimeByGroup = (personnelId: string, group: ContributionCoefficientGroup) =>
    calculateTotalTimeByGroup(positionHistoriesMap[personnelId] || [], group);

  const handleReject = async () => {
    if (!ghiChu.trim()) {
      message.error('Vui lòng nhập lý do từ chối');
      return;
    }

    try {
      setRejecting(true);
      setMessageAlert(null);

      const rejectResponse = await apiClient.rejectProposal(String(id), ghiChu);

      if (rejectResponse.success) {
        message.success('Đã từ chối đề xuất thành công');
        setRejectModalVisible(false);
        await fetchProposalDetail();

        setTimeout(() => {
          router.push('/admin/proposals/review');
        }, 2000);
      } else {
        setMessageAlert({
          type: 'error',
          text: rejectResponse.message || 'Lỗi khi từ chối đề xuất',
        });
      }
    } catch (error: unknown) {
      setMessageAlert({
        type: 'error',
        text: getApiErrorMessage(error, 'Lỗi khi từ chối đề xuất'),
      });
    } finally {
      setRejecting(false);
    }
  };

  const handleDelete = async () => {
    try {
      setDeleting(true);
      setMessageAlert(null);

      const deleteResponse = await apiClient.deleteProposal(String(id));

      if (deleteResponse.success) {
        message.success('Đã xóa đề xuất thành công');
        setTimeout(() => {
          router.push('/admin/proposals/review');
        }, 1000);
      } else {
        setMessageAlert({ type: 'error', text: deleteResponse.message || 'Lỗi khi xóa đề xuất' });
      }
    } catch (error: unknown) {
      setMessageAlert({ type: 'error', text: getApiErrorMessage(error, 'Lỗi khi xóa đề xuất') });
    } finally {
      setDeleting(false);
    }
  };

  const handleApprove = async () => {
    if (!proposal) return;
    const missingDecisions = collectMissingDecisions({
      loaiDeXuat: proposal.loai_de_xuat,
      editedDanhHieu,
      editedThanhTich,
      editedNienHan,
      editedCongHien,
    });

    if (missingDecisions.length > 0) {
      modal.warning({
        title: 'Thông tin chưa đầy đủ',
        content: (
          <div style={{ borderRadius: 0 }}>
            <p style={{ marginBottom: 12 }}>
              Vui lòng bổ sung thông tin còn thiếu trước khi phê duyệt:
            </p>
            <ul style={{ marginLeft: 20, marginBottom: 0 }}>
              {missingDecisions.slice(0, 10).map((item, idx) => (
                <li key={idx} style={{ marginBottom: 4 }}>
                  {item}
                </li>
              ))}
              {missingDecisions.length > 10 && (
                <li>... và {missingDecisions.length - 10} mục khác</li>
              )}
            </ul>
          </div>
        ),
        okText: 'Đã hiểu',
        width: 600,
        centered: true,
        style: { borderRadius: 8 },
        styles: {
          body: { borderRadius: 8 },
          content: { borderRadius: 0 },
        },
      });
      return;
    }

    modal.confirm({
      title: 'Xác nhận phê duyệt',
      content: 'Bạn có chắc chắn muốn phê duyệt đề xuất này? Dữ liệu sẽ được nhập vào hệ thống.',
      okText: 'Phê duyệt',
      cancelText: 'Hủy',
      centered: true,
      width: 500,
      style: { borderRadius: 8 },
      styles: { body: { borderRadius: 8 } },
      onOk: async () => {
        try {
          setApproving(true);
          setMessageAlert(null);

          const formData = new FormData();
          formData.append('data_danh_hieu', JSON.stringify(editedDanhHieu));
          formData.append('data_thanh_tich', JSON.stringify(editedThanhTich));
          formData.append('data_nien_han', JSON.stringify(editedNienHan));
          formData.append('data_cong_hien', JSON.stringify(editedCongHien));

          adminFileList.forEach(file => {
            const raw = file.originFileObj;
            if (raw instanceof File) {
              formData.append('admin_attached_files', raw);
            }
          });

          const approveResponse = await apiClient.approveProposal(String(id), formData);

          if (approveResponse.success) {
            const approvalImportSummary: ApprovalImportSummary = approveResponse.data || {};
            const successMessage = buildApprovalSuccessMessage(
              approvalImportSummary,
              proposal?.loai_de_xuat
            );

            if (approvalImportSummary.errors && approvalImportSummary.errors.length > 0) {
              message.warning(
                `${successMessage} Có ${approvalImportSummary.errors.length} lỗi xảy ra.`,
                5
              );
              setMessageAlert({
                type: 'error',
                text: `Có ${approvalImportSummary.errors.length} lỗi khi thêm dữ liệu:\n${approvalImportSummary.errors
                  .slice(0, 5)
                  .join('\n')}${approvalImportSummary.errors.length > 5 ? '\n...' : ''}`,
              });
            } else {
              message.success(successMessage);
            }

            setAdminFileList([]);
            // Refresh data
            await fetchProposalDetail();
          } else {
            setMessageAlert({
              type: 'error',
              text: approveResponse.message || 'Lỗi khi phê duyệt đề xuất',
            });
          }
        } catch (error: unknown) {
          setMessageAlert({
            type: 'error',
            text: getApiErrorMessage(error, 'Lỗi khi phê duyệt đề xuất'),
          });
        } finally {
          setApproving(false);
        }
      },
    });
  };

  const handleDecisionSuccess = (decision: DecisionPayload) => {
    if (decisionModalType === 'danh_hieu') {
      const loaiDeXuat = proposal?.loai_de_xuat;

      const selectedSet = new Set(selectedRowKeys.map(String));
      const applyDecision = (item: DanhHieuItem, index: number) => {
        if (!selectedSet.has(String(index))) return item;

        // FE always sets the shared so_quyet_dinh; BE maps it per danh_hieu
        return {
          ...item,
          so_quyet_dinh: decision.so_quyet_dinh,
          ...(decision.nam ? { nam_quyet_dinh: decision.nam } : {}),
        };
      };

      if (
        loaiDeXuat === PROPOSAL_TYPES.NIEN_HAN ||
        loaiDeXuat === PROPOSAL_TYPES.HC_QKQT ||
        loaiDeXuat === PROPOSAL_TYPES.KNC_VSNXD_QDNDVN
      ) {
        const updatedNienHan = editedNienHan.map(applyDecision);
        setEditedNienHan(updatedNienHan);
      } else if (loaiDeXuat === PROPOSAL_TYPES.CONG_HIEN) {
        const updatedCongHien = editedCongHien.map(applyDecision);
        setEditedCongHien(updatedCongHien);
      } else {
        const updatedDanhHieu = editedDanhHieu.map(applyDecision);
        setEditedDanhHieu(updatedDanhHieu);
      }

      const count = selectedRowKeys.length;
      setSelectedRowKeys([]);
      message.success(
        `Đã áp dụng số quyết định cho ${count} ${
          loaiDeXuat === PROPOSAL_TYPES.DON_VI_HANG_NAM ? 'đơn vị' : 'người'
        }`
      );
    } else {
      // Apply decision to selected thanh tich
      const updatedThanhTich = editedThanhTich.map((item, index) => {
        if (selectedThanhTichKeys.includes(index)) {
          return {
            ...item,
            so_quyet_dinh: decision.so_quyet_dinh,
            file_quyet_dinh: decision.file_path || null,
          };
        }
        return item;
      });

      setEditedThanhTich(updatedThanhTich);
      setSelectedThanhTichKeys([]);
      message.success(`Đã áp dụng số quyết định cho ${selectedThanhTichKeys.length} thành tích`);
    }
  };

  const handleClearDecision = (index: number) => {
    const loaiDeXuat = proposal?.loai_de_xuat;
    const clearRow = (item: DanhHieuItem, i: number): DanhHieuItem =>
      i === index
        ? {
            ...item,
            so_quyet_dinh: null,
            so_quyet_dinh_bkbqp: null,
            so_quyet_dinh_cstdtq: null,
            so_quyet_dinh_bkttcp: null,
            nam_quyet_dinh: undefined,
          }
        : item;

    if (
      loaiDeXuat === PROPOSAL_TYPES.NIEN_HAN ||
      loaiDeXuat === PROPOSAL_TYPES.HC_QKQT ||
      loaiDeXuat === PROPOSAL_TYPES.KNC_VSNXD_QDNDVN
    ) {
      setEditedNienHan(prev => prev.map(clearRow));
    } else if (loaiDeXuat === PROPOSAL_TYPES.CONG_HIEN) {
      setEditedCongHien(prev => prev.map(clearRow));
    } else {
      setEditedDanhHieu(prev => prev.map(clearRow));
    }
  };

  const handleClearThanhTichDecision = (index: number) => {
    setEditedThanhTich(prev =>
      prev.map((item, i) =>
        i === index ? { ...item, so_quyet_dinh: undefined, file_quyet_dinh: null } : item
      )
    );
  };

  const updateDanhHieu = (index: number, field: keyof DanhHieuItem, value: unknown) => {
    const nextDanhHieuItems = [...editedDanhHieu];
    nextDanhHieuItems[index] = { ...nextDanhHieuItems[index], [field]: value };
    setEditedDanhHieu(nextDanhHieuItems);
  };

  const updateThanhTich = (index: number, field: keyof ThanhTichItem, value: unknown) => {
    const nextThanhTichItems = [...editedThanhTich];
    nextThanhTichItems[index] = { ...nextThanhTichItems[index], [field]: value };
    setEditedThanhTich(nextThanhTichItems);
  };

  const updateNienHan = (index: number, fields: Partial<DanhHieuItem>) => {
    setEditedNienHan(prev => prev.map((item, i) => (i === index ? { ...item, ...fields } : item)));
  };

  const updateCongHien = (index: number, fields: Partial<DanhHieuItem>) => {
    setEditedCongHien(prev => prev.map((item, i) => (i === index ? { ...item, ...fields } : item)));
  };

  const handleOpenDecisionFile = async (soQuyetDinh: string) => {
    await downloadDecisionFile(soQuyetDinh);
  };

  const handleViewPersonnelHistory = async (record: DanhHieuItem) => {
    if (!proposal || !record.personnel_id) return;
    const loaiDeXuat = proposal.loai_de_xuat;
    const personnel = { id: record.personnel_id, ho_ten: record.ho_ten || 'Quân nhân' };
    setHistoryPersonnel(personnel);
    setHistoryAnnualProfile(null);
    setHistoryServiceProfile(null);
    setHistoryPositionList([]);
    setHistoryLoading(true);

    try {
      if (loaiDeXuat === PROPOSAL_TYPES.CA_NHAN_HANG_NAM) {
        setHistoryModalType('annual');
        const res = await apiClient.getAnnualProfile(record.personnel_id, proposal.nam);
        setHistoryAnnualProfile(res.success && res.data ? res.data : null);
      } else if (loaiDeXuat === PROPOSAL_TYPES.NIEN_HAN) {
        setHistoryModalType('service');
        const res = await apiClient.getTenureProfile(record.personnel_id);
        setHistoryServiceProfile(res.success && res.data ? res.data : null);
      } else if (loaiDeXuat === PROPOSAL_TYPES.CONG_HIEN) {
        setHistoryModalType('position');
        const res = await apiClient.getPositionHistory(record.personnel_id);
        setHistoryPositionList(res.success && Array.isArray(res.data) ? res.data : []);
      }
    } catch (error) {
      message.error(getApiErrorMessage(error, 'Không thể tải lịch sử khen thưởng'));
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleViewUnitHistory = async (record: DanhHieuItem) => {
    if (!proposal || !record.don_vi_id) return;
    setHistoryUnit({
      id: record.don_vi_id,
      ten_don_vi: record.ten_don_vi || 'Đơn vị',
      ma_don_vi: record.ma_don_vi,
    });
    setHistoryUnitAwards(null);
    setHistoryModalType('unit');
    setHistoryLoading(true);
    try {
      const res = await apiClient.getUnitAnnualProfile(record.don_vi_id, proposal.nam);
      setHistoryUnitAwards(res.success && res.data ? (res.data as UnitAnnualAwards) : null);
    } catch (error) {
      message.error(getApiErrorMessage(error, 'Không thể tải lịch sử khen thưởng đơn vị'));
    } finally {
      setHistoryLoading(false);
    }
  };

  const closeHistoryModal = () => {
    setHistoryModalType(null);
    setHistoryPersonnel(null);
    setHistoryUnit(null);
  };

  if (loading) {
    return <LoadingState className="min-h-[400px]" text="Đang tải đề xuất..." />;
  }

  if (!proposal) {
    return (
      <div style={{ padding: '24px' }}>
        <Alert
          message="Không tìm thấy đề xuất"
          type="error"
          showIcon
          icon={<CloseCircleOutlined />}
        />
      </div>
    );
  }

  const caNhanHangNamColumns = buildCaNhanHangNamColumns({
    proposal,
    personnelDetails,
    totalTimeByGroup,
    updateNienHan,
    handleOpenDecisionFile,
    handleClearDecision,
    handleViewPersonnelHistory,
  });

  const congHienThangNhanColumn = {
    title: 'Tháng nhận',
    key: 'thang_nhan_cong_hien',
    width: 160,
    align: 'center' as const,
    render: (_: unknown, record: DanhHieuItem, index: number) => {
      const hasDecision = !!record.so_quyet_dinh?.trim();
      const isPending = proposal?.status === PROPOSAL_STATUS.PENDING;
      const hasValue = !!(record.thang_nhan && record.nam_nhan);

      if (!isPending && hasValue) {
        return <Text>{`${String(record.thang_nhan).padStart(2, '0')}/${record.nam_nhan}`}</Text>;
      }
      if (!isPending) {
        return <Text type="secondary">—</Text>;
      }

      const minDate = proposal?.thang
        ? dayjs()
            .year(proposal.nam)
            .month(proposal.thang - 1)
        : undefined;
      const pickerValue = hasValue
        ? dayjs()
            .year(record.nam_nhan!)
            .month(record.thang_nhan! - 1)
        : null;
      const picker = (
        <DatePicker
          picker="month"
          value={pickerValue}
          minDate={minDate}
          disabled={!hasDecision}
          onChange={date => {
            if (date) {
              updateCongHien(index, { thang_nhan: date.month() + 1, nam_nhan: date.year() });
            } else {
              updateCongHien(index, { thang_nhan: null, nam_nhan: null });
            }
          }}
          placeholder="Chọn tháng"
          size="small"
          variant="filled"
          style={{ width: '100%' }}
        />
      );
      if (!hasDecision) {
        return <Tooltip title="Cần thêm số quyết định trước">{picker}</Tooltip>;
      }
      return picker;
    },
  };

  const congHienColumns = caNhanHangNamColumns
    .filter(column => column.key !== 'thang_nhan_nien_han')
    .flatMap(column =>
      column.key === 'so_quyet_dinh' ? [congHienThangNhanColumn, column] : [column]
    );

  // Only HCCSVV (NIEN_HAN) has tenure history; single medals drop the history column.
  const nienHanColumns =
    proposal.loai_de_xuat === PROPOSAL_TYPES.NIEN_HAN
      ? caNhanHangNamColumns
      : caNhanHangNamColumns.filter(column => column.key !== 'history');

  const donViHangNamColumns = buildDonViHangNamColumns({
    proposalStatus: proposal.status,
    updateDanhHieu,
    handleOpenDecisionFile,
    handleClearDecision,
    handleViewUnitHistory,
  });

  const thanhTichColumns = buildThanhTichColumns({
    proposalStatus: proposal.status,
    updateThanhTich,
    handleOpenDecisionFile,
    handleClearThanhTichDecision,
  });

  const rowSelection = {
    selectedRowKeys,
    onChange: (selectedKeys: React.Key[]) => {
      setSelectedRowKeys(selectedKeys);
    },
  };

  const thanhTichRowSelection = {
    selectedRowKeys: selectedThanhTichKeys,
    onChange: (selectedKeys: React.Key[]) => {
      setSelectedThanhTichKeys(selectedKeys);
    },
  };

  return (
    <ConfigProvider
      theme={{
        algorithm: theme === 'dark' ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
      }}
    >
      <div style={{ padding: '24px', maxWidth: '1600px', margin: '0 auto' }}>
        <PageBreadcrumb
          items={[
            { title: 'Duyệt đề xuất', href: '/admin/proposals/review' },
            { title: 'Chi tiết' },
          ]}
        />

        <div style={{ marginBottom: '24px' }}>
          <Button
            type="text"
            icon={<ArrowLeftOutlined />}
            onClick={() => router.push('/admin/proposals/review')}
            style={{ marginBottom: '16px' }}
          >
            Quay lại
          </Button>
          <div
            style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}
          >
            <div>
              <Title level={2}>Chi tiết đề xuất</Title>
              <Paragraph>Xem và chỉnh sửa trước khi phê duyệt</Paragraph>
            </div>
            <ProposalStatusTag
              status={proposal.status}
              variant="adminReview"
              label={
                ADMIN_PROPOSAL_DETAIL_STATUS_LABELS[proposal.status] ??
                getProposalStatusLabel(proposal.status)
              }
            />
          </div>
        </div>

        {messageAlert && (
          <Alert
            message={<div style={{ whiteSpace: 'pre-line' }}>{messageAlert.text}</div>}
            type={messageAlert.type}
            showIcon
            closable
            onClose={() => setMessageAlert(null)}
            style={{ marginBottom: '24px' }}
          />
        )}

        <Card title="Thông tin chung" style={{ marginBottom: '24px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
            <div>
              <Text type="secondary" style={{ fontSize: '14px' }}>
                Loại đề xuất
              </Text>
              <div style={{ fontWeight: 500, marginTop: '4px' }}>
                <Tag color="blue">{getProposalTypeLabel(proposal.loai_de_xuat)}</Tag>
              </div>
            </div>
            <div>
              <Text type="secondary" style={{ fontSize: '14px' }}>
                Đơn vị
              </Text>
              <div style={{ fontWeight: 500 }}>
                {proposal.don_vi.ten_don_vi} ({proposal.don_vi.ma_don_vi})
              </div>
            </div>
            <div>
              <Text type="secondary" style={{ fontSize: '14px' }}>
                Trạng thái
              </Text>
              <div style={{ fontWeight: 500 }}>
                <ProposalStatusTag
                  status={proposal.status}
                  variant="adminReview"
                  label={
                    ADMIN_PROPOSAL_DETAIL_STATUS_LABELS[proposal.status] ??
                    getProposalStatusLabel(proposal.status)
                  }
                />
              </div>
            </div>
            <div>
              <Text type="secondary" style={{ fontSize: '14px' }}>
                Người đề xuất
              </Text>
              <div style={{ fontWeight: 500 }}>{proposal.nguoi_de_xuat.ho_ten}</div>
            </div>
            <div>
              <Text type="secondary" style={{ fontSize: '14px' }}>
                Ngày gửi
              </Text>
              <div style={{ fontWeight: 500 }}>{formatDateTime(proposal.createdAt)}</div>
            </div>
            {proposal.status === PROPOSAL_STATUS.APPROVED && proposal.ngay_duyet && (
              <>
                <div>
                  <Text type="secondary" style={{ fontSize: '14px' }}>
                    Người phê duyệt
                  </Text>
                  <div style={{ fontWeight: 500 }}>
                    {proposal.nguoi_duyet?.ho_ten || proposal.nguoi_duyet?.username || '-'}
                  </div>
                </div>
                <div>
                  <Text type="secondary" style={{ fontSize: '14px' }}>
                    Ngày phê duyệt
                  </Text>
                  <div style={{ fontWeight: 500 }}>{formatDateTime(proposal.ngay_duyet)}</div>
                </div>
              </>
            )}
          </div>
        </Card>

        {/* Note */}
        <Card title="Ghi chú" style={{ marginBottom: '24px' }}>
          <div
            style={{
              padding: '12px',
              background: theme === 'dark' ? '#1f2937' : '#fafafa',
              borderRadius: 4,
              border: `1px solid ${theme === 'dark' ? '#374151' : '#e5e7eb'}`,
            }}
          >
            {proposal.ghi_chu ? (
              <Text style={{ color: theme === 'dark' ? '#f3f4f6' : '#111827' }}>
                {proposal.ghi_chu}
              </Text>
            ) : (
              <Text
                type="secondary"
                style={{
                  fontStyle: 'italic',
                  opacity: 0.6,
                  color: theme === 'dark' ? '#9ca3af' : '#6b7280',
                }}
              >
                Không có ghi chú
              </Text>
            )}
          </div>
        </Card>

        {/* Attachments */}
        <Card title="File đính kèm" style={{ marginBottom: '24px' }}>
          <div style={{ marginBottom: 16 }}>
            <Text strong style={{ display: 'block', marginBottom: 8 }}>
              File từ người đề xuất
            </Text>
            <FileAttachmentList
              files={proposal.files_attached || []}
              mode="server"
              emptyText="Không có file đính kèm"
            />
          </div>

          <div>
            <Text strong style={{ display: 'block', marginBottom: 8 }}>
              File đính kèm của người duyệt
            </Text>
            <FileAttachmentList
              files={proposal.files_attached_admin || []}
              mode="server"
              emptyText="Không có file đính kèm"
            />
            {proposal.status === PROPOSAL_STATUS.PENDING && (
              <div style={{ marginTop: 12 }}>
                <Upload
                  multiple
                  beforeUpload={() => false}
                  fileList={adminFileList}
                  onChange={({ fileList }) => setAdminFileList(fileList)}
                  onRemove={file => {
                    setAdminFileList(prev => prev.filter(f => f.uid !== file.uid));
                    return true;
                  }}
                >
                  <Button icon={<UploadOutlined />}>Đính kèm thêm file (không bắt buộc)</Button>
                </Upload>
                <Text type="secondary" style={{ display: 'block', marginTop: 8, fontSize: 12 }}>
                  File sẽ được lưu khi bạn bấm &quot;Phê duyệt&quot;.
                </Text>
              </div>
            )}
          </div>
        </Card>

        {proposal.loai_de_xuat === PROPOSAL_TYPES.NCKH && (
          <Card
            title={
              isProposalType(proposal.loai_de_xuat)
                ? PROPOSAL_REVIEW_CARD_TITLES[proposal.loai_de_xuat]
                : getProposalTypeLabel(proposal.loai_de_xuat)
            }
            extra={
              proposal.status === PROPOSAL_STATUS.PENDING && (
                <Button
                  type="primary"
                  icon={<FileTextOutlined />}
                  onClick={() => {
                    setDecisionModalType('thanh_tich');
                    setDecisionModalVisible(true);
                  }}
                  disabled={selectedThanhTichKeys.length === 0}
                >
                  Thêm số quyết định ({selectedThanhTichKeys.length} thành tích)
                </Button>
              )
            }
          >
            {editedThanhTich.length === 0 ? (
              <Empty
                image={<WarningOutlined style={{ fontSize: 48, color: '#d9d9d9' }} />}
                description="Không có dữ liệu thành tích"
              />
            ) : (
              <Table
                rowSelection={
                  proposal.status === PROPOSAL_STATUS.PENDING ? thanhTichRowSelection : undefined
                }
                columns={thanhTichColumns}
                dataSource={editedThanhTich}
                rowKey={(_, index) => index ?? 0}
                pagination={false}
                scroll={{ x: true }}
              />
            )}
          </Card>
        )}

        {(proposal.loai_de_xuat === PROPOSAL_TYPES.NIEN_HAN ||
          proposal.loai_de_xuat === PROPOSAL_TYPES.HC_QKQT ||
          proposal.loai_de_xuat === PROPOSAL_TYPES.KNC_VSNXD_QDNDVN) && (
          <Card
            title={
              isProposalType(proposal.loai_de_xuat)
                ? PROPOSAL_REVIEW_CARD_TITLES[proposal.loai_de_xuat]
                : getProposalTypeLabel(proposal.loai_de_xuat)
            }
            extra={
              proposal.status === PROPOSAL_STATUS.PENDING && (
                <Space wrap>
                  <Space>
                    <DatePicker
                      picker="month"
                      value={bulkMonthPicker}
                      onChange={val => setBulkMonthPicker(val)}
                      placeholder="Chọn tháng nhận"
                      variant="filled"
                      style={{ width: 160 }}
                      disabled={selectedRowKeys.length === 0}
                      minDate={
                        proposal.thang
                          ? dayjs()
                              .year(proposal.nam)
                              .month(proposal.thang - 1)
                          : undefined
                      }
                    />
                    <Tooltip
                      title={
                        selectedRowKeys.length > 0
                          ? `Áp dụng tháng nhận cho ${selectedRowKeys.length} hàng được chọn`
                          : 'Chọn ít nhất 1 hàng để áp dụng'
                      }
                    >
                      <Button
                        disabled={selectedRowKeys.length === 0}
                        onClick={() => {
                          if (!bulkMonthPicker) {
                            message.warning('Vui lòng chọn tháng nhận trước');
                            return;
                          }
                          const thang = bulkMonthPicker.month() + 1;
                          const nam = bulkMonthPicker.year();
                          const eligible = editedNienHan.filter(
                            (item, idx) =>
                              bulkSelectedSet.has(String(idx)) && !!item.so_quyet_dinh?.trim()
                          );
                          if (eligible.length === 0) {
                            message.warning('Không có hàng nào đã có số quyết định để áp dụng');
                            return;
                          }
                          setEditedNienHan(prev =>
                            prev.map((item, idx) => {
                              if (!bulkSelectedSet.has(String(idx))) return item;
                              if (!item.so_quyet_dinh?.trim()) return item;
                              return { ...item, thang_nhan: thang, nam_nhan: nam };
                            })
                          );
                          setBulkMonthPicker(null);
                          message.success(
                            `Đã đặt tháng ${thang}/${nam} cho ${eligible.length} hàng`
                          );
                        }}
                      >
                        Áp dụng ({selectedRowKeys.length})
                      </Button>
                    </Tooltip>
                  </Space>
                  <Button
                    type="primary"
                    icon={<FileTextOutlined />}
                    onClick={() => {
                      setDecisionModalType('danh_hieu');
                      setDecisionModalVisible(true);
                    }}
                    disabled={selectedRowKeys.length === 0}
                  >
                    Thêm số quyết định ({selectedRowKeys.length} người)
                  </Button>
                </Space>
              )
            }
          >
            {editedNienHan.length === 0 ? (
              <Empty
                image={<WarningOutlined style={{ fontSize: 48, color: '#d9d9d9' }} />}
                description={`Không có dữ liệu ${getProposalTypeLabel(
                  proposal.loai_de_xuat
                ).toLowerCase()}`}
              />
            ) : (
              <Table
                rowSelection={
                  proposal.status === PROPOSAL_STATUS.PENDING ? rowSelection : undefined
                }
                columns={nienHanColumns}
                dataSource={editedNienHan}
                rowKey={(_, index) => index ?? 0}
                pagination={false}
                scroll={{ x: true }}
              />
            )}
          </Card>
        )}

        {proposal.loai_de_xuat === PROPOSAL_TYPES.CONG_HIEN && (
          <Card
            title={
              isProposalType(proposal.loai_de_xuat)
                ? PROPOSAL_REVIEW_CARD_TITLES[proposal.loai_de_xuat]
                : getProposalTypeLabel(proposal.loai_de_xuat)
            }
            extra={
              proposal.status === PROPOSAL_STATUS.PENDING && (
                <Space wrap>
                  <Space>
                    <DatePicker
                      picker="month"
                      value={bulkMonthPicker}
                      onChange={val => setBulkMonthPicker(val)}
                      placeholder="Chọn tháng nhận"
                      variant="filled"
                      style={{ width: 160 }}
                      disabled={selectedRowKeys.length === 0}
                      minDate={
                        proposal.thang
                          ? dayjs()
                              .year(proposal.nam)
                              .month(proposal.thang - 1)
                          : undefined
                      }
                    />
                    <Tooltip
                      title={
                        selectedRowKeys.length > 0
                          ? `Áp dụng tháng nhận cho ${selectedRowKeys.length} hàng được chọn`
                          : 'Chọn ít nhất 1 hàng để áp dụng'
                      }
                    >
                      <Button
                        disabled={selectedRowKeys.length === 0}
                        onClick={() => {
                          if (!bulkMonthPicker) {
                            message.warning('Vui lòng chọn tháng nhận trước');
                            return;
                          }
                          const thang = bulkMonthPicker.month() + 1;
                          const nam = bulkMonthPicker.year();
                          const eligible = editedCongHien.filter(
                            (item, idx) =>
                              bulkSelectedSet.has(String(idx)) && !!item.so_quyet_dinh?.trim()
                          );
                          if (eligible.length === 0) {
                            message.warning('Không có hàng nào đã có số quyết định để áp dụng');
                            return;
                          }
                          setEditedCongHien(prev =>
                            prev.map((item, idx) => {
                              if (!bulkSelectedSet.has(String(idx))) return item;
                              if (!item.so_quyet_dinh?.trim()) return item;
                              return { ...item, thang_nhan: thang, nam_nhan: nam };
                            })
                          );
                          setBulkMonthPicker(null);
                          message.success(
                            `Đã đặt tháng ${thang}/${nam} cho ${eligible.length} hàng`
                          );
                        }}
                      >
                        Áp dụng ({selectedRowKeys.length})
                      </Button>
                    </Tooltip>
                  </Space>
                  <Button
                    type="primary"
                    icon={<FileTextOutlined />}
                    onClick={() => {
                      setDecisionModalType('danh_hieu');
                      setDecisionModalVisible(true);
                    }}
                    disabled={selectedRowKeys.length === 0}
                  >
                    Thêm số quyết định ({selectedRowKeys.length} người)
                  </Button>
                </Space>
              )
            }
          >
            {editedCongHien.length === 0 ? (
              <Empty
                image={<WarningOutlined style={{ fontSize: 48, color: '#d9d9d9' }} />}
                description="Không có dữ liệu Huân chương Bảo vệ Tổ quốc"
              />
            ) : (
              <Table
                rowSelection={
                  proposal.status === PROPOSAL_STATUS.PENDING ? rowSelection : undefined
                }
                columns={congHienColumns}
                dataSource={editedCongHien}
                rowKey={(_, index) => index ?? 0}
                pagination={false}
                scroll={{ x: true }}
              />
            )}
          </Card>
        )}

        {!(
          [
            PROPOSAL_TYPES.NCKH,
            PROPOSAL_TYPES.NIEN_HAN,
            PROPOSAL_TYPES.HC_QKQT,
            PROPOSAL_TYPES.KNC_VSNXD_QDNDVN,
            PROPOSAL_TYPES.CONG_HIEN,
          ] as string[]
        ).includes(proposal.loai_de_xuat) &&
          editedDanhHieu.length > 0 && (
            <Card
              title={
                isProposalType(proposal.loai_de_xuat)
                  ? PROPOSAL_REVIEW_CARD_TITLES[proposal.loai_de_xuat]
                  : getProposalTypeLabel(proposal.loai_de_xuat)
              }
              extra={
                proposal.status === PROPOSAL_STATUS.PENDING && (
                  <Button
                    type="primary"
                    icon={<FileTextOutlined />}
                    onClick={() => {
                      setDecisionModalType('danh_hieu');
                      setDecisionModalVisible(true);
                    }}
                    disabled={selectedRowKeys.length === 0}
                  >
                    Thêm số quyết định ({selectedRowKeys.length}{' '}
                    {proposal.loai_de_xuat === PROPOSAL_TYPES.DON_VI_HANG_NAM ? 'đơn vị' : 'người'})
                  </Button>
                )
              }
            >
              {editedDanhHieu.length === 0 ? (
                <Empty
                  image={<WarningOutlined style={{ fontSize: 48, color: '#d9d9d9' }} />}
                  description="Không có dữ liệu danh hiệu"
                />
              ) : (
                <Table
                  rowSelection={
                    proposal.status === PROPOSAL_STATUS.PENDING ? rowSelection : undefined
                  }
                  columns={
                    proposal.loai_de_xuat === PROPOSAL_TYPES.DON_VI_HANG_NAM
                      ? donViHangNamColumns
                      : caNhanHangNamColumns.filter(col => col.key !== 'thang_nhan_nien_han')
                  }
                  dataSource={editedDanhHieu}
                  rowKey={(_, index) => index ?? 0}
                  pagination={false}
                  scroll={{ x: true }}
                />
              )}
            </Card>
          )}

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '12px',
            marginTop: 24,
          }}
        >
          <Popconfirm
            title="Xóa đề xuất"
            description="Bạn có chắc chắn muốn xóa đề xuất này? Hành động này không thể hoàn tác."
            onConfirm={handleDelete}
            okText="Xóa"
            cancelText="Hủy"
            okButtonProps={{ danger: true }}
          >
            <Button
              danger
              icon={<DeleteOutlined />}
              loading={deleting}
              size="large"
              className="delete-proposal-button"
              style={{ backgroundColor: '#ff4d4f', borderColor: '#ff4d4f', color: '#fff' }}
            >
              Xóa đề xuất
            </Button>
          </Popconfirm>
          {proposal.status === PROPOSAL_STATUS.PENDING && (
            <div style={{ display: 'flex', gap: '12px' }}>
              <Button
                icon={<CloseCircleOutlined />}
                onClick={() => setRejectModalVisible(true)}
                size="large"
              >
                Từ chối
              </Button>
              <Button
                type="primary"
                icon={approving ? <LoadingOutlined /> : <CheckCircleOutlined />}
                onClick={handleApprove}
                loading={approving}
                size="large"
              >
                {approving ? 'Đang phê duyệt...' : 'Phê Duyệt'}
              </Button>
            </div>
          )}
        </div>

        {/* Reject Modal */}
        <Modal
          title="Từ chối đề xuất"
          open={rejectModalVisible}
          onCancel={() => {
            setRejectModalVisible(false);
            setGhiChu('');
          }}
          onOk={handleReject}
          confirmLoading={rejecting}
          okText="Từ chối"
          cancelText="Hủy"
          okButtonProps={{ danger: true }}
          width={600}
          centered
        >
          <InfoNote
            type="warning"
            description={
              <>
                <strong>Lưu ý:</strong> Nhập lý do từ chối để Chỉ huy đơn vị nắm được và chỉnh sửa
                lại đề xuất.
              </>
            }
          />
          <Input.TextArea
            placeholder="Nhập lý do từ chối (bắt buộc)"
            rows={5}
            value={ghiChu}
            onChange={e => setGhiChu(e.target.value)}
            showCount
            maxLength={500}
          />
        </Modal>

        {/* Decision Modal */}
        <DecisionModal
          visible={decisionModalVisible}
          onClose={() => setDecisionModalVisible(false)}
          onSuccess={handleDecisionSuccess}
          loaiKhenThuong={proposal?.loai_de_xuat}
        />

        <PersonnelRewardHistoryModal
          visible={historyModalType === 'annual'}
          personnel={historyPersonnel}
          annualProfile={historyAnnualProfile}
          loading={historyLoading}
          onClose={closeHistoryModal}
        />

        <ServiceHistoryModal
          visible={historyModalType === 'service'}
          personnel={historyPersonnel}
          serviceProfile={historyServiceProfile}
          loading={historyLoading}
          onClose={closeHistoryModal}
        />

        <PositionHistoryModal
          visible={historyModalType === 'position'}
          personnel={historyPersonnel}
          positionHistory={historyPositionList}
          loading={historyLoading}
          onClose={closeHistoryModal}
        />

        <UnitAnnualAwardHistoryModal
          visible={historyModalType === 'unit'}
          unit={historyUnit}
          annualAwards={historyUnitAwards}
          loading={historyLoading}
          onClose={closeHistoryModal}
        />
      </div>
    </ConfigProvider>
  );
}
