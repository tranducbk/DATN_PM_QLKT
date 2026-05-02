'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Card,
  Typography,
  Descriptions,
  Button,
  Space,
  Tag,
  message,
  Breadcrumb,
  ConfigProvider,
  theme as antdTheme,
  Modal,
  Alert,
} from 'antd';
import { getApiErrorMessage } from '@/lib/apiError';

import { ArrowLeftOutlined, EditOutlined, ReloadOutlined, HomeOutlined } from '@ant-design/icons';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { apiClient } from '@/lib/apiClient';
import { formatDate, formatDateTime } from '@/lib/utils';
import { useTheme } from '@/components/ThemeProvider';
import { LoadingState } from '@/components/shared/LoadingState';
import { ROLES, getRoleInfo } from '@/constants/roles.constants';

const { Title } = Typography;

interface AccountDetail {
  id: string;
  username: string;
  role: string;
  createdAt: string;
  updatedAt: string;
  QuanNhan?: {
    ho_ten?: string | null;
    cccd?: string | null;
    ngay_sinh?: string | null;
    gioi_tinh?: string | null;
    so_dien_thoai?: string | null;
    cap_bac?: string | null;
    que_quan_2_cap?: string | null;
    que_quan_3_cap?: string | null;
    tru_quan?: string | null;
    cho_o_hien_nay?: string | null;
    ngay_nhap_ngu?: string | null;
    ngay_xuat_ngu?: string | null;
    ngay_vao_dang?: string | null;
    ngay_vao_dang_chinh_thuc?: string | null;
    so_the_dang_vien?: string | null;
    DonViTrucThuoc?: { ma_don_vi?: string; ten_don_vi?: string; CoQuanDonVi?: { ten_don_vi?: string } | null } | null;
    CoQuanDonVi?: { ma_don_vi?: string; ten_don_vi?: string } | null;
    ChucVu?: { ten_chuc_vu?: string } | null;
  } | null;
}

