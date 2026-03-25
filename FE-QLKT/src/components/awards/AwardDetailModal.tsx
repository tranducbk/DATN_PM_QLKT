'use client';

import { Modal, Descriptions, Tag, Typography, Space, Card, List, Button, Divider } from 'antd';
import {
  UserOutlined,
  TeamOutlined,
  FileOutlined,
  DownloadOutlined,
  TrophyOutlined,
  CalendarOutlined,
} from '@ant-design/icons';
import { DANH_HIEU_MAP } from '@/utils/awardsHelpers';
import { formatDate, formatDateTime } from '@/lib/utils';
import {
  PROPOSAL_STATUS,
  PROPOSAL_STATUS_LABELS,
  PROPOSAL_STATUS_COLORS,
} from '@/constants/proposal.constants';

const { Text, Title } = Typography;

export type AwardType =
  | 'annual'
  | 'unit'
  | 'hccsvv'
  | 'contribution'
  | 'commemoration'
  | 'militaryFlag'
  | 'scientific'
  | 'adhoc';

interface AwardDetailModalProps {
  open: boolean;
  onClose: () => void;
  award: any;
  awardType: AwardType;
}

// Map danh hiệu sang tên tiếng Việt
const DANH_HIEU_DISPLAY: Record<string, string> = {
  // Cá nhân hằng năm
  CSTDCS: 'Chiến sĩ thi đua cơ sở',
  CSTT: 'Chiến sĩ tiên tiến',
  CSTDTQ: 'Chiến sĩ thi đua toàn quân',
  BKBQP: 'Bằng khen của Bộ trưởng BQP',
  // Đơn vị hằng năm
  DVQT: 'Đơn vị quyết thắng',
  DVTT: 'Đơn vị tiên tiến',
  BKTTCP: 'Bằng khen của Thủ tướng Chính phủ',
  // HCCSVV
  HCCSVV_HANG_BA: 'Huy chương Chiến sĩ Vẻ vang Hạng Ba',
  HCCSVV_HANG_NHI: 'Huy chương Chiến sĩ Vẻ vang Hạng Nhì',
  HCCSVV_HANG_NHAT: 'Huy chương Chiến sĩ Vẻ vang Hạng Nhất',
  // HCBVTQ
  HCBVTQ_HANG_BA: 'Huân chương Bảo vệ Tổ quốc Hạng Ba',
  HCBVTQ_HANG_NHI: 'Huân chương Bảo vệ Tổ quốc Hạng Nhì',
  HCBVTQ_HANG_NHAT: 'Huân chương Bảo vệ Tổ quốc Hạng Nhất',
  // Thành tích khoa học
  NCKH: 'Đề tài khoa học',
  SKKH: 'Sáng kiến khoa học',
  GIAI_PHAP_KY_THUAT: 'Giải pháp kỹ thuật',
  ...DANH_HIEU_MAP,
};

// Tab labels
const AWARD_TYPE_LABELS: Record<AwardType, string> = {
  annual: 'Cá nhân hằng năm',
  unit: 'Đơn vị hằng năm',
  hccsvv: 'Huy chương Chiến sĩ Vẻ vang',
  contribution: 'Huân chương Bảo vệ Tổ quốc',
  commemoration: 'Kỷ niệm chương VSNXD QĐNDVN',
  militaryFlag: 'Huy chương quân kỳ Quyết thắng',
  scientific: 'Thành tích khoa học',
  adhoc: 'Khen thưởng đột xuất',
};

// Get file download URL
const getFileUrl = (filePath: string) => {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
  return `${baseUrl}/${filePath}`;
};

