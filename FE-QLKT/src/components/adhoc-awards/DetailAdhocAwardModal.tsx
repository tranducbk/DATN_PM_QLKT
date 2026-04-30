'use client';

import {
  Button,
  Tag,
  Space,
  Typography,
  Modal,
  Descriptions,
  Card,
  List,
} from 'antd';
import { formatDate, formatDateTime } from '@/lib/utils';
import {
  EditOutlined,
  FileOutlined,
  DownloadOutlined,
  UserOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import { downloadDecisionFile } from '@/lib/file/downloadDecisionFile';
import { previewFileWithApi } from '@/lib/file/filePreview';
import type { AdhocAward, FileInfo } from './types';

const { Text } = Typography;

interface DetailAdhocAwardModalProps {
  open: boolean;
  award: AdhocAward | null;
  onClose: () => void;
  onEdit: (award: AdhocAward) => void;
}

export function DetailAdhocAwardModal({
  open,
  award,
  onClose,
  onEdit,
}: DetailAdhocAwardModalProps) {
  const handleOpenDecisionFile = async (soQuyetDinh: string) => {
    await downloadDecisionFile(soQuyetDinh);
  };

  const handlePreviewFile = async (file: FileInfo) => {
    await previewFileWithApi(`/api/proposals/uploads/${file.filename}`, file.originalName);
  };

  return (
    <Modal
      title="Chi tiết khen thưởng đột xuất"
      open={open}
      onCancel={onClose}
      width={720}
      footer={
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <Button onClick={onClose}>Đóng</Button>
          <Button
            type="primary"
            icon={<EditOutlined />}
            onClick={() => {
              onClose();
              if (award) onEdit(award);
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
      {award && (
        <Space direction="vertical" style={{ width: '100%' }} size="large">
          <Card size="small" title="Thông tin đối tượng">
            <Descriptions column={2} size="small" bordered>
              <Descriptions.Item label="Đối tượng">
                <Tag color={award.doi_tuong === 'CA_NHAN' ? 'blue' : 'green'}>
                  {award.doi_tuong === 'CA_NHAN' ? (
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
                <strong>{award.nam}</strong>
              </Descriptions.Item>
              <Descriptions.Item label="Chi tiết" span={2}>
                {award.doi_tuong === 'CA_NHAN' && award.QuanNhan && (
                  <div>
                    <strong>{award.QuanNhan.ho_ten}</strong>
                    {award.cap_bac && (
                      <div>
                        <Text type="secondary">Cấp bậc: {award.cap_bac}</Text>
                      </div>
                    )}
                    {award.chuc_vu && (
                      <div>
                        <Text type="secondary">Chức vụ: {award.chuc_vu}</Text>
                      </div>
                    )}
                  </div>
                )}
                {award.doi_tuong !== 'CA_NHAN' && !!award.CoQuanDonVi && (
                  <strong>{award.CoQuanDonVi.ten_don_vi}</strong>
                )}
                {award.doi_tuong !== 'CA_NHAN' && !award.CoQuanDonVi && award.DonViTrucThuoc && (
                  <div>
                    <strong>{award.DonViTrucThuoc.ten_don_vi}</strong>
                    {award.DonViTrucThuoc.CoQuanDonVi && (
                      <div>
                        <Text type="secondary">
                          thuộc {award.DonViTrucThuoc.CoQuanDonVi.ten_don_vi}
                        </Text>
                      </div>
                    )}
                  </div>
                )}
                {award.doi_tuong !== 'CA_NHAN' && !award.CoQuanDonVi && !award.DonViTrucThuoc && '-'}
              </Descriptions.Item>
            </Descriptions>
          </Card>

          <Card size="small" title="Thông tin khen thưởng">
            <Descriptions column={1} size="small" bordered>
              <Descriptions.Item label="Hình thức khen thưởng">
                <strong>{award.hinh_thuc_khen_thuong}</strong>
              </Descriptions.Item>
              <Descriptions.Item label="Số quyết định">
                {award.so_quyet_dinh ? (
                  <a
                    onClick={() => handleOpenDecisionFile(award.so_quyet_dinh!)}
                    className="text-green-600 dark:text-green-400 cursor-pointer"
                  >
                    {award.so_quyet_dinh}
                  </a>
                ) : (
                  <Text type="secondary">-</Text>
                )}
              </Descriptions.Item>
              <Descriptions.Item label="Ghi chú">
                {award.ghi_chu || <Text type="secondary">-</Text>}
              </Descriptions.Item>
              <Descriptions.Item label="Ngày tạo">
                {formatDateTime(award.createdAt)}
              </Descriptions.Item>
            </Descriptions>
          </Card>

          {award.files_dinh_kem && award.files_dinh_kem.length > 0 && (
            <Card size="small" title={`File đính kèm (${award.files_dinh_kem.length})`}>
              <List
                size="small"
                dataSource={award.files_dinh_kem}
                renderItem={(file) => (
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
                      avatar={<FileOutlined className="text-2xl text-blue-500 dark:text-blue-400" />}
                      title={file.originalName}
                      description={`${(file.size / 1024).toFixed(1)} KB - ${formatDate(file.uploadedAt)}`}
                    />
                  </List.Item>
                )}
              />
            </Card>
          )}
        </Space>
      )}
    </Modal>
  );
}
