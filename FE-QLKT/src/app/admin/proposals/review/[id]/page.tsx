'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Card,
  Button,
  Table,
  Alert,
  Typography,
  Breadcrumb,
  Space,
  Spin,
  Empty,
  Modal,
  Input,
  Tag,
  message,
  Select,
  ConfigProvider,
  theme as antdTheme,
  Popconfirm,
} from 'antd';
import { getApiErrorMessage } from '@/lib/apiError';

import {
  HomeOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  TrophyOutlined,
  BookOutlined,
  LoadingOutlined,
  ArrowLeftOutlined,
  WarningOutlined,
  FileTextOutlined,
  DownloadOutlined,
  DeleteOutlined,
  EyeOutlined,
} from '@ant-design/icons';
import { EditableCell } from '@/components/EditableCell';
import { DecisionModal } from '@/components/DecisionModal';
import { formatDateTime } from '@/lib/utils';
import { apiClient } from '@/lib/apiClient';
import { downloadDecisionFile } from '@/utils/downloadDecisionFile';
import { previewFileWithApi } from '@/utils/filePreview';
import { useTheme } from '@/components/ThemeProvider';
import { getDanhHieuName } from '@/constants/danhHieu.constants';
import { PROPOSAL_STATUS, PROPOSAL_TYPES } from '@/constants/proposal.constants';

const { Title, Paragraph, Text } = Typography;

interface DanhHieuItem {
  personnel_id?: string;
  don_vi_id?: string;
  don_vi_type?: 'CO_QUAN_DON_VI' | 'DON_VI_TRUC_THUOC';
  ho_ten?: string;
  ten_don_vi?: string;
  ma_don_vi?: string;
  nam: number;
  danh_hieu: string | null;
  cap_bac?: string | null;
  chuc_vu?: string | null;
  so_quyet_dinh?: string | null;
  nhan_bkbqp?: boolean;
  so_quyet_dinh_bkbqp?: string | null;
  nhan_cstdtq?: boolean;
  so_quyet_dinh_cstdtq?: string | null;
  nhan_bkttcp?: boolean;
  so_quyet_dinh_bkttcp?: string | null;
  file_quyet_dinh?: string | null;
  file_quyet_dinh_bkbqp?: string | null;
  file_quyet_dinh_cstdtq?: string | null;
  co_quan_don_vi?: {
    id: string;
    ten_co_quan_don_vi: string;
    ma_co_quan_don_vi: string;
  } | null;
  don_vi_truc_thuoc?: {
    id: string;
    ten_don_vi: string;
    ma_don_vi: string;
    co_quan_don_vi?: {
      id: string;
      ten_don_vi_truc: string;
      ma_don_vi: string;
    } | null;
  } | null;
  co_quan_don_vi_cha?: {
    id: string;
    ten_don_vi: string;
    ma_don_vi: string;
  } | null;
}

interface ThanhTichItem {
  personnel_id: string;
  ho_ten: string;
  nam: number;
  loai: string;
  mo_ta: string;
  status: string;
  so_quyet_dinh?: string;
  file_quyet_dinh?: string | null;
  cap_bac?: string | null;
  chuc_vu?: string | null;
  co_quan_don_vi?: {
    id: string;
    ten_co_quan_don_vi: string;
    ma_co_quan_don_vi: string;
  } | null;
  don_vi_truc_thuoc?: {
    id: string;
    ten_don_vi: string;
    ma_don_vi: string;
    co_quan_don_vi?: {
      id: string;
      ten_don_vi_truc: string;
      ma_don_vi: string;
    } | null;
  } | null;
}

interface ProposalDetail {
  id: number;
  loai_de_xuat: string;
  don_vi: {
    id: number;
    ma_don_vi: string;
    ten_don_vi: string;
  };
  nguoi_de_xuat: {
    id: number;
    username: string;
    ho_ten: string;
  };
  status: string;
  data_danh_hieu: DanhHieuItem[];
  data_thanh_tich: ThanhTichItem[];
  data_nien_han: any[];
  data_cong_hien: any[];
  files_attached?: Array<{
    filename: string;
    originalName: string;
    size?: number;
    uploadedAt?: string;
  }>;
  ghi_chu: string | null;
  nguoi_duyet: any;
  ngay_duyet: string | null;
  createdAt: string;
  updatedAt: string;
}