export default function AwardDetailModal({
  open,
  onClose,
  award,
  awardType,
}: AwardDetailModalProps) {
  if (!award) return null;

  // Get personnel info (may be nested or direct)
  const getPersonnelInfo = () => {
    if (award.QuanNhan) {
      return {
        hoTen: award.QuanNhan.ho_ten,
        capBac: award.cap_bac || award.QuanNhan.cap_bac,
        chucVu: award.chuc_vu || award.QuanNhan.ChucVu?.ten_chuc_vu,
        ngaySinh: award.QuanNhan.ngay_sinh,
        donVi: award.QuanNhan.DonViTrucThuoc?.ten_don_vi || award.QuanNhan.CoQuanDonVi?.ten_don_vi,
        coQuanDonVi: award.QuanNhan.CoQuanDonVi?.ten_don_vi,
      };
    }
    return {
      hoTen: award.ho_ten,
      capBac: award.cap_bac,
      chucVu: award.chuc_vu,
      ngaySinh: award.ngay_sinh,
      donVi: award.don_vi_truc_thuoc || award.don_vi,
      coQuanDonVi: award.co_quan_don_vi,
    };
  };

  // Get unit info for unit awards
  const getUnitInfo = () => {
    if (award.DonViTrucThuoc) {
      return {
        tenDonVi: award.DonViTrucThuoc.ten_don_vi,
        coQuanDonVi: award.DonViTrucThuoc.CoQuanDonVi?.ten_don_vi,
      };
    }
    if (award.CoQuanDonVi) {
      return {
        tenDonVi: award.CoQuanDonVi.ten_don_vi,
        coQuanDonVi: null,
      };
    }
    return {
      tenDonVi: award.don_vi_truc_thuoc || award.co_quan_don_vi || '-',
      coQuanDonVi: award.co_quan_don_vi,
    };
  };

  const personnel = getPersonnelInfo();
  const unit = getUnitInfo();

  // Render personnel info section
  const renderPersonnelInfo = () => (
    <Card size="small" title="Thông tin cá nhân">
      <Descriptions column={2} size="small" bordered>
        <Descriptions.Item label="Họ tên" span={2}>
          <Text strong>{personnel.hoTen || '-'}</Text>
        </Descriptions.Item>
        <Descriptions.Item label="Cấp bậc">{personnel.capBac || '-'}</Descriptions.Item>
        <Descriptions.Item label="Chức vụ">{personnel.chucVu || '-'}</Descriptions.Item>
        <Descriptions.Item label="Ngày sinh">{formatDate(personnel.ngaySinh)}</Descriptions.Item>
        <Descriptions.Item label="Đơn vị">{personnel.donVi || '-'}</Descriptions.Item>
        {personnel.coQuanDonVi && personnel.coQuanDonVi !== personnel.donVi && (
          <Descriptions.Item label="Cơ quan đơn vị" span={2}>
            {personnel.coQuanDonVi}
          </Descriptions.Item>
        )}
      </Descriptions>
    </Card>
  );

  // Render unit info section
  const renderUnitInfo = () => (
    <Card size="small" title="Thông tin đơn vị">
      <Descriptions column={1} size="small" bordered>
        <Descriptions.Item label="Tên đơn vị">
          <Text strong>{unit.tenDonVi || '-'}</Text>
        </Descriptions.Item>
        {unit.coQuanDonVi && (
          <Descriptions.Item label="Thuộc cơ quan đơn vị">{unit.coQuanDonVi}</Descriptions.Item>
        )}
      </Descriptions>
    </Card>
  );

  // Helper to add file from string path
  const addFileFromPath = (
    files: { path: string; filename: string; originalName?: string; label?: string }[],
    filePath: string | null | undefined,
    label: string
  ) => {
    if (!filePath) return;
    const filename = filePath.split('/').pop() || filePath;
    files.push({ path: filePath, filename, label });
  };

  // Helper to add files from JSON array
  const addFilesFromJson = (
    files: { path: string; filename: string; originalName?: string; label?: string }[],
    jsonFiles: any[] | null | undefined,
    label: string
  ) => {
    if (!jsonFiles || !Array.isArray(jsonFiles)) return;
    jsonFiles.forEach((file: any) => {
      if (file.path) {
        files.push({
          path: file.path,
          filename: file.filename || file.path.split('/').pop() || file.path,
          originalName: file.originalName,
          label,
        });
      }
    });
  };

  // Collect all files from award (handles both string path and JSON array)
  const getAllFiles = () => {
    const files: { path: string; filename: string; originalName?: string; label?: string }[] = [];

    // files_dinh_kem (JSON array) - used by adhoc awards for attached files
    // Note: File quyết định không còn lưu trong award, chỉ lưu số quyết định (so_quyet_dinh)
    // File path sẽ được query từ DB khi cần tải file
    addFilesFromJson(files, award.files_dinh_kem, 'File đính kèm');

    // BKBQP files (for annual awards)
    addFilesFromJson(files, award.files_quyet_dinh_bkbqp, 'File QĐ Bằng khen BQP');
    addFileFromPath(files, award.file_quyet_dinh_bkbqp, 'File QĐ Bằng khen BQP');

    // CSTDTQ files (for annual awards)
    addFilesFromJson(files, award.files_quyet_dinh_cstdtq, 'File QĐ CSTĐTQ');
    addFileFromPath(files, award.file_quyet_dinh_cstdtq, 'File QĐ CSTĐTQ');

    // BKTTCP files (for unit awards)
    addFilesFromJson(files, award.files_quyet_dinh_bkttcp, 'File QĐ Bằng khen TTCP');
    addFileFromPath(files, award.file_quyet_dinh_bkttcp, 'File QĐ Bằng khen TTCP');

    return files;
  };

  // Render all collected files
  const renderAllFiles = () => {
    const files = getAllFiles();
    if (files.length === 0) return null;

    return (
      <Card size="small" title={`File đính kèm (${files.length})`}>
        <List
          size="small"
          dataSource={files}
          renderItem={(file: any) => (
            <List.Item
              actions={[
                <Button
                  key="download"
                  type="link"
                  size="small"
                  icon={<DownloadOutlined />}
                  href={getFileUrl(file.path)}
                  target="_blank"
                >
                  Tải xuống
                </Button>,
              ]}
            >
              <List.Item.Meta
                avatar={<FileOutlined style={{ fontSize: 20, color: '#1890ff' }} />}
                title={file.originalName || file.filename}
                description={file.label}
              />
            </List.Item>
          )}
        />
      </Card>
    );
  };

  // Render decision info
  const renderDecisionInfo = () => {
    if (!award.so_quyet_dinh) return null;
    return (
      <Descriptions.Item label="Số quyết định">
        <a
          href={`/manager/decisions?search=${encodeURIComponent(award.so_quyet_dinh)}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          {award.so_quyet_dinh}
        </a>
      </Descriptions.Item>
    );
  };

  // Render content based on award type
  const renderContent = () => {
    switch (awardType) {
      case 'annual':
        return (
          <Space direction="vertical" style={{ width: '100%' }} size="middle">
            {renderPersonnelInfo()}
            <Card size="small" title="Thông tin khen thưởng">
              <Descriptions column={2} size="small" bordered>
                <Descriptions.Item label="Năm">{award.nam}</Descriptions.Item>
                <Descriptions.Item label="Danh hiệu">
                  <Tag color="blue">
                    {DANH_HIEU_DISPLAY[award.danh_hieu] || award.danh_hieu || '-'}
                  </Tag>
                </Descriptions.Item>
                {renderDecisionInfo()}
                {award.ghi_chu && (
                  <Descriptions.Item label="Ghi chú" span={2}>
                    {award.ghi_chu}
                  </Descriptions.Item>
                )}
                {award.nhan_bkbqp && (
                  <>
                    <Descriptions.Item label="Bằng khen BQP" span={2}>
                      <Tag color="gold">Đã nhận</Tag>
                      {award.so_quyet_dinh_bkbqp && (
                        <Text type="secondary" style={{ marginLeft: 8 }}>
                          QĐ: {award.so_quyet_dinh_bkbqp}
                        </Text>
                      )}
                    </Descriptions.Item>
                  </>
                )}
                {award.nhan_cstdtq && (
                  <>
                    <Descriptions.Item label="CSTĐTQ" span={2}>
                      <Tag color="purple">Đã nhận</Tag>
                      {award.so_quyet_dinh_cstdtq && (
                        <Text type="secondary" style={{ marginLeft: 8 }}>
                          QĐ: {award.so_quyet_dinh_cstdtq}
                        </Text>
                      )}
                    </Descriptions.Item>
                  </>
                )}
                {award.nhan_bkttcp && (
                  <>
                    <Descriptions.Item label="BKTTCP" span={2}>
                      <Tag color="cyan">Đã nhận</Tag>
                      {award.so_quyet_dinh_bkttcp && (
                        <Text type="secondary" style={{ marginLeft: 8 }}>
                          QĐ: {award.so_quyet_dinh_bkttcp}
                        </Text>
                      )}
                    </Descriptions.Item>
                  </>
                )}
              </Descriptions>
            </Card>
            {renderAllFiles()}
          </Space>
        );

      case 'unit':
        return (
          <Space direction="vertical" style={{ width: '100%' }} size="middle">
            {renderUnitInfo()}
            <Card size="small" title="Thông tin khen thưởng">
              <Descriptions column={2} size="small" bordered>
                <Descriptions.Item label="Năm">{award.nam}</Descriptions.Item>
                <Descriptions.Item label="Danh hiệu">
                  <Tag color="green">
                    {DANH_HIEU_DISPLAY[award.danh_hieu] || award.danh_hieu || '-'}
                  </Tag>
                </Descriptions.Item>
                {renderDecisionInfo()}
                {award.ghi_chu && (
                  <Descriptions.Item label="Ghi chú" span={2}>
                    {award.ghi_chu}
                  </Descriptions.Item>
                )}
              </Descriptions>
            </Card>
            {renderAllFiles()}
          </Space>
        );

      case 'hccsvv':
        return (
          <Space direction="vertical" style={{ width: '100%' }} size="middle">
            {renderPersonnelInfo()}
            <Card size="small" title="Thông tin khen thưởng">
              <Descriptions column={2} size="small" bordered>
                <Descriptions.Item label="Năm">{award.nam}</Descriptions.Item>
                <Descriptions.Item label="Danh hiệu">
                  <Tag color="gold">
                    {DANH_HIEU_DISPLAY[award.danh_hieu] || award.danh_hieu || '-'}
                  </Tag>
                </Descriptions.Item>
                <Descriptions.Item label="Thời gian phục vụ" span={2}>
                  {award.thoi_gian?.display || '-'}
                </Descriptions.Item>
                {renderDecisionInfo()}
                {award.ghi_chu && (
                  <Descriptions.Item label="Ghi chú" span={2}>
                    {award.ghi_chu}
                  </Descriptions.Item>
                )}
              </Descriptions>
            </Card>
            {renderAllFiles()}
          </Space>
        );

      case 'contribution':
        return (
          <Space direction="vertical" style={{ width: '100%' }} size="middle">
            {renderPersonnelInfo()}
            <Card size="small" title="Thông tin khen thưởng">
              <Descriptions column={2} size="small" bordered>
                <Descriptions.Item label="Năm">{award.nam}</Descriptions.Item>
                <Descriptions.Item label="Danh hiệu">
                  <Tag color="volcano">
                    {DANH_HIEU_DISPLAY[award.danh_hieu] || award.danh_hieu || '-'}
                  </Tag>
                </Descriptions.Item>
                <Descriptions.Item label="Nhóm hệ số 0.7">
                  {award.thoi_gian_nhom_0_7?.display || '-'}
                </Descriptions.Item>
                <Descriptions.Item label="Nhóm hệ số 0.8">
                  {award.thoi_gian_nhom_0_8?.display || '-'}
                </Descriptions.Item>
                <Descriptions.Item label="Nhóm hệ số 0.9-1.0" span={2}>
                  {award.thoi_gian_nhom_0_9_1_0?.display || '-'}
                </Descriptions.Item>
                {renderDecisionInfo()}
                {award.ghi_chu && (
                  <Descriptions.Item label="Ghi chú" span={2}>
                    {award.ghi_chu}
                  </Descriptions.Item>
                )}
              </Descriptions>
            </Card>
            {renderAllFiles()}
          </Space>
        );

      case 'commemoration':
        return (
          <Space direction="vertical" style={{ width: '100%' }} size="middle">
            {renderPersonnelInfo()}
            <Card size="small" title="Thông tin khen thưởng">
              <Descriptions column={2} size="small" bordered>
                <Descriptions.Item label="Năm">{award.nam}</Descriptions.Item>
                <Descriptions.Item label="Thời gian phục vụ">
                  {award.thoi_gian?.display || '-'}
                </Descriptions.Item>
                {renderDecisionInfo()}
                {award.ghi_chu && (
                  <Descriptions.Item label="Ghi chú" span={2}>
                    {award.ghi_chu}
                  </Descriptions.Item>
                )}
              </Descriptions>
            </Card>
            {renderAllFiles()}
          </Space>
        );

      case 'militaryFlag':
        return (
          <Space direction="vertical" style={{ width: '100%' }} size="middle">
            {renderPersonnelInfo()}
            <Card size="small" title="Thông tin khen thưởng">
              <Descriptions column={2} size="small" bordered>
                <Descriptions.Item label="Năm">{award.nam}</Descriptions.Item>
                <Descriptions.Item label="Thời gian phục vụ">
                  {award.thoi_gian?.display || '-'}
                </Descriptions.Item>
                {renderDecisionInfo()}
                {award.ghi_chu && (
                  <Descriptions.Item label="Ghi chú" span={2}>
                    {award.ghi_chu}
                  </Descriptions.Item>
                )}
              </Descriptions>
            </Card>
            {renderAllFiles()}
          </Space>
        );

      case 'scientific':
        return (
          <Space direction="vertical" style={{ width: '100%' }} size="middle">
            {renderPersonnelInfo()}
            <Card size="small" title="Thông tin thành tích">
              <Descriptions column={2} size="small" bordered>
                <Descriptions.Item label="Năm">{award.nam}</Descriptions.Item>
                <Descriptions.Item label="Loại">
                  <Tag color="cyan">{DANH_HIEU_DISPLAY[award.loai] || award.loai || '-'}</Tag>
                </Descriptions.Item>
                <Descriptions.Item label="Mô tả" span={2}>
                  {award.mo_ta || '-'}
                </Descriptions.Item>
                <Descriptions.Item label="Trạng thái">
                  <Tag
                    color={
                      award.status === PROPOSAL_STATUS.APPROVED
                        ? PROPOSAL_STATUS_COLORS[PROPOSAL_STATUS.APPROVED]
                        : PROPOSAL_STATUS_COLORS[PROPOSAL_STATUS.PENDING]
                    }
                  >
                    {award.status === PROPOSAL_STATUS.APPROVED
                      ? PROPOSAL_STATUS_LABELS[PROPOSAL_STATUS.APPROVED]
                      : PROPOSAL_STATUS_LABELS[PROPOSAL_STATUS.PENDING]}
                  </Tag>
                </Descriptions.Item>
                {renderDecisionInfo()}
                {award.ghi_chu && (
                  <Descriptions.Item label="Ghi chú" span={2}>
                    {award.ghi_chu}
                  </Descriptions.Item>
                )}
              </Descriptions>
            </Card>
            {renderAllFiles()}
          </Space>
        );

      case 'adhoc':
        return (
          <Space direction="vertical" style={{ width: '100%' }} size="middle">
            {/* Thông tin đối tượng */}
            <Card size="small" title="Thông tin đối tượng">
              <Descriptions column={2} size="small" bordered>
                <Descriptions.Item label="Đối tượng">
                  <Tag color={(award.doi_tuong || award.loai) === 'CA_NHAN' ? 'blue' : 'green'}>
                    {(award.doi_tuong || award.loai) === 'CA_NHAN' ? (
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
                <Descriptions.Item label="Năm">{award.nam}</Descriptions.Item>

                {(award.doi_tuong || award.loai) === 'CA_NHAN' && award.QuanNhan && (
                  <>
                    <Descriptions.Item label="Họ tên" span={2}>
                      <Text strong>{award.QuanNhan.ho_ten}</Text>
                    </Descriptions.Item>
                    <Descriptions.Item label="Cấp bậc">
                      {award.cap_bac || award.QuanNhan.cap_bac || '-'}
                    </Descriptions.Item>
                    <Descriptions.Item label="Chức vụ">
                      {award.chuc_vu || award.QuanNhan.ChucVu?.ten_chuc_vu || '-'}
                    </Descriptions.Item>
                    <Descriptions.Item label="Đơn vị" span={2}>
                      {award.QuanNhan.DonViTrucThuoc?.ten_don_vi ||
                        award.QuanNhan.CoQuanDonVi?.ten_don_vi ||
                        '-'}
                    </Descriptions.Item>
                  </>
                )}

                {(award.doi_tuong || award.loai) === 'TAP_THE' && (
                  <Descriptions.Item label="Đơn vị" span={2}>
                    <Text strong>
                      {award.CoQuanDonVi?.ten_don_vi || award.DonViTrucThuoc?.ten_don_vi || '-'}
                    </Text>
                    {award.DonViTrucThuoc?.CoQuanDonVi?.ten_don_vi && (
                      <Text type="secondary" style={{ display: 'block', marginTop: 4 }}>
                        Thuộc: {award.DonViTrucThuoc.CoQuanDonVi.ten_don_vi}
                      </Text>
                    )}
                  </Descriptions.Item>
                )}
              </Descriptions>
            </Card>

            {/* Thông tin khen thưởng */}
            <Card size="small" title="Thông tin khen thưởng">
              <Descriptions column={1} size="small" bordered>
                <Descriptions.Item label="Hình thức khen thưởng">
                  <Text strong>{award.hinh_thuc_khen_thuong || '-'}</Text>
                </Descriptions.Item>
                <Descriptions.Item label="Số quyết định">
                  {award.so_quyet_dinh ? (
                    <a
                      href={`/manager/decisions?search=${encodeURIComponent(award.so_quyet_dinh)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {award.so_quyet_dinh}
                    </a>
                  ) : (
                    '-'
                  )}
                </Descriptions.Item>
                <Descriptions.Item label="Ghi chú">{award.ghi_chu || '-'}</Descriptions.Item>
                <Descriptions.Item label="Ngày tạo">
                  {formatDateTime(award.createdAt)}
                </Descriptions.Item>
              </Descriptions>
            </Card>

            {/* File đính kèm */}
            {renderAllFiles()}
          </Space>
        );

      default:
        return <Text type="secondary">Không có thông tin chi tiết</Text>;
    }
  };

  return (
    <Modal
      title={
        <Space>
          <TrophyOutlined style={{ color: '#faad14' }} />
          <span>Chi tiết {AWARD_TYPE_LABELS[awardType]}</span>
        </Space>
      }
      open={open}
      onCancel={onClose}
      width={720}
      footer={<Button onClick={onClose}>Đóng</Button>}
      centered
      styles={{
        body: {
          maxHeight: 'calc(100vh - 200px)',
          overflowY: 'auto',
          paddingRight: 8,
        },
      }}
    >
      {renderContent()}
    </Modal>
  );
}