export default function AccountDetailPage() {
  const { theme } = useTheme();
  const params = useParams();
  const accountId = params?.id as string;
  const [loading, setLoading] = useState(true);
  const [account, setAccount] = useState<AccountDetail | null>(null);
  const [resetting, setResetting] = useState(false);

  const fetchAccountDetail = useCallback(async () => {
    setLoading(true);
    try {
      const response = await apiClient.getAccountById(accountId);
      if (response.success) {
        setAccount(response.data);
      } else {
        message.error(response.message || 'Lỗi khi lấy thông tin tài khoản');
      }
    } catch (error: unknown) {
      message.error(getApiErrorMessage(error, 'Lỗi khi lấy thông tin tài khoản'));
    } finally {
      setLoading(false);
    }
  }, [accountId]);

  useEffect(() => {
    if (accountId) {
      fetchAccountDetail();
    }
  }, [accountId, fetchAccountDetail]);

  const handleResetPassword = async () => {
    try {
      setResetting(true);
      const res = await apiClient.resetAccountPassword(accountId);
      if (res.success) {
        message.success('Đã đặt lại mật khẩu về mặc định');
      } else {
        message.error(res.message || 'Đặt lại mật khẩu thất bại');
      }
    } catch (e: unknown) {
      message.error(getApiErrorMessage(e, 'Đặt lại mật khẩu thất bại'));
    } finally {
      setResetting(false);
    }
  };

  const showResetConfirm = () => {
    Modal.confirm({
      centered: true,
      title: 'Đặt lại mật khẩu?',
      content: 'Mật khẩu sẽ đặt về mặc định (Hvkhqs@123). Tiếp tục?',
      okText: 'Xác nhận',
      cancelText: 'Hủy',
      onOk: handleResetPassword,
      okButtonProps: { loading: resetting, type: 'primary' },
      cancelButtonProps: { ghost: theme === 'dark' },
      maskClosable: false,
      rootClassName: theme === 'dark' ? 'dark' : undefined,
      width: 420,
    });
  };


  if (loading) {
    return <LoadingState fullPage text="Đang tải thông tin tài khoản..." />;
  }

  if (!account) {
    return (
      <div className="space-y-4">
        <Title level={2}>Không tìm thấy tài khoản</Title>
        <Link href="/super-admin/accounts">
          <Button icon={<ArrowLeftOutlined />}>Quay lại</Button>
        </Link>
      </div>
    );
  }

  return (
    <ConfigProvider
      theme={{
        algorithm: theme === 'dark' ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
      }}
    >
      <div className="space-y-6 p-6">
        {/* Breadcrumb */}
        <Breadcrumb
          items={[
            { title: <Link href="/super-admin/dashboard"><HomeOutlined /></Link> },
            { title: <Link href="/super-admin/accounts">Tài khoản</Link> },
            { title: `#${account.id}` },
          ]}
        />

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link href="/super-admin/accounts">
              <Button icon={<ArrowLeftOutlined />}>Quay lại</Button>
            </Link>
            <Title level={2} className="!mb-0">
              Chi tiết tài khoản
            </Title>
          </div>
          <Space wrap>
            <Link href={`/super-admin/accounts/${accountId}/edit`}>
              <Button type="primary" icon={<EditOutlined />}>
                Chỉnh sửa
              </Button>
            </Link>
            <Button icon={<ReloadOutlined />} loading={resetting} onClick={showResetConfirm}>
              Đặt lại mật khẩu
            </Button>
          </Space>
        </div>

        {/* Account Information Card */}
        <Card title="Thông tin tài khoản" className="shadow-sm">
          <Descriptions
            bordered
            column={1}
            size="middle"
            labelStyle={{ fontWeight: 600, width: '200px' }}
            contentStyle={{ color: theme === 'dark' ? '#f3f4f6' : '#111827' }}
          >
            <Descriptions.Item label="ID">{account.id}</Descriptions.Item>
            <Descriptions.Item label="Tên đăng nhập">{account.username}</Descriptions.Item>
            <Descriptions.Item label="Vai trò">
              <Tag color={getRoleInfo(account.role).color}>{getRoleInfo(account.role).label}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="Ngày tạo">
              {formatDateTime(account.createdAt)}
            </Descriptions.Item>
            <Descriptions.Item label="Cập nhật lần cuối">
              {formatDateTime(account.updatedAt)}
            </Descriptions.Item>
          </Descriptions>
        </Card>

        {/* Personnel Information Card */}
        {account.QuanNhan && (
          <Card title="Thông tin quân nhân liên kết" className="shadow-sm">
            <Descriptions
              bordered
              column={1}
              size="middle"
              labelStyle={{ fontWeight: 600, width: '200px' }}
              contentStyle={{ color: theme === 'dark' ? '#f3f4f6' : '#111827' }}
            >
              <Descriptions.Item label="Họ và tên">
                {account.QuanNhan.ho_ten || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="CCCD">{account.QuanNhan.cccd || '-'}</Descriptions.Item>
              <Descriptions.Item label="Giới tính">
                {account.QuanNhan.gioi_tinh === 'NAM'
                  ? 'Nam'
                  : account.QuanNhan.gioi_tinh === 'NU'
                    ? 'Nữ'
                    : '-'}
              </Descriptions.Item>
              <Descriptions.Item label="Ngày sinh">
                {account.QuanNhan.ngay_sinh ? formatDate(account.QuanNhan.ngay_sinh) : '-'}
              </Descriptions.Item>
              <Descriptions.Item label="Số điện thoại">
                {account.QuanNhan.so_dien_thoai || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="Cấp bậc">
                {account.QuanNhan.cap_bac || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="Quê quán (2 cấp)">
                {account.QuanNhan.que_quan_2_cap || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="Quê quán (3 cấp)">
                {account.QuanNhan.que_quan_3_cap || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="Trú quán">
                {account.QuanNhan.tru_quan || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="Chỗ ở hiện nay">
                {account.QuanNhan.cho_o_hien_nay || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="Ngày nhập ngũ">
                {account.QuanNhan.ngay_nhap_ngu ? formatDate(account.QuanNhan.ngay_nhap_ngu) : '-'}
              </Descriptions.Item>
              <Descriptions.Item label="Ngày xuất ngũ">
                {account.QuanNhan.ngay_xuat_ngu ? formatDate(account.QuanNhan.ngay_xuat_ngu) : '-'}
              </Descriptions.Item>
              <Descriptions.Item label="Ngày vào Đảng">
                {account.QuanNhan.ngay_vao_dang ? formatDate(account.QuanNhan.ngay_vao_dang) : '-'}
              </Descriptions.Item>
              <Descriptions.Item label="Ngày vào Đảng chính thức">
                {account.QuanNhan.ngay_vao_dang_chinh_thuc
                  ? formatDate(account.QuanNhan.ngay_vao_dang_chinh_thuc)
                  : '-'}
              </Descriptions.Item>
              <Descriptions.Item label="Số thẻ Đảng viên">
                {account.QuanNhan.so_the_dang_vien || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="Đơn vị trực thuộc">
                {account.QuanNhan.DonViTrucThuoc ? (
                  <>
                    {account.QuanNhan.DonViTrucThuoc.ma_don_vi} -{' '}
                    {account.QuanNhan.DonViTrucThuoc.ten_don_vi}
                    {account.QuanNhan.DonViTrucThuoc.CoQuanDonVi && (
                      <span className="text-gray-500 dark:text-gray-400 ml-2">
                        ({account.QuanNhan.DonViTrucThuoc.CoQuanDonVi.ten_don_vi})
                      </span>
                    )}
                  </>
                ) : (
                  '-'
                )}
              </Descriptions.Item>
              <Descriptions.Item label="Cơ quan đơn vị">
                {account.QuanNhan.CoQuanDonVi ? (
                  <>
                    {account.QuanNhan.CoQuanDonVi.ma_don_vi} -{' '}
                    {account.QuanNhan.CoQuanDonVi.ten_don_vi}
                  </>
                ) : (
                  '-'
                )}
              </Descriptions.Item>
              <Descriptions.Item label="Chức vụ">
                {account.QuanNhan.ChucVu?.ten_chuc_vu || '-'}
              </Descriptions.Item>
            </Descriptions>
          </Card>
        )}

        {/* No Personnel Warning */}
        {!account.QuanNhan && account.role !== ROLES.SUPER_ADMIN && (
          <Alert
            type="warning"
            showIcon
            message="Chưa liên kết quân nhân"
            description="Tài khoản này chưa được liên kết với quân nhân nào. Vui lòng liên kết tài khoản với quân nhân để sử dụng đầy đủ các chức năng của hệ thống."
            className="shadow-sm"
          />
        )}
      </div>
    </ConfigProvider>
  );
}