export default function ProposalDetailPage() {
  const { theme } = useTheme();
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [proposal, setProposal] = useState<ProposalDetail | null>(null);
  const [editedDanhHieu, setEditedDanhHieu] = useState<DanhHieuItem[]>([]);
  const [editedThanhTich, setEditedThanhTich] = useState<ThanhTichItem[]>([]);
  const [editedNienHan, setEditedNienHan] = useState<any[]>([]);
  const [editedCongHien, setEditedCongHien] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [positionHistoriesMap, setPositionHistoriesMap] = useState<Record<string, any[]>>({});
  const [personnelDetails, setPersonnelDetails] = useState<Record<string, any>>({});
  const [approving, setApproving] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [messageAlert, setMessageAlert] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  // Selection states for Danh Hieu
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

  // Selection states for Thanh Tich
  const [selectedThanhTichKeys, setSelectedThanhTichKeys] = useState<React.Key[]>([]);

  const [decisionModalVisible, setDecisionModalVisible] = useState(false);
  const [decisionModalType, setDecisionModalType] = useState<'danh_hieu' | 'thanh_tich'>(
    'danh_hieu'
  );

  // Reject modal
  const [rejectModalVisible, setRejectModalVisible] = useState(false);
  const [ghiChu, setGhiChu] = useState('');

  useEffect(() => {
    if (id) {
      fetchProposalDetail();
    }
  }, [id]);

  const fetchProposalDetail = async () => {
    try {
      setLoading(true);
      const res = await apiClient.getProposalById(String(id));

      if (res.success && res.data) {
        // Parse files_attached nếu cần
        const filesAttached = res.data.files_attached;
        const parsedFilesAttached = Array.isArray(filesAttached)
          ? filesAttached
          : filesAttached && typeof filesAttached === 'string'
            ? JSON.parse(filesAttached)
            : [];

        setProposal({
          ...res.data,
          files_attached: parsedFilesAttached,
        });
        const danhHieuData = res.data.data_danh_hieu;
        const thanhTichData = res.data.data_thanh_tich;
        const nienHanData = res.data.data_nien_han;
        const congHienData = res.data.data_cong_hien;

        const parsedDanhHieu = Array.isArray(danhHieuData)
          ? danhHieuData
          : danhHieuData && typeof danhHieuData === 'string'
            ? JSON.parse(danhHieuData)
            : [];

        const parsedThanhTich = Array.isArray(thanhTichData)
          ? thanhTichData
          : thanhTichData && typeof thanhTichData === 'string'
            ? JSON.parse(thanhTichData)
            : [];

        const parsedNienHan = Array.isArray(nienHanData)
          ? nienHanData
          : nienHanData && typeof nienHanData === 'string'
            ? JSON.parse(nienHanData)
            : [];

        const parsedCongHien = Array.isArray(congHienData)
          ? congHienData
          : congHienData && typeof congHienData === 'string'
            ? JSON.parse(congHienData)
            : [];

        setEditedDanhHieu(parsedDanhHieu);
        setEditedThanhTich(parsedThanhTich);
        setEditedNienHan(parsedNienHan);
        setEditedCongHien(parsedCongHien);

        // Fetch thông tin personnel để lấy chức vụ hiện tại
        // Với các loại đề xuất khác nhau, dữ liệu có thể nằm ở các field khác nhau
        const personnelData =
          parsedDanhHieu.length > 0
            ? parsedDanhHieu
            : parsedNienHan.length > 0
              ? parsedNienHan
              : parsedCongHien.length > 0
                ? parsedCongHien
                : [];

        const detailTasks: Promise<void>[] = [];
        if (personnelData.length > 0) {
          detailTasks.push(fetchPersonnelDetails(personnelData));
        }
        if (res.data.loai_de_xuat === PROPOSAL_TYPES.CONG_HIEN && parsedCongHien.length > 0) {
          detailTasks.push(fetchPositionHistories(parsedCongHien));
        }
        if (detailTasks.length > 0) {
          await Promise.all(detailTasks);
        }
      } else {
        setMessageAlert({ type: 'error', text: res.message || 'Không tải được đề xuất' });
      }
    } catch (error: unknown) {
      setMessageAlert({ type: 'error', text: getApiErrorMessage(error, 'Lỗi khi tải đề xuất') });
    } finally {
      setLoading(false);
    }
  };

  const fetchPersonnelDetails = async (danhHieuItems: DanhHieuItem[]) => {
    try {
      const detailsMap: Record<string, any> = {};

      // Fetch thông tin personnel cho mỗi quân nhân
      await Promise.all(
        danhHieuItems.map(async item => {
          if (item.personnel_id) {
            try {
              const res = await apiClient.getPersonnelById(item.personnel_id);
              if (res.success && res.data) {
                detailsMap[item.personnel_id] = res.data;
              }
            } catch (error) {
              // Ignore errors for individual personnel
            }
          }
        })
      );

      setPersonnelDetails(detailsMap);
    } catch (error) {
    }
  };

  const fetchPositionHistories = async (danhHieuItems: DanhHieuItem[]) => {
    try {
      const historiesMap: Record<string, any[]> = {};

      // Fetch lịch sử chức vụ cho mỗi quân nhân
      await Promise.all(
        danhHieuItems.map(async item => {
          if (item.personnel_id) {
            try {
              const res = await apiClient.getPositionHistory(item.personnel_id);
              if (res.success && res.data) {
                historiesMap[item.personnel_id] = res.data;
              }
            } catch (error) {
              // Ignore errors for individual personnel
              historiesMap[item.personnel_id] = [];
            }
          }
        })
      );

      setPositionHistoriesMap(historiesMap);
    } catch (error) {
    }
  };

  // Tính tổng thời gian đảm nhiệm chức vụ theo nhóm hệ số cho một quân nhân
  const calculateTotalTimeByGroup = (personnelId: string, group: '0.7' | '0.8' | '0.9-1.0') => {
    const histories = positionHistoriesMap[personnelId] || [];
    let totalMonths = 0;

    histories.forEach((history: any) => {
      const heSo = Number(history.he_so_chuc_vu) || 0;
      let belongsToGroup = false;

      if (group === '0.7') {
        belongsToGroup = heSo >= 0.7 && heSo < 0.8;
      } else if (group === '0.8') {
        belongsToGroup = heSo >= 0.8 && heSo < 0.9;
      } else if (group === '0.9-1.0') {
        belongsToGroup = heSo >= 0.9 && heSo <= 1.0;
      }

      if (belongsToGroup && history.so_thang !== null && history.so_thang !== undefined) {
        totalMonths += history.so_thang;
      }
    });

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

  const handleReject = async () => {
    if (!ghiChu.trim()) {
      message.error('Vui lòng nhập lý do từ chối');
      return;
    }

    try {
      setRejecting(true);
      setMessageAlert(null);

      const response = await apiClient.rejectProposal(String(id), ghiChu);

      if (response.success) {
        message.success('Đã từ chối đề xuất thành công');
        setRejectModalVisible(false);
        await fetchProposalDetail();

        setTimeout(() => {
          router.push('/admin/proposals/review');
        }, 2000);
      } else {
        setMessageAlert({ type: 'error', text: response.message || 'Lỗi khi từ chối đề xuất' });
      }
    } catch (error: unknown) {
      setMessageAlert({ type: 'error', text: getApiErrorMessage(error, 'Lỗi khi từ chối đề xuất') });
    } finally {
      setRejecting(false);
    }
  };

  const handleDelete = async () => {
    try {
      setDeleting(true);
      setMessageAlert(null);

      const response = await apiClient.deleteProposal(String(id));

      if (response.success) {
        message.success('Đã xóa đề xuất thành công');
        setTimeout(() => {
          router.push('/admin/proposals/review');
        }, 1000);
      } else {
        setMessageAlert({ type: 'error', text: response.message || 'Lỗi khi xóa đề xuất' });
      }
    } catch (error: unknown) {
      setMessageAlert({ type: 'error', text: getApiErrorMessage(error, 'Lỗi khi xóa đề xuất') });
    } finally {
      setDeleting(false);
    }
  };

  const handleApprove = async () => {
    if (!proposal) return;
    // Kiểm tra tất cả danh hiệu/thành tích đã có số quyết định chưa
    let missingDecisions: string[] = [];

    // Kiểm tra danh hiệu hằng năm (CA_NHAN_HANG_NAM, DON_VI_HANG_NAM)
    if (editedDanhHieu.length > 0) {
      editedDanhHieu.forEach((item, index) => {
        if (proposal.loai_de_xuat === PROPOSAL_TYPES.DON_VI_HANG_NAM) {
          // Với đề xuất đơn vị hằng năm, kiểm tra so_quyet_dinh
          if (!item.so_quyet_dinh || item.so_quyet_dinh.trim() === '') {
            missingDecisions.push(`Đơn vị ${index + 1}: ${item.ten_don_vi || 'N/A'}`);
          }
        } else {
          // Với đề xuất cá nhân, kiểm tra so_quyet_dinh (bắt buộc)
          if (!item.so_quyet_dinh || item.so_quyet_dinh.trim() === '') {
            missingDecisions.push(`Quân nhân ${index + 1}: ${item.ho_ten || 'N/A'}`);
          }
        }
      });
    }

    // Kiểm tra thành tích khoa học (NCKH)
    if (editedThanhTich.length > 0) {
      editedThanhTich.forEach((item, index) => {
        if (!item.so_quyet_dinh || item.so_quyet_dinh.trim() === '') {
          missingDecisions.push(`Thành tích ${index + 1}: ${item.ho_ten || 'N/A'}`);
        }
      });
    }

    // Kiểm tra niên hạn (NIEN_HAN, HC_QKQT, KNC_VSNXD_QDNDVN)
    if (editedNienHan.length > 0) {
      editedNienHan.forEach((item, index) => {
        if (!item.so_quyet_dinh || item.so_quyet_dinh.trim() === '') {
          missingDecisions.push(
            `Huy chương Chiến sĩ vẻ vang ${index + 1}: ${item.ho_ten || 'N/A'}`
          );
        }
      });
    }

    // Kiểm tra huân chương bảo vệ tổ quốc (CONG_HIEN)
    if (editedCongHien.length > 0) {
      editedCongHien.forEach((item, index) => {
        if (!item.so_quyet_dinh || item.so_quyet_dinh.trim() === '') {
          missingDecisions.push(`Huân chương Bảo vệ Tổ quốc ${index + 1}: ${item.ho_ten || 'N/A'}`);
        }
      });
    }

    // Nếu thiếu số quyết định, hiển thị cảnh báo
    if (missingDecisions.length > 0) {
      Modal.warning({
        title: 'Thiếu số quyết định',
        content: (
          <div style={{ borderRadius: 0 }}>
            <p style={{ marginBottom: 12 }}>
              Vui lòng thêm số quyết định cho tất cả các mục trước khi phê duyệt:
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

    Modal.confirm({
      title: 'Xác nhận phê duyệt',
      content: (
        <div>
          <p>Bạn có chắc chắn muốn phê duyệt đề xuất này? Dữ liệu sẽ được import vào hệ thống.</p>
          <p style={{ marginTop: 12 }}>
            Tất cả các mục đã có số quyết định. Sau khi phê duyệt, dữ liệu sẽ được import vào hệ
            thống.
          </p>
        </div>
      ),
      okText: 'Phê duyệt',
      cancelText: 'Hủy',
      closable: true,
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

          const response = await apiClient.approveProposal(String(id), formData);

          if (response.success) {
            const importedData = response.data || {};
            const importedDanhHieu = importedData.imported_danh_hieu || 0;
            const totalDanhHieu = importedData.total_danh_hieu || 0;
            const importedThanhTich = importedData.imported_thanh_tich || 0;
            const totalThanhTich = importedData.total_thanh_tich || 0;
            const importedNienHan = importedData.imported_nien_han || 0;
            const totalNienHan = importedData.total_nien_han || 0;

            // Tạo thông báo dựa trên loại đề xuất
            let successMessage = 'Đã phê duyệt đề xuất thành công. ';
            const loaiDeXuat = proposal?.loai_de_xuat;

            if (loaiDeXuat === PROPOSAL_TYPES.NIEN_HAN) {
              successMessage += `Đã thêm ${importedNienHan}/${totalNienHan} Huy chương Chiến sĩ vẻ vang thành công.`;
            } else if (loaiDeXuat === PROPOSAL_TYPES.HC_QKQT) {
              successMessage += `Đã thêm ${importedNienHan}/${totalNienHan} Huy chương Quân kỳ Quyết thắng thành công.`;
            } else if (loaiDeXuat === PROPOSAL_TYPES.KNC_VSNXD_QDNDVN) {
              successMessage += `Đã thêm ${importedNienHan}/${totalNienHan} Kỷ niệm chương VSNXD QĐNDVN thành công.`;
            } else if (loaiDeXuat === PROPOSAL_TYPES.CONG_HIEN) {
              successMessage += `Đã thêm ${importedDanhHieu}/${totalDanhHieu} Huân chương Bảo vệ Tổ quốc thành công.`;
            } else if (loaiDeXuat === PROPOSAL_TYPES.NCKH) {
              successMessage += `Đã thêm ${importedThanhTich}/${totalThanhTich} thành tích nghiên cứu khoa học thành công.`;
            } else if (loaiDeXuat === PROPOSAL_TYPES.DON_VI_HANG_NAM) {
              successMessage += `Đã thêm ${importedDanhHieu}/${totalDanhHieu} khen thưởng đơn vị thành công.`;
            } else {
              // CA_NHAN_HANG_NAM hoặc các loại khác
              if (importedDanhHieu > 0 && importedThanhTich > 0) {
                successMessage += `Đã thêm ${importedDanhHieu}/${totalDanhHieu} danh hiệu và ${importedThanhTich}/${totalThanhTich} thành tích nghiên cứu khoa học thành công.`;
              } else if (importedDanhHieu > 0) {
                successMessage += `Đã thêm ${importedDanhHieu}/${totalDanhHieu} danh hiệu thành công.`;
              } else if (importedThanhTich > 0) {
                successMessage += `Đã thêm ${importedThanhTich}/${totalThanhTich} thành tích nghiên cứu khoa học thành công.`;
              }
            }

            // Hiển thị thông báo thành công hoặc cảnh báo
            if (importedData.errors && importedData.errors.length > 0) {
              message.warning(`${successMessage} Có ${importedData.errors.length} lỗi xảy ra.`, 5);
              // Hiển thị errors chi tiết
              setMessageAlert({
                type: 'error',
                text: `Có ${importedData.errors.length} lỗi khi thêm dữ liệu:\n${importedData.errors
                  .slice(0, 5)
                  .join('\n')}${importedData.errors.length > 5 ? '\n...' : ''}`,
              });
            } else {
              message.success(successMessage);
            }

            // Refresh data
            await fetchProposalDetail();
          } else {
            setMessageAlert({
              type: 'error',
              text: response.message || 'Lỗi khi phê duyệt đề xuất',
            });
          }
        } catch (error: unknown) {
          setMessageAlert({ type: 'error', text: getApiErrorMessage(error, 'Lỗi khi phê duyệt đề xuất') });
        } finally {
          setApproving(false);
        }
      },
    });
  };

  const handleDecisionSuccess = (decision: any) => {
    if (decisionModalType === 'danh_hieu') {
      // Xác định loại đề xuất để cập nhật đúng state
      const loaiDeXuat = proposal?.loai_de_xuat;

      // Hàm helper để áp dụng quyết định cho một item
      const applyDecision = (item: any, index: number) => {
        if (!selectedRowKeys.includes(index)) return item;

        // Xác định loại quyết định dựa trên loai_khen_thuong hoặc số quyết định
        const loaiKhenThuong = decision.loai_khen_thuong || '';
        const soQuyetDinh = decision.so_quyet_dinh || '';

        // Kiểm tra nếu là quyết định BKBQP hoặc CSTDTQ (chỉ áp dụng cho CA_NHAN_HANG_NAM)
        if (loaiDeXuat === PROPOSAL_TYPES.CA_NHAN_HANG_NAM) {
          const isBKBQP =
            loaiKhenThuong.includes('BKBQP') ||
            soQuyetDinh.toLowerCase().includes('bkbqp') ||
            soQuyetDinh.toLowerCase().includes('bằng khen');
          const isCSTDTQ =
            loaiKhenThuong.includes('CSTDTQ') ||
            soQuyetDinh.toLowerCase().includes('cstdtq') ||
            soQuyetDinh.toLowerCase().includes('chiến sĩ thi đua toàn quân');
          const isBKTTCP =
            loaiKhenThuong.includes('BKTTCP') ||
            soQuyetDinh.toLowerCase().includes('bkttcp') ||
            soQuyetDinh.toLowerCase().includes('bằng khen toàn quân phổ thông');

          // Nếu là quyết định BKBQP hoặc CSTDTQ, lưu vào trường tương ứng
          if (isBKBQP) {
            return {
              ...item,
              nhan_bkbqp: true,
              so_quyet_dinh_bkbqp: decision.so_quyet_dinh,
              file_quyet_dinh_bkbqp: decision.file_path || null,
              so_quyet_dinh: item.so_quyet_dinh || null,
              file_quyet_dinh: item.file_quyet_dinh || null,
            };
          } else if (isCSTDTQ) {
            return {
              ...item,
              nhan_cstdtq: true,
              so_quyet_dinh_cstdtq: decision.so_quyet_dinh,
              file_quyet_dinh_cstdtq: decision.file_path || null,
              so_quyet_dinh: item.so_quyet_dinh || null,
              file_quyet_dinh: item.file_quyet_dinh || null,
            };
          } else if (isBKTTCP) {
            return {
              ...item,
              nhan_bkttcp: true,
              so_quyet_dinh_bkttcp: decision.so_quyet_dinh,
              file_quyet_dinh_bkttcp: decision.file_path || null,
              so_quyet_dinh: item.so_quyet_dinh || null,
              file_quyet_dinh: item.file_quyet_dinh || null,
            };
          }
        }

        // Quyết định thông thường - áp dụng cho tất cả loại
        return {
          ...item,
          so_quyet_dinh: decision.so_quyet_dinh,
          file_quyet_dinh: decision.file_path || null,
        };
      };

      // Cập nhật state tương ứng với loại đề xuất
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

  const updateDanhHieu = (index: number, field: keyof DanhHieuItem, value: any) => {
    const newData = [...editedDanhHieu];
    newData[index] = { ...newData[index], [field]: value };
    setEditedDanhHieu(newData);
  };

  const updateThanhTich = (index: number, field: keyof ThanhTichItem, value: any) => {
    const newData = [...editedThanhTich];
    newData[index] = { ...newData[index], [field]: value };
    setEditedThanhTich(newData);
  };

  const updateNienHan = (index: number, field: string, value: any) => {
    const newData = [...editedNienHan];
    newData[index] = { ...newData[index], [field]: value };
    setEditedNienHan(newData);
  };

  const updateCongHien = (index: number, field: string, value: any) => {
    const newData = [...editedCongHien];
    newData[index] = { ...newData[index], [field]: value };
    setEditedCongHien(newData);
  };

  // Hàm để tải file quyết định - backend tự động query DB để lấy file path
  const handleOpenDecisionFile = async (soQuyetDinh: string) => {
    await downloadDecisionFile(soQuyetDinh);
  };

  if (loading) {
    return (
      <div
        style={{
          padding: '24px',
          textAlign: 'center',
          minHeight: '400px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Space>
          <Spin indicator={<LoadingOutlined style={{ fontSize: 32 }} spin />} />
          <span>Đang tải...</span>
        </Space>
      </div>
    );
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

  // COLUMNS CHO TỪNG LOẠI ĐỀ XUẤT

  // Columns cho CA_NHAN_HANG_NAM (Cá nhân Hằng năm)
  const caNhanHangNamColumns = [
    {
      title: 'STT',
      key: 'stt',
      width: 60,
      align: 'center' as const,
      render: (_: any, __: any, index: number) => index + 1,
    },
    {
      title: 'Họ tên',
      dataIndex: 'ho_ten',
      key: 'ho_ten',
      width: 250,
      align: 'center' as const,
      render: (text: string, record: DanhHieuItem) => {
        const coQuanDonVi = record.co_quan_don_vi?.ten_co_quan_don_vi;
        const donViTrucThuoc = record.don_vi_truc_thuoc?.ten_don_vi;
        const parts = [];
        if (donViTrucThuoc) parts.push(donViTrucThuoc);
        if (coQuanDonVi) parts.push(coQuanDonVi);
        const unitInfo = parts.length > 0 ? parts.join(', ') : null;

        return (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <Text strong>{text}</Text>
            {unitInfo && (
              <Text type="secondary" style={{ fontSize: '12px', marginTop: '4px' }}>
                {unitInfo}
              </Text>
            )}
          </div>
        );
      },
    },
    {
      title: 'Cấp bậc / Chức vụ',
      key: 'cap_bac_chuc_vu',
      width: 180,
      align: 'center' as const,
      render: (_: any, record: DanhHieuItem) => {
        // Chỉ hiển thị nếu có dữ liệu trong dataJSON
        const capBac = record.cap_bac;
        const chucVu = record.chuc_vu;

        // Nếu không có cả cấp bậc và chức vụ, để trống
        if (!capBac && !chucVu) {
          return <span>-</span>;
        }

        return (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            {capBac && <Text strong>{capBac}</Text>}
            {chucVu && (
              <Text type="secondary" style={{ fontSize: '12px', marginTop: capBac ? '4px' : '0' }}>
                {chucVu}
              </Text>
            )}
          </div>
        );
      },
    },
    {
      title: 'Năm',
      dataIndex: 'nam',
      key: 'nam',
      width: 80,
      align: 'center' as const,
      render: (_: any, record: DanhHieuItem, index: number) => (
        <div style={{ textAlign: 'center' }}>
          <EditableCell
            value={record.nam}
            type="number"
            onSave={val => updateDanhHieu(index, 'nam', parseInt(val))}
            editable={proposal.status === PROPOSAL_STATUS.PENDING}
          />
        </div>
      ),
    },
    {
      title: 'Danh hiệu',
      dataIndex: 'danh_hieu',
      key: 'danh_hieu',
      width: 250,
      align: 'center' as const,
      render: (_: any, record: DanhHieuItem, index: number) => {
        // Sử dụng hàm helper để map mã danh hiệu sang tên đầy đủ
        const fullName = getDanhHieuName(record.danh_hieu || '');
        return (
          <div style={{ textAlign: 'center' }}>
            <Text>{fullName}</Text>
          </div>
        );
      },
    },
    ...(proposal?.loai_de_xuat === PROPOSAL_TYPES.CONG_HIEN
      ? [
          {
            title: 'Tổng thời gian (0.7)',
            key: 'total_time_0_7',
            width: 150,
            align: 'center' as const,
            render: (_: any, record: DanhHieuItem) =>
              calculateTotalTimeByGroup(record.personnel_id ?? '', '0.7'),
          },
          {
            title: 'Tổng thời gian (0.8)',
            key: 'total_time_0_8',
            width: 150,
            align: 'center' as const,
            render: (_: any, record: DanhHieuItem) =>
              calculateTotalTimeByGroup(record.personnel_id ?? '', '0.8'),
          },
          {
            title: 'Tổng thời gian (0.9-1.0)',
            key: 'total_time_0_9_1_0',
            width: 150,
            align: 'center' as const,
            render: (_: any, record: DanhHieuItem) =>
              calculateTotalTimeByGroup(record.personnel_id ?? '', '0.9-1.0'),
          },
        ]
      : []),
    {
      title: 'Số quyết định',
      dataIndex: 'so_quyet_dinh',
      key: 'so_quyet_dinh',
      width: 180,
      align: 'center' as const,
      render: (_: any, record: DanhHieuItem, index: number) => {
        // Kiểm tra cả so_quyet_dinh và các trường cũ để tương thích với dữ liệu cũ
        const soQuyetDinh =
          record.so_quyet_dinh || record.so_quyet_dinh_bkbqp || record.so_quyet_dinh_cstdtq;

        if (!soQuyetDinh || (typeof soQuyetDinh === 'string' && soQuyetDinh.trim() === '')) {
          return (
            <div style={{ textAlign: 'center' }}>
              <span
                style={{
                  fontWeight: 400,
                  fontStyle: 'italic',
                  opacity: 0.6,
                }}
              >
                Chưa có số quyết định
              </span>
            </div>
          );
        }
        return (
          <div style={{ textAlign: 'center' }}>
            <a
              onClick={e => {
                e.preventDefault();
                e.stopPropagation();
                handleOpenDecisionFile(soQuyetDinh);
              }}
              style={{
                color: '#52c41a',
                fontWeight: 500,
                textDecoration: 'underline',
                cursor: 'pointer',
              }}
            >
              {soQuyetDinh}
            </a>
          </div>
        );
      },
    },
  ];

  // Columns cho đề xuất đơn vị hằng năm
  const donViHangNamColumns = [
    {
      title: 'STT',
      key: 'stt',
      width: 60,
      align: 'center' as const,
      render: (_: any, __: any, index: number) => index + 1,
    },
    {
      title: 'Loại đơn vị',
      key: 'loai_don_vi',
      width: 150,
      align: 'center' as const,
      render: (_: any, record: DanhHieuItem) => {
        const type =
          record.don_vi_type ||
          (record.co_quan_don_vi_cha ? 'DON_VI_TRUC_THUOC' : 'CO_QUAN_DON_VI');
        return (
          <div style={{ textAlign: 'center' }}>
            <Tag color={type === 'CO_QUAN_DON_VI' ? 'blue' : 'green'}>
              {type === 'CO_QUAN_DON_VI' ? 'Cơ quan đơn vị' : 'Đơn vị trực thuộc'}
            </Tag>
          </div>
        );
      },
    },
    {
      title: 'Mã đơn vị',
      dataIndex: 'ma_don_vi',
      key: 'ma_don_vi',
      width: 150,
      align: 'center' as const,
      render: (text: string) => (
        <div style={{ textAlign: 'center' }}>
          <Text code>{text || '-'}</Text>
        </div>
      ),
    },
    {
      title: 'Tên đơn vị',
      dataIndex: 'ten_don_vi',
      key: 'ten_don_vi',
      width: 250,
      align: 'center' as const,
      render: (text: string) => (
        <div style={{ textAlign: 'center' }}>
          <Text strong>{text || '-'}</Text>
        </div>
      ),
    },
    {
      title: 'Năm',
      dataIndex: 'nam',
      key: 'nam',
      width: 80,
      align: 'center' as const,
      render: (_: any, record: DanhHieuItem, index: number) => (
        <div style={{ textAlign: 'center' }}>
          <EditableCell
            value={record.nam}
            type="number"
            onSave={val => updateDanhHieu(index, 'nam', parseInt(val))}
            editable={proposal.status === PROPOSAL_STATUS.PENDING}
          />
        </div>
      ),
    },
    {
      title: 'Danh hiệu',
      dataIndex: 'danh_hieu',
      key: 'danh_hieu',
      width: 200,
      align: 'center' as const,
      render: (_: any, record: DanhHieuItem, index: number) => {
        // Map mã danh hiệu sang tên đầy đủ để hiển thị
        const danhHieuMap: Record<string, string> = {
          ĐVQT: 'Đơn vị Quyết thắng',
          ĐVTT: 'Đơn vị Tiên tiến',
          BKBQP: 'Bằng khen của Bộ trưởng Bộ Quốc phòng',
          BKTTCP: 'Bằng khen Thủ tướng Chính phủ',
        };

        const fullName = danhHieuMap[record.danh_hieu || ''] || record.danh_hieu || '-';

        // Luôn hiển thị tên đầy đủ, không cho phép chỉnh sửa danh hiệu
        return (
          <div style={{ textAlign: 'center' }}>
            <Text>{fullName || '-'}</Text>
          </div>
        );
      },
    },
    {
      title: 'Số quyết định',
      dataIndex: 'so_quyet_dinh',
      key: 'so_quyet_dinh',
      width: 180,
      align: 'center' as const,
      render: (_: any, record: DanhHieuItem, index: number) => {
        // Kiểm tra cả so_quyet_dinh và các trường cũ để tương thích với dữ liệu cũ
        const soQuyetDinh =
          record.so_quyet_dinh || record.so_quyet_dinh_bkbqp || record.so_quyet_dinh_cstdtq;

        if (!soQuyetDinh || (typeof soQuyetDinh === 'string' && soQuyetDinh.trim() === '')) {
          return (
            <div style={{ textAlign: 'center' }}>
              <span
                style={{
                  fontWeight: 400,
                  fontStyle: 'italic',
                  opacity: 0.6,
                }}
              >
                Chưa có số quyết định
              </span>
            </div>
          );
        }

        return (
          <div style={{ textAlign: 'center' }}>
            <a
              onClick={e => {
                e.preventDefault();
                e.stopPropagation();
                handleOpenDecisionFile(soQuyetDinh);
              }}
              style={{
                color: '#52c41a',
                fontWeight: 500,
                textDecoration: 'underline',
                cursor: 'pointer',
              }}
            >
              {soQuyetDinh}
            </a>
          </div>
        );
      },
    },
  ];

  const thanhTichColumns = [
    {
      title: 'STT',
      key: 'stt',
      width: 60,
      align: 'center' as const,
      render: (_: any, __: any, index: number) => (
        <div style={{ textAlign: 'center' }}>{index + 1}</div>
      ),
    },
    {
      title: 'Họ tên',
      dataIndex: 'ho_ten',
      key: 'ho_ten',
      width: 250,
      align: 'center' as const,
      render: (text: string, record: ThanhTichItem) => {
        const coQuanDonVi = record.co_quan_don_vi?.ten_co_quan_don_vi;
        const donViTrucThuoc = record.don_vi_truc_thuoc?.ten_don_vi;
        const parts = [];
        if (donViTrucThuoc) parts.push(donViTrucThuoc);
        if (coQuanDonVi) parts.push(coQuanDonVi);
        const unitInfo = parts.length > 0 ? parts.join(', ') : null;

        return (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <Text strong>{text}</Text>
            {unitInfo && (
              <Text type="secondary" style={{ fontSize: '12px', marginTop: '4px' }}>
                {unitInfo}
              </Text>
            )}
          </div>
        );
      },
    },
    {
      title: 'Cấp bậc / Chức vụ',
      key: 'cap_bac_chuc_vu',
      width: 180,
      align: 'center' as const,
      render: (_: any, record: ThanhTichItem) => {
        // Hiển thị cấp bậc/chức vụ từ DB đề xuất (đã được lưu khi tạo đề xuất)
        // Dữ liệu này được lưu từ bước 3 (Set Titles) khi manager nhập cấp bậc/chức vụ
        const capBac = record.cap_bac;
        const chucVu = record.chuc_vu;

        // Nếu không có cả cấp bậc và chức vụ, để trống
        if (!capBac && !chucVu) {
          return (
            <div style={{ textAlign: 'center' }}>
              <span style={{ fontStyle: 'italic', opacity: 0.6 }}>
                Chưa có dữ liệu
              </span>
            </div>
          );
        }

        return (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            {capBac && <Text strong>{capBac}</Text>}
            {chucVu && (
              <Text type="secondary" style={{ fontSize: '12px', marginTop: capBac ? '4px' : '0' }}>
                {chucVu}
              </Text>
            )}
          </div>
        );
      },
    },
    {
      title: 'Năm',
      dataIndex: 'nam',
      key: 'nam',
      width: 80,
      align: 'center' as const,
      render: (_: any, record: ThanhTichItem, index: number) => (
        <div style={{ textAlign: 'center' }}>
          <EditableCell
            value={record.nam}
            type="number"
            onSave={val => updateThanhTich(index, 'nam', parseInt(val))}
            editable={false}
          />
        </div>
      ),
    },
    {
      title: 'Loại',
      dataIndex: 'loai',
      key: 'loai',
      width: 100,
      align: 'center' as const,
      render: (_: any, record: ThanhTichItem, index: number) => (
        <div style={{ textAlign: 'center' }}>
          <EditableCell
            value={record.loai}
            type="select"
            options={[
              { label: 'ĐTKH', value: 'DTKH' },
              { label: 'SKKH', value: 'SKKH' },
            ]}
            onSave={val => updateThanhTich(index, 'loai', val)}
            editable={false}
          />
        </div>
      ),
    },
    {
      title: 'Mô tả',
      dataIndex: 'mo_ta',
      key: 'mo_ta',
      align: 'center' as const,
      render: (_: any, record: ThanhTichItem, index: number) => (
        <div style={{ textAlign: 'center' }}>
          <EditableCell
            value={record.mo_ta}
            type="text"
            onSave={val => updateThanhTich(index, 'mo_ta', val)}
            editable={false}
          />
        </div>
      ),
    },
    {
      title: 'Số quyết định',
      dataIndex: 'so_quyet_dinh',
      key: 'so_quyet_dinh',
      width: 180,
      align: 'center' as const,
      render: (_: any, record: ThanhTichItem, index: number) => {
        const soQuyetDinh = record.so_quyet_dinh;
        if (!soQuyetDinh || (typeof soQuyetDinh === 'string' && soQuyetDinh.trim() === '')) {
          return (
            <div style={{ textAlign: 'center' }}>
              <span style={{ fontWeight: 400, fontStyle: 'italic', opacity: 0.6 }}>
                Chưa có số quyết định
              </span>
            </div>
          );
        }

        return (
          <div style={{ textAlign: 'center' }}>
            <a
              onClick={e => {
                e.preventDefault();
                e.stopPropagation();
                handleOpenDecisionFile(soQuyetDinh);
              }}
              style={{
                color: '#52c41a',
                fontWeight: 500,
                textDecoration: 'underline',
                cursor: 'pointer',
              }}
            >
              {soQuyetDinh}
            </a>
          </div>
        );
      },
    },
  ];

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
        <Breadcrumb style={{ marginBottom: '16px' }}>
          <Breadcrumb.Item href="/">
            <HomeOutlined />
          </Breadcrumb.Item>
          <Breadcrumb.Item href="/admin/proposals/review">Duyệt Đề Xuất</Breadcrumb.Item>
          <Breadcrumb.Item>Chi Tiết</Breadcrumb.Item>
        </Breadcrumb>

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
              <Title level={2}>Chi Tiết Đề Xuất</Title>
              <Paragraph>Xem và chỉnh sửa trước khi phê duyệt</Paragraph>
            </div>
            {proposal.status === PROPOSAL_STATUS.APPROVED ? (
              <Tag color="success" style={{ fontSize: 14, padding: '4px 12px' }}>
                Đã phê duyệt
              </Tag>
            ) : (
              <Tag color="warning" style={{ fontSize: 14, padding: '4px 12px' }}>
                Đang chờ duyệt
              </Tag>
            )}
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
                <Tag color="blue">
                  {proposal.loai_de_xuat === PROPOSAL_TYPES.CA_NHAN_HANG_NAM
                    ? 'Cá nhân Hằng năm'
                    : proposal.loai_de_xuat === PROPOSAL_TYPES.DON_VI_HANG_NAM
                      ? 'Đơn vị Hằng năm'
                      : proposal.loai_de_xuat === PROPOSAL_TYPES.NIEN_HAN
                        ? 'Huy chương Chiến sĩ vẻ vang'
                        : proposal.loai_de_xuat === PROPOSAL_TYPES.HC_QKQT
                          ? 'Huy chương Quân kỳ Quyết thắng'
                          : proposal.loai_de_xuat === PROPOSAL_TYPES.KNC_VSNXD_QDNDVN
                            ? 'Kỷ niệm chương VSNXD QĐNDVN'
                            : proposal.loai_de_xuat === PROPOSAL_TYPES.CONG_HIEN
                              ? 'Huân chương Bảo vệ Tổ quốc'
                              : proposal.loai_de_xuat === PROPOSAL_TYPES.NCKH
                                ? 'Nghiên cứu khoa học'
                                : proposal.loai_de_xuat === PROPOSAL_TYPES.DOT_XUAT
                                  ? 'Đột xuất'
                                  : proposal.loai_de_xuat}
                </Tag>
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
                {proposal.status === PROPOSAL_STATUS.PENDING ? (
                  <Tag color="warning">Đang chờ duyệt</Tag>
                ) : proposal.status === PROPOSAL_STATUS.APPROVED ? (
                  <Tag color="success">Đã phê duyệt</Tag>
                ) : (
                  <Tag color="error">Từ chối</Tag>
                )}
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
              <div style={{ fontWeight: 500 }}>
                {formatDateTime(proposal.createdAt)}
              </div>
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
                  <div style={{ fontWeight: 500 }}>
                    {formatDateTime(proposal.ngay_duyet)}
                  </div>
                </div>
              </>
            )}
          </div>
        </Card>

        {/* Ghi chú */}
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

        {/* File đính kèm */}
        <Card title="File đính kèm" style={{ marginBottom: '24px' }}>
          {proposal.files_attached && proposal.files_attached.length > 0 ? (
            <Space direction="vertical" style={{ width: '100%' }} size="small">
              {proposal.files_attached.map((file: any, index: number) => (
                <div
                  key={index}
                  className="file-attachment-item"
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
                    <FileTextOutlined style={{ color: '#1890ff', fontSize: '16px' }} />
                    <Text style={{ fontSize: '14px' }}>
                      {file.originalName ||
                        file.originalname ||
                        file.filename ||
                        'Không có tên file'}
                    </Text>
                    {file.size && (
                      <Text type="secondary" style={{ fontSize: '12px' }}>
                        ({(file.size / 1024).toFixed(2)} KB)
                      </Text>
                    )}
                  </div>
                  <Button
                    type="primary"
                    icon={<EyeOutlined />}
                    onClick={() => {
                      const filename = file.filename;
                      const displayName =
                        file.originalName || file.originalname || file.filename || 'document.pdf';
                      previewFileWithApi(`/api/proposals/uploads/${filename}`, displayName);
                    }}
                  >
                    Xem file
                  </Button>
                </div>
              ))}
            </Space>
          ) : (
            <Text type="secondary">Không có file đính kèm</Text>
          )}
        </Card>

        {/* Hiển thị theo loại đề xuất - không chia tab */}
        {proposal.loai_de_xuat === PROPOSAL_TYPES.NCKH ? (
          // Component cho đề xuất NCKH (ĐTKH/SKKH) - chỉ hiển thị Thành Tích
          <Card
            title="Thành Tích Khoa Học"
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
                rowSelection={proposal.status === PROPOSAL_STATUS.PENDING ? thanhTichRowSelection : undefined}
                columns={thanhTichColumns}
                dataSource={editedThanhTich}
                rowKey={(_, index) => index ?? 0}
                pagination={false}
                scroll={{ x: true }}
              />
            )}
          </Card>
        ) : proposal.loai_de_xuat === PROPOSAL_TYPES.NIEN_HAN ||
          proposal.loai_de_xuat === PROPOSAL_TYPES.HC_QKQT ||
          proposal.loai_de_xuat === PROPOSAL_TYPES.KNC_VSNXD_QDNDVN ? (
          // Component cho đề xuất NIEN_HAN - hiển thị từ editedNienHan
          <Card
            title={
              proposal.loai_de_xuat === PROPOSAL_TYPES.NIEN_HAN
                ? 'Danh Sách Huy chương Chiến sĩ vẻ vang'
                : proposal.loai_de_xuat === PROPOSAL_TYPES.HC_QKQT
                  ? 'Huy chương quân kỳ Quyết Thắng'
                  : 'Kỷ Niệm Chương Vì Sự Nghiệp XD QĐNDVN'
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
                  Thêm số quyết định ({selectedRowKeys.length} người)
                </Button>
              )
            }
          >
            {editedNienHan.length === 0 ? (
              <Empty
                image={<WarningOutlined style={{ fontSize: 48, color: '#d9d9d9' }} />}
                description="Không có dữ liệu huy chương chiến sĩ vẻ vang"
              />
            ) : (
              <Table
                rowSelection={proposal.status === PROPOSAL_STATUS.PENDING ? rowSelection : undefined}
                columns={caNhanHangNamColumns}
                dataSource={editedNienHan}
                rowKey={(_, index) => index ?? 0}
                pagination={false}
                scroll={{ x: true }}
              />
            )}
          </Card>
        ) : proposal.loai_de_xuat === PROPOSAL_TYPES.CONG_HIEN ? (
          // Component cho đề xuất CỐNG HIẾN - hiển thị từ editedCongHien
          <Card
            title="Danh Sách Huân chương Bảo vệ Tổ quốc"
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
                  Thêm số quyết định ({selectedRowKeys.length} người)
                </Button>
              )
            }
          >
            {editedCongHien.length === 0 ? (
              <Empty
                image={<WarningOutlined style={{ fontSize: 48, color: '#d9d9d9' }} />}
                description="Không có dữ liệu huân chương bảo vệ tổ quốc"
              />
            ) : (
              <Table
                rowSelection={proposal.status === PROPOSAL_STATUS.PENDING ? rowSelection : undefined}
                columns={caNhanHangNamColumns}
                dataSource={editedCongHien}
                rowKey={(_, index) => index ?? 0}
                pagination={false}
                scroll={{ x: true }}
              />
            )}
          </Card>
        ) : editedDanhHieu.length > 0 ? (
          // Component cho đề xuất có danh hiệu - chỉ hiển thị Danh Hiệu
          <Card
            title={
              proposal.loai_de_xuat === PROPOSAL_TYPES.DON_VI_HANG_NAM
                ? 'Danh Hiệu Đơn Vị Hằng Năm'
                : 'Danh Hiệu Hằng Năm'
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
                rowSelection={proposal.status === PROPOSAL_STATUS.PENDING ? rowSelection : undefined}
                columns={
                  proposal.loai_de_xuat === PROPOSAL_TYPES.DON_VI_HANG_NAM
                    ? donViHangNamColumns
                    : proposal.loai_de_xuat === PROPOSAL_TYPES.CA_NHAN_HANG_NAM
                      ? caNhanHangNamColumns
                      : caNhanHangNamColumns
                }
                dataSource={editedDanhHieu}
                rowKey={(_, index) => index ?? 0}
                pagination={false}
                scroll={{ x: true }}
              />
            )}
          </Card>
        ) : null}

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
                danger
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
          <Alert
            message="Lưu ý"
            description={
              <div style={{ textAlign: 'center' }}>
                Vui lòng nhập lý do từ chối để Manager biết và chỉnh sửa lại đề xuất.
              </div>
            }
            type="warning"
            showIcon
            style={{ marginBottom: 16 }}
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
      </div>
    </ConfigProvider>
  );
}
