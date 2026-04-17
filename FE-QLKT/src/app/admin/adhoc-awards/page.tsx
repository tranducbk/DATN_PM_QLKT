'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Card,
  Button,
  Table,
  Tag,
  Space,
  Typography,
  Breadcrumb,
  Spin,
  message,
  Modal,
  Select,
  InputNumber,
  Input,
  Upload,
  Popconfirm,
  Tooltip,
  Steps,
  Alert,
  AutoComplete,
  DatePicker,
  Descriptions,
  Row,
  Col,
  List,
} from 'antd';
import dayjs from 'dayjs';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  FileOutlined,
  DownloadOutlined,
  HomeOutlined,
  UserOutlined,
  TeamOutlined,
  UploadOutlined,
  EyeOutlined,
  SearchOutlined,
  FilterOutlined,
  ClearOutlined,
} from '@ant-design/icons';
import type { TableColumnsType, UploadFile } from 'antd';
import { apiClient } from '@/lib/apiClient';
import { DEFAULT_ANTD_TABLE_PAGINATION, FETCH_ALL_LIMIT } from '@/lib/constants/pagination.constants';
import { PROPOSAL_TYPES } from '@/constants/proposal.constants';
import { downloadDecisionFile } from '@/utils/downloadDecisionFile';
import { previewFileWithApi } from '@/utils/filePreview';

const { Title, Text } = Typography;
const { TextArea } = Input;
const { Search } = Input;

// TYPES
interface AdhocAward {
  id: string;
  loai: string; // KHEN_THUONG_DOT_XUAT
  doi_tuong: 'CA_NHAN' | 'TAP_THE';
  quan_nhan_id?: string;
  co_quan_don_vi_id?: string;
  don_vi_truc_thuoc_id?: string;
  hinh_thuc_khen_thuong: string;
  nam: number;
  cap_bac?: string;
  chuc_vu?: string;
  ghi_chu?: string;
  so_quyet_dinh?: string;
  files_dinh_kem?: FileInfo[];
  createdAt: string;
  QuanNhan?: {
    id: string;
    ho_ten: string;
    cccd?: string;
    cap_bac?: string;
    CoQuanDonVi?: { ten_don_vi: string };
    DonViTrucThuoc?: { ten_don_vi: string };
    ChucVu?: { ten_chuc_vu: string };
  };
  CoQuanDonVi?: { id: string; ten_don_vi: string };
  DonViTrucThuoc?: { id: string; ten_don_vi: string; CoQuanDonVi?: { ten_don_vi: string } };
}

interface FileInfo {
  filename: string;
  originalName: string;
  path: string;
  size: number;
  mimeType: string;
  uploadedAt: string;
}

interface Personnel {
  id: string;
  ho_ten: string;
  cccd?: string;
  ngay_sinh?: string;
  gioi_tinh?: string;
  cap_bac?: string;
  co_quan_don_vi_id?: string;
  don_vi_truc_thuoc_id?: string;
  ChucVu?: { ten_chuc_vu: string };
}

interface Unit {
  id: string;
  ten_don_vi: string;
  ma_don_vi?: string;
  co_quan_don_vi_id?: string;
}

/** Một dòng từ autocomplete quyết định. */
interface DecisionAutocompleteRow {
  so_quyet_dinh: string;
  nguoi_ky: string;
  ngay_ky: string;
}

interface PersonnelAwardInfo {
  personnelId: string;
  rank: string; // Rank at the time of award
  position: string; // Position at the time of award
}

interface CreateFormData {
  type: 'CA_NHAN' | 'TAP_THE';
  year: number;
  awardForm: string;
  personnelIds: string[];
  personnelAwardInfo: PersonnelAwardInfo[];
  unitIds: string[];
  note: string;
  decisionNumber: string;
  decisionYear: number;
  signer: string;
  signDate: string;
  decisionFilePath?: string | null;
  currentStep: number;
}

interface EditFormData {
  awardForm: string;
  year: number;
  rank: string;
  position: string;
  note: string;
  decisionNumber: string;
}

// CONSTANTS
const INITIAL_CREATE_FORM: CreateFormData = {
  type: 'CA_NHAN',
  year: new Date().getFullYear(),
  awardForm: '',
  personnelIds: [],
  personnelAwardInfo: [],
  unitIds: [],
  note: '',
  decisionNumber: '',
  decisionYear: new Date().getFullYear(),
  signer: '',
  signDate: '',
  currentStep: 0,
};

const INITIAL_EDIT_FORM: EditFormData = {
  awardForm: '',
  year: new Date().getFullYear(),
  rank: '',
  position: '',
  note: '',
  decisionNumber: '',
};

interface TableFilters {
  year: number | null;
  searchText: string;
  type: 'ALL' | 'CA_NHAN' | 'TAP_THE';
}

const INITIAL_TABLE_FILTERS: TableFilters = {
  year: null,
  searchText: '',
  type: 'ALL',
};

const RANK_OPTIONS = [
  { value: 'Binh nhì', label: 'Binh nhì' },
  { value: 'Binh nhất', label: 'Binh nhất' },
  { value: 'Hạ sĩ', label: 'Hạ sĩ' },
  { value: 'Trung sĩ', label: 'Trung sĩ' },
  { value: 'Thượng sĩ', label: 'Thượng sĩ' },
  { value: 'Thiếu úy', label: 'Thiếu úy' },
  { value: 'Trung úy', label: 'Trung úy' },
  { value: 'Thượng úy', label: 'Thượng úy' },
  { value: 'Đại úy', label: 'Đại úy' },
  { value: 'Thiếu tá', label: 'Thiếu tá' },
  { value: 'Trung tá', label: 'Trung tá' },
  { value: 'Thượng tá', label: 'Thượng tá' },
  { value: 'Đại tá', label: 'Đại tá' },
  { value: 'Thiếu tướng', label: 'Thiếu tướng' },
  { value: 'Trung tướng', label: 'Trung tướng' },
  { value: 'Thượng tướng', label: 'Thượng tướng' },
  { value: 'Đại tướng', label: 'Đại tướng' },
];

// MAIN COMPONENT
export default function AdhocAwardsPage() {
  // Data states
  const [awards, setAwards] = useState<AdhocAward[]>([]);
  const [personnel, setPersonnel] = useState<Personnel[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [subUnits, setSubUnits] = useState<Unit[]>([]);

  // Loading states
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Create modal states
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [createFormData, setCreateFormData] = useState<CreateFormData>(INITIAL_CREATE_FORM);
  const [createAttachedFileList, setCreateAttachedFileList] = useState<UploadFile[]>([]);

  // Edit modal states
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingAward, setEditingAward] = useState<AdhocAward | null>(null);
  const [editFormData, setEditFormData] = useState<EditFormData>(INITIAL_EDIT_FORM);
  const [editAttachedFileList, setEditAttachedFileList] = useState<UploadFile[]>([]);
  const [removedAttachedFileIndexes, setRemovedAttachedFileIndexes] = useState<number[]>([]);

  // Detail modal states
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [detailAward, setDetailAward] = useState<AdhocAward | null>(null);

  // Files modal states
  const [filesModalVisible, setFilesModalVisible] = useState(false);
  const [filesModalData, setFilesModalData] = useState<FileInfo[]>([]);

  // Decision autocomplete states
  const [decisionOptions, setDecisionOptions] = useState<{ value: string; label: string }[]>([]);
  const [searchingDecision, setSearchingDecision] = useState(false);
  const [selectedDecision, setSelectedDecision] = useState<any>(null);

  // Table filter states
  const [tableFilters, setTableFilters] = useState<TableFilters>(INITIAL_TABLE_FILTERS);

  // Filter states for create modal
  const [personnelFilters, setPersonnelFilters] = useState({
    coQuanId: '',
    donViId: '',
    searchName: '',
  });
  const [unitFilters, setUnitFilters] = useState({ type: 'ALL' });

  // DATA FETCHING
  const fetchAwards = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiClient.getAdhocAwards();
      const awardsData = res.data ?? [];
      setAwards(awardsData);
    } catch (err) {
      message.error('Không tải được danh sách khen thưởng đột xuất');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchPersonnelAndUnits = useCallback(async () => {
    try {
      const [personnelRes, allUnitsRes] = await Promise.all([
        apiClient.getPersonnel({ limit: FETCH_ALL_LIMIT }),
        apiClient.getUnits(),
      ]);

      const personnelData = personnelRes.data || [];

      const allUnitsData = Array.isArray(allUnitsRes.data) ? allUnitsRes.data : [];

      const coQuanDonVi = allUnitsData.filter((u: Unit) => !u.co_quan_don_vi_id);
      const donViTrucThuoc = allUnitsData.filter((u: Unit) => u.co_quan_don_vi_id);

      setPersonnel(personnelData);
      setUnits(coQuanDonVi);
      setSubUnits(donViTrucThuoc);
    } catch (err) {
      message.error('Không tải được dữ liệu đối tượng');
    }
  }, []);

  useEffect(() => {
    fetchAwards();
    fetchPersonnelAndUnits();
  }, [fetchAwards, fetchPersonnelAndUnits]);

  // DECISION AUTOCOMPLETE
  const handleSearchDecision = async (value: string) => {
    if (!value || value.trim().length === 0) {
      setDecisionOptions([]);
      return;
    }

    try {
      setSearchingDecision(true);
      const response = await apiClient.autocompleteDecisions(
        value.trim(),
        10,
        PROPOSAL_TYPES.DOT_XUAT
      );
      if (response.success && response.data) {
        setDecisionOptions(
          (response.data as DecisionAutocompleteRow[]).map(item => ({
            value: item.so_quyet_dinh,
            label: `${item.so_quyet_dinh} - ${item.nguoi_ky} (${dayjs(item.ngay_ky).format('DD/MM/YYYY')})`,
          }))
        );
      } else {
        setDecisionOptions([]);
      }
    } catch {
      setDecisionOptions([]);
    } finally {
      setSearchingDecision(false);
    }
  };

  const handleDecisionSelect = async (value: string, isEdit = false) => {
    try {
      const response = await apiClient.getDecisionBySoQuyetDinh(value);
      if (response.success && response.data) {
        const decision = response.data;
        setSelectedDecision(decision);

        if (isEdit) {
          setEditFormData(prev => ({
            ...prev,
            decisionNumber: decision.so_quyet_dinh,
          }));
        } else {
          setCreateFormData(prev => ({
            ...prev,
            decisionNumber: decision.so_quyet_dinh,
            decisionYear: decision.nam,
            signDate: dayjs(decision.ngay_ky).format('YYYY-MM-DD'),
            signer: decision.nguoi_ky,
          }));
        }

        message.info('Đã tải thông tin quyết định từ hệ thống');
      }
    } catch {
      message.error('Lỗi khi tải thông tin quyết định');
    }
  };

  // FILE HANDLING
  const handleOpenDecisionFile = async (soQuyetDinh: string) => {
    await downloadDecisionFile(soQuyetDinh);
  };

  // CREATE HANDLERS
  const handleOpenCreateModal = () => {
    setCreateFormData(INITIAL_CREATE_FORM);
    setCreateAttachedFileList([]);
    setSelectedDecision(null);
    setDecisionOptions([]);
    setPersonnelFilters({ coQuanId: '', donViId: '', searchName: '' });
    setUnitFilters({ type: 'ALL' });
    setCreateModalVisible(true);
  };

  const handleCloseCreateModal = () => {
    setCreateModalVisible(false);
    setCreateFormData(INITIAL_CREATE_FORM);
  };

  const handleCreateSubmit = async () => {
    const { type, awardForm, year, personnelIds, unitIds, decisionNumber, signer, signDate, note } =
      createFormData;

    // Validation
    if (!awardForm || !year) {
      message.error('Vui lòng điền đầy đủ thông tin bắt buộc');
      return;
    }

    if (type === 'CA_NHAN' && personnelIds.length === 0) {
      message.error('Vui lòng chọn ít nhất một quân nhân');
      return;
    }

    if (type === 'TAP_THE' && unitIds.length === 0) {
      message.error('Vui lòng chọn ít nhất một đơn vị');
      return;
    }

    // Rank and position are required for CA_NHAN awards
    if (type === 'CA_NHAN') {
      const missingInfo = createFormData.personnelAwardInfo.filter(
        info => !info.rank || !info.position
      );
      if (missingInfo.length > 0) {
        const missingNames = missingInfo
          .map(info => personnel.find(p => p.id === info.personnelId)?.ho_ten)
          .filter(Boolean)
          .join(', ');
        message.error(`Vui lòng nhập đầy đủ cấp bậc và chức vụ cho: ${missingNames}`);
        return;
      }
    }

    try {
      setSubmitting(true);
      const targetIds = type === 'CA_NHAN' ? personnelIds : unitIds;

      for (const targetId of targetIds) {
        const formData = new FormData();
        formData.append('type', type);
        formData.append('year', year.toString());
        formData.append('awardForm', awardForm);

        if (type === 'CA_NHAN') {
          formData.append('personnelId', targetId);
          const awardInfo = createFormData.personnelAwardInfo.find(
            info => info.personnelId === targetId
          );
          formData.append('rank', awardInfo?.rank || '');
          formData.append('position', awardInfo?.position || '');
        } else {
          const isCoQuan = units.find(u => u.id === targetId);
          const unitType = isCoQuan ? 'CO_QUAN_DON_VI' : 'DON_VI_TRUC_THUOC';
          formData.append('unitId', targetId);
          formData.append('unitType', unitType);
        }

        if (note) formData.append('note', note);
        if (decisionNumber) formData.append('decisionNumber', decisionNumber);

        createAttachedFileList.forEach(file => {
          if (file.originFileObj) {
            formData.append('attachedFiles', file.originFileObj);
          }
        });

        const result = await apiClient.createAdhocAward(formData);
        if (!result.success) {
          message.error(result.message || 'Thao tác thất bại');
          return;
        }
      }

      message.success(`Tạo thành công ${targetIds.length} khen thưởng đột xuất`);
      handleCloseCreateModal();
      fetchAwards();
    } catch {
      message.error('Thao tác thất bại');
    } finally {
      setSubmitting(false);
    }
  };

  // EDIT HANDLERS
  const handleOpenEditModal = (award: AdhocAward) => {
    setEditingAward(award);
    setEditFormData({
      awardForm: award.hinh_thuc_khen_thuong,
      year: award.nam,
      rank: award.cap_bac || '',
      position: award.chuc_vu || '',
      note: award.ghi_chu || '',
      decisionNumber: award.so_quyet_dinh || '',
    });

    // Convert existing attached files to UploadFile format
    const existingAttachedFiles: UploadFile[] =
      award.files_dinh_kem?.map((file, index) => ({
        uid: `existing-attached-${index}`,
        name: file.originalName,
        status: 'done' as const,
        url: `/${file.path}`,
      })) || [];

    setEditAttachedFileList(existingAttachedFiles);
    setRemovedAttachedFileIndexes([]);
    setSelectedDecision(null);
    setDecisionOptions([]);
    setEditModalVisible(true);
  };

  const handleCloseEditModal = () => {
    setEditModalVisible(false);
    setEditingAward(null);
    setEditFormData(INITIAL_EDIT_FORM);
    setEditAttachedFileList([]);
    setRemovedAttachedFileIndexes([]);
  };

  const handleRemoveExistingAttachedFile = (fileUid: string) => {
    const match = fileUid.match(/existing-attached-(\d+)/);
    if (match) {
      const index = parseInt(match[1]);
      setRemovedAttachedFileIndexes(prev => [...prev, index]);
    }
    setEditAttachedFileList(prev => prev.filter(f => f.uid !== fileUid));
  };

  const handleEditSubmit = async () => {
    if (!editingAward) return;

    const { awardForm, year, rank, position, note, decisionNumber } = editFormData;

    if (!awardForm || !year) {
      message.error('Vui lòng điền đầy đủ thông tin bắt buộc');
      return;
    }

    try {
      setSubmitting(true);

      const formData = new FormData();
      formData.append('awardForm', awardForm);
      formData.append('year', year.toString());
      // Allow empty string to clear existing rank/position
      formData.append('rank', rank);
      formData.append('position', position);
      if (note) formData.append('note', note);
      if (decisionNumber) formData.append('decisionNumber', decisionNumber);

      editAttachedFileList.forEach(file => {
        if (file.originFileObj) {
          formData.append('attachedFiles', file.originFileObj);
        }
      });

      // Add removed file indexes
      if (removedAttachedFileIndexes.length > 0) {
        formData.append('removeAttachedFileIndexes', JSON.stringify(removedAttachedFileIndexes));
      }

      const result = await apiClient.updateAdhocAward(editingAward.id, formData);

      if (!result.success) {
        message.error(result.message || 'Cập nhật thất bại');
        return;
      }
      message.success('Cập nhật khen thưởng đột xuất thành công');
      handleCloseEditModal();
      fetchAwards();
    } catch {
      message.error('Cập nhật thất bại');
    } finally {
      setSubmitting(false);
    }
  };

  // DELETE HANDLER
  const handleDelete = async (id: string) => {
    try {
      const result = await apiClient.deleteAdhocAward(id);
      if (!result.success) {
        message.error(result.message || 'Xóa thất bại');
        return;
      }
      message.success('Xóa khen thưởng đột xuất thành công');
      fetchAwards();
    } catch {
      message.error('Xóa thất bại');
    }
  };

  // DETAIL MODAL HANDLERS
  const handleOpenDetailModal = (award: AdhocAward) => {
    setDetailAward(award);
    setDetailModalVisible(true);
  };

  const handleCloseDetailModal = () => {
    setDetailModalVisible(false);
    setDetailAward(null);
  };

  // FILES MODAL HANDLERS
  const handleOpenFilesModal = (files: FileInfo[]) => {
    setFilesModalData(files);
    setFilesModalVisible(true);
  };

  const handleCloseFilesModal = () => {
    setFilesModalVisible(false);
    setFilesModalData([]);
  };

  const handlePreviewFile = async (file: FileInfo) => {
    await previewFileWithApi(`/api/proposals/uploads/${file.filename}`, file.originalName);
  };

  // TABLE FILTER HANDLERS
  const handleResetFilters = () => {
    setTableFilters(INITIAL_TABLE_FILTERS);
  };

  // Get unique years from awards for filter dropdown
  const availableYears = useMemo(() => {
    const years = Array.from(new Set(awards.map(a => a.nam))).sort((a, b) => b - a);
    return years;
  }, [awards]);

  // FILTERED TABLE DATA
  const filteredAwards = useMemo(() => {
    return awards.filter(award => {
      // Filter by year
      if (tableFilters.year && award.nam !== tableFilters.year) {
        return false;
      }

      // Filter by type
      if (tableFilters.type !== 'ALL' && award.doi_tuong !== tableFilters.type) {
        return false;
      }

      // Filter by search text (name, decision number, note)
      if (tableFilters.searchText) {
        const searchLower = tableFilters.searchText.toLowerCase();
        const name =
          award.doi_tuong === 'CA_NHAN'
            ? award.QuanNhan?.ho_ten || ''
            : award.CoQuanDonVi?.ten_don_vi || award.DonViTrucThuoc?.ten_don_vi || '';
        const decisionNumber = award.so_quyet_dinh || '';
        const note = award.ghi_chu || '';
        const awardForm = award.hinh_thuc_khen_thuong || '';

        if (
          !name.toLowerCase().includes(searchLower) &&
          !decisionNumber.toLowerCase().includes(searchLower) &&
          !note.toLowerCase().includes(searchLower) &&
          !awardForm.toLowerCase().includes(searchLower)
        ) {
          return false;
        }
      }

      return true;
    });
  }, [awards, tableFilters]);

  // FILTERED DATA FOR CREATE MODAL
  const filteredPersonnel = personnel.filter(p => {
    if (personnelFilters.coQuanId && p.co_quan_don_vi_id !== personnelFilters.coQuanId)
      return false;
    if (personnelFilters.donViId && p.don_vi_truc_thuoc_id !== personnelFilters.donViId)
      return false;
    if (
      personnelFilters.searchName &&
      !p.ho_ten.toLowerCase().includes(personnelFilters.searchName.toLowerCase())
    )
      return false;
    return true;
  });

  const filteredUnits = [...units, ...subUnits].filter(u => {
    if (unitFilters.type === 'CO_QUAN' && subUnits.some(s => s.id === u.id)) return false;
    if (unitFilters.type === 'DON_VI' && units.some(s => s.id === u.id)) return false;
    return true;
  });

  // TABLE COLUMNS
  const columns: TableColumnsType<AdhocAward> = [
    {
      title: 'STT',
      key: 'stt',
      width: 50,
      align: 'center',
      render: (_, __, index) => <div style={{ textAlign: 'center' }}>{index + 1}</div>,
    },
    {
      title: 'Năm',
      dataIndex: 'nam',
      key: 'nam',
      width: 70,
      align: 'center',
      sorter: (a, b) => a.nam - b.nam,
      render: (text: number) => <div style={{ textAlign: 'center' }}>{text}</div>,
    },
    {
      title: 'Đối tượng',
      dataIndex: 'doi_tuong',
      key: 'doi_tuong',
      width: 100,
      align: 'center',
      render: (doiTuong: string) => (
        <div style={{ textAlign: 'center' }}>
          <Tag color={doiTuong === 'CA_NHAN' ? 'blue' : 'green'}>
            {doiTuong === 'CA_NHAN' ? (
              <>
                <UserOutlined /> Cá nhân
              </>
            ) : (
              <>
                <TeamOutlined /> Tập thể
              </>
            )}
          </Tag>
        </div>
      ),
    },
    {
      title: 'Chi tiết đối tượng',
      key: 'target',
      ellipsis: true,
      align: 'center',
      render: (_, record) => {
        if (record.doi_tuong === 'CA_NHAN' && record.QuanNhan) {
          // Use stored rank/position from the award record, not from the current personnel profile
          const capBac = record.cap_bac || record.QuanNhan.cap_bac;
          const chucVu = record.chuc_vu || record.QuanNhan.ChucVu?.ten_chuc_vu;
          const subInfo = [capBac, chucVu].filter(Boolean).join(' - ');
          return (
            <div style={{ textAlign: 'center' }}>
              <strong>{record.QuanNhan.ho_ten}</strong>
              {subInfo && (
                <div>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {subInfo}
                  </Text>
                </div>
              )}
            </div>
          );
        } else if (record.doi_tuong === 'TAP_THE') {
          const unitName = record.CoQuanDonVi?.ten_don_vi || record.DonViTrucThuoc?.ten_don_vi;
          return (
            <div style={{ textAlign: 'center' }}>
              <strong>{unitName || '-'}</strong>
              {record.DonViTrucThuoc?.CoQuanDonVi && (
                <div>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {record.DonViTrucThuoc.CoQuanDonVi.ten_don_vi}
                  </Text>
                </div>
              )}
            </div>
          );
        }
        return (
          <div style={{ textAlign: 'center' }}>
            <Text type="secondary">-</Text>
          </div>
        );
      },
    },
    {
      title: 'Hình thức khen thưởng',
      dataIndex: 'hinh_thuc_khen_thuong',
      key: 'hinh_thuc_khen_thuong',
      ellipsis: true,
      align: 'center',
      render: (text: string, record: AdhocAward) => (
        <div style={{ textAlign: 'center' }}>
          <span>{text}</span>
          {record.so_quyet_dinh && (
            <div>
              <a
                onClick={e => {
                  e.stopPropagation();
                  handleOpenDecisionFile(record.so_quyet_dinh!);
                }}
                style={{ color: '#52c41a', cursor: 'pointer', fontSize: 12 }}
              >
                QĐ: {record.so_quyet_dinh}
              </a>
            </div>
          )}
        </div>
      ),
    },
    {
      title: 'Ghi chú',
      dataIndex: 'ghi_chu',
      key: 'ghi_chu',
      width: 120,
      ellipsis: true,
      align: 'center',
      render: (text: string) => (
        <div style={{ textAlign: 'center' }}>
          {text ? (
            <Tooltip title={text}>
              <span>{text}</span>
            </Tooltip>
          ) : (
            <Text type="secondary" style={{ fontStyle: 'italic', opacity: 0.6 }}>
              Không có ghi chú
            </Text>
          )}
        </div>
      ),
    },
    {
      title: 'Thao tác',
      key: 'action',
      width: 150,
      align: 'center',
      render: (_, record) => (
        <div style={{ textAlign: 'center' }}>
          <Space size="small">
            <Tooltip title="Xem chi tiết">
              <Button
                type="text"
                icon={<EyeOutlined />}
                onClick={e => {
                  e.stopPropagation();
                  handleOpenDetailModal(record);
                }}
                size="small"
                style={{ color: '#52c41a' }}
              />
            </Tooltip>
            <Tooltip title="Chỉnh sửa">
              <Button
                type="text"
                icon={<EditOutlined />}
                onClick={e => {
                  e.stopPropagation();
                  handleOpenEditModal(record);
                }}
                size="small"
                style={{ color: '#1890ff' }}
              />
            </Tooltip>
            <Popconfirm
              title="Xác nhận xóa"
              description="Bạn có chắc chắn muốn xóa khen thưởng này?"
              onConfirm={e => {
                e?.stopPropagation();
                handleDelete(record.id);
              }}
              onCancel={e => e?.stopPropagation()}
              okText="Xóa"
              cancelText="Hủy"
              okButtonProps={{ danger: true }}
            >
              <Tooltip title="Xóa">
                <Button
                  type="text"
                  danger
                  icon={<DeleteOutlined />}
                  size="small"
                  onClick={e => e.stopPropagation()}
                />
              </Tooltip>
            </Popconfirm>
          </Space>
        </div>
      ),
    },
  ];

  // RENDER CREATE MODAL STEPS
  const renderCreateStep = () => {
    const { currentStep, type } = createFormData;

    switch (currentStep) {
      case 0:
        return (
          <Space direction="vertical" style={{ width: '100%' }} size="middle">
            <div>
              <Text strong style={{ display: 'block', marginBottom: 8 }}>
                Loại <span style={{ color: '#ff4d4f' }}>*</span>
              </Text>
              <Select
                size="large"
                style={{ width: '100%' }}
                value={type}
                onChange={value =>
                  setCreateFormData({
                    ...createFormData,
                    type: value,
                    personnelIds: [],
                    personnelAwardInfo: [],
                    unitIds: [],
                  })
                }
              >
                <Select.Option value="CA_NHAN">Cá nhân</Select.Option>
                <Select.Option value="TAP_THE">Tập thể</Select.Option>
              </Select>
            </div>

            <div>
              <Text strong style={{ display: 'block', marginBottom: 8 }}>
                Năm <span style={{ color: '#ff4d4f' }}>*</span>
              </Text>
              <InputNumber
                size="large"
                style={{ width: '100%' }}
                value={createFormData.year}
                onChange={value =>
                  setCreateFormData({ ...createFormData, year: value || new Date().getFullYear() })
                }
                min={2000}
                max={2100}
              />
            </div>

            <div>
              <Text strong style={{ display: 'block', marginBottom: 8 }}>
                Hình thức khen thưởng <span style={{ color: '#ff4d4f' }}>*</span>
              </Text>
              <Input
                size="large"
                value={createFormData.awardForm}
                onChange={e => setCreateFormData({ ...createFormData, awardForm: e.target.value })}
                placeholder='Ví dụ: "Giấy khen của HV", "Bằng khen của TC"'
              />
            </div>

          </Space>
        );

      case 1:
        return type === 'CA_NHAN' ? (
          <div>
            <div style={{ marginBottom: 12 }}>
              <Text type="secondary">
                Đã chọn:{' '}
                <strong style={{ color: '#1890ff' }}>{createFormData.personnelIds.length}</strong>{' '}
                quân nhân
              </Text>
            </div>
            <Space direction="vertical" size="small" style={{ marginBottom: 16, width: '100%' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div>
                  <Text style={{ display: 'block', marginBottom: 4 }}>Cơ quan đơn vị</Text>
                  <Select
                    style={{ width: '100%' }}
                    value={personnelFilters.coQuanId || undefined}
                    onChange={value =>
                      setPersonnelFilters({
                        ...personnelFilters,
                        coQuanId: value || '',
                        donViId: '',
                      })
                    }
                    allowClear
                    placeholder="Chọn cơ quan đơn vị"
                  >
                    {units.map(unit => (
                      <Select.Option key={unit.id} value={unit.id}>
                        {unit.ten_don_vi}
                      </Select.Option>
                    ))}
                  </Select>
                </div>
                <div>
                  <Text style={{ display: 'block', marginBottom: 4 }}>Đơn vị trực thuộc</Text>
                  <Select
                    style={{ width: '100%' }}
                    value={personnelFilters.donViId || undefined}
                    onChange={value =>
                      setPersonnelFilters({ ...personnelFilters, donViId: value || '' })
                    }
                    disabled={!personnelFilters.coQuanId}
                    allowClear
                    placeholder="Chọn đơn vị trực thuộc"
                  >
                    {subUnits
                      .filter(s => s.co_quan_don_vi_id === personnelFilters.coQuanId)
                      .map(sub => (
                        <Select.Option key={sub.id} value={sub.id}>
                          {sub.ten_don_vi}
                        </Select.Option>
                      ))}
                  </Select>
                </div>
              </div>
              <div>
                <Text style={{ display: 'block', marginBottom: 4 }}>Tìm kiếm theo tên</Text>
                <Input
                  value={personnelFilters.searchName}
                  onChange={e =>
                    setPersonnelFilters({ ...personnelFilters, searchName: e.target.value })
                  }
                  placeholder="Nhập tên quân nhân"
                />
              </div>
            </Space>
            <Table
              rowSelection={{
                selectedRowKeys: createFormData.personnelIds,
                onChange: (selectedRowKeys, selectedRows) => {
                  const newPersonnelIds = selectedRowKeys as string[];
                  // Preserve existing award info; pre-fill from personnel data for newly added rows
                  const newAwardInfo = newPersonnelIds.map(id => {
                    const existing = createFormData.personnelAwardInfo.find(
                      info => info.personnelId === id
                    );
                    if (existing) return existing;
                    const person =
                      selectedRows.find((r: Personnel) => r.id === id) ||
                      personnel.find(p => p.id === id);
                    return {
                      personnelId: id,
                      rank: person?.cap_bac || '',
                      position: person?.ChucVu?.ten_chuc_vu || '',
                    };
                  });
                  setCreateFormData({
                    ...createFormData,
                    personnelIds: newPersonnelIds,
                    personnelAwardInfo: newAwardInfo,
                  });
                },
              }}
              columns={[
                {
                  title: 'Họ tên',
                  dataIndex: 'ho_ten',
                  key: 'ho_ten',
                  width: 180,
                  render: (text: string, record: Personnel) => (
                    <div>
                      <strong>{text}</strong>
                      {record.cccd && (
                        <div>
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            CCCD: {record.cccd}
                          </Text>
                        </div>
                      )}
                    </div>
                  ),
                },
                {
                  title: 'Cấp bậc',
                  dataIndex: 'cap_bac',
                  key: 'cap_bac',
                  width: 120,
                  render: (text: string) => text || '-',
                },
                {
                  title: 'Chức vụ',
                  key: 'chuc_vu',
                  width: 150,
                  render: (_value, record: Personnel) => record.ChucVu?.ten_chuc_vu || '-',
                },
              ]}
              dataSource={filteredPersonnel}
              rowKey="id"
              pagination={{
                ...DEFAULT_ANTD_TABLE_PAGINATION,
              }}
              scroll={{ y: 300 }}
              size="small"
            />

            {/* Chỉnh sửa cấp bậc/chức vụ cho quân nhân đã chọn */}
            {createFormData.personnelIds.length > 0 && (
              <Card
                size="small"
                title={
                  <span>
                    Cấp bậc / Chức vụ ({createFormData.personnelIds.length} quân nhân)
                    <span style={{ color: '#ff4d4f' }}> *</span>
                  </span>
                }
                style={{ marginTop: 16 }}
              >
                <Text type="secondary" style={{ display: 'block', marginBottom: 12, fontSize: 12 }}>
                  Cấp bậc và chức vụ là bắt buộc, sẽ được lưu vào khen thưởng.
                </Text>
                <div style={{ maxHeight: 250, overflowY: 'auto' }}>
                  {createFormData.personnelAwardInfo.map((info, index) => {
                    const person = personnel.find(p => p.id === info.personnelId);
                    if (!person) return null;
                    const isMissingRank = !info.rank;
                    const isMissingPosition = !info.position;
                    return (
                      <div
                        key={info.personnelId}
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '180px 1fr 1fr',
                          gap: 12,
                          padding: '8px 0',
                          borderBottom:
                            index < createFormData.personnelAwardInfo.length - 1
                              ? '1px solid var(--ant-color-border)'
                              : 'none',
                          alignItems: 'center',
                        }}
                      >
                        <div>
                          <Text strong>{person.ho_ten}</Text>
                        </div>
                        <Select
                          size="large"
                          placeholder="Chọn cấp bậc *"
                          value={info.rank || undefined}
                          onChange={value => {
                            const newInfo = [...createFormData.personnelAwardInfo];
                            newInfo[index] = { ...newInfo[index], rank: value || '' };
                            setCreateFormData({ ...createFormData, personnelAwardInfo: newInfo });
                          }}
                          showSearch
                          optionFilterProp="label"
                          options={RANK_OPTIONS}
                          style={{ width: '100%', height: 40 }}
                          status={isMissingRank ? 'error' : undefined}
                        />
                        <Input
                          size="large"
                          placeholder="Chức vụ"
                          value={info.position}
                          onChange={e => {
                            const newInfo = [...createFormData.personnelAwardInfo];
                            newInfo[index] = { ...newInfo[index], position: e.target.value };
                            setCreateFormData({ ...createFormData, personnelAwardInfo: newInfo });
                          }}
                          status={isMissingPosition ? 'error' : undefined}
                          style={{ height: 40 }}
                        />
                      </div>
                    );
                  })}
                </div>
              </Card>
            )}
          </div>
        ) : (
          <div>
            <div style={{ marginBottom: 12 }}>
              <Text type="secondary">
                Đã chọn:{' '}
                <strong style={{ color: '#1890ff' }}>{createFormData.unitIds.length}</strong> đơn vị
              </Text>
            </div>
            <Space direction="vertical" size="small" style={{ marginBottom: 16, width: '100%' }}>
              <div>
                <Text style={{ display: 'block', marginBottom: 4 }}>Loại đơn vị</Text>
                <Select
                  style={{ width: '100%' }}
                  value={unitFilters.type}
                  onChange={value => setUnitFilters({ type: value })}
                >
                  <Select.Option value="ALL">Tất cả</Select.Option>
                  <Select.Option value="CO_QUAN">Cơ quan đơn vị</Select.Option>
                  <Select.Option value="DON_VI">Đơn vị trực thuộc</Select.Option>
                </Select>
              </div>
            </Space>
            <Table
              rowSelection={{
                selectedRowKeys: createFormData.unitIds,
                onChange: selectedRowKeys =>
                  setCreateFormData({ ...createFormData, unitIds: selectedRowKeys as string[] }),
              }}
              columns={[
                { title: 'Tên đơn vị', dataIndex: 'ten_don_vi', key: 'ten_don_vi', width: 300 },
                {
                  title: 'Loại',
                  key: 'loai',
                  width: 150,
                  render: (_value, record: Unit) => {
                    const isCoQuan = units.find(u => u.id === record.id);
                    return (
                      <Tag color={isCoQuan ? 'blue' : 'green'}>
                        {isCoQuan ? 'Cơ quan đơn vị' : 'Đơn vị trực thuộc'}
                      </Tag>
                    );
                  },
                },
              ]}
              dataSource={filteredUnits}
              rowKey="id"
              pagination={{
                ...DEFAULT_ANTD_TABLE_PAGINATION,
              }}
              scroll={{ y: 300 }}
              size="small"
            />
          </div>
        );

      case 2:
        return (
          <div>
            <div style={{ marginBottom: 12 }}>
              <Text strong style={{ display: 'block', marginBottom: 4 }}>
                Tải file đính kèm
              </Text>
              <Text type="secondary">Tải lên các file đính kèm (không bắt buộc)</Text>
            </div>
            <Upload
              fileList={createAttachedFileList}
              onChange={({ fileList }) => setCreateAttachedFileList(fileList)}
              beforeUpload={() => false}
              multiple
              accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"
            >
              <Button icon={<UploadOutlined />} size="large" style={{ width: '100%' }}>
                Chọn file đính kèm
              </Button>
            </Upload>
            <Text type="secondary" style={{ display: 'block', marginTop: 8 }}>
              Hỗ trợ: PDF, Word, Excel, hình ảnh. Tối đa 10 file.
            </Text>
          </div>
        );

      case 3:
        return (
          <Space direction="vertical" style={{ width: '100%' }} size="middle">
            {selectedDecision && (
              <Alert
                message="Đã tải quyết định từ hệ thống"
                description={`Quyết định "${selectedDecision.so_quyet_dinh}" đã tồn tại. Thông tin đã được tự động điền.`}
                type="success"
                showIcon
                closable
                onClose={() => setSelectedDecision(null)}
              />
            )}

            {/* Hiển thị file quyết định đã lưu trong DB */}
            {selectedDecision?.file_path && (
              <Card size="small" title="File quyết định đã lưu trong hệ thống">
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 12px',
                    backgroundColor: 'var(--ant-color-fill-quaternary)',
                    borderRadius: 4,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <FileOutlined style={{ color: '#52c41a' }} />
                    <Text>{selectedDecision.file_path.split('/').pop()}</Text>
                    <Tag color="green">Đã lưu</Tag>
                  </div>
                  <Button
                    type="link"
                    size="small"
                    icon={<DownloadOutlined />}
                    onClick={() => {
                      const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
                      const link = document.createElement('a');
                      link.href = `${baseUrl}/${selectedDecision.file_path}`;
                      link.download = selectedDecision.file_path.split('/').pop() || 'file';
                      link.target = '_blank';
                      document.body.appendChild(link);
                      link.click();
                      document.body.removeChild(link);
                    }}
                  >
                    Tải về
                  </Button>
                </div>
              </Card>
            )}

            <div>
              <Text style={{ display: 'block', marginBottom: 4 }}>Số quyết định</Text>
              <Text type="secondary" style={{ display: 'block', marginBottom: 8, fontSize: 12 }}>
                Nhập để tìm kiếm quyết định đã có hoặc tạo mới
              </Text>
              <AutoComplete
                options={decisionOptions}
                onSearch={handleSearchDecision}
                onSelect={value => handleDecisionSelect(value, false)}
                placeholder="Nhập số quyết định (VD: 123/QĐ-BQP)"
                notFoundContent={searchingDecision ? <Spin size="small" /> : null}
                style={{ width: '100%' }}
              >
                <Input
                  size="large"
                  value={createFormData.decisionNumber}
                  onChange={e =>
                    setCreateFormData({ ...createFormData, decisionNumber: e.target.value })
                  }
                />
              </AutoComplete>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div>
                <Text style={{ display: 'block', marginBottom: 4 }}>Năm quyết định</Text>
                <Input
                  type="number"
                  value={createFormData.decisionYear}
                  onChange={e =>
                    setCreateFormData({
                      ...createFormData,
                      decisionYear: parseInt(e.target.value) || new Date().getFullYear(),
                    })
                  }
                  size="large"
                  disabled={!!selectedDecision}
                />
              </div>
              <div>
                <Text style={{ display: 'block', marginBottom: 4 }}>Ngày ký quyết định</Text>
                <DatePicker
                  value={createFormData.signDate ? dayjs(createFormData.signDate) : null}
                  onChange={date =>
                    setCreateFormData({
                      ...createFormData,
                      signDate: date ? dayjs(date).format('YYYY-MM-DD') : '',
                    })
                  }
                  format="DD/MM/YYYY"
                  placeholder="Chọn ngày ký"
                  size="large"
                  style={{ width: '100%' }}
                  disabled={!!selectedDecision}
                />
              </div>
            </div>

            <div>
              <Text style={{ display: 'block', marginBottom: 4 }}>Người ký quyết định</Text>
              <Input
                value={createFormData.signer}
                onChange={e => setCreateFormData({ ...createFormData, signer: e.target.value })}
                placeholder="VD: Trung tướng Nguyễn Văn A - Chính ủy"
                size="large"
                disabled={!!selectedDecision}
              />
            </div>

          </Space>
        );

      case 4:
        return (
          <Space direction="vertical" style={{ width: '100%' }} size="large">
            <Card size="small" title="Thông tin khen thưởng">
              <Descriptions column={2} size="small">
                <Descriptions.Item label="Loại">
                  <Tag color={type === 'CA_NHAN' ? 'blue' : 'green'}>
                    {type === 'CA_NHAN' ? 'Cá nhân' : 'Tập thể'}
                  </Tag>
                </Descriptions.Item>
                <Descriptions.Item label="Năm">{createFormData.year}</Descriptions.Item>
                <Descriptions.Item label="Hình thức khen thưởng" span={2}>
                  {createFormData.awardForm}
                </Descriptions.Item>
                {createFormData.decisionNumber && (
                  <Descriptions.Item label="Số quyết định">
                    {createFormData.decisionNumber}
                  </Descriptions.Item>
                )}
                {createFormData.signer && (
                  <Descriptions.Item label="Người ký">{createFormData.signer}</Descriptions.Item>
                )}
              </Descriptions>
            </Card>

            <div>
              <Text style={{ display: 'block', marginBottom: 8 }}>Ghi chú</Text>
              <TextArea
                size="large"
                value={createFormData.note}
                onChange={e => setCreateFormData({ ...createFormData, note: e.target.value })}
                placeholder="Ghi chú bổ sung cho khen thưởng (không bắt buộc)"
                rows={2}
              />
            </div>

            {createAttachedFileList.length > 0 && (
              <Card size="small" title={`File đính kèm (${createAttachedFileList.length} file)`}>
                <Space direction="vertical" style={{ width: '100%' }} size="small">
                  {createAttachedFileList.map((file, index) => (
                    <div
                      key={index}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '8px 12px',
                        backgroundColor: 'var(--ant-color-fill-quaternary)',
                        borderRadius: 4,
                      }}
                    >
                      <FileOutlined style={{ color: '#1890ff' }} />
                      <Text>{file.name}</Text>
                    </div>
                  ))}
                </Space>
              </Card>
            )}

            <Card
              size="small"
              title={
                type === 'CA_NHAN'
                  ? `Danh sách cá nhân (${createFormData.personnelIds.length} người)`
                  : `Danh sách đơn vị (${createFormData.unitIds.length} đơn vị)`
              }
            >
              {type === 'CA_NHAN' ? (
                <Table
                  columns={[
                    {
                      title: 'STT',
                      key: 'stt',
                      width: 60,
                      render: (_, __, index) => index + 1,
                    },
                    { title: 'Họ tên', dataIndex: 'ho_ten', key: 'ho_ten' },
                    {
                      title: 'Cấp bậc',
                      key: 'cap_bac',
                      render: (_value, record: Personnel) => {
                        const awardInfo = createFormData.personnelAwardInfo.find(
                          info => info.personnelId === record.id
                        );
                        return awardInfo?.rank || record.cap_bac || '-';
                      },
                    },
                    {
                      title: 'Chức vụ',
                      key: 'chuc_vu',
                      render: (_value, record: Personnel) => {
                        const awardInfo = createFormData.personnelAwardInfo.find(
                          info => info.personnelId === record.id
                        );
                        return awardInfo?.position || record.ChucVu?.ten_chuc_vu || '-';
                      },
                    },
                  ]}
                  dataSource={createFormData.personnelIds
                    .map(id => personnel.find(p => p.id === id))
                    .filter((p): p is Personnel => p != null)}
                  rowKey="id"
                  pagination={false}
                  size="small"
                />
              ) : (
                <Table
                  columns={[
                    { title: 'STT', key: 'stt', width: 60, render: (_, __, index) => index + 1 },
                    { title: 'Tên đơn vị', dataIndex: 'ten_don_vi', key: 'ten_don_vi' },
                    {
                      title: 'Loại',
                      key: 'loai',
                      render: (_value, record: Unit | undefined) => {
                        const isCoQuan = units.find(u => u.id === record?.id);
                        return (
                          <Tag color={isCoQuan ? 'blue' : 'green'}>
                            {isCoQuan ? 'Cơ quan đơn vị' : 'Đơn vị trực thuộc'}
                          </Tag>
                        );
                      },
                    },
                  ]}
                  dataSource={createFormData.unitIds
                    .map(id => units.find(u => u.id === id) || subUnits.find(s => s.id === id))
                    .filter(Boolean)}
                  rowKey="id"
                  pagination={false}
                  size="small"
                />
              )}
            </Card>
          </Space>
        );

      default:
        return null;
    }
  };

  const validateCreateStep = (step: number): boolean => {
    const { awardForm, year, type, personnelIds, unitIds } = createFormData;

    switch (step) {
      case 0:
        if (!awardForm || !year) {
          message.error('Vui lòng điền đầy đủ thông tin bắt buộc');
          return false;
        }
        return true;
      case 1:
        if (type === 'CA_NHAN' && personnelIds.length === 0) {
          message.error('Vui lòng chọn ít nhất một quân nhân');
          return false;
        }
        if (type === 'TAP_THE' && unitIds.length === 0) {
          message.error('Vui lòng chọn ít nhất một đơn vị');
          return false;
        }
        // Rank and position are required for CA_NHAN awards
        if (type === 'CA_NHAN') {
          const missingInfo = createFormData.personnelAwardInfo.filter(
            info => !info.rank || !info.position
          );
          if (missingInfo.length > 0) {
            const missingNames = missingInfo
              .map(info => personnel.find(p => p.id === info.personnelId)?.ho_ten)
              .filter(Boolean)
              .join(', ');
            message.error(`Vui lòng nhập đầy đủ cấp bậc và chức vụ cho: ${missingNames}`);
            return false;
          }
        }
        return true;
      case 3:
        if (!createFormData.decisionNumber?.trim()) {
          message.error('Vui lòng nhập số quyết định');
          return false;
        }
        return true;
      default:
        return true;
    }
  };

  // RENDER
  return (
    <div style={{ padding: 24 }}>
      <Breadcrumb
        style={{ marginBottom: 16 }}
        items={[
          { href: '/admin/dashboard', title: <HomeOutlined /> },
          { title: 'Khen thưởng đột xuất' },
        ]}
      />

      <Card>
        <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
          <Title level={3} style={{ margin: 0 }}>
            Quản lý Khen thưởng Đột xuất
          </Title>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleOpenCreateModal}>
            Thêm khen thưởng
          </Button>
        </div>

        {/* Filters */}
        <Card size="small" style={{ marginBottom: 16 }}>
          <Row gutter={[16, 16]} align="middle">
            <Col xs={24} sm={12} md={6}>
              <label style={{ display: 'block', marginBottom: 4, fontSize: 12 }}>
                <FilterOutlined /> Năm
              </label>
              <Select
                style={{ width: '100%' }}
                placeholder="Tất cả các năm"
                value={tableFilters.year !== null ? tableFilters.year : ''}
                onChange={value =>
                  setTableFilters(prev => ({
                    ...prev,
                    year: value === '' ? null : typeof value === 'number' ? value : Number(value),
                  }))
                }
                allowClear
                size="large"
              >
                <Select.Option value="">Tất cả các năm</Select.Option>
                {availableYears.map(year => (
                  <Select.Option key={year} value={year}>
                    {year}
                  </Select.Option>
                ))}
              </Select>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <label style={{ display: 'block', marginBottom: 4, fontSize: 12 }}>
                <FilterOutlined /> Đối tượng
              </label>
              <Select
                style={{ width: '100%' }}
                placeholder="Tất cả loại"
                value={tableFilters.type}
                onChange={value => setTableFilters(prev => ({ ...prev, type: value }))}
                size="large"
              >
                <Select.Option value="ALL">Tất cả</Select.Option>
                <Select.Option value="CA_NHAN">Cá nhân</Select.Option>
                <Select.Option value="TAP_THE">Tập thể</Select.Option>
              </Select>
            </Col>
            <Col xs={24} sm={16} md={8}>
              <label style={{ display: 'block', marginBottom: 4, fontSize: 12 }}>
                <SearchOutlined /> Tìm kiếm
              </label>
              <Input
                placeholder="Tên, số quyết định, hình thức, ghi chú..."
                value={tableFilters.searchText}
                onChange={e => setTableFilters(prev => ({ ...prev, searchText: e.target.value }))}
                allowClear
                size="large"
                style={{ width: '100%' }}
              />
            </Col>
            <Col xs={24} sm={8} md={4}>
              <label
                style={{ display: 'block', marginBottom: 4, fontSize: 12, color: 'transparent' }}
              >
                .
              </label>
              <Button
                icon={null}
                onClick={handleResetFilters}
                size="large"
                style={{ width: '100%' }}
              >
                Xoá bộ lọc
              </Button>
            </Col>
          </Row>
          {(tableFilters.year || tableFilters.type !== 'ALL' || tableFilters.searchText) && (
            <div style={{ marginTop: 12 }}>
              <Text type="secondary">
                Đang hiển thị <strong>{filteredAwards.length}</strong> / {awards.length} bản ghi
              </Text>
            </div>
          )}
        </Card>

        <Table
          columns={columns}
          dataSource={filteredAwards}
          rowKey="id"
          loading={loading}
          scroll={{ x: 'max-content' }}
          pagination={{
            ...DEFAULT_ANTD_TABLE_PAGINATION,
            showTotal: (total, range) => `${range[0]}-${range[1]} của ${total} bản ghi`,
          }}
          onRow={record => ({
            onClick: () => handleOpenDetailModal(record),
            style: { cursor: 'pointer' },
          })}
        />
      </Card>

      {/* Create Modal */}
      <Modal
        title="Thêm khen thưởng đột xuất"
        open={createModalVisible}
        onCancel={handleCloseCreateModal}
        width={1080}
        footer={null}
        destroyOnClose
        centered
        maskClosable={false}
        styles={{
          body: {
            maxHeight: 'calc(100vh - 200px)',
            overflowY: 'auto',
            paddingRight: 8,
            paddingBottom: 16,
          },
        }}
      >
        <Steps
          current={createFormData.currentStep}
          size="small"
          style={{ marginBottom: 24 }}
          items={[
            { title: 'Thông tin cơ bản' },
            { title: 'Đối tượng' },
            { title: 'Tải tệp lên' },
            { title: 'Quyết định' },
            { title: 'Xem lại' },
          ]}
        />

        <div style={{ minHeight: 300, paddingBottom: 8 }}>{renderCreateStep()}</div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginTop: 24,
            paddingTop: 16,
            borderTop: '1px solid var(--ant-color-border)',
          }}
        >
          <Button
            onClick={() =>
              setCreateFormData(prev => ({
                ...prev,
                currentStep: Math.max(prev.currentStep - 1, 0),
              }))
            }
            disabled={createFormData.currentStep === 0}
          >
            Quay lại
          </Button>
          <div>
            {createFormData.currentStep < 4 ? (
              <Button
                type="primary"
                onClick={() => {
                  if (validateCreateStep(createFormData.currentStep)) {
                    setCreateFormData(prev => ({ ...prev, currentStep: prev.currentStep + 1 }));
                  }
                }}
              >
                Tiếp theo
              </Button>
            ) : (
              <Button type="primary" onClick={handleCreateSubmit} loading={submitting}>
                Tạo khen thưởng
              </Button>
            )}
          </div>
        </div>
      </Modal>

      {/* Edit Modal */}
      <Modal
        title="Chỉnh sửa khen thưởng đột xuất"
        open={editModalVisible}
        onCancel={handleCloseEditModal}
        width={720}
        footer={null}
        destroyOnClose
        centered
        maskClosable={false}
        styles={{
          body: {
            maxHeight: 'calc(100vh - 200px)',
            overflowY: 'auto',
            paddingRight: 8,
          },
        }}
      >
        {editingAward && (
          <Space direction="vertical" style={{ width: '100%' }} size="large">
            {/* Target Info - Read Only */}
            <Card size="small" title="Thông tin đối tượng">
              <Descriptions column={1} size="small">
                <Descriptions.Item label="Đối tượng">
                  <Tag color={editingAward.doi_tuong === 'CA_NHAN' ? 'blue' : 'green'}>
                    {editingAward.doi_tuong === 'CA_NHAN' ? 'Cá nhân' : 'Tập thể'}
                  </Tag>
                </Descriptions.Item>
                <Descriptions.Item label="Chi tiết">
                  {editingAward.doi_tuong === 'CA_NHAN' && editingAward.QuanNhan ? (
                    <strong>{editingAward.QuanNhan.ho_ten}</strong>
                  ) : editingAward.CoQuanDonVi ? (
                    editingAward.CoQuanDonVi.ten_don_vi
                  ) : editingAward.DonViTrucThuoc ? (
                    editingAward.DonViTrucThuoc.ten_don_vi
                  ) : (
                    '-'
                  )}
                </Descriptions.Item>
              </Descriptions>
            </Card>

            {/* Editable Fields */}
            <div>
              <Text strong style={{ display: 'block', marginBottom: 8 }}>
                Hình thức khen thưởng <span style={{ color: '#ff4d4f' }}>*</span>
              </Text>
              <Input
                value={editFormData.awardForm}
                onChange={e => setEditFormData({ ...editFormData, awardForm: e.target.value })}
                placeholder="Hình thức khen thưởng"
              />
            </div>

            <div>
              <Text strong style={{ display: 'block', marginBottom: 8 }}>
                Năm <span style={{ color: '#ff4d4f' }}>*</span>
              </Text>
              <InputNumber
                style={{ width: '100%' }}
                value={editFormData.year}
                onChange={value =>
                  setEditFormData({ ...editFormData, year: value || new Date().getFullYear() })
                }
                min={2000}
                max={2100}
              />
            </div>

            {/* Cấp bậc và chức vụ - chỉ hiện cho CA_NHAN */}
            {editingAward.doi_tuong === 'CA_NHAN' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div>
                  <Text style={{ display: 'block', marginBottom: 4 }}>Cấp bậc</Text>
                  <Select
                    placeholder="Chọn cấp bậc"
                    value={editFormData.rank || undefined}
                    onChange={value => setEditFormData({ ...editFormData, rank: value || '' })}
                    allowClear
                    showSearch
                    optionFilterProp="label"
                    options={RANK_OPTIONS}
                    style={{ width: '100%' }}
                  />
                </div>
                <div>
                  <Text style={{ display: 'block', marginBottom: 4 }}>Chức vụ</Text>
                  <Input
                    placeholder="Nhập chức vụ"
                    value={editFormData.position}
                    onChange={e => setEditFormData({ ...editFormData, position: e.target.value })}
                  />
                </div>
              </div>
            )}

            <div>
              <Text style={{ display: 'block', marginBottom: 4 }}>Số quyết định</Text>
              <AutoComplete
                value={editFormData.decisionNumber}
                options={decisionOptions}
                onSearch={handleSearchDecision}
                onSelect={value => handleDecisionSelect(value, true)}
                onChange={value =>
                  setEditFormData({ ...editFormData, decisionNumber: value || '' })
                }
                placeholder="Nhập số quyết định"
                notFoundContent={searchingDecision ? <Spin size="small" /> : null}
                style={{ width: '100%' }}
              >
                <Input />
              </AutoComplete>
            </div>

            <div>
              <Text style={{ display: 'block', marginBottom: 4 }}>Ghi chú</Text>
              <TextArea
                value={editFormData.note}
                onChange={e => setEditFormData({ ...editFormData, note: e.target.value })}
                placeholder="Ghi chú bổ sung"
                rows={3}
              />
            </div>

            {/* File đính kèm */}
            <Card size="small" title="File đính kèm">
              {editAttachedFileList.length > 0 && (
                <div style={{ marginBottom: 12 }}>
                  {editAttachedFileList.map(file => (
                    <div
                      key={file.uid}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '8px 12px',
                        marginBottom: 8,
                        backgroundColor: 'var(--ant-color-fill-quaternary)',
                        borderRadius: 4,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <FileOutlined style={{ color: '#1890ff' }} />
                        <Text>{file.name}</Text>
                        {file.uid.startsWith('existing-attached-') && (
                          <Tag color="blue">Đã lưu</Tag>
                        )}
                      </div>
                      <Button
                        type="text"
                        danger
                        size="small"
                        icon={<DeleteOutlined />}
                        onClick={() => {
                          if (file.uid.startsWith('existing-attached-')) {
                            handleRemoveExistingAttachedFile(file.uid);
                          } else {
                            setEditAttachedFileList(prev => prev.filter(f => f.uid !== file.uid));
                          }
                        }}
                      />
                    </div>
                  ))}
                </div>
              )}
              <div style={{ textAlign: 'center' }}>
                <Upload
                  fileList={editAttachedFileList.filter(
                    f => !f.uid.startsWith('existing-attached-')
                  )}
                  onChange={({ fileList }) => {
                    const existingFiles = editAttachedFileList.filter(f =>
                      f.uid.startsWith('existing-attached-')
                    );
                    setEditAttachedFileList([...existingFiles, ...fileList]);
                  }}
                  beforeUpload={() => false}
                  multiple
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"
                  showUploadList={false}
                >
                  <Button icon={<UploadOutlined />}>Thêm file đính kèm</Button>
                </Upload>
              </div>
            </Card>

            {/* Footer */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: 12,
                paddingTop: 16,
                marginTop: 16,
                borderTop: '1px solid var(--ant-color-border)',
                position: 'sticky',
                bottom: 0,
                zIndex: 1,
              }}
            >
              <Button onClick={handleCloseEditModal}>Hủy</Button>
              <Button type="primary" onClick={handleEditSubmit} loading={submitting}>
                Cập nhật
              </Button>
            </div>
          </Space>
        )}
      </Modal>

      {/* Detail Modal */}
      <Modal
        title="Chi tiết khen thưởng đột xuất"
        open={detailModalVisible}
        onCancel={handleCloseDetailModal}
        width={720}
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Button onClick={handleCloseDetailModal}>Đóng</Button>
            <Button
              type="primary"
              icon={<EditOutlined />}
              onClick={() => {
                handleCloseDetailModal();
                if (detailAward) handleOpenEditModal(detailAward);
              }}
            >
              Chỉnh sửa
            </Button>
          </div>
        }
        centered
        maskClosable={false}
        styles={{
          body: {
            maxHeight: 'calc(100vh - 200px)',
            overflowY: 'auto',
            paddingRight: 8,
          },
        }}
      >
        {detailAward && (
          <Space direction="vertical" style={{ width: '100%' }} size="large">
            <Card size="small" title="Thông tin đối tượng">
              <Descriptions column={2} size="small" bordered>
                <Descriptions.Item label="Đối tượng">
                  <Tag color={detailAward.doi_tuong === 'CA_NHAN' ? 'blue' : 'green'}>
                    {detailAward.doi_tuong === 'CA_NHAN' ? (
                      <>
                        <UserOutlined /> Cá nhân
                      </>
                    ) : (
                      <>
                        <TeamOutlined /> Tập thể
                      </>
                    )}
                  </Tag>
                </Descriptions.Item>
                <Descriptions.Item label="Năm">
                  <strong>{detailAward.nam}</strong>
                </Descriptions.Item>
                <Descriptions.Item label="Chi tiết" span={2}>
                  {detailAward.doi_tuong === 'CA_NHAN' && detailAward.QuanNhan ? (
                    <div>
                      <strong>{detailAward.QuanNhan.ho_ten}</strong>
                      {/* Chỉ hiển thị cấp bậc/chức vụ từ DB đã lưu, không hiện đơn vị */}
                      {detailAward.cap_bac && (
                        <div>
                          <Text type="secondary">Cấp bậc: {detailAward.cap_bac}</Text>
                        </div>
                      )}
                      {detailAward.chuc_vu && (
                        <div>
                          <Text type="secondary">Chức vụ: {detailAward.chuc_vu}</Text>
                        </div>
                      )}
                    </div>
                  ) : detailAward.CoQuanDonVi ? (
                    <strong>{detailAward.CoQuanDonVi.ten_don_vi}</strong>
                  ) : detailAward.DonViTrucThuoc ? (
                    <div>
                      <strong>{detailAward.DonViTrucThuoc.ten_don_vi}</strong>
                      {detailAward.DonViTrucThuoc.CoQuanDonVi && (
                        <div>
                          <Text type="secondary">
                            thuộc {detailAward.DonViTrucThuoc.CoQuanDonVi.ten_don_vi}
                          </Text>
                        </div>
                      )}
                    </div>
                  ) : (
                    '-'
                  )}
                </Descriptions.Item>
              </Descriptions>
            </Card>

            <Card size="small" title="Thông tin khen thưởng">
              <Descriptions column={1} size="small" bordered>
                <Descriptions.Item label="Hình thức khen thưởng">
                  <strong>{detailAward.hinh_thuc_khen_thuong}</strong>
                </Descriptions.Item>
                <Descriptions.Item label="Số quyết định">
                  {detailAward.so_quyet_dinh ? (
                    <a
                      onClick={() => handleOpenDecisionFile(detailAward.so_quyet_dinh!)}
                      style={{ color: '#52c41a', cursor: 'pointer' }}
                    >
                      {detailAward.so_quyet_dinh}
                    </a>
                  ) : (
                    <Text type="secondary">-</Text>
                  )}
                </Descriptions.Item>
                <Descriptions.Item label="Ghi chú">
                  {detailAward.ghi_chu || <Text type="secondary">-</Text>}
                </Descriptions.Item>
                <Descriptions.Item label="Ngày tạo">
                  {dayjs(detailAward.createdAt).format('DD/MM/YYYY HH:mm')}
                </Descriptions.Item>
              </Descriptions>
            </Card>

            {/* File đính kèm */}
            {detailAward.files_dinh_kem && detailAward.files_dinh_kem.length > 0 && (
              <Card size="small" title={`File đính kèm (${detailAward.files_dinh_kem.length})`}>
                <List
                  size="small"
                  dataSource={detailAward.files_dinh_kem}
                  renderItem={(file, index) => (
                    <List.Item
                      actions={[
                        <Button
                          key="download"
                          type="link"
                          icon={<DownloadOutlined />}
                          onClick={() => handlePreviewFile(file)}
                        >
                          Xem file
                        </Button>,
                      ]}
                    >
                      <List.Item.Meta
                        avatar={<FileOutlined style={{ fontSize: 24, color: '#1890ff' }} />}
                        title={file.originalName}
                        description={`${(file.size / 1024).toFixed(1)} KB - ${dayjs(file.uploadedAt).format('DD/MM/YYYY')}`}
                      />
                    </List.Item>
                  )}
                />
              </Card>
            )}
          </Space>
        )}
      </Modal>

      {/* Files Modal */}
      <Modal
        title="Danh sách file đính kèm"
        open={filesModalVisible}
        onCancel={handleCloseFilesModal}
        width={600}
        footer={<Button onClick={handleCloseFilesModal}>Đóng</Button>}
        centered
        maskClosable={false}
        styles={{
          body: {
            maxHeight: 'calc(100vh - 200px)',
            overflowY: 'auto',
            paddingRight: 8,
          },
        }}
      >
        <List
          dataSource={filesModalData}
          renderItem={(file, index) => (
            <List.Item
              actions={[
                <Button
                  key="download"
                  type="primary"
                  icon={<DownloadOutlined />}
                  onClick={() => handlePreviewFile(file)}
                >
                  Tải xuống
                </Button>,
              ]}
            >
              <List.Item.Meta
                avatar={<FileOutlined style={{ fontSize: 32, color: '#1890ff' }} />}
                title={file.originalName}
                description={
                  <Space direction="vertical" size={0}>
                    <Text type="secondary">Kích thước: {(file.size / 1024).toFixed(1)} KB</Text>
                    <Text type="secondary">
                      Ngày tải: {dayjs(file.uploadedAt).format('DD/MM/YYYY HH:mm')}
                    </Text>
                  </Space>
                }
              />
            </List.Item>
          )}
        />
      </Modal>
    </div>
  );
}
